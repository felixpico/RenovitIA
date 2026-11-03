// Canjea la liga que la doctora manda por WhatsApp por una sesion de verdad.
// Un toque y adentro: sin correo, sin codigo, sin contrasena.
import { supabase } from './supabase.js';
import { CONFIG } from './config.js';

const $ = (id) => document.getElementById(id);
const ver = (id) => ['cargando', 'listo', 'falla'].forEach((v) => $(v).classList.toggle('hidden', v !== id));

function falla(texto) {
  $('falla-texto').textContent = texto;
  ver('falla');
}

// La liga se limpia de la barra en cuanto se lee, para que no quede en el
// historial del telefono ni se comparta por accidente en una captura.
const params = new URLSearchParams(location.search);
const token = (params.get('t') || '').trim();
history.replaceState(null, '', location.pathname);

(async () => {
  if (!token) { falla('Esta liga está incompleta. Pide una nueva.'); return; }

  try {
    const r = await fetch(`${CONFIG.SUPABASE_URL}/functions/v1/canjear-acceso`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', apikey: CONFIG.SUPABASE_PUBLISHABLE_KEY },
      body: JSON.stringify({ token }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data.ok) { falla(data.error || 'No se pudo validar la liga.'); return; }

    const { error } = await supabase.auth.verifyOtp({ token_hash: data.token_hash, type: 'magiclink' });
    if (error) { falla(`No se pudo abrir la sesión: ${error.message}`); return; }

    // Enlaza la cuenta con el expediente si todavia no lo estaba.
    try { await supabase.rpc('vincular_mi_cuenta'); } catch { /* no bloquea la entrada */ }

    $('saludo').textContent = data.nombre ? `Hola, ${data.nombre}` : 'Listo';
    ver('listo');
    setTimeout(() => { location.replace('index.html'); }, 900);
  } catch (e) {
    falla(`No hay conexión o el servidor no respondió. ${e.message}`);
  }
})();
