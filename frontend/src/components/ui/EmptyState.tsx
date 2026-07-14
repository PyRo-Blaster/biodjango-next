import type { ComponentType } from 'react';
import clsx from 'clsx';

interface EmptyStateProps {
  icon?: ComponentType<{ className?: string }>;
  message: string;
  className?: string;
}

/** Dashed-border placeholder used across the analysis pages. */
export function EmptyState({ icon: Icon, message, className }: EmptyStateProps) {
  return (
    <div
      className={clsx(
        'h-full min-h-[200px] flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50/50 dark:bg-slate-800/30 p-12',
        className,
      )}
    >
      {Icon && <Icon className="w-16 h-16 mb-4 opacity-20" />}
      <p>{message}</p>
    </div>
  );
}
