// v2.0.0-launcher
const SW_VERSION = 'v2.0.0-launcher';
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
        const path = url.pathname.split('/').pop();

        if (path === 'sw.js') {
            return fetch(e.request);
        }

        // 1. GAME ROUTE
        if (path === 'virtual-game.html') {
            try {
                const keys = await localforage.keys();
                // Ensure we find the main entry html
                const htmlKey = keys.find(k => k === 'terraria.html') || keys.find(k => k === 'index.html') || keys.find(k => k.endsWith('.html'));
                
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
                return new Response("<h2 style='color:white; font-family:sans-serif; text-align:center; margin-top:50px;'>Game HTML not found. Please click 'Exit Game' and re-extract the ZIP.</h2>", { status: 404, headers: {'Content-Type': 'text/html'} });
            } catch(err) {
                return new Response("Error reading storage database.", { status: 500 });
            }
        }

        // 2. ASSET INTERCEPTOR (Blazor/Dotnet Ready)
        if (path && path !== 'index.html' && path !== '') {
            try {
                const fileData = await localforage.getItem(path);
                if (fileData) {
                    const ext = path.split('.').pop().toLowerCase();
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
