// Biblioteca. La MISMA para el paciente y para la medica, como dia.js: una
// sola ficha, no dos redacciones que con el tiempo se contradicen.
//
// Dos reglas que no se negocian, porque esto se publica:
//
// 1. Sello regulatorio. De los 53 peptidos del catalogo, 25 estan marcados
//    "no aprobado para uso humano" y 12 "en investigacion". Esas fichas salen
//    con su banda, arriba, antes que cualquier otra cosa. Una ficha tecnica de
//    BPC-157 sin esa banda no es informacion: es promocion.
//
// 2. Sello de revision. Las fichas las escribio el sistema. Mientras un medico
//    no las firme, lo dicen en la cara. Hoy son 112 de 113. Publicar texto
//    clinico que no firmo nadie, sin decirlo, es lo unico que no se vale.
import { supabase } from './supabase.js';

export const AMBITOS = [
  ['supplement', 'Suplementos', 'Suplemento'],
  ['peptide', 'Péptidos', 'Péptido'],
  ['exercise', 'Ejercicio', 'Ejercicio'],
  ['general', 'Artículos', 'Artículo'],
];
const NOMBRE_AMBITO = Object.fromEntries(AMBITOS.map(([k, , s]) => [k, s]));

const EVIDENCIA = {
  A: ['A', 'Ensayos controlados consistentes'],
  B: ['B', 'Evidencia moderada, con limitaciones'],
  C: ['C', 'Preliminar: estudios pequeños, animales o mecanismo'],
  D: ['D', 'Sin evidencia clínica que la sostenga'],
};
const REGULATORIO = {
  aprobado: null,
  investigacion: ['amarillo', 'En investigación',
    'Se está estudiando en humanos y todavía no tiene registro sanitario para esta indicación.'],
  no_aprobado_uso_humano: ['rojo', 'No aprobado para uso humano',
    'No tiene registro sanitario para uso en personas. Lo que se vende como tal suele etiquetarse "sólo para investigación", y su pureza y concentración no están garantizadas.'],
};

export const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const limpio = (t) => { const v = String(t ?? '').trim(); return v && v !== '—' ? v : null; };
const sinAcentos = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/* ---------------- datos ---------------- */

let memoria = null;

export async function cargarBiblioteca(forzar = false) {
  if (memoria && !forzar) return memoria;
  const [sup, pep, ejer, refs] = await Promise.all([
    supabase.from('catalog_supplements').select('*').eq('is_active', true).order('name_es'),
    supabase.from('catalog_peptides').select('*').eq('is_active', true).order('name_es'),
    supabase.from('catalog_exercises').select('*').eq('is_active', true).order('name_es'),
    supabase.from('catalog_referencias').select('*').order('anio', { ascending: false }),
  ]);
  // Una tabla que falle no deja la biblioteca en blanco: se pinta lo que si llego.
  const fichas = [
    ...(sup.data || []).map(deSuplemento),
    ...(pep.data || []).map(dePeptido),
    ...(ejer.data || []).map(deEjercicio),
    ...(refs.data || []).filter((r) => r.ambito === 'general').map(deArticulo),
  ];
  const error = [sup.error, pep.error, ejer.error, refs.error].filter(Boolean)[0] || null;
  memoria = { fichas, referencias: refs.data || [], error };
  return memoria;
}

function base(f, ambito) {
  const nombre = f.name_es || f.titulo || f.code;
  return {
    ambito,
    code: f.code || f.id,
    id: f.id,
    nombre,
    categoria: limpio(f.category) || limpio(f.modality),
    evidencia: f.evidence_grade || null,
    revisado: !!f.revisado_en,
    revisado_en: f.revisado_en || null,
    fuente: limpio(f.fuente),
    regulatorio: null,
    tecnica: [],      // la rejilla de datos duros de arriba
    secciones: [],    // [[titulo|null, [[etiqueta, texto], ...]], ...]
    bloques: [],      // la misma info, plana: la usan el buscador y las revisiones
    resumen: null,
  };
}

// Aplana las secciones para que el buscador y las comprobaciones no tengan que
// saber como esta agrupada la ficha.
function aplanar(x) {
  x.bloques = x.secciones.flatMap(([, filas]) => filas).filter(([, v]) => v);
  return x;
}
const seccion = (titulo, filas) => [titulo, filas.filter(([, v]) => v)];

// "Pros y contras" en la ficha son dos bloques con nombre claro, no una tabla:
// lo bueno de una sustancia y lo que hay que cuidar no son simetricos, y
// ponerlos en dos columnas iguales sugiere que se cancelan.
function deSuplemento(f) {
  const x = base(f, 'supplement');
  x.resumen = limpio(f.purpose);

  // En un suplemento la FORMA no es un detalle: oxido de magnesio y glicinato
  // de magnesio se absorben distinto y la etiqueta casi nunca lo explica. Por
  // eso va arriba, junto al limite superior.
  x.tecnica = [
    ['Qué es', limpio(f.clase)],
    ['Forma', limpio(f.forma)],
    ['También se le llama', (f.alias || []).join(' · ') || null],
    ['Tope diario', limpio(f.limite_superior)],
  ].filter(([, v]) => v);

  x.secciones = [
    seccion(null, [['Para qué se usa', limpio(f.purpose)]]),
    seccion('Cómo actúa', [
      ['Mecanismo', limpio(f.mecanismo)],
      ['Sobre qué actúa', limpio(f.diana)],
    ]),
    seccion('Cómo se toma', [
      ['Dosis habitual', [limpio(f.default_dose), limpio(f.default_timing), limpio(f.frequency)].filter(Boolean).join(' · ')],
      ['Con qué tomarlo', limpio(f.con_que_tomarlo)],
      ['Qué tanto se absorbe', limpio(f.biodisponibilidad)],
      ['Cuánto tarda en notarse', limpio(f.tiempo_efecto)],
      ['Por cuánto tiempo', limpio(f.ciclo)],
    ]),
    // Lo que nadie escribe y es lo que mas sirve parado en la farmacia.
    seccion('Qué buscar en la etiqueta', [
      ['', limpio(f.etiqueta)],
    ]),
    seccion('Qué dice la evidencia', [
      ['Lo que se ha estudiado', limpio(f.evidencia_resumen)],
    ]),
    seccion('Qué NO se ha estudiado', [
      ['', limpio(f.evidencia_huecos)],
    ]),
    seccion('Seguridad', [
      ['Efectos frecuentes', limpio(f.efectos_frecuentes)],
      ['Efectos graves, poco frecuentes', limpio(f.efectos_graves)],
      ['Cuándo NO se usa', limpio(f.contraindicaciones)],
      ['Interacciones', limpio(f.interactions)],
      ['Qué hay que cuidar', limpio(f.cautions)],
    ]),
  ].filter(([, filas]) => filas.length);
  return aplanar(x);
}

function dePeptido(f) {
  const x = base(f, 'peptide');
  x.resumen = limpio(f.purpose);
  x.regulatorio = REGULATORIO[f.regulatory_status] || null;
  x.regNota = limpio(f.regulatory_note);

  x.tecnica = [
    ['Clase', limpio(f.clase)],
    ['También se le llama', (f.alias || []).join(' · ') || null],
    ['Vía', limpio(f.route)],
    ['Vida media', limpio(f.vida_media)],
    ['Secuencia', limpio(f.secuencia)],
    ['Fórmula', limpio(f.formula)],
    ['Peso molecular', f.peso_molecular ? `${f.peso_molecular} g/mol` : null],
  ].filter(([, v]) => v);

  x.secciones = [
    seccion(null, [['Para qué se usa', limpio(f.purpose)]]),
    seccion('Cómo actúa', [
      ['Mecanismo', limpio(f.mecanismo)],
      ['Sobre qué actúa', limpio(f.diana)],
    ]),
    seccion('Dosis y manejo', [
      ['Dosis habitual', [limpio(f.typical_dose), limpio(f.frequency)].filter(Boolean).join(' · ')],
      ['Cuánto tarda en notarse', limpio(f.tiempo_efecto)],
      ['Duración del ciclo', limpio(f.ciclo)],
      ['Reconstitución', limpio(f.reconstitution_hint)],
      ['Dónde se inyecta', limpio(f.sitios_inyeccion)],
      ['Cómo se guarda', limpio(f.almacenamiento)],
    ]),
    seccion('Qué dice la evidencia', [
      ['Lo que se ha estudiado', limpio(f.evidencia_resumen)],
    ]),
    // Seccion propia y con ese nombre. Una ficha que solo cuenta lo que salio
    // bien es un folleto; lo que la vuelve util es decir donde no hay datos.
    seccion('Qué NO se ha estudiado', [
      ['', limpio(f.evidencia_huecos)],
    ]),
    seccion('Seguridad', [
      ['Efectos frecuentes', limpio(f.efectos_frecuentes)],
      ['Efectos graves, poco frecuentes', limpio(f.efectos_graves)],
      ['Cuándo NO se usa', limpio(f.contraindicaciones)],
      ['Interacciones', limpio(f.interacciones)],
      ['Qué hay que cuidar', limpio(f.cautions)],
      ['Qué se vigila', limpio(f.monitoring)],
    ]),
  ].filter(([, filas]) => filas.length);
  return aplanar(x);
}

function deEjercicio(f) {
  const x = base(f, 'exercise');
  x.resumen = limpio(f.pattern) || limpio(f.primary_muscles);
  x.secciones = [seccion(null, [
    ['Cómo se hace', limpio(f.how_to)],
    ['Músculos', limpio(f.primary_muscles)],
    ['Equipo', limpio(f.equipment)],
    ['Series y repeticiones', [limpio(f.sets_reps_hint), limpio(f.rpe_hint)].filter(Boolean).join(' · ')],
    ['Errores comunes', limpio(f.common_errors)],
    ['Qué hay que cuidar', limpio(f.cautions)],
  ])].filter(([, filas]) => filas.length);
  return aplanar(x);
}

function deArticulo(r) {
  const x = base(r, 'general');
  x.nombre = r.titulo;
  x.categoria = (r.etiquetas || [])[0] || null;
  x.resumen = limpio(r.resumen);
  x.enlace = limpio(r.enlace);
  x.secciones = [seccion(null, [
    ['De qué trata', limpio(r.resumen)],
    ['Publicado en', [limpio(r.publicacion), r.anio].filter(Boolean).join(' · ')],
    ['Autores', limpio(r.autores)],
  ])].filter(([, filas]) => filas.length);
  return aplanar(x);
}

export function buscar(fichas, texto, ambito) {
  const q = sinAcentos(texto).split(/\s+/).filter(Boolean);
  return (fichas || []).filter((f) => {
    if (ambito && ambito !== 'todo' && f.ambito !== ambito) return false;
    if (!q.length) return true;
    const heno = sinAcentos([f.nombre, f.categoria, f.resumen, ...f.bloques.map(([t, v]) => `${t} ${v}`)].join(' '));
    return q.every((w) => heno.includes(w));
  });
}

/* ---------------- dibujo ---------------- */

const sello = (clase, texto, titulo) => `<span class="bib-sello ${clase}"${titulo ? ` title="${esc(titulo)}"` : ''}>${esc(texto)}</span>`;

function sellos(f, enPlan) {
  let s = '';
  if (f.regulatorio) s += sello(f.regulatorio[0], f.regulatorio[1], f.regulatorio[2]);
  if (!f.revisado) s += sello('gris', 'Sin revisar por un médico',
    'La escribió el sistema. Ningún médico la ha firmado todavía.');
  if (enPlan) s += sello('verde', 'Está en tu plan');
  return s;
}

export function tarjetaFicha(f, enPlan) {
  return `<button class="bib-it" type="button" data-ficha="${esc(f.ambito)}:${esc(f.code)}">
    <span class="bib-nm">
      <b>${esc(f.nombre)}</b>
      ${f.resumen ? `<span>${esc(f.resumen)}</span>` : ''}
      <span class="bib-sellos">${sellos(f, enPlan)}</span>
    </span>
    <span class="bib-tipo">${esc(NOMBRE_AMBITO[f.ambito] || '')}${f.evidencia ? ` · ${esc(f.evidencia)}` : ''}</span>
  </button>`;
}

export function htmlFicha(f, { enPlan = false, referencias = [], medico = false } = {}) {
  let h = '';

  // La banda regulatoria va ARRIBA de todo. Si va al final, se lee despues de
  // haber decidido.
  if (f.regulatorio) {
    h += `<div class="bib-banda ${f.regulatorio[0]}">
      <b>${esc(f.regulatorio[1])}</b>
      <span>${esc(f.regulatorio[2])}</span>
      ${f.regNota ? `<span>${esc(f.regNota)}</span>` : ''}
    </div>`;
  }
  if (!f.revisado) {
    h += `<div class="bib-banda gris">
      <b>Esta ficha no la ha revisado un médico</b>
      <span>El texto lo redactó el sistema a partir de literatura general. No es una indicación: lo que te toca a ti está en tu plan, y eso sí lo firma tu médica.</span>
    </div>`;
  }

  h += `<div class="bib-cab">
    <div><h2>${esc(f.nombre)}</h2>
      <p class="muted small">${esc(NOMBRE_AMBITO[f.ambito] || '')}${f.categoria ? ` · ${esc(f.categoria)}` : ''}</p></div>
    <span class="bib-sellos">${enPlan ? sello('verde', 'Está en tu plan') : ''}</span>
  </div>`;

  if (f.evidencia && EVIDENCIA[f.evidencia]) {
    const [g, txt] = EVIDENCIA[f.evidencia];
    h += `<div class="bib-ev"><b>Evidencia ${esc(g)}</b><span>${esc(txt)}</span></div>`;
  }

  if ((f.tecnica || []).length) {
    h += '<dl class="bib-tec">' + f.tecnica.map(([k, v]) =>
      `<dt>${esc(k)}</dt><dd${/Secuencia|Fórmula/.test(k) ? ' class="mono"' : ''}>${esc(v)}</dd>`).join('') + '</dl>';
  }

  (f.secciones || []).forEach(([titulo, filas]) => {
    if (!filas.length) return;
    // "Qué NO se ha estudiado" va con su propio fondo: si se ve igual que el
    // resto, se lee como un parrafo mas y es justo el que hay que leer.
    const hueco = titulo === 'Qué NO se ha estudiado';
    const compra = titulo === 'Qué buscar en la etiqueta';
    if (titulo) h += `<h3 class="bib-sec${hueco ? ' hueco' : ''}${compra ? ' compra' : ''}">${esc(titulo)}</h3>`;
    if (hueco) h += '<div class="bib-huecos">';
    if (compra) h += '<div class="bib-compra">';
    filas.forEach(([t, v]) => {
      h += `<div class="bib-bl">${t ? `<h4>${esc(t)}</h4>` : ''}<p>${esc(v)}</p></div>`;
    });
    if (hueco || compra) h += '</div>';
  });

  if (f.enlace) {
    h += `<div class="bib-bl"><h4>Leerlo completo</h4>
      <p><a href="${esc(f.enlace)}" target="_blank" rel="noopener noreferrer">${esc(f.enlace)}</a></p></div>`;
  }

  const refs = (referencias || []).filter((r) => r.ambito === f.ambito && r.code === f.code);
  h += '<div class="bib-bl"><h4>De dónde sale</h4>';
  if (refs.length) {
    h += '<ul class="bib-refs">' + refs.map((r) => `<li>
      ${r.enlace ? `<a href="${esc(r.enlace)}" target="_blank" rel="noopener noreferrer">${esc(r.titulo)}</a>` : `<b>${esc(r.titulo)}</b>`}
      ${[limpio(r.publicacion), r.anio].filter(Boolean).length ? `<span class="muted small"> — ${esc([limpio(r.publicacion), r.anio].filter(Boolean).join(', '))}</span>` : ''}
    </li>`).join('') + '</ul>';
  } else if (f.fuente) {
    h += `<p>${esc(f.fuente)}</p>`;
  } else {
    h += '<p class="muted small">Todavía no tiene referencias citadas.</p>';
  }
  h += '</div>';

  if (f.revisado) {
    h += `<p class="muted small bib-firma">Revisada por un médico el ${esc(new Date(f.revisado_en).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }))}.</p>`;
  }

  h += `<div class="bib-pie">Esto es información general, no una indicación médica.
    Lo que te toca a ti, con tu dosis y tu horario, está en tu plan.
    ${medico ? '' : 'Antes de empezar o suspender algo, escríbele a tu médica desde Dudas y mensajes.'}</div>`;

  return h;
}

/* ---------------- montaje ----------------
   opciones:
     enPlan    funcion (ficha) => bool. Es funcion y no una lista de codigos
               porque solo 85 de 291 renglones de plan traen catalog_code: el
               resto hay que emparejarlo por nombre, y eso lo sabe quien llama.
     medico    true = pinta los botones de firmar la ficha y agregar referencia
     alFirmar  async (ficha) => {}   sellar la ficha como revisada
     alCitar   async (ficha) => {}   agregar una referencia
*/
export async function montarBiblioteca(caja, opts = {}) {
  const { enPlan = () => false, medico = false, alFirmar = null, alCitar = null } = opts;
  caja.innerHTML = '<div class="spinner"></div>';

  let datos;
  try { datos = await cargarBiblioteca(); }
  catch (e) { caja.innerHTML = `<div class="notice danger">No se pudo abrir la biblioteca: ${esc(e.message)}</div>`; return; }

  let ambito = 'todo';
  let texto = '';

  const chips = [['todo', 'Todo'], ...AMBITOS.map(([k, n]) => [k, n])];
  const sinRevisar = datos.fichas.filter((f) => !f.revisado).length;

  caja.innerHTML = `
    ${datos.error ? `<div class="notice danger">Parte de la biblioteca no cargó: ${esc(datos.error.message)}</div>` : ''}
    <div class="bib-top">
      <input class="bib-q" type="search" placeholder="Buscar: berberina, sueño, grasa visceral…" aria-label="Buscar en la biblioteca">
      <div class="bib-chips">${chips.map(([k, n]) => `<button class="bib-chip${k === 'todo' ? ' on' : ''}" type="button" data-amb="${esc(k)}" aria-pressed="${k === 'todo'}">${esc(n)}</button>`).join('')}</div>
    </div>
    ${sinRevisar ? `<div class="notice small bib-aviso"><b>${sinRevisar} de ${datos.fichas.length} fichas no las ha revisado un médico.</b>
      Las escribió el sistema a partir de literatura general y salen marcadas. Es información para orientarte, no una indicación.</div>` : ''}
    <p class="bib-cuenta muted small"></p>
    <div class="bib-lista"></div>`;

  const lista = caja.querySelector('.bib-lista');
  const cuenta = caja.querySelector('.bib-cuenta');
  const campo = caja.querySelector('.bib-q');

  const pintar = () => {
    const r = buscar(datos.fichas, texto, ambito);
    cuenta.textContent = r.length === 1 ? '1 ficha' : `${r.length} fichas`;
    lista.innerHTML = r.length
      ? r.map((f) => tarjetaFicha(f, enPlan(f))).join('')
      : `<div class="empty-state">${texto.trim()
        ? 'Nada con esas palabras. Prueba con el nombre de la sustancia o con para qué sirve.'
        : (ambito === 'general'
          ? 'Todavía no hay artículos. Tu médica los va agregando conforme encuentra algo que valga la pena.'
          : 'Esta sección todavía está vacía.')}</div>`;
    lista.querySelectorAll('.bib-it').forEach((b) => b.addEventListener('click', () => {
      const [a, ...resto] = b.dataset.ficha.split(':');
      const f = datos.fichas.find((x) => x.ambito === a && String(x.code) === resto.join(':'));
      if (f) abrirFicha(f);
    }));
  };

  function abrirFicha(f) {
    const fondo = document.createElement('div');
    fondo.className = 'hoja-fondo';
    const cerrar = () => { fondo.remove(); document.removeEventListener('keydown', teclas); };
    const teclas = (e) => { if (e.key === 'Escape') cerrar(); };
    document.addEventListener('keydown', teclas);

    fondo.innerHTML = `<div class="hoja bib-hoja" role="dialog" aria-modal="true" aria-label="${esc(f.nombre)}">
      <span class="hoja-asa"></span>
      <div class="bib-cuerpo">${htmlFicha(f, { enPlan: enPlan(f), referencias: datos.referencias, medico })}</div>
      <div class="bib-acciones">
        ${medico && !f.revisado && alFirmar ? '<button class="btn btn-primary btn-sm" type="button" data-acc="firmar">Revisar y firmar la ficha</button>' : ''}
        ${medico && alCitar ? '<button class="btn btn-ghost btn-sm" type="button" data-acc="citar">Agregar una referencia</button>' : ''}
        <button class="btn btn-ghost btn-sm" type="button" data-acc="cerrar">Cerrar</button>
      </div>
    </div>`;

    fondo.addEventListener('click', (e) => { if (e.target === fondo) cerrar(); });
    fondo.querySelector('[data-acc="cerrar"]').addEventListener('click', cerrar);
    fondo.querySelector('[data-acc="firmar"]')?.addEventListener('click', async () => {
      cerrar();
      if (await alFirmar(f)) { await cargarBiblioteca(true).then((d) => { datos = d; }); pintar(); }
    });
    fondo.querySelector('[data-acc="citar"]')?.addEventListener('click', async () => {
      cerrar();
      if (await alCitar(f)) { await cargarBiblioteca(true).then((d) => { datos = d; }); pintar(); }
    });
    document.body.append(fondo);
  }

  let reloj = null;
  campo.addEventListener('input', () => {
    clearTimeout(reloj);
    reloj = setTimeout(() => { texto = campo.value; pintar(); }, 160);
  });
  caja.querySelectorAll('.bib-chip').forEach((b) => b.addEventListener('click', () => {
    ambito = b.dataset.amb;
    caja.querySelectorAll('.bib-chip').forEach((x) => {
      x.classList.toggle('on', x === b);
      x.setAttribute('aria-pressed', x === b ? 'true' : 'false');
    });
    pintar();
  }));

  pintar();
}
