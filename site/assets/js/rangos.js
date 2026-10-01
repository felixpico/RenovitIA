// Pantalla "Rangos funcionales": revisión y aprobación manual, marcador por marcador.
// Nada se activa solo. Un rango sin aprobación médica no genera alerta ni se le muestra al paciente.
import { EVIDENCIA, textoRango } from './semaforo.js';

const CATEGORY = {
  cardiovascular: 'Cardiovascular', metabolico: 'Metabólico', hepatico: 'Función hepática',
  renal: 'Función renal', inflamacion: 'Inflamación', hormonal: 'Hormonas', tiroides: 'Tiroides',
  nutrientes: 'Nutrientes', hematologia: 'Biometría hemática', electrolitos: 'Electrolitos',
  muscular: 'Muscular', genetica: 'Genética',
};
const ORDEN = ['cardiovascular', 'metabolico', 'hepatico', 'renal', 'inflamacion', 'hormonal',
  'tiroides', 'nutrientes', 'hematologia', 'electrolitos', 'muscular', 'genetica'];
const SEXO = { M: 'Hombres', F: 'Mujeres' };

export async function viewRanges(root, ctx) {
  const { h, modal, toast, api, me, setNav } = ctx;
  setNav?.('rangos');
  const esMedico = (me?.roles || []).includes('physician');
  const estado = { filtro: 'todos', evidencia: 'todas' };

  const cargar = async () => {
    root.innerHTML = '';
    root.append(h('div', { class: 'spinner' }));
    let data;
    try { data = await api.ranges(); } catch (e) { root.innerHTML = ''; root.append(h('div', { class: 'notice danger', text: e.message })); return; }
    root.innerHTML = '';
    const { biomarkers, ranges } = data;
    const bmById = new Map(biomarkers.map((b) => [b.id, b]));

    const aprobados = ranges.filter((r) => r.approved_by).length;
    const sinRango = biomarkers.filter((b) => !ranges.some((r) => r.biomarker_id === b.id));

    root.append(h('div', { class: 'page-head' },
      h('div', {}, h('h1', { text: 'Rangos funcionales' }),
        h('p', { class: 'muted small', style: 'max-width:62ch' },
          'Verde = dentro del óptimo · Amarillo = fuera del óptimo pero dentro del límite · Rojo = fuera del límite. ',
          'Estos rangos son de medicina funcional, no los del laboratorio. ',
          h('b', { text: 'Ningún rango se usa para alertar ni se le muestra al paciente hasta que un médico lo apruebe.' })))));

    root.append(h('div', { class: 'stat-row' },
      h('div', { class: 'stat' }, h('b', { text: String(ranges.length) }), h('span', { text: 'rangos cargados' })),
      h('div', { class: 'stat' }, h('b', { text: String(aprobados) }), h('span', { text: 'aprobados' })),
      h('div', { class: 'stat' }, h('b', { text: String(ranges.length - aprobados) }), h('span', { text: 'pendientes' })),
      h('div', { class: 'stat' }, h('b', { text: String(sinRango.length) }), h('span', { text: 'marcadores sin rango' }))));

    if (!esMedico) {
      root.append(h('div', { class: 'notice', text: 'Puedes revisar y editar los números, pero sólo un médico puede aprobarlos.' }));
    }

    // ---- filtros ----
    const selFiltro = h('select', { class: 'input', onchange: () => { estado.filtro = selFiltro.value; pintar(); } },
      h('option', { value: 'todos', text: 'Todos' }),
      h('option', { value: 'pendientes', text: 'Sólo pendientes' }),
      h('option', { value: 'aprobados', text: 'Sólo aprobados' }));
    selFiltro.value = estado.filtro;
    const selEv = h('select', { class: 'input', onchange: () => { estado.evidencia = selEv.value; pintar(); } },
      h('option', { value: 'todas', text: 'Toda la evidencia' }),
      h('option', { value: 'A', text: 'A · desenlaces clínicos' }),
      h('option', { value: 'B', text: 'B · asociación consistente' }),
      h('option', { value: 'C', text: 'C · convención de consenso' }));
    selEv.value = estado.evidencia;
    root.append(h('div', { class: 'toolbar', style: 'margin:14px 0' }, selFiltro, selEv));

    const cuerpo = h('div');
    root.append(cuerpo);

    const seleccion = new Set();

    const barra = h('div', { class: 'bulk-bar hidden' });
    const pintarBarra = () => {
      barra.classList.toggle('hidden', !seleccion.size);
      barra.innerHTML = '';
      if (!seleccion.size) return;
      barra.append(h('span', { text: `${seleccion.size} seleccionado(s)` }),
        esMedico ? h('button', { class: 'btn btn-primary btn-sm', type: 'button', text: 'Aprobar seleccionados', onclick: () => aprobar([...seleccion], true) }) : null,
        esMedico ? h('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: 'Quitar aprobación', onclick: () => aprobar([...seleccion], false) }) : null,
        h('button', { class: 'btn-link btn-sm', type: 'button', text: 'Limpiar', onclick: () => { seleccion.clear(); pintar(); } }));
    };
    root.append(barra);

    async function aprobar(ids, si) {
      const texto = si
        ? `Vas a aprobar ${ids.length} rango(s) a tu nombre. A partir de ese momento se usan para alertar y se le muestran al paciente.`
        : `Vas a quitar la aprobación de ${ids.length} rango(s). Dejarán de usarse para alertar.`;
      if (!(await modal(si ? 'Aprobar rangos' : 'Quitar aprobación', h('p', { text: texto }), si ? 'Aprobar' : 'Quitar'))) return;
      try { const n = await api.approveRanges(ids, si); toast(`${n} rango(s) actualizado(s)`); seleccion.clear(); cargar(); }
      catch (e) { toast(`Error: ${e.message}`, true); }
    }

    async function editar(r, bm) {
      const campo = (l, v) => {
        const i = h('input', { class: 'input', type: 'text', inputmode: 'decimal' });
        i.value = v ?? '';
        return { el: h('label', { class: 'field' }, h('span', { class: 'field-label small', text: l }), i), i };
      };
      const ol = campo('Óptimo desde', r.optimal_low);
      const oh = campo('Óptimo hasta', r.optimal_high);
      const ll = campo('Límite inferior', r.reference_low);
      const lh = campo('Límite superior', r.reference_high);
      const ev = h('select', { class: 'input' }, ...['A', 'B', 'C'].map((k) => h('option', { value: k, text: `${k} · ${EVIDENCIA[k]}` })));
      ev.value = r.evidence_level || 'C';
      const fuente = h('input', { class: 'input', type: 'text' }); fuente.value = r.source || '';
      const cuerpoD = h('div', { class: 'stack' },
        h('p', { class: 'muted small', text: `${bm.name_es}${r.sex ? ` · ${SEXO[r.sex]}` : ''} · ${r.unit || ''}` }),
        h('div', { class: 'fields-grid' }, ol.el, oh.el, ll.el, lh.el),
        h('label', { class: 'field' }, h('span', { class: 'field-label small', text: 'Nivel de evidencia' }), ev),
        h('label', { class: 'field' }, h('span', { class: 'field-label small', text: 'Fuente' }), fuente),
        r.approved_by ? h('p', { class: 'notice small', text: 'Este rango ya está aprobado. Si cambias los números vuelve a quedar pendiente de aprobación.' }) : null);
      if (!(await modal('Editar rango', cuerpoD, 'Guardar'))) return;
      const n = (x) => { const v = String(x.i.value).trim().replace(',', '.'); return v === '' ? null : Number(v); };
      const patch = {
        optimal_low: n(ol), optimal_high: n(oh), reference_low: n(ll), reference_high: n(lh),
        evidence_level: ev.value, source: fuente.value.trim() || null,
      };
      for (const [k, v] of Object.entries(patch)) if (typeof v === 'number' && Number.isNaN(v)) { toast(`Valor no numérico en ${k}`, true); return; }
      if (patch.optimal_low != null && patch.optimal_high != null && patch.optimal_low > patch.optimal_high) { toast('El óptimo está invertido', true); return; }
      if (patch.reference_low != null && patch.reference_high != null && patch.reference_low > patch.reference_high) { toast('El límite está invertido', true); return; }
      try { await api.saveRange(r.id, patch); toast('Rango guardado'); cargar(); }
      catch (e) { toast(`Error: ${e.message}`, true); }
    }

    function pintar() {
      cuerpo.innerHTML = '';
      let visibles = 0;
      ORDEN.forEach((cat) => {
        const filas = ranges
          .filter((r) => bmById.get(r.biomarker_id)?.category === cat)
          .filter((r) => (estado.filtro === 'todos') || (estado.filtro === 'aprobados' ? !!r.approved_by : !r.approved_by))
          .filter((r) => estado.evidencia === 'todas' || r.evidence_level === estado.evidencia)
          .sort((a, b) => (bmById.get(a.biomarker_id)?.name_es || '').localeCompare(bmById.get(b.biomarker_id)?.name_es || ''));
        if (!filas.length) return;
        visibles += filas.length;

        const t = h('table', { class: 'data rangos' });
        t.append(h('thead', {}, h('tr', {},
          h('th', { text: '' }), h('th', { text: 'Marcador' }), h('th', { text: 'Óptimo' }),
          h('th', { text: 'Límite' }), h('th', { text: 'Evidencia' }), h('th', { text: 'Estado' }), h('th', { text: '' }))));
        const tb = h('tbody');
        filas.forEach((r) => {
          const bm = bmById.get(r.biomarker_id);
          const u = r.unit && r.unit !== 'indice' ? r.unit : '';
          const chk = h('input', { type: 'checkbox' });
          chk.checked = seleccion.has(r.id);
          chk.addEventListener('change', () => { if (chk.checked) seleccion.add(r.id); else seleccion.delete(r.id); pintarBarra(); });
          tb.append(h('tr', {},
            h('td', {}, chk),
            h('td', {}, h('strong', { text: bm?.name_es || '—' }),
              r.sex ? h('span', { class: 'muted small', text: ` · ${SEXO[r.sex]}` }) : null),
            h('td', { class: 'verde-txt', text: textoRango(r.optimal_low, r.optimal_high, u) }),
            h('td', { class: 'muted', text: textoRango(r.reference_low, r.reference_high, u) }),
            h('td', {}, h('span', { class: `sem-ev ev-${r.evidence_level || 'C'}`, title: EVIDENCIA[r.evidence_level || 'C'], text: r.evidence_level || 'C' })),
            h('td', {}, r.approved_by
              ? h('span', { class: 'pill verde', text: 'Aprobado' })
              : h('span', { class: 'pill amarillo', text: 'Pendiente' })),
            h('td', {}, h('button', { class: 'btn-link btn-sm', type: 'button', text: 'Editar', onclick: () => editar(r, bm || {}) }))));
        });
        t.append(tb);
        cuerpo.append(h('h3', { class: 'block-title', style: 'margin-top:20px', text: CATEGORY[cat] || cat }),
          h('div', { class: 'table-wrap' }, t));
      });
      if (!visibles) cuerpo.append(h('div', { class: 'empty-state', text: 'Nada que mostrar con estos filtros.' }));
      if (sinRango.length && estado.filtro === 'todos' && estado.evidencia === 'todas') {
        cuerpo.append(h('h3', { class: 'block-title', style: 'margin-top:24px', text: 'Marcadores sin rango funcional' }),
          h('p', { class: 'muted small', text: 'No se les cargó rango porque dependen de la edad, del ciclo menstrual o no son numéricos. Captúralos a mano si los van a usar.' }),
          h('div', { class: 'row-meta' }, ...sinRango.map((b) => h('span', { text: b.name_es }))));
      }
      pintarBarra();
    }
    pintar();
  };
  await cargar();
}
