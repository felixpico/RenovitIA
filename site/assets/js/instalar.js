// Pantalla de instalacion. En Android Chrome ofrece el boton nativo; en iPhone
// no existe ese boton y hay que decirle al paciente los pasos de Safari.
const $ = (id) => document.getElementById(id);

const esIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const instalada = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

function mostrar(cual) {
  ['android', 'ios'].forEach((p) => {
    $(`p-${p}`).classList.toggle('hidden', p !== cual);
    $(`tab-${p}`).setAttribute('aria-selected', p === cual ? 'true' : 'false');
  });
}
$('tab-android').addEventListener('click', () => mostrar('android'));
$('tab-ios').addEventListener('click', () => mostrar('ios'));
mostrar(esIOS() ? 'ios' : 'android');

if (instalada()) $('box-instalada').classList.remove('hidden');

// Chrome guarda el evento y nos deja disparar el instalador cuando queramos.
let promesa = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  promesa = e;
  $('btn-instalar').classList.remove('hidden');
});
$('btn-instalar').addEventListener('click', async () => {
  if (!promesa) return;
  promesa.prompt();
  const { outcome } = await promesa.userChoice;
  promesa = null;
  $('btn-instalar').classList.add('hidden');
  if (outcome === 'accepted') $('box-instalada').classList.remove('hidden');
});
window.addEventListener('appinstalled', () => {
  $('btn-instalar').classList.add('hidden');
  $('box-instalada').classList.remove('hidden');
});

// QR generado en el propio telefono. La liga no sale a ningun servicio: se usa
// la misma CDN de la que ya carga supabase-js, no un generador de QR en linea.
const url = location.href.replace(/[^/]*$/, 'instalar.html');
$('url-texto').textContent = url;
$('qr').innerHTML = '<p class="muted small">Generando el código…</p>';
import('https://cdn.jsdelivr.net/npm/qrcode@1.5.4/+esm')
  .then((QR) => QR.toString(url, { type: 'svg', margin: 1, width: 188, color: { dark: '#1c2521', light: '#ffffff' } }))
  .then((svg) => { $('qr').innerHTML = svg; $('qr').firstElementChild?.classList.add('qr'); })
  .catch(() => { $('qr').innerHTML = '<p class="muted small">No se pudo generar el código. Comparte la liga de abajo.</p>'; });

$('url-texto').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(url); $('url-texto').textContent = 'Liga copiada'; setTimeout(() => { $('url-texto').textContent = url; }, 1600); }
  catch { /* sin portapapeles, el paciente la selecciona a mano */ }
});

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
