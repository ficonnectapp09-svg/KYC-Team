import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBannerProps {
  message: string | null;
  onRetry?: () => void;
}

/**
 * Shared error banner so API failures never silently degrade into empty or zero-filled business UI.
 */
export const ErrorBanner: React.FC<ErrorBannerProps> = ({ message, onRetry }) => {
  if (!message) return null;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-200">
      <div className="flex items-center gap-2.5 font-semibold">
        <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
        <span>{message}</span>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold transition-colors shrink-0 self-start sm:self-auto"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Retry</span>
        </button>
      )}
    </div>
  );
};

