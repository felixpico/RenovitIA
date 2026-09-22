// Controles visuales para celular: tarjetas con icono, deslizador, cuestionarios de una
// pregunta por pantalla, síntomas en 3 niveles, síntomas de alarma y rejilla de frecuencia.
// Cada control guarda el mismo formato que la versión anterior para no romper el motor de reglas.
import { INSTRUMENTS, instrumentKey, scoreInstrument } from './instruments.js';

export const SKIPPED = { skipped: true };
export const isSkipped = (v) => !!v && typeof v === 'object' && v.skipped === true;

/* Tarjetas grandes: una opción por fila, con icono opcional */
export function cardGroup(h, name, options, current, onChange, { multiple = false, icons = {}, max = 0 } = {}) {
  const wrap = h('div', { class: 'cards', role: multiple ? 'group' : 'radiogroup' });
  const sel = new Set(multiple ? current || [] : [current]);
  const inputs = [];
  const enforce = () => {
    if (!multiple || !max) return;
    const checked = inputs.filter((i) => i.checked);
    inputs.forEach((i) => { i.disabled = !i.checked && checked.length >= max; });
  };
  options.forEach((opt) => {
    const input = h('input', { type: multiple ? 'checkbox' : 'radio', name, value: opt });
    input.checked = sel.has(opt);
    input.addEventListener('change', () => {
      if (multiple) { enforce(); onChange(inputs.filter((i) => i.checked).map((i) => i.value)); }
      else onChange(opt);
    });
    inputs.push(input);
    wrap.append(h('label', { class: 'card-opt' }, input, h('span', { class: 'card-body' },
      icons[opt] ? h('b', { class: 'ico', text: icons[opt] }) : null, h('span', { text: opt }))));
  });
  enforce();
  return wrap;
}

/* Deslizador 1–10 con número grande */
export function sliderControl(h, value, onChange) {
  const out = h('output', { class: 'slider-val', text: value ?? '—' });
  const input = h('input', { type: 'range', class: 'slider', min: 1, max: 10, step: 1 });
  input.value = value ?? 7;
  input.addEventListener('input', () => { out.textContent = input.value; });
  input.addEventListener('change', () => onChange(Number(input.value)));
  return h('div', { class: 'slider-wrap' }, out, input,
    h('div', { class: 'slider-legend' }, h('span', { text: '1 · nada' }), h('span', { text: '10 · muchísimo' })));
}

/* Cuestionario validado: un reactivo por pantalla, avance automático */
export function instrumentStepper(h, q, value, onChange) {
  const key = instrumentKey(q);
  const def = INSTRUMENTS[key];
  if (!def) return h('p', { class: 'muted', text: 'Cuestionario no disponible.' });
  const rows = def.perItemScale || def.items.map((t) => ({ t, s: def.scale }));
  const v = { items: [...(value?.items || [])], score: value?.score };
  const box = h('div', { class: 'stepper' });
  let i = rows.findIndex((_, k) => v.items[k] === undefined || v.items[k] === null);
  if (i === -1) i = rows.length;

  const draw = () => {
    box.innerHTML = '';
    if (i >= rows.length) {
      box.append(h('div', { class: 'stepper-done' }, h('b', { text: '✓ Contestado' }),
        h('button', { class: 'btn-link', type: 'button', text: 'Revisar respuestas', onclick: () => { i = 0; draw(); } })));
      return;
    }
    const row = rows[i];
    box.append(h('div', { class: 'stepper-top' },
      h('div', { class: 'dots' }, ...rows.map((_, k) => h('i', { class: k === i ? 'on' : (v.items[k] != null ? 'done' : '') }))),
      h('span', { class: 'small muted', text: `${i + 1} de ${rows.length}` })));
    if (def.intro && i === 0) box.append(h('p', { class: 'q-hint', text: def.intro }));
    box.append(h('p', { class: 'stepper-q', text: String(row.t).replace(/^…\s*/, '') }));
    const opts = h('div', { class: 'stepper-opts' });
    row.s.forEach((o) => {
      opts.append(h('button', { class: `opt${v.items[i] === o.v ? ' on' : ''}`, type: 'button', text: o.t, onclick: () => {
        v.items[i] = o.v;
        v.score = scoreInstrument(key, v.items);
        onChange({ ...v, items: [...v.items] });
        i += 1;
        draw();
      } }));
    });
    box.append(opts);
    if (i > 0) box.append(h('button', { class: 'btn-link', type: 'button', text: '← Anterior', onclick: () => { i -= 1; draw(); } }));
  };
  draw();
  return box;
}

/* Síntomas: una etiqueta por síntoma. Un toque = a veces (1), dos = seguido (3),
   tres = lo quita. Conserva la escala 0/1/3 que ya usa el motor de reglas. */
export function symptomsControl(h, q, items, value, onChange) {
  const v = { items: { ...(value?.items || {}) } };
  const wrap = h('div', { class: 'sym-chips' });
  const chips = new Map();
  const paint = (item) => {
    const { btn, tag } = chips.get(item);
    const lv = v.items[item];
    btn.classList.toggle('lvl1', lv === 1);
    btn.classList.toggle('lvl3', lv === 3);
    tag.textContent = lv === 1 ? ' · a veces' : lv === 3 ? ' · seguido' : '';
    btn.setAttribute('aria-pressed', lv ? 'true' : 'false');
  };
  items.forEach((item) => {
    const tag = h('i', { class: 'sym-lvl' });
    const btn = h('button', { class: 'sym-chip', type: 'button', onclick: () => {
      const lv = v.items[item];
      v.items[item] = lv === 1 ? 3 : lv === 3 ? 0 : 1;
      paint(item);
      onChange({ items: { ...v.items } });
    } }, h('span', { text: item.charAt(0).toUpperCase() + item.slice(1) }), tag);
    chips.set(item, { btn, tag });
    paint(item);
    wrap.append(btn);
  });
  const none = h('button', { class: 'btn btn-ghost btn-wide', type: 'button', text: 'Nada de esto me pasa', onclick: () => {
    items.forEach((item) => { v.items[item] = 0; paint(item); });
    onChange({ items: { ...v.items } });
  } });
  return h('div', {}, wrap, none);
}

/* Síntomas de alarma: nunca se saltan y se ven distintos */
export function alarmControl(h, q, items, value, onChange) {
  const v = { items: { ...(value?.items || {}) } };
  const list = h('div', { class: 'sym-list alarm' });
  items.forEach((item) => {
    const opts = h('div', { class: 'sym-opts two' });
    ['No', 'Sí'].forEach((t) => {
      const b = h('button', { class: `opt${v.items[item] === t ? ' on' : ''}${t === 'Sí' ? ' danger' : ''}`, type: 'button', text: t, onclick: () => {
        v.items[item] = t;
        [...opts.children].forEach((c) => c.classList.remove('on'));
        b.classList.add('on');
        onChange({ items: { ...v.items } });
      } });
      opts.append(b);
    });
    list.append(h('div', { class: 'sym-row' }, h('span', { class: 'sym-name', text: item }), opts));
  });
  const none = h('button', { class: 'btn btn-ghost btn-wide', type: 'button', text: 'Ninguno de estos', onclick: () => {
    items.forEach((item) => { v.items[item] = 'No'; });
    onChange({ items: { ...v.items } });
    list.querySelectorAll('.sym-opts').forEach((o) => { [...o.children].forEach((c, k) => c.classList.toggle('on', k === 0)); });
  } });
  return h('div', {}, list, none);
}

/* Rejilla de frecuencia: una fila por alimento, 5 botones */
export function gridControl(h, q, rows, value, onChange) {
  const cols = ['Nunca', '1–2', '3–4', '5–6', 'Diario'];
  const short = { Nunca: '0', '1–2': '1-2', '3–4': '3-4', '5–6': '5-6', Diario: 'Diario' };
  const v = { rows: { ...(value?.rows || {}) } };
  const box = h('div', { class: 'freq-list' });
  box.append(h('div', { class: 'freq-head' }, h('span', { class: 'freq-name', text: 'Veces por semana' }), ...cols.map((c) => h('span', { text: short[c] }))));
  rows.forEach((r) => {
    const row = h('div', { class: 'freq-row' }, h('span', { class: 'freq-name', text: r.charAt(0).toUpperCase() + r.slice(1) }));
    const btns = [];
    cols.forEach((c) => {
      const b = h('button', { class: `dot${v.rows[r] === c ? ' on' : ''}`, type: 'button', 'aria-label': `${r}: ${c} veces por semana`, text: short[c], onclick: () => {
        v.rows[r] = c;
        btns.forEach((x) => x.classList.remove('on'));
        b.classList.add('on');
        onChange({ rows: { ...v.rows } });
      } });
      btns.push(b);
      row.append(b);
    });
    box.append(row);
  });
  return box;
}
