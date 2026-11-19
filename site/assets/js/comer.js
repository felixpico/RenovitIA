// Registro de comidas del día.
//
// Tres caminos, y la pantalla NO los trata igual, porque no valen igual:
//   etiqueta -> transcrito del empaque. Exacto.
//   plato    -> estimado por IA. 20 a 35 % de error en calorias segun la
//               validacion publicada, asi que se marca como estimacion y se
//               queda marcado, tambien en la pantalla de la medica.
//   manual   -> lo que el paciente teclea.
// Nada se guarda sin que el paciente confirme los numeros.
import { supabase } from './supabase.js';
import {
  cajaBuscador, montarBuscador, panelBase, montarBase,
  panelPlatillo, montarPlatillo, traerBase,
} from './buscador.js';

const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const n0 = (x) => (x === null || x === undefined ? '—' : Math.round(Number(x)).toLocaleString('es-MX'));
const nz = (x) => Number(x || 0);

export const FRANJAS = [['desayuno', 'Desayuno'], ['comida', 'Comida'], ['cena', 'Cena'], ['snack', 'Snack']];
const franjaAhora = () => {
  const h = new Date().getHours();
  if (h < 11) return 'desayuno';
  if (h < 17) return 'comida';
  if (h < 22) return 'cena';
  return 'snack';
};
const ORIGEN = {
  etiqueta: ['🏷️', 'etiqueta'], foto: ['📷', 'estimado'],
  manual: ['✍️', 'a mano'], plan: ['📋', 'del plan'],
};

// Anillo de proteína. Es el único número grande: es la palanca del plan y
// un solo número se sostiene mucho mejor que cuatro.
function anillo(hecho, meta) {
  const pct = meta > 0 ? Math.min(150, Math.round((hecho / meta) * 100)) : 0;
  const r = 52; const C = 2 * Math.PI * r;
  const lleno = Math.min(1, pct / 100) * C;
  const sobra = pct > 110;
  return `<svg viewBox="0 0 128 128" class="anp" role="img"
      aria-label="${hecho} de ${meta} gramos de proteína">
    <circle cx="64" cy="64" r="${r}" class="apb"/>
    <circle cx="64" cy="64" r="${r}" class="apf ${sobra ? 'sobra' : ''}"
      stroke-dasharray="${lleno} ${C - lleno}" transform="rotate(-90 64 64)"/>
    <text x="64" y="58" class="apn">${n0(hecho)}</text>
    <text x="64" y="78" class="apu">de ${n0(meta)} g</text>
    <text x="64" y="96" class="apl">PROTEÍNA</text>
  </svg>`;
}

// Si al paciente se le ocultan las calorias, el formulario tampoco se las puede
// pedir: pedirle que teclee un numero que no debe ver anula la proteccion.
let verKcalGlobal = true;

export function panelHoy(d) {
  const meta = d.meta || {};
  const hoy = d.hoy || {};
  const verKcal = d.mostrar_kcal !== false;
  verKcalGlobal = verKcal;
  const mini = (nombre, hecho, obj, clase) => {
    const pct = obj > 0 ? Math.min(100, Math.round((nz(hecho) / obj) * 100)) : 0;
    return `<div class="mn2"><span>${nombre}</span>
      <b>${n0(hecho)}<small> / ${n0(obj)}</small></b>
      <i class="bm"><u class="${clase}" style="width:${pct}%"></u></i></div>`;
  };

  let h = `<div class="hoybox">
    <div class="hoyl">${anillo(nz(hoy.proteina_g), nz(meta.proteina_g))}</div>
    <div class="hoyr">
      ${verKcal ? mini('Calorías', hoy.kcal, meta.kcal, 'bK') : ''}
      ${mini('Carbos', hoy.carbohidrato_g, meta.carbohidrato_g, 'bC')}
      ${mini('Grasa', hoy.grasa_g, meta.grasa_g, 'bG')}
    </div></div>`;

  if (nz(hoy.n_estimados) > 0) {
    h += `<div class="nota-chica">${hoy.n_estimados === 1 ? 'Un registro de hoy es' : `${hoy.n_estimados} registros de hoy son`}
      una estimación por foto. El total del día carga ese margen de error.</div>`;
  }

  h += `<div class="comer-bot">
    <input type="file" id="cm-foto" accept="image/*" capture="environment" hidden>
    <button class="btn btn-primary cm-b" type="button" data-modo="etiqueta">🏷️ Etiqueta</button>
    <button class="btn btn-primary cm-b" type="button" data-modo="plato">📷 Mi plato</button>
    <button class="btn btn-ghost cm-b" type="button" data-modo="buscar">🔎 Buscar</button>
  </div>
  <div id="cm-estado"></div><div id="cm-form"></div>`;

  const r = d.renglones || [];
  if (r.length) {
    h += '<h2 class="s">Lo de hoy</h2><div class="lista">';
    r.forEach((x) => {
      const [ic, et] = ORIGEN[x.origen] || ORIGEN.manual;
      h += `<div class="lv cm-row"><div class="t">
        <b>${esc(x.descripcion)}</b>
        <span class="ds">${n0(x.proteina_g)}<small> g prot</small></span></div>
        <div class="m">${ic} ${et}${x.ajustado ? ' · ajustado por ti' : ''}
          ${verKcal && x.kcal ? ` · ${n0(x.kcal)} kcal` : ''}
          <button class="cm-del" type="button" data-id="${x.id}" aria-label="Borrar">×</button></div></div>`;
    });
    h += '</div>';
  } else {
    h += `<div class="vacio"><span class="vic">🍽️</span>
      Todavía no registras nada hoy. Empieza por la comida que más proteína te dé.</div>`;
  }

  // Semana: una barra por día, solo proteína. Da constancia sin pedir lectura.
  const sem = d.semana || [];
  if (sem.length > 1) {
    const objP = nz(meta.proteina_g) || 1;
    h += '<h2 class="s">Tus últimos días</h2><div class="sem7">';
    sem.forEach((s) => {
      const pct = Math.min(100, Math.round((nz(s.proteina_g) / objP) * 100));
      const f = new Date(`${s.dia}T12:00:00`);
      h += `<div class="d7"><div class="riel7"><i style="height:${Math.max(4, pct)}%"
        class="${pct >= 90 ? 'ok' : pct >= 60 ? 'med' : 'bajo'}"></i></div>
        <span>${['D', 'L', 'M', 'M', 'J', 'V', 'S'][f.getDay()]}</span>
        <u>${pct}%</u></div>`;
    });
    h += '</div><div class="nota-chica">Porcentaje de tu meta de proteína en cada día que registraste.</div>';
  }
  return h;
}

/* ---------- formulario de confirmación ---------- */
const campo = (id, et, v, paso) => `<label class="cmf"><span>${et}</span>
  <input id="${id}" type="number" inputmode="decimal" step="${paso || 1}" value="${v ?? ''}"></label>`;

function formulario(datos, origen, extra) {
  return `<div class="confirma">
    <b>${origen === 'manual' ? 'Escribe lo que comiste' : 'Confirma antes de guardar'}</b>
    ${extra ? `<p>${extra}</p>` : ''}
    <label class="cmf ancho"><span>QUÉ COMISTE</span>
      <input id="cm-desc" type="text" value="${esc(datos.descripcion || '')}" placeholder="Pollo con verduras"></label>
    <label class="cmf ancho"><span>CUÁNDO</span>
      <select id="cm-franja">${FRANJAS.map(([k, n]) =>
        `<option value="${k}"${k === franjaAhora() ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
    <div class="cmg">
      ${campo('cm-p', 'PROTEÍNA g', datos.proteina_g, 0.1)}
      ${verKcalGlobal ? campo('cm-k', 'CALORÍAS', datos.kcal, 1) : ''}
      ${campo('cm-c', 'CARBOS g', datos.carbohidrato_g, 0.1)}
      ${campo('cm-g', 'GRASA g', datos.grasa_g, 0.1)}
    </div>
    ${!verKcalGlobal && datos.kcal ? `<input type="hidden" id="cm-k" value="${Math.round(datos.kcal)}">` : ''}
    ${(datos.supuestos || []).length ? `<div class="sup"><b>Lo que tuvimos que suponer:</b><ul>
      ${datos.supuestos.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
      Si algo no cuadra, corrige los números de arriba.</div>` : ''}
    <button class="btn btn-primary btn-block" type="button" id="cm-guardar"
      style="margin-top:12px">Guardar</button>
  </div>`;
}

// Guardar lo que vino del catálogo. Se separa de la foto porque aquí los
// números no son una estimación: salen de una tabla, y el renglón queda
// marcado como 'manual', no como 'foto'.
async function elegido(p, r, recargar) {
  const caja = document.getElementById('cm-form');
  const llenarFranja = () => {
    const s = document.getElementById('cm-franja');
    if (!s) return;
    s.innerHTML = FRANJAS.map(([k, n]) =>
      `<option value="${k}"${k === franjaAhora() ? ' selected' : ''}>${n}</option>`).join('');
  };
  const alGuardar = async (boton, fila, code) => {
    await guardar(boton, {
      patient_id: p.id, origen: 'manual', ...fila,
    }, recargar);
    // El buscador aprende qué come esta clínica, sin que nadie lo configure.
    supabase.rpc('usar_alimento', { p_code: code }).then(() => {}, () => {});
  };

  if (r.tipo === 'platillo') {
    const codes = (r.componentes || []).map((c) => c.code);
    const base = await traerBase(codes);
    caja.innerHTML = panelPlatillo(r, base);
    llenarFranja();
    montarPlatillo(r, base, alGuardar);
    return;
  }
  caja.innerHTML = panelBase(r);
  llenarFranja();
  montarBase(r, alGuardar);
}

/* ---------- montaje ---------- */
export function montarComer(p, recargar) {
  const $ = (id) => document.getElementById(id);
  const estado = $('cm-estado');
  const aviso = (t, malo) => {
    estado.innerHTML = t
      ? `<div class="dato ${malo ? 'alerta' : ''}"><span class="dic">${malo ? '⚠️' : 'ℹ️'}</span><div>${t}</div></div>`
      : '';
  };
  let modoActual = 'plato';

  document.querySelectorAll('.cm-b').forEach((b) => {
    b.addEventListener('click', () => {
      modoActual = b.dataset.modo;
      if (modoActual === 'buscar') {
        aviso('');
        $('cm-form').innerHTML = cajaBuscador();
        montarBuscador((r) => elegido(p, r, recargar));
        document.getElementById('bu-mano')?.addEventListener('click', () => {
          $('cm-form').innerHTML = formulario({}, 'manual');
          enlazar(p, 'manual', {}, recargar);
          $('cm-desc')?.focus();
        });
        return;
      }
      $('cm-foto').click();
    });
  });

  $('cm-foto')?.addEventListener('change', async (ev) => {
    const f = ev.target.files?.[0];
    ev.target.value = '';
    if (!f) return;
    if (f.size > 12 * 1024 * 1024) { aviso('La foto pasa de 12 MB. Tómala con menos resolución.', true); return; }

    let ruta = null;
    try {
      aviso('Subiendo la foto…');
      ruta = `${p.id}/comida/${Date.now()}.jpg`;
      const up = await supabase.storage.from('patient-documents')
        .upload(ruta, f, { contentType: f.type || 'image/jpeg' });
      if (up.error) throw up.error;

      const { data: doc, error: eDoc } = await supabase.from('documents').insert({
        patient_id: p.id, kind: 'other', storage_path: ruta,
        original_filename: f.name || 'comida.jpg', mime_type: f.type || 'image/jpeg',
        extraction_status: 'pending',
      }).select('id').single();
      if (eDoc) { await supabase.storage.from('patient-documents').remove([ruta]).catch(() => {}); throw eDoc; }

      aviso(modoActual === 'etiqueta' ? 'Leyendo la etiqueta…' : 'Viendo tu plato…');
      const { data: r, error: eFn } = await supabase.functions
        .invoke('leer-alimento', { body: { document_id: doc.id, modo: modoActual } });
      if (eFn || r?.error) throw new Error(r?.error || eFn.message);

      if (!r.ok) {
        aviso(esc(r.aviso), true);
        $('cm-form').innerHTML = formulario({}, 'manual');
        enlazar(p, 'manual', { document_id: doc.id }, recargar);
        return;
      }

      aviso(esc(r.aviso), !!r.requiere_revision);
      const L = r.lectura;
      if (modoActual === 'etiqueta') {
        $('cm-form').innerHTML = formEtiqueta(L);
        enlazarEtiqueta(p, L, doc.id, recargar);
      } else {
        $('cm-form').innerHTML = formulario({
          descripcion: L.descripcion,
          kcal: L.total?.kcal, proteina_g: L.total?.proteina_g,
          carbohidrato_g: L.total?.carbohidrato_g, grasa_g: L.total?.grasa_g,
          supuestos: L.supuestos,
        }, 'foto');
        enlazar(p, 'foto', { document_id: doc.id, confianza: L.confianza, payload: L }, recargar);
      }
    } catch (e) {
      console.error(e);
      aviso('No pudimos leer la foto. Escríbelo a mano.', true);
      $('cm-form').innerHTML = formulario({}, 'manual');
      enlazar(p, 'manual', {}, recargar);
    }
  });

  document.querySelectorAll('.cm-del').forEach((b) => {
    b.addEventListener('click', async () => {
      b.disabled = true;
      const { error } = await supabase.from('food_log').delete().eq('id', b.dataset.id);
      if (error) { b.disabled = false; return; }
      recargar();
    });
  });
}

// La etiqueta trae los números por porción o por 100 g. Confundir una con otra
// multiplica o divide el día entero, así que la cantidad se pide aparte y se
// multiplica a la vista del paciente.
function formEtiqueta(L) {
  const porBase = L.base === 'porcion'
    ? (L.porcion_texto || 'una porción') : `100 ${L.base === '100ml' ? 'ml' : 'g'}`;
  return `<div class="confirma">
    <b>${esc(L.producto || 'Producto')}${L.marca ? ` · ${esc(L.marca)}` : ''}</b>
    <p>Estos números son por <b>${esc(porBase)}</b>. Dinos cuánto te comiste.</p>
    <div class="tabla-et">
      ${verKcalGlobal ? `<div><span>Calorías</span><b>${n0(L.kcal)}</b></div>` : ''}
      <div><span>Proteína</span><b>${n0(L.proteina_g)} g</b></div>
      <div><span>Carbos</span><b>${n0(L.carbohidrato_g)} g</b></div>
      <div><span>Grasa</span><b>${n0(L.grasa_g)} g</b></div>
    </div>
    ${nz(L.azucares_anadidos_g) > 0 ? `<div class="dato"><span class="dic">🍬</span><div>
      <b>${n0(L.azucares_anadidos_g)} g de azúcares añadidos</b> por ${esc(porBase)}.</div></div>` : ''}
    ${(L.sellos || []).length ? `<div class="sellos">${L.sellos.map((s) => `<i>${esc(s)}</i>`).join('')}</div>` : ''}
    <label class="cmf ancho"><span>¿CUÁNTO COMISTE?</span>
      <input id="cm-cant" type="number" inputmode="decimal" step="0.25" value="1"></label>
    <div class="cm-tot" id="cm-tot"></div>
    <label class="cmf ancho"><span>CUÁNDO</span>
      <select id="cm-franja">${FRANJAS.map(([k, n]) =>
        `<option value="${k}"${k === franjaAhora() ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
    ${(L.ingredientes || []).length ? `<details class="ingr"><summary>Ver los ${L.ingredientes.length} ingredientes</summary>
      <p>${L.ingredientes.map(esc).join(', ')}</p></details>` : ''}
    <button class="btn btn-primary btn-block" type="button" id="cm-guardar" style="margin-top:12px">Guardar</button>
  </div>`;
}

function enlazarEtiqueta(p, L, documentId, recargar) {
  const cant = document.getElementById('cm-cant');
  const tot = document.getElementById('cm-tot');
  const unidad = L.base === 'porcion' ? (L.porcion_texto || 'porciones') : `× 100 ${L.base === '100ml' ? 'ml' : 'g'}`;
  const calcular = () => {
    const x = Number(cant.value || 0);
    const m = {
      kcal: nz(L.kcal) * x, proteina_g: nz(L.proteina_g) * x,
      carbohidrato_g: nz(L.carbohidrato_g) * x, grasa_g: nz(L.grasa_g) * x,
      fibra_g: nz(L.fibra_g) * x,
    };
    tot.innerHTML = `<b>Se registra:</b> ${n0(m.proteina_g)} g de proteína${
      verKcalGlobal ? ` · ${n0(m.kcal)} kcal` : ''} · ${n0(m.carbohidrato_g)} g carbos · ${n0(m.grasa_g)} g grasa`;
    return m;
  };
  cant.addEventListener('input', calcular);
  calcular();

  document.getElementById('cm-guardar')?.addEventListener('click', async (ev) => {
    const m = calcular();
    const x = Number(cant.value || 0);
    if (!(x > 0)) return;
    await guardar(ev.currentTarget, {
      patient_id: p.id,
      // "Quest Bar (1 pieza (60 g))" se lee mal: si la unidad ya trae
      // parentesis, se usa un separador en vez de anidar.
      descripcion: x === 1 ? (L.producto || 'Producto')
        : `${L.producto || 'Producto'} — ${x} ${unidad}`,
      origen: 'etiqueta',
      kcal: m.kcal, protein_g: m.proteina_g, carb_g: m.carbohidrato_g,
      fat_g: m.grasa_g, fiber_g: m.fibra_g,
      cantidad: x, unidad,
      document_id: documentId, payload: L,
    }, recargar);
  });
}

function enlazar(p, origen, extra, recargar) {
  document.getElementById('cm-guardar')?.addEventListener('click', async (ev) => {
    const val = (id) => {
      const v = document.getElementById(id)?.value;
      return v === '' || v == null ? null : Number(v);
    };
    const desc = document.getElementById('cm-desc')?.value?.trim();
    const est = document.getElementById('cm-estado');
    if (!desc) {
      est.innerHTML = '<div class="dato alerta"><span class="dic">⚠️</span><div>Falta decir qué comiste.</div></div>';
      return;
    }
    const p_g = val('cm-p');
    if (p_g === null) {
      est.innerHTML = '<div class="dato alerta"><span class="dic">⚠️</span><div>Falta la proteína. Es el número que estamos siguiendo.</div></div>';
      return;
    }
    // Si el paciente movió lo que trajo la estimación, su número vale más que el nuestro.
    const ajustado = origen === 'foto' && extra.payload
      && Math.abs(p_g - nz(extra.payload.total?.proteina_g)) > 0.5;

    await guardar(ev.currentTarget, {
      patient_id: p.id, descripcion: desc, origen,
      kcal: val('cm-k'), protein_g: p_g, carb_g: val('cm-c'), fat_g: val('cm-g'),
      confianza: extra.confianza ?? null,
      ajustado_por_paciente: !!ajustado,
      document_id: extra.document_id || null,
      payload: extra.payload || null,
    }, recargar);
  });
}

async function guardar(boton, fila, recargar) {
  boton.disabled = true;
  const franja = document.getElementById('cm-franja')?.value || franjaAhora();
  const { error } = await supabase.from('food_log').insert({
    ...fila, franja, dia: new Date().toLocaleDateString('en-CA'),
  });
  if (error) {
    console.error(error);
    boton.disabled = false;
    document.getElementById('cm-estado').innerHTML =
      '<div class="dato alerta"><span class="dic">⚠️</span><div>No se pudo guardar. Intenta de nuevo.</div></div>';
    return;
  }
  recargar();
}
