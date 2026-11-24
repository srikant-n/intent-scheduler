import { CalendarClock, Gauge, Timer, Zap } from 'lucide-react';
import type { AnalyticsSnapshot } from '@/types/analytics';
import { formatDuration } from '@/utils/time';

interface Props {
  snapshot: AnalyticsSnapshot;
}

/** Four headline stat cards for the selected week: planned, actual, ad-hoc, drift grade. */
export function AnalyticsKpiGrid({ snapshot }: Props) {
  const stats = [
    { label: 'Planned Intent', value: formatDuration(snapshot.plannedMins), icon: CalendarClock, hint: `${snapshot.blockCount} blocks` },
    { label: 'Actual Reality', value: formatDuration(snapshot.actualMins), icon: Timer, hint: `${snapshot.logCount} logs` },
    { label: 'Spontaneous / Ad-hoc', value: formatDuration(snapshot.adHocMins), icon: Zap, hint: `${formatDuration(snapshot.unplannedMins)} unplanned` },
    { label: 'Estimation Drift', value: snapshot.drift.grade, icon: Gauge, hint: `avg abs ${formatDuration(snapshot.drift.avgAbsVarianceMins)} over ${snapshot.drift.sessions} sessions` },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.label} className="card p-4">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-text-muted">
            <span>{stat.label}</span>
            <stat.icon size={16} />
          </div>
          <div className="mt-1 text-2xl font-bold text-text">{stat.value}</div>
          <div className="text-[11px] text-text-subtle">{stat.hint}</div>
        </div>
      ))}
    </div>
  );
}
