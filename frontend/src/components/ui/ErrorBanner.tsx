import { AlertCircle } from 'lucide-react';
import clsx from 'clsx';

interface ErrorBannerProps {
  message: string;
  className?: string;
}

/** Red banner + icon used by every form and result panel for server errors. */
export function ErrorBanner({ message, className }: ErrorBannerProps) {
  return (
    <div
      className={clsx(
        'p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm rounded-lg flex items-start gap-2',
        className,
      )}
      role="alert"
    >
      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
