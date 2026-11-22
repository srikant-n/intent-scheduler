import { useEffect, useState } from 'react';
import { Sidebar, ViewKey } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';
import { ActiveTimerBar } from '@/components/layout/ActiveTimerBar';
import { DailyPage } from '@/pages/DailyPage';
import { IntentionsPage } from '@/pages/IntentionsPage';
import { PlaceholderPage } from '@/pages/PlaceholderPage';
import { useIntentions } from '@/hooks/useIntentions';
import { bootstrapDatabase } from '@/db/queries';
import { todayISO } from '@/utils/time';

export default function App() {
  const [view, setView] = useState<ViewKey>('daily');
  const [date, setDate] = useState(todayISO());
  const [quickLogOpen, setQuickLogOpen] = useState(false);
  const { intentions } = useIntentions('active');

  useEffect(() => {
    void bootstrapDatabase().catch((error) => console.error('Failed to bootstrap database', error));
  }, []);

  return (
    <div className="min-h-full bg-canvas text-text">
      <Sidebar view={view} onChange={setView} intentionsCount={intentions.length} onQuickLog={() => { setView('daily'); setQuickLogOpen(true); }} />
      <div className="pl-60">
        <TopBar date={date} onQuickLog={() => { setView('daily'); setQuickLogOpen(true); }} />
        <main className="mx-auto w-full max-w-[1600px] px-6 py-6 pb-28">
          {view === 'daily' && (
            <DailyPage
              date={date}
              onDateChange={setDate}
              quickLogOpen={quickLogOpen}
              onQuickLogOpenChange={setQuickLogOpen}
              onOpenIntentions={() => setView('intentions')}
            />
          )}
          {view === 'intentions' && <IntentionsPage />}
          {view === 'weekly' && <PlaceholderPage title="Weekly Planner" description="The 7-day allocation desk is planned for the next phase." />}
          {view === 'analytics' && <PlaceholderPage title="Time Analytics" description="Category variance, drift, and reflection dashboards are planned for the next phase." />}
          {view === 'vault' && <PlaceholderPage title="Data Vault" description="Backup, restore, CSV export, and database health are planned for the next phase." />}
        </main>
      </div>
      <ActiveTimerBar />
    </div>
  );
}
