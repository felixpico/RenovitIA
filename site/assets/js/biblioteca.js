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
    ...(refs.data || []).filter(esArticulo).map(deArticulo),
  ];
  const error = [sup.error, pep.error, ejer.error, refs.error].filter(Boolean)[0] || null;
  memoria = { fichas, referencias: refs.data || [], error };
  return memoria;
}

// En catalog_referencias conviven dos cosas con ambito 'general':
//
//   ARTICULO  sin code (una liga suelta que agrego la medica), o CON cuerpo
//             (un articulo escrito aqui, con secciones). Sale en la pestana.
//   CITA      con code y sin cuerpo: se apoya en el articulo de ese code y
//             sale en su "De donde sale", no como un articulo aparte.
//
// Sin esta distincion las citas aparecerian como articulos sueltos y cada
// articulo se citaria a si mismo.
const esArticulo = (r) => r.ambito === 'general' && (!r.code || !!r.cuerpo);
const esCita = (r) => r.ambito === 'general' && !!r.code && !r.cuerpo;

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
/* ---------------- figuras ----------------
   Los diagramas viven AQUI, en codigo, y la base de datos solo guarda su
   CLAVE. Es a proposito y no se negocia: todo lo que sale de la base pasa
   por esc() antes de entrar al HTML, y permitir SVG guardado en la base
   abriria justo el agujero que ese esc() cierra.

   Los colores salen de las variables del tema via clases, no de atributos
   fill: var() no funciona en un atributo de presentacion, solo en CSS. Por
   eso cada figura se pinta con .f-* definidas en styles.css, y asi tambien
   funciona en modo oscuro sin una segunda version del dibujo.
*/
const FIGURAS = {
  "grasa-caminar-correr": `<figure class="bib-fig">
<svg viewBox="0 0 340 214" role="img" aria-labelledby="fg-t fg-d">
  <title id="fg-t">Calorías de grasa quemadas en una hora: caminando contra corriendo</title>
  <desc id="fg-d">Caminando se queman 300 calorías y el 60 por ciento viene de grasa, o sea 180. Corriendo se queman 600 y el 40 por ciento viene de grasa, o sea 240.</desc>
  <rect class="f-grasa" x="56" y="8" width="11" height="11" rx="2"/>
  <text class="f-ley" x="73" y="18">De grasa</text>
  <rect class="f-carb" x="152" y="8" width="11" height="11" rx="2"/>
  <text class="f-ley" x="169" y="18">De carbohidrato</text>
  <text class="f-tot" x="91" y="88" text-anchor="middle">300 kcal</text>
  <rect class="f-carb" x="56" y="95" width="70" height="22"/>
  <rect class="f-grasa" x="56" y="117" width="70" height="33"/>
  <text class="f-dato f-inv" x="91" y="139" text-anchor="middle">180</text>
  <text class="f-tot" x="235" y="33" text-anchor="middle">600 kcal</text>
  <rect class="f-carb" x="200" y="40" width="70" height="66"/>
  <rect class="f-grasa" x="200" y="106" width="70" height="44"/>
  <text class="f-dato f-inv" x="235" y="134" text-anchor="middle">240</text>
  <line class="f-eje" x1="30" y1="150.5" x2="310" y2="150.5"/>
  <text class="f-nom" x="91" y="169" text-anchor="middle">Caminar 1 h</text>
  <text class="f-sub" x="91" y="185" text-anchor="middle">60 % de grasa</text>
  <text class="f-nom" x="235" y="169" text-anchor="middle">Correr 1 h</text>
  <text class="f-sub" x="235" y="185" text-anchor="middle">40 % de grasa</text>
  <text class="f-pie" x="170" y="207" text-anchor="middle">180 kcal de grasa contra 240 kcal de grasa</text>
</svg>
<figcaption>El porcentaje es mejor caminando. Los gramos de grasa son más corriendo, porque el total crece más rápido de lo que cae el porcentaje.</figcaption>
</figure>`,
  "proteina-longland": `<figure class="bib-fig">
<svg viewBox="0 0 340 206" role="img" aria-labelledby="fp-t fp-d">
  <title id="fp-t">Resultado del ensayo: masa magra y grasa según la proteína</title>
  <desc id="fp-d">Con 2.4 gramos por kilo al día la masa magra subió 1.2 kilos y la grasa bajó 4.8 kilos. Con 1.2 gramos por kilo la masa magra subió 0.1 kilos y la grasa bajó 3.5 kilos.</desc>
  <rect class="f-grasa" x="40" y="8" width="11" height="11" rx="2"/>
  <text class="f-ley" x="57" y="18">2.4 g/kg al día</text>
  <rect class="f-carb" x="172" y="8" width="11" height="11" rx="2"/>
  <text class="f-ley" x="189" y="18">1.2 g/kg al día</text>
  <text class="f-dato" x="68" y="62" text-anchor="middle">+1.2 kg</text>
  <rect class="f-grasa" x="46" y="69" width="44" height="17"/>
  <text class="f-dato" x="124" y="78" text-anchor="middle">+0.1</text>
  <rect class="f-carb" x="102" y="84.6" width="44" height="1.4"/>
  <text class="f-nom" x="96" y="104" text-anchor="middle">Masa magra</text>
  <text class="f-nom" x="240" y="78" text-anchor="middle">Grasa</text>
  <rect class="f-grasa" x="196" y="86" width="44" height="67"/>
  <text class="f-dato" x="218" y="170" text-anchor="middle">&#8722;4.8 kg</text>
  <rect class="f-carb" x="252" y="86" width="44" height="49"/>
  <text class="f-dato" x="274" y="152" text-anchor="middle">&#8722;3.5</text>
  <line class="f-eje" x1="30" y1="86" x2="310" y2="86"/>
  <text class="f-pie" x="170" y="199" text-anchor="middle">Mismo déficit, mismo entrenamiento, 4 semanas</text>
</svg>
<figcaption>La única diferencia entre los dos grupos fue la proteína. El grupo de proteína alta ganó músculo mientras perdía más grasa.</figcaption>
</figure>`,
  "dia-del-sueno": `<figure class="bib-fig">
<svg viewBox="0 0 340 176" role="img" aria-labelledby="fs-t fs-d">
  <title id="fs-t">El día, de despertar a despertar</title>
  <desc id="fs-d">Despertar a las 7 y salir a la luz. Última cafeína a las 5 de la tarde, seis horas antes de dormir. Bajar la luz de la casa a las 9. Dormir a las 11 y ocho horas de sueño hasta las 7.</desc>
  <text class="f-nom" x="20" y="36">7:00 Despertar y luz</text>
  <line class="f-tic" x1="20.5" y1="42" x2="20.5" y2="72"/>
  <text class="f-nom" x="195" y="36" text-anchor="middle">21:00 Baja la luz</text>
  <line class="f-tic" x1="195.5" y1="42" x2="195.5" y2="72"/>
  <rect class="f-dia" x="20" y="72" width="200" height="22" rx="3"/>
  <rect class="f-noche" x="220" y="72" width="100" height="22" rx="3"/>
  <text class="f-env" x="120" y="87" text-anchor="middle">16 h despierto</text>
  <text class="f-noc" x="270" y="87" text-anchor="middle">8 h de sueño</text>
  <line class="f-tic" x1="145.5" y1="94" x2="145.5" y2="118"/>
  <text class="f-nom" x="145" y="134" text-anchor="middle">17:00 Última cafeína</text>
  <text class="f-sub" x="145" y="150" text-anchor="middle">6 h antes de dormir</text>
  <line class="f-tic" x1="220.5" y1="94" x2="220.5" y2="118"/>
  <text class="f-nom" x="262" y="134" text-anchor="middle">23:00 Dormir</text>
  <text class="f-pie" x="170" y="170" text-anchor="middle">La hora de despertar es la única fija los siete días.</text>
</svg>
<figcaption>Un día de ejemplo con las cuatro decisiones que más mueven el sueño. Corre las horas a tu horario: lo que importa son las distancias entre ellas.</figcaption>
</figure>`,
  "normal-vs-optimo": `<figure class="bib-fig">
<svg viewBox="0 0 340 196" role="img" aria-labelledby="fn-t fn-d">
  <title id="fn-t">De dónde sale el rango normal del laboratorio</title>
  <desc id="fn-d">La curva es cómo se reparte la glucosa en ayuno en la población. El rango normal del laboratorio, de 70 a 99, cubre casi toda esa curva, incluida la parte que ya tiene resistencia a la insulina. El rango óptimo, de 75 a 85, es una franja angosta en la parte baja.</desc>
  <rect class="f-carb" x="70" y="48" width="116" height="84"/>
  <rect class="f-grasa" x="90" y="48" width="40" height="84" opacity="0.28"/>
  <polyline class="f-curva" points="30.0,129.1 35.6,128.2 41.2,127.1 46.8,125.8 52.4,124.2 58.0,122.2 63.6,119.9 69.2,117.3 74.8,114.2 80.4,110.8 86.0,106.9 91.6,102.7 97.2,98.1 102.8,93.3 108.4,88.2 114.0,82.9 119.6,77.7 125.2,72.5 130.8,67.5 136.4,62.8 142.0,58.6 147.6,54.9 153.2,52.0 158.8,49.8 164.4,48.5 170.0,48.0 175.6,48.5 181.2,49.8 186.8,52.0 192.4,54.9 198.0,58.6 203.6,62.8 209.2,67.5 214.8,72.5 220.4,77.7 226.0,82.9 231.6,88.2 237.2,93.3 242.8,98.1 248.4,102.7 254.0,106.9 259.6,110.8 265.2,114.2 270.8,117.3 276.4,119.9 282.0,122.2 287.6,124.2 293.2,125.8 298.8,127.1 304.4,128.2 310.0,129.1"/>
  <line class="f-eje" x1="30" y1="132.5" x2="310" y2="132.5"/>
  <line class="f-tic" x1="90.5" y1="48" x2="90.5" y2="132"/>
  <line class="f-tic" x1="130.5" y1="48" x2="130.5" y2="132"/>
  <text class="f-ley" x="78" y="42">Normal del laboratorio: 70 a 99</text>
  <text class="f-nom" x="110" y="150" text-anchor="middle">75 a 85</text>
  <text class="f-sub" x="110" y="164" text-anchor="middle">óptimo</text>
  <text class="f-pie" x="170" y="189" text-anchor="middle">Glucosa en ayuno, mg/dL</text>
</svg>
<figcaption>El rango "normal" es el 95 % de la población, y esa población en buena parte ya tiene resistencia a la insulina. Por eso caber en él no es lo mismo que estar óptimo: el tramo de 85 a 99 sigue contando como normal. Los números del ejemplo son los de tu hoja.</figcaption>
</figure>`,
};

// El TERCER elemento de la seccion son sus opciones: { fig, aviso }. Es un
// objeto y no un parametro suelto porque ya van dos y van a ir mas.
const seccion = (titulo, filas, opts = null) => [titulo, filas.filter(([, v]) => v), opts || {}];

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

// Un articulo de la biblioteca tiene DOS formas posibles en la misma tabla:
//
//   con cuerpo  -> es un articulo escrito aqui, con sus secciones. Las citas en
//                  las que se apoya son otras filas con el mismo code.
//   sin cuerpo  -> es una cita: una referencia a un trabajo publicado. No sale
//                  en la lista de articulos, sale en el "De donde sale" del suyo.
function deArticulo(r) {
  const x = base(r, 'general');
  x.nombre = r.titulo;
  x.categoria = (r.etiquetas || [])[0] || null;
  x.resumen = limpio(r.resumen);
  x.enlace = limpio(r.enlace);

  // Un articulo con cuerpo Y con autor o publicacion externa es el resumen de
  // algo de otra persona, no texto escrito aqui. La banda de arriba tiene que
  // decir eso y no "lo redacto el sistema", porque son dos cosas distintas y
  // el lector decide cuanto peso darle segun de donde viene.
  x.ajeno = !!(r.cuerpo && (limpio(r.autores) || limpio(r.publicacion)));
  // Si no hay citas colgadas, la fuente ES de donde se resumio.
  if (x.ajeno) x.fuente = [limpio(r.autores), limpio(r.publicacion)].filter(Boolean).join(' — ');

  const cuerpo = Array.isArray(r.cuerpo) ? r.cuerpo : null;
  if (cuerpo) {
    x.secciones = cuerpo
      .map((s) => seccion(limpio(s.t), (Array.isArray(s.p) ? s.p : []).map((t) => [null, limpio(t)]),
                          { fig: FIGURAS[s.fig] ? s.fig : null, aviso: !!s.aviso }))
      .filter(([, filas]) => filas.length);
  } else {
    x.secciones = [seccion(null, [
      ['De qué trata', limpio(r.resumen)],
      ['Publicado en', [limpio(r.publicacion), r.anio].filter(Boolean).join(' · ')],
      ['Autores', limpio(r.autores)],
    ])].filter(([, filas]) => filas.length);
  }
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
  if (!f.revisado) s += sello('gris', f.ajeno ? 'Resumen de terceros' : 'Sin revisar por un médico',
    f.ajeno ? 'Resume material de alguien más. Ningún médico de aquí lo ha firmado.'
            : 'La escribió el sistema. Ningún médico la ha firmado todavía.');
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
      <b>${f.ajeno ? 'Esto resume material de alguien más' : 'Esta ficha no la ha revisado un médico'}</b>
      <span>${f.ajeno
        ? 'No lo escribió tu médica ni el sistema: resume lo que dijo otra persona, y los criterios que menciona son suyos. Ningún médico de aquí lo ha firmado. Lo que te toca a ti está en tu plan, y eso sí lo firma tu médica.'
        : 'El texto lo redactó el sistema a partir de literatura general. No es una indicación: lo que te toca a ti está en tu plan, y eso sí lo firma tu médica.'}</span>
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

  (f.secciones || []).forEach(([titulo, filas, opts]) => {
    if (!filas.length) return;
    const { fig = null, aviso = false } = opts || {};
    // "Qué NO se ha estudiado" va con su propio fondo: si se ve igual que el
    // resto, se lee como un parrafo mas y es justo el que hay que leer. Un
    // articulo puede pedir ese mismo trato con "aviso": es para la seccion
    // que el lector NO debe saltarse.
    const hueco = aviso || titulo === 'Qué NO se ha estudiado';
    const compra = titulo === 'Qué buscar en la etiqueta';
    if (titulo) h += `<h3 class="bib-sec${hueco ? ' hueco' : ''}${compra ? ' compra' : ''}">${esc(titulo)}</h3>`;
    if (hueco) h += '<div class="bib-huecos">';
    if (compra) h += '<div class="bib-compra">';
    filas.forEach(([t, v]) => {
      h += `<div class="bib-bl">${t ? `<h4>${esc(t)}</h4>` : ''}<p>${esc(v)}</p></div>`;
    });
    // La figura va DESPUES de los parrafos de su seccion, no arriba del articulo:
    // se lee el argumento y se ve el dibujo en el mismo lugar. No lleva esc()
    // porque no viene de la base, viene del registro de arriba.
    if (fig && FIGURAS[fig]) h += FIGURAS[fig];
    if (hueco || compra) h += '</div>';
  });

  if (f.enlace) {
    h += `<div class="bib-bl"><h4>Leerlo completo</h4>
      <p><a href="${esc(f.enlace)}" target="_blank" rel="noopener noreferrer">${esc(f.enlace)}</a></p></div>`;
  }

  const refs = (referencias || []).filter((r) => r.code === f.code
    && (f.ambito === 'general' ? esCita(r) : r.ambito === f.ambito));
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
