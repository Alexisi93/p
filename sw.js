// v3.0.0-pathfix
const SW_VERSION = 'v3.0.0-pathfix';
importScripts('https://cdnjs.cloudflare.com/ajax/libs/localforage/1.10.0/localforage.min.js');

self.addEventListener('install', e => {
    self.skipWaiting();
});

self.addEventListener('activate', e => {
    e.waitUntil(self.clients.claim());
});

self.addEventListener('message', event => {
    if (event.data && event.data.type === 'CHECK_VERSION') {
        event.ports[0].postMessage({ version: SW_VERSION });
    }
});

self.addEventListener('fetch', e => {
    if (e.request.method !== 'GET') return;
    const url = new URL(e.request.url);
    if (!url.protocol.startsWith('http')) return;

    e.respondWith((async () => {
        // Use the FULL path instead of just the filename
        const requestPath = decodeURIComponent(url.pathname);

        // Bypass for the service worker itself
        if (requestPath.endsWith('sw.js')) {
            return fetch(e.request);
        }

        const keys = await localforage.keys();
        // Sort keys by length descending to match deep paths first (e.g. _framework/dotnet.wasm before dotnet.wasm)
        keys.sort((a, b) => b.length - a.length);

        // 1. VIRTUAL GAME ROUTE
        if (requestPath.endsWith('virtual-game.html')) {
            try {
                const htmlKey = keys.find(k => k === 'index.html' || k === 'terraria.html' || (!k.includes('/') && k.endsWith('.html')));
                if (htmlKey) {
                    const fileData = await localforage.getItem(htmlKey);
                    return new Response(fileData, {
                        headers: {
                            'Content-Type': 'text/html',
                            'Cross-Origin-Embedder-Policy': 'require-corp',
                            'Cross-Origin-Opener-Policy': 'same-origin',
                            'Cache-Control': 'no-cache, no-store, must-revalidate'
                        }
                    });
                }
                return new Response("<h2>Game HTML not found. Please extract the ZIP again.</h2>", { status: 404, headers: {'Content-Type': 'text/html'} });
            } catch(err) {
                return new Response("Error reading storage database.", { status: 500 });
            }
        }

        // 2. DEEP PATH ASSET INTERCEPTOR
        // Checks if the request URL ends with the exact folder path stored in the database
        const matchedKey = keys.find(k => requestPath.endsWith('/' + k) || requestPath === '/' + k || requestPath === k);

        if (matchedKey) {
            try {
                const fileData = await localforage.getItem(matchedKey);
                if (fileData) {
                    const ext = matchedKey.split('.').pop().toLowerCase();
                    const mimeTypes = { 
                        'html': 'text/html', 
                        'js': 'application/javascript', 
                        'mjs': 'application/javascript', 
                        'json': 'application/json',
                        'wasm': 'application/wasm', 
                        'tar': 'application/x-tar',
                        'zip': 'application/zip',
                        'png': 'image/png', 
                        'jpg': 'image/jpeg',
                        'css': 'text/css',
                        'txt': 'text/plain',
                        'dll': 'application/octet-stream',
                        'dat': 'application/octet-stream',
                        'blat': 'application/octet-stream',
                        'br': 'application/brotli',
                        'gz': 'application/gzip',
                        'data': 'application/octet-stream' 
                    };
                    return new Response(fileData, {
                        headers: {
                            'Content-Type': mimeTypes[ext] || 'application/octet-stream',
                            'Cross-Origin-Embedder-Policy': 'require-corp',
                            'Cross-Origin-Opener-Policy': 'same-origin',
                            'Cache-Control': 'public, max-age=3600'
                        }
                    });
                }
            } catch(err) { 
                console.error('IDB Read Error:', err); 
            }
        }

        // 3. NETWORK FALLBACK
        try {
            const res = await fetch(e.request);
            if (res.status === 0) return res; 
            
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
