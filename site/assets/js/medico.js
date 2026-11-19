import { supabase, isDemo } from './supabase.js';
import { CONFIG } from './config.js';
import { OVERRIDES } from './overrides.js';
import { INSTRUMENTS, instrumentKey } from './instruments.js';
import { demoApi } from './medico-demo.js';
import { renderStudiesTab } from './estudios.js';
import { viewRanges } from './rangos.js';
import { renderPlanTab } from './plan-tab.js';

const $ = (id) => document.getElementById(id);
const DEMO = isDemo();

/* ================= utilidades ================= */
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
  return el;
}
const LEVEL = { urgent: 'Urgente', block: 'Requiere consulta', prioritize: 'Prioriza' };
const ALERT_STATUS = { open: 'Abierta', acknowledged: 'En seguimiento', resolved: 'Resuelta', dismissed: 'Descartada' };
const INTAKE_STATUS = { in_progress: ['En progreso', 'neutral'], submitted: ['Enviada · sin revisar', 'block'], in_review: ['En revisión', 'prioritize'], reviewed: ['Revisada', 'ok'] };
const PATIENT_STATUS = { invited: 'Invitado', onboarding: 'Llenando historia', active: 'Activo', excluded: 'Excluido', completed: 'Completó', withdrawn: 'Retirado' };
const badge = (cls, text) => h('span', { class: `badge ${cls}`, text });
const fullName = (p) => `${p.first_name || ''} ${p.last_name || ''}`.trim();
const ago = (iso) => {
  if (!iso) return '';
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'ahora';
  if (m < 60) return `hace ${m} min`;
  if (m < 1440) return `hace ${Math.round(m / 60)} h`;
  return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
};
const ageFrom = (d) => { if (!d) return null; const b = new Date(d); if (isNaN(b)) return null; const n = new Date(); let a = n.getFullYear() - b.getFullYear(); if (n < new Date(n.getFullYear(), b.getMonth(), b.getDate())) a--; return a; };
const waLink = (phone) => { const d = String(phone || '').replace(/\D/g, ''); if (!d) return null; return `https://wa.me/${d.length === 10 ? '52' + d : d}`; };

function toast(msg, danger = false) {
  const n = h('div', { class: `notice ${danger ? 'danger' : ''}`, role: 'status', style: 'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:60;box-shadow:var(--shadow);max-width:90vw', text: msg });
  document.body.append(n);
  setTimeout(() => n.remove(), 3500);
}

function modal(title, bodyEl, okText = 'Guardar') {
  return new Promise((resolve) => {
    $('modal-title').textContent = title;
    $('modal-body').innerHTML = '';
    $('modal-body').append(bodyEl);
    $('modal-ok').textContent = okText;
    $('modal').classList.remove('hidden');
    const close = (val) => { $('modal').classList.add('hidden'); $('modal-ok').onclick = null; $('modal-cancel').onclick = null; resolve(val); };
    $('modal-ok').onclick = () => close(true);
    $('modal-cancel').onclick = () => close(false);
    bodyEl.querySelector('input,textarea,select')?.focus();
  });
}

/* ================= capa de datos (Supabase) ================= */
const liveApi = {
  async me() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;
    const uid = session.user.id;
    const [{ data: roles }, { data: doc }] = await Promise.all([
      supabase.from('user_roles').select('role').eq('user_id', uid),
      supabase.from('physicians').select('*').eq('user_id', uid).maybeSingle(),
    ]);
    return { id: uid, email: session.user.email, roles: (roles || []).map((r) => r.role), physician: doc };
  },
  async alerts() {
    const { data, error } = await supabase.from('v_alert_queue').select('*').limit(500);
    if (error) throw error; return data;
  },
  async updateAlert(id, patch) {
    const { error } = await supabase.from('alerts').update(patch).eq('id', id);
    if (error) throw error;
  },
  async patients() {
    const [p, i, a] = await Promise.all([
      supabase.from('patients').select('*').order('created_at', { ascending: false }),
      supabase.from('intakes').select('id,patient_id,status,started_at,submitted_at,reviewed_at').order('started_at', { ascending: false }),
      supabase.from('alerts').select('patient_id,level,status'),
    ]);
    for (const r of [p, i, a]) if (r.error) throw r.error;
    return { patients: p.data, intakes: i.data, alerts: a.data };
  },
  async physicians() {
    const { data, error } = await supabase.from('physicians').select('user_id,full_name'); if (error) throw error; return data;
  },
  async invite(row) {
    const { data, error } = await supabase.from('patients').insert(row).select().single(); if (error) throw error; return data;
  },
  async patient(id) {
    const { data: patient, error } = await supabase.from('patients').select('*').eq('id', id).single();
    if (error) throw error;
    const { data: intakes } = await supabase.from('intakes').select('*').eq('patient_id', id).order('started_at', { ascending: false }).limit(1);
    const intake = intakes?.[0] || null;
    const out = { patient, intake, sections: [], questions: [], answers: [], scores: [], alerts: [], consents: [] };
    const [al, co] = await Promise.all([
      supabase.from('v_alert_queue').select('*').eq('patient_id', id),
      supabase.from('consents').select('consent_type,accepted,accepted_at,document_version,revoked_at').eq('patient_id', id),
    ]);
    out.alerts = al.data || []; out.consents = co.data || [];
    if (intake) {
      const [s, q, a, sc] = await Promise.all([
        supabase.from('form_sections').select('*').eq('template_id', intake.template_id).order('sort_order'),
        supabase.from('form_questions').select('*').eq('template_id', intake.template_id).order('sort_order'),
        supabase.from('intake_answers').select('question_id,value,updated_at').eq('intake_id', intake.id),
        supabase.from('instrument_scores').select('*').eq('intake_id', intake.id),
      ]);
      out.sections = s.data || []; out.questions = q.data || []; out.answers = a.data || []; out.scores = sc.data || [];
    }
    return out;
  },
  async updateIntake(id, patch) {
    const { error } = await supabase.from('intakes').update(patch).eq('id', id); if (error) throw error;
  },
  async reevaluate(intakeId) {
    const { data, error } = await supabase.rpc('reevaluate_intake', { p_intake: intakeId }); if (error) throw error; return data;
  },
  async studies(patientId) {
    const [o, pr, d, r, bc, bm, rg] = await Promise.all([
      supabase.from('orders').select('*').eq('patient_id', patientId).order('created_at', { ascending: false }),
      supabase.from('providers').select('id,name,provider_type').eq('is_active', true).order('name'),
      supabase.from('documents').select('*').eq('patient_id', patientId).order('created_at', { ascending: false }),
      supabase.from('lab_results').select('*').eq('patient_id', patientId),
      supabase.from('body_composition').select('*').eq('patient_id', patientId).order('measured_at', { ascending: false }),
      supabase.from('biomarkers').select('id,code,name_es,category,default_unit'),
      supabase.from('biomarker_ranges').select('*'),
    ]);
    for (const x of [o, pr, d, r, bc, bm, rg]) if (x.error) throw x.error;
    const ids = o.data.map((x) => x.id);
    const it = ids.length ? await supabase.from('order_items').select('*').in('order_id', ids) : { data: [] };
    if (it.error) throw it.error;
    return { orders: o.data, items: it.data, providers: pr.data, documents: d.data, results: r.data, bodycomp: bc.data, biomarkers: bm.data, ranges: rg.data };
  },
  async suggest(patientId) {
    const { data, error } = await supabase.rpc('suggest_studies', { p_patient: patientId }); if (error) throw error; return data;
  },
  async createOrder(order, items) {
    const { data, error } = await supabase.from('orders').insert(order).select().single(); if (error) throw error;
    const { error: e2 } = await supabase.from('order_items').insert(items.map((i) => ({ ...i, order_id: data.id })));
    if (e2) { await supabase.from('orders').delete().eq('id', data.id); throw e2; }
    return data;
  },
  async signOrder(id) { const { error } = await supabase.rpc('sign_order', { p_order: id }); if (error) throw error; },
  async updateOrder(id, patch) { const { error } = await supabase.from('orders').update(patch).eq('id', id); if (error) throw error; },
  async deleteOrder(id) {
    const { error: e1 } = await supabase.from('order_items').delete().eq('order_id', id); if (e1) throw e1;
    const { error } = await supabase.from('orders').delete().eq('id', id).eq('status', 'draft'); if (error) throw error;
  },
  async saveResults(rows) {
    const upd = rows.filter((r) => r.id); const ins = rows.filter((r) => !r.id).map(({ id, ...r }) => r);
    if (ins.length) { const { error } = await supabase.from('lab_results').insert(ins); if (error) throw error; }
    for (const { id, ...r } of upd) { const { error } = await supabase.from('lab_results').update(r).eq('id', id); if (error) throw error; }
  },
  async saveBodyComp(row) { const { error } = await supabase.from('body_composition').insert(row); if (error) throw error; },
  async releaseResults(patientId) { const { data, error } = await supabase.rpc('release_results', { p_patient: patientId }); if (error) throw error; return data; },
  async holdResults(patientId) { const { data, error } = await supabase.rpc('unrelease_results', { p_patient: patientId }); if (error) throw error; return data; },
  async uploadDoc(patientId, order, file) {
    const kind = order.order_type === 'dexa' ? 'dexa_report' : 'lab_report';
    const safe = file.name.normalize('NFD').replace(/[^\w.-]+/g, '_');
    const path = `${patientId}/${kind}/${Date.now()}-${safe}`;
    const up = await supabase.storage.from(CONFIG.STORAGE_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
    if (up.error) throw up.error;
    const { error } = await supabase.from('documents').insert({ patient_id: patientId, order_id: order.id, kind, storage_path: path, original_filename: file.name, mime_type: file.type, uploaded_by: S.me.id, extraction_status: 'pending' });
    if (error) throw error;
  },
  // Subida libre: el médico sube un estudio aunque no haya orden (p. ej. laboratorios que el paciente trajo)
  async uploadLooseDoc(patientId, kind, file) {
    const safe = file.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w.-]+/g, '_').slice(-80);
    const path = `${patientId}/${kind}/${Date.now()}-${safe}`;
    const up = await supabase.storage.from(CONFIG.STORAGE_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
    if (up.error) throw up.error;
    const { error } = await supabase.from('documents').insert({ patient_id: patientId, kind, storage_path: path, original_filename: file.name, mime_type: file.type, uploaded_by: S.me.id, extraction_status: 'pending' });
    if (error) throw error;
  },
  async extractStudy(documentId) {
    const { data, error } = await supabase.functions.invoke('extract-study', { body: { document_id: documentId } });
    if (error || data?.error) throw new Error(data?.error || error.message);
    return data;
  },
  async confirmExtraction(documentId) {
    const { data, error } = await supabase.rpc('confirmar_extraccion', { p_document: documentId });
    if (error) throw error; return data;
  },
  async discardExtraction(documentId) {
    const { data, error } = await supabase.rpc('descartar_extraccion', { p_document: documentId });
    if (error) throw error; return data;
  },
  async extractedRows(documentId) {
    const [lr, bc] = await Promise.all([
      supabase.from('lab_results').select('*').eq('document_id', documentId),
      supabase.from('body_composition').select('*').eq('document_id', documentId),
    ]);
    if (lr.error) throw lr.error; if (bc.error) throw bc.error;
    return { lab: lr.data, bodycomp: bc.data };
  },
  async evaluateLabs(patientId) {
    const { data, error } = await supabase.rpc('evaluate_labs', { p_patient: patientId });
    if (error) throw error; return data;
  },
  async valoresConvertidos(patientId) {
    const { data, error } = await supabase.rpc('valores_convertidos', { p_patient: patientId });
    if (error) throw error; return data;
  },
  async reevaluarTodo() {
    const { data, error } = await supabase.rpc('reevaluar_todo');
    if (error) throw error; return data;
  },
  async suggestions(patientId) {
    const { data, error } = await supabase.rpc('sugerir_plan', { p_patient: patientId });
    if (error) throw error; return data || [];
  },
  async patterns() {
    const { data, error } = await supabase.from('interpretation_patterns').select('*')
      .order('system').order('sort_order');
    if (error) throw error; return data || [];
  },
  async approvePatterns(ids, aprobar = true) {
    const { data, error } = await supabase.rpc('aprobar_patrones', { p_ids: ids, p_aprobar: aprobar });
    if (error) throw error; return data;
  },
  async savePattern(id, patch) {
    const { error } = await supabase.from('interpretation_patterns').update(patch).eq('id', id);
    if (error) throw error;
  },
  async riesgoCV(patientId) {
    const { data, error } = await supabase.rpc('riesgo_cv', { p_patient: patientId });
    if (error) throw error; return data;
  },
  async guardarVitales(patientId, fila) {
    const { error } = await supabase.from('vital_signs')
      .insert({ patient_id: patientId, source: 'consulta', ...fila });
    if (error) throw error;
  },
  async generarAcceso(patientId, horas = 72) {
    const { data, error } = await supabase.rpc('generar_acceso_paciente', { p_patient: patientId, p_horas: horas });
    if (error) throw error; return data;
  },
  async rules() {
    const { data, error } = await supabase.from('suggestion_rules').select('*')
      .order('sort_order').order('code');
    if (error) throw error; return data || [];
  },
  async approveRules(ids, aprobar = true) {
    const { data, error } = await supabase.rpc('aprobar_reglas', { p_ids: ids, p_aprobar: aprobar });
    if (error) throw error; return data;
  },
  async saveRule(id, patch) {
    const { error } = await supabase.from('suggestion_rules').update(patch).eq('id', id);
    if (error) throw error;
  },
  async catalogs() {
    const [sup, pep, ejer] = await Promise.all([
      supabase.from('catalog_supplements').select('*').eq('is_active', true).order('name_es'),
      supabase.from('catalog_peptides').select('*').eq('is_active', true).order('name_es'),
      supabase.from('catalog_exercises').select('*').eq('is_active', true).order('modality').order('name_es'),
    ]);
    for (const x of [sup, pep, ejer]) if (x.error) throw x.error;
    return { supplements: sup.data, peptides: pep.data, exercises: ejer.data };
  },
  async plans(patientId) {
    const { data, error } = await supabase.from('protocols').select('*').eq('patient_id', patientId)
      .order('version', { ascending: false });
    if (error) throw error;
    const ids = (data || []).map((p) => p.id);
    const it = ids.length ? await supabase.from('protocol_items').select('*').in('protocol_id', ids).order('sort_order') : { data: [] };
    if (it.error) throw it.error;
    return { plans: data || [], items: it.data || [] };
  },
  async generatePlan(patientId) {
    const { data, error } = await supabase.rpc('generar_plan', { p_patient: patientId });
    if (error) throw error; return data;
  },
  async signPlan(planId, aceptarDosisNoAuditable = false) {
    const { data, error } = await supabase.rpc('firmar_protocolo',
      { p_protocol: planId, p_aceptar_dosis_no_auditable: aceptarDosisNoAuditable });
    if (error) throw error; return data;
  },
  async deliverPlan(planId) {
    const { data, error } = await supabase.rpc('entregar_protocolo', { p_protocol: planId });
    if (error) throw error; return data;
  },
  async savePlanItem(planId, item) {
    const row = { ...item, protocol_id: planId, added_by: 'physician', physician_edited: true };
    if (item.id) { const { error } = await supabase.from('protocol_items').update(row).eq('id', item.id); if (error) throw error; }
    else { const { error } = await supabase.from('protocol_items').insert(row); if (error) throw error; }
  },
  async removePlanItem(itemId) {
    const { error } = await supabase.from('protocol_items').update({ is_active: false }).eq('id', itemId);
    if (error) throw error;
  },
  async savePlanNotes(planId, notes) {
    const { error } = await supabase.from('protocols').update({ physician_notes: notes }).eq('id', planId);
    if (error) throw error;
  },
  async ranges() {
    const [bm, rg, cr] = await Promise.all([
      supabase.from('biomarkers').select('id,code,name_es,category,default_unit').order('category'),
      supabase.from('biomarker_ranges').select('*'),
      supabase.from('biomarker_critical_values').select('*'),
    ]);
    if (bm.error) throw bm.error; if (rg.error) throw rg.error; if (cr.error) throw cr.error;
    return { biomarkers: bm.data, ranges: rg.data, criticals: cr.data };
  },
  async approveCriticals(ids, aprobar = true) {
    const { data, error } = await supabase.rpc('aprobar_criticos', { p_ids: ids, p_aprobar: aprobar });
    if (error) throw error; return data;
  },
  async saveRange(id, patch) {
    const { error } = await supabase.from('biomarker_ranges').update(patch).eq('id', id); if (error) throw error;
  },
  async approveRanges(ids, aprobar = true) {
    const { data, error } = await supabase.rpc('aprobar_rangos', { p_ids: ids, p_aprobar: aprobar });
    if (error) throw error; return data;
  },
  async docUrl(path) {
    const { data, error } = await supabase.storage.from(CONFIG.STORAGE_BUCKET).createSignedUrl(path, 120); if (error) throw error; return data.signedUrl;
  },
};
const api = DEMO ? demoApi : liveApi;

/* ================= estado ================= */
const S = { me: null, alertFilter: { status: 'abiertas', level: 'todas' }, patientTab: 'alertas' };
const isAdmin = () => S.me?.roles.includes('admin');

/* ================= formato de respuestas ================= */
function fieldLabel(code, key) {
  const f = OVERRIDES[code]?.fields?.find((x) => x.k === key);
  return f ? f.l : key.replace(/_/g, ' ');
}
function fmtAnswer(q, v) {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v === 'object' && v.skipped === true) return 'Pendiente · el paciente la dejó para después';
  const code = q.question_code;
  if (typeof v === 'boolean') return v ? 'Sí' : 'No';
  if (typeof v !== 'object') return String(v);
  if (Array.isArray(v)) return v.length ? v.join(', ') : null;
  if ('members' in v) {
    if (v.none) return 'Nadie';
    if (v.unknown) return 'No sabe';
    return [v.members.join(', '), v.detail].filter(Boolean).join(' · ') || null;
  }
  if ('selected' in v) {
    if (v.none) return 'Ninguno';
    return [[...(v.selected || []), v.other].filter(Boolean).join(', '), v.detail && `Detalle: ${v.detail}`].filter(Boolean).join('\n') || null;
  }
  if ('accepted' in v) return v.accepted ? `Firmado por ${v.name || '—'}${v.at ? ` · ${new Date(v.at).toLocaleString('es-MX')}` : ''}` : 'No firmado';
  if ('value' in v) return [v.value, v.detail].filter(Boolean).join(' · ') || null;
  if (v.rows) return Object.entries(v.rows).map(([k, x]) => `${k}: ${x}`).join('\n');
  if (v.items && Array.isArray(v.items)) {
    const key = instrumentKey(q); const def = INSTRUMENTS[key];
    const labels = def?.perItemScale ? def.perItemScale.map((r) => r.s) : null;
    return v.items.map((x, i) => {
      const scale = labels ? labels[i] : def?.scale;
      const t = scale?.find((o) => o.v === x)?.t ?? x;
      const item = def?.perItemScale ? def.perItemScale[i].t : def?.items?.[i];
      return `${i + 1}. ${item ? item.replace(/^…/, '') : ''} → ${t ?? '—'}`;
    }).join('\n');
  }
  if (v.items && typeof v.items === 'object') {
    const L = { 0: 'No', 1: 'A veces', 2: 'Frecuente leve', 3: 'Seguido' };
    const ent = Object.entries(v.items);
    if (ent.every(([, x]) => typeof x === 'number')) {      // síntomas: sólo lo positivo
      const pos = ent.filter(([, x]) => x > 0);
      return pos.length ? pos.map(([k, x]) => `${k}: ${L[x] ?? x}`).join('\n') : 'Sin síntomas';
    }
    return ent.map(([k, x]) => `${k}: ${typeof x === 'number' ? (L[x] ?? x) : x}`).join('\n');
  }
  return Object.entries(v).filter(([, x]) => x !== '' && x !== null && x !== undefined).map(([k, x]) => `${fieldLabel(code, k)}: ${x}`).join('\n') || null;
}

/* ================= vistas ================= */
function setNav(route) {
  document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('active', a.dataset.route === route));
}

function alertCard(a, { showPatient = true, onChange }) {
  const card = h("div", { class: `row-card lvl-${a.level}` });
  const top = h('div', { class: 'row-top' },
    badge(a.level, LEVEL[a.level]),
    h('span', { class: 'grow', text: a.title }),
    a.status !== 'open' ? badge('neutral', ALERT_STATUS[a.status]) : null,
    h('span', { class: 'muted small', text: ago(a.created_at) }));
  card.append(top);
  if (a.detail) card.append(h('div', { text: a.detail }));
  if (a.action_physician) card.append(h('div', { class: 'muted small', text: `Sugerencia: ${a.action_physician}` }));
  const meta = h('div', { class: 'row-meta' });
  if (showPatient) meta.append(h('a', { href: `#/paciente/${a.patient_id}`, text: a.patient_name }));
  if (a.phone) meta.append(h('a', { href: `tel:${a.phone}`, text: a.phone }), h('a', { href: waLink(a.phone), target: '_blank', rel: 'noopener', text: 'WhatsApp' }));
  if (a.rule_code) meta.append(h('span', { text: `Regla ${a.rule_code}` }));
  card.append(meta);

  const actions = h('div', { class: 'row-actions' });
  const act = async (patch, msg) => {
    try { await api.updateAlert(a.id, patch); toast(msg); onChange?.(); } catch (e) { toast(`Error: ${e.message}`, true); }
  };
  if (a.status === 'open') {
    actions.append(h('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: 'Tomar seguimiento',
      onclick: () => act({ status: 'acknowledged', acknowledged_by: S.me.id, acknowledged_at: new Date().toISOString() }, 'Alerta en seguimiento') }));
  }
  if (a.status === 'open' || a.status === 'acknowledged') {
    actions.append(h('button', { class: 'btn btn-primary btn-sm', type: 'button', text: 'Resolver', onclick: async () => {
      const ta = h('textarea', { class: 'input', rows: 4, placeholder: 'Qué se hizo: llamada, consulta agendada, derivación, ajuste de protocolo…' });
      const body = h('div', { class: 'stack' }, h('p', { class: 'muted small', text: `${a.patient_name} · ${a.title}` }), ta);
      if (!(await modal('Resolver alerta', body))) return;
      if (!ta.value.trim()) { toast('Escribe una nota de resolución', true); return; }
      act({ status: 'resolved', resolution_note: ta.value.trim(), resolved_at: new Date().toISOString(), acknowledged_by: a.acknowledged_by || S.me.id }, 'Alerta resuelta');
    } }));
    if (a.level !== 'urgent') {
      actions.append(h('button', { class: 'btn-link btn-sm', type: 'button', text: 'Descartar', onclick: async () => {
        const ta = h('textarea', { class: 'input', rows: 3, placeholder: 'Motivo (ej. dato mal capturado, ya controlado por su médico tratante)' });
        if (!(await modal('Descartar alerta', h('div', { class: 'stack' }, ta), 'Descartar'))) return;
        if (!ta.value.trim()) { toast('Escribe el motivo', true); return; }
        act({ status: 'dismissed', resolution_note: ta.value.trim(), resolved_at: new Date().toISOString() }, 'Alerta descartada');
      } }));
    }
  } else if (a.resolution_note) {
    card.append(h('div', { class: 'small', text: `Nota: ${a.resolution_note}` }));
  }
  if (actions.childElementCount) card.append(actions);
  return card;
}

async function viewAlerts(root) {
  setNav('alertas');
  const alerts = await api.alerts();
  const open = alerts.filter((a) => a.status === 'open' || a.status === 'acknowledged');
  updateAlertCount(alerts);
  const { intakes } = await api.patients();
  const pendingReview = intakes.filter((i) => i.status === 'submitted').length;

  root.append(h('div', { class: 'page-head' }, h('h1', { text: 'Alertas' }),
    h('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: 'Actualizar', onclick: () => route() })));
  root.append(h('div', { class: 'kpis' },
    h('div', { class: 'kpi' }, h('b', { text: open.filter((a) => a.level === 'urgent').length, style: 'color:var(--danger)' }), h('span', { text: 'Urgentes abiertas' })),
    h('div', { class: 'kpi' }, h('b', { text: open.filter((a) => a.level === 'block').length }), h('span', { text: 'Requieren consulta' })),
    h('div', { class: 'kpi' }, h('b', { text: open.filter((a) => a.level === 'prioritize').length }), h('span', { text: 'Priorizaciones' })),
    h('div', { class: 'kpi' }, h('b', { text: pendingReview }), h('span', { text: 'Historias sin revisar' }))));

  const stSel = h('select', { class: 'input', 'aria-label': 'Estado' }, ...[['abiertas', 'Abiertas y en seguimiento'], ['resueltas', 'Resueltas y descartadas'], ['todas', 'Todas']].map(([v, t]) => h('option', { value: v, text: t })));
  const lvSel = h('select', { class: 'input', 'aria-label': 'Nivel' }, ...[['todas', 'Todos los niveles'], ['urgent', 'Urgentes'], ['block', 'Requieren consulta'], ['prioritize', 'Priorizaciones']].map(([v, t]) => h('option', { value: v, text: t })));
  stSel.value = S.alertFilter.status; lvSel.value = S.alertFilter.level;
  const list = h('div', { class: 'list' });
  const draw = () => {
    S.alertFilter = { status: stSel.value, level: lvSel.value };
    list.innerHTML = '';
    const rows = alerts.filter((a) => {
      const st = S.alertFilter.status === 'todas' || (S.alertFilter.status === 'abiertas' ? ['open', 'acknowledged'].includes(a.status) : ['resolved', 'dismissed'].includes(a.status));
      return st && (S.alertFilter.level === 'todas' || a.level === S.alertFilter.level);
    });
    if (!rows.length) list.append(h('div', { class: 'empty-state', text: 'Sin alertas con estos filtros.' }));
    rows.forEach((a) => list.append(alertCard(a, { onChange: () => route() })));
  };
  stSel.onchange = draw; lvSel.onchange = draw;
  root.append(h('div', { class: 'toolbar', style: 'margin-bottom:12px' }, stSel, lvSel), list);
  draw();
}

async function inviteDialog(onDone) {
  const docs = isAdmin() ? await api.physicians() : [];
  const f = (l, input) => h('label', { class: 'field' }, h('span', { class: 'field-label small', text: l }), input);
  const first = h('input', { class: 'input', autocomplete: 'off' });
  const last = h('input', { class: 'input', autocomplete: 'off' });
  const email = h('input', { class: 'input', type: 'email', autocomplete: 'off' });
  const phone = h('input', { class: 'input', type: 'tel', placeholder: '10 dígitos' });
  const birth = h('input', { class: 'input', type: 'date' });
  const sex = h('select', { class: 'input' }, h('option', { value: '', text: '—' }), h('option', { value: 'F', text: 'Femenino' }), h('option', { value: 'M', text: 'Masculino' }));
  const doc = h('select', { class: 'input' }, h('option', { value: '', text: 'Sin asignar' }), ...docs.map((d) => h('option', { value: d.user_id, text: d.full_name })));
  if (S.me.physician) doc.value = S.me.id;
  const body = h('div', { class: 'stack' },
    h('div', { class: 'fields-grid' }, f('Nombre(s)', first), f('Apellidos', last)),
    f('Correo (con el que entrará)', email),
    h('div', { class: 'fields-grid' }, f('Teléfono', phone), f('Nacimiento', birth), f('Sexo', sex)),
    isAdmin() ? f('Médico asignado', doc) : null,
    h('p', { class: 'muted small', text: `El paciente entra en ${CONFIG.SITE_URL || location.origin} con ese correo; el sistema lo vincula solo.` }));
  if (!(await modal('Invitar paciente', body, 'Invitar'))) return;
  if (!first.value.trim() || !last.value.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) { toast('Nombre, apellidos y un correo válido son obligatorios', true); return; }
  try {
    await api.invite({
      first_name: first.value.trim(), last_name: last.value.trim(), email: email.value.trim().toLowerCase(),
      phone: phone.value.trim() || null, birth_date: birth.value || null, sex_at_birth: sex.value || null,
      assigned_physician_id: (isAdmin() ? doc.value : S.me.id) || null, status: 'invited',
    });
    toast('Paciente invitado'); onDone?.();
  } catch (e) { toast(`No se pudo invitar: ${e.message}`, true); }
}

async function viewPatients(root) {
  setNav('pacientes');
  const [{ patients, intakes, alerts }, docs] = await Promise.all([api.patients(), isAdmin() ? api.physicians() : Promise.resolve([])]);
  const docName = Object.fromEntries(docs.map((d) => [d.user_id, d.full_name]));
  // Un paciente sin user_id NUNCA ha podido entrar a la app. Es el cuello de botella
  // mas caro del piloto y hasta hoy habia que descubrirlo paciente por paciente.
  const sinCuenta = patients.filter((p) => !p.user_id && p.status === 'active'
    && p.email && String(p.email).trim());
  const salidaMasiva = h('div', { style: 'display:none;margin-bottom:12px' });

  root.append(h('div', { class: 'page-head' }, h('h1', { text: `Pacientes (${patients.length})` }),
    h('div', { class: 'toolbar' },
      sinCuenta.length ? h('button', { class: 'btn btn-ghost btn-sm', type: 'button',
        text: `Generar ${sinCuenta.length} acceso(s) faltante(s)`,
        onclick: async (ev) => {
          const b2 = ev.currentTarget;
          const cuerpo = h('div', { class: 'stack' },
            h('p', {}, h('b', { text: `${sinCuenta.length} paciente(s) activo(s) nunca han entrado a la app.` }),
              ' Se genera una liga para cada uno, válida 3 días.'),
            h('ul', { style: 'margin:0 0 0 18px' },
              ...sinCuenta.map((p) => h('li', { class: 'small', text: `${fullName(p)} — ${p.email}` }))),
            h('div', { class: 'notice warn small' },
              'Quien tenga una liga entra a ese expediente. Mándaselas una por una al teléfono del paciente, nunca a un grupo.'));
          if (!(await modal('Generar los accesos que faltan', cuerpo, 'Generar'))) return;
          b2.disabled = true; b2.textContent = 'Generando…';
          const listas = []; const fallos = [];
          for (const p of sinCuenta) {
            try {
              const r = await api.generarAcceso(p.id, 72);
              listas.push({ nombre: fullName(p), correo: p.email, tel: p.phone || null,
                liga: `${location.origin}/acceso.html?t=${r.token}` });
            } catch (e) { fallos.push(`${fullName(p)}: ${e.message}`); }
          }
          const texto = listas.map((x) => `${x.nombre} (${x.correo})\n${x.liga}`).join('\n\n');
          salidaMasiva.innerHTML = ''; salidaMasiva.style.display = '';
          salidaMasiva.append(
            h('div', { class: 'notice small' }, h('b', { text: `${listas.length} liga(s) generada(s). ` }),
              'Vencen en 3 días. Cada una es personal.'),
            ...listas.map((x) => h('div', { class: 'row-card' },
              h('div', { class: 'row-top' }, h('strong', { text: x.nombre }),
                h('span', { class: 'grow muted small', text: x.correo })),
              h('p', { class: 'muted small', style: 'word-break:break-all;margin:4px 0 6px', text: x.liga }),
              h('div', { class: 'row-actions' },
                x.tel ? h('a', { class: 'btn btn-primary btn-sm', target: '_blank', rel: 'noopener',
                  href: `${waLink(x.tel)}?text=${encodeURIComponent(`Hola ${x.nombre.split(' ')[0]}, aquí está tu acceso a RenovitIA: ${x.liga} La liga es sólo para ti y se vence en 3 días.`)}`,
                  text: 'WhatsApp' }) : null,
                h('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: 'Copiar liga',
                  onclick: async () => { try { await navigator.clipboard.writeText(x.liga); toast('Copiada'); } catch { toast('No se pudo copiar', true); } } })))),
            h('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: 'Copiar las ' + listas.length + ' ligas',
              onclick: async () => { try { await navigator.clipboard.writeText(texto); toast('Copiadas'); } catch { toast('No se pudo copiar', true); } } }),
            ...(fallos.length ? [h('div', { class: 'notice danger small' },
              h('b', { text: 'No se pudo con: ' }), fallos.join(' · '))] : []));
          b2.disabled = false; b2.textContent = 'Volver a generar';
        } }) : null,
      h('button', { class: 'btn btn-primary btn-sm', type: 'button', text: '+ Invitar paciente', onclick: () => inviteDialog(() => route()) }))));
  root.append(salidaMasiva);

  const search = h('input', { class: 'input', type: 'search', placeholder: 'Buscar por nombre o correo', style: 'max-width:320px' });
  root.append(h('div', { class: 'toolbar', style: 'margin-bottom:12px' }, search));
  const wrap = h('div', { class: 'table-wrap' });
  root.append(wrap);

  const draw = () => {
    const term = search.value.trim().toLowerCase();
    const table = h('table', { class: 'data' });
    table.append(h('thead', {}, h('tr', {}, ...['Paciente', 'Programa', 'Historia clínica', 'Alertas abiertas', 'Última actividad', isAdmin() ? 'Médico' : null].filter(Boolean).map((t) => h('th', { text: t })))));
    const tb = h('tbody');
    const rows = patients.filter((p) => !term || fullName(p).toLowerCase().includes(term) || (p.email || '').includes(term));
    if (!rows.length) tb.append(h('tr', {}, h('td', { colspan: 6, class: 'empty-state', text: 'Sin pacientes todavía. Invita al primero.' })));
    rows.forEach((p) => {
      const it = intakes.find((i) => i.patient_id === p.id);
      const open = alerts.filter((a) => a.patient_id === p.id && ['open', 'acknowledged'].includes(a.status));
      const counts = h('div', { class: 'row-top' },
        ...['urgent', 'block', 'prioritize'].map((l) => { const n = open.filter((a) => a.level === l).length; return n ? badge(l, `${n} ${l === 'urgent' ? 'urg.' : l === 'block' ? 'consulta' : 'prior.'}`) : null; }));
      const st = it ? INTAKE_STATUS[it.status] : ['Sin iniciar', 'neutral'];
      const tr = h('tr', { class: 'clickable', tabindex: 0, onclick: () => { location.hash = `#/paciente/${p.id}`; }, onkeydown: (e) => { if (e.key === 'Enter') location.hash = `#/paciente/${p.id}`; } },
        h('td', {}, h('strong', { text: fullName(p) }), h('div', { class: 'muted small', text: p.email || '' })),
        h('td', { text: PATIENT_STATUS[p.status] || p.status }),
        h('td', {}, badge(st[1], st[0])),
        h('td', {}, open.length ? counts : h('span', { class: 'muted', text: '—' })),
        h('td', { class: 'muted small', text: ago(it?.submitted_at || it?.started_at || p.updated_at) }),
        isAdmin() ? h('td', { class: 'small', text: docName[p.assigned_physician_id] || 'Sin asignar' }) : null);
      tb.append(tr);
    });
    table.append(tb);
    wrap.innerHTML = ''; wrap.append(table);
  };
  search.oninput = draw;
  draw();
}

async function viewPatient(root, id) {
  setNav('pacientes');
  const d = await api.patient(id);
  const { patient: p, intake } = d;
  const byId = new Map(d.answers.map((a) => [a.question_id, a.value]));
  const ans = (code) => { const q = d.questions.find((x) => x.question_code === code); return q ? byId.get(q.id) : undefined; };
  const age = ageFrom(p.birth_date || ans('A2'));
  const sex = p.sex_at_birth === 'F' || String(ans('A3') || '').startsWith('F') ? 'Femenino' : (p.sex_at_birth === 'M' || String(ans('A3') || '').startsWith('M') ? 'Masculino' : '—');

  root.append(h('div', { class: 'page-head' },
    h('div', {}, h('a', { href: '#/pacientes', class: 'small', text: '← Pacientes' }), h('h1', { text: fullName(p) })),
    h('div', { class: 'toolbar' }, intake ? badge(INTAKE_STATUS[intake.status][1], INTAKE_STATUS[intake.status][0]) : badge('neutral', 'Sin historia clínica'))));

  const side = h('div', { class: 'side' });
  const main = h('div');
  root.append(h('div', { class: 'detail-grid' }, side, main));

  // Datos
  const c1 = ans('C1') || {};
  const bmi = c1.peso_kg && c1.estatura_cm ? (c1.peso_kg / (c1.estatura_cm / 100) ** 2).toFixed(1) : null;
  side.append(h('div', { class: 'card' }, h('h2', { class: 'card-title', text: 'Datos' }),
    h('dl', { class: 'kv' },
      h('dt', { text: 'Edad' }), h('dd', { text: age ?? '—' }),
      h('dt', { text: 'Sexo' }), h('dd', { text: sex }),
      h('dt', { text: 'Correo' }), h('dd', { text: p.email || '—' }),
      h('dt', { text: 'Teléfono' }), h('dd', {}, p.phone ? [h('a', { href: `tel:${p.phone}`, text: p.phone }), ' · ', h('a', { href: waLink(p.phone), target: '_blank', rel: 'noopener', text: 'WhatsApp' })] : '—'),
      h('dt', { text: 'Peso / IMC' }), h('dd', { text: c1.peso_kg ? `${c1.peso_kg} kg · IMC ${bmi}` : '—' }),
      h('dt', { text: 'Programa' }), h('dd', { text: PATIENT_STATUS[p.status] || p.status }),
      h('dt', { text: 'Objetivos' }), h('dd', { text: fmtAnswer({ question_code: 'B1' }, ans('B1')) || '—' }))));

  // Acceso del paciente: una liga de un solo uso que se manda por WhatsApp.
  // Evita depender del correo, que en el piloto fue el punto que fallaba.
  side.append(tarjetaRiesgoCV(p));
  side.append(tarjetaAcceso(p));

  // Puntajes
  const SC_NAMES = { PHQ9: 'Depresión (PHQ-9)', GAD7: 'Ansiedad (GAD-7)', PSS10: 'Estrés (PSS-10)', STOPBANG: 'Apnea (STOP-BANG)', AUDITC: 'Alcohol (AUDIT-C)', SCOFF: 'TCA (SCOFF)', PARQ: 'Ejercicio (PAR-Q+)', ADAM: 'Andropausia (ADAM)', MRS: 'Climaterio (MRS)', IPAQ: 'Actividad (MET-min)', IMC: 'IMC', CINTURA_ESTATURA: 'Cintura/estatura' };
  const scores = h('div', { class: 'scores' });
  if (!d.scores.length) scores.append(h('span', { class: 'muted small', text: 'Se calculan al enviar la historia clínica.' }));
  d.scores.sort((a, b) => Object.keys(SC_NAMES).indexOf(a.instrument) - Object.keys(SC_NAMES).indexOf(b.instrument)).forEach((s) => {
    scores.append(h('span', { text: SC_NAMES[s.instrument] || s.instrument }), h('span', {}, h('strong', { text: s.score }), ' ', h('span', { class: 'cat', text: s.category })));
  });
  side.append(h('div', { class: 'card' }, h('h2', { class: 'card-title', text: 'Puntajes' }), scores));

  // Revisión
  if (intake) {
    const notes = h('textarea', { class: 'input', rows: 4, placeholder: 'Notas de revisión (visibles sólo para el equipo clínico)' });
    notes.value = intake.review_notes || '';
    const save = async (status) => {
      const patch = { review_notes: notes.value };
      if (status) Object.assign(patch, { status, reviewed_by: S.me.physician ? S.me.id : intake.reviewed_by, reviewed_at: status === 'reviewed' ? new Date().toISOString() : intake.reviewed_at });
      try { await api.updateIntake(intake.id, patch); toast(status === 'reviewed' ? 'Historia marcada como revisada' : 'Guardado'); route(); } catch (e) { toast(`Error: ${e.message}`, true); }
    };
    const openUrgent = d.alerts.filter((a) => a.level === 'urgent' && ['open', 'acknowledged'].includes(a.status)).length;
    side.append(h('div', { class: 'card stack' }, h('h2', { class: 'card-title', text: 'Revisión médica' }),
      h('div', { class: 'small muted', text: intake.submitted_at ? `Enviada ${ago(intake.submitted_at)}` : 'El paciente aún no la envía' }),
      notes,
      h('div', { class: 'row-actions' },
        h('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: 'Guardar notas', onclick: () => save(null) }),
        intake.status === 'submitted' ? h('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: 'En revisión', onclick: () => save('in_review') }) : null,
        ['submitted', 'in_review'].includes(intake.status) ? h('button', { class: 'btn btn-primary btn-sm', type: 'button', text: 'Marcar revisada', disabled: openUrgent > 0 ? true : null, title: openUrgent ? 'Resuelve primero las alertas urgentes' : null, onclick: () => save('reviewed') }) : null),
      openUrgent ? h('div', { class: 'notice danger small', text: `${openUrgent} alerta(s) urgente(s) sin resolver.` }) : null,
      intake.status !== 'in_progress' ? h('button', { class: 'btn-link small', type: 'button', text: 'Volver a evaluar reglas', onclick: async () => {
        try { const r = await api.reevaluate(intake.id); toast(`Reevaluado · ${r?.new_alerts ?? 0} alerta(s) nueva(s)`); route(); } catch (e) { toast(`Error: ${e.message}`, true); }
      } }) : null));
  }

  // Consentimientos
  const CONS = { privacy_notice: 'Aviso de privacidad', international_transfer: 'Transferencia internacional', informed_consent: 'Consentimiento informado', data_sharing: 'Compartir con laboratorio' };
  side.append(h('div', { class: 'card' }, h('h2', { class: 'card-title', text: 'Consentimientos' }),
    d.consents.length ? h('div', { class: 'list' }, ...d.consents.map((c) => h('div', { class: 'row-top small' }, badge(c.accepted && !c.revoked_at ? 'ok' : 'urgent', c.accepted && !c.revoked_at ? 'Sí' : 'No'), h('span', { text: CONS[c.consent_type] || c.consent_type }))))
      : h('span', { class: 'muted small', text: 'Pendientes' })));

  // Pestañas
  const openAlerts = d.alerts.filter((a) => ['open', 'acknowledged'].includes(a.status));
  const tabs = h('div', { class: 'tabs', role: 'tablist' });
  const panel = h('div');
  const TABS = [['alertas', `Alertas (${openAlerts.length} abiertas)`], ['estudios', 'Estudios'], ['plan', 'Plan'], ['respuestas', 'Respuestas']];
  const drawTab = () => {
    tabs.innerHTML = '';
    TABS.forEach(([k, t]) => tabs.append(h('button', { type: 'button', role: 'tab', class: S.patientTab === k ? 'active' : '', 'aria-selected': S.patientTab === k ? 'true' : 'false', text: t, onclick: () => { S.patientTab = k; drawTab(); } })));
    panel.innerHTML = '';
    if (S.patientTab === 'plan') {
      renderPlanTab(panel, { h, badge, modal, toast, api, patient: p, me: S.me, demo: DEMO, refresh: () => route() });
    } else if (S.patientTab === 'estudios') {
      renderStudiesTab(panel, { h, badge, modal, toast, api, patient: p, sex: sex === 'Femenino' ? 'F' : sex === 'Masculino' ? 'M' : null, me: S.me, demo: DEMO, refresh: null, isAdmin: isAdmin() });
    } else if (S.patientTab === 'alertas') {
      const order = { urgent: 0, block: 1, prioritize: 2 };
      const list = h('div', { class: 'list' });
      const rows = [...d.alerts].sort((a, b) => (['resolved', 'dismissed'].includes(a.status) - ['resolved', 'dismissed'].includes(b.status)) || order[a.level] - order[b.level]);
      if (!rows.length) list.append(h('div', { class: 'empty-state', text: intake?.status === 'in_progress' ? 'Las reglas completas se evalúan cuando el paciente envía su historia clínica.' : 'Sin alertas.' }));
      rows.forEach((a) => list.append(alertCard(a, { showPatient: false, onChange: () => route() })));
      panel.append(list);
    } else {
      if (!intake) { panel.append(h('div', { class: 'empty-state', text: 'El paciente aún no inicia su historia clínica.' })); return; }
      const flagged = new Map();
      d.alerts.filter((a) => ['open', 'acknowledged'].includes(a.status)).forEach((a) => {
        const code = (a.rule_code || '').split('_')[0];
        if (code && (!flagged.has(code) || a.level === 'urgent')) flagged.set(code, a.level);
      });
      const nPend = d.questions.filter((q) => byId.get(q.id)?.skipped === true).length;
      const onlyAnswered = h('input', { type: 'checkbox', checked: true });
      const box = h('div');
      const drawAnswers = () => {
        box.innerHTML = '';
        d.sections.forEach((s, idx) => {
          const qs = d.questions.filter((q) => q.section_id === s.id);
          const rows = qs.map((q) => ({ q, text: fmtAnswer(q, byId.get(q.id)) })).filter((r) => !onlyAnswered.checked || r.text);
          if (!rows.length) return;
          const nFlags = rows.filter((r) => flagged.has(r.q.question_code)).length;
          const det = h('details', { class: 'answers-section card', open: idx < 4 || nFlags > 0 ? true : null },
            h('summary', {}, `${s.section_code}. ${s.title.replace(/\s*\(sólo si .*\)$/i, '')}`, nFlags ? badge('block', `${nFlags} con alerta`) : null));
          rows.forEach(({ q, text }) => {
            const lvl = flagged.get(q.question_code);
            det.append(h('div', { class: `ans ${lvl ? (lvl === 'urgent' ? 'flag-urgent' : 'flag') : ''}` },
              h('div', { class: 'q' }, h('span', { class: 'small', text: `${q.question_code} · ` }), q.prompt),
              h('div', { class: 'a' }, text ?? h('span', { class: 'empty', text: 'Sin respuesta' }))));
          });
          box.append(det);
        });
      };
      onlyAnswered.onchange = drawAnswers;
      if (nPend) panel.append(h('p', { class: 'notice warn small', text: `El paciente dejó ${nPend} pregunta(s) pendientes; aparecen marcadas como "Pendiente". Conviene completarlas en la consulta.` }));
      panel.append(h('label', { class: 'small muted', style: 'display:flex;gap:6px;align-items:center;margin-bottom:10px' }, onlyAnswered, 'Sólo preguntas respondidas'), box);
      drawAnswers();
    }
  };
  main.append(tabs, panel);
  drawTab();
}

function updateAlertCount(alerts) {
  const n = alerts.filter((a) => a.level === 'urgent' && ['open', 'acknowledged'].includes(a.status)).length;
  $('nav-alert-count').textContent = n;
  $('nav-alert-count').classList.toggle('hidden', !n);
}

/* ================= router ================= */
// Semaforo de riesgo cardiovascular con la ecuacion PREVENT de la AHA.
// Si falta un dato, lo dice y NO inventa un numero: una cifra de riesgo
// calculada a medias es peor que no tenerla.
const COLOR_CV = { verde: 'verde', amarillo: 'amarillo', naranja: 'amarillo', rojo: 'rojo' };

function tarjetaRiesgoCV(p) {
  const caja = h('div', { class: 'card stack' }, h('h2', { class: 'card-title', text: 'Riesgo cardiovascular' }));
  const cuerpo = h('div', { class: 'stack' }, h('div', { class: 'spinner' }));
  caja.append(cuerpo);

  const capturaPA = () => h('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: 'Capturar presión arterial',
    onclick: async () => {
      const sis = h('input', { class: 'input', type: 'number', inputmode: 'numeric', min: 60, max: 260, placeholder: '120' });
      const dia = h('input', { class: 'input', type: 'number', inputmode: 'numeric', min: 30, max: 180, placeholder: '80' });
      const campo = (l, el) => h('label', { class: 'field' }, h('span', { class: 'field-label small', text: l }), el);
      const ok = await modal('Presión arterial', h('div', { class: 'stack' },
        h('div', { class: 'fields-grid' }, campo('Sistólica', sis), campo('Diastólica', dia)),
        h('p', { class: 'muted small', text: 'Tomada sentado, tras 5 minutos de reposo. Es el dato que más mueve el cálculo de riesgo.' })), 'Guardar');
      if (!ok) return;
      const n = Number(sis.value);
      if (!n || n < 60 || n > 260) { toast('La sistólica no parece válida', true); return; }
      try {
        await api.guardarVitales(p.id, { sbp: n, dbp: dia.value ? Number(dia.value) : null });
        toast('Presión guardada');
        pinta();
      } catch (e) { toast(`Error: ${e.message}`, true); }
    } });

  async function pinta() {
    cuerpo.innerHTML = '';
    let r;
    try { r = await api.riesgoCV(p.id); }
    catch (e) { cuerpo.append(h('p', { class: 'muted small', text: e.message })); return; }

    if (!r || r.calculable === false) {
      cuerpo.append(
        h('p', { class: 'muted small', style: 'margin:0' }, 'No se puede calcular todavía. Falta: ',
          h('b', { text: (r?.falta || []).join(', ') }), '.'),
        h('div', { class: 'toolbar' }, capturaPA()));
      (r?.potenciadores || []).forEach((t) => cuerpo.append(h('div', { class: 'notice warn small', text: t })));
      return;
    }

    cuerpo.append(
      h('div', { style: 'display:flex;align-items:center;gap:12px' },
        h('span', { class: `pill ${COLOR_CV[r.color] || ''}`, style: 'font-size:1.5rem;font-weight:800;padding:8px 14px', text: `${r.pct}%` }),
        h('div', {}, h('b', { text: r.banda }),
          h('div', { class: 'muted small', text: 'a 10 años · ' + r.modelo }))),
      h('p', { class: 'muted small', style: 'margin:0' },
        `Sistólica ${r.entradas.sistolica}, colesterol total ${r.entradas.colesterol_total}, HDL ${r.entradas.hdl}, eGFR ${r.entradas.egfr}.`,
        r.entradas.diabetes ? ' Diabetes.' : '', r.entradas.fuma ? ' Fuma.' : '',
        r.entradas.antihipertensivo ? ' Con antihipertensivo.' : '', r.entradas.estatina ? ' Con estatina.' : ''));

    if (!r.bandas_firmadas) {
      cuerpo.append(h('div', { class: 'notice warn small' },
        h('b', { text: 'Los cortes de color no están firmados. ' }),
        'El porcentaje viene de la ecuación oficial; los rangos que lo pintan de un color u otro los tiene que revisar un médico.'));
    }
    (r.potenciadores || []).forEach((t) => cuerpo.append(h('div', { class: 'notice danger small' },
      h('b', { text: 'Ojo: ' }), t)));
    cuerpo.append(h('div', { class: 'toolbar' }, capturaPA()));
  }

  pinta();
  return caja;
}

// Genera la liga de acceso del paciente y deja listo el mensaje de WhatsApp.
function tarjetaAcceso(p) {
  const caja = h('div', { class: 'card stack' }, h('h2', { class: 'card-title', text: 'Acceso del paciente' }));
  const estado = h('p', { class: 'muted small', style: 'margin:0',
    text: p.user_id ? 'Ya tiene cuenta y puede entrar desde su teléfono.' : 'Todavía no ha entrado nunca.' });
  const salida = h('div', { class: 'stack', style: 'display:none' });

  const btn = h('button', { class: 'btn btn-primary btn-sm', type: 'button', text: 'Generar liga de acceso',
    onclick: async () => {
      if (!p.email) { toast('Este paciente no tiene correo capturado', true); return; }
      const texto = h('div', { class: 'stack' },
        h('p', { text: `Se crea una liga de un solo uso para ${fullName(p)}.` }),
        h('p', { class: 'small' }, 'Dura ', h('b', { text: '72 horas' }), ' y se desactiva en cuanto la usa. ',
          'Si ya había una sin usar, queda cancelada.'),
        h('div', { class: 'notice warn small' },
          'Quien tenga la liga entra a su expediente. Mándala sólo al teléfono del paciente, no a un grupo.'));
      if (!(await modal('Generar acceso', texto, 'Generar'))) return;
      btn.disabled = true; btn.textContent = 'Generando…';
      try {
        const r = await api.generarAcceso(p.id, 72);
        const liga = `${location.origin}/acceso.html?t=${r.token}`;
        const mensaje = `Hola ${r.nombre || ''}, soy del equipo de RenovitIA. `
          + `Aquí está tu acceso a la app, con tu plan y tus indicaciones del día: ${liga}\n\n`
          + `La liga es sólo para ti y se vence en 3 días. Al abrirla, agrégala a tu pantalla de inicio para tenerla a la mano.`;
        salida.innerHTML = '';
        salida.style.display = '';
        salida.append(
          h('div', { class: 'notice small' }, h('b', { text: 'Liga lista. ' }),
            `Vence el ${new Date(r.expira).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}.`),
          h('div', { class: 'toolbar' },
            p.phone ? h('a', { class: 'btn btn-primary btn-sm', target: '_blank', rel: 'noopener',
              href: `${waLink(p.phone)}?text=${encodeURIComponent(mensaje)}`, text: 'Mandar por WhatsApp' }) : null,
            h('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: 'Copiar liga',
              onclick: async () => { try { await navigator.clipboard.writeText(liga); toast('Liga copiada'); } catch { toast('Copia la liga de abajo', true); } } }),
            h('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: 'Copiar mensaje',
              onclick: async () => { try { await navigator.clipboard.writeText(mensaje); toast('Mensaje copiado'); } catch { toast('No se pudo copiar', true); } } })),
          h('p', { class: 'muted small', style: 'word-break:break-all;margin:0', text: liga }),
          p.phone ? null : h('p', { class: 'muted small', style: 'margin:0', text: 'Este paciente no tiene teléfono capturado: copia la liga y mándasela como prefieras.' }));
      } catch (e) { toast(`Error: ${e.message}`, true); }
      finally { btn.disabled = false; btn.textContent = 'Generar liga de acceso'; }
    } });

  caja.append(estado, h('div', { class: 'toolbar' }, btn), salida);
  return caja;
}

async function route() {
  const app = $('view-app');
  const hash = location.hash || '#/alertas';
  const [, name, id] = hash.split('/');
  const fresh = h('div');
  try {
    if (name === 'paciente' && id) await viewPatient(fresh, id);
    else if (name === 'pacientes') await viewPatients(fresh);
    else if (name === 'rangos') await viewRanges(fresh, { h, badge, modal, toast, api, me: S.me, setNav });
    else await viewAlerts(fresh);
    app.innerHTML = ''; app.append(fresh);
    if (name !== 'alertas' && !(hash === '#/alertas' || !location.hash)) api.alerts().then(updateAlertCount).catch(() => {});
  } catch (e) {
    console.error(e);
    app.innerHTML = '';
    app.append(h('div', { class: 'notice danger', text: `No se pudo cargar: ${e.message || e}` }));
  }
}

/* ================= inicio ================= */
function show(id) { ['loading', 'view-login', 'view-denied', 'view-app'].forEach((v) => $(v).classList.toggle('hidden', v !== id)); }

const msgOk = (el, t) => { el.className = 'notice'; el.textContent = t; };
const msgErr = (el, t) => { el.className = 'notice danger'; el.textContent = t; };

$('form-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('login-email').value.trim().toLowerCase();
  const pass = $('login-pass').value;
  const msg = $('login-msg');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return msgErr(msg, 'Escribe un correo válido.');
  if (!pass) return msgErr(msg, 'Escribe tu contraseña.');
  $('btn-login').disabled = true;
  msgOk(msg, 'Entrando…');
  const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
  $('btn-login').disabled = false;
  if (error) {
    return msgErr(msg, /invalid/i.test(error.message)
      ? 'Correo o contraseña incorrectos. Si nunca creaste una, usa "Crear o cambiar mi contraseña".'
      : `No pudimos entrar: ${error.message}`);
  }
  location.reload();
});

$('btn-show-code').addEventListener('click', () => {
  $('form-login').classList.add('hidden');
  $('form-code').classList.remove('hidden');
  $('code-email').value = $('login-email').value;
});
$('btn-back-login').addEventListener('click', () => {
  $('form-code').classList.add('hidden');
  $('form-login').classList.remove('hidden');
});

$('form-code').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('code-email').value.trim().toLowerCase();
  const code = $('code-code').value.trim().toUpperCase();
  const pass = $('code-pass').value;
  const msg = $('code-msg');
  if (pass.length < 10) return msgErr(msg, 'La contraseña debe tener al menos 10 caracteres.');
  $('btn-code').disabled = true;
  msgOk(msg, 'Guardando…');
  const { error } = await supabase.rpc('set_staff_password', { p_email: email, p_code: code, p_password: pass });
  if (error) { $('btn-code').disabled = false; return msgErr(msg, error.message); }
  const { error: e2 } = await supabase.auth.signInWithPassword({ email, password: pass });
  $('btn-code').disabled = false;
  if (e2) return msgErr(msg, 'Contraseña guardada, pero no pudimos entrar. Intenta desde la pantalla anterior.');
  location.reload();
});

$('btn-magic').addEventListener('click', async () => {
  const email = $('login-email').value.trim().toLowerCase();
  const msg = $('login-msg');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return msgErr(msg, 'Escribe primero tu correo.');
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: new URL('medico.html', location.href).href, shouldCreateUser: false } });
  if (error) return msgErr(msg, error.status === 429 ? 'Demasiados intentos; espera unos minutos.' : 'No pudimos enviar el enlace.');
  msgOk(msg, `Si ese correo está dado de alta, llegará un enlace a ${email}. Ojo: el correo tarda o cae en spam.`);
});

// Cambiar la contraseña ya dentro del panel
$('btn-pass')?.addEventListener('click', async () => {
  const campo = h('label', { class: 'field' },
    h('span', { class: 'field-label', text: 'Nueva contraseña (mínimo 10 caracteres)' }),
    h('input', { class: 'input', type: 'password', autocomplete: 'new-password', id: 'nueva-pass' }));
  if (!(await modal('Cambiar contraseña', h('div', { class: 'stack' }, campo), 'Guardar'))) return;
  const nueva = document.getElementById('nueva-pass')?.value || '';
  if (nueva.length < 10) { toast('La contraseña debe tener al menos 10 caracteres', true); return; }
  const { error } = await supabase.auth.updateUser({ password: nueva });
  toast(error ? `No se pudo cambiar: ${error.message}` : 'Contraseña actualizada', !!error);
});

$('btn-logout').addEventListener('click', async () => { if (!DEMO) await supabase.auth.signOut(); location.href = 'medico.html'; });

let starting = false;
async function start() {
  if (starting) return; starting = true;
  try {
    S.me = await api.me();
    if (!S.me) { starting = false; show('view-login'); return; }
    if (!S.me.roles.some((r) => r === 'physician' || r === 'admin')) { $('denied-email').textContent = S.me.email; $('btn-logout').classList.remove('hidden'); show('view-denied'); return; }
    $('who-name').textContent = S.me.physician?.full_name || S.me.email;
    $('btn-logout').classList.remove('hidden');
    if (!DEMO) $('btn-pass').classList.remove('hidden');
    $('nav').classList.remove('hidden');
    if (DEMO) $('demo-banner').classList.remove('hidden');
    show('view-app');
    await route();
    window.addEventListener('hashchange', route);
    if (!DEMO) setInterval(() => { if (!document.hidden && $('modal').classList.contains('hidden') && (location.hash || '#/alertas') === '#/alertas') route(); }, 60000);
  } catch (e) {
    console.error(e);
    $('error').textContent = `Error: ${e.message || e}`;
    $('error').classList.remove('hidden');
    $('loading').classList.add('hidden');
  }
}
if (!DEMO) supabase.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_IN' && !S.me) start(); });
start();
