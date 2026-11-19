// Buscador del catálogo de alimentos.
//
// Dos clases de resultado, con pantallas distintas a propósito:
//   base     -> macros por 100 g de fuente citable. Se pide cuánto, en medida
//               casera, porque nadie pesa su comida.
//   platillo -> no tiene macros propios. Se arma con sus ingredientes y el
//               paciente los ajusta. El total se deriva, no se inventa.
import { supabase } from './supabase.js';

const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const n0 = (x) => (x === null || x === undefined ? '—' : Math.round(Number(x)).toLocaleString('es-MX'));
const n1 = (x) => (x === null || x === undefined ? '—' : (Math.round(Number(x) * 10) / 10).toLocaleString('es-MX'));
const nz = (x) => Number(x || 0);

const ICONO = {
  proteina: '🥩', cereal: '🌽', leguminosa: '🫘', tuberculo: '🥔', verdura: '🥦',
  fruta: '🍎', grasa: '🥑', bebida: '🥤', preparado: '🍲', otro: '🍬',
};

export function cajaBuscador() {
  return `<div class="busca">
    <input type="search" id="bu-q" class="bu-in" placeholder="Busca: pollo, tacos, cerveza…"
      autocomplete="off" enterkeyhint="search">
    <div id="bu-res" class="bu-res"></div>
    <div id="bu-sel"></div>
    <button class="btn-link bu-mano" type="button" id="bu-mano">No lo encuentro, lo escribo a mano</button>
  </div>`;
}

const fila = (r) => `<button class="bu-it" type="button" data-code="${esc(r.code)}">
  <span class="bi">${ICONO[r.grupo] || '🍽️'}</span>
  <span class="bn"><b>${esc(r.nombre)}</b>
    <span>${r.tipo === 'platillo' ? 'se arma con ingredientes'
      : `${n1(r.protein_g)} g prot · ${n0(r.kcal)} kcal por 100 g`}</span></span>
  ${r.fuente === 'estimado' ? '<span class="bu-est" title="Valor estimado">~</span>' : ''}
</button>`;

export function montarBuscador(alElegir) {
  const q = document.getElementById('bu-q');
  const res = document.getElementById('bu-res');
  const sel = document.getElementById('bu-sel');
  if (!q) return;
  let t = null;
  let ultima = 0;

  const buscar = async () => {
    const texto = q.value.trim();
    if (texto.length < 2) { res.innerHTML = ''; return; }
    const mio = ++ultima;
    const { data, error } = await supabase.rpc('buscar_alimento', { q: texto, p_limite: 12 });
    // Si el paciente siguió tecleando, esta respuesta ya no sirve: llegar
    // tarde y pisar la lista buena es peor que no contestar.
    if (mio !== ultima) return;
    if (error) { res.innerHTML = '<p class="bu-nada">No se pudo buscar. Intenta de nuevo.</p>'; return; }
    if (!data?.length) {
      res.innerHTML = '<p class="bu-nada">Nada con ese nombre. Escríbelo a mano aquí abajo.</p>';
      return;
    }
    res.innerHTML = data.map(fila).join('');
    res.querySelectorAll('.bu-it').forEach((b) => {
      b.addEventListener('click', () => {
        const r = data.find((x) => x.code === b.dataset.code);
        res.innerHTML = '';
        q.value = '';
        sel.innerHTML = '';
        alElegir(r);
      });
    });
  };

  q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(buscar, 250); });
  q.addEventListener('search', buscar);
  q.focus();
}

/* ---------- alimento base: cuánto comiste ---------- */
export function panelBase(r) {
  const tieneMedida = r.medida && nz(r.medida_g) > 0;
  return `<div class="confirma">
    <b>${esc(r.nombre)}</b>
    ${r.fuente === 'estimado'
      ? '<p>Estos valores son una estimación, no vienen de una tabla oficial. Corrígelos si tienes la etiqueta.</p>'
      : `<p>Valores de ${esc(r.fuente)}. Dinos cuánto comiste.</p>`}
    <div class="cuanto">
      <input id="ba-cant" type="number" inputmode="decimal" step="0.25" min="0" value="1">
      <select id="ba-uni">
        ${tieneMedida ? `<option value="medida" selected>${esc(r.medida)} (${n0(r.medida_g)} g)</option>` : ''}
        <option value="g"${tieneMedida ? '' : ' selected'}>gramos</option>
      </select>
    </div>
    <div class="cm-tot" id="ba-tot"></div>
    <label class="cmf ancho"><span>CUÁNDO</span><select id="cm-franja"></select></label>
    <button class="btn btn-primary btn-block" type="button" id="ba-ok" style="margin-top:12px">Guardar</button>
  </div>`;
}

export function montarBase(r, alGuardar) {
  const cant = document.getElementById('ba-cant');
  const uni = document.getElementById('ba-uni');
  const tot = document.getElementById('ba-tot');
  const calcular = () => {
    const x = Number(cant.value || 0);
    const g = uni.value === 'medida' ? x * nz(r.medida_g) : x;
    const f = g / 100;
    const m = {
      gramos: g, kcal: nz(r.kcal) * f, protein_g: nz(r.protein_g) * f,
      carb_g: nz(r.carb_g) * f, fat_g: nz(r.fat_g) * f, fiber_g: nz(r.fiber_g) * f,
    };
    tot.innerHTML = `<b>${n1(m.protein_g)} g de proteína</b> · ${n0(m.kcal)} kcal
      · ${n1(m.carb_g)} g carbos · ${n1(m.fat_g)} g grasa <span>(${n0(g)} g)</span>`;
    return m;
  };
  cant.addEventListener('input', calcular);
  uni.addEventListener('change', calcular);
  calcular();

  document.getElementById('ba-ok')?.addEventListener('click', (ev) => {
    const m = calcular();
    if (!(m.gramos > 0)) return;
    const x = Number(cant.value || 0);
    const etiqueta = uni.value === 'medida' ? `${x} ${r.medida}` : `${n0(m.gramos)} g`;
    alGuardar(ev.currentTarget, {
      descripcion: `${r.nombre} — ${etiqueta}`,
      kcal: m.kcal, protein_g: m.protein_g, carb_g: m.carb_g, fat_g: m.fat_g, fiber_g: m.fiber_g,
      cantidad: m.gramos, unidad: 'g',
    }, r.code);
  });
}

/* ---------- platillo: se arma con sus ingredientes ---------- */
export function panelPlatillo(r, base) {
  const comp = r.componentes || [];
  // Pedir gramos por ingrediente es mucha friccion: la gente sabe que se comio
  // "5 tacos", no "140 g de tortilla". El multiplicador escala todo de un golpe,
  // y quien quiera afinar un ingrediente sigue pudiendo.
  return `<div class="confirma">
    <b>${esc(r.nombre)}</b>
    <p>Este platillo no tiene un número fijo: cambia mucho según quién lo prepare.
      Ajusta lo que de verdad te comiste.</p>
    <div class="porciones">
      <span>¿Cuánto comiste?</span>
      <div class="pmas"><button type="button" id="pl-menos">−</button>
        <b id="pl-x">1</b><button type="button" id="pl-mas">+</button></div>
      <u>× ${esc(r.medida || 'porción')}</u>
    </div>
    <details class="afinar"><summary>Afinar los ingredientes</summary>
    <div class="ingr-lista">
      ${comp.map((c, i) => {
        const b = base[c.code];
        return `<div class="ing"><span>${esc(b?.nombre || c.code)}</span>
          <input type="number" inputmode="decimal" step="5" min="0"
            data-i="${i}" data-code="${esc(c.code)}" value="${c.g}"><u>g</u></div>`;
      }).join('')}
    </div></details>
    <div class="cm-tot" id="pl-tot"></div>
    <label class="cmf ancho"><span>CUÁNDO</span><select id="cm-franja"></select></label>
    <button class="btn btn-primary btn-block" type="button" id="pl-ok" style="margin-top:12px">Guardar</button>
  </div>`;
}

export function montarPlatillo(r, base, alGuardar) {
  const tot = document.getElementById('pl-tot');
  const entradas = Array.from(document.querySelectorAll('.ing input'));
  const original = entradas.map((i) => Number(i.value || 0));
  const elX = document.getElementById('pl-x');
  let veces = 1;

  const aplicar = (n) => {
    veces = Math.max(0.5, Math.min(10, n));
    elX.textContent = veces % 1 === 0 ? String(veces) : veces.toFixed(1);
    entradas.forEach((i, k) => { i.value = Math.round(original[k] * veces); });
    calcular();
  };
  document.getElementById('pl-menos')?.addEventListener('click', () => aplicar(veces - 0.5));
  document.getElementById('pl-mas')?.addEventListener('click', () => aplicar(veces + 0.5));

  const calcular = () => {
    const m = { kcal: 0, protein_g: 0, carb_g: 0, fat_g: 0, fiber_g: 0, gramos: 0 };
    entradas.forEach((i) => {
      const b = base[i.dataset.code];
      if (!b) return;
      const f = Number(i.value || 0) / 100;
      m.kcal += nz(b.kcal) * f; m.protein_g += nz(b.protein_g) * f;
      m.carb_g += nz(b.carb_g) * f; m.fat_g += nz(b.fat_g) * f; m.fiber_g += nz(b.fiber_g) * f;
      m.gramos += Number(i.value || 0);
    });
    tot.innerHTML = `<b>${n1(m.protein_g)} g de proteína</b> · ${n0(m.kcal)} kcal
      · ${n1(m.carb_g)} g carbos · ${n1(m.fat_g)} g grasa`;
    return m;
  };
  entradas.forEach((i) => i.addEventListener('input', calcular));
  calcular();

  document.getElementById('pl-ok')?.addEventListener('click', (ev) => {
    const m = calcular();
    if (!(m.kcal > 0)) return;
    // Si comio el doble, el renglon tiene que decirlo: guardar "Tacos al
    // pastor (3)" cuando se comio 6 le miente al paciente y a su medica.
    alGuardar(ev.currentTarget, {
      descripcion: veces === 1 ? r.nombre : `${r.nombre} × ${veces}`,
      kcal: m.kcal, protein_g: m.protein_g, carb_g: m.carb_g, fat_g: m.fat_g, fiber_g: m.fiber_g,
      cantidad: m.gramos, unidad: 'g',
    }, r.code);
  });
}

// Los ingredientes de un platillo se traen de una sola vez, por código.
export async function traerBase(codes) {
  if (!codes.length) return {};
  const { data } = await supabase.from('food_items')
    .select('code,nombre,kcal,protein_g,carb_g,fat_g,fiber_g')
    .in('code', codes);
  return Object.fromEntries((data || []).map((x) => [x.code, x]));
}
