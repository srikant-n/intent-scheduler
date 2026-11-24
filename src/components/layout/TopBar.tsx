import { useEffect, useState } from 'react';
import { todayISO } from '@/utils/time';

interface TopBarProps {
  date: string;
}

export function TopBar({ date }: TopBarProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const dateLabel = now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const timeLabel = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-canvas px-6">
      <div className="hidden text-sm text-text-muted sm:block">{date === todayISO() ? 'Viewing today' : `Viewing ${date}`}</div>
      <div className="flex items-center gap-4">
        <div className="flex items-baseline gap-2">
          <div className="text-sm font-semibold text-text">{dateLabel}</div>
          <span className="text-lg font-bold tabular-nums text-text">{timeLabel}</span>
        </div>
      </div>
    </header>
  );
}
