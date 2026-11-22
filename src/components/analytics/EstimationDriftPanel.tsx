import clsx from 'clsx';
import type { AnalyticsSnapshot, DriftBias } from '@/types/analytics';
import { formatDuration, formatSignedDuration } from '@/utils/time';

interface Props {
  snapshot: AnalyticsSnapshot;
}

const biasLabel: Record<DriftBias, string> = {
  underestimated: 'Underestimated',
  overestimated: 'Overestimated',
  'spot-on': 'Spot on',
  insufficient: 'Insufficient data',
};

const biasClass: Record<DriftBias, string> = {
  underestimated: 'bg-warning-soft text-warning',
  overestimated: 'bg-accent-soft text-accent',
  'spot-on': 'bg-success-soft text-success',
  insufficient: 'bg-surface-high text-text-subtle',
};

export function EstimationDriftPanel({ snapshot }: Props) {
  const { drift } = snapshot;
  return (
    <section className="card p-5">
      <h2 className="mb-1 text-sm font-bold text-text">Estimation Drift</h2>
      <p className="mb-4 text-xs text-text-muted">How planned time compares to logged reality across all history through this week.</p>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-surface-low p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Sessions</div>
          <div className="mt-1 text-lg font-bold text-text">{drift.sessions}</div>
        </div>
        <div className="rounded-xl border border-border bg-surface-low p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Avg Variance</div>
          <div className="mt-1 text-lg font-bold text-text">{formatSignedDuration(drift.avgVarianceMins)}</div>
        </div>
        <div className="rounded-xl border border-border bg-surface-low p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Avg Abs Drift</div>
          <div className="mt-1 text-lg font-bold text-text">{formatDuration(drift.avgAbsVarianceMins)}</div>
        </div>
        <div className="rounded-xl border border-border bg-surface-low p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Grade</div>
          <div className="mt-1 text-lg font-bold text-text">{drift.grade}</div>
        </div>
      </div>

      {drift.tasks.length > 0 && (
        <div className="mb-4">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-text-subtle">Task-level drift</div>
          <div className="space-y-1.5">
            {drift.tasks.slice(0, 6).map((task) => (
              <div key={task.taskId} className="flex items-center justify-between rounded-lg border border-border bg-surface-low px-3 py-2 text-xs">
                <div className="min-w-0">
                  <div className="truncate font-semibold text-text">{task.title}</div>
                  <div className="text-[10px] text-text-muted">{task.sessions} session{task.sessions === 1 ? '' : 's'}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={clsx('font-semibold', task.avgVarianceMins >= 0 ? 'text-warning' : 'text-success')}>
                    {formatSignedDuration(task.avgVarianceMins)}
                  </span>
                  <span className={clsx('rounded-full px-2 py-0.5 text-[10px] font-bold', biasClass[task.bias])}>
                    {biasLabel[task.bias]}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {drift.recentSessions.length > 0 && (
        <div>
          <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-text-subtle">Recent drifted sessions</div>
          <div className="space-y-1">
            {drift.recentSessions.slice(0, 5).map((session) => (
              <div key={session.blockId} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-xs hover:bg-surface-low">
                <span className="truncate font-medium text-text">{session.taskTitle}</span>
                <span className="text-text-muted">
                  {formatDuration(session.plannedMins)} → {formatDuration(session.actualMins)}{' '}
                  <span className={clsx('font-semibold', session.varianceMins >= 0 ? 'text-warning' : 'text-success')}>
                    ({formatSignedDuration(session.varianceMins)})
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {drift.sessions === 0 && <p className="text-sm text-text-muted">No blocks with linked actual logs yet — drift appears once reality is recorded against plans.</p>}
    </section>
  );
}
