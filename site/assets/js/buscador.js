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
export function panelPlatillo(r) {
  // Pedir gramos por ingrediente es mucha friccion: la gente sabe que se comio
  // "5 tacos", no "140 g de tortilla". El multiplicador escala todo de un golpe,
  // y quien quiera afinar, quitar o agregar un ingrediente sigue pudiendo.
  //
  // La lista NO se dibuja aqui: la dibuja montarPlatillo desde su estado, para
  // que agregar y quitar usen el mismo camino que el dibujado inicial.
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
      <div class="ingr-lista" id="pl-ingr"></div>
      <div class="ing-add">
        <input type="search" id="pl-buscar" autocomplete="off"
               placeholder="Agregar un ingrediente…">
        <div class="ing-res hidden" id="pl-res"></div>
      </div>
    </details>
    <div class="cm-tot" id="pl-tot"></div>
    <label class="cmf ancho"><span>CUÁNDO</span><select id="cm-franja"></select></label>
    <p class="bu-nada hidden" id="pl-aviso">Pon al menos un ingrediente con gramos.</p>
    <button class="btn btn-primary btn-block" type="button" id="pl-ok" style="margin-top:12px">Guardar</button>
  </div>`;
}

export function montarPlatillo(r, base, alGuardar) {
  const tot = document.getElementById('pl-tot');
  const lista = document.getElementById('pl-ingr');
  const elX = document.getElementById('pl-x');
  const aviso = document.getElementById('pl-aviso');
  let veces = 1;

  // El estado son los gramos POR PORCION, no los que se ven en pantalla. Esa es
  // la correccion de fondo: antes se guardaba una copia de los gramos iniciales
  // y el boton de porcion reescribia todos los campos desde ella, asi que lo que
  // el paciente tecleaba se borraba en cuanto tocaba la porcion. Y un ingrediente
  // que venia sin gramos tenia cero de origen: se quedaba en cero para siempre.
  const items = (r.componentes || []).map((c) => ({
    code: c.code,
    nombre: base[c.code]?.nombre || c.code,
    por: Number(c.g) || 0,
  }));

  const gramos = (it) => {
    const g = it.por * veces;
    return g >= 10 ? Math.round(g) : Math.round(g * 10) / 10;
  };

  const pintar = () => {
    lista.innerHTML = items.map((it, i) => `<div class="ing">
      <span>${esc(it.nombre)}</span>
      <input type="number" inputmode="decimal" step="5" min="0"
        data-i="${i}" value="${it.por ? gramos(it) : ''}"><u>g</u>
      <button type="button" class="ing-x" data-quitar="${i}"
        aria-label="Quitar ${esc(it.nombre)}">×</button>
    </div>`).join('')
      || '<p class="bu-nada">Este platillo se quedó sin ingredientes. Agrega uno abajo.</p>';
  };

  const calcular = () => {
    const m = { kcal: 0, protein_g: 0, carb_g: 0, fat_g: 0, fiber_g: 0, gramos: 0 };
    items.forEach((it) => {
      const b = base[it.code];
      if (!b) return;
      const g = it.por * veces;
      const f = g / 100;
      m.kcal += nz(b.kcal) * f; m.protein_g += nz(b.protein_g) * f;
      m.carb_g += nz(b.carb_g) * f; m.fat_g += nz(b.fat_g) * f; m.fiber_g += nz(b.fiber_g) * f;
      m.gramos += g;
    });
    tot.innerHTML = `<b>${n1(m.protein_g)} g de proteína</b> · ${n0(m.kcal)} kcal
      · ${n1(m.carb_g)} g carbos · ${n1(m.fat_g)} g grasa`;
    aviso.classList.toggle('hidden', m.kcal > 0);
    return m;
  };

  const aplicar = (n) => {
    veces = Math.max(0.5, Math.min(10, n));
    elX.textContent = veces % 1 === 0 ? String(veces) : veces.toFixed(1);
    pintar();
    calcular();
  };
  document.getElementById('pl-menos')?.addEventListener('click', () => aplicar(veces - 0.5));
  document.getElementById('pl-mas')?.addEventListener('click', () => aplicar(veces + 0.5));

  // Delegacion: la lista se vuelve a dibujar al agregar, quitar y cambiar la
  // porcion, asi que enganchar cada campo por separado dejaria renglones muertos.
  lista.addEventListener('input', (e) => {
    const campo = e.target.closest('input[data-i]');
    if (!campo) return;
    // Se guarda lo tecleado DIVIDIDO entre la porcion, para que al subirla o
    // bajarla se escale desde lo que el paciente puso, no desde lo original.
    items[Number(campo.dataset.i)].por = (Number(campo.value) || 0) / veces;
    calcular();
  });
  lista.addEventListener('click', (e) => {
    const x = e.target.closest('[data-quitar]');
    if (!x) return;
    items.splice(Number(x.dataset.quitar), 1);
    pintar();
    calcular();
  });

  /* ---------- agregar un ingrediente ---------- */
  const campoB = document.getElementById('pl-buscar');
  const res = document.getElementById('pl-res');
  let ultima = 0;

  const cerrar = () => { res.classList.add('hidden'); res.innerHTML = ''; };

  campoB?.addEventListener('input', async () => {
    const texto = campoB.value.trim();
    if (texto.length < 2) return cerrar();
    const mio = ++ultima;
    const { data, error } = await supabase.rpc('buscar_alimento', { q: texto, p_limite: 8 });
    // Si siguio tecleando, esta respuesta ya no sirve: pisar la lista buena con
    // una vieja es peor que no contestar.
    if (mio !== ultima) return;
    if (error || !data?.length) {
      // Sin salida es peor que sin resultado: si el alimento no esta en el
      // catalogo, el camino que SI existe es el codigo de barras, y hay que
      // decirlo aqui, no esperar a que el paciente lo adivine.
      res.innerHTML = error
        ? '<p class="bu-nada">No se pudo buscar. Intenta de nuevo.</p>'
        : '<p class="bu-nada">Nada con ese nombre. Si viene en paquete, ciérrale aquí y escanea su código de barras desde «Agregar comida»: el producto se queda guardado para la próxima.</p>';
      res.classList.remove('hidden');
      return;
    }
    res.innerHTML = data.map((x) => `<button type="button" class="ing-op"
      data-code="${esc(x.code)}">${esc(x.nombre)}</button>`).join('');
    res.classList.remove('hidden');
    res.querySelectorAll('.ing-op').forEach((b) => {
      b.addEventListener('click', () => {
        const x = data.find((y) => y.code === b.dataset.code);
        if (!x) return;
        if (items.some((it) => it.code === x.code)) { cerrar(); campoB.value = ''; return; }
        base[x.code] = x;
        // Entra en cero: el paciente dice cuantos gramos, no lo adivinamos.
        items.push({ code: x.code, nombre: x.nombre, por: 0 });
        campoB.value = '';
        cerrar();
        pintar();
        calcular();
        lista.querySelector(`input[data-i="${items.length - 1}"]`)?.focus();
      });
    });
  });

  pintar();
  calcular();

  document.getElementById('pl-ok')?.addEventListener('click', (ev) => {
    const m = calcular();
    if (!(m.kcal > 0)) { aviso.classList.remove('hidden'); return; }
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
