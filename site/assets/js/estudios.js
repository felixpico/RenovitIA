// Pestaña "Estudios" del panel médico: órdenes de laboratorio y DEXA, resultados y documentos
import { rangoDe, evaluar, derivados, edadDe, textoRango, EVIDENCIA } from './semaforo.js';
export const ORDER_STATUS = {
  draft: ['Borrador', 'neutral'], signed: ['Firmada', 'prioritize'], sent: ['Enviada al proveedor', 'prioritize'],
  scheduled: ['Agendada', 'prioritize'], sample_taken: ['Muestra tomada / estudio realizado', 'block'],
  results_received: ['Resultados recibidos', 'ok'], cancelled: ['Cancelada', 'neutral'],
};
const NEXT = { signed: ['sent', 'scheduled', 'sample_taken'], sent: ['scheduled', 'sample_taken'], scheduled: ['sample_taken'], sample_taken: ['results_received'] };
const CATEGORY = { hematologia: 'Biometría hemática', electrolitos: 'Electrolitos', hepatico: 'Función hepática', renal: 'Función renal', metabolico: 'Metabólico', cardiovascular: 'Cardiovascular', inflamacion: 'Inflamación', hormonal: 'Hormonas', tiroides: 'Tiroides', nutrientes: 'Nutrientes', genetica: 'Genética', muscular: 'Muscular' };
const ORDEN_CAT = ['cardiovascular', 'metabolico', 'hepatico', 'renal', 'inflamacion', 'hormonal', 'tiroides', 'nutrientes', 'hematologia', 'electrolitos', 'muscular', 'genetica'];
const EST_DOC = { pending: ['Sin leer', 'amarillo'], processing: ['Leyendo…', 'amarillo'], extracted: ['Leído, falta confirmar', 'amarillo'], confirmed: ['Confirmado', 'verde'], failed: ['No se pudo leer', 'rojo'], not_applicable: ['No aplica', ''] };
const KIND_NOMBRE = { lab_report: 'Laboratorio', dexa_report: 'DEXA / composición', prior_study: 'Estudio previo', other: 'Otro' };
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
    const { orders, items, providers, documents, results, bodycomp, biomarkers, ranges } = data;
    const bmById = new Map(biomarkers.map((b) => [b.id, b]));
    const provName = (id) => providers.find((p) => p.id === id)?.name || 'Sin proveedor';

    const runTop = async (fn, msg) => { try { await fn(); toast(msg); load(); refresh?.(); } catch (e) { toast(`Error: ${e.message}`, true); } };
    root.append(h('div', { class: 'toolbar', style: 'margin-bottom:12px' },
      h('button', { class: 'btn btn-primary btn-sm', type: 'button', text: '+ Orden de laboratorio', onclick: () => orderDialog('lab') }),
      h('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: '+ Orden DEXA', onclick: () => orderDialog('dexa') }),
      h('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: '⬆ Subir estudio', onclick: () => subirDialog() }),
      h('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: '⟳ Evaluar laboratorios', onclick: async () => {
        try {
          const res = await api.evaluateLabs(patient.id);
          toast(`${res?.rojos ?? 0} marcador(es) fuera de límite · ${res?.alertas_nuevas ?? 0} alerta(s) nueva(s)`);
          load(); refresh?.();
        } catch (e) { toast(`Error: ${e.message}`, true); }
      } })));

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
    root.append(resumenSemaforo(), h('h3', { class: 'block-title', text: 'Órdenes' }), list);

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

    root.append(h('h3', { class: 'block-title', style: 'margin-top:22px' },
      'Archivos del paciente',
      h('button', { class: 'btn btn-ghost btn-sm', style: 'margin-left:10px', type: 'button', text: '⬆ Subir estudio', onclick: () => subirDialog() })));
    if (!documents.length) root.append(h('p', { class: 'muted small', text: 'Todavía no hay archivos. Súbelos tú o pídeselos al paciente en su cuestionario.' }));
    else {
      const sinLeer = documents.filter((d) => (d.extraction_status || 'pending') === 'pending' && porDoc(d.id).total === 0).length;
      const porConfirmar = documents.filter((d) => porDoc(d.id).sinConfirmar > 0).length;
      const valoresSinConfirmar = documents.reduce((a, d) => a + porDoc(d.id).sinConfirmar, 0);
      if (sinLeer || valoresSinConfirmar) {
        root.append(h('p', { class: 'muted small', style: 'margin:2px 0 8px' },
          [sinLeer ? `${sinLeer} sin leer` : null,
            valoresSinConfirmar ? `${valoresSinConfirmar} valor(es) esperando tu confirmación en ${porConfirmar} archivo(s)` : null,
          ].filter(Boolean).join(' · ')));
      }
      if (valoresSinConfirmar) {
        root.append(h('div', { class: 'notice warn small', style: 'margin:0 0 10px' },
          h('b', { text: 'Ningún valor sin confirmar es dato clínico todavía. ' }),
          'Entra a "Revisar" en cada archivo, compáralo contra el estudio original y confírmalo. ',
          'El plan se puede firmar con valores sin confirmar, pero entonces la firma avala números que nadie cotejó.'));
      }
      root.append(h('div', { class: 'doc-list' }, ...documents.map((d) => tarjetaDocumento(d))));
    }

    // ---------- Resumen visual con semáforo funcional ----------

    function resumenSemaforo() {
      const edad = edadDe(patient.birth_date);
      const bmPorCodigo = new Map(biomarkers.map((b) => [b.code, b]));

      // el resultado más reciente de cada marcador
      const ultimo = {};
      [...results].sort((a, b) => (a.collected_at || '').localeCompare(b.collected_at || '')).forEach((r) => {
        const bm = bmById.get(r.biomarker_id);
        if (bm && r.value_numeric != null) ultimo[bm.code] = r;
      });

      // marcadores derivados que ningún laboratorio reporta
      derivados(ultimo, { edad }).forEach((d) => {
        const bm = bmPorCodigo.get(d.code);
        if (!bm) return;
        if (!ultimo[d.code] || ultimo[d.code].derivado) ultimo[d.code] = { ...d, biomarker_id: bm.id, unit: bm.default_unit };
      });

      Object.values(ultimo).forEach((r) => { if (/^Calculado:/.test(r.raw_name || '')) r.derivado = true; });

      const filas = Object.entries(ultimo).map(([code, r]) => {
        const bm = bmPorCodigo.get(code);
        if (!bm) return null;
        const rango = rangoDe(ranges, bm.id, sex, edad);
        return { bm, r, ev: evaluar(r.value_numeric, rango) };
      }).filter((x) => x && x.ev);

      const caja = h('section', { class: 'semaforo' });
      if (!filas.length) {
        if (!results.length) return h('div', {});
        caja.append(h('h3', { class: 'block-title', text: 'Resumen funcional' }),
          h('p', { class: 'muted small', text: 'No hay rangos funcionales que apliquen a estos resultados.' }));
        return caja;
      }

      const cuenta = { verde: 0, amarillo: 0, rojo: 0 };
      filas.forEach((f) => { cuenta[f.ev.color] += 1; });
      const pendientes = filas.filter((f) => f.ev.pendiente).length;

      caja.append(h('div', { class: 'semaforo-top' },
        h('h3', { class: 'block-title', style: 'margin:0', text: 'Resumen funcional' }),
        h('div', { class: 'semaforo-cuenta' },
          h('span', { class: 'pill rojo' }, h('b', { text: String(cuenta.rojo) }), ' fuera de límite'),
          h('span', { class: 'pill amarillo' }, h('b', { text: String(cuenta.amarillo) }), ' en el límite'),
          h('span', { class: 'pill verde' }, h('b', { text: String(cuenta.verde) }), ' en óptimo'))));
      caja.append(h('p', { class: 'muted small', style: 'margin:2px 0 10px' },
        'Comparado contra rangos de medicina funcional, no contra el rango del laboratorio.'));
      if (pendientes) {
        const enPrueba = filas.filter((f) => f.ev.enPrueba).length;
        caja.append(h('div', { class: 'notice small', text: enPrueba
          ? `${enPrueba} de estos rangos están activos en modo prueba, sin firma médica. Las alertas que generan se marcan como tales.`
          : `${pendientes} de estos rangos todavía no los aprueba un médico. No generan alerta.` }));
      }

      const orden = { rojo: 0, amarillo: 1, verde: 2 };
      ORDEN_CAT.forEach((cat) => {
        const dentro = filas.filter((f) => f.bm.category === cat)
          .sort((a, b) => orden[a.ev.color] - orden[b.ev.color] || a.bm.name_es.localeCompare(b.bm.name_es));
        if (!dentro.length) return;
        const rejilla = h('div', { class: 'semaforo-grid' });
        dentro.forEach(({ bm, r, ev }) => {
          const u = bm.default_unit && bm.default_unit !== 'indice' ? bm.default_unit : '';
          const chip = h('article', { class: `sem-card ${ev.color}${ev.pendiente ? ' pendiente' : ''}` },
            h('header', { class: 'sem-head' },
              h('span', { class: 'sem-nombre', text: bm.name_es }),
              ev.direccion ? h('span', { class: 'sem-dir', text: ev.direccion === 'alto' ? '▲' : '▼' }) : null),
            h('div', { class: 'sem-valor' }, h('b', { text: String(r.value_numeric) }), u ? h('span', { class: 'sem-unidad', text: u }) : null),
            h('div', { class: 'sem-rango small', text: `Óptimo ${textoRango(ev.rango.optimal_low, ev.rango.optimal_high, u)}` }),
            h('div', { class: 'sem-pie small' },
              r.derivado ? h('span', { class: 'sem-tag', text: 'calculado' }) : null,
              ev.rango.evidence_level ? h('span', { class: `sem-ev ev-${ev.rango.evidence_level}`, title: EVIDENCIA[ev.rango.evidence_level], text: ev.rango.evidence_level }) : null,
              ev.pendiente ? h('span', { class: 'sem-tag pendiente', text: ev.enPrueba ? 'en prueba' : 'sin aprobar' }) : null));
          if (r.nota) chip.append(h('p', { class: 'sem-nota small', text: r.nota }));
          rejilla.append(chip);
        });
        caja.append(h('h4', { class: 'sem-cat', text: CATEGORY[cat] || cat }), rejilla);
      });
      return caja;
    }

    // ---------- Archivos del paciente y lectura automática ----------

    async function leerEstudio(d) {
      toast(`Leyendo ${d.original_filename || 'el archivo'}…`);
      try {
        const r = await api.extractStudy(d.id);
        const partes = [];
        if (r.analitos) partes.push(`${r.analitos} analito(s)`);
        if (r.composicion) partes.push('composición corporal');
        if (r.sin_catalogo) partes.push(`${r.sin_catalogo} sin catálogo`);
        if (r.baja_confianza) partes.push(`${r.baja_confianza} de baja confianza`);
        toast(partes.length ? partes.join(' · ') : `Sin datos que extraer (${r.tipo || 'otro'})`);
        load();
      } catch (e) { toast(`No se pudo leer: ${e.message}`, true); load(); }
    }

    async function revisarExtraccion(d) {
      let filas;
      try { filas = await api.extractedRows(d.id); }
      catch (e) { toast(`Error: ${e.message}`, true); return; }

      const pago = d.extraction_payload || {};
      const cuerpoD = h('div', { class: 'stack' },
        h('p', { class: 'muted small' },
          `${d.original_filename || 'archivo'} · leído con ${d.extraction_model || 'el extractor'}`,
          pago.laboratorio ? ` · ${pago.laboratorio}` : '',
          pago.fecha_estudio ? ` · ${pago.fecha_estudio}` : ''),
        h('div', { class: 'notice small', text: 'Compara contra el estudio original antes de confirmar. Al confirmar, estos valores quedan a tu nombre como dato clínico.' }),
        h('a', { href: '#', class: 'btn btn-ghost btn-sm', text: 'Abrir el archivo original', onclick: async (e) => {
          e.preventDefault();
          try { window.open(await api.docUrl(d.storage_path), '_blank', 'noopener'); } catch (err) { toast(err.message, true); }
        } }));

      if (pago.notas) cuerpoD.append(h('p', { class: 'small', style: 'color:var(--sem-amar)' }, h('b', { text: 'Notas del extractor: ' }), pago.notas));

      if (filas.lab.length) {
        const t = h('table', { class: 'data' });
        t.append(h('thead', {}, h('tr', {}, ...['Como aparece', 'Marcador', 'Valor', 'Confianza'].map((x) => h('th', { text: x })))));
        const tb = h('tbody');
        [...filas.lab].sort((a, b) => (a.extraction_confidence ?? 1) - (b.extraction_confidence ?? 1)).forEach((r) => {
          const bm = bmById.get(r.biomarker_id);
          const conf = r.extraction_confidence;
          tb.append(h('tr', {},
            h('td', { class: 'small', text: r.raw_name || '—' }),
            h('td', {}, bm ? h('strong', { text: bm.name_es }) : h('span', { class: 'muted small', text: 'sin catálogo · no se evalúa' })),
            h('td', { text: `${r.value_numeric ?? '—'} ${r.unit || ''}` }),
            h('td', {}, conf == null ? h('span', { class: 'muted small', text: '—' })
              : h('span', { class: `pill ${conf >= 0.9 ? 'verde' : conf >= 0.7 ? 'amarillo' : 'rojo'}`, text: `${Math.round(conf * 100)}%` })),
            r.confirmed_by ? h('td', {}, h('span', { class: 'pill verde', text: 'Confirmado' })) : null));
        });
        t.append(tb);
        cuerpoD.append(h('h4', { class: 'sem-cat', text: 'Laboratorio' }), h('div', { class: 'table-wrap' }, t));
      }

      if (filas.bodycomp.length) {
        const CAMPOS = [['method', 'Método'], ['measured_at', 'Fecha'], ['weight_kg', 'Peso kg'], ['height_cm', 'Estatura cm'],
          ['body_fat_pct', 'Grasa %'], ['fat_mass_kg', 'Masa grasa kg'], ['lean_mass_kg', 'Masa magra kg'],
          ['appendicular_lean_mass_kg', 'Magra apendicular kg'], ['almi', 'ALMI'], ['ffmi', 'FFMI'],
          ['visceral_fat_g', 'Visceral g'], ['visceral_fat_cm2', 'Visceral cm²'], ['bmd_t_score', 'T-score'],
          ['resting_metabolic_rate_kcal', 'Metabolismo basal']];
        filas.bodycomp.forEach((b) => {
          const rej = h('div', { class: 'fields-grid' });
          CAMPOS.forEach(([k, l]) => { if (b[k] != null) rej.append(h('div', { class: 'small' }, h('b', { text: `${l}: ` }), String(b[k]))); });
          cuerpoD.append(h('h4', { class: 'sem-cat', text: 'Composición corporal' }), rej);
        });
      }

      if (!filas.lab.length && !filas.bodycomp.length) {
        cuerpoD.append(h('div', { class: 'empty-state', text: 'El extractor no encontró valores en este archivo.' }));
      }

      const yaConfirmado = d.extraction_status === 'confirmed';
      if (!(await modal(yaConfirmado ? 'Extracción confirmada' : 'Revisar extracción', cuerpoD,
        yaConfirmado ? 'Cerrar' : 'Confirmar todo'))) return;
      if (yaConfirmado) return;
      try {
        const r = await api.confirmExtraction(d.id);
        toast(`${r.laboratorio} valor(es) confirmado(s)`);
        load(); refresh?.();
      } catch (e) { toast(`Error: ${e.message}`, true); }
    }

    // Cuántos valores salieron de cada archivo y cuántos siguen sin confirmar.
    // Se calcula de las filas, no del estatus del documento: el estatus se puede
    // haber quedado atrás y entonces la pantalla esconde valores que ya existen.
    function porDoc(docId) {
      let total = 0, sinConfirmar = 0;
      for (const r of [...results, ...bodycomp]) {
        if (r.document_id !== docId) continue;
        total += 1;
        if (!r.confirmed_by) sinConfirmar += 1;
      }
      return { total, sinConfirmar };
    }

    function tarjetaDocumento(d) {
      const est = d.extraction_status || 'pending';
      const [etiqueta, color] = EST_DOC[est] || ['—', ''];
      const acciones = h('span', { class: 'doc-acciones' });
      acciones.append(h('button', { class: 'btn-link btn-sm', type: 'button', text: 'Abrir', onclick: async () => {
        try { window.open(await api.docUrl(d.storage_path), '_blank', 'noopener'); } catch (err) { toast(err.message, true); }
      } }));
      const cuenta = porDoc(d.id);
      if (['extracted', 'confirmed'].includes(est) || cuenta.total > 0) {
        acciones.append(h('button', { class: 'btn-link btn-sm', type: 'button',
          text: cuenta.sinConfirmar ? `Revisar (${cuenta.sinConfirmar})` : 'Revisar',
          onclick: () => revisarExtraccion(d) }));
      }
      if (est !== 'confirmed') {
        acciones.append(h('button', { class: 'btn-link btn-sm', type: 'button',
          text: est === 'pending' ? 'Leer estudio' : 'Volver a leer', onclick: () => leerEstudio(d) }));
      }
      if (['extracted', 'failed'].includes(est) || cuenta.sinConfirmar > 0) {
        acciones.append(h('button', { class: 'btn-link btn-sm', type: 'button', text: 'Descartar', onclick: async () => {
          if (!(await modal('Descartar lectura', h('p', { text: 'Se borra todo lo que el extractor sacó de este archivo y que nadie haya confirmado. El archivo no se toca.' }), 'Descartar'))) return;
          try { const r = await api.discardExtraction(d.id); toast(`${r.laboratorio} valor(es) descartado(s)`); load(); }
          catch (e) { toast(`Error: ${e.message}`, true); }
        } }));
      }
      const desfasado = cuenta.sinConfirmar > 0 && est === 'pending';
      return h('div', { class: 'doc-row' },
        h('span', { class: 'doc-nombre', text: d.original_filename || KIND_NOMBRE[d.kind] || 'archivo' }),
        h('span', { class: 'muted small', text: KIND_NOMBRE[d.kind] || '' }),
        color ? h('span', { class: `pill ${color}`, text: etiqueta }) : h('span', { class: 'muted small', text: etiqueta }),
        cuenta.sinConfirmar ? h('span', { class: 'pill amarillo', text: `${cuenta.sinConfirmar} sin confirmar` }) : null,
        desfasado ? h('span', { class: 'muted small', text: 'tiene valores de una lectura anterior' }) : null,
        d.extraction_error ? h('span', { class: 'small', style: 'color:var(--danger)', text: d.extraction_error.slice(0, 90) }) : null,
        acciones);
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

    async function subirDialog() {
      const tipo = h('select', { class: 'input' },
        h('option', { value: 'lab_report', text: 'Laboratorio' }),
        h('option', { value: 'dexa_report', text: 'DEXA, InBody o bioimpedancia' }),
        h('option', { value: 'prior_study', text: 'Otro estudio (ECG, ultrasonido, etc.)' }));
      const file = h('input', { class: 'input', type: 'file', accept: 'application/pdf,image/*' });
      const cuerpo = h('div', { class: 'stack' },
        h('label', { class: 'field' }, h('span', { class: 'field-label small', text: 'Tipo de estudio' }), tipo),
        h('label', { class: 'field' }, h('span', { class: 'field-label small', text: 'Archivo (PDF o foto)' }), file),
        h('p', { class: 'muted small', text: 'El paciente no lo verá hasta que liberes sus resultados.' }));
      if (!(await modal('Subir estudio', cuerpo, 'Subir'))) return;
      const f = file.files?.[0];
      if (!f) { toast('No elegiste archivo', true); return; }
      try { await api.uploadLooseDoc(patient.id, tipo.value, f); toast('Archivo subido'); load(); }
      catch (e) { toast(`Error al subir: ${e.message}`, true); }
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
