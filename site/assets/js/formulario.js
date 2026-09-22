import { supabase, isDemo, applyBranding } from './supabase.js';
import { CONFIG } from './config.js';
import { INSTRUMENTS, instrumentKey, scoreInstrument } from './instruments.js';
import { OVERRIDES, FAMILY_COLUMNS } from './overrides.js';
import { SKIPPED, isSkipped, cardGroup, sliderControl, instrumentStepper, symptomsControl, alarmControl, gridControl } from './mobile-ui.js';

applyBranding();
const $ = (id) => document.getElementById(id);
const DEMO = isDemo();

const state = {
  patient: null,
  intake: null,
  sections: [],
  questions: [],          // ordenadas
  byCode: new Map(),      // question_code -> question
  answers: new Map(),     // question_id -> value
  index: 0,
  timers: new Map(),
  pending: 0,
  shownAlerts: new Set(),
};

/* ================= utilidades DOM ================= */
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c !== null && c !== undefined) el.append(c.nodeType ? c : document.createTextNode(c));
  return el;
}
const uid = (() => { let n = 0; return (p = 'f') => `${p}-${++n}`; })();
const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

function splitList(text) {
  return text.split(/\s*,\s*|\s+·\s+/).map((s) => s.replace(/[¿?().]/g, '').trim()).filter(Boolean);
}
function optionsFromHint(hint) {
  const base = String(hint || '').split(' + ')[0];
  const sep = base.includes(' · ') ? ' · ' : ' / ';
  return base.split(sep).map((s) => s.trim()).filter(Boolean);
}
function itemsFromPrompt(prompt) {
  const i = prompt.indexOf(':');
  if (i >= 0) return splitList(prompt.slice(i + 1));
  const m = prompt.match(/\(([^)]+)\)/);
  return m ? splitList(m[1]) : [];
}

/* ================= carga ================= */
async function loadDemo() {
  const res = await fetch('assets/data/form-v0.2.demo.json');
  const data = await res.json();
  state.intake = { id: 'demo', status: 'in_progress', template_id: data.template.id };
  state.sections = data.sections;
  state.questions = data.questions;
  $('demo-banner').classList.remove('hidden');
}

async function loadLive() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { location.href = 'index.html'; return false; }

  const { data: patient, error: pErr } = await supabase.rpc('claim_patient_invitation');
  if (pErr || !patient) { location.href = 'index.html'; return false; }
  state.patient = patient;

  const { data: intake, error: iErr } = await supabase.rpc('start_or_resume_intake');
  if (iErr) throw iErr;
  state.intake = intake;

  const [secRes, qRes, aRes] = await Promise.all([
    supabase.from('form_sections').select('*').eq('template_id', intake.template_id).order('sort_order'),
    supabase.from('form_questions').select('*').eq('template_id', intake.template_id).order('sort_order'),
    supabase.from('intake_answers').select('question_id,value').eq('intake_id', intake.id),
  ]);
  if (secRes.error) throw secRes.error;
  if (qRes.error) throw qRes.error;
  if (aRes.error) throw aRes.error;
  state.sections = secRes.data;
  state.questions = qRes.data;
  aRes.data.forEach((a) => state.answers.set(a.question_id, a.value));
  return true;
}

function indexQuestions() {
  const order = new Map(state.sections.map((s) => [s.id, s.sort_order]));
  state.questions.sort((a, b) => (order.get(a.section_id) - order.get(b.section_id)) || (a.sort_order - b.sort_order));
  state.questions.forEach((q) => state.byCode.set(q.question_code, q));
}

function prefill() {
  if (!state.patient) return;
  const set = (code, v) => { const q = state.byCode.get(code); if (q && !state.answers.has(q.id)) { state.answers.set(q.id, v); queueSave(q); } };
  set('A1', `${state.patient.first_name} ${state.patient.last_name}`.trim());
  if (state.patient.email || state.patient.phone) set('A5', { telefono: state.patient.phone || '', correo: state.patient.email || '' });
  if (state.patient.birth_date) set('A2', state.patient.birth_date);
  if (state.patient.sex_at_birth) set('A3', state.patient.sex_at_birth === 'F' ? 'Femenino' : 'Masculino');
}

/* ================= respuestas y guardado ================= */
const answerOf = (code) => { const q = state.byCode.get(code); return q ? state.answers.get(q.id) : undefined; };

function setAnswer(q, value) {
  state.answers.set(q.id, value);
  q._el?.classList.remove('invalid');
  checkSafety(q, value);
  queueSave(q);
  updateProgress();
}

function queueSave(q) {
  if (DEMO) { $('save-status').textContent = 'Vista previa'; return; }
  clearTimeout(state.timers.get(q.id));
  $('save-status').textContent = 'Guardando…';
  state.timers.set(q.id, setTimeout(() => saveNow(q), 600));
}

async function saveNow(q) {
  state.timers.delete(q.id);
  state.pending++;
  const value = state.answers.get(q.id);
  const { error } = await supabase.from('intake_answers').upsert(
    { intake_id: state.intake.id, question_id: q.id, value: value ?? null, updated_at: new Date().toISOString() },
    { onConflict: 'intake_id,question_id' },
  );
  state.pending--;
  if (error) {
    console.error(error);
    $('save-status').textContent = 'No se pudo guardar. Revisa tu conexión.';
    return;
  }
  if (state.pending === 0 && state.timers.size === 0) $('save-status').textContent = 'Guardado';
}

async function flushSaves() {
  const ids = [...state.timers.keys()];
  await Promise.all(ids.map((id) => { clearTimeout(state.timers.get(id)); return saveNow(state.questions.find((q) => q.id === id)); }));
}

function isAnswered(q, v) {
  if (v === undefined || v === null || v === '' || isSkipped(v)) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v !== 'object') return true;
  if (q.answer_type === 'instrument') {
    const key = instrumentKey(q);
    const def = INSTRUMENTS[key];
    if (!def) return true;
    const n = def.perItemScale ? def.perItemScale.length : def.items.length;
    return (v.items || []).filter((x) => x !== null && x !== undefined).length >= n;
  }
  if ('members' in v) return v.members.length > 0 || !!v.none || !!v.unknown;
  if (v.selected) return v.selected.length > 0 || !!v.none || !!v.other;
  if (v.items && !Array.isArray(v.items)) {
    const ov = OVERRIDES[q.question_code];
    return ov?.items ? Object.keys(v.items).length >= ov.items.length : Object.keys(v.items).length > 0;
  }
  if ('value' in v) return v.value !== '' && v.value !== null && v.value !== undefined;
  if ('accepted' in v) return v.accepted === true && !!v.name;
  return Object.values(v).some((x) => x !== '' && x !== null && x !== undefined && !(Array.isArray(x) && !x.length));
}

const answered = (q) => isAnswered(q, state.answers.get(q.id));
const skipped = (q) => isSkipped(state.answers.get(q.id));
const isResolved = (q) => answered(q) || skipped(q);
const canSkip = (q) => q.options?.skippable === true && !q.is_required;
const itemsOf = (q) => q.options?.items || OVERRIDES[q.question_code]?.items || itemsFromPrompt(q.prompt);
const skipQuestion = (q) => setAnswer(q, { ...SKIPPED });
const unskip = (q) => { state.answers.delete(q.id); queueSave(q); };

/* ================= seguridad (cliente) ================= */
// Aviso inmediato al paciente. La alerta al médico la genera el backend al evaluar reglas (pendiente).
function checkSafety(q, v) {
  const code = q.question_code;
  if (code === 'P3' && v?.items?.[0] > 0) {
    showAlert('P3', 'Queremos que estés a salvo',
      `<p>Nos dijiste que has tenido pensamientos de hacerte daño. No estás solo(a).</p>
       <p>Llama ahora a la <strong>Línea de la Vida</strong> (gratuita, 24 h):</p>
       <p class="phone"><a href="tel:${CONFIG.CRISIS_LINE.replace(/\s/g, '')}">${CONFIG.CRISIS_LINE}</a></p>
       <p>Si estás en peligro inmediato llama al <a href="tel:${CONFIG.EMERGENCY}">${CONFIG.EMERGENCY}</a> o acude a urgencias. Tu médico del programa revisará tu caso.</p>`);
  }
  if (code === 'M11' && v?.items && Object.values(v.items).includes('Sí')) {
    showAlert('M11', 'Busca atención médica hoy',
      `<p>Uno o más de los síntomas que marcaste requieren valoración médica el mismo día.</p>
       <p>Si es intenso o empeora, llama al <a href="tel:${CONFIG.EMERGENCY}"><strong>${CONFIG.EMERGENCY}</strong></a> o acude a urgencias.</p>`);
  }
  if (code === 'C4' && v && (Number(v.sistolica) >= 180 || Number(v.diastolica) >= 110)) {
    showAlert('C4', 'Presión arterial muy alta',
      `<p>Una presión de ${v.sistolica || '?'}/${v.diastolica || '?'} requiere valoración médica pronto.</p>
       <p>Si tienes dolor de cabeza intenso, dolor en el pecho, falta de aire o cambios en la visión, llama al <a href="tel:${CONFIG.EMERGENCY}"><strong>${CONFIG.EMERGENCY}</strong></a>.</p>`);
  }
}
function showAlert(key, title, html) {
  if (state.shownAlerts.has(key)) return;
  state.shownAlerts.add(key);
  $('modal-title').textContent = title;
  $('modal-title').classList.remove('neutral');
  $('modal-body').innerHTML = html;
  $('modal').classList.remove('hidden');
  $('modal-close').focus();
}
$('modal-close').addEventListener('click', () => $('modal').classList.add('hidden'));

/* ================= controles ================= */
function chipGroup(name, options, current, onChange, { multiple = false, column = false } = {}) {
  const wrap = h('div', { class: `choices${column ? ' column' : ''}`, role: multiple ? 'group' : 'radiogroup' });
  const selected = new Set(multiple ? current || [] : [current]);
  options.forEach((opt) => {
    const label = typeof opt === 'object' ? opt.t : opt;
    const value = typeof opt === 'object' ? opt.v : opt;
    const input = h('input', { type: multiple ? 'checkbox' : 'radio', name, value: String(value) });
    input.checked = selected.has(value);
    input.addEventListener('change', () => {
      if (multiple) {
        const vals = [...wrap.querySelectorAll('input:checked')].map((i) => options.find((o) => String(typeof o === 'object' ? o.v : o) === i.value)).map((o) => (typeof o === 'object' ? o.v : o));
        onChange(vals);
      } else onChange(value);
    });
    wrap.append(h('label', { class: 'chip' }, input, h('span', { text: label })));
  });
  return wrap;
}

function textInput(type, value, onInput, attrs = {}) {
  const el = type === 'textarea'
    ? h('textarea', { class: 'input', ...attrs })
    : h('input', { class: 'input', type, ...attrs });
  el.value = value ?? '';
  el.addEventListener('input', () => onInput(el.value));
  return el;
}

function detailBox(label, value, onInput) {
  return h('label', { class: 'field detail' }, h('span', { class: 'field-label small', text: label }), textInput('textarea', value, onInput, { rows: 2 }));
}

function renderFields(q, ov) {
  const v = clone(state.answers.get(q.id)) || {};
  const grid = h('div', { class: 'fields-grid' });
  ov.fields.forEach((f) => {
    const id = uid();
    let ctrl;
    const update = (val) => { v[f.k] = val; setAnswer(q, { ...v }); };
    if (f.t === 'select') {
      ctrl = h('select', { class: 'input', id }, h('option', { value: '', text: 'Selecciona…' }), ...f.o.map((o) => h('option', { value: o, text: o })));
      ctrl.value = v[f.k] ?? '';
      ctrl.addEventListener('change', () => update(ctrl.value));
    } else {
      ctrl = textInput(f.t, v[f.k], (val) => update(f.t === 'number' && val !== '' ? Number(val) : val), {
        id, inputmode: f.t === 'number' ? 'decimal' : null, step: f.step, min: f.min, max: f.max,
      });
    }
    grid.append(h('label', { class: 'field', for: id }, h('span', { class: 'field-label small', text: f.l }), ctrl));
  });
  return grid;
}

function renderMulti(q, options, detailLabel, { allowNone = true, allowOther = true } = {}) {
  const v = clone(state.answers.get(q.id)) || { selected: [], none: false, other: '', detail: '' };
  const body = h('div');
  const detail = detailBox(detailLabel || 'Año de diagnóstico y si está en tratamiento', v.detail, (t) => { v.detail = t; setAnswer(q, { ...v }); });
  const otherInput = textInput('text', v.other, (t) => { v.other = t; if (t) { v.none = false; if (noneInput) noneInput.checked = false; } setAnswer(q, { ...v }); sync(); }, { placeholder: '¿Cuál?' });
  const otherWrap = h('div', { style: 'margin-top:8px' }, otherInput);
  let noneInput = null; let otherToggle = null;
  const sync = () => {
    detail.classList.toggle('hidden', !(v.selected.length || v.other));
    otherWrap.classList.toggle('hidden', !(otherToggle?.checked || v.other));
  };
  const group = chipGroup(q.id, options, v.selected, (vals) => {
    v.selected = vals; if (vals.length) { v.none = false; if (noneInput) noneInput.checked = false; }
    setAnswer(q, { ...v }); sync();
  });
  // "Otro" y "Ninguno" como chips en la misma fila
  if (allowOther) {
    otherToggle = h('input', { type: 'checkbox' });
    otherToggle.checked = !!v.other;
    otherToggle.addEventListener('change', () => {
      if (otherToggle.checked) { v.none = false; if (noneInput) noneInput.checked = false; otherInput.focus(); }
      else { v.other = ''; otherInput.value = ''; setAnswer(q, { ...v }); }
      sync();
    });
    group.append(h('label', { class: 'chip' }, otherToggle, h('span', { text: 'Otro' })));
  }
  if (allowNone) {
    noneInput = h('input', { type: 'checkbox' });
    noneInput.checked = !!v.none;
    noneInput.addEventListener('change', () => {
      v.none = noneInput.checked;
      if (v.none) { v.selected = []; v.other = ''; otherInput.value = ''; group.querySelectorAll('input').forEach((i) => { if (i !== noneInput) i.checked = false; }); }
      setAnswer(q, { ...v }); sync();
    });
    group.append(h('label', { class: 'chip chip-none' }, noneInput, h('span', { text: 'Ninguno' })));
  }
  body.append(group, otherWrap, detail);
  sync();
  return body;
}

function renderInstrument(q) {
  const key = instrumentKey(q);
  const def = INSTRUMENTS[key];
  if (!def) return h('p', { class: 'muted', text: 'Cuestionario no disponible.' });
  const v = clone(state.answers.get(q.id)) || { items: [] };
  const list = h('div', { class: 'items' });
  const rows = def.perItemScale || def.items.map((t) => ({ t, s: def.scale }));
  rows.forEach((row, i) => {
    const group = chipGroup(`${q.id}-${i}`, row.s, v.items[i], (val) => {
      v.items[i] = val;
      v.score = scoreInstrument(key, v.items);
      setAnswer(q, { ...v, items: [...v.items] });
    });
    group.classList.add('scale');
    list.append(h('div', { class: 'item' }, h('p', { class: 'item-text', text: `${i + 1}. ${row.t}` }), group));
  });
  return h('div', {}, def.intro ? h('p', { class: 'q-hint', text: def.intro }) : null, list);
}

function renderYesNoList(q, items) {
  const v = clone(state.answers.get(q.id)) || { items: {} };
  const list = h('div', { class: 'items' });
  items.forEach((item, i) => {
    const group = chipGroup(`${q.id}-${i}`, ['Sí', 'No'], v.items[item], (val) => { v.items[item] = val; setAnswer(q, { items: { ...v.items } }); });
    list.append(h('div', { class: 'item' }, h('p', { class: 'item-text', text: item }), group));
  });
  return list;
}

function renderFamilyMatrix(q) {
  const v = clone(state.answers.get(q.id)) || { members: [], unknown: false, detail: '' };
  const group = chipGroup(q.id, FAMILY_COLUMNS, v.members, (vals) => { v.members = vals; v.none = false; setAnswer(q, { ...v }); sync(); }, { multiple: true });
  const extra = h('div', { class: 'choices', style: 'margin-top:8px' });
  const mk = (label, key) => {
    const input = h('input', { type: 'checkbox' });
    input.checked = !!v[key];
    input.addEventListener('change', () => {
      v[key] = input.checked;
      if (input.checked) { v.members = []; group.querySelectorAll('input').forEach((i) => { i.checked = false; }); extra.querySelectorAll('input').forEach((i) => { if (i !== input) i.checked = false; }); v[key === 'none' ? 'unknown' : 'none'] = false; }
      setAnswer(q, { ...v }); sync();
    });
    return h('label', { class: 'chip' }, input, h('span', { text: label }));
  };
  extra.append(mk('Nadie', 'none'), mk('No sé', 'unknown'));
  const detail = detailBox('Edad al diagnóstico o tipo (si lo sabe)', v.detail, (t) => { v.detail = t; setAnswer(q, { ...v }); });
  const sync = () => detail.classList.toggle('hidden', !v.members.length);
  sync();
  return h('div', {}, group, extra, detail);
}

function renderGrid(q) {
  const rows = itemsFromPrompt(q.prompt);
  const cols = optionsFromHint(String(q.options?.hint || '').replace(/^Rejilla:\s*/, ''));
  const v = clone(state.answers.get(q.id)) || { rows: {} };
  const table = h('table', { class: 'matrix' });
  table.append(h('thead', {}, h('tr', {}, h('th', { text: 'Por semana' }), ...cols.map((c) => h('th', { text: c })))));
  const tbody = h('tbody');
  rows.forEach((r, ri) => {
    const tr = h('tr', {}, h('td', { text: r.charAt(0).toUpperCase() + r.slice(1) }));
    cols.forEach((c) => {
      const input = h('input', { type: 'radio', name: `${q.id}-r${ri}`, 'aria-label': `${r}: ${c}` });
      input.checked = v.rows[r] === c;
      input.addEventListener('change', () => { v.rows[r] = c; setAnswer(q, { rows: { ...v.rows } }); });
      tr.append(h('td', {}, input));
    });
    tbody.append(tr);
  });
  table.append(tbody);
  return h('div', { class: 'matrix-wrap' }, table);
}

function renderSubScale(q) {
  const items = itemsFromPrompt(q.prompt);
  const scale = [{ v: 0, t: 'Nunca' }, { v: 1, t: 'Ocasional' }, { v: 2, t: 'Frecuente leve' }, { v: 3, t: 'Frecuente intenso' }];
  const v = clone(state.answers.get(q.id)) || { items: {} };
  const list = h('div', { class: 'items' });
  items.forEach((item, i) => {
    const g = chipGroup(`${q.id}-${i}`, scale, v.items[item], (val) => { v.items[item] = val; setAnswer(q, { items: { ...v.items } }); });
    g.classList.add('scale');
    list.append(h('div', { class: 'item' }, h('p', { class: 'item-text', text: item.charAt(0).toUpperCase() + item.slice(1) }), g));
  });
  return list;
}

function renderList(q) {
  let v = clone(state.answers.get(q.id)) || [];
  const box = h('div');
  const draw = () => {
    box.innerHTML = '';
    v.forEach((row, i) => {
      const input = textInput('text', row, (t) => { v[i] = t; setAnswer(q, v.filter((x) => x !== '')); });
      const del = h('button', { class: 'btn btn-ghost', type: 'button', 'aria-label': 'Quitar', text: '✕', onclick: () => { v.splice(i, 1); setAnswer(q, [...v]); draw(); } });
      box.append(h('div', { class: 'list-row' }, input, del));
    });
    const hint = String(q.options?.hint || '').replace(/^Lista( dinámica)?:?\s*/i, '');
    box.append(h('button', { class: 'btn btn-ghost', type: 'button', text: '+ Agregar', onclick: () => { v.push(''); draw(); box.querySelectorAll('input')[v.length - 1]?.focus(); } }));
    if (hint) box.append(h('p', { class: 'q-hint', style: 'margin-top:8px', text: `Incluye: ${hint}` }));
    const none = h('input', { type: 'checkbox' });
    none.checked = v.length === 1 && v[0] === 'Ninguno';
    none.addEventListener('change', () => { v = none.checked ? ['Ninguno'] : []; setAnswer(q, [...v]); draw(); });
    if (!(v.length && v[0] !== 'Ninguno')) box.append(h('div', { class: 'choices' }, h('label', { class: 'chip' }, none, h('span', { text: 'Ninguno' }))));
  };
  draw();
  return box;
}

function renderFile(q) {
  const v = clone(state.answers.get(q.id)) || [];
  const listEl = h('ul', { class: 'small' });
  const draw = () => { listEl.innerHTML = ''; v.forEach((f) => listEl.append(h('li', { text: f.name }))); };
  draw();
  const input = h('input', { type: 'file', class: 'input', multiple: true, accept: 'application/pdf,image/*' });
  const status = h('div', { class: 'small muted' });
  input.addEventListener('change', async () => {
    if (DEMO) { status.textContent = 'En vista previa no se suben archivos.'; return; }
    const kind = q.question_code === 'S1' ? 'lab_report' : q.question_code === 'S2' ? 'dexa_report' : 'prior_study';
    for (const file of input.files) {
      status.textContent = `Subiendo ${file.name}…`;
      const safe = file.name.normalize('NFD').replace(/[^\w.-]+/g, '_');
      const path = `${state.patient.id}/${kind}/${Date.now()}-${safe}`;
      const up = await supabase.storage.from(CONFIG.STORAGE_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
      if (up.error) { status.textContent = `Error al subir ${file.name}: ${up.error.message}`; continue; }
      const doc = await supabase.from('documents').insert({
        patient_id: state.patient.id, kind, storage_path: path, original_filename: file.name, mime_type: file.type, uploaded_by: (await supabase.auth.getUser()).data.user.id,
      });
      if (doc.error) { status.textContent = `Archivo subido pero no registrado: ${doc.error.message}`; continue; }
      v.push({ path, name: file.name });
      setAnswer(q, [...v]);
      draw();
    }
    status.textContent = 'Archivos cargados.';
    input.value = '';
  });
  const none = h('input', { type: 'checkbox' });
  none.checked = v.length === 0 && state.answers.get(q.id)?.length === 0;
  return h('div', {}, input, status, listEl);
}

function renderYesNoDetail(q) {
  const v = clone(state.answers.get(q.id)) || { value: '', detail: '' };
  const label = String(q.options?.hint || '').split('+')[1]?.trim() || 'Detalle';
  const detail = detailBox(label.charAt(0).toUpperCase() + label.slice(1), v.detail, (t) => { v.detail = t; setAnswer(q, { ...v }); });
  const sync = () => detail.classList.toggle('hidden', v.value !== 'Sí');
  const g = chipGroup(q.id, ['Sí', 'No'], v.value, (val) => { v.value = val; setAnswer(q, { ...v }); sync(); });
  sync();
  return h('div', {}, g, detail);
}

/* Controles visuales de la versión móvil (options.ui en la plantilla) */
function renderUi(q, ui, ov, val, hint) {
  switch (ui) {
    case 'cards': {
      const opts = ov && (ov.type === 'choices' || ov.type === 'multi') ? ov.options : optionsFromHint(hint);
      if (!opts.length) return null;
      const icons = q.options?.icons || {};
      const max = q.options?.max || 0;
      if (q.answer_type === 'multi_choice') {
        const v = clone(val) || { selected: [], none: false, other: '', detail: '' };
        const otherWrap = h('div', { style: 'margin-top:8px' },
          textInput('text', v.other, (t) => { v.other = t; setAnswer(q, { ...v }); }, { placeholder: '¿Cuál?' }));
        const syncOther = () => otherWrap.classList.toggle('hidden', !v.selected.some((s) => /^otro/i.test(s)));
        const group = cardGroup(h, q.id, opts, v.selected, (vals) => {
          v.selected = vals; v.none = false;
          if (!vals.some((s) => /^otro/i.test(s))) v.other = '';
          setAnswer(q, { ...v }); syncOther();
        }, { multiple: true, icons, max });
        syncOther();
        return h('div', {}, max ? h('p', { class: 'q-hint', text: `Elige hasta ${max}.` }) : null, group, otherWrap);
      }
      if (ov?.detail) {
        const v = clone(val) || { value: '', detail: '' };
        const detail = detailBox(ov.detail, v.detail, (t) => { v.detail = t; setAnswer(q, { ...v }); });
        return h('div', {}, cardGroup(h, q.id, opts, v.value, (x) => { v.value = x; setAnswer(q, { ...v }); }, { icons }), detail);
      }
      return cardGroup(h, q.id, opts, val, (x) => setAnswer(q, x), { icons });
    }
    case 'slider':
      return sliderControl(h, typeof val === 'number' ? val : undefined, (x) => setAnswer(q, x));
    case 'stepper':
      return q.answer_type === 'instrument' ? instrumentStepper(h, q, clone(val), (x) => setAnswer(q, x)) : null;
    case 'symptoms': {
      const items = itemsOf(q);
      return items.length ? symptomsControl(h, q, items, clone(val), (x) => setAnswer(q, x)) : null;
    }
    case 'alarm': {
      const items = itemsOf(q);
      return items.length ? alarmControl(h, q, items, clone(val), (x) => setAnswer(q, x)) : null;
    }
    case 'grid': {
      const rows = q.options?.rows || itemsFromPrompt(q.prompt);
      return rows.length ? gridControl(h, q, rows, clone(val), (x) => setAnswer(q, x)) : null;
    }
    default:
      return null;   // 'family' y cualquier otra pista caen al control clásico
  }
}

function renderControl(q) {
  const ov = OVERRIDES[q.question_code];
  const hint = String(q.options?.hint || '');
  const val = state.answers.get(q.id);

  const ui = q.options?.ui;
  if (ui && ov?.type !== 'fields') {
    const visual = renderUi(q, ui, ov, val, hint);
    if (visual) return visual;
  }

  if (ov) {
    switch (ov.type) {
      case 'fields': return renderFields(q, ov);
      case 'multi': return renderMulti(q, ov.options, ov.detail);
      case 'yesno_list': return renderYesNoList(q, ov.items);
      case 'info': return h('p', { class: 'notice small', text: ov.text });
      case 'consent': {
        const input = h('input', { type: 'checkbox' }); input.checked = val === true;
        input.addEventListener('change', () => setAnswer(q, input.checked || null));
        return h('div', { class: 'stack' }, h('p', { class: 'notice small', text: ov.text }),
          h('label', { class: 'chip' }, input, h('span', { text: 'He leído y acepto' })),
          h('p', { class: 'small muted', text: `Versión del aviso: ${CONFIG.PRIVACY_NOTICE_VERSION}` }));
      }
      case 'signature': {
        const v = clone(val) || { name: '', accepted: false };
        const input = h('input', { type: 'checkbox' }); input.checked = !!v.accepted;
        const name = textInput('text', v.name, (t) => { v.name = t; v.at = new Date().toISOString(); setAnswer(q, { ...v }); }, { placeholder: 'Escribe tu nombre completo', autocomplete: 'name' });
        input.addEventListener('change', () => { v.accepted = input.checked; v.at = new Date().toISOString(); setAnswer(q, { ...v }); });
        return h('div', { class: 'stack' }, h('p', { class: 'notice small', text: ov.text }), h('label', { class: 'chip' }, input, h('span', { text: 'Acepto' })),
          h('label', { class: 'field' }, h('span', { class: 'field-label small', text: 'Firma (nombre completo)' }), name));
      }
      case 'choices': {
        if (ov.detail) {
          const v = clone(val) || { value: '', detail: '' };
          return h('div', {}, chipGroup(q.id, ov.options, v.value, (x) => { v.value = x; setAnswer(q, { ...v }); }, { column: ov.options.length > 4 }),
            detailBox(ov.detail, v.detail, (t) => { v.detail = t; setAnswer(q, { ...v }); }));
        }
        return chipGroup(q.id, ov.options, val, (x) => setAnswer(q, x), { column: ov.options.length > 4 });
      }
      default: break;
    }
  }

  switch (q.answer_type) {
    case 'instrument': return renderInstrument(q);
    case 'single_choice': {
      const opts = optionsFromHint(hint);
      return chipGroup(q.id, opts, val, (x) => setAnswer(q, x), { column: opts.length > 5 });
    }
    case 'multi_choice': {
      if (hint.includes(' · ')) return renderMulti(q, optionsFromHint(hint), 'Comentarios', { allowNone: false });
      return renderMulti(q, itemsFromPrompt(q.prompt));
    }
    case 'boolean': return chipGroup(q.id, ['Sí', 'No'], val, (x) => setAnswer(q, x));
    case 'matrix': return hint.startsWith('Rejilla') ? renderGrid(q) : renderFamilyMatrix(q);
    case 'scale': {
      if (/1–10/.test(hint)) {
        const opts = Array.from({ length: 10 }, (_, i) => i + 1);
        const g = chipGroup(q.id, opts, val, (x) => setAnswer(q, x)); return g;
      }
      return renderSubScale(q);
    }
    case 'list': return renderList(q);
    case 'file': return renderFile(q);
    case 'date': return textInput('date', val, (x) => setAnswer(q, x), { max: new Date().toISOString().slice(0, 10) });
    case 'time': return textInput('time', val, (x) => setAnswer(q, x));
    case 'number': return textInput('number', val, (x) => setAnswer(q, x === '' ? null : Number(x)), { inputmode: 'decimal' });
    case 'long_text': return textInput('textarea', val, (x) => setAnswer(q, x));
    case 'checkbox': {
      const input = h('input', { type: 'checkbox' }); input.checked = val === true;
      input.addEventListener('change', () => setAnswer(q, input.checked || null));
      return h('label', { class: 'chip' }, input, h('span', { text: 'Confirmo' }));
    }
    case 'text':
    default:
      if (/^Sí\/No \+/.test(hint)) return renderYesNoDetail(q);
      return textInput('text', val, (x) => setAnswer(q, x));
  }
}

/* ================= navegación ================= */
function sectionVisible(s) {
  const c = s.display_condition;
  if (!c) return true;
  const v = answerOf(c.question);
  if (v === undefined || v === null || v === '') return false;
  return String(v).charAt(0).toUpperCase() === String(c.eq).toUpperCase();
}
const visibleSections = () => state.sections.filter(sectionVisible);
const questionsOf = (s) => state.questions.filter((q) => q.section_id === s.id);

function hintText(q) {
  const ov = OVERRIDES[q.question_code];
  if (q.options?.ui) return null;          // los controles visuales traen su propia guía
  if (ov || q.answer_type === 'instrument') return null;
  const hint = String(q.options?.hint || '');
  if (['multi_choice', 'single_choice', 'boolean', 'matrix', 'checkbox', 'list', 'scale'].includes(q.answer_type)) {
    if (q.answer_type === 'matrix' && !hint.startsWith('Rejilla')) return 'Marca qué familiares lo han tenido.';
    if (q.answer_type === 'scale' && !/1–10/.test(hint)) return 'Frecuencia en los últimos 30 días.';
    return null;
  }
  return null;
}

const INSTRUMENT_TITLES = {
  P1: 'Estrés en el último mes', P2: 'Estado de ánimo', P3: 'Una pregunta más sobre tu ánimo', P4: 'Ansiedad',
  N1: 'Seguridad para hacer ejercicio', N2: 'Actividad vigorosa (últimos 7 días)', N3: 'Actividad moderada (últimos 7 días)',
  N4: 'Caminata de 10 minutos o más (últimos 7 días)', N5: 'Tiempo sentado en un día hábil', O11: 'Ronquido y respiración al dormir',
  O13: 'Calidad de sueño (cuestionario completo)', Q8: 'Consumo de alcohol', Q9: 'Relación con la comida',
  L1: 'Energía, ánimo y función sexual', K9: 'Síntomas de climaterio',
};

function cleanPrompt(q) {
  if (INSTRUMENT_TITLES[q.question_code]) return INSTRUMENT_TITLES[q.question_code];
  if (OVERRIDES[q.question_code]?.type === 'multi') return q.prompt.replace(/\s*\((?:[^()]|\([^()]*\))*\)\s*/g, ' ').replace(/\s+([?,])/g, '$1').trim();
  if (q.answer_type === 'instrument') return q.prompt.split(/[(:]/)[0].replace(/\s—.*$/, '').trim();
  if (['multi_choice', 'scale'].includes(q.answer_type) && q.prompt.includes(':') && !OVERRIDES[q.question_code]) return q.prompt.split(':')[0];
  if (q.answer_type === 'matrix' && q.options?.hint?.startsWith('Rejilla')) return '¿Con qué frecuencia come estos alimentos?';
  return q.prompt;
}

/* ================= páginas (agrupan secciones) ================= */
const PAGES = [
  { title: 'Antes de empezar', sections: ['0'] },
  { title: 'Tu objetivo', sections: ['B'] },
  { title: 'Tus datos y medidas', sections: ['A', 'C'] },
  { title: 'Historia médica', sections: ['D', 'E', 'F', 'G', 'J'] },
  { title: 'Tratamientos y hormonas', sections: ['H', 'I', 'K', 'L'] },
  { title: 'Cómo te sientes', sections: ['M'] },
  { title: 'Tu sueño', sections: ['O'] },
  { title: 'Movimiento', sections: ['N'] },
  { title: 'Tu alimentación', sections: ['Q'] },
  { title: 'Tus hábitos', sections: ['R', 'T'] },
  { title: 'Ánimo, estudios y envío', sections: ['P', 'S', 'Z'] },
];

// Preguntas filtro: con "No" se ocultan las preguntas del bloque y se registran como "ninguno"
const NONE_MULTI = { selected: [], none: true, other: '', detail: '' };
const GATES = {
  E: { label: '¿Algún médico le ha diagnosticado una enfermedad?', none: { E1: NONE_MULTI, E2: NONE_MULTI, E3: NONE_MULTI, E4: NONE_MULTI, E5: NONE_MULTI, E6: NONE_MULTI, E7: NONE_MULTI, E8: NONE_MULTI, E9: NONE_MULTI, E10: { value: 'Nunca he tenido cáncer', detail: '' }, E11: NONE_MULTI, E12: NONE_MULTI, E13: NONE_MULTI, E14: NONE_MULTI } },
  F: { label: '¿Tiene alguna condición congénita o genética conocida?', none: { F1: { value: 'No', detail: '' }, F2: NONE_MULTI } },
  G: { label: '¿Ha tenido cirugías, hospitalizaciones o transfusiones?', none: { G1: ['Ninguno'], G2: { value: 'No', detail: '' }, G3: NONE_MULTI, G4: ['Ninguno'], G5: { value: 'No', detail: '' } } },
  J: { label: '¿Tiene alergias o intolerancias?', none: { J1: ['Ninguno'], J2: ['Ninguno'], J3: NONE_MULTI, J4: NONE_MULTI } },
  H: { label: '¿Toma algún medicamento de forma regular?', none: { H1: NONE_MULTI, H2: NONE_MULTI, H3: NONE_MULTI, H4: NONE_MULTI, H5: NONE_MULTI, H6: NONE_MULTI, H7: NONE_MULTI, H8: NONE_MULTI, H9: NONE_MULTI, H10: 'No', H11: ['Ninguno'] } },
  I: { label: '¿Toma suplementos, vitaminas, proteína o herbolaria?', none: { I1: ['Ninguno'], I2: { value: 'No', detail: '' } } },
};
const gateChoice = new Map(); // elección explícita en esta sesión

function gateState(code) {
  if (gateChoice.has(code)) return gateChoice.get(code);
  const g = GATES[code];
  const entries = Object.entries(g.none).map(([qc, nv]) => [answerOf(qc), nv]);
  if (entries.every(([v]) => v === undefined || v === null)) return undefined;
  const allNone = entries.every(([v, nv]) => JSON.stringify(v) === JSON.stringify(nv));
  return allNone ? 'No' : 'Sí';
}
function applyGate(code, choice) {
  gateChoice.set(code, choice);
  for (const [qc, nv] of Object.entries(GATES[code].none)) {
    const q = state.byCode.get(qc);
    if (!q) continue;
    const cur = state.answers.get(q.id);
    if (choice === 'No') setAnswer(q, clone(nv));
    else if (JSON.stringify(cur) === JSON.stringify(nv)) { state.answers.delete(q.id); queueSave(q); }
  }
}

const visiblePages = () => PAGES
  .map((p) => ({ ...p, secs: p.sections.map((c) => state.sections.find((s) => s.section_code === c)).filter((s) => s && sectionVisible(s)) }))
  .filter((p) => p.secs.length);
const pageQuestions = (p) => p.secs.flatMap(questionsOf);

function renderQuestion(q) {
  const wrap = h('div', { class: 'q', 'data-code': q.question_code });
  wrap.append(h('p', { class: 'q-title' }, cleanPrompt(q), q.is_required ? h('span', { class: 'req', 'aria-hidden': 'true', text: ' *' }) : null));
  const hint = hintText(q);
  if (hint) wrap.append(h('p', { class: 'q-hint', text: hint }));
  if (skipped(q)) {
    wrap.classList.add('is-skipped');
    wrap.append(h('div', { class: 'skip-note' },
      h('span', { text: 'Pendiente para después' }),
      h('button', { class: 'btn-link', type: 'button', text: 'Contestar ahora', onclick: () => { unskip(q); renderPage(true); } })));
  } else {
    wrap.append(renderControl(q));
    if (canSkip(q)) {
      wrap.append(h('button', { class: 'btn-link skip', type: 'button', text: 'Contestar después →',
        onclick: () => { skipQuestion(q); renderPage(true); } }));
    }
  }
  q._el = wrap;
  return wrap;
}

// Antecedentes familiares: una sola selección múltiple con tarjetas
const FAM_SI = 'Sí, en mi familia';
const FAM_NADIE = { members: [], none: true, unknown: false, detail: '' };
const FAM_NOSE = { members: [], none: false, unknown: true, detail: '' };
const famOn = (q) => (state.answers.get(q.id)?.members || []).length > 0;

function renderFamilyCards(qs) {
  const wrap = h('div', { class: 'q' });
  wrap.append(h('p', { class: 'q-title', text: '¿Algún familiar directo ha tenido…?' }),
    h('p', { class: 'q-hint', text: 'Papás, hermanos, abuelos o hijos. Toca los que apliquen; lo que no toques queda como "no".' }));

  const cards = h('div', { class: 'cards' });
  qs.forEach((q) => {
    const label = q.options?.label || q.prompt;
    const icon = q.options?.icon;
    cards.append(h('button', { class: `card-btn${famOn(q) ? ' on' : ''}`, type: 'button', 'aria-pressed': famOn(q) ? 'true' : 'false', onclick: () => {
      const prender = !famOn(q);
      setAnswer(q, prender ? { members: [FAM_SI], none: false, unknown: false, detail: '' } : { ...FAM_NADIE });
      // lo que no se tocó queda registrado como "nadie"
      qs.forEach((x) => { if (!isAnswered(x, state.answers.get(x.id))) setAnswer(x, { ...FAM_NADIE }); });
      renderPage(true);
    } }, icon ? h('b', { class: 'ico', text: icon }) : null, h('span', { text: label })));
  });
  wrap.append(cards);

  const marcadas = qs.filter(famOn).length;
  const todoNadie = qs.every((q) => state.answers.get(q.id)?.none === true);
  const todoNose = qs.every((q) => state.answers.get(q.id)?.unknown === true);
  wrap.append(h('div', { class: 'fam-acts' },
    h('button', { class: `btn btn-ghost${todoNadie ? ' on' : ''}`, type: 'button', text: 'Nadie tuvo nada de esto',
      onclick: () => { qs.forEach((q) => setAnswer(q, { ...FAM_NADIE })); renderPage(true); } }),
    h('button', { class: `btn btn-ghost${todoNose ? ' on' : ''}`, type: 'button', text: 'No sé / no tengo contacto',
      onclick: () => { qs.forEach((q) => setAnswer(q, { ...FAM_NOSE })); renderPage(true); } })));
  if (marcadas) wrap.append(h('p', { class: 'small muted', style: 'margin:10px 0 0', text: `${marcadas} marcado(s). Tu médico preguntará los detalles en la consulta.` }));

  qs.forEach((q) => { q._el = wrap; });
  return wrap;
}

function renderBlock(s, pageTitle) {
  const block = h('div', { class: 'block' });
  const title = s.title.replace(/\s*\(sólo si .*\)$/i, '');
  if (title !== pageTitle) block.append(h('h3', { class: 'block-title', text: title }));
  if (s.section_code === 'P') block.append(h('p', { class: 'q-hint', text: `Estas preguntas nos ayudan a cuidarte. Si te sientes en riesgo, llama a la Línea de la Vida ${CONFIG.CRISIS_LINE} (24 h).` }));
  if (s.section_code === 'M') block.append(h('p', { class: 'q-hint', text: 'Piensa en el último mes. Toca lo que te pasa: un toque = a veces, dos toques = seguido.' }));
  const qs = questionsOf(s);

  if (s.section_code === 'D') { block.append(renderFamilyCards(qs)); return block; }

  const gate = GATES[s.section_code];
  let body = h('div');
  if (gate) {
    const current = gateState(s.section_code);
    const gq = h('div', { class: 'q gate' }, h('p', { class: 'q-title', text: gate.label }),
      chipGroup(`gate-${s.section_code}`, ['Sí', 'No'], current, (x) => { applyGate(s.section_code, x); renderPage(true); }));
    block.append(gq);
    if (current !== 'Sí') {
      // preguntas de este bloque fuera del filtro (ej. F3 archivo) se muestran igual
      qs.filter((q) => !(q.question_code in gate.none) && current === 'No').forEach((q) => body.append(renderQuestion(q)));
      block.append(body);
      return block;
    }
  }
  qs.forEach((q) => body.append(renderQuestion(q)));
  block.append(body);
  const skipAll = sectionSkip(qs);
  if (skipAll) block.append(skipAll);
  return block;
}

// "Saltar esta sección por ahora": sólo aparece si casi todo el bloque es opcional
function sectionSkip(qs) {
  const opt = qs.filter(canSkip);
  if (opt.length < 2 || opt.length < qs.length - 1) return null;
  const left = opt.filter((q) => !answered(q) && !skipped(q));
  if (!left.length) return null;
  return h('div', { class: 'block-actions' },
    h('button', { class: 'btn btn-ghost btn-block', type: 'button', text: `Saltar esta sección por ahora (${left.length})`,
      onclick: () => { left.forEach(skipQuestion); renderPage(true); } }));
}

function renderPage(keepScroll = false) {
  const pages = visiblePages();
  state.index = Math.max(0, Math.min(state.index, pages.length - 1));
  const p = pages[state.index];
  const y = window.scrollY;
  $('section-code').textContent = `Paso ${state.index + 1} de ${pages.length}`;
  $('section-title').textContent = p.title;
  $('section-intro').textContent = p.sections.includes('0')
    ? 'Unos 12–15 minutos. Se guarda solo y puedes dejar preguntas para después.'
    : '';
  const box = $('questions');
  box.innerHTML = '';
  p.secs.forEach((s) => box.append(renderBlock(s, p.title)));
  $('btn-prev').disabled = state.index === 0;
  $('btn-next').textContent = state.index === pages.length - 1 ? 'Enviar' : 'Siguiente';
  updateProgress();
  if (keepScroll) window.scrollTo({ top: y }); else window.scrollTo({ top: 0, behavior: 'smooth' });
}

function isGatedHidden(q) {
  const s = state.sections.find((x) => x.id === q.section_id);
  const g = s && GATES[s.section_code];
  return g && (q.question_code in g.none) && gateState(s.section_code) !== 'Sí';
}

function pendingQuestions() {
  return visiblePages().flatMap(pageQuestions).filter((q) => !isGatedHidden(q) && skipped(q));
}

function updateProgress() {
  const pages = visiblePages();
  const qs = pages.flatMap(pageQuestions).filter((q) => !isGatedHidden(q));
  const done = qs.filter(isResolved).length;
  const pend = qs.filter(skipped).length;
  const pct = qs.length ? Math.round((done / qs.length) * 100) : 0;
  $('bar').style.width = `${pct}%`;
  $('pct-label').textContent = pend ? `${pct}% · ${pend} pendiente${pend === 1 ? '' : 's'}` : `${pct}% completado`;
  $('step-label').textContent = pages[state.index]?.title || '';
}

function missingIn(p) {
  const miss = pageQuestions(p).filter((q) => q.is_required && !isAnswered(q, state.answers.get(q.id)));
  const gates = p.secs.filter((s) => GATES[s.section_code] && gateState(s.section_code) === undefined);
  return { miss, gates };
}

function validatePage() {
  const p = visiblePages()[state.index];
  const { miss, gates } = missingIn(p);
  document.querySelectorAll('.q.invalid').forEach((e) => e.classList.remove('invalid'));
  miss.forEach((q) => q._el?.classList.add('invalid'));
  const gateEls = gates.map((s) => [...document.querySelectorAll('.gate')].find((el) => el.querySelector(`input[name="gate-${s.section_code}"]`)));
  gateEls.forEach((el) => el?.classList.add('invalid'));
  const first = [...miss.map((q) => q._el), ...gateEls].filter(Boolean)[0];
  const total = miss.length + gates.length;
  if (total) {
    first?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    $('save-status').textContent = `Faltan ${total} respuesta(s)`;
  }
  return total === 0;
}

async function recordConsents() {
  if (DEMO) return true;
  if (answerOf('0.3') === 'No') {
    $('modal-title').textContent = 'Necesitamos tu autorización';
    $('modal-body').innerHTML = '<p>Sin autorización para compartir tus resultados con tu médico y con el laboratorio no podemos emitir tus órdenes ni diseñar tu protocolo.</p><p>Si tienes dudas sobre el uso de tus datos, platícalo con tu médico antes de continuar.</p>';
    $('modal').classList.remove('hidden');
    return false;
  }
  const { data: existing } = await supabase.from('consents').select('consent_type').eq('patient_id', state.patient.id).is('revoked_at', null);
  const have = new Set((existing || []).map((c) => c.consent_type));
  const sig = answerOf('0.2');
  const rows = [
    { consent_type: 'privacy_notice', document_version: CONFIG.PRIVACY_NOTICE_VERSION, accepted: answerOf('0.1') === true },
    { consent_type: 'international_transfer', document_version: CONFIG.PRIVACY_NOTICE_VERSION, accepted: answerOf('0.1') === true },
    { consent_type: 'informed_consent', document_version: CONFIG.CONSENT_VERSION, accepted: !!sig?.accepted },
    { consent_type: 'data_sharing', document_version: CONFIG.CONSENT_VERSION, accepted: answerOf('0.3') === 'Sí' },
  ].filter((r) => !have.has(r.consent_type))
    .map((r) => ({ ...r, patient_id: state.patient.id, user_agent: navigator.userAgent.slice(0, 250) }));
  if (!rows.length) return true;
  const { error } = await supabase.from('consents').insert(rows);
  if (error) { $('save-status').textContent = `No se pudo registrar el consentimiento: ${error.message}`; return false; }
  return true;
}

// Modal con dos salidas (el botón fijo "Entendido" se esconde mientras se usa)
function askModal(title, bodyNodes, buttons) {
  return new Promise((resolve) => {
    $('modal-title').textContent = title;
    $('modal-title').classList.add('neutral');
    $('modal-body').innerHTML = '';
    bodyNodes.forEach((n) => $('modal-body').append(n));
    $('modal-close').classList.add('hidden');
    const row = h('div', { class: 'modal-btns' });
    buttons.forEach((b) => row.append(h('button', { class: `btn ${b.cls || 'btn-ghost'} btn-block`, type: 'button', text: b.t, onclick: () => {
      $('modal').classList.add('hidden');
      $('modal-close').classList.remove('hidden');
      resolve(b.v);
    } })));
    $('modal-body').append(row);
    $('modal').classList.remove('hidden');
  });
}

function jumpTo(q) {
  const pages = visiblePages();
  const i = pages.findIndex((p) => pageQuestions(p).some((x) => x.id === q.id));
  if (i >= 0) { state.index = i; renderPage(); }
  setTimeout(() => q._el?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);
}

async function confirmPending(pend) {
  const list = h('ul', { class: 'small' }, ...pend.slice(0, 6).map((q) => h('li', { text: cleanPrompt(q) })),
    pend.length > 6 ? h('li', { class: 'muted', text: `y ${pend.length - 6} más` }) : null);
  const r = await askModal('Tienes preguntas pendientes', [
    h('p', { text: `Dejaste ${pend.length} pregunta${pend.length === 1 ? '' : 's'} para después. Puedes enviar así y completarlas con tu médico en la consulta, pero el protocolo sale más preciso si las contestas ahora.` }),
    list,
  ], [
    { t: 'Ir a la primera pendiente', v: 'review', cls: 'btn-primary' },
    { t: 'Enviar así', v: 'send' },
  ]);
  if (r === 'review') { jumpTo(pend[0]); return false; }
  return true;
}

async function submitIntake() {
  const pages = visiblePages();
  const bad = pages.findIndex((p) => { const m = missingIn(p); return m.miss.length || m.gates.length; });
  if (bad >= 0) { state.index = bad; renderPage(); validatePage(); return; }
  const pend = pendingQuestions();
  if (pend.length && !(await confirmPending(pend))) return;
  if (!confirm('¿Enviar tu historia clínica? Después ya no podrás editarla; tu médico la revisará.')) return;
  if (DEMO) { showDone(); return; }
  await flushSaves();
  const { error } = await supabase.from('intakes').update({ status: 'submitted', submitted_at: new Date().toISOString() }).eq('id', state.intake.id);
  if (error) { $('save-status').textContent = `No se pudo enviar: ${error.message}`; return; }
  showDone();
}

function showDone() {
  $('wizard').classList.add('hidden');
  $('savebar').classList.add('hidden');
  $('done').classList.remove('hidden');
  window.scrollTo({ top: 0 });
}

$('btn-prev').addEventListener('click', () => { state.index--; renderPage(); });
$('btn-next').addEventListener('click', async () => {
  if (!validatePage()) return;
  const pages = visiblePages();
  if (pages[state.index].sections.includes('0') && !(await recordConsents())) return;
  if (state.index === pages.length - 1) { await submitIntake(); return; }
  state.index++;
  renderPage();
});
window.addEventListener('beforeunload', (e) => { if (state.timers.size) { e.preventDefault(); e.returnValue = ''; } });

/* ================= inicio ================= */
(async function init() {
  try {
    if (DEMO) await loadDemo();
    else if (!(await loadLive())) return;
    indexQuestions();
    $('loading').classList.add('hidden');

    if (state.intake.status !== 'in_progress') { showDone(); return; }
    prefill();

    const pages = visiblePages();
    const firstIncomplete = pages.findIndex((p) => pageQuestions(p).some((q) => !isGatedHidden(q) && !isResolved(q)));
    state.index = firstIncomplete === -1 ? pages.length - 1 : firstIncomplete;
    // Vista previa: ?demo=1&s=P abre el paso que contiene esa sección
    const jump = new URLSearchParams(location.search).get('s');
    if (DEMO && jump) {
      const code = jump.toUpperCase();
      if (['K', 'L'].includes(code)) state.answers.set(state.byCode.get('A3').id, code === 'K' ? 'Femenino' : 'Masculino');
      const j = visiblePages().findIndex((p) => p.sections.includes(code));
      if (j >= 0) state.index = j;
    }

    $('wizard').classList.remove('hidden');
    $('savebar').classList.remove('hidden');
    $('save-status').textContent = DEMO ? 'Vista previa' : 'Tus respuestas se guardan solas';
    renderPage();
  } catch (err) {
    console.error(err);
    $('loading').classList.add('hidden');
    $('error').textContent = `No pudimos cargar el formulario: ${err.message || err}`;
    $('error').classList.remove('hidden');
  }
})();
