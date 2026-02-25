importScripts('https://cdnjs.cloudflare.com/ajax/libs/localforage/1.10.0/localforage.min.js');
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', e => {
    if (e.request.method !== 'GET') return;

    e.respondWith((async () => {
        const url = new URL(e.request.url);
        const path = url.pathname.split('/').pop();

        // 1. Check Local Database for Game Files FIRST
        if (path && path !== 'sw.js' && path !== 'index.html' && path !== '') {
            try {
                const fileData = await localforage.getItem(path);
                if (fileData) {
                    const ext = path.split('.').pop().toLowerCase();
                    const mimeTypes = { 'html':'text/html', 'js':'application/javascript', 'wasm':'application/wasm', 'data':'application/octet-stream', 'png':'image/png', 'css':'text/css' };
                    return new Response(fileData, {
                        headers: {
                            'Content-Type': mimeTypes[ext] || 'application/octet-stream',
                            'Cross-Origin-Embedder-Policy': 'require-corp',
                            'Cross-Origin-Opener-Policy': 'same-origin'
                        }
                    });
                }
            } catch(err) { console.error('IDB Read Error:', err); }
        }

        // 2. Fetch from Network and Apply Headers universally
        try {
            const res = await fetch(e.request);
            if (res.status === 0) return res; // Handle opaque responses
            
            const headers = new Headers(res.headers);
            headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
            headers.set('Cross-Origin-Opener-Policy', 'same-origin');
            
            return new Response(res.body, { 
                status: res.status, 
                statusText: res.statusText,
                headers: headers 
            });
        } catch(err) { 
            return fetch(e.request); 
        }
    })());
});
