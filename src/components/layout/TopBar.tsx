import { Search, Zap } from 'lucide-react';
import { formatDateLong, todayISO } from '@/utils/time';

interface TopBarProps {
  date: string;
  onQuickLog: () => void;
}

export function TopBar({ date, onQuickLog }: TopBarProps) {
  const isToday = date === todayISO();
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-canvas px-6">
      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-text-muted md:flex">
          <Search size={15} />
          <span>Search intentions</span>
          <kbd className="rounded border border-border bg-surface-high px-1.5 text-[10px]">Ctrl+K</kbd>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden text-sm text-text-muted sm:block">
          {isToday ? 'Today' : formatDateLong(date)}
        </div>
        <button
          onClick={onQuickLog}
          className="flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-bold text-accent-contrast shadow-sm transition hover:bg-accent-strong"
        >
          <Zap size={15} /> Spontaneous Log
        </button>
      </div>
    </header>
  );
}
