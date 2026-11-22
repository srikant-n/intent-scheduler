import clsx from 'clsx';
import type { AnalyticsSnapshot } from '@/types/analytics';
import { formatDuration, formatSignedDuration } from '@/utils/time';
import { CategoryStackedChart } from './CategoryStackedChart';

interface Props {
  snapshot: AnalyticsSnapshot;
  dates: string[];
}

export function CategoryVariancePanel({ snapshot, dates }: Props) {
  return (
    <section className="card p-5">
      <h2 className="mb-1 text-sm font-bold text-text">Category Variance</h2>
      <p className="mb-4 text-xs text-text-muted">Planned vs actual minutes per category for the selected week.</p>
      <CategoryStackedChart slices={snapshot.categoryStack} dates={dates} />
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-text-subtle">
              <th className="pb-2 pr-3">Category</th>
              <th className="pb-2 pr-3 text-right">Planned</th>
              <th className="pb-2 pr-3 text-right">Actual</th>
              <th className="pb-2 pr-3 text-right">Variance</th>
              <th className="pb-2 pr-3 text-right">Realized</th>
              <th className="pb-2 text-right">Tendency</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.categories.map((cat) => (
              <tr key={cat.categoryId ?? 'none'} className="border-b border-border/60 last:border-0">
                <td className="py-2 pr-3">
                  <span className="flex items-center gap-1.5 font-semibold text-text">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: cat.colorHex }} />
                    {cat.name}
                  </span>
                </td>
                <td className="py-2 pr-3 text-right text-text-muted">{formatDuration(cat.plannedMins)}</td>
                <td className="py-2 pr-3 text-right text-text-muted">{formatDuration(cat.actualMins)}</td>
                <td className={clsx('py-2 pr-3 text-right font-semibold', cat.varianceMins >= 0 ? 'text-warning' : 'text-success')}>
                  {formatSignedDuration(cat.varianceMins)}
                </td>
                <td className="py-2 pr-3 text-right text-text-muted">{cat.realizationPct != null ? `${cat.realizationPct}%` : '—'}</td>
                <td className="py-2 text-right">
                  <span className={clsx(
                    'rounded-full px-2 py-0.5 text-[10px] font-bold',
                    cat.tendency === 'on-track' && 'bg-success-soft text-success',
                    cat.tendency === 'under-realized' && 'bg-danger-soft text-danger',
                    cat.tendency === 'over-realized' && 'bg-warning-soft text-warning',
                    cat.tendency === 'insufficient' && 'bg-surface-high text-text-subtle',
                  )}>
                    {cat.tendency}
                  </span>
                </td>
              </tr>
            ))}
            {snapshot.categories.length === 0 && (
              <tr><td colSpan={6} className="py-6 text-center text-text-muted">No category data for this week.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
