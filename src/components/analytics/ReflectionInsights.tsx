import { Lightbulb, NotebookPen } from 'lucide-react';
import type { AnalyticsSnapshot } from '@/types/analytics';
import type { TimeLogMood as Mood } from '@/types/database';
import { formatDuration } from '@/utils/time';

interface Props {
  snapshot: AnalyticsSnapshot;
}

const moodLabels: Record<Mood, string> = {
  restorative: 'Restorative',
  energizing: 'Energizing',
  distraction: 'Distraction',
  firefight: 'Firefight',
};

export function ReflectionInsights({ snapshot }: Props) {
  const totalMoods = snapshot.moods.reduce((s, m) => s + m.minutes, 0);
  return (
    <section className="card p-5">
      <h2 className="mb-1 flex items-center gap-2 text-sm font-bold text-text"><Lightbulb size={15} className="text-accent" /> Reflection Insights</h2>
      <p className="mb-4 text-xs text-text-muted">Deterministic observations computed locally from this week's data.</p>

      <ul className="mb-5 space-y-2">
        {snapshot.insights.map((insight, index) => (
          <li key={index} className="flex gap-2 rounded-lg border border-border bg-surface-low px-3 py-2 text-xs text-text">
            <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
            {insight}
          </li>
        ))}
      </ul>

      {snapshot.moods.length > 0 && (
        <div className="mb-5">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-text-subtle">Mood distribution</div>
          <div className="flex flex-wrap gap-2">
            {snapshot.moods.map((bucket) => (
              <span key={bucket.mood} className="rounded-full border border-border bg-surface-low px-3 py-1 text-[11px] font-semibold text-text-muted">
                {moodLabels[bucket.mood]} • {formatDuration(bucket.minutes)} ({Math.round((bucket.minutes / Math.max(1, totalMoods)) * 100)}%)
              </span>
            ))}
          </div>
        </div>
      )}

      {snapshot.reflections.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-text-subtle">
            <NotebookPen size={12} /> Recent reflections
          </div>
          <div className="space-y-1.5">
            {snapshot.reflections.map((entry) => (
              <div key={entry.logId} className="rounded-lg border border-border bg-surface-low px-3 py-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-text">{entry.title}</span>
                  <span className="text-[10px] text-text-subtle">{entry.logDate} • {formatDuration(entry.minutes)}</span>
                </div>
                {entry.notes && <p className="mt-1 text-xs text-text-muted">{entry.notes}</p>}
                {entry.mood && <span className="mt-1 inline-block rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-bold text-accent">{moodLabels[entry.mood]}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
