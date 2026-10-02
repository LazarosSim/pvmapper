import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { initOfflineDB, resetStuckMutations } from './lib/offline/offline-queue'

// Initialize offline database on app start. Mutations left in "syncing" by an
// interrupted sync are put back to "pending" so they are uploaded again.
initOfflineDB()
  .then(() => resetStuckMutations())
  .then((count) => {
    if (count > 0) console.log(`[App] Recovered ${count} interrupted sync item(s)`);
  })
  .catch((err) => console.error('[App] Failed to initialize offline DB:', err));

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker
    .register('/sw.js')
    .catch((err) => console.error('[App] Service worker registration failed:', err));

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
