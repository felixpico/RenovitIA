// Esquemas originales de cada ejercicio: monigote de palitos, dos cuadros
// (inicio y fin). No son ilustraciones anatomicas, son una referencia de la
// trayectoria para que el paciente sepa de que movimiento hablamos.
const T = '#2f6b58', A = '#c7803a', G = '#9aa5a0';

// cabeza, torso, brazos, piernas en un sistema de 100x100 por cuadro
const fig = (p) => `
  <circle cx="${p.cx}" cy="${p.cy}" r="6" fill="${T}"/>
  <path d="${p.cuerpo}" fill="none" stroke="${T}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>
  ${p.extra || ''}`;

const barra = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${A}" stroke-width="4" stroke-linecap="round"/>`;
const piso = (y = 92) => `<line x1="6" y1="${y}" x2="94" y2="${y}" stroke="${G}" stroke-width="2" stroke-dasharray="3 4"/>`;
const flecha = (d) => `<path d="${d}" fill="none" stroke="${A}" stroke-width="2" stroke-dasharray="4 3" marker-end="url(#pf)"/>`;

// La etiqueta va arriba: abajo chocaba con la linea del piso.
const cuadro = (contenido, etiqueta) => `
  <g>
    <rect x="1" y="1" width="98" height="98" rx="8" fill="#f6f7f4" stroke="#d9dfd9"/>
    <text x="7" y="11" font-size="7" fill="#5d6b64">${etiqueta}</text>
    ${contenido}
  </g>`;

const par = (a, b, ea = 'Inicio', eb = 'Fin') => `
  <svg viewBox="0 0 210 100" class="ej-svg" role="img" aria-label="Esquema del movimiento">
    <defs><marker id="pf" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
      <path d="M0,0 L6,3 L0,6 z" fill="${A}"/></marker></defs>
    ${cuadro(a, ea)}
    <g transform="translate(110,0)">${cuadro(b, eb)}</g>
  </svg>`;

const ESQUEMAS = {
  sentadilla: par(
    piso() + barra(30, 32, 70, 32) + fig({ cx: 50, cy: 24, cuerpo: 'M50 30 L50 56 M38 32 L50 36 L62 32 M50 56 L44 76 L44 92 M50 56 L56 76 L56 92' }),
    piso() + barra(28, 50, 68, 50) + fig({ cx: 48, cy: 42, cuerpo: 'M48 48 L54 66 M36 50 L48 54 L60 50 M54 66 L38 74 L40 92 M54 66 L66 76 L64 92' }) + flecha('M80 40 L80 64')),
  prensa: par(
    piso() + `<rect x="20" y="58" width="34" height="18" rx="3" fill="none" stroke="${T}" stroke-width="3"/>` + barra(62, 36, 62, 56) + fig({ cx: 28, cy: 52, cuerpo: 'M34 56 L52 64 M52 64 L62 50 M52 64 L62 60' }),
    piso() + `<rect x="20" y="58" width="34" height="18" rx="3" fill="none" stroke="${T}" stroke-width="3"/>` + barra(78, 30, 78, 50) + fig({ cx: 28, cy: 52, cuerpo: 'M34 56 L52 64 M52 64 L76 38 M52 64 L76 48' }) + flecha('M64 24 L84 24')),
  rumano: par(
    piso() + barra(34, 60, 66, 60) + fig({ cx: 50, cy: 20, cuerpo: 'M50 26 L50 52 M50 32 L44 60 M50 32 L56 60 M50 52 L46 74 L46 92 M50 52 L54 74 L54 92' }),
    piso() + barra(34, 76, 66, 76) + fig({ cx: 36, cy: 34, cuerpo: 'M40 40 L58 50 M44 42 L46 76 M44 42 L54 76 M58 50 L58 72 L56 92 M58 50 L62 72 L62 92' }) + flecha('M80 44 L80 72')),
  hipthrust: par(
    piso() + `<rect x="14" y="48" width="22" height="6" fill="none" stroke="${G}" stroke-width="3"/>` + barra(52, 72, 52, 72) + fig({ cx: 24, cy: 42, cuerpo: 'M28 46 L46 70 M46 70 L62 78 L62 92 M46 70 L54 80' }) + `<circle cx="52" cy="70" r="5" fill="none" stroke="${A}" stroke-width="3"/>`,
    piso() + `<rect x="14" y="48" width="22" height="6" fill="none" stroke="${G}" stroke-width="3"/>` + fig({ cx: 24, cy: 42, cuerpo: 'M28 46 L50 54 M50 54 L64 74 L64 92 M50 54 L56 70' }) + `<circle cx="52" cy="52" r="5" fill="none" stroke="${A}" stroke-width="3"/>` + flecha('M74 72 L74 50')),
  zancada: par(
    piso() + fig({ cx: 50, cy: 20, cuerpo: 'M50 26 L50 56 M42 30 L50 34 M58 30 L50 34 M50 56 L46 76 L46 92 M50 56 L54 76 L54 92' }),
    piso() + fig({ cx: 46, cy: 20, cuerpo: 'M46 26 L46 54 M46 54 L66 70 L66 92 M46 54 L32 72 L40 90' }) + flecha('M78 40 L78 66')),
  banca: par(
    `<rect x="18" y="62" width="64" height="7" rx="3" fill="none" stroke="${G}" stroke-width="3"/>` + barra(34, 40, 66, 40) + fig({ cx: 24, cy: 58, cuerpo: 'M30 60 L70 60 M38 60 L40 42 M56 60 L58 42 M70 60 L76 74 M70 60 L80 70' }),
    `<rect x="18" y="62" width="64" height="7" rx="3" fill="none" stroke="${G}" stroke-width="3"/>` + barra(34, 24, 66, 24) + fig({ cx: 24, cy: 58, cuerpo: 'M30 60 L70 60 M38 60 L40 26 M56 60 L58 26 M70 60 L76 74 M70 60 L80 70' }) + flecha('M88 40 L88 24')),
  pressincl: par(
    `<path d="M18 74 L72 46 L72 74 Z" fill="none" stroke="${G}" stroke-width="3"/>` + fig({ cx: 62, cy: 36, cuerpo: 'M58 42 L28 66 M52 48 L54 60 M44 54 L46 66' }) + `<circle cx="54" cy="60" r="4" fill="${A}"/><circle cx="46" cy="66" r="4" fill="${A}"/>`,
    `<path d="M18 74 L72 46 L72 74 Z" fill="none" stroke="${G}" stroke-width="3"/>` + fig({ cx: 62, cy: 36, cuerpo: 'M58 42 L28 66 M52 48 L66 34 M44 54 L58 40' }) + `<circle cx="68" cy="32" r="4" fill="${A}"/><circle cx="60" cy="38" r="4" fill="${A}"/>` + flecha('M84 56 L84 34')),
  militar: par(
    piso() + barra(34, 38, 66, 38) + fig({ cx: 50, cy: 22, cuerpo: 'M50 28 L50 60 M40 38 L50 34 L60 38 M50 60 L45 76 L45 92 M50 60 L55 76 L55 92' }),
    piso() + barra(34, 14, 66, 14) + fig({ cx: 50, cy: 26, cuerpo: 'M50 32 L50 60 M42 32 L44 16 M58 32 L56 16 M50 60 L45 76 L45 92 M50 60 L55 76 L55 92' }) + flecha('M80 36 L80 16')),
  fondos: par(
    `<line x1="22" y1="34" x2="22" y2="86" stroke="${G}" stroke-width="3"/><line x1="78" y1="34" x2="78" y2="86" stroke="${G}" stroke-width="3"/><line x1="16" y1="34" x2="84" y2="34" stroke="${G}" stroke-width="3"/>` + fig({ cx: 50, cy: 28, cuerpo: 'M50 34 L50 62 M44 36 L26 34 M56 36 L74 34 M50 62 L44 78 M50 62 L56 78' }),
    `<line x1="22" y1="34" x2="22" y2="86" stroke="${G}" stroke-width="3"/><line x1="78" y1="34" x2="78" y2="86" stroke="${G}" stroke-width="3"/><line x1="16" y1="34" x2="84" y2="34" stroke="${G}" stroke-width="3"/>` + fig({ cx: 50, cy: 46, cuerpo: 'M50 52 L50 76 M42 50 L26 34 M58 50 L74 34 M50 76 L44 88 M50 76 L58 88' }) + flecha('M90 40 L90 60')),
  dominada: par(
    barra(20, 16, 80, 16) + fig({ cx: 50, cy: 46, cuerpo: 'M50 52 L50 76 M44 50 L38 18 M56 50 L62 18 M50 76 L45 90 M50 76 L55 90' }),
    barra(20, 16, 80, 16) + fig({ cx: 50, cy: 28, cuerpo: 'M50 34 L50 62 M44 34 L38 18 M56 34 L62 18 M50 62 L44 78 M50 62 L56 78' }) + flecha('M88 56 L88 34')),
  jalon: par(
    `<rect x="26" y="66" width="48" height="7" rx="3" fill="none" stroke="${G}" stroke-width="3"/>` + barra(30, 18, 70, 18) + fig({ cx: 50, cy: 42, cuerpo: 'M50 48 L50 64 M43 46 L36 20 M57 46 L64 20 M50 64 L40 74 M50 64 L60 74' }),
    `<rect x="26" y="66" width="48" height="7" rx="3" fill="none" stroke="${G}" stroke-width="3"/>` + barra(32, 42, 68, 42) + fig({ cx: 50, cy: 30, cuerpo: 'M50 36 L50 64 M44 40 L34 42 M56 40 L66 42 M50 64 L40 74 M50 64 L60 74' }) + flecha('M84 24 L84 44')),
  remo: par(
    piso() + barra(32, 78, 68, 78) + fig({ cx: 32, cy: 32, cuerpo: 'M36 36 L62 48 M44 40 L42 78 M44 40 L50 78 M62 48 L60 72 L58 92 M62 48 L68 72 L68 92' }),
    piso() + barra(32, 56, 68, 56) + fig({ cx: 32, cy: 32, cuerpo: 'M36 36 L62 48 M44 40 L40 56 M44 40 L48 56 M62 48 L60 72 L58 92 M62 48 L68 72 L68 92' }) + flecha('M80 76 L80 58')),
  remomanc: par(
    `<rect x="18" y="56" width="52" height="7" rx="3" fill="none" stroke="${G}" stroke-width="3"/>` + fig({ cx: 26, cy: 40, cuerpo: 'M30 44 L62 50 M38 46 L34 56 M50 48 L52 76' }) + `<circle cx="52" cy="78" r="5" fill="${A}"/>`,
    `<rect x="18" y="56" width="52" height="7" rx="3" fill="none" stroke="${G}" stroke-width="3"/>` + fig({ cx: 26, cy: 40, cuerpo: 'M30 44 L62 50 M38 46 L34 56 M50 48 L56 56' }) + `<circle cx="58" cy="56" r="5" fill="${A}"/>` + flecha('M74 76 L74 56')),
  facepull: par(
    `<line x1="86" y1="20" x2="86" y2="86" stroke="${G}" stroke-width="3"/>` + fig({ cx: 34, cy: 34, cuerpo: 'M34 40 L34 68 M34 44 L62 38 M34 44 L62 44 M34 68 L28 84 M34 68 L40 84' }) + barra(62, 38, 84, 34),
    `<line x1="86" y1="20" x2="86" y2="86" stroke="${G}" stroke-width="3"/>` + fig({ cx: 34, cy: 34, cuerpo: 'M34 40 L34 68 M34 44 L22 26 M34 44 L46 26 M34 68 L28 84 M34 68 L40 84' }) + barra(22, 26, 84, 34) + flecha('M60 60 L36 54')),
  plancha: par(
    piso() + fig({ cx: 22, cy: 52, cuerpo: 'M28 56 L74 74 M34 58 L32 76 M74 74 L80 88' }),
    piso() + fig({ cx: 20, cy: 58, cuerpo: 'M26 60 L76 80 M32 62 L30 80 M76 80 L82 90' }) + `<text x="50" y="40" text-anchor="middle" font-size="9" fill="${A}">linea recta</text>`),
  pallof: par(
    `<line x1="88" y1="18" x2="88" y2="88" stroke="${G}" stroke-width="3"/>` + fig({ cx: 34, cy: 30, cuerpo: 'M34 36 L34 64 M34 42 L52 46 M34 64 L28 86 M34 64 L42 86' }) + barra(52, 46, 86, 44),
    `<line x1="88" y1="18" x2="88" y2="88" stroke="${G}" stroke-width="3"/>` + fig({ cx: 34, cy: 30, cuerpo: 'M34 36 L34 64 M34 42 L62 44 M34 64 L28 86 M34 64 L42 86' }) + barra(62, 44, 86, 44) + flecha('M46 62 L64 62')),
  caminata: par(
    piso() + fig({ cx: 44, cy: 22, cuerpo: 'M44 28 L44 56 M44 34 L34 46 M44 34 L56 44 M44 56 L36 76 L34 92 M44 56 L54 74 L58 92' }),
    piso() + fig({ cx: 56, cy: 22, cuerpo: 'M56 28 L56 56 M56 34 L66 46 M56 34 L46 44 M56 56 L48 74 L44 92 M56 56 L66 76 L70 92' }) + flecha('M20 20 L40 20'),
    'Paso', 'Siguiente paso'),
  pasos: par(
    piso() + fig({ cx: 36, cy: 24, cuerpo: 'M36 30 L36 58 M36 36 L28 48 M36 36 L46 46 M36 58 L30 76 L28 92 M36 58 L44 76 L48 92' }),
    piso() + fig({ cx: 64, cy: 24, cuerpo: 'M64 30 L64 58 M64 36 L56 48 M64 36 L74 46 M64 58 L58 76 L56 92 M64 58 L72 76 L76 92' }) + flecha('M24 18 L76 18'),
    'Durante el dia', 'Acumula'),
};

export function esquemaEjercicio(clave) {
  return ESQUEMAS[clave] || '';
}
