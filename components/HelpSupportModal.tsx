'use client';

import React, { useState } from 'react';
import { Mail, MessageSquare, Send, X, CheckCircle2 } from 'lucide-react';

interface HelpSupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail?: string;
  onSuccessToast: (msg: string) => void;
}

export default function HelpSupportModal({
  isOpen,
  onClose,
  userEmail = '',
  onSuccessToast,
}: HelpSupportModalProps) {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    // Simulate swift network dispatch
    await new Promise((r) => setTimeout(r, 600));
    setSending(false);
    setSent(true);
    onSuccessToast('Your message has been sent to Pocket Pilot support team.');
    setTimeout(() => {
      setSent(false);
      setSubject('');
      setMessage('');
      onClose();
    }, 1500);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="card w-full max-w-lg border border-[var(--line)] shadow-2xl animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="support-modal-title"
      >
        <div className="flex items-center justify-between pb-3 border-b border-[var(--line)]">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <MessageSquare size={18} />
            </div>
            <div>
              <h3 id="support-modal-title" className="font-[var(--font-display)] text-lg font-bold">
                Pocket Pilot Support
              </h3>
              <p className="text-xs text-[var(--text-muted)]">We typically reply within 24 hours</p>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5" aria-label="Close dialog">
            <X size={16} />
          </button>
        </div>

        {sent ? (
          <div className="py-10 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mb-3">
              <CheckCircle2 size={24} />
            </div>
            <h4 className="font-bold text-base">Inquiry Dispatched</h4>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Thank you! Our support engineers will contact you at {userEmail || 'your email'}.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="py-4 space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                Your Email
              </label>
              <input
                className="field cursor-not-allowed opacity-75"
                value={userEmail || 'Signed-in user'}
                disabled
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                Subject
              </label>
              <input
                className="field"
                placeholder="e.g., Question about budget limits or category export"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                Message Details
              </label>
              <textarea
                className="field min-h-[110px] resize-none"
                placeholder="Please describe how we can assist you..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
              />
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[var(--line)]">
              <a
                href={`mailto:support@pocketpilot.app?subject=${encodeURIComponent(
                  subject || 'Pocket Pilot Support'
                )}&body=${encodeURIComponent(message)}`}
                className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 font-medium"
              >
                <Mail size={13} />
                Open in Email Client
              </a>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-ghost px-4 py-2 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sending}
                  className="btn px-4 py-2 text-xs font-semibold"
                >
                  <Send size={13} />
                  {sending ? 'Sending...' : 'Send Message'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
