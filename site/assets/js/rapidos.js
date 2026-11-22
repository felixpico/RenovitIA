// "Lo que más comes" y "Tus combinaciones".
//
// Por qué existe: hasta ahora food_log no guardaba QUÉ alimento se comió —no
// había item_id y el payload nunca lo traía—, así que una comida registrada era
// un callejón sin salida. Ya se guarda, y con eso lo de siempre se puede
// repetir de un toque en vez de volver a buscarlo.
//
// Los registros viejos no tienen item_id, así que el servidor también agrupa
// por nombre. Esos se pueden repetir, pero no sirven de ingrediente de una
// combinación: sin code no hay con qué calcular macros.
import { supabase } from './supabase.js';

const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const n1 = (x) => (x === null || x === undefined ? '—' : (Math.round(Number(x) * 10) / 10).toLocaleString('es-MX'));

export function cajaRapidos() {
  return '<div id="rap" class="rap"></div>';
}

const chip = (r, i) => `
  <button class="rap-it" type="button" data-i="${i}" ${r.code ? `data-code="${esc(r.code)}"` : ''}>
    <b>${esc(r.nombre)}</b>
    <span>${n1(r.protein_g)} g prot${r.veces > 1 ? ` · ${r.veces} veces` : ''}</span>
  </button>`;

const chipKit = (k, i) => {
  const m = k.macros || {};
  return `<button class="rap-it rap-kit" type="button" data-kit="${i}">
    <b>${esc(k.nombre)}</b>
    <span>${n1(m.proteina_g)} g prot · ${(k.componentes || []).length} cosas</span>
  </button>`;
};

/* alElegir(r)   → abre el panel normal del catálogo (base o platillo)
   alRepetir(r)  → vuelve a registrar tal cual algo sin catálogo
   recargar()    → refresca la pantalla de alimentación                      */
export async function montarRapidos(p, { alElegir, alRepetir, recargar }) {
  const caja = document.getElementById('rap');
  if (!caja) return;

  const [rec, kits] = await Promise.all([
    supabase.rpc('alimentos_recientes', { p_patient: p.id, p_limite: 10 })
      .then((r) => r.data || [], () => []),
    supabase.rpc('mis_combinaciones', { p_patient: p.id })
      .then((r) => r.data || [], () => []),
  ]);

  if (!rec.length && !kits.length) { caja.innerHTML = ''; return; }

  let armando = false;
  const elegidos = new Set();

  const pintar = () => {
    // Para armar una combinación solo sirven los que vienen del catálogo: de los
    // escritos a mano no se puede sacar el gramaje.
    const armables = rec.filter((r) => r.code);
    caja.innerHTML = `
      ${kits.length ? `<div class="rap-g"><h3>Tus combinaciones</h3>
        <div class="rap-fila">${kits.map(chipKit).join('')}</div></div>` : ''}
      ${rec.length ? `<div class="rap-g">
        <h3>Lo que más comes${armando ? ' · elige 2 o más' : ''}</h3>
        <div class="rap-fila">${rec.map((r, i) =>
          (armando && !r.code) ? '' : chip(r, i)).join('')}</div>
        ${armables.length >= 2 ? `<button class="btn-link rap-armar" type="button">
          ${armando ? 'Cancelar' : 'Armar una combinación con esto'}</button>` : ''}
        ${armando ? `<div class="rap-armado">
          <input id="rap-nom" class="input" type="text" placeholder="Licuado de la mañana">
          <button class="btn btn-primary btn-block" type="button" id="rap-guardar"
            ${elegidos.size < 2 ? 'disabled' : ''}>Guardar combinación (${elegidos.size})</button>
          <div id="rap-msg"></div></div>` : ''}
      </div>` : ''}`;

    caja.querySelectorAll('.rap-it[data-i]').forEach((b) => {
      const i = Number(b.dataset.i);
      if (armando && elegidos.has(i)) b.classList.add('on');
      b.addEventListener('click', () => {
        const r = rec[i];
        if (armando) {
          if (elegidos.has(i)) elegidos.delete(i); else elegidos.add(i);
          pintar();
          return;
        }
        if (r.code) alElegir(r.code); else alRepetir(r);
      });
    });

    caja.querySelectorAll('.rap-kit').forEach((b) => {
      b.addEventListener('click', () => alElegir(kits[Number(b.dataset.kit)].code));
    });

    caja.querySelector('.rap-armar')?.addEventListener('click', () => {
      armando = !armando;
      elegidos.clear();
      pintar();
    });

    caja.querySelector('#rap-guardar')?.addEventListener('click', async (ev) => {
      const nombre = (document.getElementById('rap-nom')?.value || '').trim();
      const msg = document.getElementById('rap-msg');
      if (!nombre) { msg.innerHTML = '<div class="notice warn small">Ponle nombre.</div>'; return; }
      ev.currentTarget.disabled = true;
      msg.innerHTML = '<div class="notice small">Guardando…</div>';

      const codes = [...elegidos].map((i) => rec[i].code);
      // Los componentes van en gramos. La porción casera de cada alimento vive
      // en medida_g, así que hay que traerla: sin eso el kit saldría con los
      // macros de 100 g de cada cosa, que no es lo que se comió.
      const { data: items } = await supabase.from('food_items')
        .select('code,medida_g').in('code', codes);
      const gramos = new Map((items || []).map((x) => [x.code, Number(x.medida_g) || 100]));
      const componentes = [...elegidos].map((i) => ({
        code: rec[i].code,
        g: Math.round((Number(rec[i].cantidad) || 1) * (gramos.get(rec[i].code) || 100)),
      }));

      const { error } = await supabase.rpc('guardar_combinacion', {
        p_patient: p.id, p_nombre: nombre, p_componentes: componentes, p_medida: '1 porción',
      });
      if (error) {
        console.error(error);
        msg.innerHTML = `<div class="notice danger small">No se pudo guardar: ${esc(error.message)}</div>`;
        ev.currentTarget.disabled = false;
        return;
      }
      armando = false; elegidos.clear();
      recargar();
    });
  };

  pintar();
}
