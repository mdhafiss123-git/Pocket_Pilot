'use client';

import { useEffect } from 'react';

/** Registers the offline service worker on page load for full PWA installability */
export default function PWARegister() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      const handleLoad = () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            console.log('Pocket Pilot PWA ServiceWorker registered:', registration.scope);
          })
          .catch((err) => {
            console.warn('Pocket Pilot PWA ServiceWorker registration failed:', err);
          });
      };

      if (document.readyState === 'complete') {
        handleLoad();
      } else {
        window.addEventListener('load', handleLoad);
        return () => window.removeEventListener('load', handleLoad);
      }
    }
  }, []);

  return null;
}
