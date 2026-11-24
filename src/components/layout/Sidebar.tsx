import { BarChart3, CalendarDays, CalendarRange, Database, ListTodo, Plus, Zap } from 'lucide-react';
import clsx from 'clsx';
import { useTheme } from '@/hooks/useTheme';
import type { AccentPreset, ThemeMode } from '@/types/database';

/** The five top-level views; `enabled` supports phased rollouts (all enabled today). */
export type ViewKey = 'daily' | 'weekly' | 'intentions' | 'analytics' | 'vault';

const navItems: { key: ViewKey; label: string; icon: typeof CalendarDays; enabled: boolean }[] = [
  { key: 'daily', label: 'Dual-Track Today', icon: CalendarDays, enabled: true },
  { key: 'weekly', label: 'Weekly Planner', icon: CalendarRange, enabled: true },
  { key: 'intentions', label: 'Intentions', icon: ListTodo, enabled: true },
  { key: 'analytics', label: 'Time Analytics', icon: BarChart3, enabled: true },
  { key: 'vault', label: 'Data Vault', icon: Database, enabled: true },
];

const accents: { key: AccentPreset; label: string; color: string }[] = [
  { key: 'ember', label: 'Ember', color: '#ea580c' },
  { key: 'indigo', label: 'Indigo', color: '#4f46e5' },
  { key: 'emerald', label: 'Emerald', color: '#059669' },
  { key: 'rose', label: 'Rose', color: '#e11d48' },
  { key: 'violet', label: 'Violet', color: '#7c3aed' },
  { key: 'graphite', label: 'Graphite', color: '#4b5563' },
];

const themes: { key: ThemeMode; label: string }[] = [
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
  { key: 'system', label: 'Auto' },
];

interface SidebarProps {
  view: ViewKey;
  onChange: (view: ViewKey) => void;
  intentionsCount: number;
  onQuickLog: () => void;
}

/** Left rail: view switcher, Quick Log button, theme/accent pickers. */
export function Sidebar({ view, onChange, intentionsCount, onQuickLog }: SidebarProps) {
  const { themeMode, accent, setThemeMode, setAccent } = useTheme();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-border bg-surface-low/80 backdrop-blur-xl">
      <div className="flex h-14 items-center gap-3 border-b border-border px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-contrast">
          <Zap size={17} />
        </div>
        <div>
          <div className="text-sm font-bold text-text">Intent Scheduler</div>
          <div className="text-[11px] text-text-subtle">Intent vs Reality</div>
        </div>
      </div>

      <div className="p-3">
        <button
          onClick={onQuickLog}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-3 py-2.5 text-sm font-bold text-accent-contrast shadow-sm transition hover:bg-accent-strong"
        >
          <Plus size={16} /> Quick Log
        </button>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        <div className="px-2 pb-2 text-[11px] font-bold uppercase tracking-wider text-text-subtle">Views</div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = view === item.key;
          return (
            <button
              key={item.key}
              disabled={!item.enabled}
              onClick={() => item.enabled && onChange(item.key)}
              className={clsx(
                'flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold transition',
                active ? 'bg-accent-soft text-accent' : 'text-text-muted hover:bg-surface-high hover:text-text',
                !item.enabled && 'cursor-not-allowed opacity-45',
              )}
            >
              <span className="flex items-center gap-2.5">
                <Icon size={17} /> {item.label}
              </span>
              {item.key === 'intentions' && (
                <span className="rounded-full bg-surface-high px-2 py-0.5 text-[11px] text-text-muted">{intentionsCount}</span>
              )}
              {!item.enabled && <span className="text-[10px] uppercase">Soon</span>}
            </button>
          );
        })}
      </nav>

      <div className="space-y-3 border-t border-border p-4">
        <div>
          <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-text-subtle">Theme</div>
          <div className="grid grid-cols-3 rounded-lg border border-border bg-surface p-1">
            {themes.map((theme) => (
              <button
                key={theme.key}
                onClick={() => setThemeMode(theme.key)}
                className={clsx(
                  'rounded-md px-2 py-1 text-[11px] font-semibold transition',
                  themeMode === theme.key ? 'bg-accent-soft text-accent' : 'text-text-muted hover:text-text',
                )}
              >
                {theme.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-text-subtle">Accent</div>
          <div className="flex gap-2">
            {accents.map((item) => (
              <button
                key={item.key}
                title={item.label}
                onClick={() => setAccent(item.key)}
                className={clsx('h-6 w-6 rounded-full border-2 transition', accent === item.key ? 'border-text' : 'border-transparent')}
                style={{ backgroundColor: item.color }}
              />
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-surface px-3 py-2 text-[11px] text-text-muted">
          Local SQLite • offline-first
        </div>
      </div>
    </aside>
  );
}
