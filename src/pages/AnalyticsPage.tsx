import { useMemo } from 'react';
import { BarChart3, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { AnalyticsKpiGrid } from '@/components/analytics/AnalyticsKpiGrid';
import { CategoryVariancePanel } from '@/components/analytics/CategoryVariancePanel';
import { DailyRhythmChart } from '@/components/analytics/DailyRhythmChart';
import { EstimationDriftPanel } from '@/components/analytics/EstimationDriftPanel';
import { RolloverAnalyticsPanel } from '@/components/analytics/RolloverAnalyticsPanel';
import { ReflectionInsights } from '@/components/analytics/ReflectionInsights';
import { useAllIntentions } from '@/hooks/useIntentions';
import { useCategories } from '@/hooks/useCategories';
import { useScheduleRange } from '@/hooks/useSchedule';
import { useTimeLogsRange } from '@/hooks/useLogs';
import { useWeeklyCapacity } from '@/hooks/useWeeklyCapacity';
import { buildAnalyticsSnapshot } from '@/utils/analytics';
import { addDaysISO, formatWeekRangeISO, todayISO, weekDatesISO, weekEndISO } from '@/utils/time';

interface AnalyticsPageProps {
  date: string;
  onDateChange: (date: string) => void;
}

const HISTORY_START = '2000-01-01';

export function AnalyticsPage({ date, onDateChange }: AnalyticsPageProps) {
  const weekDates = useMemo(() => weekDatesISO(date), [date]);
  const weekEnd = weekEndISO(date);

  const blocksQuery = useScheduleRange(HISTORY_START, weekEnd);
  const logsQuery = useTimeLogsRange(HISTORY_START, weekEnd);
  const allBlocks = useMemo(() => blocksQuery.data ?? [], [blocksQuery.data]);
  const allLogs = useMemo(() => logsQuery.logs, [logsQuery.logs]);
  const { intentions } = useAllIntentions();
  const { categories } = useCategories();
  const { capacity } = useWeeklyCapacity();

  const snapshot = useMemo(
    () =>
      buildAnalyticsSnapshot({
        weekDates,
        allBlocks,
        allLogs,
        intentions,
        categories,
        capacity,
      }),
    [weekDates, allBlocks, allLogs, intentions, categories, capacity],
  );

  const isLoading = blocksQuery.isLoading || logsQuery.isLoading;

  return (
    <div className="space-y-5">
      <section className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-accent">
              <BarChart3 size={14} /> Time Analytics
            </div>
            <h1 className="text-2xl font-bold text-text">{formatWeekRangeISO(date)}</h1>
            <p className="mt-1 text-xs text-text-muted">
              Week-scoped panels with estimation drift computed over all history through {weekEnd}.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => onDateChange(addDaysISO(date, -7))}><ChevronLeft size={15} /> Prev</Button>
            <Button variant="secondary" onClick={() => onDateChange(todayISO())}>This Week</Button>
            <Button variant="secondary" onClick={() => onDateChange(addDaysISO(date, 7))}>Next <ChevronRight size={15} /></Button>
          </div>
        </div>
      </section>

      {isLoading ? (
        <div className="card p-10 text-center text-sm text-text-muted">Loading analytics…</div>
      ) : (
        <>
          <AnalyticsKpiGrid snapshot={snapshot} />
          <div className="grid gap-5 xl:grid-cols-2">
            <CategoryVariancePanel snapshot={snapshot} dates={weekDates} />
            <DailyRhythmChart snapshot={snapshot} />
          </div>
          <div className="grid gap-5 xl:grid-cols-2">
            <EstimationDriftPanel snapshot={snapshot} />
            <RolloverAnalyticsPanel snapshot={snapshot} />
          </div>
          <ReflectionInsights snapshot={snapshot} />
        </>
      )}
    </div>
  );
}
