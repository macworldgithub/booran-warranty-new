'use client';

import { useEffect } from 'react';

export function PwaRegister() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      // Register service worker after window load for optimal page load speed
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((reg) => {
            console.log('Booran Warranty Service Worker registered:', reg.scope);
          })
          .catch((err) => {
            console.warn('Booran Warranty Service Worker registration failed:', err);
          });
      });
    }
  }, []);

  return null;
}

