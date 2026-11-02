// Hoja del plan para el paciente. Lenguaje directo arriba; el detalle clínico
// vive dentro de un "¿Por qué?" desplegable, que al imprimir se abre solo.
// Mientras no esté firmado lleva marca de agua y la leyenda de no entregar.
import { supabase } from './supabase.js';
import { esquemaEjercicio } from './ejercicios-svg.js';
import { FRANJAS, franjaDe } from './franjas.js';

const root = document.getElementById('root');
document.getElementById('print').addEventListener('click', () => window.print());
document.getElementById('back').addEventListener('click', (e) => { if (history.length > 1) { e.preventDefault(); history.back(); } });
// El navegador no abre un <details> cerrado al imprimir: se abren a mano.
window.addEventListener('beforeprint', () => document.querySelectorAll('details').forEach((d) => { d.dataset.era = d.open ? '1' : '0'; d.open = true; }));
window.addEventListener('afterprint', () => document.querySelectorAll('details').forEach((d) => { d.open = d.dataset.era === '1'; }));

const id = new URLSearchParams(location.search).get('id');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fecha = (d) => (d ? new Date(d).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }) : '—');
const edad = (d) => { if (!d) return null; const b = new Date(d); const n = new Date(); let a = n.getFullYear() - b.getFullYear(); if (n < new Date(n.getFullYear(), b.getMonth(), b.getDate())) a--; return a; };
const num = (n) => (n == null ? '—' : Number(n).toLocaleString('es-MX'));

const dosisOk = (d, r) => {
  const t = String(d || '').toLowerCase();
  const re = String(r || '').toLowerCase();
  if (!t || !/\d/.test(t)) return false;
  if (/(seg[uú]n|variable|indeterminad|a criterio|por definir|reconstitu|protocolo del stack)/.test(t)) return false;
  if (/(mcg|µg|ug|\bmg\b|\bg\b|\bkg\b|g\/kg|\bui\b|\biu\b)/.test(t)) return true;
  if (/(\bu\b|unidad|unidades|\bml\b|\bcc\b)/.test(t)) return /\d/.test(re) && /(mcg|µg|ug|\bmg\b|\bg\b)/.test(re);
  if (/(\bcap|\btab|porcion|porciones|gotas)/.test(t)) return true;
  return false;
};

/* ---------- carga ---------- */
async function cargar() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Inicia sesión para ver el plan.');
  const { data: plan, error } = await supabase.from('protocols').select('*').eq('id', id).single();
  if (error || !plan) throw new Error('No encontramos el plan o no tienes acceso.');
  const [it, pa, ph] = await Promise.all([
    supabase.from('protocol_items').select('*').eq('protocol_id', id).eq('is_active', true).order('category').order('sort_order'),
    supabase.from('patients').select('first_name,last_name,birth_date,sex_at_birth').eq('id', plan.patient_id).single(),
    plan.signed_by
      ? supabase.from('physicians').select('full_name,cedula_profesional,specialty,cedula_especialidad').eq('user_id', plan.signed_by).single()
      : Promise.resolve({ data: null }),
  ]);
  // Todo esto es extra: si algo falla, la hoja se imprime sin esa parte.
  const [est, mac, fd, prog, tips, pats] = await Promise.all([
    supabase.rpc('estudios_faltantes', { p_patient: plan.patient_id }).then((r) => r.data || []).catch(() => []),
    supabase.rpc('macros_objetivo', { p_patient: plan.patient_id }).then((r) => r.data || null).catch(() => null),
    supabase.from('catalog_foods').select('*').eq('is_active', true).then((r) => r.data || []).catch(() => []),
    supabase.rpc('programa_entrenamiento', { p_patient: plan.patient_id }).then((r) => r.data || null).catch(() => null),
    supabase.from('catalog_tips').select('*').eq('is_active', true).order('category').order('sort_order').then((r) => r.data || []).catch(() => []),
    supabase.from('interpretation_patterns').select('code,patient_summary,patient_text').then((r) => r.data || []).catch(() => []),
  ]);
  return { plan, items: it.data || [], patient: pa.data, physician: ph.data,
           estudios: est, macros: mac, foods: fd, programa: prog, tips, patrones: pats };
}

/* ---------- piezas ---------- */
const SISTEMA = {
  cardiovascular: 'Colesterol y corazón', metabolico: 'Azúcar e insulina',
  hepatico: 'Hígado', renal: 'Riñón e hidratación', inflamacion: 'Inflamación',
  hormonal: 'Hormonas', tiroides: 'Tiroides', nutrientes: 'Vitaminas y minerales',
  hematologia: 'Sangre', general: 'General',
};
const SEV = { actuar: 'rojo', vigilar: 'amarillo', informativo: '' };
const DIRECCION = { alto: 'está arriba de lo deseable', bajo: 'está abajo de lo deseable' };

function detalle(resumen, cuerpo) {
  if (!cuerpo) return '';
  return `<details><summary>${esc(resumen)}</summary><div class="det-cuerpo">${cuerpo}</div></details>`;
}

// 01: una frase por hallazgo. Lo clínico vive dentro del desplegable, y
// cuando el patrón tiene versión en lenguaje simple se usa esa.
function loQueEncontramos(plan, patrones) {
  const lista = plan.ai_draft?.interpretacion || [];
  const hall = plan.ai_draft?.hallazgos || [];
  const metas = plan.ai_draft?.metas || [];
  const simple = new Map((patrones || []).map((p) => [p.code, p]));
  const metaDe = (m) => (metas.find((x) => x.marcador === m) || {}).meta;
  const rojos = hall.filter((x) => x.color === 'rojo');
  const amarillos = hall.filter((x) => x.color === 'amarillo');

  if (!lista.length && !rojos.length && !amarillos.length) {
    return `<h2><b>01</b>Lo que encontramos</h2>
      <p>Ningún resultado salió fuera de lo deseable en este panel. El plan de abajo es para mantenerte así.</p>`;
  }

  const bloques = lista.map((x) => {
    const sp = simple.get(x.code) || {};
    const vals = Object.entries(x.valores || {}).map(([k, v]) => `${esc(k)} ${esc(v)}`).join(' · ');
    const sev = SEV[x.severidad] || '';
    // Lo visible: una frase. Si el patrón no tiene versión simple todavía,
    // se usa el título, nunca el párrafo clínico completo.
    const resumen = sp.patient_summary || x.titulo;
    const largo = sp.patient_text
      ? `<p>${esc(sp.patient_text)}</p>`
      : `<p>${esc(x.interpretacion)}</p>`;
    return `<div class="interp">
      <p class="interp-tit"><b class="${sev}">${esc(resumen)}</b></p>
      <p class="vacio small">${esc(SISTEMA[x.sistema] || x.sistema)}${vals ? ` · lo vemos en ${vals}` : ''}</p>
      ${detalle('Quiero entenderlo mejor', largo)}
    </div>`;
  }).join('');

  const fila = (x) => {
    const meta = metaDe(x.marcador);
    return `<tr>
      <td><b>${esc(x.marcador)}</b>${x.critico ? ' <span class="rojo">· urgente</span>' : ''}</td>
      <td class="${esc(x.color)}">${esc(x.valor)} ${esc(x.unidad || '')}</td>
      <td>${esc(DIRECCION[x.direccion] || 'fuera de lo deseable')}</td>
      <td>${meta ? esc(meta) : '—'}</td>
    </tr>`;
  };

  return `<h2><b>01</b>Lo que encontramos</h2>
    ${bloques}
    <h3>Tus números, en corto</h3>
    <table><thead><tr><th>Estudio</th><th>Tu valor</th><th>Cómo está</th><th>A dónde queremos llegar</th></tr></thead><tbody>
      ${rojos.map(fila).join('')}${amarillos.map(fila).join('')}
    </tbody></table>
    <p class="vacio small">En rojo, lo que está fuera de límite. En amarillo, lo que está en el límite y conviene mover.</p>`;
}

const URGENCIA = {
  inmediato: ['Hazlos ya', 'aviso'],
  antes_de_iniciar: ['Antes de empezar el tratamiento', 'rev'],
  conviene: ['Conviene tenerlos', 'rev'],
};

// 02: estudios que faltan, lo urgente primero
function estudiosFaltantes(lista, n) {
  if (!lista?.length) return '';
  const orden = ['inmediato', 'antes_de_iniciar', 'conviene'];
  const bloques = orden.map((u) => {
    const propios = lista.filter((x) => x.urgencia === u);
    if (!propios.length) return '';
    const [etiqueta, clase] = URGENCIA[u];
    return `<div class="${clase}"><h4>${esc(etiqueta)}</h4>
      ${propios.map((x) => `<div class="falta">
        <p><b>${esc(x.titulo)}</b></p>
        <p>${esc(x.para_el_paciente)}</p>
        <p class="lista-falta"><b>Qué pedir:</b> ${esc((x.faltan || []).join(' · '))}</p>
        ${detalle('¿Por qué hace falta?', `<p>${esc(x.por_que)}</p>`)}
      </div>`).join('')}
    </div>`;
  }).join('');
  return `<h2><b>${n}</b>Estudios que te faltan</h2>
    <p class="sub">Sin estos, parte del plan se estaría decidiendo sobre una sospecha y no sobre un dato.</p>
    ${bloques}`;
}

/* ---------- horarios ---------- */

const ICONO = {
  ayunas: '<svg viewBox="0 0 24 24" class="fr-ico"><circle cx="12" cy="12" r="5"/><path d="M12 1v3M12 20v3M3.5 3.5l2 2M18.5 18.5l2 2M1 12h3M20 12h3M3.5 20.5l2-2M18.5 5.5l2-2"/></svg>',
  desayuno: '<svg viewBox="0 0 24 24" class="fr-ico"><path d="M4 13h12a4 4 0 0 1 0 8H8a4 4 0 0 1-4-4z"/><path d="M16 14h2a3 3 0 0 1 0 6h-1"/><path d="M7 4v3M11 3v4"/></svg>',
  entreno: '<svg viewBox="0 0 24 24" class="fr-ico"><path d="M2 12h3M19 12h3M6 8v8M18 8v8M9 6v12M15 6v12M9 12h6"/></svg>',
  comida: '<svg viewBox="0 0 24 24" class="fr-ico"><path d="M5 3v8a2 2 0 0 0 4 0V3M7 11v10"/><path d="M17 3c-2 0-3 3-3 6s1 4 3 4v8"/></svg>',
  cena: '<svg viewBox="0 0 24 24" class="fr-ico"><path d="M3 18h18"/><path d="M4 18a8 8 0 0 1 16 0"/><path d="M12 6V3"/></svg>',
  dormir: '<svg viewBox="0 0 24 24" class="fr-ico"><path d="M20 14.5A8 8 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/></svg>',
  semanal: '<svg viewBox="0 0 24 24" class="fr-ico"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><circle cx="12" cy="15" r="1.6" fill="currentColor"/></svg>',
  indefinido: '<svg viewBox="0 0 24 24" class="fr-ico"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.3 2.4c-.5.2-.8.7-.8 1.2v.4"/><circle cx="12" cy="17" r="1" fill="currentColor"/></svg>',
};

function tablaHorarios(items, n) {
  const tomables = items.filter((i) => ['supplement', 'peptide', 'medication'].includes(i.category));
  if (!tomables.length) return '';
  const tarjetas = FRANJAS.map(([clave, titulo]) => {
    const propios = tomables.filter((i) => franjaDe(i) === clave);
    if (!propios.length) return '';
    return `<div class="franja">
      <div class="franja-head">${ICONO[clave] || ''}<div><b>${esc(titulo)}</b>
        <span class="franja-n">${propios.length} ${propios.length === 1 ? 'cosa' : 'cosas'}</span></div></div>
      <div class="franja-items">
        ${propios.map((i) => {
          const mal = !dosisOk(i.dose, i.reconstitution);
          const extra = [
            i.rationale ? `<p><b>Para qué es:</b> ${esc(i.rationale)}</p>` : '',
            i.instructions ? `<p>${esc(i.instructions)}</p>` : '',
            i.reconstitution ? `<p><b>Cómo se prepara el frasco:</b> ${esc(i.reconstitution)}</p>` : '',
            i.frequency ? `<p><b>Cada cuándo:</b> ${esc(i.frequency)}</p>` : '',
          ].join('');
          return `<div class="tomar">
            <div class="tomar-check" aria-hidden="true"></div>
            <div class="tomar-cuerpo">
              <div class="tomar-tit"><b>${esc(i.title)}</b>
                ${i.category === 'peptide' ? '<span class="ev">inyectable</span>' : ''}
                ${i.category === 'medication' ? '<span class="ev">medicamento</span>' : ''}</div>
              <div class="tomar-dosis ${mal ? 'rojo' : ''}">${esc(i.dose || 'falta definir')}
                <span class="vacio">· ${esc(i.frequency || 'diario')}</span></div>
              ${extra ? detalle('Ver detalle', extra) : ''}
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }).join('');
  const sinDosis = tomables.filter((i) => !dosisOk(i.dose, i.reconstitution));
  return `<h2><b>${n}</b>Qué tomar y a qué hora</h2>
    <p class="sub">Si un día se te pasa una toma, no la dupliques: sigue con la siguiente.</p>
    <div class="franjas">${tarjetas}</div>
    ${sinDosis.length ? `<div class="rev"><h4>Pendiente de definir con tu médico</h4><ul>
      ${sinDosis.map((i) => `<li>${esc(i.title)}: la cantidad exacta la define tu médico antes de que empieces.</li>`).join('')}
    </ul></div>` : ''}`;
}

/* ---------- comida ---------- */
// Reparto del dia y topes de porcion. Sin topes salen porciones absurdas
// (medio kilo de huevo), que es lo contrario de practico.
const COMIDAS = [
  { nombre: 'Desayuno', p: 0.25, c: 0.30, g: 0.30,
    prot: [['HUEVO', 150], ['PROTEINA_POLVO', 40], ['YOGURT_GRIEGO', 250]],
    carb: [['AVENA', 100], ['FRUTA', 200]],
    gra:  [['NUECES', 40], ['ACEITE_OLIVA', 15]] },
  { nombre: 'Comida', p: 0.30, c: 0.35, g: 0.30,
    prot: [['POLLO', 220], ['ATUN', 150]],
    carb: [['ARROZ', 300], ['FRIJOL', 250]],
    gra:  [['AGUACATE', 120], ['ACEITE_OLIVA', 20]], verdura: true },
  { nombre: 'Cena', p: 0.30, c: 0.25, g: 0.30,
    prot: [['SALMON', 180], ['POLLO', 200]],
    carb: [['PAPA', 300], ['TORTILLA_MAIZ', 90]],
    gra:  [['ACEITE_OLIVA', 20], ['AGUACATE', 80]], verdura: true },
  { nombre: 'Colación', p: 0.15, c: 0.10, g: 0.10,
    prot: [['YOGURT_GRIEGO', 250], ['PROTEINA_POLVO', 30]],
    carb: [['FRUTA', 200]],
    gra:  [['SEMILLA_CHIA', 20], ['NUECES', 30]] },
];
const r5 = (g) => Math.round(g / 5) * 5;

// Reparte una comida ajustando los tres macros a la vez. Hacerlo en un solo
// pase no funciona: cada alimento aporta algo de los otros dos macros, asi que
// se itera hasta que los tres caen cerca del objetivo.
function armarComida(cm, meta, foods) {
  const fd = (code) => foods.find((x) => x.code === code);
  const grupos = [['carb_g', cm.carb, meta.c], ['fat_g', cm.gra, meta.g], ['protein_g', cm.prot, meta.p]];
  const gr = new Map();
  const total = (campo) => [...gr.entries()].reduce((a, [code, g]) => {
    const f = fd(code); return a + (f ? g * f[campo] / 100 : 0);
  }, 0);
  for (let it = 0; it < 14; it++) {
    for (const [campo, lista, objetivo] of grupos) {
      let falta = objetivo - total(campo);
      for (const [code, tope] of lista) {
        if (Math.abs(falta) < 0.4) break;
        const f = fd(code);
        if (!f || !f[campo]) continue;
        const nuevo = Math.max(0, Math.min(tope, (gr.get(code) || 0) + falta / (f[campo] / 100)));
        gr.set(code, nuevo);
        falta = objetivo - total(campo);
      }
    }
  }
  const orden = ['proteina', 'carbohidrato', 'fruta', 'grasa', 'verdura'];
  return [...gr.entries()]
    .map(([code, g]) => ({ f: fd(code), g: r5(g) }))
    .filter((x) => x.f && x.g >= (x.f.role === 'grasa' ? 5 : 10))
    .sort((a, b) => orden.indexOf(a.f.role) - orden.indexOf(b.f.role));
}

function diaEjemplo(m, foods) {
  if (!foods?.length) return '';
  const filas = []; const tot = { kcal: 0, p: 0, c: 0, g: 0 };
  for (const cm of COMIDAS) {
    const elegidos = armarComida(cm, {
      p: m.proteina_g * cm.p, c: m.carbohidrato_g * cm.c, g: m.grasa_g * cm.g,
    }, foods);
    if (!elegidos.length) continue;
    const sum = (campo) => elegidos.reduce((a, x) => a + x.g * x.f[campo] / 100, 0);
    const kcal = Math.round(sum('kcal')), pr = Math.round(sum('protein_g'));
    const ca = Math.round(sum('carb_g')), gra = Math.round(sum('fat_g'));
    tot.kcal += kcal; tot.p += pr; tot.c += ca; tot.g += gra;
    filas.push(`<tr>
      <td><b>${esc(cm.nombre)}</b></td>
      <td>${elegidos.map((x) => `${esc(x.g)} g de ${esc(x.f.name_es.toLowerCase())}`).join('<br>')}
        ${cm.verdura ? '<br>verdura libre, la que quieras' : ''}</td>
      <td>${esc(kcal)}</td><td>${esc(pr)} g</td><td>${esc(ca)} g</td><td>${esc(gra)} g</td>
    </tr>`);
  }
  if (!filas.length) return '';
  const usados = [...new Set(COMIDAS.flatMap((c) => [...c.prot, ...c.carb, ...c.gra].map(([k]) => k)))];
  const notas = usados.map((k) => foods.find((f) => f.code === k)).filter((f) => f && f.note)
    .map((f) => `${f.name_es}: ${f.note}`);
  return `<h3>Un día que llega a esos números</h3>
    <p>Es un ejemplo para que veas el tamaño de las porciones, no un menú obligatorio. Los gramos son del alimento
      ya cocido, salvo la avena y la proteína en polvo. Puedes cambiar cualquier alimento por otro del mismo grupo.</p>
    <table><thead><tr><th>Comida</th><th>Qué</th><th>kcal</th><th>Proteína</th><th>Carbos</th><th>Grasa</th></tr></thead>
      <tbody>${filas.join('')}
        <tr><td><b>Total del día</b></td><td>—</td><td><b>${esc(tot.kcal)}</b></td><td><b>${esc(tot.p)} g</b></td><td><b>${esc(tot.c)} g</b></td><td><b>${esc(tot.g)} g</b></td></tr>
        <tr><td>Tu meta</td><td>—</td><td>${num(m.kcal)}</td><td>${num(m.proteina_g)} g</td><td>${num(m.carbohidrato_g)} g</td><td>${num(m.grasa_g)} g</td></tr>
      </tbody></table>
    <p class="vacio small">El total del ejemplo no cae exacto en la meta: las porciones están redondeadas a 5 g para que sean prácticas.</p>
    ${detalle('Equivalencias y notas de porción', `<ul>${notas.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
      <p>Para cambiar un alimento por otro del mismo grupo, iguala los gramos de su macro principal, no el peso del plato.</p>`)}`;
}

function seccionComida(macros, foods, items, n) {
  const propias = items.filter((i) => i.category === 'nutrition');
  if (!macros && !propias.length) return '';
  if (macros && macros.ok === false) {
    return `<h2><b>${n}</b>Comida</h2>
      <div class="rev"><h4>Falta un dato</h4><p>${esc(macros.falta)}</p></div>
      ${propias.length ? tablaIndicaciones(propias) : ''}`;
  }
  const m = macros || {};
  const s = m.supuestos || {};
  const tabla = `<table><thead><tr><th>Al día</th><th>Cuánto</th><th>Cómo se ve</th></tr></thead><tbody>
    <tr><td><b>Calorías</b></td><td>${num(m.kcal)} kcal</td><td>—</td></tr>
    <tr><td><b>Proteína</b></td><td>${num(m.proteina_g)} g <span class="vacio">(${esc(m.proteina_g_kg)} g por kg)</span></td>
        <td>${esc(m.proteina_pct)} % de las calorías · reparte en 4 tomas</td></tr>
    <tr><td><b>Carbohidratos</b></td><td>${num(m.carbohidrato_g)} g</td>
        <td>${esc(m.carbohidrato_pct)} % · ${m.carbos_de_calidad ? 'de fuentes no refinadas, y los más cerca del entrenamiento' : 'preferir grano entero, fruta y leguminosa'}</td></tr>
    <tr><td><b>Grasa</b></td><td>${num(m.grasa_g)} g</td><td>${esc(m.grasa_pct)} % · aceite de oliva, aguacate, nueces, pescado</td></tr>
    <tr><td><b>Fibra</b></td><td>${num(m.fibra_g)} g</td><td>verdura en cada comida, leguminosa, avena</td></tr>
    <tr><td><b>Agua</b></td><td>${num(m.agua_ml)} mL</td><td>unos ${Math.round((m.agua_ml || 0) / 250)} vasos</td></tr>
  </tbody></table>`;
  const supuestos = `<ul>
    <li>Peso ${esc(s.peso_kg)} kg, estatura ${esc(s.estatura_cm)} cm, ${esc(s.edad)} años.</li>
    <li>Gasto en reposo ${num(s.tmb)} kcal por la fórmula ${esc(s.formula)}.</li>
    <li>Se multiplicó por ${esc(s.factor_actividad)} por tu actividad declarada: ${esc(s.actividad_declarada)}. Gasto estimado ${num(s.gasto_estimado)} kcal.</li>
    <li>Ajuste aplicado: ${esc(s.ajuste)}.</li>
    ${s.grasa_corporal_pct != null ? `<li>Grasa corporal medida: ${esc(s.grasa_corporal_pct)} %.</li>` : ''}
    <li>${esc(s.nota)}</li>
  </ul>`;
  return `<h2><b>${n}</b>Comida: a qué le tienes que llegar</h2>
    ${m.aviso_metabolico ? `<div class="rev"><h4>Por qué no subimos las calorías</h4><p>${esc(m.aviso_metabolico)}</p></div>` : ''}
    ${tabla}
    ${detalle('¿De dónde salen estos números?', supuestos)}
    ${diaEjemplo(m, foods)}
    ${propias.length ? `<h3>Indicaciones de tu médico sobre la comida</h3>${tablaIndicaciones(propias)}` : ''}`;
}

function tablaIndicaciones(propios) {
  return `<table><thead><tr><th>Indicación</th><th>Cuándo</th><th>Para qué</th></tr></thead><tbody>
    ${propios.map((i) => `<tr>
      <td><b>${esc(i.title)}</b>${i.instructions ? detalle('Ver detalle', `<p>${esc(i.instructions)}</p>`) : ''}</td>
      <td>${esc([i.timing, i.frequency].filter(Boolean).join(' · ') || '—')}</td>
      <td>${esc(i.rationale || '—')}</td>
    </tr>`).join('')}
  </tbody></table>`;
}

/* ---------- entrenamiento ---------- */
const SEMANA = ['Lunes', 'Martes', 'Miercoles', 'Miércoles', 'Jueves', 'Viernes', 'Sabado', 'Sábado', 'Domingo'];
const ETIQUETA_DIA = { Lunes: 'LUN', Martes: 'MAR', Miercoles: 'MIÉ', 'Miércoles': 'MIÉ', Jueves: 'JUE', Viernes: 'VIE', Sabado: 'SÁB', 'Sábado': 'SÁB', Domingo: 'DOM' };
const FOCO_CORTO = (foco) => {
  const f = String(foco || '').toLowerCase();
  if (f.startsWith('jalon') || f.startsWith('jalón')) return 'JALÓN';
  if (f.startsWith('empuje')) return 'EMPUJE';
  if (f.startsWith('pierna')) return 'PIERNA';
  return foco;
};

function calendario(prog) {
  const dias = prog?.dias || [];
  if (!dias.length) return '';
  const conEntreno = new Map(dias.map((d) => [d.dia, d]));
  const base = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo'];
  return `<div class="semana">${base.map((d) => {
    const e = conEntreno.get(d);
    return `<div class="dia ${e ? 'dia-on' : ''}">
      <span class="dia-ini">${esc(ETIQUETA_DIA[d] || d)}</span>
      <span class="dia-foco">${e ? esc(FOCO_CORTO(e.foco)) : 'Caminar'}</span>
    </div>`;
  }).join('')}</div>`;
}

function seccionEjercicio(prog, items, n) {
  const propios = items.filter((i) => i.category === 'exercise');
  if (!prog?.dias?.length && !propios.length) return '';
  if (!prog?.dias?.length) {
    return `<h2><b>${n}</b>Ejercicio</h2>${tablaIndicaciones(propios)}`;
  }
  const dias = prog.dias.map((d) => `<div class="dia-bloque">
    <h3>${esc(d.dia)} · ${esc(FOCO_CORTO(d.foco))}</h3>
    <p class="vacio small">${esc(d.foco)}</p>
    <table class="ejercicios"><thead><tr><th>Ejercicio</th><th>Series y repeticiones</th><th>Esfuerzo</th></tr></thead><tbody>
      ${(d.ejercicios || []).map((e) => `<tr>
        <td><b>${esc(e.nombre)}</b>
          ${(e.svg || e.como || e.errores) ? detalle('Ver cómo se hace', `
            ${e.svg ? esquemaEjercicio(e.svg) : ''}
            ${e.como ? `<p><b>Cómo se hace:</b> ${esc(e.como)}</p>` : ''}
            ${e.errores ? `<p><b>Errores que hay que evitar:</b> ${esc(e.errores)}</p>` : ''}
            ${e.cuidado ? `<p class="rojo">${esc(e.cuidado)}</p>` : ''}
            ${e.musculos ? `<p class="vacio small">Trabaja: ${esc(e.musculos)}</p>` : ''}`)
            : `<div class="vacio small">${esc(e.musculos || '')}</div>`}
        </td>
        <td>${esc(e.series || '—')}</td>
        <td>${esc(e.rpe || '—')}</td>
      </tr>`).join('')}
    </tbody></table>
  </div>`).join('');

  const cardio = (prog.cardio || []).map((c) => `<tr>
    <td><b>${esc(c.nombre)}</b>${c.como ? detalle('Ver cómo se hace',
      `${c.svg ? esquemaEjercicio(c.svg) : ''}<p>${esc(c.como)}</p>`) : ''}</td>
    <td>${esc(c.series || '—')}</td><td>${esc(c.rpe || '—')}</td>
  </tr>`).join('');

  return `<h2><b>${n}</b>Ejercicio</h2>
    ${prog.requiere_autorizacion ? `<div class="aviso"><h4>Antes de empezar</h4>
      Tu cuestionario de seguridad salió positivo: necesitas que tu médico te autorice antes de entrenar con pesas.</div>` : ''}
    <p class="sub">Tres días de fuerza con un día de descanso entre ellos, y caminata el resto. Programa de nivel ${esc(prog.nivel || '—')}.</p>
    ${calendario(prog)}
    ${dias}
    ${cardio ? `<h3>Cardio y movimiento del resto de la semana</h3>
      <table><thead><tr><th>Qué</th><th>Cuánto</th><th>Intensidad</th></tr></thead><tbody>${cardio}</tbody></table>` : ''}
    ${(prog.notas || []).length ? `<div class="rev"><h4>Cómo seguirlo</h4><ul>
      ${prog.notas.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>` : ''}
    ${propios.length ? `<h3>Indicaciones de tu médico sobre el ejercicio</h3>${tablaIndicaciones(propios)}` : ''}`;
}

/* ---------- sueño y estrés ---------- */
function seccionTips(categoria, titulo, tips, items, cat, n) {
  const propios = items.filter((i) => i.category === cat);
  const propias = (tips || []).filter((t) => t.category === categoria);
  if (!propios.length && !propias.length) return '';
  return `<h2><b>${n}</b>${esc(titulo)}</h2>
    ${propios.length ? tablaIndicaciones(propios) : ''}
    ${propias.length ? `<h3>Lo que más mueve la aguja</h3>
      <div class="tips">${propias.map((t) => `<div class="tip">
        <p class="tip-txt"><b>${esc(t.tip)}</b></p>
        ${t.why ? detalle('¿Por qué?', `<p>${esc(t.why)}</p>`) : ''}
      </div>`).join('')}</div>` : ''}`;
}

const RESTO = [
  ['referral', 'Con quién más te vamos a mandar'],
  ['lab_followup', 'Cuándo repetir estudios'],
  ['other', 'Otros'],
];
function seccionesResto(items, desde) {
  let n = desde;
  const html = RESTO.map(([cat, nombre]) => {
    const propios = items.filter((i) => i.category === cat);
    if (!propios.length) return '';
    n += 1;
    return `<h2><b>${String(n).padStart(2, '0')}</b>${esc(nombre)}</h2>${tablaIndicaciones(propios)}`;
  }).join('');
  return { html, n };
}



/* ---------- hoja ---------- */
function pinta(d) {
  const { plan, items, patient, physician, estudios, macros, foods, programa, tips, patrones } = d;
  const firmado = ['approved', 'delivered'].includes(plan.status);
  const nombre = `${patient?.first_name || ''} ${patient?.last_name || ''}`.trim() || 'Paciente';
  const e = edad(patient?.birth_date);

  // Numeracion corrida: cada bloque que existe toma el siguiente numero.
  let n = 1;
  const nn = () => String(++n).padStart(2, '0');
  const sig = () => String(n + 1).padStart(2, '0');
  const blEstudios = estudiosFaltantes(estudios, sig()); if (blEstudios) nn();
  const blHorarios = tablaHorarios(items, sig()); if (blHorarios) nn();
  const blComida = seccionComida(macros, foods, items, sig()); if (blComida) nn();
  const blEjercicio = seccionEjercicio(programa, items, sig()); if (blEjercicio) nn();
  const blSueno = seccionTips('sueno', 'Sueño', tips, items, 'sleep', sig()); if (blSueno) nn();
  const blEstres = seccionTips('estres', 'Manejo del estrés', tips, items, 'stress', sig()); if (blEstres) nn();
  const resto = seccionesResto(items, n);
  n = resto.n;

  root.innerHTML = `<div class="sheet">
    ${firmado ? '' : '<div class="watermark">BORRADOR<br>REVISIÓN MÉDICA</div>'}
    <header>
      <img src="assets/brand/logo-horizontal.svg" alt="RenovitIA">
      <div class="meta">
        Tu plan · versión ${esc(plan.version)}<br>
        ${fecha(plan.created_at)}<br>
        ${plan.review_date ? `Próximo control: ${fecha(plan.review_date)}` : ''}
        <div class="estado ${firmado ? 'firmado' : 'borrador'}">${firmado ? 'FIRMADO POR TU MÉDICO' : 'BORRADOR · SIN FIRMA'}</div>
      </div>
    </header>

    <h1>Tu plan</h1>
    <p class="sub">${esc(plan.summary || 'Qué encontramos en tus estudios, qué vamos a hacer y cómo vamos a medir si funcionó.')}</p>

    <div class="ficha">
      <div><span>Paciente</span>${esc(nombre)}</div>
      <div><span>Edad / sexo</span>${e != null ? `${e} años` : '—'} · ${patient?.sex_at_birth === 'F' ? 'Femenino' : patient?.sex_at_birth === 'M' ? 'Masculino' : '—'}</div>
      <div><span>Arranca</span>${fecha(plan.start_date)}</div>
      <div><span>Estado</span>${firmado ? 'Firmado' : 'Pendiente de firma'}</div>
    </div>

    <div class="objetivo"><b>Lo que tú quieres lograr:</b> ${esc(plan.ai_draft?.objetivos || 'sin objetivos capturados')}</div>

    ${loQueEncontramos(plan, patrones)}

    ${blEstudios}
    ${blHorarios}
    ${blComida}
    ${blEjercicio}
    ${blSueno}
    ${blEstres}
    ${resto.html}

    ${items.length ? '' : '<p class="vacio">Tu médico todavía no captura las indicaciones. Esta hoja se completa antes de entregarse.</p>'}

    ${plan.physician_notes ? `<h2><b>${nn()}</b>Notas de tu médico</h2><p>${esc(plan.physician_notes)}</p>` : ''}

    <div class="aviso">
      <h4>Importante</h4>
      Esta hoja sale de tus estudios y de lo que contestaste. No sustituye la consulta. No cambies por tu cuenta
      ninguna dosis, suplemento, medicamento u hormona: háblalo con tu médico. Si algo te cae mal o sientes algo
      raro, repórtalo de inmediato.
    </div>

    <h2>Firma de tu médico</h2>
    <div class="firma">
      ${firmado
        ? `<p><b>${esc(physician?.full_name || 'Médico responsable')}</b><br>
           ${esc(physician?.specialty || '')}${physician?.cedula_profesional ? ` · Cédula ${esc(physician.cedula_profesional)}` : ''}<br>
           Firmado el ${fecha(plan.signed_at)}</p>
           ${plan.ai_draft?.firmado_con_dosis_no_auditable
             ? `<p class="rojo">Firmado reconociendo ${plan.ai_draft.firmado_con_dosis_no_auditable.renglones} renglón(es) sin dosis auditable: ${esc((plan.ai_draft.firmado_con_dosis_no_auditable.titulos || []).join(', '))}.</p>`
             : ''}`
        : `<p>Este plan sólo puede entregarse después de la firma del médico.
           Al firmarse desaparece la marca de agua.</p>
           <div class="lineas">
             <div>Nombre del médico</div><div>Cédula profesional / especialidad</div>
             <div>Firma</div><div>Fecha de aprobación</div>
           </div>`}
    </div>

    <footer>
      <span>${firmado ? 'Documento firmado · RenovitIA' : 'BORRADOR INTERNO · SIN FIRMA MÉDICA · NO ENTREGAR AL PACIENTE'}</span>
      <span>${esc(nombre)}</span>
    </footer>
  </div>`;
}

cargar().then(pinta).catch((e) => {
  root.innerHTML = `<div class="msg"><h2>No se pudo abrir el plan</h2><p>${esc(e.message)}</p></div>`;
});
