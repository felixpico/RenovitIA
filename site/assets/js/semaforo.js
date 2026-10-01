// Semáforo funcional: verde / amarillo / rojo según los rangos de biomarker_ranges.
//   verde    = dentro de optimal_low..optimal_high
//   amarillo = fuera del óptimo pero dentro del límite funcional
//   rojo     = fuera de reference_low..reference_high (el "límite")
// Un rango sin aprobación médica se muestra marcado como pendiente y nunca dispara alerta.

export const COLORES = {
  verde: ['verde', 'En óptimo'],
  amarillo: ['amarillo', 'En el límite'],
  rojo: ['rojo', 'Fuera de límite'],
};

export const EVIDENCIA = {
  A: 'Desenlaces clínicos',
  B: 'Asociación consistente',
  C: 'Convención de consenso',
};

const num = (x) => (x === null || x === undefined || x === '' ? null : Number(x));
const dentro = (v, lo, hi) => (lo === null || v >= lo) && (hi === null || v <= hi);

/* Elige el rango que aplica a este paciente (sexo y edad) */
export function rangoDe(rangos, biomarkerId, sexo, edad) {
  const cand = (rangos || []).filter((r) => r.biomarker_id === biomarkerId
    && (r.sex === null || r.sex === sexo)
    && (r.age_min === null || (edad !== null && edad >= r.age_min))
    && (r.age_max === null || (edad !== null && edad <= r.age_max)));
  if (!cand.length) return null;
  // El más específico gana: primero por sexo, luego por edad
  cand.sort((a, b) => (Number(b.sex !== null) - Number(a.sex !== null))
    || (Number(b.age_min !== null) - Number(a.age_min !== null)));
  return cand[0];
}

/* Devuelve { color, etiqueta, direccion, rango } o null si no hay con qué comparar */
export function evaluar(valor, rango) {
  const v = num(valor);
  if (v === null || Number.isNaN(v) || !rango) return null;
  const oL = num(rango.optimal_low);
  const oH = num(rango.optimal_high);
  const lL = num(rango.reference_low);
  const lH = num(rango.reference_high);

  let color;
  if (lL !== null || lH !== null) {
    if (!dentro(v, lL, lH)) color = 'rojo';
  }
  if (!color) {
    if (oL === null && oH === null) return null;
    color = dentro(v, oL, oH) ? 'verde' : 'amarillo';
  }
  const bajo = (lL !== null && v < lL) || (color !== 'verde' && oL !== null && v < oL);
  return {
    color,
    etiqueta: COLORES[color][1],
    direccion: color === 'verde' ? null : (bajo ? 'bajo' : 'alto'),
    rango,
    pendiente: !rango.approved_by,
    enPrueba: !rango.approved_by && !!rango.pilot_enabled,
  };
}

export const textoRango = (lo, hi, unidad = '') => {
  const u = unidad ? ` ${unidad}` : '';
  if (lo != null && hi != null) return `${lo} – ${hi}${u}`;
  if (hi != null) return `< ${hi}${u}`;
  if (lo != null) return `> ${lo}${u}`;
  return '—';
};

/* ===== Marcadores derivados que ningún laboratorio reporta ===== */
const ln = Math.log;

export function derivados(porCodigo, { edad } = {}) {
  const g = (c) => {
    const r = porCodigo[c];
    const v = r && r.value_numeric != null ? Number(r.value_numeric) : null;
    return v === null || Number.isNaN(v) ? null : v;
  };
  const fecha = (c) => porCodigo[c]?.collected_at || null;
  const out = [];
  const agregar = (code, valor, fuentes, nota) => {
    if (valor === null || !Number.isFinite(valor)) return;
    out.push({
      code,
      value_numeric: Math.round(valor * 100) / 100,
      collected_at: fuentes.map(fecha).find(Boolean) || null,
      derivado: true,
      nota,
    });
  };

  const tc = g('TC'); const hdl = g('HDL'); const ldl = g('LDL'); const tg = g('TG');
  const glu = g('GLU'); const ins = g('INS');
  const fe = g('IRON'); const tibc = g('TIBC');
  const ast = g('AST'); const alt = g('ALT'); const plt = g('PLT');
  const wbc = g('WBC'); const neuPct = g('NEUT_PCT'); const linPct = g('LYMPH_PCT');
  const neu = wbc !== null && neuPct !== null ? (wbc * neuPct) / 100 : null;
  const lin = wbc !== null && linPct !== null ? (wbc * linPct) / 100 : null;

  if (tc !== null && hdl !== null) agregar('NONHDL', tc - hdl, ['TC', 'HDL']);
  if (tc !== null && hdl !== null && ldl !== null) {
    agregar('REMNANT', tc - hdl - ldl, ['TC', 'HDL', 'LDL'],
      tg !== null && tg > 200 ? 'Con triglicéridos > 200 el LDL calculado no es confiable: pedir ApoB.' : null);
  }
  if (tg !== null && hdl) agregar('TG_HDL', tg / hdl, ['TG', 'HDL']);
  if (tg !== null && glu !== null && tg > 0 && glu > 0) agregar('TYG', ln((tg * glu) / 2), ['TG', 'GLU']);
  if (ins !== null && glu !== null) agregar('HOMA_IR', (ins * glu) / 405, ['INS', 'GLU']);
  if (fe !== null && tibc) agregar('TSAT', (fe / tibc) * 100, ['IRON', 'TIBC']);
  if (edad && ast !== null && alt && plt) agregar('FIB4', (edad * ast) / (plt * Math.sqrt(alt)), ['AST', 'ALT', 'PLT']);
  if (neu !== null && lin) agregar('NLR', neu / lin, ['WBC', 'NEUT_PCT', 'LYMPH_PCT']);
  return out;
}

export function edadDe(birthDate) {
  if (!birthDate) return null;
  const n = new Date(birthDate);
  if (Number.isNaN(n.getTime())) return null;
  const hoy = new Date();
  let e = hoy.getFullYear() - n.getFullYear();
  const m = hoy.getMonth() - n.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < n.getDate())) e -= 1;
  return e >= 0 && e < 130 ? e : null;
}
