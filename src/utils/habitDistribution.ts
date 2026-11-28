import type { Intention, ScheduleBlock } from '@/types/database';
import { capacityForWeekday, type WeeklyCapacity } from '@/utils/capacity';
import { rangesOverlap } from '@/utils/schedule';
import { isoWeekdayISO, isValidTime, minutesToTime, snapMinutes, timeToMinutes } from '@/utils/time';

export interface HabitProposal {
  task: Intention;
  scheduledDate: string;
  startTime: string;
  endTime: string;
  plannedDurationMins: number;
}

export interface HabitSkip {
  task: Intention;
  requested: number;
  placed: number;
  reason: string;
}

export interface HabitDistributionResult {
  proposals: HabitProposal[];
  skips: HabitSkip[];
}

export interface HabitDistributionOptions {
  weekDates: string[];
  existingBlocks: ScheduleBlock[];
  capacity: WeeklyCapacity;
  dayStartHour: number;
  dayEndHour: number;
  snapInterval: number;
}

interface DayCandidate {
  date: string;
  isoDay: number;
  remaining: number;
  preferred: boolean;
  slot: { startTime: string; endTime: string };
  slotDistance: number;
}

/** Blocks that still count toward the week — dismissed/rolled blocks are excluded everywhere. */
function countsTowardWeek(block: ScheduleBlock): boolean {
  return block.status !== 'dismissed' && block.status !== 'rolled';
}

/** Total planned minutes already on `date` (excluding dismissed/rolled). */
function dayPlannedMinutes(blocks: ScheduleBlock[], date: string): number {
  return blocks
    .filter((block) => block.scheduledDate === date && countsTowardWeek(block))
    .reduce((sum, block) => sum + block.plannedDurationMins, 0);
}

/** Find a free `durationMins` slot on `date` within [dayStart, dayEnd], skipping
 * ranges overlapping existing blocks and preferring starts nearest `preferredStartTime`. */
function findSlot(
  blocks: ScheduleBlock[],
  date: string,
  durationMins: number,
  dayStartMinutes: number,
  dayEndMinutes: number,
  snapInterval: number,
  preferredStartTime?: string | null,
): { startTime: string; endTime: string } | null {
  const dayBlocks = blocks.filter(
    (block) => block.scheduledDate === date && countsTowardWeek(block),
  );
  const first = snapMinutes(dayStartMinutes, snapInterval);
  const last = dayEndMinutes - durationMins;
  const starts: number[] = [];
  for (let start = first; start <= last; start += snapInterval) starts.push(start);

  const preferredMinutes = preferredStartTime && isValidTime(preferredStartTime)
    ? timeToMinutes(preferredStartTime)
    : null;
  const orderedStarts = preferredMinutes == null
    ? starts
    : [...starts].sort((a, b) => Math.abs(a - preferredMinutes) - Math.abs(b - preferredMinutes) || a - b);

  for (const start of orderedStarts) {
    const end = start + durationMins;
    const overlaps = dayBlocks.some((block) =>
      rangesOverlap(minutesToTime(start), minutesToTime(end), block.startTime, block.endTime),
    );
    if (!overlaps) return { startTime: minutesToTime(start), endTime: minutesToTime(end) };
  }
  return null;
}

/** Public wrapper around {@link findSlot} for single-slot lookups (e.g. drag-to-schedule). */
export function firstAvailableSlot(
  blocks: ScheduleBlock[],
  date: string,
  durationMins: number,
  dayStartMinutes: number,
  dayEndMinutes: number,
  snapInterval: number,
  preferredStartTime?: string | null,
): { startTime: string; endTime: string } | null {
  return findSlot(blocks, date, durationMins, dayStartMinutes, dayEndMinutes, snapInterval, preferredStartTime);
}

/** Whether any counted block on `date` overlaps [startTime, endTime), optionally excluding one block (for move/resize checks). */
export function blocksOverlapOnDate(
  blocks: ScheduleBlock[],
  date: string,
  startTime: string,
  endTime: string,
  excludeBlockId?: string,
): boolean {
  return blocks.some(
    (block) =>
      block.scheduledDate === date &&
      block.id !== excludeBlockId &&
      countsTowardWeek(block) &&
      rangesOverlap(startTime, endTime, block.startTime, block.endTime),
  );
}

/** Greedy habit scheduler: for each active recurring intention with a weekly
 * session target, place the deficit (target − already-planned) into free slots,
 * preferring the task's preferred weekdays, preferred time, then days with most
 * remaining capacity. Returns proposed blocks plus per-task skips when
 * capacity/slots run out. */
export function computeHabitDistribution(
  intentions: Intention[],
  options: HabitDistributionOptions,
): HabitDistributionResult {
  const { weekDates, existingBlocks, capacity, dayStartHour, dayEndHour, snapInterval } = options;
  const dayStartMinutes = dayStartHour * 60;
  const dayEndMinutes = dayEndHour * 60;

  // Mutable working copy so proposals placed earlier in the run avoid collisions.
  const placed: ScheduleBlock[] = [...existingBlocks];
  const proposals: HabitProposal[] = [];
  const skips: HabitSkip[] = [];

  const habits = intentions.filter(
    (item) => item.isRecurring && item.status === 'active' && (item.targetSessionsPerWeek ?? 0) > 0,
  );

  for (const task of habits) {
    const target = task.targetSessionsPerWeek ?? 0;
    const alreadyPlanned = existingBlocks.filter(
      (block) => block.taskId === task.id && countsTowardWeek(block),
    ).length;
    let deficit = Math.max(0, target - alreadyPlanned);
    let placedForTask = 0;
    const duration = task.defaultDurationMins ?? 30;
    const preferred = new Set(task.preferredWeekdays);
    const preferredStartMinutes = task.preferredTime && isValidTime(task.preferredTime)
      ? timeToMinutes(task.preferredTime)
      : null;

    while (deficit > 0) {
      const candidates = weekDates
        .map((date): DayCandidate | null => {
          const isoDay = isoWeekdayISO(date);
          const used = dayPlannedMinutes(placed, date);
          const remaining = capacityForWeekday(capacity, isoDay) - used;
          if (remaining < duration) return null;
          const slot = findSlot(placed, date, duration, dayStartMinutes, dayEndMinutes, snapInterval, task.preferredTime);
          if (!slot) return null;
          const slotDistance = preferredStartMinutes == null
            ? 0
            : Math.abs(timeToMinutes(slot.startTime) - preferredStartMinutes);
          return {
            date,
            isoDay,
            remaining,
            preferred: preferred.size === 0 || preferred.has(isoDay),
            slot,
            slotDistance,
          };
        })
        .filter((candidate): candidate is DayCandidate => candidate !== null)
        .sort((a, b) => Number(b.preferred) - Number(a.preferred) || a.slotDistance - b.slotDistance || b.remaining - a.remaining);

      let placedThisRound = false;
      for (const candidate of candidates) {
        const slot = candidate.slot;
        proposals.push({ task, scheduledDate: candidate.date, ...slot, plannedDurationMins: duration });
        placed.push({
          id: `proposal-${proposals.length}`,
          taskId: task.id,
          scheduledDate: candidate.date,
          startTime: slot.startTime,
          endTime: slot.endTime,
          plannedDurationMins: duration,
          notes: null,
          status: 'planned',
          rolledFromBlockId: null,
          createdAt: '',
        });
        deficit -= 1;
        placedForTask += 1;
        placedThisRound = true;
        break;
      }

      if (!placedThisRound) break;
    }

    const unmet = deficit;
    if (unmet > 0) {
      skips.push({
        task,
        requested: target,
        placed: placedForTask,
        reason: 'Not enough open capacity or free slots remained in the week.',
      });
    }
  }

  return { proposals, skips };
}
