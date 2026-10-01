// Pestaña "Plan": genera el borrador desde el semáforo, deja que el médico capture
// las indicaciones y lo firma. Sin dosis concreta no se puede firmar: lo bloquea la base.
const CATEGORIAS = [
  ['peptide', 'Péptidos'], ['medication', 'Medicamentos'], ['supplement', 'Suplementos'],
  ['nutrition', 'Alimentación'], ['exercise', 'Ejercicio'], ['sleep', 'Sueño'],
  ['stress', 'Estrés'], ['referral', 'Interconsulta'], ['lab_followup', 'Monitoreo'], ['other', 'Otro'],
];
const NOMBRE_CAT = Object.fromEntries(CATEGORIAS);
const CON_DOSIS = ['supplement', 'peptide', 'medication'];
const ESTADO = {
  ai_draft: ['Borrador', 'amarillo'], in_review: ['En revisión', 'amarillo'],
  approved: ['Firmado', 'verde'], delivered: ['Entregado', 'verde'],
  superseded: ['Reemplazado', ''], cancelled: ['Cancelado', ''],
};
const dosisOk = (d, r) => {
  const t = String(d || '').toLowerCase();
  const re = String(r || '').toLowerCase();
  if (!t || !/\d/.test(t)) return false;
  if (/(seg[uú]n|variable|indeterminad|a criterio|por definir|reconstitu|protocolo del stack)/.test(t)) return false;
  if (/(mcg|µg|ug|\bmg\b|\bg\b|\bkg\b|g\/kg|\bui\b|\biu\b)/.test(t)) return true;
  if (/(\bu\b|unidad|unidades|\bml\b|\bcc\b)/.test(t)) return /\d/.test(re) && /(mcg|µg|ug|\bmg\b|\bg\b)/.test(re);
  if (/(\bcap|\btab|porcion|porciones|gotas)/.test(t)) return true;
  return false;
};

export function renderPlanTab(root, ctx) {
  const { h, modal, toast, api, patient, me, demo } = ctx;
  const esMedico = (me?.roles || []).includes('physician');

  const load = async () => {
    root.innerHTML = '';
    root.append(h('div', { class: 'spinner' }));
    let data;
    try { data = await api.plans(patient.id); }
    catch (e) { root.innerHTML = ''; root.append(h('div', { class: 'notice danger', text: e.message })); return; }
    root.innerHTML = '';
    const { plans, items } = data;
    const vigente = plans.find((p) => ['ai_draft', 'in_review', 'approved', 'delivered'].includes(p.status));

    root.append(h('div', { class: 'toolbar', style: 'margin-bottom:12px' },
      h('button', { class: 'btn btn-primary btn-sm', type: 'button',
        text: vigente ? '↻ Regenerar borrador' : '+ Generar plan', onclick: generar })));

    if (!vigente) {
      root.append(h('div', { class: 'empty-state', text: 'Todavía no hay plan. Genera el borrador cuando el panel de laboratorio esté capturado.' }));
      return;
    }

    const mios = items.filter((i) => i.protocol_id === vigente.id && i.is_active);
    const firmado = ['approved', 'delivered'].includes(vigente.status);
    const [etiqueta, color] = ESTADO[vigente.status] || ['—', ''];
    const rev = vigente.ai_draft?.revisiones || [];
    const sinDosis = mios.filter((i) => CON_DOSIS.includes(i.category) && !dosisOk(i.dose, i.reconstitution));

    root.append(h('div', { class: 'row-card' },
      h('div', { class: 'row-head' },
        h('strong', { text: `Plan versión ${vigente.version}` }),
        color ? h('span', { class: `pill ${color}`, text: etiqueta }) : null),
      h('div', { class: 'row-meta' },
        `${(vigente.ai_draft?.hallazgos || []).length} hallazgo(s)`,
        `${mios.length} indicación(es)`,
        rev.length ? `${rev.length} punto(s) a revisar` : 'sin pendientes de revisión',
        vigente.signed_at ? `Firmado ${new Date(vigente.signed_at).toLocaleDateString('es-MX')}` : null),
      h('div', { class: 'toolbar' },
        h('a', { class: 'btn btn-ghost btn-sm', href: `plan.html?id=${vigente.id}${demo ? '&demo=1' : ''}`, target: '_blank', rel: 'noopener', text: 'Ver / imprimir' }),
        !firmado ? h('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: '+ Indicación', onclick: () => editar(vigente.id, null) }) : null,
        !firmado ? h('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: 'Notas del médico', onclick: () => notas(vigente) }) : null,
        !firmado && esMedico ? h('button', { class: 'btn btn-primary btn-sm', type: 'button', text: 'Firmar plan', onclick: () => firmar(vigente) }) : null,
        !firmado && !esMedico ? h('span', { class: 'muted small', text: 'Sólo un médico puede firmarlo' }) : null,
        vigente.status === 'approved' ? h('button', { class: 'btn btn-primary btn-sm', type: 'button', text: 'Entregar al paciente', onclick: () => entregar(vigente) }) : null)));

    if (sinDosis.length) {
      root.append(h('div', { class: 'notice danger', style: 'margin-top:12px' },
        h('b', { text: `${sinDosis.length} indicación(es) sin dosis concreta. ` }),
        'No se puede firmar hasta que cada una tenga cantidad y unidad: ',
        sinDosis.map((i) => i.title).join(', '), '.'));
    }

    if (rev.length) {
      const caja = h('div', { class: 'notice', style: 'margin-top:12px' },
        h('b', { text: 'Para revisión antes de firmar' }));
      const ul = h('ul', { class: 'small', style: 'margin:6px 0 0;padding-left:18px' });
      rev.slice(0, 12).forEach((r) => ul.append(h('li', { text: r.texto })));
      if (rev.length > 12) ul.append(h('li', { class: 'muted', text: `y ${rev.length - 12} más, en la hoja impresa.` }));
      caja.append(ul);
      root.append(caja);
    }

    // ---- indicaciones por categoría ----
    CATEGORIAS.forEach(([cat, nombre]) => {
      const propias = mios.filter((i) => i.category === cat);
      if (!propias.length) return;
      const t = h('table', { class: 'data' });
      t.append(h('thead', {}, h('tr', {}, ...['Qué', 'Dosis', 'Horario', 'Para qué', ''].map((x) => h('th', { text: x })))));
      const tb = h('tbody');
      propias.forEach((i) => {
        const mal = CON_DOSIS.includes(cat) && !dosisOk(i.dose, i.reconstitution);
        tb.append(h('tr', {},
          h('td', {}, h('strong', { text: i.title }),
            i.instructions ? h('div', { class: 'muted small', text: i.instructions }) : null),
          h('td', {}, CON_DOSIS.includes(cat)
            ? (mal ? h('span', { class: 'pill rojo', text: i.dose || 'sin dosis' }) : h('span', { text: i.dose }))
            : h('span', { class: 'muted small', text: '—' }),
            i.reconstitution ? h('div', { class: 'muted small', text: i.reconstitution }) : null),
          h('td', { class: 'small', text: [i.timing, i.frequency].filter(Boolean).join(' · ') || '—' }),
          h('td', { class: 'small', text: i.rationale || '—' }),
          h('td', {}, firmado ? null : h('span', {},
            h('button', { class: 'btn-link btn-sm', type: 'button', text: 'Editar', onclick: () => editar(vigente.id, i) }),
            h('button', { class: 'btn-link btn-sm', type: 'button', text: 'Quitar', onclick: async () => {
              if (!(await modal('Quitar indicación', h('p', { text: `Se quita "${i.title}" del plan.` }), 'Quitar'))) return;
              try { await api.removePlanItem(i.id); toast('Quitada'); load(); } catch (e) { toast(`Error: ${e.message}`, true); }
            } })))));
      });
      t.append(tb);
      root.append(h('h3', { class: 'block-title', style: 'margin-top:18px', text: nombre }), h('div', { class: 'table-wrap' }, t));
    });

    async function generar() {
      const texto = vigente
        ? 'Se genera una versión nueva del borrador a partir del panel actual. La versión anterior queda marcada como reemplazada; las indicaciones que ya capturaste NO se copian.'
        : 'Se genera el borrador con los hallazgos, las metas y los puntos a revisar. El tratamiento lo captura el médico.';
      if (!(await modal('Generar plan', h('p', { text: texto }), 'Generar'))) return;
      try { const r = await api.generatePlan(patient.id); toast(`Versión ${r.version} · ${r.hallazgos} hallazgo(s)`); load(); }
      catch (e) { toast(`Error: ${e.message}`, true); }
    }

    async function editar(planId, item) {
      const campo = (l, el) => h('label', { class: 'field' }, h('span', { class: 'field-label small', text: l }), el);
      const cat = h('select', { class: 'input' }, ...CATEGORIAS.map(([v, n]) => h('option', { value: v, text: n })));
      cat.value = item?.category || 'supplement';
      const titulo = h('input', { class: 'input', type: 'text' }); titulo.value = item?.title || '';
      const dosis = h('input', { class: 'input', type: 'text', placeholder: 'p. ej. 500 mg · 2 g · 5000 UI' }); dosis.value = item?.dose || '';
      const recon = h('input', { class: 'input', type: 'text', placeholder: 'p. ej. 50 mg en 5 mL (10 mg/mL)' }); recon.value = item?.reconstitution || '';
      const horario = h('input', { class: 'input', type: 'text', placeholder: 'mañana con comida' }); horario.value = item?.timing || '';
      const frec = h('input', { class: 'input', type: 'text', placeholder: 'diario · 3 veces por semana' }); frec.value = item?.frequency || '';
      const motivo = h('input', { class: 'input', type: 'text' }); motivo.value = item?.rationale || '';
      const instr = h('textarea', { class: 'input', rows: 3 }); instr.value = item?.instructions || '';
      const aviso = h('p', { class: 'muted small', text: 'La dosis necesita cantidad y unidad. Si la pones en unidades o mL, la reconstitución es obligatoria: sin ella nadie puede saber cuántos mg recibe el paciente.' });

      if (!(await modal(item ? 'Editar indicación' : 'Nueva indicación',
        h('div', { class: 'stack' }, campo('Categoría', cat), campo('Qué', titulo), campo('Dosis', dosis), campo('Reconstitución del vial', recon),
          h('div', { class: 'fields-grid' }, campo('Horario', horario), campo('Frecuencia', frec)),
          campo('Para qué', motivo), campo('Instrucciones', instr), aviso), 'Guardar'))) return;

      if (!titulo.value.trim()) { toast('Falta el nombre de la indicación', true); return; }
      if (CON_DOSIS.includes(cat.value) && !dosisOk(dosis.value, recon.value)) {
        toast(/(\bu\b|unidad|ml|cc)/i.test(dosis.value)
          ? 'Una dosis en unidades o mL necesita la reconstitución en mg, p. ej. "50 mg en 5 mL"'
          : 'La dosis necesita cantidad y unidad (mg, mcg, UI, g)', true);
        return;
      }
      try {
        await api.savePlanItem(planId, {
          id: item?.id, category: cat.value, title: titulo.value.trim(), dose: dosis.value.trim() || null,
          reconstitution: recon.value.trim() || null,
          timing: horario.value.trim() || null, frequency: frec.value.trim() || null,
          rationale: motivo.value.trim() || null, instructions: instr.value.trim() || null,
          sort_order: item?.sort_order ?? 50,
        });
        toast('Guardado'); load();
      } catch (e) { toast(`Error: ${e.message}`, true); }
    }

    async function notas(plan) {
      const t = h('textarea', { class: 'input', rows: 6 }); t.value = plan.physician_notes || '';
      if (!(await modal('Notas del médico', h('div', { class: 'stack' }, t,
        h('p', { class: 'muted small', text: 'Aparecen en la hoja impresa del plan.' })), 'Guardar'))) return;
      try { await api.savePlanNotes(plan.id, t.value.trim() || null); toast('Guardado'); load(); }
      catch (e) { toast(`Error: ${e.message}`, true); }
    }

    async function firmar(plan) {
      const cuerpo = h('div', { class: 'stack' },
        h('p', { text: 'Al firmar, el plan queda a tu nombre, desaparece la marca de agua y puede entregarse al paciente.' }),
        rev.length ? h('div', { class: 'notice small', text: `Quedan ${rev.length} punto(s) marcados para revisión. Revísalos antes de firmar.` }) : null,
        h('div', { class: 'notice small', text: 'Confirma que revisaste cada indicación, su dosis y sus interacciones.' }));
      if (!(await modal('Firmar plan', cuerpo, 'Firmar'))) return;
      try { await api.signPlan(plan.id); toast('Plan firmado'); load(); }
      catch (e) { toast(e.message, true); }
    }

    async function entregar(plan) {
      if (!(await modal('Entregar al paciente', h('p', { text: 'El plan queda disponible para el paciente.' }), 'Entregar'))) return;
      try { await api.deliverPlan(plan.id); toast('Entregado'); load(); }
      catch (e) { toast(`Error: ${e.message}`, true); }
    }
  };
  load();
}
