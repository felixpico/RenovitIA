import { pintarPaciente } from './paciente.js';
import { supabase, applyBranding } from './supabase.js';
import { CONFIG } from './config.js';

const $ = (id) => document.getElementById(id);
const show = (id) => {
  ['loading', 'view-login', 'view-no-invite', 'view-patient'].forEach((v) => $(v).classList.toggle('hidden', v !== id));
};

applyBranding();

async function logout() {
  await supabase.auth.signOut();
  location.href = 'index.html';
}
$('btn-logout').addEventListener('click', logout);
document.querySelectorAll('[data-logout]').forEach((b) => b.addEventListener('click', logout));

const TOKEN_KEY = 'renovitia.token';
const leerToken = () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } };

$('form-start').addEventListener('submit', async (e) => {
  e.preventDefault();
  const nombre = $('start-name').value.trim();
  const email = $('start-email').value.trim().toLowerCase();
  const msg = $('start-msg');
  msg.className = 'notice';
  const falla = (t) => { msg.classList.add('danger'); msg.textContent = t; };
  if (nombre.length < 3) return falla('Escribe tu nombre completo.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return falla('Escribe un correo válido.');

  $('btn-start').disabled = true;
  msg.textContent = 'Abriendo tu historia clínica…';
  const { data, error } = await supabase.rpc('begin_public_intake', { p_email: email, p_name: nombre });
  $('btn-start').disabled = false;
  if (error || !data?.token) return falla(`No pudimos abrirla: ${error?.message || 'intenta de nuevo'}`);
  try { localStorage.setItem(TOKEN_KEY, data.token); } catch { /* modo privado */ }
  location.href = `formulario.html?t=${encodeURIComponent(data.token)}`;
});

$('btn-forget')?.addEventListener('click', () => {
  try { localStorage.removeItem(TOKEN_KEY); } catch { /* nada */ }
  location.reload();
});

async function renderPatient(session) {
  $('btn-logout').classList.remove('hidden');

  // Médicos y administradores van a su panel
  const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', session.user.id);
  const esStaff = (roles || []).some((r) => r.role === 'physician' || r.role === 'admin');
  // Quien es staff y además tiene expediente (por ejemplo, para probar el formulario)
  // puede elegir; con ?paciente=1 entra directo a la vista de paciente.
  if (esStaff) {
    const quierePaciente = new URLSearchParams(location.search).get('paciente') === '1';
    const { data: exp } = await supabase.from('patients').select('id').eq('user_id', session.user.id).maybeSingle();
    if (!exp || !quierePaciente) {
      if (!exp) { location.href = 'medico.html'; return; }
      const aviso = document.createElement('div');
      aviso.className = 'notice';
      aviso.style.cssText = 'display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin-bottom:12px';
      aviso.innerHTML = '<span class="small">Tu cuenta es del equipo médico y también tiene expediente de paciente.</span>';
      const ir = document.createElement('a');
      ir.className = 'btn btn-primary btn-sm';
      ir.href = 'medico.html';
      ir.textContent = 'Ir al panel médico';
      aviso.append(ir);
      document.querySelector('#view-patient')?.prepend(aviso);
    }
  }

  const { data: patient, error } = await supabase.rpc('claim_patient_invitation');
  if (error) {
    show('view-no-invite');
    $('no-invite-email').textContent = session.user.email;
    console.error(error);
    return;
  }
  if (!patient) {
    show('view-no-invite');
    $('no-invite-email').textContent = session.user.email;
    return;
  }

  $('welcome-name').textContent = `Hola, ${patient.first_name}`;

  // Estado del intake (sin crearlo todavía)
  const { data: intakes } = await supabase
    .from('intakes').select('id,status,template_id,started_at,submitted_at')
    .eq('patient_id', patient.id).order('started_at', { ascending: false }).limit(1);
  const intake = intakes?.[0];

  if (intake) {
    const [{ count: total }, { count: answered }] = await Promise.all([
      supabase.from('form_questions').select('id', { count: 'exact', head: true }).eq('template_id', intake.template_id),
      supabase.from('intake_answers').select('id', { count: 'exact', head: true }).eq('intake_id', intake.id),
    ]);
    const pct = total ? Math.min(100, Math.round((answered / total) * 100)) : 0;
    const done = intake.status !== 'in_progress';
    $('intake-pct').textContent = done ? '100%' : `${pct}%`;
    $('intake-bar').style.width = done ? '100%' : `${pct}%`;
    $('intake-status').textContent = {
      in_progress: `En progreso · ${answered} de ${total} respuestas`,
      submitted: 'Enviada · pendiente de revisión médica',
      in_review: 'En revisión por tu médico',
      reviewed: 'Revisada por tu médico',
    }[intake.status];
    $('btn-intake').textContent = done ? 'Ver mis respuestas' : 'Continuar';
  }

  const { data: orders } = await supabase.from('orders')
    .select('id,status,order_type,folio,scheduled_at,signed_at,providers(name)')
    .eq('patient_id', patient.id).not('status', 'in', '(draft,cancelled)').order('signed_at', { ascending: false });
  if (orders?.length) {
    const ST = { signed: 'Lista para agendar', sent: 'Enviada al laboratorio', scheduled: 'Cita agendada', sample_taken: 'Estudio realizado', results_received: 'Resultados recibidos' };
    const pending = orders.filter((o) => ['signed', 'sent'].includes(o.status)).length;
    $('orders-status').textContent = pending ? `Tienes ${pending} orden(es) por agendar.` : 'Tus órdenes:';
    const box = $('orders-list');
    box.innerHTML = '';
    orders.forEach((o) => {
      const a = document.createElement('a');
      a.className = 'notice small';
      a.style.cssText = 'display:block;text-decoration:none;color:inherit';
      a.href = `orden.html?id=${o.id}`;
      const when = o.scheduled_at ? ` · ${new Date(o.scheduled_at).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}` : '';
      a.textContent = `${o.order_type === 'dexa' ? 'DEXA' : 'Laboratorio'} · ${o.providers?.name || ''} · ${ST[o.status] || o.status}${when} → Ver orden`;
      box.append(a);
    });
  }

  // Resultados: el paciente sólo ve los que el médico liberó (RLS filtra los retenidos)
  const [{ count: nLab }, { count: nBc }] = await Promise.all([
    supabase.from('lab_results').select('id', { count: 'exact', head: true }).eq('patient_id', patient.id),
    supabase.from('body_composition').select('id', { count: 'exact', head: true }).eq('patient_id', patient.id),
  ]);
  const hechos = (orders || []).some((o) => ['sample_taken', 'results_received'].includes(o.status));
  const el = $('results-status');
  if (el) {
    if ((nLab || 0) + (nBc || 0) > 0) el.textContent = `Ya puedes ver ${(nLab || 0) + (nBc || 0)} resultado(s). Tu médico los comentará contigo.`;
    else if (hechos) el.textContent = 'Tus estudios ya se realizaron. Tu médico los está revisando y te los explicará en tu consulta; aparecerán aquí cuando los libere.';
  }

  // El protocolo, las tomas del dia y el semaforo los dibuja paciente.js.
  // Aqui solo se le pasa lo que ya se conto arriba para no repetir consultas.
  let faltantes = 0;
  try {
    const { data: ef } = await supabase.rpc('estudios_faltantes', { p_patient: patient.id });
    faltantes = Array.isArray(ef) ? ef.length : 0;
  } catch (e) { /* sin plan o sin acceso: se queda en cero */ }

  await pintarPaciente(patient, { nLab: (nLab || 0) + (nBc || 0), faltantes });

  show('view-patient');
}

/* ---------- entrar con correo y codigo de 6 digitos ---------- */
// Se usa codigo y no liga magica a proposito: en iPhone la liga abre Safari,
// no la app instalada, y la sesion se queda en el navegador equivocado.
const aviso = (texto, malo = false) => {
  const m = $('otp-msg');
  m.className = `notice ${malo ? 'danger' : ''}`;
  m.textContent = texto;
  m.classList.remove('hidden');
};
let correoPendiente = null;

$('form-otp').addEventListener('submit', async (e) => {
  e.preventDefault();
  const correo = $('otp-email').value.trim().toLowerCase();
  if (!correo || !correo.includes('@')) { aviso('Escribe un correo válido.', true); return; }
  const btn = $('btn-otp');
  btn.disabled = true; btn.textContent = 'Mandando…';
  try {
    const { error } = await supabase.auth.signInWithOtp({
      email: correo,
      options: { shouldCreateUser: true },
    });
    if (error) throw error;
    correoPendiente = correo;
    $('form-otp').classList.add('hidden');
    $('form-codigo').classList.remove('hidden');
    $('otp-code').focus();
    aviso(`Te mandamos un código a ${correo}. Revisa tu bandeja y la carpeta de spam.`);
  } catch (err) {
    aviso(/rate|limit|seconds/i.test(err.message || '')
      ? 'Ya pediste un código hace poco. Espera un minuto y vuelve a intentar.'
      : `No se pudo mandar el código: ${err.message}`, true);
  } finally { btn.disabled = false; btn.textContent = 'Mandarme el código'; }
});

$('form-codigo').addEventListener('submit', async (e) => {
  e.preventDefault();
  // El largo del codigo lo decide la configuracion de Supabase, no esta pantalla:
  // si manana se cambia de 6 a 8, aqui no hay que tocar nada.
  const codigo = $('otp-code').value.replace(/\D/g, '');
  if (codigo.length < 4) { aviso('Escribe el código completo que te llegó al correo.', true); return; }
  const btn = $('btn-codigo');
  btn.disabled = true; btn.textContent = 'Entrando…';
  try {
    const { error } = await supabase.auth.verifyOtp({ email: correoPendiente, token: codigo, type: 'email' });
    if (error) throw error;
    // El trigger enlaza al entrar por primera vez. Si la cuenta ya existia,
    // este intento lo enlaza de todos modos.
    try { await supabase.rpc('vincular_mi_cuenta'); } catch { /* sin bloquear la entrada */ }
  } catch (err) {
    aviso(/expired|invalid/i.test(err.message || '')
      ? 'Ese código no es válido o ya venció. Pide uno nuevo.'
      : `No se pudo entrar: ${err.message}`, true);
    btn.disabled = false; btn.textContent = 'Entrar';
  }
});

// Pegar desde el correo suele traer espacios o un guion en medio.
$('otp-code').addEventListener('input', () => {
  const campo = $('otp-code');
  const limpio = campo.value.replace(/\D/g, '');
  if (campo.value !== limpio) campo.value = limpio;
  $('btn-codigo').disabled = limpio.length < 4;
});

$('btn-otro-correo').addEventListener('click', () => {
  correoPendiente = null;
  $('form-codigo').classList.add('hidden');
  $('form-otp').classList.remove('hidden');
  $('otp-msg').classList.add('hidden');
  $('btn-codigo').disabled = false; $('btn-codigo').textContent = 'Entrar';
});

// Regreso de la pantalla de permisos de WHOOP. Se avisa el resultado y se limpia la
// direccion, para que recargar no vuelva a mostrar el mismo mensaje.
function avisoWearable() {
  const q = new URLSearchParams(location.search);
  const r = q.get('whoop');
  if (!r) return;
  const texto = {
    ok: 'Listo, tu WHOOP quedó conectado. El primer dato puede tardar hasta un día en llegar.',
    parcial: 'Se conectó, pero WHOOP no entregó permiso de larga duración y la conexión se vencerá pronto. Desconéctala y vuelve a conectarla.',
    cancelado: 'No se conectó: cancelaste los permisos en WHOOP.',
    error: `No se pudo conectar. ${q.get('m') || ''}`.trim(),
  }[r] || 'No se pudo conectar.';
  const caja = document.createElement('div');
  caja.className = `notice${r === 'ok' ? '' : r === 'cancelado' ? '' : ' danger'}`;
  caja.style.cssText = 'margin:12px';
  caja.textContent = texto;
  document.body.prepend(caja);
  try { history.replaceState(null, '', location.pathname); } catch { /* da igual */ }
}

// Entrar con Google. Es una SEGUNDA puerta, no la principal: la liga de WhatsApp
// sigue siendo la entrada de un toque. Esto resuelve al paciente que cambio de
// telefono o limpio el navegador y hoy depende de que le llegue un correo.
function montarGoogle() {
  const b = $('btn-google');
  const o = $('google-o');
  if (!b || !CONFIG.GOOGLE_LOGIN) return;
  b.classList.remove('hidden');
  o?.classList.remove('hidden');
  b.addEventListener('click', async () => {
    b.disabled = true;
    const texto = b.querySelector('span');
    const antes = texto.textContent;
    texto.textContent = 'Abriendo Google…';
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${location.origin}/index.html` },
      });
      if (error) throw error;
      // Si no hubo error, el navegador ya se esta yendo a Google.
    } catch (e) {
      b.disabled = false;
      texto.textContent = antes;
      const msg = $('otp-msg') || $('start-msg');
      if (msg) { msg.className = 'notice danger'; msg.textContent = `No se pudo abrir Google: ${e.message}`; }
    }
  });
}

async function init() {
  avisoWearable();
  montarGoogle();
  const { data: { session } } = await supabase.auth.getSession();
  if (session) { await renderPatient(session); return; }
  show('view-login');
  // Sin sesion, el encabezado ofrece entrar. Es el mismo bloque de abajo, pero
  // visible desde arriba sin tener que leer toda la pagina.
  $('btn-entrar')?.classList.remove('hidden');
  if (leerToken()) {
    $('resume-box').classList.remove('hidden');
    $('form-start').classList.add('hidden');
  }
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN' && session) renderPatient(session);
  if (event === 'SIGNED_OUT') show('view-login');
});

init();
