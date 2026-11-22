import { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import clsx from 'clsx';

const controlClass =
  'w-full rounded-lg border border-border bg-surface-low px-3 py-2 text-sm text-text placeholder:text-text-subtle outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft';

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-text-subtle">{hint}</span>}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={clsx(controlClass, props.className)} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={clsx(controlClass, props.className)} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={clsx(controlClass, 'min-h-20 resize-y', props.className)} />;
}
