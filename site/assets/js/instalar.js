// Pantalla de instalacion.
//
// Tres caminos distintos, y el paciente solo debe ver el suyo:
//   · Android/Chrome: boton nativo de instalar, cuando el navegador lo ofrece.
//   · iPhone/Safari: no hay boton, hay pasos.
//   · Dentro de WhatsApp o Instagram: no se puede instalar, hay que salir.
// El tercero es el que mas pasa y el que nadie documenta.

import { esIOS, instalada, navegadorIncrustado, navegadorIOS, avisoIncrustado } from './navegador.js';

const $ = (id) => document.getElementById(id);
const url = location.href.replace(/[^/]*$/, 'instalar.html').split('#')[0];

/* ---------- 1. ¿Está dentro de otra app? ---------- */
const incrustado = navegadorIncrustado();
const aviso = avisoIncrustado(url);
if (aviso) $('aviso-navegador').appendChild(aviso);

/* ---------- 2. ¿Ya la tiene? ---------- */
if (instalada()) $('box-instalada').classList.remove('hidden');

/* ---------- 3. Los pasos de su plataforma ---------- */
function mostrar(cual) {
  ['android', 'ios'].forEach((p) => {
    $(`p-${p}`).classList.toggle('hidden', p !== cual);
    $(`tab-${p}`).setAttribute('aria-selected', p === cual ? 'true' : 'false');
  });
}
$('tab-android').addEventListener('click', () => mostrar('android'));
$('tab-ios').addEventListener('click', () => mostrar('ios'));
mostrar(esIOS() ? 'ios' : 'android');

// En iPhone, decirle por su nombre el navegador en el que está parado. "Abre esto
// en Safari" no significa nada para quien cree que ya está en Safari.
if (esIOS() && !incrustado) {
  const cual = navegadorIOS();
  const caja = $('ios-navegador');
  if (caja && cual !== 'Safari') {
    caja.className = 'notice warn small';
    caja.innerHTML = `Estás en <strong>${cual}</strong>. En iPhone el ícono solo queda bien puesto desde <strong>Safari</strong>: copia la liga de abajo y ábrela ahí.`;
  } else if (caja) {
    caja.className = 'notice small';
    caja.innerHTML = 'Estás en <strong>Safari</strong>. Aquí sí se puede: sigue los tres pasos.';
  }
}

/* ---------- 4. El botón nativo, cuando existe ---------- */
let promesa = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  promesa = e;
  $('btn-instalar').classList.remove('hidden');
  $('sin-boton')?.classList.add('hidden');
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

// Chrome dispara beforeinstallprompt en los primeros instantes o no lo dispara.
// Si pasaron dos segundos sin él, es que este navegador no lo ofrece: en vez de
// dejar al paciente esperando un botón que no va a llegar, se le dice.
setTimeout(() => {
  if (promesa || instalada() || incrustado || esIOS()) return;
  const c = $('sin-boton');
  if (c) c.classList.remove('hidden');
}, 2000);

/* ---------- 5. La liga y su código ---------- */
$('url-texto').textContent = url;
$('qr').innerHTML = '<p class="muted small">Generando el código…</p>';
import('https://cdn.jsdelivr.net/npm/qrcode@1.5.4/+esm')
  .then((QR) => QR.toString(url, { type: 'svg', margin: 1, width: 188, color: { dark: '#1c2521', light: '#ffffff' } }))
  .then((svg) => { $('qr').innerHTML = svg; $('qr').firstElementChild?.classList.add('qr'); })
  .catch(() => { $('qr').innerHTML = '<p class="muted small">No se pudo generar el código. Comparte la liga de abajo.</p>'; });

$('btn-copiar').addEventListener('click', async () => {
  const b = $('btn-copiar');
  try {
    await navigator.clipboard.writeText(url);
    b.textContent = 'Liga copiada';
    setTimeout(() => { b.textContent = 'Copiar la liga'; }, 1800);
  } catch {
    $('url-texto').style.userSelect = 'all';
    b.textContent = 'Selecciona la liga de abajo';
  }
});

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
