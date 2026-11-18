// Modulo de paciente en dos pestanas: "Hoy" y "Mi salud".
// Reglas que no se rompen:
//  - Lo que se palomea se guarda por id del renglon del protocolo, no por nombre.
//  - El semaforo y los resultados solo aparecen si el medico libero estudios (lo
//    impone la RLS, aqui solo se dibuja el estado vacio con dignidad).
//  - Nada se presenta como "firmado" si el protocolo no esta en delivered.
import { supabase } from './supabase.js';
import { FRANJAS, NOMBRE_FRANJA, franjaDe, tocaHoy } from './franjas.js';
import { abrirSeccion, cerrarSeccion } from './secciones.js';

const $ = (id) => document.getElementById(id);
const CON_TOMA = ['supplement', 'peptide', 'medication'];
const PALOMA = '<svg viewBox="0 0 24 24"><path d="M4 12.5l5 5L20 6.5"/></svg>';
const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const CORTO = { ayunas: 'En ayunas', desayuno: 'Desayuno', entreno: 'Entrenamiento',
  comida: 'Comida', cena: 'Cena', dormir: 'Antes de dormir', semanal: 'Esta semana',
  indefinido: 'Sin horario fijo' };
const ENTRENO_IMG = {
  jalon: 'assets/img/entreno/dia1-jalon.webp',
  empuje: 'assets/img/entreno/dia3-empuje.webp',
  pierna: 'assets/img/entreno/dia2-pierna.webp',
};

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const S = { paciente: null, plan: null, items: [], fecha: iso(new Date()),
            registro: null, guardando: false, pendiente: false };

/* ---------------- pestanas ---------------- */
export function montarTabs() {
  const barra = $('tabbar');
  if (!barra) return;
  barra.classList.remove('hidden');
  document.body.classList.add('con-tabs');
  barra.querySelectorAll('.tb').forEach((b) => {
    b.addEventListener('click', () => {
      const id = b.dataset.pg;
      document.querySelectorAll('.pg').forEach((p) => p.classList.toggle('on', p.id === `pg-${id}`));
      barra.querySelectorAll('.tb').forEach((x) => {
        x.classList.toggle('on', x === b);
        x.setAttribute('aria-pressed', x === b ? 'true' : 'false');
      });
      scrollTo({ top: 0 });
    });
  });
}

// Regresar desde una seccion tambien restaura el encabezado de Mi salud.
document.addEventListener('click', (e) => {
  if (e.target.closest('.det-bk')) {
    document.getElementById('salud-hero')?.classList.remove('hidden');
    cerrarSeccion();
  }
});

/* ---------------- Hoy ---------------- */
function franjaDeItem(i) {
  const f = franjaDe(i);
  return FRANJAS.some(([k]) => k === f) ? f : 'indefinido';
}

function delDia() {
  const f = new Date(`${S.fecha}T12:00:00`);
  return S.items.filter((i) => {
    const t = tocaHoy(i, f);
    return t === 'alterno' ? true : t;
  });
}

function etiquetas(it) {
  let e = '';
  const t = `${it.timing || ''} ${it.instructions || ''}`.toLowerCase();
  if (/subcut|intramus|inyec/.test(t) || it.category === 'peptide') e += '<span class="et">SUBCUTÁNEO</span>';
  const ciclo = /(\d+)\s*d[ií]as/.exec(it.frequency || '');
  if (ciclo) e += `<span class="et ciclo">CICLO DE ${ciclo[1]} DÍAS</span>`;
  return e;
}

function pintarHoy() {
  const caja = $('hoy-contenido');
  const items = delDia();
  const hechos = items.filter((i) => S.registro.supplements_taken?.[i.id]).length;
  const pct = items.length ? hechos / items.length : 0;
  const R = 44, C = 2 * Math.PI * R;

  let html = `
    <div class="card anillo-caja">
      <div class="anillo">
        <svg width="100" height="100" aria-hidden="true">
          <circle cx="50" cy="50" r="${R}" fill="none" stroke="var(--surface-2)" stroke-width="11"/>
          <circle cx="50" cy="50" r="${R}" fill="none" stroke="var(--brand)" stroke-width="11"
                  stroke-linecap="round" stroke-dasharray="${C.toFixed(1)}"
                  stroke-dashoffset="${(C * (1 - pct)).toFixed(1)}"/>
        </svg>
        <div class="ctr"><div class="n">${hechos}<small>/${items.length}</small></div><div class="u">HOY</div></div>
      </div>
      <div>
        <strong style="font-size:16.5px">${hechos === items.length && items.length ? '¡Día completo!' : hechos ? 'Vas avanzando' : 'Empecemos'}</strong>
        <p class="muted small" style="margin:3px 0 0">${items.length - hechos > 0
          ? `Te faltan ${items.length - hechos} de ${items.length} tomas.`
          : 'Palomeaste todo lo de hoy.'}</p>
      </div>
    </div>`;

  const porFranja = new Map();
  items.forEach((i) => {
    const f = franjaDeItem(i);
    if (!porFranja.has(f)) porFranja.set(f, []);
    porFranja.get(f).push(i);
  });

  FRANJAS.forEach(([clave, nombre]) => {
    const lista = porFranja.get(clave);
    if (!lista?.length) return;
    const n = lista.filter((i) => S.registro.supplements_taken?.[i.id]).length;
    html += `<div class="fr"><h3>${esc(CORTO[clave] || nombre)} <em>· ${n} de ${lista.length}</em></h3><div class="lista">`;
    lista.forEach((i) => {
      const on = S.registro.supplements_taken?.[i.id] ? ' on' : '';
      const sub = i.reconstitution || '';
      html += `<button class="it${on}" type="button" data-id="${esc(i.id)}" aria-pressed="${on ? 'true' : 'false'}">
        <span class="cb">${PALOMA}</span>
        <span class="nm"><b>${esc(i.title)}${etiquetas(i)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}</span>
        ${i.dose ? `<span class="ds">${esc(i.dose)}</span>` : ''}</button>`;
    });
    html += '</div></div>';
  });

  caja.innerHTML = html;
  caja.querySelectorAll('.it').forEach((b) => b.addEventListener('click', () => alternar(b)));
  pintarEntreno();
}

function alternar(btn) {
  const id = btn.dataset.id;
  if (!S.registro.supplements_taken) S.registro.supplements_taken = {};
  const nuevo = !S.registro.supplements_taken[id];
  if (nuevo) S.registro.supplements_taken[id] = new Date().toISOString();
  else delete S.registro.supplements_taken[id];
  btn.classList.toggle('on', nuevo);
  btn.setAttribute('aria-pressed', nuevo ? 'true' : 'false');
  pintarHoy();
  guardar();
}

let temporizador = null;
function guardar() { clearTimeout(temporizador); temporizador = setTimeout(escribir, 600); }
async function escribir() {
  if (S.guardando) { S.pendiente = true; return; }
  S.guardando = true;
  try {
    await supabase.from('daily_checkins').upsert({
      patient_id: S.paciente.id,
      checkin_date: S.fecha,
      supplements_taken: S.registro.supplements_taken || {},
    }, { onConflict: 'patient_id,checkin_date' });
  } catch (e) { console.error(e); }
  finally {
    S.guardando = false;
    if (S.pendiente) { S.pendiente = false; escribir(); }
  }
}

async function pintarEntreno() {
  const hoy = DIAS[new Date(`${S.fecha}T12:00:00`).getDay()];
  const { data: prog } = await supabase.rpc('programa_entrenamiento', { p_patient: S.paciente.id });
  const dia = prog?.dias?.find((d) => d.dia?.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    === hoy.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase());
  if (!dia) return;

  const foco = (dia.foco || '').toLowerCase();
  const clave = foco.includes('jalon') ? 'jalon' : foco.includes('empuje') ? 'empuje'
    : foco.includes('pierna') ? 'pierna' : null;

  const ejs = (dia.ejercicios || []).map((e) =>
    `<div><b>${esc(e.nombre)}</b><span>${esc(e.series || '')}</span></div>`).join('');

  const div = document.createElement('div');
  div.className = 'fr';
  div.innerHTML = `<h3>Entrenamiento de hoy</h3>
    <div class="entreno">
      ${clave ? `<img src="${ENTRENO_IMG[clave]}" alt="Guía ilustrada del día de ${clave}" loading="lazy" width="822" height="900">` : ''}
      <div class="bd"><div class="nm"><b>${esc(dia.dia)} · ${esc(dia.foco)}</b>
        <div class="sub">${(dia.ejercicios || []).length} ejercicios</div></div></div>
      <div class="ejs">${ejs}</div>
    </div>`;
  $('hoy-contenido').append(div);
}

/* ---------------- Mi salud ---------------- */
const ICO = {
  plan: '<path d="M9 3h6v3H9z"/><rect x="4" y="5" width="16" height="17" rx="2"/><path d="M8 11h8M8 15h5"/>',
  lab: '<path d="M9 3v7L4 20a2 2 0 0 0 1.7 3h12.6A2 2 0 0 0 20 20l-5-10V3"/><path d="M8 3h8M7.5 14h9"/>',
  pin: '<path d="M12 21v-7"/><path d="M8 3h8l-1 6 3 3H6l3-3z"/>',
  comida: '<path d="M5 3v8a2 2 0 0 0 4 0V3M7 11v10"/><path d="M17 3c-2 0-3 3-3 6s1 4 3 4v8"/>',
  pesa: '<path d="M2 12h3M19 12h3M6 8v8M18 8v8M9 6v12M15 6v12M9 12h6"/>',
  chat: '<path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  grafica: '<path d="M3 3v18h18"/><path d="M7 15l4-5 3 3 5-7"/>',
  perfil: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
};
const acceso = (icono, titulo, sub, sec, cuenta) => `
  <button class="acceso" type="button" data-sec="${sec}">
    <span class="ic"><svg viewBox="0 0 24 24">${ICO[icono]}</svg></span>
    <span class="nm"><b>${esc(titulo)}</b><span>${esc(sub)}</span></span>
    ${cuenta ? `<span class="cuenta">${cuenta}</span>` : '<span class="ch">›</span>'}
  </button>`;

async function pintarSalud(nLab, faltantes) {
  const caja = $('semaforo');
  let estado = null;
  try {
    const { data } = await supabase.rpc('estado_por_sistema', { p_patient: S.paciente.id });
    estado = data;
  } catch (e) { console.error(e); }

  if (!estado?.listo) {
    $('salud-sub').textContent = 'Todavía no hay resultados liberados.';
    caja.innerHTML = `<div class="notice">${esc(estado?.motivo
      || 'Tu médico está revisando tus estudios. En cuanto los libere verás aquí tu estado por sistema.')}</div>`;
  } else {
    $('salud-sub').textContent = `Tu estado por sistema, con ${estado.n_resultados} resultados.`;
    let html = '<div class="sem">';
    (estado.sistemas || []).forEach((s) => {
      html += `<div class="sy ${esc(s.color)}"><b><span class="pt"></span>${esc(s.nombre)}</b>
        <span>${esc(s.resumen || '')}</span></div>`;
    });
    html += '</div>';
    const cv = estado.riesgo_cv;
    if (cv && cv.calculable === false && Array.isArray(cv.falta) && cv.falta.length) {
      html += `<div class="notice" style="margin-top:12px"><strong>Falta un dato.</strong>
        Para calcular tu riesgo cardiovascular nos falta: ${esc(cv.falta.join(', '))}.</div>`;
    }
    caja.innerHTML = html;
  }

  const nav = $('salud-nav');
  nav.innerHTML = [
    acceso('plan', 'Mi protocolo', S.plan ? `Versión ${S.plan.version} · firmado por tu médica`
      : 'Pendiente de firma médica', 'protocolo'),
    acceso('lab', 'Mis estudios', nLab ? `${nLab} resultados disponibles` : 'Aún no hay resultados liberados', 'estudios'),
    faltantes ? acceso('pin', 'Estudios pendientes', 'Lo que falta por hacerte', 'pendientes', faltantes) : '',
    acceso('comida', 'Mi alimentación', 'Tus macros y un día de ejemplo', 'alimentacion'),
    acceso('pesa', 'Mi entrenamiento', 'Tu programa de la semana', 'entrenamiento'),
    acceso('chat', 'Dudas y mensajes', 'Escríbele a tu médica', 'mensajes'),
    acceso('grafica', 'Mi avance', 'Peso, cintura y constancia', 'avance'),
    acceso('perfil', 'Mi perfil', 'Datos, acceso y notificaciones', 'perfil'),
  ].filter(Boolean).join('');

  nav.querySelectorAll('[data-sec]').forEach((b) => {
    b.addEventListener('click', () => {
      $('salud-hero')?.classList.add('hidden');
      abrirSeccion(b.dataset.sec, S.paciente, S.plan);
    });
  });
}

/* ---------------- arranque ---------------- */
export async function pintarPaciente(patient, extras = {}) {
  S.paciente = patient;
  montarTabs();

  const { data: planes } = await supabase.from('protocols')
    .select('id,version,status,signed_at,start_date')
    .eq('patient_id', patient.id).eq('status', 'delivered')
    .order('version', { ascending: false });

  if (planes?.length) {
    S.plan = planes[0];
    $('onboarding').classList.add('hidden');
    $('hoy-sub').textContent = 'Esto es lo que te toca hoy.';

    const { data: items } = await supabase.from('protocol_items')
      .select('id,category,title,dose,reconstitution,timing,frequency,instructions,sort_order')
      .eq('protocol_id', S.plan.id).eq('is_active', true).order('sort_order');
    S.items = (items || []).filter((i) => CON_TOMA.includes(i.category));

    const { data: reg } = await supabase.from('daily_checkins').select('*')
      .eq('patient_id', patient.id).eq('checkin_date', S.fecha).maybeSingle();
    S.registro = reg || { supplements_taken: {} };
    if (!S.registro.supplements_taken) S.registro.supplements_taken = {};

    pintarHoy();
  } else {
    $('hoy-sub').textContent = 'Aquí verás tus tomas diarias cuando tu médico entregue tu plan.';
  }

  await pintarSalud(extras.nLab || 0, extras.faltantes || 0);
}
