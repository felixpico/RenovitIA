// Recordatorios de toma. Tres cosas separadas a proposito:
//  1) el permiso del navegador (el paciente lo da),
//  2) la suscripcion push (el dispositivo),
//  3) las horas (el paciente las ajusta a su vida, no al reves).
// El contenido del aviso lo arma el servidor desde el protocolo ENTREGADO.
import { supabase } from './supabase.js';

const VAPID = 'BDc2xsht3IssFRbSTPFA307Sk2e2UtZl6yiPeNQdOf4rluOvUT0V788vPvXM1kh33pUIbUF4Jhm20HnuVCnPUsM';

const FR = [
  ['ayunas', 'En ayunas'],
  ['desayuno', 'Con el desayuno'],
  ['entreno', 'Entrenamiento'],
  ['comida', 'Con la comida'],
  ['cena', 'Con la cena'],
  ['dormir', 'Antes de dormir'],
];

const b64aBytes = (s) => {
  const p = (s + '='.repeat((4 - (s.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(p), (c) => c.charCodeAt(0));
};
const bytesAb64 = (b) => btoa(String.fromCharCode(...new Uint8Array(b)))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export const soporta = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
// iOS solo entrega push si el icono esta en la pantalla de inicio. Sin eso el
// permiso ni siquiera se puede pedir, asi que hay que decirlo antes, no despues.
export const esIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const instalada = () => window.matchMedia('(display-mode: standalone)').matches
  || window.navigator.standalone === true;

export async function cargarPrefs(patientId) {
  const { data } = await supabase.from('patient_reminders').select('*').eq('patient_id', patientId).maybeSingle();
  return data;
}

export async function estadoPush() {
  if (!soporta()) return 'no-soportado';
  if (esIOS() && !instalada()) return 'ios-sin-instalar';
  if (Notification.permission === 'denied') return 'bloqueado';
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg && await reg.pushManager.getSubscription();
  if (sub) return 'activo';
  return Notification.permission === 'granted' ? 'listo' : 'sin-permiso';
}

export async function activar(patientId, tz) {
  const permiso = await Notification.requestPermission();
  if (permiso !== 'granted') throw new Error('permiso-denegado');

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64aBytes(VAPID) });
  }
  const j = sub.toJSON();
  const { error } = await supabase.from('push_subscriptions').upsert({
    patient_id: patientId,
    endpoint: sub.endpoint,
    p256dh: j.keys.p256dh,
    auth: j.keys.auth,
    user_agent: navigator.userAgent.slice(0, 250),
    disabled_at: null,
    last_error: null,
  }, { onConflict: 'endpoint' });
  if (error) throw error;

  // La fila de preferencias se crea con las horas por omision la primera vez.
  await supabase.from('patient_reminders').upsert({
    patient_id: patientId, enabled: true,
    tz: tz || Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Monterrey',
    updated_at: new Date().toISOString(),
  }, { onConflict: 'patient_id' });
}

export async function desactivar(patientId) {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg && await reg.pushManager.getSubscription();
  if (sub) {
    await supabase.from('push_subscriptions')
      .update({ disabled_at: new Date().toISOString() }).eq('endpoint', sub.endpoint);
    await sub.unsubscribe().catch(() => {});
  }
  await supabase.from('patient_reminders')
    .update({ enabled: false, updated_at: new Date().toISOString() }).eq('patient_id', patientId);
}

export async function guardarHoras(patientId, horas) {
  const { error } = await supabase.from('patient_reminders')
    .update({ horas, updated_at: new Date().toISOString() }).eq('patient_id', patientId);
  if (error) throw error;
}

const AVISO = {
  'no-soportado': 'Tu navegador no puede mandar recordatorios. Abre RenovitIA en Chrome o Safari.',
  'ios-sin-instalar': 'En iPhone los recordatorios sólo funcionan con el ícono guardado en tu pantalla de inicio. Abre el menú de compartir y elige «Agregar a inicio».',
  bloqueado: 'Bloqueaste las notificaciones para este sitio. Hay que volver a permitirlas desde los ajustes del navegador.',
};

export function cajaHTML(estado, prefs) {
  const horas = prefs?.horas || {};
  const activo = estado === 'activo' && prefs?.enabled !== false;
  const puede = estado === 'activo' || estado === 'listo' || estado === 'sin-permiso';
  let h = `<div class="rec">
    <div class="rec-top">
      <div><b>Recordatorios de toma</b>
        <span>Un aviso por franja, con lo que te toca en ese momento.</span></div>
      ${puede ? `<button class="btn ${activo ? 'btn-ghost' : 'btn-primary'} btn-sm" type="button" id="rec-sw">
        ${activo ? 'Desactivar' : 'Activar'}</button>` : ''}
    </div>`;

  if (!puede) {
    h += `<div class="dato alerta"><span class="dic">⚠️</span><div>${AVISO[estado] || ''}</div></div></div>`;
    return h;
  }

  h += `<div class="nota-chica">Sólo te avisamos de suplementos y péptidos que tu médica
    ya firmó y te entregó. Nada de estudios ni de ejercicio.</div>`;

  if (activo) {
    h += '<div class="horas">';
    FR.forEach(([k, n]) => {
      h += `<label><span>${n}</span><input type="time" data-franja="${k}" value="${horas[k] || ''}"></label>`;
    });
    h += `</div><button class="btn btn-ghost btn-sm btn-block" type="button" id="rec-horas"
      style="margin-top:10px">Guardar mis horas</button>
      <div class="nota-chica">Déjala en blanco si no quieres aviso en esa franja.</div>`;
  }
  return `${h}</div>`;
}
