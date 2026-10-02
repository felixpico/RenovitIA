// Hoja imprimible del plan funcional. Mientras no esté firmado lleva marca de agua
// y la leyenda de que no se entrega al paciente.
import { supabase } from './supabase.js';

const root = document.getElementById('root');
document.getElementById('print').addEventListener('click', () => window.print());
document.getElementById('back').addEventListener('click', (e) => { if (history.length > 1) { e.preventDefault(); history.back(); } });

const id = new URLSearchParams(location.search).get('id');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fecha = (d) => (d ? new Date(d).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }) : '—');
const edad = (d) => { if (!d) return null; const b = new Date(d); const n = new Date(); let a = n.getFullYear() - b.getFullYear(); if (n < new Date(n.getFullYear(), b.getMonth(), b.getDate())) a--; return a; };

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

const SECCIONES = [
  ['peptide', 'Protocolo de péptidos'],
  ['medication', 'Medicamentos'],
  ['supplement', 'Suplementos'],
  ['nutrition', 'Alimentación'],
  ['exercise', 'Ejercicio'],
  ['sleep', 'Sueño'],
  ['stress', 'Manejo del estrés'],
  ['referral', 'Interconsultas'],
  ['lab_followup', 'Monitoreo y control'],
  ['other', 'Otros'],
];

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
  return { plan, items: it.data || [], patient: pa.data, physician: ph.data };
}


const SISTEMA = {
  cardiovascular: 'Metabolismo lipídico y riesgo cardiovascular', metabolico: 'Glucosa e insulina',
  hepatico: 'Hígado', renal: 'Función renal e hidratación', inflamacion: 'Inflamación',
  hormonal: 'Eje hormonal', tiroides: 'Tiroides', nutrientes: 'Nutrientes y minerales',
  hematologia: 'Hematología', general: 'Visión general',
};
const SEV = { actuar: 'rojo', vigilar: 'amarillo', informativo: '' };

function interpretacion(plan) {
  const lista = plan.ai_draft?.interpretacion || [];
  if (!lista.length) return '';
  const sistemas = [...new Set(lista.map((x) => x.sistema))];
  const bloques = sistemas.map((sis) => {
    const items = lista.filter((x) => x.sistema === sis);
    return `<h3>${esc(SISTEMA[sis] || sis)}</h3>` + items.map((x) => {
      const vals = Object.entries(x.valores || {}).map(([k, v]) => `${esc(k)} ${esc(v)}`).join(' · ');
      const sev = SEV[x.severidad] || '';
      return `<div class="interp">
        <p class="interp-tit"><b class="${sev}">${esc(x.titulo)}</b>
          ${x.evidencia ? `<span class="ev">evidencia ${esc(x.evidencia)}</span>` : ''}
          ${x.firmado ? '' : '<span class="ev sin">patrón sin firma</span>'}</p>
        <p>${esc(x.interpretacion)}</p>
        ${x.correlacionar ? `<p class="vacio"><b>Qué correlacionar:</b> ${esc(x.correlacionar)}</p>` : ''}
        ${vals ? `<p class="vacio small">Se disparó por: ${vals}</p>` : ''}
      </div>`;
    }).join('');
  }).join('');
  return `<h2><b>00</b>Interpretación por sistemas</h2>
    <p class="sub">Cada párrafo se generó porque los valores de este paciente cumplen su condición. Si la condición no se cumple, el párrafo no aparece.</p>
    ${bloques}`;
}

function tablaHallazgos(d) {
  const h = (d.ai_draft?.hallazgos || []).filter((x) => x.color === 'rojo');
  const a = (d.ai_draft?.hallazgos || []).filter((x) => x.color === 'amarillo');
  if (!h.length && !a.length) return '<p class="vacio">Ningún marcador fuera de rango óptimo en este panel.</p>';
  const fila = (x) => `<tr>
      <td><b>${esc(x.marcador)}</b>${x.critico ? ' <span class="rojo">· CRÍTICO</span>' : ''}</td>
      <td class="${esc(x.color)}">${esc(x.valor)} ${esc(x.unidad || '')} ${x.direccion === 'alto' ? '▲' : x.direccion === 'bajo' ? '▼' : ''}</td>
      <td>${esc(x.evidencia || '—')}</td>
    </tr>`;
  return `<table><thead><tr><th>Marcador</th><th>Valor</th><th>Evidencia</th></tr></thead><tbody>
    ${h.map(fila).join('')}${a.map(fila).join('')}</tbody></table>`;
}

function tablaMetas(d) {
  const m = d.ai_draft?.metas || [];
  if (!m.length) return '';
  return `<h3>Objetivos medibles a 8–12 semanas</h3>
    <table><thead><tr><th>Marcador</th><th>Valor actual</th><th>Meta</th></tr></thead><tbody>
    ${m.map((x) => `<tr><td>${esc(x.marcador)}</td><td>${esc(x.actual)}</td><td>${esc(x.meta)}</td></tr>`).join('')}
    </tbody></table>`;
}

function cajaRevision(lista, titulo = 'Para revisión del médico') {
  if (!lista?.length) return '';
  return `<div class="rev"><h4>${esc(titulo)}</h4><ul>${lista.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>`;
}

function secciones(items) {
  let n = 1;
  return SECCIONES.map(([cat, nombre]) => {
    const propios = items.filter((i) => i.category === cat);
    if (!propios.length) return '';
    n += 1;
    const sinDosis = propios.filter((i) => ['supplement', 'peptide', 'medication'].includes(i.category) && !dosisOk(i.dose, i.reconstitution));
    const muestraDosis = ['supplement', 'peptide', 'medication'].includes(cat);
    return `<h2><b>${String(n).padStart(2, '0')}</b>${esc(nombre)}</h2>
      <table><thead><tr>
        <th>${muestraDosis ? 'Qué' : 'Indicación'}</th>
        ${muestraDosis ? '<th>Dosis</th>' : ''}
        <th>Horario / frecuencia</th><th>Para qué</th></tr></thead><tbody>
        ${propios.map((i) => `<tr>
          <td><b>${esc(i.title)}</b>${i.instructions ? `<br><span class="vacio">${esc(i.instructions)}</span>` : ''}</td>
          ${muestraDosis ? `<td>${dosisOk(i.dose, i.reconstitution) ? esc(i.dose) : `<span class="rojo">${esc(i.dose || 'sin dosis')} ⚠</span>`}${i.reconstitution ? `<br><span class="vacio">${esc(i.reconstitution)}</span>` : ''}</td>` : ''}
          <td>${esc([i.timing, i.frequency].filter(Boolean).join(' · ') || '—')}</td>
          <td>${esc(i.rationale || '—')}</td>
        </tr>`).join('')}
      </tbody></table>
      ${cajaRevision(sinDosis.map((i) => `${i.title}: dosis no auditable. Si va en unidades o mL falta la reconstitución en mg.`))}`;
  }).join('');
}

function pinta(d) {
  const { plan, items, patient, physician } = d;
  const firmado = ['approved', 'delivered'].includes(plan.status);
  const rev = (plan.ai_draft?.revisiones || []);
  const porTipo = (t) => rev.filter((r) => r.tipo === t).map((r) => r.texto);
  const nombre = `${patient?.first_name || ''} ${patient?.last_name || ''}`.trim() || 'Paciente';
  const e = edad(patient?.birth_date);

  root.innerHTML = `<div class="sheet">
    ${firmado ? '' : '<div class="watermark">BORRADOR<br>REVISIÓN MÉDICA</div>'}
    <header>
      <img src="assets/brand/logo-horizontal.svg" alt="RenovitIA">
      <div class="meta">
        Plan funcional y recomposición corporal<br>
        Versión ${esc(plan.version)} · generado ${fecha(plan.created_at)}<br>
        ${plan.review_date ? `Control sugerido: ${fecha(plan.review_date)}` : ''}
        <div class="estado ${firmado ? 'firmado' : 'borrador'}">${firmado ? 'FIRMADO POR MÉDICO' : 'BORRADOR · SIN FIRMA'}</div>
      </div>
    </header>

    <h1>Plan integral de medicina funcional y recomposición corporal</h1>
    <p class="sub">${esc(plan.summary || '')}</p>

    <div class="ficha">
      <div><span>Paciente</span>${esc(nombre)}</div>
      <div><span>Edad / sexo</span>${e != null ? `${e} años` : '—'} · ${patient?.sex_at_birth === 'F' ? 'Femenino' : patient?.sex_at_birth === 'M' ? 'Masculino' : '—'}</div>
      <div><span>Inicio</span>${fecha(plan.start_date)}</div>
      <div><span>Estado</span>${firmado ? 'Firmado' : 'Pendiente de firma'}</div>
    </div>

    <div class="objetivo"><b>Objetivo del paciente:</b> ${esc(plan.ai_draft?.objetivos || 'sin objetivos capturados')}</div>

    ${interpretacion(plan)}

    <h2><b>01</b>Hallazgos del panel</h2>
    ${tablaHallazgos(plan)}
    ${tablaMetas(plan)}
    ${cajaRevision([...porTipo('critico'), ...porTipo('unidad'), ...porTipo('rango_sin_firma')])}
    ${cajaRevision(porTipo('sin_confirmar'), 'Valores leídos de archivos, sin confirmar')}

    ${secciones(items)}

    ${items.length ? '' : '<h2><b>02</b>Indicaciones</h2><p class="vacio">El generador no propone tratamiento. Las indicaciones las captura el médico en el panel antes de firmar.</p>'}

    ${plan.physician_notes ? `<h2><b>09</b>Notas del médico</h2><p>${esc(plan.physician_notes)}</p>` : ''}

    <div class="aviso">
      <h4>Advertencia</h4>
      Este documento se genera a partir del panel de laboratorio y de lo que el paciente contestó. No sustituye la
      evaluación, prescripción ni el seguimiento de un médico. Todo cambio de suplementación, medicación u hormonas
      debe hacerse bajo supervisión médica. Reportar cualquier efecto adverso de inmediato.
    </div>

    <h2><b>10</b>Revisión y firma</h2>
    <div class="firma">
      ${firmado
        ? `<p><b>${esc(physician?.full_name || 'Médico responsable')}</b><br>
           ${esc(physician?.specialty || '')}${physician?.cedula_profesional ? ` · Cédula ${esc(physician.cedula_profesional)}` : ''}<br>
           Firmado el ${fecha(plan.signed_at)}</p>
           ${plan.ai_draft?.firmado_con_dosis_no_auditable
             ? `<p class="rojo">Firmado reconociendo ${plan.ai_draft.firmado_con_dosis_no_auditable.renglones} renglón(es) sin dosis auditable: ${esc((plan.ai_draft.firmado_con_dosis_no_auditable.titulos || []).join(', '))}.</p>`
             : ''}`
        : `<p>Este plan sólo puede entregarse al paciente después de la firma del médico.
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
