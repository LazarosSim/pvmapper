import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  const openedAt = Date.now();
  navigator.serviceWorker
    .register('/sw.js')
    .then((registration) => {
      // A phone can keep the app open for days: look for a new version when it comes back
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') registration.update().catch(() => undefined);
      });
    })
    .catch((err) => console.error('[App] Service worker registration failed:', err));

  // A new version was published and has taken over: switch to it. Right after opening the
  // app, or away from the scan screen, that happens at once; while scanning, the worker
  // chooses when (everything scanned is already on the phone).
  const hadVersion = !!navigator.serviceWorker.controller;
  let switching = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadVersion || switching) return;
    switching = true;
    const scanning = window.location.pathname.startsWith('/scan/row/');
    if (!scanning || Date.now() - openedAt < 15_000) {
      window.location.reload();
      return;
    }
    import('sonner').then(({ toast }) =>
      toast('A new version of the app is ready', {
        duration: Infinity,
        action: { label: 'Update', onClick: () => window.location.reload() },
      })
    );
  });

  // Caches created by the previous hand-written service worker. They held
  // Supabase API responses (other users' data on shared phones) and are no
  // longer read by anything.
  if ('caches' in window) {
    for (const name of ['supabase-get-cache', 'app-shell', 'external-scripts']) {
      caches.delete(name).catch(() => undefined);
    }
  }
}

createRoot(document.getElementById("root")!).render(<App />);
