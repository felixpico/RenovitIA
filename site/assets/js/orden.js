import { supabase, isDemo } from './supabase.js';

const root = document.getElementById('root');
document.getElementById('print').addEventListener('click', () => window.print());
document.getElementById('back').addEventListener('click', (e) => { if (history.length > 1) { e.preventDefault(); history.back(); } });
const id = new URLSearchParams(location.search).get('id');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }) : '—');
const ageFrom = (d) => { if (!d) return null; const b = new Date(d); const n = new Date(); let a = n.getFullYear() - b.getFullYear(); if (n < new Date(n.getFullYear(), b.getMonth(), b.getDate())) a--; return a; };
const CATEGORY = { hematologia: 'Biometría hemática', electrolitos: 'Electrolitos', hepatico: 'Función hepática', renal: 'Función renal', metabolico: 'Metabólico', cardiovascular: 'Perfil cardiovascular', inflamacion: 'Inflamación', hormonal: 'Hormonas', tiroides: 'Tiroides', nutrientes: 'Vitaminas y minerales', genetica: 'Genética', muscular: 'Muscular' };

async function loadLive() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Inicia sesión para ver la orden.');
  const { data: order, error } = await supabase.from('orders').select('*').eq('id', id).single();
  if (error) throw new Error('No encontramos la orden o no tienes acceso.');
  const [it, pa, pr, ph] = await Promise.all([
    supabase.from('order_items').select('study_name, biomarker_id, biomarkers(category)').eq('order_id', id),
    supabase.from('patients').select('first_name,last_name,birth_date,sex_at_birth').eq('id', order.patient_id).single(),
    order.provider_id ? supabase.from('providers').select('name,address,phone').eq('id', order.provider_id).single() : Promise.resolve({ data: null }),
    order.signed_by ? supabase.from('physicians').select('full_name,cedula_profesional,specialty,cedula_especialidad').eq('user_id', order.signed_by).single() : Promise.resolve({ data: null }),
  ]);
  return { order, items: (it.data || []).map((x) => ({ ...x, category: x.biomarkers?.category })), patient: pa.data, provider: pr.data, physician: ph.data };
}

async function loadDemo() {
  const { demoApi } = await import('./medico-demo.js');
  const d = await demoApi.orderForPrint(id);
  const bms = await (await fetch('assets/data/biomarkers.demo.json')).json();
  d.items = d.items.map((i) => ({ ...i, category: bms.find((b) => b.id === i.biomarker_id)?.category }));
  return d;
}

function render({ order, items, patient, provider, physician }) {
  const valid = order.status !== 'draft' && order.status !== 'cancelled';
  const groups = new Map();
  items.forEach((i) => { const k = CATEGORY[i.category] || (order.order_type === 'dexa' ? 'Imagen' : 'Otros'); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(i.study_name); });
  const age = ageFrom(patient?.birth_date);
  document.title = `Orden ${order.folio || 'borrador'} · RenovitIA`;
  root.innerHTML = `
  <article class="sheet">
    ${!valid ? `<div class="watermark">${order.status === 'cancelled' ? 'CANCELADA' : 'BORRADOR'}</div>` : ''}
    <header>
      <img src="assets/brand/logo-horizontal.svg" alt="RenovitIA">
      <div class="folio">Folio<b>${esc(order.folio || 'Sin folio')}</b>Emitida ${fmtDate(order.signed_at || order.created_at)}</div>
    </header>
    <h1>Orden de ${order.order_type === 'dexa' ? 'estudio de composición corporal' : 'estudios de laboratorio'}</h1>
    <div class="grid">
      <div><span>Paciente</span>${esc(`${patient?.first_name || ''} ${patient?.last_name || ''}`)}</div>
      <div><span>Edad · Sexo</span>${age != null ? `${age} años` : '—'} · ${patient?.sex_at_birth === 'F' ? 'Femenino' : patient?.sex_at_birth === 'M' ? 'Masculino' : '—'}</div>
      <div><span>Proveedor</span>${esc(provider?.name || '—')}${provider?.address ? `<br><small>${esc(provider.address)}</small>` : ''}</div>
      <div><span>Tipo</span>${order.round === 'followup' ? 'Seguimiento' : order.round === 'extra' ? 'Adicional' : 'Basal'}</div>
    </div>
    <h2>Estudios solicitados (${items.length})</h2>
    <ul class="studies">
      ${[...groups.entries()].map(([k, list]) => `<li class="cat">${esc(k)}</li>${list.map((s) => `<li>${esc(s)}</li>`).join('')}`).join('')}
    </ul>
    ${order.indications ? `<h2>Indicaciones para el paciente</h2><div class="ind">${esc(order.indications)}</div>` : ''}
    <div class="sign"><div>
      ${physician ? `<strong>${esc(physician.full_name)}</strong><small>Cédula profesional ${esc(physician.cedula_profesional || '—')}${physician.specialty ? ` · ${esc(physician.specialty)}` : ''}${physician.cedula_especialidad ? ` · Cédula de especialidad ${esc(physician.cedula_especialidad)}` : ''}</small>` : '<small>Pendiente de firma médica</small>'}
      ${order.signed_at ? `<small>Firmada electrónicamente el ${new Date(order.signed_at).toLocaleString('es-MX')}</small>` : ''}
    </div></div>
    <footer>RenovitIA · Programa piloto de medicina funcional. Esta orden es válida sólo con folio y firma. Resultados: entregar en PDF al médico tratante o subirlos en la app. Contiene datos personales sensibles.</footer>
  </article>`;
}

(async () => {
  try {
    if (!id) throw new Error('Falta el identificador de la orden.');
    render(isDemo() ? await loadDemo() : await loadLive());
  } catch (e) {
    root.innerHTML = `<div class="msg">${esc(e.message)} <p><a href="index.html">Ir al inicio</a></p></div>`;
  }
})();
