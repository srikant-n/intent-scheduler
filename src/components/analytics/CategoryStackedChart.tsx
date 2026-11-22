import type { DailyCategorySlice } from '@/types/analytics';
import { WEEKDAY_LABELS } from '@/utils/capacity';
import { isoWeekdayISO } from '@/utils/time';

interface Props {
  slices: DailyCategorySlice[];
  dates: string[];
}

const MAX_BAR = 140;

export function CategoryStackedChart({ slices, dates }: Props) {
  const byDate = new Map<string, DailyCategorySlice[]>();
  for (const slice of slices) {
    byDate.set(slice.date, [...(byDate.get(slice.date) ?? []), slice]);
  }
  const maxTotal = Math.max(1, ...dates.map((d) => (byDate.get(d) ?? []).reduce((s, x) => s + x.minutes, 0)));
  const legend = [...new Map(slices.map((s) => [s.categoryId ?? 'none', { id: s.categoryId, name: s.name, colorHex: s.colorHex }])).values()];

  return (
    <div>
      <div className="flex h-40 items-end gap-2">
        {dates.map((date) => {
          const daySlices = byDate.get(date) ?? [];
          const total = daySlices.reduce((s, x) => s + x.minutes, 0);
          return (
            <div key={date} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex w-full flex-col-reverse overflow-hidden rounded-md" style={{ height: `${Math.max(4, (total / maxTotal) * MAX_BAR)}px` }}>
                {daySlices.map((slice) => (
                  <div
                    key={`${slice.date}-${slice.categoryId ?? 'none'}`}
                    style={{ height: `${(slice.minutes / Math.max(1, total)) * 100}%`, backgroundColor: slice.colorHex }}
                    title={`${slice.name}: ${slice.minutes}m`}
                  />
                ))}
              </div>
              <span className="text-[9px] font-bold text-text-subtle">{WEEKDAY_LABELS[isoWeekdayISO(date)]}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {legend.map((cat) => (
          <span key={cat.id ?? 'none'} className="flex items-center gap-1 text-[10px] text-text-muted">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: cat.colorHex }} />
            {cat.name}
          </span>
        ))}
      </div>
    </div>
  );
}
