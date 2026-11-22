export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function addDaysISO(iso: string, days: number): string {
  const date = parseISODate(iso);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

export function weekDatesISO(referenceISO: string): string[] {
  const date = parseISODate(referenceISO);
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = addDaysISO(referenceISO, mondayOffset);
  return Array.from({ length: 7 }, (_, i) => addDaysISO(monday, i));
}

export function formatDateLong(iso: string): string {
  return parseISODate(iso).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatDateShort(iso: string): string {
  return parseISODate(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function formatWeekRangeISO(referenceISO: string): string {
  const dates = weekDatesISO(referenceISO);
  const start = parseISODate(dates[0]);
  const end = parseISODate(dates[6]);
  const sameMonth = start.getMonth() === end.getMonth();
  const startText = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const endText = end.toLocaleDateString(undefined, sameMonth ? { day: 'numeric', year: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' });
  return `${startText} – ${endText}`;
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function minutesToTime(minutes: number): string {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, Math.round(minutes)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function snapMinutes(minutes: number, interval = 15): number {
  return Math.round(minutes / interval) * interval;
}

export function formatDuration(mins: number | null | undefined): string {
  if (mins == null || Number.isNaN(mins)) return '0m';
  const total = Math.max(0, Math.round(mins));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function formatTime12(time: string | null | undefined): string {
  if (!time) return '—';
  const [hRaw, mRaw] = time.split(':');
  const h = Number(hRaw);
  const m = Number(mRaw);
  if (Number.isNaN(h) || Number.isNaN(m)) return time;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, '0')} ${suffix}`;
}

export function formatDateTime12(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function elapsedMs(startedAt: string, accumulatedPausedMs: number, pausedAt: string | null, now = Date.now()): number {
  const start = new Date(startedAt).getTime();
  if (Number.isNaN(start)) return 0;
  const end = pausedAt ? new Date(pausedAt).getTime() : now;
  if (Number.isNaN(end)) return 0;
  return Math.max(0, end - start - accumulatedPausedMs);
}

export function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
}

export function deriveLogTimes(startedAt: string, elapsed: number): { logDate: string; startTime: string; endTime: string | null } {
  const startDate = new Date(startedAt);
  const endDate = new Date(startDate.getTime() + elapsed);
  const sameDay = toISODate(startDate) === toISODate(endDate);
  return {
    logDate: toISODate(startDate),
    startTime: localTimeFromDate(startDate),
    endTime: sameDay ? localTimeFromDate(endDate) : null,
  };
}

export function localTimeFromDate(date: Date): string {
  return minutesToTime(date.getHours() * 60 + date.getMinutes());
}

export function isoWeekdayISO(iso: string): number {
  const day = parseISODate(iso).getDay();
  return ((day + 6) % 7) + 1;
}

export function weekStartISO(referenceISO: string): string {
  return weekDatesISO(referenceISO)[0];
}

export function weekEndISO(referenceISO: string): string {
  return weekDatesISO(referenceISO)[6];
}

export function nextMondayISO(referenceISO: string): string {
  const isoDay = isoWeekdayISO(referenceISO);
  const delta = isoDay === 1 ? 7 : 8 - isoDay;
  return addDaysISO(referenceISO, delta);
}

export function isoWeekNumber(iso: string): number {
  const date = parseISODate(iso);
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

export function formatWeekRangeShort(referenceISO: string): string {
  const dates = weekDatesISO(referenceISO);
  const start = parseISODate(dates[0]);
  const end = parseISODate(dates[6]);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  return sameMonth
    ? `${start.toLocaleDateString(undefined, { month: 'short' })} ${start.getDate()} – ${end.getDate()}, ${end.getFullYear()}`
    : `${start.toLocaleDateString(undefined, opts)}, ${start.getFullYear()} – ${end.toLocaleDateString(undefined, opts)}, ${end.getFullYear()}`;
}

export function formatSignedDuration(mins: number | null | undefined): string {
  if (mins == null || Number.isNaN(mins)) return '—';
  const rounded = Math.round(mins);
  if (rounded === 0) return '0m';
  const sign = rounded > 0 ? '+' : '−';
  return `${sign}${formatDuration(Math.abs(rounded))}`;
}

export function isValidISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = parseISODate(value);
  if (Number.isNaN(date.getTime())) return false;
  const [y, m, d] = value.split('-').map(Number);
  return date.getFullYear() === y && date.getMonth() === (m ?? 0) - 1 && date.getDate() === d;
}

export function isValidTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
