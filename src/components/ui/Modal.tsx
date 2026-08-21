import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { classNames } from '@/utils/format';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
  footer?: ReactNode;
}

export function Modal({ open, onClose, title, children, className, footer }: ModalProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-ink-950/50 animate-fade-in" onClick={onClose} />
      <div
        className={classNames(
          'relative z-10 w-full max-w-lg rounded-t-2xl bg-white p-5 shadow-card-hover animate-slide-up sm:rounded-2xl',
          'max-h-[90vh] overflow-y-auto',
          className,
        )}
      >
        {title && (
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-ink-900">{title}</h2>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-900"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
        {children}
        {footer && <div className="mt-5 flex gap-3">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  danger = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} className="max-w-sm">
      <h2 className="text-lg font-bold text-ink-900">{title}</h2>
      <p className="mt-2 text-sm text-ink-600">{message}</p>
      <div className="mt-5 flex gap-3">
        <button
          onClick={onClose}
          className="flex-1 rounded-xl border border-ink-300 bg-white py-2.5 text-sm font-semibold text-ink-800 transition-colors hover:bg-ink-50"
        >
          Cancel
        </button>
        <button
          onClick={() => {
            onConfirm();
            onClose();
          }}
          className={classNames(
            'flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition-colors',
            danger ? 'bg-error-600 hover:bg-error-700' : 'bg-primary-600 hover:bg-primary-700',
          )}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
