import type { InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes, ReactNode } from 'react';
import { classNames } from '@/utils/format';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export function Input({ label, error, hint, className, id, ...props }: InputProps) {
  const inputId = id ?? props.name;
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-semibold text-ink-800">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={classNames(
          'h-11 w-full rounded-xl border bg-white px-3.5 text-sm text-ink-900 transition-colors',
          'placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500',
          error ? 'border-error-400' : 'border-ink-300',
          className,
        )}
        {...props}
      />
      {error && <p className="text-xs font-medium text-error-600">{error}</p>}
      {hint && !error && <p className="text-xs text-ink-500">{hint}</p>}
    </div>
  );
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({ label, error, className, id, ...props }: TextareaProps) {
  const inputId = id ?? props.name;
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-semibold text-ink-800">
          {label}
        </label>
      )}
      <textarea
        id={inputId}
        className={classNames(
          'w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-ink-900 transition-colors',
          'placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500',
          error ? 'border-error-400' : 'border-ink-300',
          className,
        )}
        {...props}
      />
      {error && <p className="text-xs font-medium text-error-600">{error}</p>}
    </div>
  );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  children: ReactNode;
}

export function Select({ label, error, className, id, children, ...props }: SelectProps) {
  const inputId = id ?? props.name;
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-semibold text-ink-800">
          {label}
        </label>
      )}
      <select
        id={inputId}
        className={classNames(
          'h-11 w-full rounded-xl border bg-white px-3.5 text-sm text-ink-900 transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500',
          error ? 'border-error-400' : 'border-ink-300',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-xs font-medium text-error-600">{error}</p>}
    </div>
  );
}
