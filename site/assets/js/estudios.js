// Pestaña "Estudios" del panel médico: órdenes de laboratorio y DEXA, resultados y documentos
export const ORDER_STATUS = {
  draft: ['Borrador', 'neutral'], signed: ['Firmada', 'prioritize'], sent: ['Enviada al proveedor', 'prioritize'],
  scheduled: ['Agendada', 'prioritize'], sample_taken: ['Muestra tomada / estudio realizado', 'block'],
  results_received: ['Resultados recibidos', 'ok'], cancelled: ['Cancelada', 'neutral'],
};
const NEXT = { signed: ['sent', 'scheduled', 'sample_taken'], sent: ['scheduled', 'sample_taken'], scheduled: ['sample_taken'], sample_taken: ['results_received'] };
const CATEGORY = { hematologia: 'Biometría hemática', electrolitos: 'Electrolitos', hepatico: 'Función hepática', renal: 'Función renal', metabolico: 'Metabólico', cardiovascular: 'Cardiovascular', inflamacion: 'Inflamación', hormonal: 'Hormonas', tiroides: 'Tiroides', nutrientes: 'Nutrientes', genetica: 'Genética', muscular: 'Muscular' };
const DEXA_STUDIES = ['Composición corporal DEXA (cuerpo completo)', 'Densitometría ósea (columna lumbar y cadera)'];

export const DEFAULT_INDICATIONS = {
  lab: (sex) => [
    'Ayuno de 10 a 12 horas (sólo agua).',
    'Toma de muestra entre 7:00 y 9:00 am.',
    'Suspender biotina y suplementos con biotina 72 horas antes.',
    'No hacer ejercicio intenso 48 horas antes ni tomar alcohol 24 horas antes.',
    sex === 'F' ? 'FSH, LH y estradiol: día 2 a 5 del ciclo. Progesterona: día 19 a 22.' : null,
  ].filter(Boolean).join('\n'),
  dexa: () => [
    'No tomar calcio ni suplementos el día del estudio.',
    'Ropa cómoda sin partes metálicas.',
    'No haberse realizado estudios con medio de contraste en los 7 días previos.',
    'Informar si existe posibilidad de embarazo.',
  ].join('\n'),
};

export function renderStudiesTab(root, ctx) {
  const { h, badge, modal, toast, api, patient, sex, me, refresh } = ctx;
  const load = async () => {
    root.innerHTML = '';
    root.append(h('div', { class: 'spinner' }));
    let data;
    try { data = await api.studies(patient.id); } catch (e) { root.innerHTML = ''; root.append(h('div', { class: 'notice danger', text: e.message })); return; }
    root.innerHTML = '';
    const { orders, items, providers, documents, results, bodycomp, biomarkers } = data;
    const bmById = new Map(biomarkers.map((b) => [b.id, b]));
    const provName = (id) => providers.find((p) => p.id === id)?.name || 'Sin proveedor';

    const runTop = async (fn, msg) => { try { await fn(); toast(msg); load(); refresh?.(); } catch (e) { toast(`Error: ${e.message}`, true); } };
    root.append(h('div', { class: 'toolbar', style: 'margin-bottom:12px' },
      h('button', { class: 'btn btn-primary btn-sm', type: 'button', text: '+ Orden de laboratorio', onclick: () => orderDialog('lab') }),
      h('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: '+ Orden DEXA', onclick: () => orderDialog('dexa') })));

    // ---------- Liberación de resultados al paciente ----------
    const held = [...results, ...bodycomp].filter((r) => !r.released_at).length;
    const freed = [...results, ...bodycomp].filter((r) => r.released_at).length;
    if (held || freed) {
      const bar = h('div', { class: 'row-card', style: 'margin-bottom:12px' },
        h('div', { class: 'row-top' },
          badge(held ? 'block' : 'ok', held ? `${held} resultado(s) retenidos` : 'Resultados liberados'),
          h('span', { class: 'grow small muted', text: held
            ? 'El paciente no los ve hasta que los liberes. Libéralos cuando ya se los expliques o al final de la consulta.'
            : `El paciente ya puede ver ${freed} resultado(s) en su cuenta.` })));
      const acts = h('div', { class: 'row-actions' });
      if (held) acts.append(h('button', { class: 'btn btn-primary btn-sm', type: 'button', text: `Liberar al paciente (${held})`,
        onclick: async () => {
          const ok = await modal('Liberar resultados', h('p', { text: `El paciente podrá ver ${held} resultado(s) y los PDF del laboratorio en su cuenta. ¿Continuar?` }), 'Liberar');
          if (ok) runTop(() => api.releaseResults(patient.id), 'Resultados liberados');
        } }));
      if (freed) acts.append(h('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: 'Volver a retener',
        onclick: () => runTop(() => api.holdResults(patient.id), 'Resultados retenidos') }));
      bar.append(acts);
      root.append(bar);
    }

    // ---------- Órdenes ----------
    const list = h('div', { class: 'list' });
    if (!orders.length) list.append(h('div', { class: 'empty-state', text: 'Sin órdenes todavía.' }));
    orders.forEach((o) => {
      const its = items.filter((i) => i.order_id === o.id);
      const [stText, stCls] = ORDER_STATUS[o.status];
      const card = h('div', { class: 'row-card' });
      card.append(h('div', { class: 'row-top' },
        badge(o.order_type === 'dexa' ? 'block' : 'prioritize', o.order_type === 'dexa' ? 'DEXA' : 'Laboratorio'),
        h('span', { class: 'grow', text: `${o.folio || 'Borrador'} · ${provName(o.provider_id)}` }),
        badge(stCls, stText)));
      card.append(h('div', { class: 'row-meta' },
        h('span', { text: o.round === 'followup' ? 'Seguimiento' : o.round === 'extra' ? 'Adicional' : 'Basal' }),
        h('span', { text: `${its.length} estudio(s)` }),
        o.signed_at ? h('span', { text: `Firmada ${new Date(o.signed_at).toLocaleDateString('es-MX')}` }) : null,
        o.scheduled_at ? h('span', { text: `Cita ${new Date(o.scheduled_at).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}` }) : null,
        o.cost_mxn ? h('span', { text: `$${Number(o.cost_mxn).toLocaleString('es-MX')} MXN` }) : null));
      const det = h('details', {}, h('summary', { class: 'small', style: 'cursor:pointer;color:var(--muted)', text: 'Ver estudios e indicaciones' }),
        h('div', { class: 'small', style: 'margin-top:6px' }, its.map((i) => i.study_name).join(' · ')),
        o.indications ? h('div', { class: 'small muted', style: 'margin-top:6px;white-space:pre-wrap', text: o.indications }) : null);
      card.append(det);

      const docs = documents.filter((d) => d.order_id === o.id);
      if (docs.length) card.append(h('div', { class: 'row-meta' }, 'Documentos:', ...docs.map((d) => h('a', { href: '#', text: d.original_filename || 'archivo', onclick: async (e) => { e.preventDefault(); try { window.open(await api.docUrl(d.storage_path), '_blank', 'noopener'); } catch (err) { toast(err.message, true); } } }))));

      const act = h('div', { class: 'row-actions' });
      const run = async (fn, msg) => { try { await fn(); toast(msg); load(); refresh?.(); } catch (e) { toast(`Error: ${e.message}`, true); } };
      if (o.status === 'draft') {
        act.append(
          me.physician ? h('button', { class: 'btn btn-primary btn-sm', type: 'button', text: 'Firmar orden', onclick: async () => {
            const ok = await modal('Firmar orden', h('div', { class: 'stack' },
              h('p', { text: `Firmarás como ${me.physician.full_name}, cédula ${me.physician.cedula_profesional || '—'}.` }),
              h('p', { class: 'muted small', text: 'Después de firmar no se pueden cambiar los estudios; si hace falta algo, cancela y crea otra orden.' })), 'Firmar');
            if (ok) run(() => api.signOrder(o.id), 'Orden firmada');
          } }) : h('span', { class: 'muted small', text: 'Sólo un médico puede firmar' }),
          h('button', { class: 'btn-link btn-sm', type: 'button', text: 'Eliminar borrador', onclick: () => run(() => api.deleteOrder(o.id), 'Borrador eliminado') }));
      } else if (o.status !== 'cancelled') {
        act.append(h('a', { class: 'btn btn-ghost btn-sm', href: `orden.html?id=${o.id}${ctx.demo ? '&demo=1' : ''}`, target: '_blank', rel: 'noopener', text: 'Ver / imprimir' }));
        (NEXT[o.status] || []).forEach((st) => {
          act.append(h('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: ORDER_STATUS[st][0], onclick: async () => {
            if (st === 'scheduled') {
              const dt = h('input', { class: 'input', type: 'datetime-local' });
              if (!(await modal('Fecha de la cita', h('div', {}, dt)))) return;
              if (!dt.value) { toast('Elige fecha y hora', true); return; }
              run(() => api.updateOrder(o.id, { status: st, scheduled_at: new Date(dt.value).toISOString() }), 'Cita registrada');
            } else run(() => api.updateOrder(o.id, { status: st }), ORDER_STATUS[st][0]);
          } }));
        });
        if (['sample_taken', 'results_received', 'scheduled', 'sent', 'signed'].includes(o.status)) {
          act.append(h('button', { class: 'btn btn-primary btn-sm', type: 'button', text: o.order_type === 'dexa' ? 'Capturar DEXA' : 'Capturar resultados', onclick: () => (o.order_type === 'dexa' ? dexaDialog(o) : resultsDialog(o, its)) }));
          act.append(uploadButton(o));
        }
        if (o.status !== 'results_received') act.append(h('button', { class: 'btn-link btn-sm', type: 'button', text: 'Cancelar orden', onclick: async () => {
          if (await modal('Cancelar orden', h('p', { text: 'La orden quedará cancelada. El folio no se reutiliza.' }), 'Cancelar orden')) run(() => api.updateOrder(o.id, { status: 'cancelled' }), 'Orden cancelada');
        } }));
      }
      card.append(act);
      list.append(card);
    });
    root.append(h('h3', { class: 'block-title', text: 'Órdenes' }), list);

    // ---------- Resultados ----------
    root.append(h('h3', { class: 'block-title', style: 'margin-top:22px', text: 'Resultados de laboratorio' }));
    if (!results.length) root.append(h('div', { class: 'empty-state', text: 'Sin resultados capturados.' }));
    else {
      const t = h('table', { class: 'data' });
      t.append(h('thead', {}, h('tr', {}, ...['Estudio', 'Resultado', 'Referencia del laboratorio', 'Fecha', 'Orden'].map((x) => h('th', { text: x })))));
      const tb = h('tbody');
      [...results].sort((a, b) => (b.collected_at || '').localeCompare(a.collected_at || '')).forEach((r) => {
        const bm = bmById.get(r.biomarker_id);
        const out = r.value_numeric != null && ((r.lab_reference_low != null && r.value_numeric < r.lab_reference_low) || (r.lab_reference_high != null && r.value_numeric > r.lab_reference_high));
        tb.append(h('tr', {},
          h('td', {}, h('strong', { text: bm?.name_es || r.raw_name })),
          h('td', {}, `${r.value_numeric ?? r.value_text ?? '—'} ${r.unit || ''}`, out ? ' ' : null, out ? badge('block', r.value_numeric < r.lab_reference_low ? 'Bajo' : 'Alto') : null),
          h('td', { class: 'muted', text: r.lab_reference_low != null || r.lab_reference_high != null ? `${r.lab_reference_low ?? ''} – ${r.lab_reference_high ?? ''}` : '—' }),
          h('td', { class: 'muted small', text: r.collected_at || '' }),
          h('td', { class: 'muted small', text: orders.find((o) => o.id === r.order_id)?.folio || '' })));
      });
      t.append(tb);
      root.append(h('div', { class: 'table-wrap' }, t));
    }

    root.append(h('h3', { class: 'block-title', style: 'margin-top:22px', text: 'Composición corporal' }));
    if (!bodycomp.length) root.append(h('div', { class: 'empty-state', text: 'Sin mediciones.' }));
    else {
      const t = h('table', { class: 'data' });
      const cols = [['measured_at', 'Fecha'], ['method', 'Método'], ['weight_kg', 'Peso kg'], ['body_fat_pct', 'Grasa %'], ['lean_mass_kg', 'Magra kg'], ['appendicular_lean_mass_kg', 'Magra apend. kg'], ['almi', 'ALMI'], ['visceral_fat_g', 'Visceral g'], ['bmd_t_score', 'T-score']];
      t.append(h('thead', {}, h('tr', {}, ...cols.map(([, l]) => h('th', { text: l })))));
      t.append(h('tbody', {}, ...bodycomp.map((b) => h('tr', {}, ...cols.map(([k]) => h('td', { text: b[k] ?? '—' }))))));
      root.append(h('div', { class: 'table-wrap' }, t));
    }

    const loose = documents.filter((d) => !d.order_id);
    if (loose.length) {
      root.append(h('h3', { class: 'block-title', style: 'margin-top:22px', text: 'Estudios previos subidos por el paciente' }),
        h('div', { class: 'row-meta' }, ...loose.map((d) => h('a', { href: '#', text: d.original_filename || d.kind, onclick: async (e) => { e.preventDefault(); try { window.open(await api.docUrl(d.storage_path), '_blank', 'noopener'); } catch (err) { toast(err.message, true); } } }))));
    }

    // ---------- Diálogos ----------
    async function orderDialog(type) {
      const provs = providers.filter((p) => p.provider_type === 'both' || p.provider_type === type);
      const f = (l, el) => h('label', { class: 'field' }, h('span', { class: 'field-label small', text: l }), el);
      const prov = h('select', { class: 'input' }, h('option', { value: '', text: 'Elegir proveedor' }), ...provs.map((p) => h('option', { value: p.id, text: p.name })));
      const round = h('select', { class: 'input' }, h('option', { value: 'baseline', text: 'Basal' }), h('option', { value: 'followup', text: 'Seguimiento (12–16 semanas)' }), h('option', { value: 'extra', text: 'Adicional' }));
      const ind = h('textarea', { class: 'input', rows: 5 }); ind.value = DEFAULT_INDICATIONS[type](sex);
      const cost = h('input', { class: 'input', type: 'number', min: 0, step: '0.01', placeholder: 'Opcional' });
      const picks = new Map();
      const body = h('div', { class: 'stack' }, h('div', { class: 'fields-grid' }, f('Proveedor', prov), f('Ronda', round), f('Costo (MXN)', cost)));

      if (type === 'lab') {
        let sug;
        try { sug = await api.suggest(patient.id); } catch (e) { toast(e.message, true); return; }
        const alertBased = sug.filter((s) => s.reasons?.some((r) => !r.startsWith('Panel base')));
        if (alertBased.length) body.append(h('div', { class: 'notice small' }, h('strong', { text: 'Agregados por alertas: ' }), alertBased.map((s) => `${s.name_es} (${s.reasons.join('; ')})`).join(' · ')));
        const groups = new Map();
        sug.forEach((s) => { const k = s.panel_tier ? `Nivel ${s.panel_tier} · ${CATEGORY[s.category] || s.category}` : `Opcionales · ${CATEGORY[s.category] || s.category}`; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(s); });
        const box = h('div', { style: 'max-height:42vh;overflow:auto;border:1px solid var(--border);border-radius:10px;padding:8px 12px' });
        const counter = h('span', { class: 'muted small' });
        const count = () => { counter.textContent = `${[...picks.values()].filter(Boolean).length} estudios seleccionados`; };
        groups.forEach((rows, name) => {
          const checks = [];
          const head = h('div', { class: 'row-top', style: 'margin:10px 0 4px' }, h('strong', { class: 'small', text: name }),
            h('button', { class: 'btn-link small', type: 'button', text: 'todos', onclick: () => { checks.forEach((c) => { c.checked = true; picks.set(c.dataset.id, true); }); count(); } }),
            h('button', { class: 'btn-link small', type: 'button', text: 'ninguno', onclick: () => { checks.forEach((c) => { c.checked = false; picks.set(c.dataset.id, false); }); count(); } }));
          box.append(head);
          rows.forEach((s) => {
            const c = h('input', { type: 'checkbox', 'data-id': s.biomarker_id });
            c.checked = !!s.suggested; picks.set(s.biomarker_id, !!s.suggested);
            c.onchange = () => { picks.set(s.biomarker_id, c.checked); count(); };
            checks.push(c);
            const fromAlert = s.reasons?.some((r) => !r.startsWith('Panel base'));
            box.append(h('label', { class: 'small', style: 'display:flex;gap:8px;align-items:center;padding:3px 0' }, c, s.name_es, fromAlert ? badge('block', 'por alerta') : null));
          });
        });
        count();
        body.append(h('div', { class: 'row-top' }, h('strong', { text: 'Estudios' }), counter), box);
        picks.__sug = sug;
      } else {
        const box = h('div', { class: 'stack' });
        DEXA_STUDIES.forEach((name, i) => {
          const c = h('input', { type: 'checkbox' }); c.checked = i === 0; picks.set(name, c.checked);
          c.onchange = () => picks.set(name, c.checked);
          box.append(h('label', { style: 'display:flex;gap:8px;align-items:center' }, c, name));
        });
        body.append(h('strong', { text: 'Estudios' }), box);
      }
      body.append(f('Indicaciones para el paciente', ind));

      if (!(await modal(type === 'lab' ? 'Nueva orden de laboratorio' : 'Nueva orden DEXA', body, 'Guardar borrador'))) return;
      const chosen = [...picks.entries()].filter(([, v]) => v === true);
      if (!prov.value) { toast('Elige el proveedor', true); return; }
      if (!chosen.length) { toast('Selecciona al menos un estudio', true); return; }
      const rows = type === 'lab'
        ? chosen.map(([id]) => { const s = picks.__sug.find((x) => x.biomarker_id === id); return { biomarker_id: id, study_name: s.name_es, reason: (s.reasons || []).join('; ') || null }; })
        : chosen.map(([name]) => ({ biomarker_id: null, study_name: name, reason: null }));
      try {
        await api.createOrder({ patient_id: patient.id, provider_id: prov.value, order_type: type, round: round.value, indications: ind.value, cost_mxn: cost.value ? Number(cost.value) : null, created_by: me.id }, rows);
        toast('Borrador guardado; revísalo y fírmalo'); load();
      } catch (e) { toast(`No se pudo guardar: ${e.message}`, true); }
    }

    async function resultsDialog(o, its) {
      const date = h('input', { class: 'input', type: 'date', value: new Date().toISOString().slice(0, 10) });
      const table = h('table', { class: 'data' });
      table.append(h('thead', {}, h('tr', {}, ...['Estudio', 'Valor', 'Unidad', 'Ref. mín', 'Ref. máx'].map((x) => h('th', { text: x })))));
      const tb = h('tbody');
      const inputs = [];
      its.filter((i) => i.biomarker_id).forEach((i) => {
        const bm = bmById.get(i.biomarker_id);
        const prev = results.find((r) => r.order_id === o.id && r.biomarker_id === i.biomarker_id);
        const val = h('input', { class: 'input', inputmode: 'decimal', style: 'min-width:80px' }); val.value = prev?.value_numeric ?? prev?.value_text ?? '';
        const unit = h('input', { class: 'input', style: 'min-width:80px' }); unit.value = prev?.unit || bm?.default_unit || '';
        const lo = h('input', { class: 'input', inputmode: 'decimal', style: 'min-width:70px' }); lo.value = prev?.lab_reference_low ?? '';
        const hi = h('input', { class: 'input', inputmode: 'decimal', style: 'min-width:70px' }); hi.value = prev?.lab_reference_high ?? '';
        inputs.push({ i, bm, val, unit, lo, hi, prev });
        tb.append(h('tr', {}, h('td', { class: 'small', text: bm?.name_es || i.study_name }), h('td', {}, val), h('td', {}, unit), h('td', {}, lo), h('td', {}, hi)));
      });
      table.append(tb);
      const body = h('div', { class: 'stack' },
        h('label', { class: 'field' }, h('span', { class: 'field-label small', text: 'Fecha de toma de muestra' }), date),
        h('p', { class: 'muted small', text: 'Copia los valores tal como aparecen en el PDF del laboratorio. Deja vacío lo que no venga.' }),
        h('div', { class: 'table-wrap', style: 'max-height:50vh;overflow:auto' }, table));
      if (!(await modal(`Capturar resultados · ${o.folio}`, body, 'Guardar resultados'))) return;
      const num = (x) => { const n = Number(String(x).replace(',', '.').trim()); return String(x).trim() === '' || Number.isNaN(n) ? null : n; };
      const rows = inputs.filter((x) => x.val.value.trim() !== '').map((x) => ({
        id: x.prev?.id, patient_id: patient.id, order_id: o.id, biomarker_id: x.i.biomarker_id, raw_name: x.bm?.name_es || x.i.study_name,
        value_numeric: num(x.val.value), value_text: num(x.val.value) === null ? x.val.value.trim() : null, unit: x.unit.value.trim() || null,
        lab_reference_low: num(x.lo.value), lab_reference_high: num(x.hi.value), collected_at: date.value || null,
        confirmed_by: me.id, confirmed_at: new Date().toISOString(),
      }));
      if (!rows.length) { toast('No capturaste ningún valor', true); return; }
      try {
        await api.saveResults(rows);
        if (o.status !== 'results_received' && rows.length >= inputs.length * 0.5 && ['sample_taken', 'scheduled', 'sent', 'signed'].includes(o.status)) {
          if (o.status === 'sample_taken') await api.updateOrder(o.id, { status: 'results_received' });
        }
        toast(`${rows.length} resultado(s) guardado(s)`); load();
      } catch (e) { toast(`Error: ${e.message}`, true); }
    }

    async function dexaDialog(o) {
      const F = [['measured_at', 'Fecha del estudio', 'date'], ['weight_kg', 'Peso (kg)'], ['height_cm', 'Estatura (cm)'], ['body_fat_pct', 'Grasa corporal (%)'], ['fat_mass_kg', 'Masa grasa (kg)'], ['lean_mass_kg', 'Masa magra (kg)'], ['appendicular_lean_mass_kg', 'Masa magra apendicular (kg)'], ['visceral_fat_g', 'Grasa visceral (g)'], ['android_gynoid_ratio', 'Relación androide/ginoide'], ['bmd_total', 'DMO total (g/cm²)'], ['bmd_t_score', 'T-score'], ['bmd_z_score', 'Z-score'], ['resting_metabolic_rate_kcal', 'Metabolismo basal (kcal)']];
      const els = {};
      const grid = h('div', { class: 'fields-grid' }, ...F.map(([k, l, t]) => { els[k] = h('input', { class: 'input', type: t || 'text', inputmode: t ? null : 'decimal' }); if (k === 'measured_at') els[k].value = new Date().toISOString().slice(0, 10); return h('label', { class: 'field' }, h('span', { class: 'field-label small', text: l }), els[k]); }));
      if (!(await modal(`Capturar DEXA · ${o.folio}`, h('div', { class: 'stack' }, grid, h('p', { class: 'muted small', text: 'ALMI y FFMI se calculan con la estatura.' })), 'Guardar'))) return;
      const row = { patient_id: patient.id, order_id: o.id, method: 'dexa', confirmed_by: me.id };
      for (const [k] of F) { const v = els[k].value.trim(); row[k] = k === 'measured_at' ? v : (v === '' ? null : Number(v.replace(',', '.'))); }
      if (!row.measured_at) { toast('La fecha es obligatoria', true); return; }
      if (row.height_cm && row.appendicular_lean_mass_kg) row.almi = +(row.appendicular_lean_mass_kg / (row.height_cm / 100) ** 2).toFixed(2);
      if (row.height_cm && row.lean_mass_kg) row.ffmi = +(row.lean_mass_kg / (row.height_cm / 100) ** 2).toFixed(2);
      try {
        await api.saveBodyComp(row);
        if (o.status === 'sample_taken') await api.updateOrder(o.id, { status: 'results_received' });
        toast('DEXA guardado'); load();
      } catch (e) { toast(`Error: ${e.message}`, true); }
    }

    function uploadButton(o) {
      const input = h('input', { type: 'file', accept: 'application/pdf,image/*', style: 'display:none' });
      input.onchange = async () => {
        const file = input.files?.[0]; if (!file) return;
        try { await api.uploadDoc(patient.id, o, file); toast('Archivo subido'); load(); } catch (e) { toast(`Error al subir: ${e.message}`, true); }
      };
      return h('span', {}, input, h('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: 'Subir PDF', onclick: () => input.click() }));
    }
  };
  load();
}
