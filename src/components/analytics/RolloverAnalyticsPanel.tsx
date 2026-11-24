import type { AnalyticsSnapshot } from '@/types/analytics';
import { formatDuration } from '@/utils/time';

interface Props {
  snapshot: AnalyticsSnapshot;
}

/** Counts/minutes for rolled, dismissed, missed, and still-pending blocks. */
export function RolloverAnalyticsPanel({ snapshot }: Props) {
  const { rollover } = snapshot;
  const cards = [
    { label: 'Rolled over', count: rollover.rolledCount, mins: rollover.rolledMins, className: 'text-accent' },
    { label: 'Dismissed', count: rollover.dismissedCount, mins: rollover.dismissedMins, className: 'text-text-muted' },
    { label: 'Missed', count: rollover.missedCount, mins: rollover.missedMins, className: 'text-warning' },
    { label: 'Pending now', count: rollover.pendingCount, mins: rollover.pendingMins, className: 'text-danger' },
  ];

  return (
    <section className="card p-5">
      <h2 className="mb-1 text-sm font-bold text-text">Rollover Load</h2>
      <p className="mb-4 text-xs text-text-muted">What happened to intent that didn't happen on schedule.</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-xl border border-border bg-surface-low p-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted">{card.label}</div>
            <div className={`mt-1 text-xl font-bold ${card.className}`}>{card.count}</div>
            <div className="text-[11px] text-text-subtle">{formatDuration(card.mins)}</div>
          </div>
        ))}
      </div>
      {rollover.events.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-text-subtle">Recent rollover events</div>
          <div className="max-h-48 space-y-1 overflow-y-auto">
            {rollover.events.map((event) => (
              <div key={event.blockId} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-xs hover:bg-surface-low">
                <span className="truncate font-medium text-text">{event.taskTitle}</span>
                <span className="text-text-muted">
                  {event.scheduledDate} • {event.status} • {formatDuration(event.minutes)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
