'use client';

import { useEffect, useRef, useState } from 'react';
import { Wifi, WifiOff } from 'lucide-react';

type ConnectionState = 'online' | 'offline' | 'restored';

/** Shows a banner when the browser goes offline and confirms when the connection returns. */
export default function OfflineIndicator() {
  const [state, setState] = useState<ConnectionState>('online');
  const [mounted, setMounted] = useState(false);
  const restoreTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMounted(true);

    const clearRestoreTimer = () => {
      if (restoreTimer.current) {
        clearTimeout(restoreTimer.current);
        restoreTimer.current = null;
      }
    };

    const handleOffline = () => {
      clearRestoreTimer();
      setState('offline');
    };

    const handleOnline = () => {
      clearRestoreTimer();
      setState('restored');
      restoreTimer.current = setTimeout(() => setState('online'), 3500);
    };

    if (!navigator.onLine) {
      setState('offline');
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearRestoreTimer();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!mounted || state === 'online') return null;

  const offline = state === 'offline';

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex justify-center px-3 pt-[max(0.75rem,env(safe-area-inset-top))]"
    >
      <div
        className={`pointer-events-auto flex items-center gap-2.5 rounded-full border px-4 py-2 text-xs font-medium shadow-lg backdrop-blur-xl ${
          offline
            ? 'border-amber-300/80 bg-amber-50/95 text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/90 dark:text-amber-100'
            : 'border-emerald-300/80 bg-emerald-50/95 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-950/90 dark:text-emerald-100'
        }`}
      >
        {offline ? (
          <WifiOff size={15} strokeWidth={1.9} className="shrink-0" />
        ) : (
          <Wifi size={15} strokeWidth={1.9} className="shrink-0" />
        )}
        <span>{offline ? "You're offline — showing saved data" : 'Back online'}</span>
      </div>
    </div>
  );
}
