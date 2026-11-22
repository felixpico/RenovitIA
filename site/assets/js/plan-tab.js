// Pestaña "Plan": genera el borrador desde el semáforo, deja que el médico capture
// las indicaciones y lo firma. Sin dosis concreta no se puede firmar: lo bloquea la base.
import { FRANJAS, CORTO_FRANJA } from './franjas.js';
// El dia se dibuja con el MISMO codigo que lo pinta en el telefono del
// paciente. Dibujarlo aparte seria tener dos verdades, y la previa mentiria
// justo en el momento de firmar.
import { CON_TOMA, tomasDeItems, htmlDia, revisionDelDia } from './dia.js';
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

  const load = async (abrir) => {
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

    // Hay un plan entregado ANTERIOR a este borrador: entonces el paciente ya
    // esta siguiendo algo, y firmar sin entregar lo deja con la version vieja.
    const anterior = plans.filter((x) => x.id !== vigente.id && x.delivered_at)
      .sort((a, b) => b.version - a.version)[0] || null;
    const yaTeniaPlan = !!anterior;

    /* Lo que el paciente GANA y lo que PIERDE al entregar esta version.
       Un plan regenerado no copia lo capturado, asi que es facil firmar una
       version de cinco renglones encima de una de diecinueve y quitarle al
       paciente siete suplementos sin darse cuenta. */
    const llaveDe = (i) => String(i.catalog_code || '').trim().toLowerCase()
      || String(i.title || '').trim().toLowerCase();
    const conToma = (i) => CON_DOSIS.includes(i.category);
    const antes = anterior
      ? items.filter((i) => i.protocol_id === anterior.id && i.is_active && conToma(i))
      : [];
    const ahora = items.filter((i) => i.protocol_id === vigente.id && i.is_active && conToma(i));
    const llavesAhora = new Set(ahora.map(llaveDe));
    const llavesAntes = new Set(antes.map(llaveDe));
    const seVan = antes.filter((i) => !llavesAhora.has(llaveDe(i)));
    const llegan = ahora.filter((i) => !llavesAntes.has(llaveDe(i)));

    const cuadroCambios = () => {
      if (!anterior) return null;
      const lista = (titulo, filas, clase) => (filas.length
        ? h('div', { style: 'margin-top:8px' },
            h('b', { class: clase || '', text: `${titulo} (${filas.length})` }),
            h('ul', { style: 'margin:4px 0 0' },
              ...filas.map((i) => h('li', { text: `${i.title}${i.dose ? ` — ${i.dose}` : ''}` }))))
        : null);
      return h('div', { class: 'stack' },
        h('p', { class: 'small', style: 'margin:0',
          text: `Comparado con la versión ${anterior.version}, que es la que trae hoy en su teléfono:` }),
        lista('Deja de tomar', seVan, 'rojo'),
        lista('Empieza a tomar', llegan, ''),
        (!seVan.length && !llegan.length)
          ? h('p', { class: 'small', style: 'margin:6px 0 0', text: 'Las tomas no cambian.' }) : null);
    };
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
        h('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: 'Ver el día del paciente', onclick: () => previa(vigente, true) }),
        !firmado && esMedico ? h('button', { class: 'btn btn-primary btn-sm', type: 'button', text: 'Revisar y firmar', onclick: () => previa(vigente) }) : null,
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

    // Volver a entrar a la firma DESPUES de recargar. Si la previa llamara a
    // firmar() directo, firmaria contra la foto vieja del plan: la que todavia
    // trae el renglon que la medica acaba de quitar. Mentir justo al firmar es
    // peor que no tener previa.
    if (abrir === 'firmar' && !firmado && esMedico) firmar(vigente);

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

    /* ---------- la vista previa con la que se firma ----------

       No es una pestana aparte: es la pantalla donde se firma. Una previa que
       hay que ir a buscar no la abre nadie, y el problema que resuelve -- firmar
       sin haber visto el dia como lo ve el paciente -- sigue igual.

       Prueba de que hacia falta: el Omega-3 duplicado sobrevivio porque se firma
       una tabla por categorias. En una tabla de veinticinco renglones, dos
       "Omega-3" parecen una lista. En el dia armado, salta.

       El dia se dibuja con htmlDia(), la MISMA funcion que pinta la pantalla del
       paciente. Si se dibujara aparte, el dia que una cambie la otra miente, y
       mentiria justo en el momento de firmar.

       Lo que NO hace: arrastrar de una franja a otra. Se ve bien en un boceto y
       sobre un plan clinico es una fuente de errores. Mover de horario se hace
       desde el menu del renglon, que es explicito y dice cuantas casillas
       quedan. */
    function previa(plan, soloVer = false) {
      let filas = mios.filter((i) => CON_TOMA.includes(i.category));
      const quien = `${patient.first_name || ''} ${patient.last_name || ''}`.trim() || 'tu paciente';
      const pl = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

      const fondo = h('div', { class: 'pv-fondo', role: 'dialog', 'aria-modal': 'true',
        'aria-label': `Vista previa del día de ${quien}` });
      const hoja = h('div', { class: 'pv-hoja' });
      fondo.append(hoja);
      // Si se movio algo, la pestana de atras se recarga al cerrar: no puede
      // quedar mostrando la tabla vieja despues de reacomodar el dia.
      let toco = false;
      const teclas = (e) => { if (e.key === 'Escape') cerrar(); };
      const cerrar = () => {
        fondo.remove();
        document.removeEventListener('keydown', teclas);
        if (toco) load();
      };
      document.addEventListener('keydown', teclas);
      fondo.addEventListener('click', (e) => { if (e.target === fondo) cerrar(); });

      const refrescar = async () => {
        try {
          const d = await api.plans(patient.id);
          filas = (d.items || []).filter((i) => i.protocol_id === plan.id && i.is_active
            && CON_TOMA.includes(i.category));
          dibujar();
        } catch (e) { toast(`No se pudo recargar la previa: ${e.message}`, true); }
      };
      const tras = async () => { toco = true; await refrescar(); };

      /* --- orden ---
         El orden del dia es sort_order, el mismo numero que usa la pantalla del
         paciente. Se renumera la lista completa con huecos de diez y se manda
         solo lo que cambio: asi un arrastre no deja dos renglones empatados. */
      async function reordenar(idMovido, idDestino, despues = false) {
        const orden = [...filas].sort((a, b) => (a.sort_order ?? 50) - (b.sort_order ?? 50));
        const from = orden.findIndex((i) => i.id === idMovido);
        const hasta = orden.findIndex((i) => i.id === idDestino);
        if (from < 0 || hasta < 0 || idMovido === idDestino) return;
        const [m] = orden.splice(from, 1);
        let to = orden.findIndex((i) => i.id === idDestino);
        if (despues) to += 1;
        orden.splice(to, 0, m);
        const cambios = [];
        orden.forEach((i, n) => {
          const v = (n + 1) * 10;
          if ((i.sort_order ?? 50) !== v) cambios.push({ id: i.id, sort_order: v });
        });
        if (!cambios.length) return;
        try { await api.reordenarPlanItems(cambios); await tras(); }
        catch (e) { toast(`No se pudo reordenar: ${e.message}`, true); }
      }

      // Subir o bajar DENTRO de la franja: el vecino de arriba en la tarjeta de
      // la cena, no el vecino en la lista global. Es lo que la medica esta viendo.
      async function mover(itemId, franja, delta) {
        const enFranja = tomasDeItems(filas).filter((t) => t.franja === franja).map((t) => t.i);
        const idx = enFranja.findIndex((i) => i.id === itemId);
        const destino = idx + delta;
        if (idx < 0 || destino < 0 || destino >= enFranja.length) return;
        await reordenar(itemId, enFranja[destino].id, delta > 0);
      }

      function dibujar() {
        const tomas = tomasDeItems(filas);
        const rv = revisionDelDia(filas, tomas);
        hoja.innerHTML = '';

        hoja.append(h('div', { class: 'pv-head' },
          h('div', { class: 'pv-tit' },
            h('h2', { text: `Así va a ver su día ${quien}` }),
            h('p', { text: `Plan versión ${plan.version} · ${pl(tomas.length, 'toma', 'tomas')} en ${pl(rv.momentos, 'momento', 'momentos')} del día`
              + (soloVer ? ' · sólo lectura' : '') })),
          h('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: 'Cerrar', onclick: cerrar }),
          soloVer ? null : h('button', { class: 'btn btn-primary btn-sm', type: 'button',
            text: yaTeniaPlan ? 'Firmar y entregar' : 'Firmar plan',
            onclick: async () => {
              const cambio = toco;
              fondo.remove();
              document.removeEventListener('keydown', teclas);
              // Si se movio algo aqui, la firma tiene que leer el plan otra vez.
              if (cambio) await load('firmar'); else firmar(plan);
            } })));

        hoja.append(h('div', { class: 'pv-banner', text: soloVer
          ? 'Esto es exactamente lo que ve en su teléfono. Lo que es de ciertos días trae sus días marcados debajo.'
          : 'Usa ⋯ para mover un renglón de horario o cambiarle el orden, y agrega lo que falte al pie de cada momento. En computadora también puedes arrastrarlos. Está el plan completo: lo que es de ciertos días trae sus días marcados debajo.' }));

        const dia = h('div', { class: 'pv-dia' });
        // soloVer dibuja el dia TAL CUAL lo ve el paciente: sin asas, sin menus,
        // sin "+". Es la misma funcion, con las agregadas apagadas.
        dia.innerHTML = htmlDia(tomas, { previa: !soloVer })
          || '<div class="empty-state">Este plan todavía no tiene nada que el paciente deba tomar.</div>';

        hoja.append(h('div', { class: 'pv-cols' }, dia,
          h('div', { class: 'pv-rail' }, cajaRevision(rv), cajaNumeros(rv),
            anterior ? h('div', { class: 'pv-caja' },
              h('h4', { text: `Contra la versión ${anterior.version}` }), cuadroCambios()) : null)));

        if (soloVer) return;

        dia.querySelectorAll('.dia-add').forEach((b) => b.addEventListener('click', () => {
          // Se abre el alta con la franja YA elegida: si notas que falta algo en
          // la cena, lo pones ahi, sin salir y sin volver a decidir el horario.
          // Entra al FINAL del dia, no en medio: sort_order 50 por omision la
          // metia entre renglones ya numerados.
          const ultimo = filas.reduce((m, i) => Math.max(m, i.sort_order ?? 50), 50);
          editar(plan.id, { slots: [b.dataset.add], category: 'supplement', sort_order: ultimo + 10 }, tras);
        }));
        dia.querySelectorAll('.dia-men').forEach((b) => b.addEventListener('click',
          () => menuRenglon(b.dataset.men, b.dataset.franja)));

        let arrastrado = null;
        dia.querySelectorAll('.it.previa').forEach((el) => {
          el.addEventListener('dragstart', (e) => {
            arrastrado = el; el.classList.add('arr');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', el.dataset.item);
          });
          el.addEventListener('dragend', () => {
            el.classList.remove('arr');
            dia.querySelectorAll('.sobre').forEach((x) => x.classList.remove('sobre'));
            arrastrado = null;
          });
          el.addEventListener('dragover', (e) => {
            if (!arrastrado || arrastrado === el) return;
            e.preventDefault(); el.classList.add('sobre');
          });
          el.addEventListener('dragleave', () => el.classList.remove('sobre'));
          el.addEventListener('drop', async (e) => {
            e.preventDefault(); el.classList.remove('sobre');
            const id = arrastrado?.dataset.item;
            arrastrado = null;
            if (!id || id === el.dataset.item) return;
            await reordenar(id, el.dataset.item);
          });
        });
      }

      function cajaRevision(rv) {
        const caja = h('div', { class: 'pv-caja' }, h('h4', { text: 'Antes de firmar' }));
        const linea = (clase, ico, ...cuerpo) => caja.append(
          h('div', { class: `pv-chk ${clase}` }, h('span', { class: 'pv-ico', text: ico }),
            h('span', {}, ...cuerpo)));
        let algo = false;

        rv.repetidos.forEach((g) => {
          algo = true;
          const veces = g.reduce((n, i) => n + (Array.isArray(i.slots) ? Math.max(1, i.slots.length) : 1), 0);
          linea('mal', '!', h('b', { text: `«${g[0].title}» está ${g.length} veces en el plan.` }),
            ` Al paciente le van a aparecer ${veces} casillas al día y su constancia va a salir inflada. `,
            soloVer ? null : h('button', { type: 'button', text: 'Quitar la repetida', onclick: async () => {
              const sobra = g[g.length - 1];
              if (!(await modal('Quitar la repetida', h('div', { class: 'stack' },
                h('p', { text: `Se quita una de las dos «${sobra.title}». Queda la otra.` }),
                h('p', { class: 'muted small', text: 'Lo que el paciente ya palomeó no se borra. Si quiere tomarlo a dos horas distintas, edita el renglón que queda y márcale las dos franjas.' })),
                'Quitar'))) return;
              try { await api.removePlanItem(sobra.id); toast('Quitada'); await tras(); }
              catch (e) { toast(`Error: ${e.message}`, true); }
            } }));
        });

        if (rv.sinSlot.length) {
          algo = true;
          const uno = rv.sinSlot.length === 1;
          linea('ojo', '?', h('b', { text: `${pl(rv.sinSlot.length, 'renglón', 'renglones')} sin franja elegida.` }),
            ` El sistema ${uno ? 'lo acomodó' : 'los acomodó'} leyendo el texto del horario, y ${uno ? 'lo marcó' : 'los marcó'} «deducido» abajo. Si la deducción no es la que querías, ${uno ? 'muévelo' : 'muévelos'} con ⋯.`);
        }

        if (rv.sinJeringa.length) {
          algo = true;
          linea('mal', '!', h('b', { text: `${pl(rv.sinJeringa.length, 'inyectable', 'inyectables')} sin vial completo: ` }),
            rv.sinJeringa.map((i) => i.title).join(', '),
            '. Sin mg, mL y jeringa no se le puede dibujar la dosis, y va a cargar la jeringa a ojo.');
        } else if (rv.inyectables.length) {
          linea('ok', '✓', rv.inyectables.length === 1
            ? 'El inyectable trae vial, unidades y jeringa: el paciente ve la dosis dibujada.'
            : `Los ${rv.inyectables.length} inyectables traen vial, unidades y jeringa: el paciente ve la dosis dibujada.`);
        }

        if (rv.pico) {
          algo = true;
          linea('ojo', '?', h('b', { text: `${rv.pico.n} tomas juntas en ${rv.nombreFranja(rv.pico.f).toLowerCase()}.` }),
            ' Mira si conviene repartirlas: un momento cargado es el que primero se deja de palomear.');
        }

        if (!algo) linea('ok', '✓', 'Nada que señalar: sin repetidos, todo con horario y los inyectables completos.');
        return caja;
      }

      function cajaNumeros(rv) {
        const tile = (n, u) => h('div', {}, h('div', { class: 'n', text: String(n) }), h('div', { class: 'u', text: u }));
        return h('div', { class: 'pv-caja' }, h('h4', { text: 'El día, en números' }),
          h('div', { class: 'pv-num' },
            tile(rv.tomas, 'tomas al día'),
            tile(rv.momentos, rv.momentos === 1 ? 'momento' : 'momentos'),
            rv.pico ? tile(rv.pico.n, `en ${rv.nombreFranja(rv.pico.f).toLowerCase()}`) : null,
            rv.inyectables.length ? tile(rv.inyectables.length, 'inyectables') : null));
      }

      /* --- el menu de un renglon ---
         Mover de franja, subir, bajar, editar y quitar. Todo en una hoja, y con
         el numero de casillas a la vista: cambiar de dos franjas a tres no es un
         detalle de presentacion, son tres palomitas al dia. */
      async function menuRenglon(itemId, franja) {
        const it = filas.find((i) => i.id === itemId);
        if (!it) return;
        const seleccion = new Set(Array.isArray(it.slots) ? it.slots : []);
        let delta = 0;

        const chips = h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap' });
        const avisoFr = h('p', { class: 'small', style: 'margin:6px 0 0' });
        const pintar = () => {
          chips.innerHTML = '';
          FRANJAS.forEach(([clave, , corto]) => {
            const on = seleccion.has(clave);
            chips.append(h('button', { type: 'button', text: corto, 'aria-pressed': on ? 'true' : 'false',
              style: 'font:inherit;font-size:12.5px;font-weight:600;padding:9px 12px;border-radius:9px;cursor:pointer;'
                + (on ? 'border:1px solid #0f241d;background:#0f241d;color:#fff;'
                      : 'border:1px solid #c9cfcb;background:#fff;color:#5c6660;'),
              onclick: () => { if (on) seleccion.delete(clave); else seleccion.add(clave); pintar(); } }));
          });
          avisoFr.textContent = seleccion.size > 1
            ? `Son ${seleccion.size} casillas al día, una por momento, y cada una cuenta aparte en su constancia.`
            : (seleccion.size === 1 ? 'Una sola toma al día.'
              : 'Sin franja, le aparece donde el sistema deduzca del texto del horario.');
        };
        pintar();

        const nombreFr = (CORTO_FRANJA[franja] || franja).toLowerCase();
        const avisoOrden = h('p', { class: 'muted small', style: 'margin:6px 0 0' });
        const pintarOrden = () => {
          avisoOrden.textContent = delta === 0 ? 'Queda donde está.'
            : `Va a ${delta < 0 ? 'subir' : 'bajar'} ${pl(Math.abs(delta), 'lugar', 'lugares')} en ${nombreFr}.`;
        };
        pintarOrden();

        // Editar y quitar abren su propio dialogo, y solo cabe uno a la vez:
        // se cierra este primero. El click programatico resuelve la promesa en
        // "cancelar", que es exactamente lo que queremos.
        const cerrarMenu = () => document.getElementById('modal-cancel')?.click();

        const cuerpo = h('div', { class: 'stack' },
          h('div', {}, h('strong', { text: it.title }),
            h('div', { class: 'muted small', text: [it.dose, NOMBRE_CAT[it.category]].filter(Boolean).join(' · ') })),
          h('div', { class: 'stack' },
            h('p', { class: 'small', style: 'margin:0;font-weight:700', text: '¿Cuándo se la toma?' }),
            chips, avisoFr),
          h('div', { class: 'stack' },
            h('p', { class: 'small', style: 'margin:0;font-weight:700', text: `Orden dentro de ${nombreFr}` }),
            h('div', { class: 'toolbar' },
              h('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: '↑ Subir',
                onclick: () => { delta -= 1; pintarOrden(); } }),
              h('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: '↓ Bajar',
                onclick: () => { delta += 1; pintarOrden(); } })),
            avisoOrden),
          (Array.isArray(it.days_of_week) && it.days_of_week.length)
            ? h('p', { class: 'muted small', style: 'margin:0',
                text: `Sólo le toca ${etiquetaDias(it.days_of_week.map(Number))}. Los días se cambian al editar la indicación.` })
            : null,
          h('div', { class: 'toolbar' },
            h('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: 'Editar la indicación',
              onclick: () => { cerrarMenu(); editar(plan.id, it, tras); } }),
            h('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: 'Quitar del plan',
              onclick: async () => {
                cerrarMenu();
                if (!(await modal('Quitar indicación', h('div', { class: 'stack' },
                  h('p', { text: `Se quita «${it.title}» del plan.` }),
                  h('p', { class: 'muted small', text: 'Deja de aparecerle mañana. Lo que ya palomeó no se borra.' })),
                  'Quitar'))) return;
                try { await api.removePlanItem(it.id); toast('Quitada'); await tras(); }
                catch (e) { toast(`Error: ${e.message}`, true); }
              } })));

        if (!(await modal(`Mover ${it.title}`, cuerpo, 'Aplicar'))) return;

        const antesSlots = JSON.stringify(Array.isArray(it.slots) ? [...it.slots].sort() : []);
        const ahoraSlots = JSON.stringify([...seleccion].sort());
        try {
          if (antesSlots !== ahoraSlots) {
            await api.moverPlanItem(it.id, [...seleccion]);
            toast(seleccion.size ? `${it.title}: ${pl(seleccion.size, 'momento', 'momentos')} al día` : `${it.title} quedó sin franja`);
            await tras();
          }
          if (delta !== 0) await mover(it.id, franja, delta);
        } catch (e) { toast(`No se pudo guardar: ${e.message}`, true); }
      }

      dibujar();
      document.body.append(fondo);
    }

    async function generar() {
      const texto = vigente
        ? 'Se genera una versión nueva del borrador a partir del panel actual. La versión anterior queda marcada como reemplazada; las indicaciones que ya capturaste NO se copian.'
        : 'Se genera el borrador con los hallazgos, las metas y los puntos a revisar. El tratamiento lo captura el médico.';
      if (!(await modal('Generar plan', h('p', { text: texto }), 'Generar'))) return;
      try { const r = await api.generatePlan(patient.id); toast(`Versión ${r.version} · ${r.hallazgos} hallazgo(s)`); load(); }
      catch (e) { toast(`Error: ${e.message}`, true); }
    }

    async function editar(planId, item, alGuardar) {
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
        // La franja sugerida del catalogo: elegir Magnesio ya trae "antes de
        // dormir". La medica la puede cambiar para este paciente.
        if (Array.isArray(c.default_slots) && c.default_slots.length) {
          franjas.clear();
          c.default_slots.forEach((f) => franjas.add(f));
          pintarFranjas();
        }
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

      /* ---------- franja horaria ----------
         Se elige de una lista fija. Antes se derivaba del texto de Horario, y
         eso mandaba "Tesamorelina, noche" a la cena en vez de antes de dormir,
         y dejaba "Mañana y noche" con una sola toma visible para el paciente. */
      const franjas = new Set(Array.isArray(item?.slots) ? item.slots : []);
      const chipsFr = h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap' });
      const avisoFr = h('p', { class: 'muted small', style: 'margin:4px 0 0' });
      const pintarFranjas = () => {
        chipsFr.innerHTML = '';
        FRANJAS.forEach(([clave, , corto]) => {
          const on = franjas.has(clave);
          chipsFr.append(h('button', {
            type: 'button', text: corto, 'aria-pressed': on ? 'true' : 'false',
            style: 'font:inherit;font-size:12.5px;font-weight:600;padding:9px 12px;border-radius:9px;cursor:pointer;'
              + (on ? 'border:1px solid #0f241d;background:#0f241d;color:#fff;'
                    : 'border:1px solid #c9cfcb;background:#fff;color:#5c6660;'),
            onclick: () => { if (franjas.has(clave)) franjas.delete(clave); else franjas.add(clave); pintarFranjas(); },
          }));
        });
        avisoFr.textContent = franjas.size > 1
          ? `Le va a aparecer ${franjas.size} veces al día, con una palomita cada vez.`
          : (franjas.size === 1 ? '' : 'Sin franja, al paciente le aparece en "A cualquier hora".');
      };
      pintarFranjas();

      const bloqueFranjas = h('div', { class: 'stack' },
        h('p', { class: 'small', style: 'margin:0;font-weight:700', text: '¿Cuándo se la toma?' }),
        chipsFr, avisoFr);
      const verFranjas = () => { bloqueFranjas.style.display = CON_DOSIS.includes(cat.value) ? '' : 'none'; };
      cat.addEventListener('change', verFranjas);
      verFranjas();

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

      const cuerpoForm = h('div', { class: 'stack' }, campo('Categoría', cat), campo('Del catálogo', picker), avisoReg, campo('Qué', titulo), bloqueFranjas, bloquePep, campo('Dosis', dosis), campo('Reconstitución del vial', recon),
        h('div', { class: 'fields-grid' }, campo('Nota de horario', horario), campo('Frecuencia', frec)),
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

        // Avisar ANTES de duplicar. Agregar a mano algo que ya está en el plan
        // no da ningún error: entran dos renglones idénticos y el paciente ve
        // la misma toma dos veces, cada una con su propia palomita. Ya pasó.
        // No se bloquea —puede haber una razón— pero no en silencio.
        const nuevoTitulo = titulo.value.trim().toLowerCase();
        if (!item?.id) {
          const repe = mios.filter((i) => String(i.title || '').trim().toLowerCase() === nuevoTitulo);
          if (repe.length) {
            const aviso = h('div', { class: 'stack' },
              h('p', { text: `Este plan ya tiene «${repe[0].title}».` }),
              h('p', { class: 'muted small',
                text: 'Si lo agregas otra vez, el paciente va a ver la misma toma repetida en su día, '
                    + 'cada una con su propia casilla. Para tomarlo a distintas horas, edita el renglón '
                    + 'que ya existe y márcale varias franjas.' }));
            if (!(await modal('Ya está en el plan', aviso, 'Agregar de todas formas'))) return;
          }
        }

        await api.savePlanItem(planId, {
          id: item?.id, category: cat.value, title: titulo.value.trim(), dose: doseTexto,
          reconstitution: reconTexto,
          dose_un: completo ? Number(unidades.value) : null,
          vial_mg: completo ? Number(vialMg.value) : null,
          vial_ml: completo ? Number(vialMl.value) : null,
          syringe: completo ? jeringa.value : null,
          days_of_week: esPep && marcados.length ? marcados : null,
          slots: CON_DOSIS.includes(cat.value) && franjas.size ? [...franjas] : null,
          timing: horario.value.trim() || null, frequency: frec.value.trim() || null,
          rationale: motivo.value.trim() || null, instructions: instr.value.trim() || null,
          sort_order: item?.sort_order ?? 50,
        });
        toast('Guardado'); (alGuardar || load)();
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
      // Lo incomodo va PRIMERO. Un renglon repetido no lo ve nadie en una tabla
      // por categorias, y al paciente le aparece dos veces al dia con dos
      // palomitas: su constancia sale inflada y la dosis real se duplica.
      const rvF = revisionDelDia(mios.filter((i) => CON_TOMA.includes(i.category)),
        tomasDeItems(mios.filter((i) => CON_TOMA.includes(i.category))));
      const cuerpo = h('div', { class: 'stack' },
        rvF.repetidos.length ? h('div', { class: 'notice danger' },
          h('b', { text: rvF.repetidos.length === 1 ? 'Una indicación está repetida: ' : `${rvF.repetidos.length} indicaciones están repetidas: ` }),
          rvF.repetidos.map((g) => `${g[0].title} (${g.length}×)`).join(', '),
          h('p', { class: 'small', style: 'margin:8px 0 0',
            text: 'Si firmas así, al paciente le aparecen dos casillas de lo mismo cada día y su constancia va a salir inflada. Puedes cerrar esto, quitar la repetida desde «Revisar y firmar», y volver.' })) : null,
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
      if (yaTeniaPlan) {
        cuerpo.append(h('p', { class: 'small', style: 'margin-top:10px;font-weight:600',
          text: 'Tu paciente ya tiene un plan entregado. Al firmar, este reemplaza al anterior en su teléfono y se conserva su historial de tomas.' }));
        cuerpo.append(cuadroCambios());
        if (seVan.length) {
          cuerpo.append(h('p', { class: 'small', style: 'margin-top:6px;color:var(--danger);font-weight:600',
            text: `Ojo: ${seVan.length} renglón(es) que hoy toma dejarían de aparecerle. Si los quiere seguir tomando, tienen que estar también en esta versión.` }));
        }
      }
      if (!(await modal('Firmar plan', cuerpo, 'Firmar'))) return;
      if (sinDosis.length && !ck.checked) { toast('Marca el reconocimiento o corrige las dosis antes de firmar', true); return; }
      try {
        const r = await api.signPlan(plan.id, sinDosis.length > 0);
        // Si el paciente YA traia un plan entregado, firmar y no entregar lo
        // deja siguiendo el plan viejo sin que nadie lo note. Se entrega en el
        // mismo acto, y el historial de tomas lo hereda la base.
        let extra = '';
        if (yaTeniaPlan) {
          try {
            const d = await api.deliverPlan(plan.id);
            const h = d?.herencia || {};
            extra = h.dias_reescritos > 0
              ? ` y entregado · se conservó el historial de ${h.renglones_mapeados} renglón(es)`
              : ' y entregado';
          } catch (e2) { extra = ` · NO se pudo entregar: ${e2.message}`; }
        }
        toast(r?.sin_dosis_auditable
          ? `Plan firmado${extra} · ${r.sin_dosis_auditable} renglón(es) sin dosis auditable, queda registrado`
          : `Plan firmado${extra}`);
        load();
      } catch (e) { toast(e.message, true); }
    }

    async function entregar(plan) {
      const cuerpo = h('div', { class: 'stack' },
        h('p', { text: 'El plan queda disponible para el paciente.' }));
      if (anterior) {
        cuerpo.append(cuadroCambios());
        if (seVan.length) {
          cuerpo.append(h('p', { class: 'small', style: 'color:var(--danger);font-weight:600',
            text: `${seVan.length} renglón(es) que hoy toma dejarían de aparecerle.` }));
        }
      }
      if (!(await modal('Entregar al paciente', cuerpo, 'Entregar'))) return;
      try {
        const r = await api.deliverPlan(plan.id);
        const he = r?.herencia || {};
        toast(he.dias_reescritos > 0
          ? `Entregado · se conservó el historial de ${he.renglones_mapeados} renglón(es)`
          : 'Entregado');
        load();
      } catch (e) { toast(`Error: ${e.message}`, true); }
    }
  };
  load();
}
