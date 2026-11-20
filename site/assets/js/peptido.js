// Péptidos en unidades de jeringa.
//
// Una sola casa para la aritmética y para el dibujo, porque las dos pantallas
// —la de la médica y la del paciente— tienen que decir exactamente el mismo
// número. Si cada una lo calcula por su lado, el día que una cambie, la otra
// miente sin que nadie se entere.
//
// La regla de fondo: UN no es una dosis. Es una marca en una jeringa. Los
// mismos 30 UN son 4 mg con un vial de 40 mg en 3 mL, y 7.5 mg con uno de
// 50 mg en 1 mL. Sin vial y sin tipo de jeringa, los mg no existen.

export const JERINGAS = [
  ['U-100', 'U-100 · 100 unidades por mL'],
  ['U-40', 'U-40 · 40 unidades por mL'],
];

// mL que vale UNA unidad en cada jeringa. La U-40 da 2.5 veces más volumen
// por unidad, y las dos se ven casi iguales en la mano.
export const ML_POR_UNIDAD = { 'U-100': 0.01, 'U-40': 0.025 };

export const DIAS = [
  [1, 'LUN', 'lunes'], [2, 'MAR', 'martes'], [3, 'MIÉ', 'miércoles'],
  [4, 'JUE', 'jueves'], [5, 'VIE', 'viernes'], [6, 'SÁB', 'sábado'], [7, 'DOM', 'domingo'],
];

const num = (x) => { const n = Number(x); return Number.isFinite(n) ? n : null; };

export function mlDeUnidades(un, jeringa) {
  const u = num(un);
  const f = ML_POR_UNIDAD[jeringa];
  return u === null || !f ? null : u * f;
}

// Devuelve los mg, o null si falta cualquier pieza. Null es una respuesta:
// significa "no se puede saber", y la pantalla tiene que decirlo así en vez
// de pintar un cero.
export function mgDeUnidades({ un, vial_mg, vial_ml, jeringa }) {
  const u = num(un); const mg = num(vial_mg); const ml = num(vial_ml);
  const f = ML_POR_UNIDAD[jeringa];
  if (u === null || mg === null || ml === null || !f) return null;
  if (u <= 0 || mg <= 0 || ml <= 0) return null;
  return u * (mg / ml) * f;
}

export function concentracion(vial_mg, vial_ml) {
  const mg = num(vial_mg); const ml = num(vial_ml);
  return mg === null || ml === null || ml <= 0 ? null : mg / ml;
}

const redondo = (x, d) => (x === null ? null : Number(x.toFixed(d)).toLocaleString('es-MX'));

export const textoMg = (v) => (v === null ? null : `${redondo(v, v < 1 ? 3 : 2)} mg`);
export const textoMl = (v) => (v === null ? null : `${redondo(v, 2)} mL`);
export const textoConc = (v) => (v === null ? null : `${redondo(v, 2)} mg/mL`);

export function etiquetaDias(dias) {
  if (!Array.isArray(dias) || !dias.length) return null;
  const orden = DIAS.filter(([n]) => dias.includes(n));
  if (orden.length === 7) return 'Todos los días';
  return orden.map(([, c]) => c).join(' · ');
}

export const hoyISO = () => { const d = new Date().getDay(); return d === 0 ? 7 : d; };

const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---------- el dibujo ----------
   La jeringa se dibuja con la escala de la jeringa real, no con una barra de
   progreso: el paciente tiene que poder comparar el dibujo con lo que trae en
   la mano. Si la dosis se pasa de la capacidad, se dice, no se recorta. */

export function jeringaHorizontal(un, jeringa, alto) {
  const cap = jeringa === 'U-40' ? 40 : 50;
  const u = Math.max(0, num(un) || 0);
  const X0 = 73; const ANCHO = 210;
  const porUn = ANCHO / cap;
  const lleno = Math.min(ANCHO, u * porUn);
  const tope = X0 + lleno;

  let marcas = '';
  for (let i = 1; i <= cap; i += 1) {
    const y2 = i % 10 === 0 ? 48 : (i % 5 === 0 ? 42 : 36);
    marcas += `<line x1="${(X0 + i * porUn).toFixed(1)}" y1="28" x2="${(X0 + i * porUn).toFixed(1)}" y2="${y2}"></line>`;
  }
  let rot = '';
  for (let i = 0; i <= cap; i += 10) {
    rot += `<text x="${(X0 + i * porUn).toFixed(1)}" y="78">${i}</text>`;
  }

  return `<svg viewBox="0 0 340 92" role="img" aria-label="Jeringa ${esc(jeringa || 'U-100')} llena hasta ${u} unidades"
      style="width:100%;height:${alto ? `${alto}px` : 'auto'};display:block">
    <line x1="6" y1="46" x2="52" y2="46" stroke="#9aa0a6" stroke-width="3"></line>
    <path d="M52 36 L72 30 L72 62 L52 56 Z" fill="#c7ccd1"></path>
    <rect x="72" y="28" width="212" height="36" rx="5" fill="#fff" stroke="#b9c1bc" stroke-width="2"></rect>
    <rect x="73" y="29" width="${lleno.toFixed(1)}" height="34" rx="4" fill="#bcd9cb"></rect>
    <rect x="${tope.toFixed(1)}" y="27" width="9" height="38" rx="2" fill="#3b4440"></rect>
    <rect x="292" y="18" width="9" height="56" rx="3" fill="#6b746f"></rect>
    <g stroke="#7d8783" stroke-width="1.4">${marcas}</g>
    <g font-size="9" font-weight="600" fill="#5c6660" text-anchor="middle">${rot}</g>
    <line x1="${tope.toFixed(1)}" y1="12" x2="${tope.toFixed(1)}" y2="28" stroke="#c0521a" stroke-width="2.5"></line>
    <circle cx="${tope.toFixed(1)}" cy="12" r="3.5" fill="#c0521a"></circle>
  </svg>`;
}

export function jeringaVertical(un, jeringa) {
  const cap = jeringa === 'U-40' ? 40 : 50;
  const u = Math.max(0, num(un) || 0);
  const Y0 = 410; const ALTO = 340;
  const porUn = ALTO / cap;
  const lleno = Math.min(ALTO, u * porUn);
  const yTope = Y0 - lleno;

  let marcas = '';
  for (let i = 1; i <= cap; i += 1) {
    const x1 = i % 10 === 0 ? 52 : (i % 5 === 0 ? 68 : 80);
    marcas += `<line x1="${x1}" y1="${(Y0 - i * porUn).toFixed(1)}" x2="108" y2="${(Y0 - i * porUn).toFixed(1)}"></line>`;
  }
  let rot = '';
  for (let i = 0; i <= cap; i += 10) {
    rot += `<text x="46" y="${(Y0 - i * porUn + 5).toFixed(1)}">${i}</text>`;
  }

  return `<svg viewBox="0 0 160 520" role="img" aria-label="Jeringa ${esc(jeringa || 'U-100')} llena hasta la marca de ${u} unidades"
      style="width:128px;height:auto;display:block;flex:none">
    <rect x="38" y="16" width="84" height="12" rx="4" fill="#6b746f"></rect>
    <rect x="74" y="28" width="12" height="${Math.max(0, yTope - 36).toFixed(1)}" fill="#6b746f"></rect>
    <rect x="52" y="68" width="56" height="344" rx="7" fill="#fff" stroke="#b9c1bc" stroke-width="2.5"></rect>
    <rect x="54.5" y="${yTope.toFixed(1)}" width="51" height="${lleno.toFixed(1)}" rx="5" fill="#bcd9cb"></rect>
    <rect x="53" y="${(yTope - 14).toFixed(1)}" width="54" height="16" rx="3" fill="#3b4440"></rect>
    <path d="M66 412 L94 412 L85 436 L75 436 Z" fill="#c7ccd1"></path>
    <rect x="78" y="436" width="4" height="70" rx="2" fill="#9aa0a6"></rect>
    <g stroke="#7d8783" stroke-width="1.6">${marcas}</g>
    <g font-size="13" font-weight="700" fill="#5c6660" text-anchor="end">${rot}</g>
    <line x1="30" y1="${(yTope - 6).toFixed(1)}" x2="128" y2="${(yTope - 6).toFixed(1)}" stroke="#c0521a" stroke-width="3.5"></line>
    <circle cx="30" cy="${(yTope - 6).toFixed(1)}" r="5" fill="#c0521a"></circle>
  </svg>`;
}

// Lo que falta para que la dosis sea reproducible. Devuelve [] cuando no falta
// nada. Es la misma regla que aplica la base en private.dosis_concreta: si las
// dos se separan, la médica guarda algo que luego no puede firmar.
export function faltaParaAuditar(it) {
  if (it.dose_un === null || it.dose_un === undefined || it.dose_un === '') return [];
  const f = [];
  if (!(num(it.dose_un) > 0)) f.push('las unidades');
  if (!(num(it.vial_mg) > 0)) f.push('los mg del vial');
  if (!(num(it.vial_ml) > 0)) f.push('los mL de diluyente');
  if (!ML_POR_UNIDAD[it.syringe]) f.push('el tipo de jeringa');
  return f;
}
