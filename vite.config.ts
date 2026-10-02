/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// Lovable's editor script stays in index.html so the Lovable preview keeps working,
// but production builds must not load a third-party script that can read the session.
const stripLovableEditorScript = (): Plugin => ({
  name: "strip-lovable-editor-script",
  transformIndexHtml: (html) =>
    html.replace(/\s*<script[^>]*cdn\.gpteng\.co[^>]*><\/script>/g, ""),
});

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    // Shown in Settings, to tell which version a phone is running
    __APP_VERSION__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ')),
  },
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
    mode === 'production' && stripLovableEditorScript(),
    VitePWA({
      // Same URL as the old hand-written worker, so installed apps update in place.
      filename: "sw.js",
      // Registered manually in main.tsx.
      injectRegister: false,
      // public/manifest.json is kept as is.
      manifest: false,
      workbox: {
        // Only the app itself is cached. Supabase data is never cached here:
        // offline data lives in the app's own IndexedDB store.
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2,wav,mp3}"],
        navigateFallback: "/index.html",
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts",
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
}));
