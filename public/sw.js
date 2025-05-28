// public/sw.js
// bring in Workbox in classic form
importScripts(
    'https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-sw.js'
);


const { routing, strategies, backgroundSync } = workbox;
const { registerRoute } = routing;
const { NetworkOnly }   = strategies;
const { BackgroundSyncPlugin } = backgroundSync;

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