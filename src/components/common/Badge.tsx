import clsx from 'clsx';
import type { Category } from '@/types/database';

/** Pill showing a category's name in its color; renders nothing when category is null. */
export function CategoryBadge({ category, className }: { category?: Category | null; className?: string }) {
  if (!category) return null;
  return (
    <span
      className={clsx('inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-bold', className)}
      style={{
        color: category.colorHex,
        borderColor: `${category.colorHex}55`,
        backgroundColor: `${category.colorHex}1f`,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: category.colorHex }} />
      {category.name}
    </span>
  );
}
