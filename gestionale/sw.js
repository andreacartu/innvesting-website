// Service worker: rende il gestionale utilizzabile anche senza connessione.
// File dell'app: prima la rete (così gli aggiornamenti arrivano subito), la copia salvata se si è offline.
// Font e altre risorse esterne: prima la copia salvata.

const CACHE = 'innvesting-gestionale-v12';

// Solo file statici (font e libreria): mai dati degli immobili.
const STATIC_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net'];

const SHELL = [
  'index.html',
  'manifest.json',
  'css/app.css',
  'js/app.js',
  'js/actions.js',
  'js/calc.js',
  'js/components.js',
  'js/demo.js',
  'js/dom.js',
  'js/editors.js',
  'js/format.js',
  'js/icons.js',
  'js/photos.js',
  'js/cloud.js',
  'js/sync.js',
  'js/cost-zones.js',
  'js/xlsx-reader.js',
  'js/excel-import.js',
  'js/cloud-config.js',
  'js/supabase-client.js',
  'js/snapshot.js',
  'js/summary.js',
  'js/timeline.js',
  'js/ui-parts.js',
  'js/views/updates.js',
  'js/portal/portal.js',
  'js/portal/views.js',
  'investitore.html',
  'manifest-investitore.json',
  'js/lock.js',
  'js/labels.js',
  'js/sheet.js',
  'js/store.js',
  'js/ui-state.js',
  'js/views/costs.js',
  'js/views/dashboard.js',
  'js/views/payments.js',
  'js/views/properties.js',
  'js/views/settings.js',
  'js/views/gate.js',
  'js/views/suppliers.js',
  'images/icon-192.png',
  'images/apple-touch-icon.png',
  '../images/logo-innvesting.png',
  '../images/logo-innvesting-white.png',
  '../images/n-dot.svg',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(request));
  } else if (STATIC_HOSTS.includes(url.hostname)) {
    event.respondWith(cacheFirst(request));
  }
  // Tutto il resto (in particolare le chiamate a Supabase, con i dati e le foto degli immobili) passa dalla rete e non si salva mai.
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    // "no-cache": chiede sempre al server se il file è cambiato, invece di fidarsi della copia tenuta per qualche minuto dal browser.
    const response = await fetch(request, { cache: 'no-cache' });
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    // Aprendo la cartella (".../gestionale/") offline, la pagina salvata è index.html.
    const page = request.mode === 'navigate' ? await cache.match('index.html') : null;
    return page ?? Response.error();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
  return response;
}
