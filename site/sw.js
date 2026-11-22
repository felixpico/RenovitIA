// Service worker de RenovitIA. Hace dos cosas y nada mas:
// 1) que la app se pueda instalar en Android (Chrome lo exige),
// 2) que si el paciente abre el icono sin senal, vea la pantalla y un aviso,
//    en lugar del dinosaurio del navegador.
// NUNCA cachea datos del paciente: todo lo que sale de Supabase va a la red.
const CACHE = 'renovitia-v46';
const SHELL = [
  './',
  './index.html',
  './instalar.html',
  './hoy.html',
  './acceso.html',
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

// Una respuesta marcada como redirigida no se puede devolver a una navegacion:
// el navegador la rechaza con un error de red. Se reconstruye igual, sin la marca.
async function sinRedireccion(res) {
  if (!res) return null;
  if (!res.redirected) return res;
  return new Response(await res.blob(), { status: res.status, statusText: res.statusText, headers: res.headers });
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Datos del paciente: siempre de la red, nunca del cache.
  if (url.origin !== location.origin || /supabase|\/rest\/|\/auth\/|\/functions\//.test(url.href)) return;

  // Navegacion: red primero, y si no hay senal, la pantalla de sin conexion.
  //
  // El servidor sirve /x.html como redireccion a /x, asi que casi todo lo que
  // quedo guardado trae la marca de "respuesta redirigida" y bajo una clave que
  // ya no coincide con la direccion que pide el navegador. Hay que resolver las
  // dos cosas o el paciente sin senal ve el error del navegador en vez de la
  // pantalla de sin conexion, que es justo lo que este archivo existe para evitar.
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(async () => {
      const c = await caches.open(CACHE);
      const ruta = url.pathname;
      // Primero la pantalla de sin conexion, no la del plan: sin red la app no
      // puede leer nada de Supabase, asi que servir su cascaron deja al paciente
      // viendo una pantalla en blanco sin saber por que.
      const guardado = (await c.match('./offline.html'))
        || (await c.match(req))
        || (ruta.endsWith('.html') ? null : await c.match(ruta + '.html'))
        || (await c.match('./index.html'));
      return (await sinRedireccion(guardado)) || Response.error();
    }));
    return;
  }

  // CODIGO de la app: red primero, cache solo como red de emergencia.
  //
  // Antes era al reves —cache primero y refresco en segundo plano— y eso hacia
  // que un despliegue nuevo se viera hasta la SEGUNDA carga: la primera servia
  // el archivo de ayer. En el panel medico eso es inaceptable: no tiene ningun
  // uso sin conexion y quien lo abre espera ver lo que se acaba de desplegar.
  const esCodigo = /\.(js|css|html)$/.test(url.pathname) || url.pathname.endsWith('/');
  if (esCodigo) {
    e.respondWith(fetch(req).then((res) => {
      if (res && res.ok) { const copia = res.clone(); caches.open(CACHE).then((c) => c.put(req, copia)); }
      return res;
    }).catch(() => caches.match(req).then((hit) => hit || Response.error())));
    return;
  }

  // Lo demas (iconos, logos, tipografias): cache primero, que no cambia.
  e.respondWith(caches.match(req).then((hit) => {
    const red = fetch(req).then((res) => {
      if (res && res.ok) { const copia = res.clone(); caches.open(CACHE).then((c) => c.put(req, copia)); }
      return res;
    }).catch(() => hit);
    return hit || red;
  }));
});

// ---- Recordatorios ----
// El servidor manda el texto ya armado. El service worker no decide nada:
// si el payload viene vacio o roto, no inventa un aviso generico con el
// nombre de un suplemento, porque seria adivinar sobre un dato clinico.
self.addEventListener('push', (e) => {
  let d = null;
  try { d = e.data ? e.data.json() : null; } catch (_) { d = null; }
  if (!d || !d.titulo) return;
  e.waitUntil(self.registration.showNotification(d.titulo, {
    body: d.cuerpo || '',
    icon: './assets/brand/icon-192.png',
    badge: './assets/brand/icon-192.png',
    tag: d.tag || 'renovitia',
    renotify: false,
    data: { url: d.url || './index.html' },
    actions: [{ action: 'abrir', title: 'Ver mi dia' }],
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const destino = (e.notification.data && e.notification.data.url) || './index.html';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((lista) => {
    for (const c of lista) {
      if (c.url.includes(self.registration.scope) && 'focus' in c) {
        c.navigate(destino).catch(() => {});
        return c.focus();
      }
    }
    return self.clients.openWindow(destino);
  }));
});

// Si el navegador rota la suscripcion, la app la vuelve a registrar
// la proxima vez que el paciente abra la pantalla. Aqui solo se avisa.
self.addEventListener('pushsubscriptionchange', (e) => {
  e.waitUntil(self.clients.matchAll({ includeUncontrolled: true })
    .then((l) => l.forEach((c) => c.postMessage({ tipo: 'push-caducado' }))));
});
