import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { initOfflineDB } from './lib/offline/offline-queue'

// Initialize offline database on app start
initOfflineDB()
  .then(() => console.log('[App] Offline database ready'))
  .catch((err) => console.error('[App] Failed to initialize offline DB:', err));

createRoot(document.getElementById("root")!).render(<App />);
