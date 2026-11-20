// Pestaña "Plan": genera el borrador desde el semáforo, deja que el médico capture
// las indicaciones y lo firma. Sin dosis concreta no se puede firmar: lo bloquea la base.
import {
  JERINGAS, DIAS, mgDeUnidades, mlDeUnidades, concentracion,
  textoMg, textoMl, textoConc, etiquetaDias, jeringaHorizontal, faltaParaAuditar,
} from './peptido.js';

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
    const revTodas = vigente.ai_draft?.revisiones || [];
    // Los valores sin confirmar venían como un renglón por marcador: veinte
    // frases idénticas que tapaban los puntos que sí hay que leer. Se cuentan
    // en una sola línea, y no se imprimen en la hoja del paciente: eso es
    // control interno, no información para quien recibe el plan.
    const revSinConf = revTodas.filter((r) => r.tipo === 'sin_confirmar');
    const rev = revTodas.filter((r) => r.tipo !== 'sin_confirmar');
    const sinDosis = mios.filter((i) => CON_DOSIS.includes(i.category) && !dosisOk(i.dose, i.reconstitution));

    root.append(h('div', { class: 'row-card' },
      h('div', { class: 'row-head' },
        h('strong', { text: `Plan versión ${vigente.version}` }),
        color ? h('span', { class: `pill ${color}`, text: etiqueta }) : null),
      h('div', { class: 'row-meta' },
        `${(vigente.ai_draft?.hallazgos || []).length} hallazgo(s)`,
        `${mios.length} indicación(es)`,
        rev.length ? `${rev.length} punto(s) a revisar` : 'sin pendientes de revisión',
        revSinConf.length ? `${revSinConf.length} valor(es) sin confirmar` : null,
        vigente.signed_at ? `Firmado ${new Date(vigente.signed_at).toLocaleDateString('es-MX')}` : null),
      h('div', { class: 'toolbar' },
        h('a', { class: 'btn btn-ghost btn-sm', href: `plan.html?id=${vigente.id}${demo ? '&demo=1' : ''}`, target: '_blank', rel: 'noopener', text: 'Ver / imprimir' }),
        !firmado ? h('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: '+ Indicación', onclick: () => editar(vigente.id, null) }) : null,
        !firmado ? h('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: 'Notas del médico', onclick: () => notas(vigente) }) : null,
        !firmado && esMedico ? h('button', { class: 'btn btn-primary btn-sm', type: 'button', text: 'Firmar plan', onclick: () => firmar(vigente) }) : null,
        !firmado && !esMedico ? h('span', { class: 'muted small', text: 'Sólo un médico puede firmarlo' }) : null,
        vigente.status === 'approved' ? h('button', { class: 'btn btn-primary btn-sm', type: 'button', text: 'Entregar al paciente', onclick: () => entregar(vigente) }) : null)));

    if (sinDosis.length && !firmado) {
      root.append(h('div', { class: 'notice warn', style: 'margin-top:12px' },
        h('b', { text: `${sinDosis.length} indicación(es) sin dosis auditable: ` }),
        sinDosis.map((i) => i.title).join(', '), '. ',
        'Se pueden guardar así. Si firmas el plan con ellas, la firma queda registrada como ',
        h('b', { text: 'firmada reconociendo dosis no auditables' }), ' y esos renglones salen marcados en la hoja.'));
    }
    const firmoSinDosis = vigente.ai_draft?.firmado_con_dosis_no_auditable;
    if (firmado && firmoSinDosis) {
      root.append(h('div', { class: 'notice warn', style: 'margin-top:12px' },
        h('b', { text: `Firmado reconociendo ${firmoSinDosis.renglones} renglón(es) sin dosis auditable: ` }),
        (firmoSinDosis.titulos || []).join(', '), '.'));
    }

    if (rev.length || revSinConf.length) {
      const caja = h('div', { class: 'notice', style: 'margin-top:12px' },
        h('b', { text: 'Para revisión antes de firmar' }));
      const ul = h('ul', { class: 'small', style: 'margin:6px 0 0;padding-left:18px' });
      rev.slice(0, 12).forEach((r) => ul.append(h('li', { text: r.texto })));
      if (rev.length > 12) ul.append(h('li', { class: 'muted', text: `y ${rev.length - 12} más, en la hoja impresa.` }));
      if (revSinConf.length) {
        ul.append(h('li', {},
          `${revSinConf.length} valor(es) del panel se leyeron de un archivo y no se han confirmado contra el estudio original. `,
          h('button', { class: 'btn-link btn-sm', type: 'button', text: 'Confirmarlos en Estudios',
            onclick: () => { const t = [...document.querySelectorAll('[role=tab]')].find((b) => b.textContent.trim() === 'Estudios'); t?.click(); } })));
      }
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
      const aviso = h('p', { class: 'muted small', text: 'Para guardar basta con que la casilla traiga algo. Para firmar el plan, la dosis necesita cantidad y unidad; si la pones en unidades o mL, hace falta la reconstitución, porque sin ella nadie puede saber cuántos mg recibe el paciente.' });

      const GRUPO_REG = [
        ['aprobado', 'Con registro sanitario'],
        ['investigacion', 'En investigación clínica'],
        ['no_aprobado_uso_humano', 'Sin aprobación para uso humano'],
        ['suplemento', 'Como suplemento'],
      ];
      const llenarPicker = () => {
        const lista = cat.value === 'supplement' ? cat_sup : cat.value === 'peptide' ? cat_pep
          : cat.value === 'exercise' ? cat_ejer : [];
        picker.innerHTML = '';
        picker.append(h('option', { value: '', text: lista.length ? '— elegir del catálogo —' : 'sin catálogo para esta categoría' }));
        // Los péptidos se agrupan por estatus regulatorio: lo que tiene registro
        // va primero, para que elegir un peptido sin aprobación sea deliberado.
        if (cat.value === 'peptide' && lista.some((c) => c.regulatory_status)) {
          GRUPO_REG.forEach(([est, titulo]) => {
            const propios = lista.filter((c) => c.regulatory_status === est);
            if (!propios.length) return;
            const g = h('optgroup', { label: `${titulo} (${propios.length})` });
            propios.forEach((c) => g.append(h('option', { value: c.code, text: c.name_es })));
            picker.append(g);
          });
          const resto = lista.filter((c) => !GRUPO_REG.some(([e]) => e === c.regulatory_status));
          resto.forEach((c) => picker.append(h('option', { value: c.code, text: c.name_es })));
        } else {
          lista.forEach((c) => picker.append(h('option', { value: c.code, text: c.name_es })));
        }
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

      /* ---------- péptidos: el vial, las unidades y los días ----------
         Las unidades solas no son una dosis. Mientras falten los mg y los mL
         del vial, lo que se teclee aquí NO se guarda como dosis estructurada:
         se guarda como texto, igual que antes, y el plan no se va a poder
         firmar. Así se captura rápido sin inventar un dato que no existe. */
      const nIn = (ph, paso) => h('input', { class: 'input', type: 'number', min: '0', step: paso, placeholder: ph });
      const vialMg = nIn('40', '0.5'); vialMg.value = item?.vial_mg ?? '';
      const vialMl = nIn('3', '0.1'); vialMl.value = item?.vial_ml ?? '';
      const unidades = nIn('30', '1'); unidades.value = item?.dose_un ?? '';
      const jeringa = h('select', { class: 'input' },
        h('option', { value: '', text: '— elegir —' }),
        ...JERINGAS.map(([v, n]) => h('option', { value: v, text: n })));
      jeringa.value = item?.syringe || 'U-100';
      const vistaPep = h('div', { style: 'border:1px solid var(--line,#dfe4e0);border-radius:10px;padding:10px;background:#fff' });
      const chips = h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap' });
      const dias = new Set((item?.days_of_week || []).map(Number));

      const pintarChips = () => {
        chips.innerHTML = '';
        DIAS.forEach(([n, corto, largo]) => {
          const on = dias.has(n);
          const b = h('button', {
            type: 'button', text: corto, title: largo, 'aria-pressed': on ? 'true' : 'false',
            style: `font:inherit;font-size:12px;font-weight:700;letter-spacing:.03em;min-width:52px;padding:9px 0;border-radius:9px;cursor:pointer;`
              + (on ? 'border:1px solid #0f241d;background:#0f241d;color:#fff;'
                    : 'border:1px solid #c9cfcb;background:#fff;color:#5c6660;'),
            onclick: () => { if (dias.has(n)) dias.delete(n); else dias.add(n); pintarChips(); repintarPep(); },
          });
          chips.append(b);
        });
      };

      const repintarPep = () => {
        const it = { dose_un: unidades.value, vial_mg: vialMg.value, vial_ml: vialMl.value, syringe: jeringa.value };
        const falta = faltaParaAuditar(it);
        const mg = mgDeUnidades({ un: unidades.value, vial_mg: vialMg.value, vial_ml: vialMl.value, jeringa: jeringa.value });
        const ml = mlDeUnidades(unidades.value, jeringa.value);
        const c = concentracion(vialMg.value, vialMl.value);
        const marcados = [...dias].sort((a, b) => a - b);
        vistaPep.innerHTML = '';
        if (!String(unidades.value).trim()) {
          vistaPep.append(h('p', { class: 'muted small', style: 'margin:0',
            text: 'Si la dosis va en miligramos, deja las unidades vacías y usa la casilla de Dosis.' }));
          return;
        }
        vistaPep.insertAdjacentHTML('beforeend', jeringaHorizontal(unidades.value, jeringa.value || 'U-100'));
        if (falta.length) {
          vistaPep.append(h('p', { style: 'margin:8px 0 0;font-size:13px;font-weight:600;color:var(--danger,#c0521a)',
            text: `${unidades.value} UN no es una dosis todavía: ${falta.length > 1 ? 'faltan' : 'falta'} ${falta.join(' y ')}.` }));
          vistaPep.append(h('p', { class: 'muted small', style: 'margin:4px 0 0',
            text: 'Se guarda como texto y el plan no se podrá firmar con este renglón.' }));
        } else {
          vistaPep.append(h('p', { style: 'margin:8px 0 0;font-size:15px;font-weight:700',
            text: `${unidades.value} UN = ${textoMl(ml)} = ${textoMg(mg)}` }));
          vistaPep.append(h('p', { class: 'muted small', style: 'margin:4px 0 0',
            text: `Vial de ${textoConc(c)}. ${marcados.length ? etiquetaDias(marcados) : 'Faltan los días.'}` }));
        }
      };
      [vialMg, vialMl, unidades].forEach((el) => el.addEventListener('input', repintarPep));
      jeringa.addEventListener('change', repintarPep);
      pintarChips();
      repintarPep();

      const bloquePep = h('div', { class: 'stack', style: 'border-left:3px solid #0f241d;padding-left:12px' },
        h('p', { class: 'small', style: 'margin:0;font-weight:700', text: 'El vial que vas a entregar' }),
        h('div', { class: 'fields-grid' }, campo('mg por vial', vialMg), campo('mL de diluyente', vialMl)),
        h('div', { class: 'fields-grid' }, campo('Jeringa', jeringa), campo('Unidades (UN)', unidades)),
        vistaPep,
        h('p', { class: 'small', style: 'margin:8px 0 0;font-weight:700', text: 'Qué días se la aplica' }),
        chips,
        h('p', { class: 'muted small', style: 'margin:0',
          text: 'Si un día marcado no se cumple, el renglón NO desaparece: le sigue apareciendo al paciente con los días de retraso.' }));

      const verBloquePep = () => { bloquePep.style.display = cat.value === 'peptide' ? '' : 'none'; };
      cat.addEventListener('change', verBloquePep);
      verBloquePep();

      const cuerpoForm = h('div', { class: 'stack' }, campo('Categoría', cat), campo('Del catálogo', picker), avisoReg, campo('Qué', titulo), bloquePep, campo('Dosis', dosis), campo('Reconstitución del vial', recon),
        h('div', { class: 'fields-grid' }, campo('Horario', horario), campo('Frecuencia', frec)),
        campo('Para qué', motivo), campo('Instrucciones', instr), aviso);

      // El formulario se vuelve a abrir con lo que ya escribiste cuando falta un
      // campo. Antes se cerraba y se perdía la captura: eso hacía ver el aviso
      // de dosis como un muro.
      for (;;) {
        if (!(await modal(item ? 'Editar indicación' : 'Nueva indicación', cuerpoForm, 'Guardar'))) return;
        if (!titulo.value.trim()) { toast('Falta el nombre de la indicación', true); continue; }
        // Guardar no exige una dosis auditable, sólo que la casilla traiga algo:
        // el médico captura primero y afina después. La dosis se vuelve requisito
        // al firmar, no al escribir.
        const hayUnidades = cat.value === 'peptide' && String(unidades.value).trim() !== '';
        if (CON_DOSIS.includes(cat.value) && !dosis.value.trim() && !hayUnidades) {
          toast('Escribe algo en la dosis. Si aún no la defines, anota qué falta, p. ej. "por definir: escalamiento"', true);
          continue;
        }
        break;
      }
      try {
        // Los campos estructurados solo se guardan cuando estan COMPLETOS. A
        // medias no se guardan: una dosis en unidades sin su vial es la que
        // hoy tiene un paciente puesta sin que nadie sepa cuantos mg son.
        const esPep = cat.value === 'peptide';
        const completo = esPep && String(unidades.value).trim() !== ''
          && faltaParaAuditar({ dose_un: unidades.value, vial_mg: vialMg.value, vial_ml: vialMl.value, syringe: jeringa.value }).length === 0;
        const mgCalc = completo
          ? mgDeUnidades({ un: unidades.value, vial_mg: vialMg.value, vial_ml: vialMl.value, jeringa: jeringa.value })
          : null;
        const marcados = [...dias].sort((a, b) => a - b);

        // El texto se escribe solo desde los numeros, para que la hoja del
        // paciente, los PDF y todo lo que ya lee `dose` sigan funcionando.
        const doseTexto = completo
          ? `${Number(unidades.value)} UN (${textoMg(mgCalc)})`
          : (dosis.value.trim() || null);
        const reconTexto = completo
          ? `${Number(vialMg.value)} mg en ${Number(vialMl.value)} mL (${textoConc(concentracion(vialMg.value, vialMl.value))}) · jeringa ${jeringa.value}`
          : (recon.value.trim() || null);

        await api.savePlanItem(planId, {
          id: item?.id, category: cat.value, title: titulo.value.trim(), dose: doseTexto,
          reconstitution: reconTexto,
          dose_un: completo ? Number(unidades.value) : null,
          vial_mg: completo ? Number(vialMg.value) : null,
          vial_ml: completo ? Number(vialMl.value) : null,
          syringe: completo ? jeringa.value : null,
          days_of_week: esPep && marcados.length ? marcados : null,
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
      const ck = h('input', { type: 'checkbox' });
      const cuerpo = h('div', { class: 'stack' },
        h('p', { text: 'Al firmar, el plan queda a tu nombre, desaparece la marca de agua y puede entregarse al paciente.' }),
        rev.length ? h('div', { class: 'notice small', text: `Quedan ${rev.length} punto(s) marcados para revisión. Revísalos antes de firmar.` }) : null,
        revSinConf.length ? h('div', { class: 'notice small', text: `${revSinConf.length} valor(es) del panel siguen sin confirmar contra el estudio original. Si firmas así, la firma avala números que nadie cotejó. Esto no se imprime en la hoja del paciente.` }) : null,
        h('div', { class: 'notice small', text: 'Confirma que revisaste cada indicación, su dosis y sus interacciones.' }));
      if (sinDosis.length) {
        const ul = h('ul', { class: 'small', style: 'margin:6px 0 0;padding-left:18px' });
        sinDosis.forEach((i) => ul.append(h('li', { text: `${i.title} — ${i.dose || 'sin dosis'}${i.reconstitution ? '' : (/(\bu\b|unidad|ml|cc)/i.test(i.dose || '') ? ' (sin reconstitución)' : '')}` })));
        cuerpo.append(h('div', { class: 'notice danger' },
          h('b', { text: `${sinDosis.length} renglón(es) no tienen una dosis que alguien pueda auditar:` }), ul,
          h('p', { class: 'small', style: 'margin:8px 0 0',
            text: 'Una dosis en unidades o mL sin reconstitución no permite saber cuántos mg recibe el paciente. Puedes firmar así, y queda escrito en el plan que lo firmaste reconociéndolo.' }),
          h('label', { class: 'field', style: 'margin-top:6px;flex-direction:row;gap:8px;align-items:flex-start' }, ck,
            h('span', { class: 'small', text: 'Lo reconozco y firmo de todas formas.' }))));
      }
      if (!(await modal('Firmar plan', cuerpo, 'Firmar'))) return;
      if (sinDosis.length && !ck.checked) { toast('Marca el reconocimiento o corrige las dosis antes de firmar', true); return; }
      try {
        const r = await api.signPlan(plan.id, sinDosis.length > 0);
        toast(r?.sin_dosis_auditable ? `Plan firmado · ${r.sin_dosis_auditable} renglón(es) sin dosis auditable, queda registrado` : 'Plan firmado');
        load();
      } catch (e) { toast(e.message, true); }
    }

    async function entregar(plan) {
      if (!(await modal('Entregar al paciente', h('p', { text: 'El plan queda disponible para el paciente.' }), 'Entregar'))) return;
      try { await api.deliverPlan(plan.id); toast('Entregado'); load(); }
      catch (e) { toast(`Error: ${e.message}`, true); }
    }
  };
  load();
}
