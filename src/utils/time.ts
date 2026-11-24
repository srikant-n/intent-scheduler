/** Format a local Date as `YYYY-MM-DD` (ISO date, no timezone). */
export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Today's date as `YYYY-MM-DD`. */
export function todayISO(): string {
  return toISODate(new Date());
}

/** Parse `YYYY-MM-DD` into a local Date (noon-safe via local constructor). */
export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** Return `iso` shifted by `days` days, as `YYYY-MM-DD`. */
export function addDaysISO(iso: string, days: number): string {
  const date = parseISODate(iso);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

/** The Mon–Sun week containing `referenceISO`, as seven `YYYY-MM-DD` strings. */
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

/** `HH:MM` → minutes since midnight. */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Minutes since midnight → `HH:MM`, clamped to [00:00, 23:59]. */
export function minutesToTime(minutes: number): string {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, Math.round(minutes)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Round minutes to the nearest multiple of `interval` (default 15). */
export function snapMinutes(minutes: number, interval = 15): number {
  return Math.round(minutes / interval) * interval;
}

/** Human-readable duration, e.g. `45m`, `2h`, `1h 30m`. */
export function formatDuration(mins: number | null | undefined): string {
  if (mins == null || Number.isNaN(mins)) return '0m';
  const total = Math.max(0, Math.round(mins));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** `HH:MM` → 12-hour display like `9:05 AM`; `—` for missing input. */
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

/** ISO timestamp → localized time (e.g. for "exported at" display). */
export function formatDateTime12(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** Elapsed wall-clock ms for a timer run, subtracting paused time. */
export function elapsedMs(startedAt: string, accumulatedPausedMs: number, pausedAt: string | null, now = Date.now()): number {
  const start = new Date(startedAt).getTime();
  if (Number.isNaN(start)) return 0;
  const end = pausedAt ? new Date(pausedAt).getTime() : now;
  if (Number.isNaN(end)) return 0;
  return Math.max(0, end - start - accumulatedPausedMs);
}

/** Milliseconds → `HH:MM:SS` (zero-padded). */
export function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
}

/** Derive log date/times from a timer start + elapsed duration. `endTime` is null when the run crosses midnight. */
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

/** Local `HH:MM` for a Date (timer stop times). */
export function localTimeFromDate(date: Date): string {
  return minutesToTime(date.getHours() * 60 + date.getMinutes());
}

/** ISO weekday number: Mon=1 … Sun=7. */
export function isoWeekdayISO(iso: string): number {
  const day = parseISODate(iso).getDay();
  return ((day + 6) % 7) + 1;
}

/** Monday of the week containing `referenceISO`. */
export function weekStartISO(referenceISO: string): string {
  return weekDatesISO(referenceISO)[0];
}

/** Sunday of the week containing `referenceISO`. */
export function weekEndISO(referenceISO: string): string {
  return weekDatesISO(referenceISO)[6];
}

/** The Monday of next week relative to `referenceISO` (used by weekly rollover). */
export function nextMondayISO(referenceISO: string): string {
  const isoDay = isoWeekdayISO(referenceISO);
  const delta = isoDay === 1 ? 7 : 8 - isoDay;
  return addDaysISO(referenceISO, delta);
}

/** ISO-8601 week number of `iso` (weeks start Monday, week 1 contains the year's first Thursday). */
export function isoWeekNumber(iso: string): number {
  const date = parseISODate(iso);
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

/** Compact week-range label, e.g. `Feb 17 – 23, 2025` or `Feb 24 – Mar 2, 2025`. */
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

/** Signed duration for variance display, e.g. `+45m`, `−1h 30m`, `0m`. */
export function formatSignedDuration(mins: number | null | undefined): string {
  if (mins == null || Number.isNaN(mins)) return '—';
  const rounded = Math.round(mins);
  if (rounded === 0) return '0m';
  const sign = rounded > 0 ? '+' : '−';
  return `${sign}${formatDuration(Math.abs(rounded))}`;
}

/** Strict `YYYY-MM-DD` validation — rejects malformed dates like 2025-02-30. */
export function isValidISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = parseISODate(value);
  if (Number.isNaN(date.getTime())) return false;
  const [y, m, d] = value.split('-').map(Number);
  return date.getFullYear() === y && date.getMonth() === (m ?? 0) - 1 && date.getDate() === d;
}

/** Strict `HH:MM` (24-hour) validation. */
export function isValidTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

/** UUID v4 for all entity primary keys (crypto.randomUUID with Math.random fallback). */
export function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
