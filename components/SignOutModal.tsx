import React from 'react';
import { LogoutIcon } from './Icons';
import { X } from 'lucide-react';

interface SignOutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  isSigningOut?: boolean;
}

export default function SignOutModal({
  isOpen,
  onClose,
  onConfirm,
  isSigningOut = false,
}: SignOutModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="card w-full max-w-sm border border-[var(--line)] shadow-2xl animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="signout-modal-title"
      >
        <div className="flex items-center justify-between pb-3 border-b border-[var(--line)]">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <LogoutIcon size={18} />
            </div>
            <h3 id="signout-modal-title" className="font-[var(--font-display)] text-lg font-bold">
              Confirm Sign Out
            </h3>
          </div>
          <button
            onClick={onClose}
            disabled={isSigningOut}
            className="btn-ghost p-1.5"
            aria-label="Close dialog"
          >
            <X size={16} />
          </button>
        </div>

        <div className="py-4">
          <p className="text-base font-semibold text-[var(--text)]">
            Are you sure you want to sign out?
          </p>
          <p className="mt-1.5 text-xs text-[var(--text-muted)] leading-relaxed">
            Your personal finance records are safely encrypted in the cloud. You can sign back in at any time with your Google account.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--line)]">
          <button
            type="button"
            onClick={onClose}
            disabled={isSigningOut}
            className="btn-ghost px-4 py-2 text-xs font-semibold"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSigningOut}
            className="inline-flex items-center gap-2 rounded-full bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-rose-900/20 hover:bg-rose-700 disabled:opacity-50 transition"
          >
            <LogoutIcon size={14} />
            {isSigningOut ? 'Signing out...' : 'Confirm Sign Out'}
          </button>
        </div>
      </div>
    </div>
  );
}
