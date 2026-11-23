// El dia del paciente, en UN solo lugar.
//
// Lo usan dos pantallas: la del paciente ("Hoy") y la vista previa con la que
// la medica firma. El HTML y las clases son los MISMOS en las dos, y por eso
// esto vive aqui y no en cada panel.
//
// La razon no es ahorrar lineas. Si la previa se dibujara aparte, el dia que
// una cambie la otra miente -- y mentiria justo en el momento de firmar, que
// es cuando nadie puede verificarla.
import {
  FRANJAS, NOMBRE_FRANJA, CORTO_FRANJA,
  franjasDe, porFranja, llaveToma, horaDe,
} from './franjas.js';
import { DIAS as DIAS_SEMANA, hoyISO } from './peptido.js';

export const CON_TOMA = ['supplement', 'peptide', 'medication'];
export const PALOMA = '<svg viewBox="0 0 24 24"><path d="M4 12.5l5 5L20 6.5"/></svg>';
export const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Una toma es un par (renglon, franja). Mio-inositol de manana y de noche son
// DOS tomas, con su propia palomita: si comparten una, marcar la de la manana
// da por hecha la de la noche y el paciente se salta una dosis.
export function tomasDeItems(items) {
  const mapa = porFranja(items || []);
  const fuera = [];
  FRANJAS.forEach(([clave]) => {
    (mapa.get(clave) || []).forEach((i) => fuera.push({ i, franja: clave, llave: llaveToma(i, clave) }));
  });
  return fuera;
}

export function etiquetas(it) {
  let e = '';
  const t = `${it.timing || ''} ${it.instructions || ''}`.toLowerCase();
  if (/subcut|intramus|inyec/.test(t) || it.category === 'peptide') e += '<span class="et">SUBCUTÁNEO</span>';
  const ciclo = /(\d+)\s*d[ií]as/.exec(it.frequency || '');
  if (ciclo) e += `<span class="et ciclo">CICLO DE ${ciclo[1]} DÍAS</span>`;
  return e;
}

// Los dias van en su propia fila, debajo del renglon: el renglon es un <button>
// y meterle otro boton adentro deja el HTML invalido.
export function chipsDias(i) {
  if (!Array.isArray(i.days_of_week) || !i.days_of_week.length) return '';
  const hoy = hoyISO();
  const marcados = i.days_of_week.map(Number);
  return '<div class="pep-dias">' + DIAS_SEMANA.map(([n, corto, largo]) => {
    const on = marcados.includes(n);
    const clase = `${on ? 'on' : ''}${on && n === hoy ? ' hoy' : ''}`.trim();
    return `<span class="${clase}" title="${esc(largo)}">${corto}</span>`;
  }).join('') + '</div>';
}

// El boton solo aparece cuando la dosis esta COMPLETA. Una jeringa dibujada a
// partir de un vial que no conocemos seria peor que no dibujar nada: el
// paciente la seguiria al pie de la letra.
export function botonJeringa(i) {
  if (!(Number(i.dose_un) > 0) || !i.syringe || !(Number(i.vial_mg) > 0) || !(Number(i.vial_ml) > 0)) return '';
  return `<button class="pep-ver" type="button" data-pep="${esc(i.id)}">
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
         stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
      <path d="M19 3l2 2"/><path d="M17.5 5.5l1 1"/><path d="M20 4l-9.5 9.5"/>
      <path d="M14.5 6.5l3 3"/><path d="M11.5 9.5l3 3"/><path d="M10.5 13.5L3 21"/><path d="M5.5 16.5l2 2"/>
    </svg>
    Ver la dosis en la jeringa</button>`;
}

const ASA = `<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" fill="currentColor">
  <circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/>
  <circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>`;

/* ---------------- el dia ----------------

   opciones:
     hechas     objeto llave->fecha de lo palomeado (pantalla del paciente)
     horas      horas de recordatorio que el paciente configuro
     periodico  estado de las inyecciones periodicas
     previa     true = la ve la medica antes de firmar: asas para arrastrar,
                menu por renglon, y un "+ Agregar" al pie de cada franja.
                La casilla se dibuja apagada y NO responde: palomear es del
                paciente, no de quien firma.
*/
export function htmlDia(tomas, opts = {}) {
  const { hechas = {}, horas = null, periodico = {}, previa = false } = opts;
  let html = '';

  const grupos = new Map();
  (tomas || []).forEach((t) => {
    if (!grupos.has(t.franja)) grupos.set(t.franja, []);
    grupos.get(t.franja).push(t);
  });

  FRANJAS.forEach(([clave, nombre]) => {
    const lista = grupos.get(clave);
    // En la previa la franja vacia SI se dibuja: es donde la medica agrega lo
    // que le falta. En la del paciente, una franja vacia es ruido.
    if (!lista?.length && !previa) return;
    const filas = lista || [];
    const n = filas.filter((t) => hechas?.[t.llave]).length;
    // La hora es la QUE EL PACIENTE configuro para sus recordatorios, no una
    // inventada por el sistema.
    const hora = horaDe(clave, horas);
    const cuenta = previa
      ? (filas.length ? `<em>· ${filas.length} ${filas.length === 1 ? 'toma' : 'tomas'}</em>` : '<em class="vacia">· sin nada</em>')
      : `<em>· ${n} de ${filas.length}</em>`;
    html += `<div class="fr${previa ? ' fr-previa' : ''}" data-franja="${esc(clave)}">`
      + `<h3>${esc(CORTO_FRANJA[clave] || nombre)}${hora ? ` <b class="hr">${esc(hora)}</b>` : ''} ${cuenta}</h3>`
      + '<div class="lista">';

    filas.forEach(({ i, llave }) => {
      const on = hechas?.[llave] ? ' on' : '';
      const per = periodico?.[i.id];
      // Un atraso en una inyeccion semanal no es lo mismo que olvidar una
      // capsula: se dice con numero, no con un regano generico.
      const atraso = per?.atraso > 0
        ? `<span class="tarde">Van ${per.atraso} ${per.atraso === 1 ? 'día' : 'días'} de retraso</span>`
        : '';
      const sub = atraso || (i.reconstitution ? `<span>${esc(i.reconstitution)}</span>` : '');
      const cuerpo = `<span class="cb">${PALOMA}</span>
        <span class="nm"><b>${esc(i.title)}${etiquetas(i)}</b>${sub}</span>
        ${i.dose ? `<span class="ds">${esc(i.dose)}</span>` : ''}`;

      if (previa) {
        // Un renglon de varias franjas se marca: moverlo o quitarlo toca las
        // dos apariciones, y eso tiene que verse antes de hacerlo.
        const veces = franjasDe(i).length;
        const sinSlot = !(Array.isArray(i.slots) && i.slots.length);
        html += `<div class="it previa${sinSlot ? ' sinslot' : ''}" draggable="true"
            data-item="${esc(i.id)}" data-franja="${esc(clave)}">
          <button class="dia-asa" type="button" tabindex="-1" aria-hidden="true" title="Arrastra para cambiar el orden">${ASA}</button>
          ${cuerpo}
          ${veces > 1 ? `<span class="dia-veces" title="Aparece en ${veces} momentos del día">${veces}×</span>` : ''}
          ${sinSlot ? '<span class="dia-dedu" title="Sin franja elegida: se dedujo del texto">deducido</span>' : ''}
          <button class="dia-men" type="button" data-men="${esc(i.id)}" data-franja="${esc(clave)}"
                  aria-label="Opciones de ${esc(i.title)}">⋯</button>
        </div>`;
        html += chipsDias(i);
      } else {
        html += `<button class="it${on}" type="button" data-id="${esc(llave)}" aria-pressed="${on ? 'true' : 'false'}">
          ${cuerpo}</button>`;
        html += chipsDias(i) + botonJeringa(i);
      }
    });

    if (previa) {
      // El nombre LARGO en minusculas, no el corto: el corto da "+ Agregar algo
      // a en ayunas" y "a a cualquier hora". El largo ya trae su preposicion.
      html += `<button class="dia-add" type="button" data-add="${esc(clave)}">+ Agregar algo ${esc(String(nombre).toLowerCase())}</button>`;
    }
    html += '</div></div>';
  });

  return html;
}

/* ---------------- lo que hay que ver antes de firmar ----------------
   No son sugerencias de estilo: son las tres cosas que una tabla por
   categorias esconde y el dia armado deja a la vista. */
export function revisionDelDia(items, tomas) {
  const conToma = (items || []).filter((i) => CON_TOMA.includes(i.category));

  const porNombre = new Map();
  conToma.forEach((i) => {
    const k = String(i.title || '').trim().toLowerCase();
    if (!porNombre.has(k)) porNombre.set(k, []);
    porNombre.get(k).push(i);
  });
  const repetidos = [...porNombre.values()].filter((g) => g.length > 1);

  const sinSlot = conToma.filter((i) => !(Array.isArray(i.slots) && i.slots.length));
  const inyectables = conToma.filter((i) => i.category === 'peptide'
    || /subcut|intramus|inyec/i.test(`${i.timing || ''} ${i.instructions || ''}`));
  const sinJeringa = inyectables.filter((i) => !(Number(i.dose_un) > 0 && Number(i.vial_mg) > 0
    && Number(i.vial_ml) > 0 && i.syringe));

  const cargadas = new Map();
  (tomas || []).forEach((t) => cargadas.set(t.franja, (cargadas.get(t.franja) || 0) + 1));
  let pico = null;
  cargadas.forEach((n, f) => { if (!pico || n > pico.n) pico = { f, n }; });

  return {
    repetidos, sinSlot, inyectables, sinJeringa,
    tomas: (tomas || []).length,
    momentos: cargadas.size,
    pico: pico && pico.n >= 4 ? pico : null,
    nombreFranja: (f) => CORTO_FRANJA[f] || NOMBRE_FRANJA[f] || f,
  };
}

/* ---------------- el entrenamiento del dia ----------------

   El ejercicio vive en protocol_items como cualquier suplemento, con sus
   days_of_week y su catalog_code. El GRUPO MUSCULAR no se guarda en el
   renglon: se hereda del catalogo por el codigo, para que no se pueda
   contradecir. Lo que si se guarda es el nombre del dia (bloque). */

export const DIAS_SEMANA_NUM = (fecha) => (fecha.getDay() === 0 ? 7 : fecha.getDay());

export function ejerciciosDeHoy(items, fecha = new Date()) {
  const n = DIAS_SEMANA_NUM(fecha);
  return (items || []).filter((i) => {
    if (i.category !== 'exercise' || i.is_active === false) return false;
    const d = Array.isArray(i.days_of_week) ? i.days_of_week.map(Number) : [];
    // Sin dias marcados se entiende "todos los dias": es lo que espera quien
    // captura "pasos diarios" y no toca los chips.
    return !d.length || d.includes(n);
  });
}

// Agrupa por bloque conservando el orden de sort_order. Un ejercicio sin
// bloque cae en "Entrenamiento", que es mejor que inventarle un nombre.
export function bloquesDe(ejercicios) {
  const mapa = new Map();
  (ejercicios || []).forEach((i) => {
    const k = limpioTexto(i.bloque) || 'Entrenamiento';
    if (!mapa.has(k)) mapa.set(k, []);
    mapa.get(k).push(i);
  });
  return [...mapa.entries()];
}

const limpioTexto = (t) => { const v = String(t ?? '').trim(); return v || null; };

// La carga que se le enseña: 4 × 6-10. Si falta algo, se enseña lo que haya.
export function cargaDe(i) {
  const s = Number(i.series) > 0 ? String(i.series) : null;
  const r = limpioTexto(i.reps);
  if (s && r) return `${s} × ${r}`;
  return s ? `${s} series` : (r || limpioTexto(i.dose) || '');
}

export function htmlEntreno(grupos, opts = {}) {
  const { hechas = {}, previa = false } = opts;
  let html = '';
  (grupos || []).forEach(([bloque, lista]) => {
    if (!lista.length) return;
    const n = lista.filter((i) => hechas?.[i.id]).length;
    html += `<div class="fr" data-bloque="${esc(bloque)}">`
      + `<h3>${esc(bloque)} <em>· ${n} de ${lista.length}</em></h3><div class="lista">`;
    lista.forEach((i) => {
      const on = hechas?.[i.id] ? ' on' : '';
      const sub = [limpioTexto(i.patron_es), limpioTexto(i.rpe) ? `RPE ${i.rpe}` : null]
        .filter(Boolean).join(' · ');
      const carga = cargaDe(i);
      const cuerpo = `<span class="cb">${PALOMA}</span>
        <span class="nm"><b>${esc(i.title)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}</span>
        ${carga ? `<span class="ds">${esc(carga)}</span>` : ''}`;
      html += previa
        ? `<div class="it previa" data-item="${esc(i.id)}">${cuerpo}</div>`
        : `<button class="it${on}" type="button" data-ej="${esc(i.id)}" aria-pressed="${on ? 'true' : 'false'}">${cuerpo}</button>`;
    });
    html += '</div></div>';
  });
  return html;
}
