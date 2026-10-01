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
    let data, catalogos = { supplements: [], peptides: [], exercises: [] };
    let sugerencias = [], sugErr = null;
    try {
      data = await api.plans(patient.id);
      catalogos = await api.catalogs();
    } catch (e) { root.innerHTML = ''; root.append(h('div', { class: 'notice danger', text: e.message })); return; }
    // Las sugerencias son un extra: si fallan, la pestaña sigue sirviendo.
    try { sugerencias = await api.suggestions(patient.id); }
    catch (e) { sugErr = `No se pudieron calcular las sugerencias: ${e.message}`; }
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

    // ---- sugerencias del sistema ----
    if (!firmado) root.append(bloqueSugerencias());

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

    function bloqueSugerencias() {
      const ESTADO_SUG = {
        sugerido: ['Sugerido', 'verde'], revisar: ['Falta un dato', 'amarillo'], bloqueado: ['Bloqueado', 'rojo'],
      };
      const caja = h('div', { class: 'row-card', style: 'margin-top:18px' },
        h('div', { class: 'row-head' },
          h('strong', { text: 'Sugerencias del sistema' }),
          h('span', { class: 'pill', text: `${sugerencias.length} regla(s)` })));
      if (sugErr) { caja.append(h('div', { class: 'notice danger', text: sugErr })); return caja; }
      if (!sugerencias.length) {
        caja.append(h('p', { class: 'muted small', style: 'margin:4px 0 0',
          text: 'Ninguna regla se dispara con el panel actual. Si acabas de capturar laboratorios, corre "Evaluar laboratorios" en Estudios y vuelve a entrar.' }));
        return caja;
      }
      caja.append(h('p', { class: 'muted small', style: 'margin:4px 0 0' },
        'Se calculan desde el semáforo funcional y el cuestionario. Nada entra al plan hasta que lo selecciones: la dosis y la decisión siguen siendo del médico. ',
        sugerencias.some((r) => !r.firmado)
          ? h('b', { text: 'Las reglas todavía no están firmadas por un médico.' }) : null));

      const yaEnPlan = new Set(mios.map((i) => String(i.title || '').trim().toLowerCase()));
      const yaSugerido = new Set(); // la misma cosa se repite en varias reglas: se marca una vez
      const seleccion = new Map();
      const btn = h('button', { class: 'btn btn-primary btn-sm', type: 'button', disabled: true,
        text: 'Agregar seleccionadas al plan', onclick: agregar });
      const refrescar = () => {
        btn.disabled = seleccion.size === 0;
        btn.textContent = seleccion.size ? `Agregar ${seleccion.size} al plan` : 'Agregar seleccionadas al plan';
      };

      sugerencias.forEach((r, ri) => {
        const [et, col] = ESTADO_SUG[r.estado] || ['—', ''];
        const bloque = h('div', { class: `sug-rule ${r.estado}` },
          h('div', { class: 'sug-head' },
            h('strong', { text: r.titulo }),
            h('span', { class: `pill ${col}`, text: et }),
            r.evidencia ? h('span', { class: 'sug-cat', text: `Evidencia ${r.evidencia}` }) : null,
            !r.firmado ? h('span', { class: 'sug-cat', text: 'regla sin firmar' }) : null),
          r.razon ? h('p', { class: 'sug-razon', text: r.razon }) : null);

        const disp = Object.entries(r.disparado_por || {});
        if (disp.length) {
          const linea = h('p', { class: 'sug-disparo' }, 'Se disparó por: ');
          disp.forEach(([k, v]) => linea.append(h('code', { text: `${k} ${v}` })));
          bloque.append(linea);
        }
        (r.motivos || []).forEach((m) => bloque.append(h('div', {
          class: r.estado === 'bloqueado' ? 'notice danger small' : 'notice warn small',
          style: 'margin-top:7px', text: m })));

        const permitido = r.estado !== 'bloqueado';
        const lista = h('div', { class: 'sug-items' });
        (r.sugerencias || []).forEach((it, ii) => {
          const clave = `${ri}:${ii}`;
          const llave = String(it.titulo || '').trim().toLowerCase();
          const yaEsta = yaEnPlan.has(llave);
          const repetida = !yaEsta && yaSugerido.has(llave);
          yaSugerido.add(llave);
          const noAprobado = it.regulatorio && !/^aprobado/i.test(it.regulatorio);
          const conDosis = CON_DOSIS.includes(it.cat);
          const dosisFloja = conDosis && !dosisOk(it.dosis, it.reconstitucion);
          // Por defecto marcamos lo que no exige una decisión aparte: ni péptidos ni
          // medicamentos, nada sin registro sanitario, nada de una regla con un dato
          // faltante, y nada que ya esté en el plan.
          const porDefecto = r.estado === 'sugerido' && !yaEsta && !repetida && !noAprobado
            && it.cat !== 'peptide' && it.cat !== 'medication';
          const ck = h('input', { type: 'checkbox', checked: porDefecto, disabled: yaEsta || !permitido });
          const fila = h('div', { class: `sug-item${yaEsta || !permitido ? ' off' : ''}` }, ck,
            h('div', { class: 'cuerpo' },
              h('div', { class: 'tit' },
                h('span', { text: it.titulo }),
                h('span', { class: 'sug-cat', text: NOMBRE_CAT[it.cat] || it.cat }),
                yaEsta ? h('span', { class: 'pill verde', text: 'ya en el plan' }) : null,
                repetida ? h('span', { class: 'sug-cat', text: 'ya sugerido arriba' }) : null,
                dosisFloja ? h('span', { class: 'pill amarillo', text: 'ajustar dosis' }) : null),
              h('div', { class: 'det', text: [
                conDosis && it.dosis ? it.dosis : null,
                [it.horario, it.frecuencia].filter(Boolean).join(' · ') || null,
                it.proposito || null,
              ].filter(Boolean).join(' — ') || '—' }),
              it.nota ? h('div', { class: 'det', text: it.nota }) : null,
              it.precauciones ? h('div', { class: 'det', text: `Precauciones: ${it.precauciones}` }) : null,
              noAprobado ? h('div', { class: 'reg', text: it.regulatorio }) : null));
          const payload = {
            category: it.cat,
            title: it.titulo,
            dose: conDosis ? (it.dosis || null) : null,
            reconstitution: it.cat === 'peptide' ? (it.reconstitucion || null) : null,
            timing: it.horario || null,
            frequency: it.frecuencia || null,
            rationale: it.proposito || r.titulo,
            instructions: [
              it.nota || null,
              it.precauciones ? `Precauciones: ${it.precauciones}` : null,
              it.interacciones ? `Interacciones: ${it.interacciones}` : null,
              noAprobado ? it.regulatorio : null,
              `Sugerido por la regla ${r.code}`,
            ].filter(Boolean).join(' · '),
            sort_order: 50 + ii,
          };
          if (porDefecto) seleccion.set(clave, payload);
          ck.addEventListener('change', () => {
            if (ck.checked) seleccion.set(clave, payload); else seleccion.delete(clave);
            refrescar();
          });
          lista.append(fila);
        });
        bloque.append(lista);
        caja.append(bloque);
      });

      caja.append(h('div', { class: 'toolbar', style: 'margin-top:12px' }, btn,
        h('span', { class: 'muted small', text: 'Lo que agregues queda como indicación editable: revisa dosis y horario antes de firmar.' })));
      refrescar();
      return caja;

      async function agregar() {
        // Si el médico marca la misma cosa en dos reglas, entra una sola vez.
        const vistos = new Set(mios.map((i) => String(i.title || '').trim().toLowerCase()));
        const items = [];
        for (const it of seleccion.values()) {
          const k = String(it.title || '').trim().toLowerCase();
          if (vistos.has(k)) continue;
          vistos.add(k); items.push(it);
        }
        if (!items.length) { toast('Lo seleccionado ya está en el plan', true); return; }
        const pep = items.filter((i) => i.category === 'peptide' || i.category === 'medication');
        const cuerpo = h('div', { class: 'stack' },
          h('p', { text: `Se agregan ${items.length} indicación(es) al plan versión ${vigente.version}.` }),
          pep.length ? h('div', { class: 'notice danger small',
            text: `Incluye ${pep.length} péptido(s) o medicamento(s): ${pep.map((i) => i.title).join(', ')}. Confirma dosis, vía y consentimiento.` }) : null,
          h('p', { class: 'muted small', text: 'Quedan como borrador editable. Ninguna se firma por agregarse.' }));
        if (!(await modal('Agregar al plan', cuerpo, 'Agregar'))) return;
        btn.disabled = true;
        let ok = 0; const fallos = [];
        for (const it of items) {
          try { await api.savePlanItem(vigente.id, it); ok += 1; }
          catch (e) { fallos.push(`${it.title}: ${e.message}`); }
        }
        if (fallos.length) toast(`${ok} agregada(s), ${fallos.length} con error: ${fallos[0]}`, true);
        else toast(`${ok} indicación(es) agregada(s)`);
        load();
      }
    }

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
      const picker = h('select', { class: 'input' });
      const avisoReg = h('p', { class: 'small', style: 'margin:4px 0 0' });
      const titulo = h('input', { class: 'input', type: 'text' }); titulo.value = item?.title || '';
      const dosis = h('input', { class: 'input', type: 'text', placeholder: 'p. ej. 500 mg · 2 g · 5000 UI' }); dosis.value = item?.dose || '';
      const recon = h('input', { class: 'input', type: 'text', placeholder: 'p. ej. 50 mg en 5 mL (10 mg/mL)' }); recon.value = item?.reconstitution || '';
      const horario = h('input', { class: 'input', type: 'text', placeholder: 'mañana con comida' }); horario.value = item?.timing || '';
      const frec = h('input', { class: 'input', type: 'text', placeholder: 'diario · 3 veces por semana' }); frec.value = item?.frequency || '';
      const motivo = h('input', { class: 'input', type: 'text' }); motivo.value = item?.rationale || '';
      const instr = h('textarea', { class: 'input', rows: 3 }); instr.value = item?.instructions || '';
      const aviso = h('p', { class: 'muted small', text: 'La dosis necesita cantidad y unidad. Si la pones en unidades o mL, la reconstitución es obligatoria: sin ella nadie puede saber cuántos mg recibe el paciente.' });

      const llenarPicker = () => {
        const lista = cat.value === 'supplement' ? cat_sup : cat.value === 'peptide' ? cat_pep
          : cat.value === 'exercise' ? cat_ejer : [];
        picker.innerHTML = '';
        picker.append(h('option', { value: '', text: lista.length ? '— elegir del catálogo —' : 'sin catálogo para esta categoría' }));
        lista.forEach((c) => picker.append(h('option', { value: c.code, text: c.name_es })));
        picker.disabled = !lista.length;
        avisoReg.textContent = '';
      };
      const cat_sup = catalogos.supplements || [], cat_pep = catalogos.peptides || [], cat_ejer = catalogos.exercises || [];
      cat.addEventListener('change', llenarPicker);
      picker.addEventListener('change', () => {
        const lista = cat.value === 'supplement' ? cat_sup : cat.value === 'peptide' ? cat_pep : cat_ejer;
        const c = lista.find((x) => x.code === picker.value);
        avisoReg.textContent = '';
        if (!c) return;
        titulo.value = c.name_es;
        dosis.value = c.default_dose || c.typical_dose || '';
        recon.value = c.reconstitution_hint || '';
        horario.value = c.default_timing || c.sets_reps_hint || '';
        frec.value = c.frequency || '';
        motivo.value = c.purpose || '';
        instr.value = [c.cautions ? `Precauciones: ${c.cautions}` : null,
                       c.interactions ? `Interacciones: ${c.interactions}` : null,
                       c.monitoring ? `Monitoreo: ${c.monitoring}` : null].filter(Boolean).join(' · ');
        if (c.regulatory_status && c.regulatory_status !== 'aprobado') {
          avisoReg.style.color = 'var(--danger)';
          avisoReg.textContent = `${c.regulatory_status === 'investigacion' ? 'EN INVESTIGACIÓN' : 'NO APROBADO PARA USO HUMANO'} · ${c.regulatory_note || ''}`;
        }
      });
      llenarPicker();

      if (!(await modal(item ? 'Editar indicación' : 'Nueva indicación',
        h('div', { class: 'stack' }, campo('Categoría', cat), campo('Del catálogo', picker), avisoReg, campo('Qué', titulo), campo('Dosis', dosis), campo('Reconstitución del vial', recon),
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
