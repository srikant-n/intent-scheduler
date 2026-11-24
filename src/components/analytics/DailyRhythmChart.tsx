import type { AnalyticsSnapshot } from '@/types/analytics';
import { formatDuration, formatSignedDuration, todayISO } from '@/utils/time';
import { WEEKDAY_LABELS } from '@/utils/capacity';
import clsx from 'clsx';

interface Props {
  snapshot: AnalyticsSnapshot;
}

const MAX_BAR = 120;

export function DailyRhythmChart({ snapshot }: Props) {
  const maxVal = Math.max(1, ...snapshot.dailyRhythm.map((d) => Math.max(d.plannedMins, d.actualMins)));
  const avgPlanned = snapshot.dailyRhythm.length > 0
    ? snapshot.dailyRhythm.reduce((s, d) => s + d.plannedMins, 0) / snapshot.dailyRhythm.length
    : 0;
  const avgActual = snapshot.dailyRhythm.length > 0
    ? snapshot.dailyRhythm.reduce((s, d) => s + d.actualMins, 0) / snapshot.dailyRhythm.length
    : 0;
  const today = todayISO();

  return (
    <section className="card p-5">
      <div className="mb-1 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-text">Daily Rhythm</h2>
          <p className="text-xs text-text-muted">Planned vs actual minutes per weekday.</p>
        </div>
        <div className="flex gap-3 text-[10px] font-bold text-text-muted">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-accent" /> Planned</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-success" /> Actual</span>
          <span>avg {formatDuration(avgPlanned)} / {formatDuration(avgActual)}</span>
        </div>
      </div>
      <div className="mt-4 flex h-44 items-end gap-3">
        {snapshot.dailyRhythm.map((day) => {
          const isToday = day.date === today;
          return (
            <div key={day.date} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex h-36 items-end gap-1">
                <div
                  className={clsx('w-4 rounded-t', isToday ? 'bg-accent' : 'bg-accent/50')}
                  style={{ height: `${Math.max(2, (day.plannedMins / maxVal) * MAX_BAR)}px` }}
                  title={`Planned ${formatDuration(day.plannedMins)}`}
                />
                <div
                  className={clsx('w-4 rounded-t', isToday ? 'bg-success' : 'bg-success/50')}
                  style={{ height: `${Math.max(2, (day.actualMins / maxVal) * MAX_BAR)}px` }}
                  title={`Actual ${formatDuration(day.actualMins)}`}
                />
              </div>
              <span className={clsx('text-[10px] font-bold', isToday ? 'text-accent' : 'text-text-subtle')}>
                {WEEKDAY_LABELS[day.isoWeekday]}
              </span>
              <span className="text-[9px] text-text-subtle">{day.date.slice(8, 10)}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-text-subtle">
              <th className="pb-2 pr-3">Day</th>
              <th className="pb-2 pr-3">Date</th>
              <th className="pb-2 pr-3 text-right">Planned</th>
              <th className="pb-2 pr-3 text-right">Actual</th>
              <th className="pb-2 text-right">Variance</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.dailyRhythm.map((day) => {
              const isToday = day.date === today;
              const variance = day.actualMins - day.plannedMins;
              return (
                <tr key={day.date} className={clsx('border-b border-border/60 last:border-0', isToday && 'bg-accent-soft/40')}>
                  <td className={clsx('py-2 pr-3 font-semibold', isToday ? 'text-accent' : 'text-text')}>
                    {WEEKDAY_LABELS[day.isoWeekday]}
                  </td>
                  <td className="py-2 pr-3 text-text-muted">{day.date}</td>
                  <td className="py-2 pr-3 text-right text-text-muted">{formatDuration(day.plannedMins)}</td>
                  <td className="py-2 pr-3 text-right text-text-muted">{formatDuration(day.actualMins)}</td>
                  <td className={clsx('py-2 text-right font-semibold', variance >= 0 ? 'text-warning' : 'text-success')}>
                    {formatSignedDuration(variance)}
                  </td>
                </tr>
              );
            })}
            {snapshot.dailyRhythm.length === 0 && (
              <tr><td colSpan={5} className="py-6 text-center text-text-muted">No daily data for this week.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
