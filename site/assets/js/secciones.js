// Pantallas de detalle de "Mi salud". Cada una se abre dentro de la misma pestana,
// no en una pagina nueva: el paciente no pierde el contexto ni ve un PDF.
// Regla que no se rompe: lo que no tiene dato se dice vacio y honesto, no se inventa.
import { supabase } from './supabase.js';
import { COMIDAS, armarComida } from './comidas.js';

const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const n1 = (x) => (x === null || x === undefined ? '—' : Number(x).toLocaleString('es-MX'));

/* posicion del valor dentro de la escala, de 0 a 100 */
function posicion(v, lo, hi) {
  if (v == null) return null;
  const a = lo ?? (hi != null ? hi * 0.2 : 0);
  const b = hi ?? (lo != null ? lo * 2.5 : 100);
  if (b === a) return 50;
  return Math.max(2, Math.min(98, ((v - a) / (b - a)) * 100));
}

const cabecera = (titulo, sub) => `
  <div class="det-nav"><button class="det-bk" type="button" aria-label="Regresar">‹</button>
    <div><b>${esc(titulo)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}</div></div>`;

const vacio = (icono, texto, boton) => `
  <div class="vacio"><span class="vic">${icono}</span>${esc(texto)}
  ${boton ? `<div style="margin-top:13px"><button class="btn-primary btn-sm" type="button">${esc(boton)}</button></div>` : ''}</div>`;

/* ============ Mi alimentación ============ */
async function alimentacion(p) {
  const { data: m } = await supabase.rpc('macros_objetivo', { p_patient: p.id });
  if (!m?.ok) return cabecera('Mi alimentación') + `<div class="w">${vacio('🍽️',
    'Tu meta de macros se calcula cuando tu médica complete tu peso y estatura.')}</div>`;

  const modo = m.enfoque_carbos && m.enfoque_carbos !== 'estandar';
  return cabecera('Mi alimentación', `${p.first_name} · ${m.supuestos?.peso_kg ?? '—'} kg`) + `<div class="w">
    <div class="kcalbox"><div class="lb">TU META DEL DÍA</div>
      <div class="bg">${n1(m.kcal)}</div>
      <div class="un">kilocalorías · ${esc(m.supuestos?.ajuste || '')}</div></div>

    <div class="mg3">
      <div class="mc"><div class="n cP">PROTEÍNA</div><div class="v">${m.proteina_g}<small>g</small></div>
        <div class="p">${m.proteina_pct}%</div><div class="bar"><i class="bP" style="width:${m.proteina_pct}%"></i></div></div>
      <div class="mc"><div class="n cC">CARBOS</div><div class="v">${m.carbohidrato_g}<small>g</small></div>
        <div class="p">${m.carbohidrato_pct}%</div><div class="bar"><i class="bC" style="width:${m.carbohidrato_pct}%"></i></div></div>
      <div class="mc"><div class="n cG">GRASA</div><div class="v">${m.grasa_g}<small>g</small></div>
        <div class="p">${m.grasa_pct}%</div><div class="bar"><i class="bG" style="width:${m.grasa_pct}%"></i></div></div>
    </div>

    ${modo ? `<div class="dato"><span class="dic">🥗</span><div><b>Enfoque bajo en carbohidratos.</b>
      ${m.piso_aplicado ? `Se aplicó un piso de ${m.carbos_piso_g} g por tus propios datos, no por preferencia.` : ''}</div></div>` : ''}
    ${(m.piso_razones || []).map((r) => `<div class="dato"><span class="dic">⚠️</span><div>${esc(r)}</div></div>`).join('')}
    ${m.bloqueo ? `<div class="dato alerta"><span class="dic">🚫</span><div>${esc(m.bloqueo)}</div></div>` : ''}

    <div class="dato"><span class="dic">💪</span><div><b>${m.proteina_g_kg} g de proteína por kilo.</b>
      Alta a propósito: es lo que decide si lo que pierdes es grasa o músculo.</div></div>
    <div class="dato"><span class="dic">💧</span><div><b>${(m.agua_ml / 1000).toFixed(1)} litros de agua al día.</b>
      Café y té cuentan. La comida aporta otra parte.</div></div>
    <div class="dato"><span class="dic">🌾</span><div><b>${m.fibra_g} g de fibra.</b>
      Verdura en cada comida, leguminosas y semillas.</div></div>

    ${await diaEjemplo(m)}
    <div class="nota-chica">${esc(m.supuestos?.nota || '')}</div>
  </div>`;
}

// Mismo motor que la hoja impresa, para que el gramaje no se contradiga.
async function diaEjemplo(m) {
  const { data: foods } = await supabase.from('catalog_foods').select('*').eq('is_active', true);
  if (!foods?.length) return '';
  const tot = { k: 0, p: 0, c: 0, g: 0 };
  let html = '<h2 class="s">Un día de ejemplo</h2>';
  const tarjetas = [];
  COMIDAS.forEach((cm) => {
    const el = armarComida(cm, {
      p: m.proteina_g * cm.p, c: m.carbohidrato_g * cm.c, g: m.grasa_g * cm.g,
    }, foods);
    if (!el.length) return;
    const sum = (campo) => el.reduce((a, x) => a + x.g * x.f[campo] / 100, 0);
    const k = Math.round(sum('kcal')), pr = Math.round(sum('protein_g'));
    const ca = Math.round(sum('carb_g')), gr = Math.round(sum('fat_g'));
    tot.k += k; tot.p += pr; tot.c += ca; tot.g += gr;
    tarjetas.push(`<div class="meal"><div class="mh"><b>${esc(cm.nombre)}</b><span>${k} kcal</span></div>
      <ul>${el.map((x) => `<li>${esc(x.f.name_es)}<span>${x.g} g</span></li>`).join('')}</ul>
      <div class="chips"><span class="chip">P ${pr} g</span><span class="chip c">C ${ca} g</span><span class="chip">G ${gr} g</span></div></div>`);
  });
  html += tarjetas.join('');
  const dif = tot.k - m.kcal;
  html += `<p class="nota-chica">Este día suma <b>${n1(tot.k)} kcal</b> · ${tot.p} g de proteína ·
    ${tot.c} g de carbohidrato · ${tot.g} g de grasa, contra tu meta de ${n1(m.kcal)} kcal.
    ${Math.abs(dif) > 40 ? `La diferencia de ${dif > 0 ? '+' : ''}${dif} kcal viene de redondear las porciones a gramos de 5.` : ''}
    Es una guía de proporciones, no un menú obligatorio: usa los intercambios que te dé tu médica.</p>`;
  return html;
}

/* ============ Mi entrenamiento ============ */
const IMG = { jalon: 'dia1-jalon', empuje: 'dia3-empuje', pierna: 'dia2-pierna' };
async function entrenamiento(p) {
  const { data: g } = await supabase.rpc('programa_entrenamiento', { p_patient: p.id });
  if (!g?.dias?.length) return cabecera('Mi entrenamiento') + `<div class="w">${vacio('💪',
    'Tu programa aparece aquí cuando tu médica autorice el entrenamiento.')}</div>`;

  const dias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const norm = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const porDia = new Map(g.dias.map((d) => [norm(d.dia), d]));

  let html = cabecera('Mi entrenamiento', `${g.dias.length} días de fuerza · nivel ${g.nivel || ''}`) + '<div class="w">';
  html += '<div class="wk">' + dias.map((d) => {
    const x = porDia.get(norm(d));
    const et = x ? norm(x.foco).split(':')[0] : '';
    return `<div class="${x ? 'on' : ''}"><b>${d.slice(0, 3).toUpperCase()}</b>${x ? esc(et.slice(0, 7)) : '—'}</div>`;
  }).join('') + '</div>';

  (g.notas || []).forEach((t) => { html += `<div class="dato"><span class="dic">⚠️</span><div>${esc(t)}</div></div>`; });

  g.dias.forEach((d) => {
    const clave = Object.keys(IMG).find((k) => norm(d.foco).includes(k));
    html += `<div class="day">
      ${clave ? `<img src="assets/img/entreno/${IMG[clave]}.webp" alt="Guía ilustrada" loading="lazy" width="822" height="900">` : ''}
      <div class="hd"><b>${esc(d.dia)}</b><span>${esc(d.foco)}</span></div>`;
    (d.ejercicios || []).forEach((e) => {
      html += `<div class="ex"><div class="t"><b>${esc(e.nombre)}</b><span>${esc(e.series || '')}</span></div>
        <div class="m">${[e.equipo, e.musculos, e.rpe].filter(Boolean).map(esc).join(' · ')}</div>
        ${e.como ? `<details><summary>Cómo se hace ›</summary><p>${esc(e.como)}</p>
          ${e.errores ? `<div class="err">Evita: ${esc(e.errores)}</div>` : ''}</details>` : ''}</div>`;
    });
    html += '</div>';
  });

  if (g.cardio?.length) {
    html += '<h2 class="s">Cardio de la semana</h2><div class="lista">';
    g.cardio.forEach((c) => {
      html += `<div class="lv"><div class="t"><b>${esc(c.nombre)}</b><span class="ds">${esc(c.series || '')}</span></div>
        <div class="m">${esc(c.como || '')}</div></div>`;
    });
    html += '</div>';
  }
  return html + '</div>';
}

/* ============ Mis estudios ============ */
async function estudios(p) {
  const { data: e } = await supabase.rpc('estado_por_sistema', { p_patient: p.id });
  if (!e?.listo) return cabecera('Mis estudios') + `<div class="w">${vacio('🔬',
    e?.motivo || 'Tu médica está revisando tus estudios.')}</div>`;

  const { data: vals } = await supabase
    .from('lab_results')
    .select('value_numeric,unit,collected_at,biomarkers(code,name_es)')
    .eq('patient_id', p.id).not('released_at', 'is', null)
    .order('collected_at', { ascending: false });

  let html = cabecera('Mis estudios', `${e.n_resultados} resultados`) + '<div class="w">';
  (e.sistemas || []).forEach((s) => {
    html += `<div class="sysg"><div class="sysh"><span class="pt ${esc(s.color)}"></span>
      <b>${esc(s.nombre)}</b><span class="cta ${esc(s.color)}">${s.actuar > 0 ? `${s.actuar} a atender` : s.vigilar > 0 ? 'vigilar' : 'sin alteraciones'}</span></div>
      <div class="lista">`;
    (s.hallazgos || []).forEach((h) => {
      html += `<div class="lv"><div class="t"><b>${esc(h.titulo)}</b></div>
        ${h.detalle ? `<div class="exp">${esc(h.detalle)}</div>` : ''}</div>`;
    });
    html += '</div></div>';
  });

  if (vals?.length) {
    html += '<h2 class="s">Todos tus valores</h2><div class="lista">';
    vals.forEach((v) => {
      html += `<div class="lv"><div class="t"><b>${esc(v.biomarkers?.name_es || '')}</b>
        <span class="ds">${n1(v.value_numeric)} <small>${esc(v.unit || '')}</small></span></div></div>`;
    });
    html += '</div>';
  }
  return html + '</div>';
}

/* ============ Estudios pendientes ============ */
async function pendientes(p) {
  const { data: f } = await supabase.rpc('estudios_faltantes', { p_patient: p.id });
  if (!f?.length) return cabecera('Estudios pendientes') + `<div class="w">${vacio('✅',
    'No tienes estudios pendientes. Bien ahí.')}</div>`;

  const U = { inmediato: 'AHORA', antes_de_iniciar: 'ANTES DE SEGUIR', conviene: 'CONVIENE' };
  let html = cabecera('Estudios pendientes', `${f.length} por hacerte`) +
    '<div class="w"><p class="lead">Cuando te los hagas, súbelos aquí.</p>';
  f.forEach((r) => {
    const urg = r.urgencia === 'inmediato' || r.urgencia === 'antes_de_iniciar';
    html += `<div class="pend ${urg ? 'urg' : ''}"><div class="u">${esc(U[r.urgencia] || 'CONVIENE')}</div>
      <b>${esc(r.titulo)}</b>
      <p>${esc(r.para_el_paciente || r.por_que || '')}</p>
      ${(r.faltan || []).length ? `<p class="falta">Falta: ${(r.faltan || []).map(esc).join(' · ')}</p>` : ''}
      <div class="act"><button class="btn-primary btn-sm" type="button">Subir resultado</button></div></div>`;
  });
  return html + '</div>';
}

/* ============ Mi protocolo ============ */
async function protocolo(p, plan) {
  if (!plan) return cabecera('Mi protocolo') + `<div class="w">${vacio('📋',
    'Tu médica todavía no ha firmado y entregado tu plan. Aquí lo verás en cuanto lo haga.')}</div>`;

  const { data: items } = await supabase.from('protocol_items')
    .select('category,title,dose,timing,frequency,instructions,rationale,sort_order')
    .eq('protocol_id', plan.id).eq('is_active', true).order('sort_order');

  const G = { supplement: 'Suplementos', peptide: 'Péptidos', medication: 'Medicamentos',
    nutrition: 'Alimentación', exercise: 'Ejercicio', sleep: 'Sueño', stress: 'Estrés',
    lab_followup: 'Estudios de control', referral: 'Referencias', other: 'Notas' };
  const grupos = new Map();
  (items || []).forEach((i) => {
    const g = G[i.category] || 'Otros';
    if (!grupos.has(g)) grupos.set(g, []);
    grupos.get(g).push(i);
  });

  let html = cabecera('Mi protocolo', `Versión ${plan.version} · ${items?.length || 0} indicaciones`) + '<div class="w">';
  grupos.forEach((lista, g) => {
    html += `<h2 class="s">${esc(g)} · ${lista.length}</h2>`;
    lista.forEach((i) => {
      const retirado = /^(RETIRADO|BLOQUEADO)/.test(i.title || '');
      html += `<div class="ficha${retirado ? ' off' : ''}">
        <div class="t"><b>${esc(i.title)}</b>${i.dose ? `<span class="d">${esc(i.dose)}</span>` : ''}</div>
        <div class="m">${[i.timing, i.frequency].filter(Boolean).map(esc).join(' · ')}</div>
        ${i.instructions ? `<div class="aviso">${esc(i.instructions)}</div>` : ''}</div>`;
    });
  });
  return html + '</div>';
}

/* ============ Dudas y mensajes ============ */
async function mensajes(p) {
  const { data: ms } = await supabase.from('patient_messages')
    .select('de,cuerpo,created_at').eq('patient_id', p.id).order('created_at');

  let html = cabecera('Dudas y mensajes', 'Tu equipo médico') + '<div class="w">';
  if (!ms?.length) {
    html += vacio('💬', 'Todavía no hay mensajes. Escribe tu primera duda aquí abajo.');
  } else {
    ms.forEach((m) => {
      const f = new Date(m.created_at).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
      html += `<div class="msg ${m.de === 'paciente' ? 'yo' : 'dr'}">${esc(m.cuerpo)}<span class="q">${f}</span></div>`;
    });
  }
  html += `<form class="caja" id="form-msg"><input id="msg-txt" placeholder="Escribe tu duda…" maxlength="4000" autocomplete="off">
      <button type="submit" aria-label="Enviar">↑</button></form>
    <p class="nota-chica" style="text-align:center">Esto no es para urgencias. Si tienes una emergencia llama al <b>911</b>.</p>`;
  return html + '</div>';
}

/* ============ Mi avance ============ */
async function avance(p) {
  const [{ data: bc }, { data: vs }, { data: ch }] = await Promise.all([
    supabase.from('body_composition').select('measured_at,weight_kg,body_fat_pct,waist_cm')
      .eq('patient_id', p.id).order('measured_at', { ascending: false }).limit(2),
    supabase.from('vital_signs').select('measured_at,sbp,dbp')
      .eq('patient_id', p.id).order('measured_at', { ascending: false }).limit(1),
    supabase.from('daily_checkins').select('checkin_date,supplements_taken')
      .eq('patient_id', p.id).order('checkin_date', { ascending: false }).limit(7),
  ]);

  const peso = bc?.[0]?.weight_kg;
  const cint = bc?.[0]?.waist_cm;
  const pa = vs?.[0];
  const dias = (ch || []).map((d) => Object.keys(d.supplements_taken || {}).length);
  const activos = dias.filter((x) => x > 0).length;

  let html = cabecera('Mi avance', 'Tus números en el tiempo') + `<div class="w">
    <div class="met">
      <div><div class="n">PESO</div><div class="v">${peso ? `${peso}<small> kg</small>` : '—'}</div>
        <div class="c">${bc?.length > 1 ? 'con historial' : 'una sola medición'}</div></div>
      <div><div class="n">CINTURA</div><div class="v">${cint ? `${cint}<small> cm</small>` : '—'}</div>
        <div class="c">${cint ? '' : 'falta medirla'}</div></div>
      <div><div class="n">PRESIÓN</div><div class="v">${pa ? `${pa.sbp}/${pa.dbp}` : '—'}</div>
        <div class="c">${pa ? new Date(pa.measured_at).toLocaleDateString('es-MX') : 'falta tomarla'}</div></div>
      <div><div class="n">CONSTANCIA</div><div class="v">${activos}<small>/7</small></div>
        <div class="c">días con registro</div></div>
    </div>`;

  html += '<h2 class="s">Tus laboratorios en el tiempo</h2>';
  html += vacio('📈', 'Con dos estudios empieza la gráfica. En cuanto llegue tu control vas a ver aquí cómo se movieron tus valores.');
  if (!bc || bc.length < 2) {
    html += '<h2 class="s">Tu peso en el tiempo</h2>';
    html += vacio('⚖️', 'Pésate el mismo día, a la misma hora y en ayunas, una vez por semana. Con dos mediciones empieza la gráfica.');
  }
  return html + '</div>';
}

/* ============ Mi perfil ============ */
async function perfil(p) {
  const fila = (t, s, r) => `<div class="row"><div class="l"><b>${esc(t)}</b>${s ? `<span>${esc(s)}</span>` : ''}</div>
    ${r ? `<div class="r">${esc(r)}</div>` : ''}</div>`;
  const edad = p.birth_date ? Math.floor((Date.now() - new Date(p.birth_date)) / 31557600000) : null;
  return cabecera('Mi perfil') + `<div class="w">
    ${fila(`${p.first_name} ${p.last_name}`, edad ? `${edad} años` : '')}
    ${fila('Correo', p.email || '', 'Cambiar ›')}
    ${fila('Teléfono', p.phone || 'sin registrar', 'Cambiar ›')}
    <h2 class="s">Tus datos</h2>
    ${fila('Descargar mi expediente', 'Todo lo que tenemos de ti', '›')}
    ${fila('Cerrar sesión', '', '›')}
  </div>`;
}

const SECCIONES = { alimentacion, entrenamiento, estudios, pendientes, protocolo, mensajes, avance, perfil };

export async function abrirSeccion(id, p, extra) {
  const caja = document.getElementById('detalle');
  const fn = SECCIONES[id];
  if (!caja || !fn) return;
  caja.innerHTML = '<div class="w"><div class="spinner" aria-label="Cargando"></div></div>';
  document.getElementById('salud-lista')?.classList.add('hidden');
  caja.classList.remove('hidden');
  scrollTo({ top: 0 });
  try {
    caja.innerHTML = await fn(p, extra);
  } catch (e) {
    console.error(e);
    caja.innerHTML = cabecera('Ups') + `<div class="w">${vacio('⚠️',
      'No pudimos cargar esta sección. Intenta de nuevo en un momento.')}</div>`;
  }
  caja.querySelector('.det-bk')?.addEventListener('click', cerrarSeccion);
  const f = caja.querySelector('#form-msg');
  if (f) f.addEventListener('submit', (ev) => enviarMensaje(ev, p));
}

export function cerrarSeccion() {
  document.getElementById('detalle')?.classList.add('hidden');
  document.getElementById('salud-lista')?.classList.remove('hidden');
  scrollTo({ top: 0 });
}

async function enviarMensaje(ev, p) {
  ev.preventDefault();
  const campo = document.getElementById('msg-txt');
  const texto = (campo?.value || '').trim();
  if (!texto) return;
  campo.value = '';
  const { error } = await supabase.from('patient_messages')
    .insert({ patient_id: p.id, de: 'paciente', cuerpo: texto });
  if (error) { console.error(error); campo.value = texto; return; }
  abrirSeccion('mensajes', p);
}
