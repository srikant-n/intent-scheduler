import { ReactNode } from 'react';

/** Dashed-border placeholder for empty lists/views. */
export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border-strong bg-surface-low/50 px-6 py-12 text-center">
      {icon && <div className="mb-3 text-text-subtle">{icon}</div>}
      <h3 className="text-base font-bold text-text">{title}</h3>
      {description && <p className="mt-1 max-w-md text-sm text-text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
