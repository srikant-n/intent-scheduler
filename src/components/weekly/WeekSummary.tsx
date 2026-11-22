import { CalendarClock, Timer, TrendingUp } from 'lucide-react';
import type { WeeklySummary } from '@/utils/weekly';
import { formatDuration, formatSignedDuration, formatWeekRangeShort, isoWeekNumber, weekDatesISO } from '@/utils/time';

interface Props {
  summary: WeeklySummary;
  anchorDate: string;
}

function pct(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

function fidelityBadge(pct: number | null): { label: string; className: string } {
  if (pct == null) return { label: 'No data', className: 'bg-surface-high text-text-subtle' };
  if (pct >= 90) return { label: 'High Flow', className: 'bg-accent-soft text-accent' };
  if (pct >= 70) return { label: 'Steady', className: 'bg-success-soft text-success' };
  return { label: 'Drifting', className: 'bg-warning-soft text-warning' };
}

export function WeekSummary({ summary, anchorDate }: Props) {
  const weekStart = weekDatesISO(anchorDate)[0];
  const utilization = summary.utilizationPct ?? 0;
  const fidelity = summary.pacingFidelityPct;
  const fidelityInfo = fidelityBadge(fidelity);
  const plannedVsActual = summary.totalPlannedMins > 0 ? summary.totalActualMins - summary.totalPlannedMins : null;
  const balanceBasis = summary.categoryBalance.reduce((s, c) => s + c.plannedMins, 0) > 0
    ? summary.categoryBalance.map((c) => ({ ...c, share: c.plannedMins }))
    : summary.categoryBalance.map((c) => ({ ...c, share: c.actualMins }));
  const balanceSum = Math.max(1, balanceBasis.reduce((s, c) => s + c.share, 0));

  const tiles = [
    {
      label: 'Planned Intent',
      icon: CalendarClock,
      value: `${formatDuration(summary.totalPlannedMins)} / ${formatDuration(summary.totalCapacityMins)}`,
      hint: `${utilization}% of capacity scheduled`,
      bar: utilization,
      barClass: utilization > 100 ? 'bg-danger' : 'bg-accent',
    },
    {
      label: 'Actual Tracked',
      icon: Timer,
      value: formatDuration(summary.totalActualMins),
      hint: plannedVsActual != null
        ? `${formatSignedDuration(plannedVsActual)} vs plan${summary.totalUnplannedMins > 0 ? ` • ${formatDuration(summary.totalUnplannedMins)} unplanned` : ''}`
        : `${formatDuration(summary.totalUnplannedMins)} unplanned`,
      bar: pct(summary.totalActualMins, summary.totalPlannedMins || summary.totalActualMins),
      barClass: 'bg-success',
    },
    {
      label: 'Pacing Fidelity',
      icon: TrendingUp,
      value: fidelity != null ? `${fidelity}%` : '—',
      badge: fidelityInfo,
      hint: `${summary.habitAdherence.fulfilledSessions}/${summary.habitAdherence.plannedSessions} habit sessions completed`,
      bar: fidelity ?? 0,
      barClass: 'bg-[#6366f1]',
    },
  ];

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-text">Week {isoWeekNumber(weekStart)} · {formatWeekRangeShort(anchorDate)}</h2>
        </div>
        {summary.pendingRolloverCount > 0 && (
          <span className="rounded-full bg-warning-soft px-3 py-1 text-[11px] font-bold text-warning">
            {summary.pendingRolloverCount} block{summary.pendingRolloverCount === 1 ? '' : 's'} pending rollover
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="flex flex-col justify-between rounded-xl border border-border bg-surface p-3 shadow-sm">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-text-muted">
              <span>{tile.label}</span>
              <tile.icon size={14} className="text-text-subtle" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-xl font-bold text-text">{tile.value}</span>
              {'badge' in tile && tile.badge && (
                <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${tile.badge.className}`}>{tile.badge.label}</span>
              )}
            </div>
            <div className="mt-2">
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-high">
                <div className={`h-full rounded-full ${tile.barClass}`} style={{ width: `${Math.min(100, tile.bar)}%` }} />
              </div>
              <div className="mt-1 text-[10px] text-text-subtle">{tile.hint}</div>
            </div>
          </div>
        ))}

        <div className="flex flex-col justify-between rounded-xl border border-border bg-surface p-3 shadow-sm">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-text-muted">
            <span>Balance Intent</span>
            <span className="font-medium normal-case text-text-subtle">{summary.categoryBalance.length} domains</span>
          </div>
          <div className="mt-2 flex h-3 overflow-hidden rounded-full bg-surface-high">
            {balanceBasis.map((cat) => (
              <div
                key={cat.categoryId ?? 'none'}
                style={{ width: `${(cat.share / balanceSum) * 100}%`, backgroundColor: cat.colorHex }}
                title={`${cat.name} ${Math.round((cat.share / balanceSum) * 100)}%`}
              />
            ))}
            {balanceBasis.length === 0 && <div className="h-full w-full bg-surface-high" />}
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {balanceBasis.slice(0, 3).map((cat) => (
              <span
                key={cat.categoryId ?? 'none'}
                className="inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold"
                style={{ color: cat.colorHex, borderColor: `${cat.colorHex}55`, backgroundColor: `${cat.colorHex}14` }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: cat.colorHex }} />
                {cat.name} {Math.round((cat.share / balanceSum) * 100)}%
              </span>
            ))}
            {balanceBasis.length === 0 && <span className="text-[10px] text-text-subtle">No planned time yet</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
