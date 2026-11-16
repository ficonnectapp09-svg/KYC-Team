import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl' | '6xl';
  fullScreen?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 'lg',
  fullScreen = false
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidthStyles = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '4xl': 'max-w-4xl',
    '6xl': 'max-w-6xl'
  };

  return (
    <div
      className={
        fullScreen
          ? 'fixed inset-0 z-50 flex items-stretch justify-stretch p-0 m-0 overflow-hidden bg-slate-950'
          : 'fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto'
      }
    >
      {/* Backdrop */}
      {!fullScreen && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Modal Dialog */}
      <div
        className={
          fullScreen
            ? 'relative w-screen h-screen max-w-none max-h-none rounded-none bg-slate-50 dark:bg-slate-950 border-0 shadow-2xl transition-all my-0 flex flex-col overflow-hidden text-slate-900 dark:text-slate-100'
            : `relative w-full ${maxWidthStyles[maxWidth]} rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl transition-all my-8 max-h-[90vh] flex flex-col`
        }
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between border-b ${
            fullScreen
              ? 'border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur px-6 py-3.5 shrink-0 shadow-sm'
              : 'border-slate-100 dark:border-slate-800 px-6 py-4'
          }`}
        >
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              {title}
            </h3>
            {subtitle && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className={`px-6 py-5 overflow-y-auto flex-1 ${fullScreen ? 'p-6 bg-slate-50 dark:bg-slate-950' : ''}`}>
          {children}
        </div>
      </div>
    </div>
  );
};

