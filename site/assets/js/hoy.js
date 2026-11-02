// Panel diario del paciente: que le toca hoy, palomearlo y dejar bitacora.
// Lo que se palomea se guarda por renglon del protocolo, no por nombre: si el
// medico cambia la dosis, el historial sigue apuntando a lo correcto.
import { supabase } from './supabase.js';
import { FRANJAS, NOMBRE_FRANJA, franjaDe, tocaHoy } from './franjas.js';

const $ = (id) => document.getElementById(id);
const CON_TOMA = ['supplement', 'peptide', 'medication'];
const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const ICONO = {
  ayunas: '<svg viewBox="0 0 24 24" class="fr-ico"><circle cx="12" cy="12" r="5"/><path d="M12 1v3M12 20v3M3.5 3.5l2 2M18.5 18.5l2 2M1 12h3M20 12h3M3.5 20.5l2-2M18.5 5.5l2-2"/></svg>',
  desayuno: '<svg viewBox="0 0 24 24" class="fr-ico"><path d="M4 13h12a4 4 0 0 1 0 8H8a4 4 0 0 1-4-4z"/><path d="M16 14h2a3 3 0 0 1 0 6h-1"/><path d="M7 4v3M11 3v4"/></svg>',
  entreno: '<svg viewBox="0 0 24 24" class="fr-ico"><path d="M2 12h3M19 12h3M6 8v8M18 8v8M9 6v12M15 6v12M9 12h6"/></svg>',
  comida: '<svg viewBox="0 0 24 24" class="fr-ico"><path d="M5 3v8a2 2 0 0 0 4 0V3M7 11v10"/><path d="M17 3c-2 0-3 3-3 6s1 4 3 4v8"/></svg>',
  cena: '<svg viewBox="0 0 24 24" class="fr-ico"><path d="M3 18h18"/><path d="M4 18a8 8 0 0 1 16 0"/><path d="M12 6V3"/></svg>',
  dormir: '<svg viewBox="0 0 24 24" class="fr-ico"><path d="M20 14.5A8 8 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/></svg>',
  semanal: '<svg viewBox="0 0 24 24" class="fr-ico"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  indefinido: '<svg viewBox="0 0 24 24" class="fr-ico"><circle cx="12" cy="12" r="9"/><path d="M12 8v5"/><circle cx="12" cy="16.5" r="1" fill="currentColor"/></svg>',
};
const PALOMA = '<svg viewBox="0 0 24 24"><path d="M4 12.5l5 5L20 6.5"/></svg>';

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const hoyISO = () => iso(new Date());

const S = { paciente: null, items: [], fecha: hoyISO(), registro: null, guardando: false, pendiente: false };

function aviso(t) {
  $('guardado').textContent = t;
  if (t) setTimeout(() => { if ($('guardado').textContent === t) $('guardado').textContent = ''; }, 2200);
}

async function cargar() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { location.href = 'index.html'; return; }

  const { data: pac } = await supabase.from('patients').select('id,first_name').limit(1).maybeSingle();
  if (!pac) { fallo('No encontramos tu expediente. Entra con el correo que le diste a tu médico.'); return; }
  S.paciente = pac;

  const { data: plan } = await supabase.from('protocols')
    .select('id,version').eq('patient_id', pac.id).eq('status', 'delivered')
    .order('version', { ascending: false }).limit(1).maybeSingle();
  if (!plan) { fallo('Todavía no tienes un plan entregado. Tu médico lo libera cuando lo firma.'); return; }

  const { data: items } = await supabase.from('protocol_items')
    .select('id,category,title,dose,reconstitution,timing,frequency,rationale,instructions,sort_order')
    .eq('protocol_id', plan.id).eq('is_active', true).order('sort_order');
  S.items = (items || []).filter((i) => CON_TOMA.includes(i.category));

  await cargarDia();
  $('cargando').classList.add('hidden');
  $('app').classList.remove('hidden');
  pintarRacha();
}

function fallo(texto) {
  $('cargando').classList.add('hidden');
  const e = $('error');
  e.textContent = texto;
  e.classList.remove('hidden');
}

async function cargarDia() {
  const { data } = await supabase.from('daily_checkins').select('*')
    .eq('patient_id', S.paciente.id).eq('checkin_date', S.fecha).maybeSingle();
  S.registro = data || { patient_id: S.paciente.id, checkin_date: S.fecha, supplements_taken: {} };
  if (!S.registro.supplements_taken) S.registro.supplements_taken = {};
  pintar();
}

function delDia() {
  const f = new Date(`${S.fecha}T12:00:00`);
  return S.items.filter((i) => {
    const t = tocaHoy(i, f);
    if (t === 'alterno') return true;
    return t;
  });
}

function pintar() {
  const f = new Date(`${S.fecha}T12:00:00`);
  $('dia-nombre').textContent = S.fecha === hoyISO() ? 'Hoy' : DIAS[f.getDay()];
  $('dia-fecha').textContent = f.toLocaleDateString('es-MX', { day: 'numeric', month: 'long' });
  $('manana').disabled = S.fecha >= hoyISO();

  const items = delDia();
  const tomados = S.registro.supplements_taken || {};
  const hechos = items.filter((i) => tomados[i.id]).length;
  const pct = items.length ? Math.round((hechos / items.length) * 100) : 0;
  $('pct').textContent = `${pct}%`;
  $('resumen').textContent = items.length
    ? `${hechos} de ${items.length} tomas`
    : 'Hoy no te toca ninguna toma';
  const largo = 2 * Math.PI * 42;
  $('aro').setAttribute('stroke-dasharray', `${(largo * pct) / 100} ${largo}`);

  const lista = $('lista');
  lista.innerHTML = '';
  FRANJAS.forEach(([clave]) => {
    const propios = items.filter((i) => franjaDe(i) === clave);
    if (!propios.length) return;
    const caja = document.createElement('div');
    caja.className = 'fr';
    caja.innerHTML = `<div class="fr-h">${ICONO[clave] || ''}${NOMBRE_FRANJA[clave]}</div>`;
    const cont = document.createElement('div');
    cont.className = 'fr-items';
    propios.forEach((i) => cont.append(renglon(i, !!tomados[i.id])));
    caja.append(cont);
    lista.append(caja);
  });

  $('sueno-hrs').value = S.registro.sleep_hours ?? '';
  $('notas').value = S.registro.notes ?? '';
  escala('esc-energy', 'energy');
  escala('esc-mood', 'mood');
  escala('esc-stress', 'stress');
}

function renglon(i, hecho) {
  const fila = document.createElement('div');
  fila.className = `tom${hecho ? ' hecho' : ''}`;
  const btn = document.createElement('button');
  btn.className = 'tom-box';
  btn.type = 'button';
  btn.setAttribute('aria-pressed', hecho ? 'true' : 'false');
  btn.setAttribute('aria-label', `Marcar ${i.title}`);
  btn.innerHTML = PALOMA;
  btn.addEventListener('click', () => {
    const ahora = btn.getAttribute('aria-pressed') !== 'true';
    btn.setAttribute('aria-pressed', ahora ? 'true' : 'false');
    fila.classList.toggle('hecho', ahora);
    S.registro.supplements_taken[i.id] = ahora || undefined;
    if (!ahora) delete S.registro.supplements_taken[i.id];
    pintarAnillo();
    guardar();
  });
  const cuerpo = document.createElement('div');
  cuerpo.className = 'tom-cuerpo';
  const sub = [i.dose, i.frequency].filter(Boolean).join(' · ');
  cuerpo.innerHTML = `<div class="tom-tit"></div>${sub ? '<div class="tom-sub"></div>' : ''}`;
  cuerpo.querySelector('.tom-tit').textContent = i.title;
  if (sub) cuerpo.querySelector('.tom-sub').textContent = sub;
  if (i.instructions) {
    const d = document.createElement('details');
    const s = document.createElement('summary');
    s.textContent = 'Ver detalle';
    s.style.cssText = 'font-size:.8rem;color:var(--brand);cursor:pointer';
    const p = document.createElement('p');
    p.className = 'muted small';
    p.style.margin = '4px 0 0';
    p.textContent = [i.rationale ? `Para qué: ${i.rationale}` : '', i.instructions].filter(Boolean).join(' · ');
    d.append(s, p);
    cuerpo.append(d);
  }
  fila.append(btn, cuerpo);
  return fila;
}

function pintarAnillo() {
  const items = delDia();
  const tomados = S.registro.supplements_taken || {};
  const hechos = items.filter((i) => tomados[i.id]).length;
  const pct = items.length ? Math.round((hechos / items.length) * 100) : 0;
  $('pct').textContent = `${pct}%`;
  $('resumen').textContent = items.length ? `${hechos} de ${items.length} tomas` : 'Hoy no te toca ninguna toma';
  const largo = 2 * Math.PI * 42;
  $('aro').setAttribute('stroke-dasharray', `${(largo * pct) / 100} ${largo}`);
}

function escala(id, campo) {
  const caja = $(id);
  caja.innerHTML = '';
  for (let n = 1; n <= 5; n += 1) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = n;
    b.setAttribute('aria-pressed', S.registro[campo] === n ? 'true' : 'false');
    b.addEventListener('click', () => {
      S.registro[campo] = S.registro[campo] === n ? null : n;
      escala(id, campo);
      guardar();
    });
    caja.append(b);
  }
}

// Guardado con freno: el paciente palomea rapido y no hace falta una escritura
// por toque. Si ya hay una en vuelo, se encola una sola.
let timer = null;
function guardar() {
  clearTimeout(timer);
  timer = setTimeout(escribir, 600);
}

async function escribir() {
  if (S.guardando) { S.pendiente = true; return; }
  S.guardando = true;
  const fila = {
    patient_id: S.paciente.id,
    checkin_date: S.fecha,
    sleep_hours: $('sueno-hrs').value === '' ? null : Number($('sueno-hrs').value),
    energy: S.registro.energy ?? null,
    mood: S.registro.mood ?? null,
    stress: S.registro.stress ?? null,
    supplements_taken: S.registro.supplements_taken,
    notes: $('notas').value.trim() || null,
    updated_at: new Date().toISOString(),
  };
  try {
    const { error } = await supabase.from('daily_checkins')
      .upsert(fila, { onConflict: 'patient_id,checkin_date' });
    if (error) throw error;
    aviso('Guardado');
    pintarRacha();
  } catch (e) {
    aviso('No se pudo guardar');
    console.error(e);
  } finally {
    S.guardando = false;
    if (S.pendiente) { S.pendiente = false; escribir(); }
  }
}

$('sueno-hrs').addEventListener('input', guardar);
$('notas').addEventListener('input', guardar);

$('ayer').addEventListener('click', async () => {
  const d = new Date(`${S.fecha}T12:00:00`); d.setDate(d.getDate() - 1);
  S.fecha = iso(d); await cargarDia();
});
$('manana').addEventListener('click', async () => {
  if (S.fecha >= hoyISO()) return;
  const d = new Date(`${S.fecha}T12:00:00`); d.setDate(d.getDate() + 1);
  S.fecha = iso(d); await cargarDia();
});

async function pintarRacha() {
  const desde = new Date(); desde.setDate(desde.getDate() - 6);
  const { data } = await supabase.from('daily_checkins')
    .select('checkin_date,supplements_taken')
    .eq('patient_id', S.paciente.id).gte('checkin_date', iso(desde));
  const porFecha = new Map((data || []).map((r) => [r.checkin_date, r]));
  const caja = $('racha');
  caja.innerHTML = '';
  for (let k = 6; k >= 0; k -= 1) {
    const d = new Date(); d.setDate(d.getDate() - k);
    const r = porFecha.get(iso(d));
    const items = S.items.filter((i) => tocaHoy(i, d) !== false);
    const hechos = r ? Object.keys(r.supplements_taken || {}).length : 0;
    const s = document.createElement('span');
    s.textContent = DIAS[d.getDay()].slice(0, 1);
    s.title = iso(d);
    if (items.length && hechos >= items.length) s.className = 'ok';
    else if (hechos > 0) s.className = 'parcial';
    caja.append(s);
  }
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
cargar().catch((e) => fallo(e.message));
