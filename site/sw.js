// Service worker de RenovitIA. Hace dos cosas y nada mas:
// 1) que la app se pueda instalar en Android (Chrome lo exige),
// 2) que si el paciente abre el icono sin senal, vea la pantalla y un aviso,
//    en lugar del dinosaurio del navegador.
// NUNCA cachea datos del paciente: todo lo que sale de Supabase va a la red.
const CACHE = 'renovitia-v1';
const SHELL = [
  './',
  './index.html',
  './instalar.html',
  './hoy.html',
  './offline.html',
  './manifest.webmanifest',
  './favicon.svg',
  './assets/css/styles.css',
  './assets/brand/logo-header.svg',
  './assets/brand/icon-192.png',
  './assets/brand/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Datos del paciente: siempre de la red, nunca del cache.
  if (url.origin !== location.origin || /supabase|\/rest\/|\/auth\/|\/functions\//.test(url.href)) return;

  // Navegacion: red primero, y si no hay senal, la pantalla de sin conexion.
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('./offline.html').then((r) => r || caches.match('./index.html'))));
    return;
  }

  // Archivos de la app: cache primero, y se refresca en segundo plano.
  e.respondWith(caches.match(req).then((hit) => {
    const red = fetch(req).then((res) => {
      if (res && res.ok) { const copia = res.clone(); caches.open(CACHE).then((c) => c.put(req, copia)); }
      return res;
    }).catch(() => hit);
    return hit || red;
  }));
});
