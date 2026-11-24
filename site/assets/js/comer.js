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
import { cajaRapidos, montarRapidos } from './rapidos.js';

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
    <button class="btn btn-primary cm-b" type="button" data-modo="codigo">▦ Código</button>
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

// Trae un alimento por su code, con la misma forma que devuelve buscar_alimento,
// para que las pantallas de abajo no tengan que saber de dónde vino.
async function porCode(code) {
  const { data, error } = await supabase.from('food_items')
    .select('code,nombre,tipo,grupo,kcal,protein_g,carb_g,fat_g,fiber_g,medida,medida_g,fuente,componentes,verificado_por')
    .eq('code', code).eq('is_active', true).maybeSingle();
  if (error || !data) { console.error('porCode', error); return null; }
  return { ...data, verificado: data.verificado_por != null };
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
    // Se guarda CUÁL alimento fue, no solo su nombre. Sin este id, una comida
    // registrada es un callejón sin salida: se puede leer pero no repetir, que
    // es justo por lo que "lo que más comes" no existía.
    let item_id = null;
    try {
      const { data } = await supabase.from('food_items').select('id').eq('code', code).maybeSingle();
      item_id = data?.id ?? null;
    } catch (_) { /* si falla, se guarda la comida igual: el id es un extra */ }
    await guardar(boton, {
      patient_id: p.id, origen: 'manual', item_id, ...fila,
    }, recargar);
    // El buscador aprende qué come esta clínica, sin que nadie lo configure.
    supabase.rpc('usar_alimento', { p_code: code }).then(() => {}, () => {});
  };

  if (r.tipo === 'platillo') {
    const codes = (r.componentes || []).map((c) => c.code);
    const base = await traerBase(codes);
    caja.innerHTML = panelPlatillo(r);
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
      if (modoActual === 'codigo') {
        aviso('');
        $('cm-form').innerHTML = cajaCodigo();
        montarCodigo(p, recargar);
        return;
      }
      if (modoActual === 'buscar') {
        aviso('');
        // Lo de siempre va ARRIBA del buscador: la mayoría de las veces el
        // paciente viene a registrar algo que ya comió antes, y escribirlo de
        // nuevo era el trabajo que le estábamos cobrando.
        $('cm-form').innerHTML = cajaRapidos() + cajaBuscador();
        montarBuscador((r) => elegido(p, r, recargar));
        montarRapidos(p, {
          alElegir: async (code) => {
            const r = await porCode(code);
            if (r) elegido(p, r, recargar);
          },
          // Lo escrito a mano no tiene catálogo detrás: se abre el formulario ya
          // lleno con los mismos números y el paciente solo elige la comida.
          alRepetir: (r) => {
            $('cm-form').innerHTML = formulario({
              descripcion: r.nombre, proteina_g: r.protein_g, kcal: r.kcal,
              carbohidrato_g: r.carb_g, grasa_g: r.fat_g,
            }, 'manual');
            enlazar(p, 'manual', {}, recargar);
          },
          recargar,
        });
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
    // La etiqueta que el paciente acaba de fotografiar vale mas que cualquier
    // base colaborativa: es el empaque mexicano que tiene en la mano. Se aporta
    // al catalogo para que el siguiente no la teclee.
    if (L.codigo_barras) {
      supabase.functions.invoke('aportar-producto', { body: {
        codigo_barras: L.codigo_barras, nombre: L.producto, marca: L.marca,
        base: L.base, porcion_g: L.porcion_g, porcion_texto: L.porcion_texto,
        kcal: L.kcal, proteina_g: L.proteina_g, carbohidrato_g: L.carbohidrato_g,
        grasa_g: L.grasa_g, fibra_g: L.fibra_g,
        azucares_anadidos_g: L.azucares_anadidos_g, sodio_mg: L.sodio_mg,
        ingredientes: L.ingredientes, sellos: L.sellos,
      } }).then(() => {}, () => {});
    }
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


/* ---------- código de barras ---------- */
// El codigo es la llave real de un producto empaquetado: no cambia, no tiene
// acentos y no se escribe de dos formas. Se puede leer de la foto o teclear.
function cajaCodigo() {
  return `<div class="confirma">
    <b>Código de barras</b>
    <p>Apunta la cámara al código de la parte de atrás, o escribe los números que vienen
      debajo de las rayas.</p>
    <input type="file" id="cb-foto" accept="image/*" capture="environment" hidden>
    <button class="btn btn-primary btn-block" type="button" id="cb-tomar">Tomar foto del código</button>
    <label class="cmf ancho"><span>O ESCRÍBELO</span>
      <input id="cb-num" type="text" inputmode="numeric" placeholder="7501030467090" maxlength="14"></label>
    <button class="btn btn-ghost btn-block" type="button" id="cb-buscar">Buscar producto</button>
  </div>`;
}

function montarCodigo(p, recargar) {
  const $ = (id) => document.getElementById(id);
  const estado = $('cm-estado');
  const aviso = (t, malo) => {
    estado.innerHTML = t
      ? `<div class="dato ${malo ? 'alerta' : ''}"><span class="dic">${malo ? '⚠️' : 'ℹ️'}</span><div>${t}</div></div>`
      : '';
  };

  const resolver = async (codigo) => {
    aviso('Buscando el producto…');
    const { data: r, error } = await supabase.functions
      .invoke('buscar-producto', { body: { codigo } });
    if (error || !r) { aviso('No se pudo buscar. Intenta de nuevo.', true); return; }
    if (!r.ok) {
      aviso(esc(r.aviso), true);
      // Si no esta en ninguna base, el camino es la etiqueta: y al confirmarla
      // el producto queda guardado con su codigo.
      $('cm-form').innerHTML = `<div class="confirma"><b>No lo encontramos</b>
        <p>${esc(r.aviso)}</p>
        <button class="btn btn-primary btn-block" type="button" id="cb-a-etiqueta">
          Tomar foto de la tabla nutrimental</button></div>`;
      $('cb-a-etiqueta')?.addEventListener('click', () => {
        document.querySelector('[data-modo="etiqueta"]')?.click();
      });
      return;
    }
    aviso(r.aviso ? esc(r.aviso) : '', !!r.requiere_revision);
    const d = r.producto;
    // Se reusa el panel del buscador: ya sabe pedir cuanto comiste.
    $('cm-form').innerHTML = panelBase({
      code: d.code, nombre: d.marca ? `${d.nombre} · ${d.marca}` : d.nombre,
      kcal: d.kcal, protein_g: d.protein_g, carb_g: d.carb_g, fat_g: d.fat_g,
      fiber_g: d.fiber_g, medida: d.medida, medida_g: d.medida_g,
      fuente: d.fuente === 'openfoodfacts' ? 'OpenFoodFacts' : d.fuente,
    });
    const s = document.getElementById('cm-franja');
    if (s) {
      s.innerHTML = FRANJAS.map(([k, n]) =>
        `<option value="${k}"${k === franjaAhora() ? ' selected' : ''}>${n}</option>`).join('');
    }
    montarBase({ ...d, nombre: d.nombre }, async (boton, fila, code) => {
      // El item_id NO es un extra: sin el, la comida queda suelta y nadie puede
      // saber despues QUE comio el paciente, solo como se llamaba ese dia. Esta
      // ruta lo omitia, asi que los 37 renglones escaneados que habia estaban
      // todos sin ligar. La ruta del buscador si lo hacia desde el principio.
      let item_id = null;
      try {
        const { data: f } = await supabase.from('food_items').select('id').eq('code', code).maybeSingle();
        item_id = f?.id ?? null;
      } catch (_) { /* si falla, se guarda la comida igual */ }
      await guardar(boton, { patient_id: p.id, origen: 'etiqueta', item_id, ...fila }, recargar);
      supabase.rpc('usar_alimento', { p_code: code }).then(() => {}, () => {});
    });

    // Un producto que viene de OpenFoodFacts entra con el nombre del paquete,
    // muchas veces en ingles: "Almond milk", "Mesquite Smoked Ham". Nadie que
    // busque en espanol lo vuelve a encontrar, y el catalogo crece invisible.
    // Aqui SI hay una persona mirando el producto, asi que es el momento de
    // preguntarle como le dice. Se guarda como ALIAS, no como nombre: el nombre
    // es lo que dice el paquete y eso no lo cambia un paciente.
    if (d.fuente === 'openfoodfacts') ponerApodo(d);
  };

  function ponerApodo(d) {
    const caja = document.createElement('div');
    caja.className = 'apodo';
    caja.innerHTML = `<label for="cm-apodo">¿Cómo le llamas tú?</label>
      <p class="muted small">Entró con el nombre del paquete. Si le pones el tuyo, lo encuentras
        más rápido la próxima vez, y tus compañeros también.</p>
      <div class="apodo-fila">
        <input type="text" id="cm-apodo" maxlength="40" autocomplete="off"
               placeholder="${esc(d.nombre || '')}">
        <button class="btn btn-sm" type="button" id="cm-apodo-ok">Guardar</button>
      </div>
      <p class="muted small hidden" id="cm-apodo-msg"></p>`;
    $('cm-form')?.append(caja);

    const campo = caja.querySelector('#cm-apodo');
    const msg = caja.querySelector('#cm-apodo-msg');
    const decir = (t) => { msg.textContent = t; msg.classList.remove('hidden'); };

    caja.querySelector('#cm-apodo-ok')?.addEventListener('click', async (ev) => {
      const apodo = (campo.value || '').trim();
      if (apodo.length < 2) { decir('Escribe al menos dos letras.'); return; }
      const b = ev.currentTarget;
      b.disabled = true;
      try {
        // OJO: supabase.rpc() no tiene .catch, solo .then. Va con try/catch.
        const { data, error } = await supabase.rpc('apodar_alimento',
          { p_code: d.code, p_apodo: apodo });
        if (error || data !== true) { decir('No se pudo guardar el nombre.'); b.disabled = false; return; }
        caja.innerHTML = `<p class="muted small">Listo: también lo vas a encontrar
          buscando «${esc(apodo)}».</p>`;
      } catch (_) {
        decir('No se pudo guardar el nombre.');
        b.disabled = false;
      }
    });
  }

  $('cb-buscar')?.addEventListener('click', () => {
    const c = ($('cb-num')?.value || '').replace(/\D/g, '');
    if (c.length < 8) { aviso('Faltan dígitos. Un código suele traer 13.', true); return; }
    resolver(c);
  });
  $('cb-num')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') $('cb-buscar').click(); });
  $('cb-tomar')?.addEventListener('click', () => $('cb-foto').click());

  $('cb-foto')?.addEventListener('change', async (ev) => {
    const f = ev.target.files?.[0];
    ev.target.value = '';
    if (!f) return;
    let ruta = null;
    try {
      aviso('Leyendo el código…');
      ruta = `${p.id}/comida/${Date.now()}-cb.jpg`;
      const up = await supabase.storage.from('patient-documents')
        .upload(ruta, f, { contentType: f.type || 'image/jpeg' });
      if (up.error) throw up.error;
      const { data: doc, error: eDoc } = await supabase.from('documents').insert({
        patient_id: p.id, kind: 'other', storage_path: ruta,
        original_filename: f.name || 'codigo.jpg', mime_type: f.type || 'image/jpeg',
        extraction_status: 'pending',
      }).select('id').single();
      if (eDoc) { await supabase.storage.from('patient-documents').remove([ruta]).catch(() => {}); throw eDoc; }

      const { data: r, error: eFn } = await supabase.functions
        .invoke('leer-alimento', { body: { document_id: doc.id, modo: 'codigo' } });
      if (eFn || r?.error) throw new Error(r?.error || eFn.message);
      if (!r.ok) { aviso(esc(r.aviso), true); return; }

      // Se muestra el numero leido antes de buscar: un digito mal cambia de
      // producto, y el paciente tiene el empaque enfrente para comprobarlo.
      const num = document.getElementById('cb-num');
      if (num) num.value = r.lectura.codigo;
      if (r.requiere_revision) { aviso(esc(r.aviso), true); return; }
      resolver(r.lectura.codigo);
    } catch (e) {
      console.error(e);
      aviso('No pudimos leer el código. Escribe los números a mano.', true);
    }
  });
}
