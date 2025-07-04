

importScripts(
    'https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-sw.js'
);


// shorthand
const { precaching, routing, strategies, expiration, backgroundSync } = workbox;
const { registerRoute } = routing;
const { NetworkFirst, StaleWhileRevalidate, CacheFirst } = strategies;
const { ExpirationPlugin } = expiration;
const { BackgroundSyncPlugin } = backgroundSync;

const precacheManifest = [
    { url: '/',        revision: '1' },
    { url: '/login', revision: '1' },
    { url: '/profile',    revision: '1' },
    { url: '/dashboard', revision: '1' },
    { url: '/scan', revision: '1' },
    { url: '/App.css', revision: '1' },
    { url: '/index.css', revision: '1' },
    { url: '/xplogo.png', revision: '1' },
    { url: '/XP-Energy_Logo-White-Horizontal.svg', revision: '1'},
    { url: '/favicon.ico', revision: '1' },
    {url: '/manifest.json', revision: '1'},
    {url: '/icons/scanning.png', revision: '1'},
    {url: '/assets/index-DdgRdGgO.css', revision: '1'},
    {url: '/assets/index-blvhFMFW.js', revision: '1'},
];

workbox.precaching.precacheAndRoute(precacheManifest);

const isSupabase = url => url.hostname.endsWith('.supabase.co');


self.addEventListener('install',  evt => self.skipWaiting());
self.addEventListener('activate', evt => evt.waitUntil(self.clients.claim()));

const queuePlugin = new workbox.backgroundSync.BackgroundSyncPlugin('supabaseQueue', {
    maxRetentionTime: 24 * 60, // retry for up to 24h
    // when the queue finally replays, let the page know:
    onSync: async ({queue}) => {
        let entry;
        while ((entry = await queue.shiftRequest())) {
            try {
                await fetch(entry.request);
            } catch (err) {
                await queue.unshiftRequest(entry);
                return;
            }
        }
        new BroadcastChannel('sw-messages').postMessage({type: 'SUPA_QUEUE_SYNCED'});
    }
});

routing.registerRoute(
    ({ request }) => request.mode === 'navigate',
    new strategies.NetworkFirst({
        cacheName: 'app-shell',
        plugins: [ new expiration.ExpirationPlugin({ maxEntries: 1 }) ],
    })
);

// cache Google Fonts stylesheets
registerRoute(
    /^https:\/\/fonts\.googleapis\.com\/.*/i,
    new workbox.strategies.CacheFirst({
        cacheName: 'google-fonts-stylesheets',
        plugins: [
            new workbox.expiration.ExpirationPlugin({
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
            }),
        ],
    })
);

// cache Google Fonts font-files
registerRoute(
    /^https:\/\/fonts\.gstatic\.com\/.*/i,
    new workbox.strategies.CacheFirst({
        cacheName: 'google-fonts-webfonts',
        plugins: [
            new workbox.expiration.ExpirationPlugin({
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365,
            }),
        ],
    })
);


// cache external GPT engineer script
registerRoute(
    /^https:\/\/cdn\.gpteng\.co\/gptengineer\.js$/i,
    new workbox.strategies.NetworkFirst({
        cacheName: 'external-scripts',
    })
);

// 2) Intercept preflight OPTIONS so the POST can fire
registerRoute(
    ({ request, url }) =>
        request.method === 'OPTIONS' && isSupabase(url),
    ({ request }) => {
        const reqHeaders = request.headers.get('access-control-request-headers') || '';
        return new Response(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'OPTIONS, GET, POST, PUT, DELETE',
                // echo back exactly what was requested
                'Access-Control-Allow-Headers': reqHeaders,
            }
        });
    }
);

// 3) Now intercept the actual POST
registerRoute(
    ({request, url}) =>
        request.method === 'POST' && isSupabase(url),
    async ({event}) => {
        console.log('[SW] intercepted', event.request.method, event.request.url);
        try {
            const res = await fetch(event.request.clone());
            console.log('[SW] network OK', res.status);
            return res;
        } catch (err) {
            console.warn('[SW] offline – queueing POST');
            await queuePlugin.fetchDidFail({
                originalRequest: event.request.clone()
            });
            console.log('[SW] queued, returning fake 201');
            return new Response('{}', {
                status: 201,
                headers: {'Content-Type': 'application/json'}
            });
        }
    },
    'POST'
);

// cache GETs to Supabase REST endpoints
routing.registerRoute(
    ({request, url}) =>
        request.method === 'GET' && isSupabase(url),
    new strategies.NetworkFirst({
        cacheName: 'supabase-get-cache',
        networkTimeoutSeconds: 3,            // fall back to cache if network is slow
        plugins: [
            new expiration.ExpirationPlugin({
                maxEntries: 50,
                maxAgeSeconds: 24 * 60 * 60,    // keep for 1 day
            }),
        ],
    })
);