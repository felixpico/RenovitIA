// Modulo de paciente en dos pestanas: "Hoy" y "Mi salud".
// Reglas que no se rompen:
//  - Lo que se palomea se guarda por id del renglon del protocolo, no por nombre.
//  - El semaforo y los resultados solo aparecen si el medico libero estudios (lo
//    impone la RLS, aqui solo se dibuja el estado vacio con dignidad).
//  - Nada se presenta como "firmado" si el protocolo no esta en delivered.
import { supabase } from './supabase.js';
import { tocaHoy } from './franjas.js';
// El dia se dibuja en dia.js, que comparten esta pantalla y la vista previa con
// la que la medica firma. Si el HTML viviera aqui, la previa seria otro dibujo
// y acabaria mintiendo.
import { PALOMA, etiquetas, chipsDias, botonJeringa, tomasDeItems, htmlDia,
  ejerciciosDeHoy, bloquesDe, htmlEntreno } from './dia.js';
import { montarBiblioteca } from './biblioteca.js';
import { abrirSeccion, cerrarSeccion } from './secciones.js';
import {
  hoyISO, etiquetaDias, mgDeUnidades, mlDeUnidades, concentracion,
  textoMg, textoMl, textoConc, jeringaVertical,
} from './peptido.js';

const $ = (id) => document.getElementById(id);
const CON_TOMA = ['supplement', 'peptide', 'medication'];
const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const ENTRENO_IMG = {
  jalon: 'assets/img/entreno/dia1-jalon.webp',
  empuje: 'assets/img/entreno/dia3-empuje.webp',
  pierna: 'assets/img/entreno/dia2-pierna.webp',
};

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const S = { paciente: null, plan: null, items: [], fecha: iso(new Date()),
            registro: null, guardando: false, pendiente: false, periodico: {}, resumen: null,
            horas: null, programa: null, ejercicios: [] };

/* ---------------- pestanas ---------------- */
export function montarTabs() {
  const barra = $('tabbar');
  if (!barra) return;
  barra.classList.remove('hidden');
  document.body.classList.add('con-tabs');
  barra.querySelectorAll('.tb').forEach((b) => {
    b.addEventListener('click', () => {
      const id = b.dataset.pg;
      document.querySelectorAll('.pg').forEach((p) => p.classList.toggle('on', p.id === `pg-${id}`));
      barra.querySelectorAll('.tb').forEach((x) => {
        x.classList.toggle('on', x === b);
        x.setAttribute('aria-pressed', x === b ? 'true' : 'false');
      });
      scrollTo({ top: 0 });
    });
  });

  // El "+" se engancha una sola vez. pintarPaciente() vuelve a llamar aqui cada
  // vez que el plan cambia, y sin esta bandera el boton acumularia un listener
  // por repintado: al tercer cambio de plan abriria tres hojas encimadas.
  const mas = $('btn-mas');
  if (mas && !mas.dataset.listo) {
    mas.dataset.listo = '1';
    mas.addEventListener('click', abrirRapidas);
  }

  // La biblioteca se arma la PRIMERA vez que se abre la pestana, no al cargar
  // la app: son tres catalogos y el paciente entra a ver su dia, no a leer.
  const tbBiblio = barra.querySelector('.tb[data-pg="biblio"]');
  if (tbBiblio && !tbBiblio.dataset.listo) {
    tbBiblio.dataset.listo = '1';
    tbBiblio.addEventListener('click', () => {
      const caja = $('biblio-contenido');
      if (!caja || caja.dataset.puesta) return;
      caja.dataset.puesta = '1';
      montarBiblioteca(caja, { enPlan: estaEnMiPlan });
    });
  }
}

// Solo 85 de 291 renglones de plan traen catalog_code, asi que el codigo se
// intenta primero y el nombre despues. Sin acentos y sin parentesis: en el plan
// dice "Omega-3 (EPA + DHA)" y en el catalogo "Omega 3".
const plano = (t) => String(t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();

function estaEnMiPlan(f) {
  if (f.ambito !== 'supplement' && f.ambito !== 'peptide') return false;
  const nombre = plano(f.nombre);
  return (S.items || []).some((i) => {
    if (i.catalog_code && String(i.catalog_code) === String(f.code)) return true;
    const t = plano(i.title);
    return !!t && !!nombre && (t === nombre || t.startsWith(nombre) || nombre.startsWith(t));
  });
}

// Regresar desde una seccion tambien restaura el encabezado de Mi salud.
document.addEventListener('click', (e) => {
  if (e.target.closest('.det-bk')) {
    document.getElementById('salud-hero')?.classList.remove('hidden');
    cerrarSeccion();
  }
});

/* ---------------- Hoy ---------------- */

// Un renglon periodico que ya se aplico y todavia no le toca NO entra en la
// lista del dia, ni cuenta en el anillo. Antes la Retatrutida aparecia sin
// palomear los siete dias de la semana, aunque el paciente ya se la hubiera
// puesto.
// El dia de entrenamiento que toca hoy, si toca alguno. Se usa en dos lugares
// -el anillo y la tarjeta-, asi que vive aqui y no dentro del dibujo.
const sinAcento = (t) => String(t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
function entrenoDeHoy() {
  const hoy = DIAS[new Date(`${S.fecha}T12:00:00`).getDay()];
  return (S.programa?.dias || []).find((d) => sinAcento(d.dia) === sinAcento(hoy)) || null;
}

function esPeriodico(i) { return !!S.periodico[i.id]; }
function tocaPeriodico(i) { return S.periodico[i.id]?.toca_hoy !== false; }

function delDia() {
  const f = new Date(`${S.fecha}T12:00:00`);
  return S.items.filter((i) => {
    if (esPeriodico(i)) return tocaPeriodico(i);
    const t = tocaHoy(i, f);
    return t === 'alterno' ? true : t;
  });
}

function periodicosHechos() {
  return S.items.filter((i) => esPeriodico(i) && !tocaPeriodico(i));
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
// Dos formatos a proposito: uno va a media frase y otro en una etiqueta
// angosta. Recortar con split() dejaba "Martes 24 de".
// Sin fecha se dice "—", no "undefined NaN de noviembre". Un renglon roto en la
// pantalla del paciente le quita credibilidad a los que si estan bien.
const valida = (d) => d && !Number.isNaN(new Date(`${d}T12:00:00`).getTime());
const FECHA_LARGA = (d) => {
  if (!valida(d)) return '—';
  const f = new Date(`${d}T12:00:00`);
  return `${DIAS[f.getDay()].toLowerCase()} ${f.getDate()} de ${MESES[f.getMonth()]}`;
};
const FECHA_CORTA = (d) => {
  if (!valida(d)) return '—';
  const f = new Date(`${d}T12:00:00`);
  return `${DIAS[f.getDay()]} ${f.getDate()}`;
};

/* ---------- resumen del dia ----------
   Regla dura: la tarjeta SIN dato no se dibuja. Nunca un guion, nunca un cero
   inventado. Quien no trae reloj ve una pantalla mas corta que sigue teniendo
   sentido, no una rejilla rota.                                              */
const hhmm = (min) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`;
const miles = (n) => Number(n).toLocaleString('es-MX');

function tarjeta(titulo, valor, unidad, pill, nota) {
  return `<div class="rs-c"><h4>${esc(titulo)}</h4>
    <div class="rs-n">${valor}${unidad ? `<small>${esc(unidad)}</small>` : ''}</div>
    ${pill ? `<span class="rs-p ${pill[0]}">${esc(pill[1])}</span>` : ''}
    ${nota ? `<p class="rs-s">${nota}</p>` : ''}</div>`;
}

function tarjetasResumen(r) {
  if (!r) return '';
  const t = [];

  if (r.sueno?.min) {
    const e = r.sueno.eficiencia;
    const pill = e == null ? null
      : e >= 85 ? ['v', `${Math.round(e)}% eficiencia`]
      : ['a', `${Math.round(e)}% eficiencia`];
    const desp = r.sueno.despierto_min >= 45
      ? `${hhmm(r.sueno.despierto_min)} despierto.` : '';
    const vs = r.sueno.media_min
      ? `Media ${hhmm(r.sueno.media_min)} h.` : '';
    t.push(tarjeta('Anoche', hhmm(r.sueno.min), 'h', pill, `${desp} ${vs}`.trim()));
  }

  if (r.actividad?.pasos != null) {
    const m = r.actividad.media_pasos;
    const pill = !m ? null
      : r.actividad.pasos >= m * 0.9 ? ['v', 'En tu media'] : ['a', 'Bajo tu media'];
    t.push(tarjeta('Pasos', miles(r.actividad.pasos), '', pill,
      m ? `Tu media: ${miles(m)}.` : ''));
  }

  if (r.alimentacion) {
    const n = r.alimentacion.comidas || 0;
    // Sin meta medica no se inventa una. Se dice lo que hay: gramos y cuantas comidas.
    t.push(tarjeta('Proteína', n ? miles(r.alimentacion.proteina_g) : '—', n ? 'g' : '',
      n ? null : ['a', 'Sin registrar'],
      n ? `En ${n} ${n === 1 ? 'comida' : 'comidas'} de hoy.`
        : 'Hoy no has registrado nada.'));
  }

  if (r.recuperacion?.pct != null) {
    const v = r.recuperacion.pct;
    const pill = v >= 67 ? ['v', 'Buena'] : v >= 34 ? ['a', 'Media'] : ['r', 'Baja'];
    t.push(tarjeta('Recuperación', Math.round(v), '%', pill,
      r.recuperacion.fc_reposo ? `Reposo ${r.recuperacion.fc_reposo} lpm.` : ''));
  }

  if (!t.length) return '';
  return `<div class="rs">${t.join('')}</div>`;
}

function tiraSemana(sem) {
  if (!sem) return '';
  const f = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
  const fila = (t, d, pill) => `<div class="sm-f"><span><b>${esc(t)}</b><em>${esc(d)}</em></span>
    <span class="rs-p ${pill[0]}">${esc(pill[1])}</span></div>`;
  let h = '<div class="sm"><h3>Estos 7 días</h3>';
  h += fila('Protocolo', f(sem.dias_con_tomas, 'día con tomas', 'días con tomas'),
    sem.dias_con_tomas >= 6 ? ['v', 'Firme'] : sem.dias_con_tomas >= 3 ? ['a', 'A medias'] : ['r', 'Flojo']);
  h += fila('Entrenamientos', f(sem.entrenos, 'sesión', 'sesiones'),
    sem.entrenos >= 3 ? ['v', 'Bien'] : sem.entrenos >= 1 ? ['a', 'Pocos'] : ['r', 'Ninguno']);
  h += fila('Comidas registradas', f(sem.comidas, 'captura', 'capturas'),
    sem.comidas >= 14 ? ['v', 'Bien'] : sem.comidas >= 5 ? ['a', 'A medias'] : ['r', 'Casi nada']);
  if (sem.dias_reloj) {
    h += fila('Reloj', f(sem.dias_reloj, 'día con datos', 'días con datos'),
      sem.dias_reloj >= 6 ? ['v', 'Al día'] : ['a', 'Con huecos']);
  }
  return `${h}</div>`;
}

const tomasDelDia = () => tomasDeItems(delDia());

function pintarHoy() {
  const caja = $('hoy-contenido');
  const tomas = tomasDelDia();
  const items = delDia();
  // El entrenamiento cuenta en el anillo, ejercicio por ejercicio. Si no
  // contara, el paciente leeria "dia completo" con el entrenamiento sin hacer.
  const ejs = ejerciciosDeHoy(S.ejercicios, new Date(`${S.fecha}T12:00:00`));
  const total = tomas.length + ejs.length;
  const hechos = tomas.filter((t) => S.registro.supplements_taken?.[t.llave]).length
    + ejs.filter((i) => S.registro.supplements_taken?.[i.id]).length;
  const pct = total ? hechos / total : 0;
  const R = 44, C = 2 * Math.PI * R;

  let html = `
    <div class="card anillo-caja">
      <div class="anillo">
        <svg width="100" height="100" aria-hidden="true">
          <circle cx="50" cy="50" r="${R}" fill="none" stroke="var(--surface-2)" stroke-width="11"/>
          <circle cx="50" cy="50" r="${R}" fill="none" stroke="var(--brand)" stroke-width="11"
                  stroke-linecap="round" stroke-dasharray="${C.toFixed(1)}"
                  stroke-dashoffset="${(C * (1 - pct)).toFixed(1)}"/>
        </svg>
        <div class="ctr"><div class="n">${hechos}<small>/${total}</small></div><div class="u">HOY</div></div>
      </div>
      <div>
        <strong style="font-size:16.5px">${hechos === total && total ? '¡Día completo!' : hechos ? 'Vas avanzando' : 'Empecemos'}</strong>
        <p class="muted small" style="margin:3px 0 0">${total - hechos > 0
          ? `Te ${total - hechos === 1 ? 'falta' : 'faltan'} ${total - hechos} de ${total}${hayEntreno ? ', con el entrenamiento' : ''}.`
          : 'Palomeaste todo lo de hoy.'}</p>
      </div>
    </div>` + tarjetasResumen(S.resumen);

  html += htmlDia(tomas, {
    hechas: S.registro.supplements_taken,
    horas: S.horas,
    periodico: S.periodico,
  });

  html += htmlEntreno(bloquesDe(ejs), { hechas: S.registro.supplements_taken });

  // Si simplemente se oculta, el paciente cree que se perdio su inyeccion.
  // Se muestra hecha, con la fecha de la siguiente.
  const hechos2 = periodicosHechos();
  if (hechos2.length) {
    html += '<div class="fr"><h3>Ya aplicado</h3><div class="lista">';
    hechos2.forEach((i) => {
      const per = S.periodico[i.id];
      html += `<div class="it on listo"><span class="cb">${PALOMA}</span>
        <span class="nm"><b>${esc(i.title)}${etiquetas(i)}</b>
          <span>Te la pusiste el ${esc(FECHA_LARGA(per.ultima))}</span></span>
        <span class="prox">Siguiente<b>${esc(FECHA_CORTA(per.proxima))}</b></span></div>`;
      html += chipsDias(i);
    });
    html += '</div></div>';
  }

  html += tiraSemana(S.resumen?.semana);

  caja.innerHTML = html;
  caja.querySelectorAll('.it:not(.listo):not([data-ej])').forEach((b) => b.addEventListener('click', () => alternar(b)));
  // El ejercicio se palomea con el mismo gesto y se guarda en la misma llave
  // que un suplemento: supplements_taken es "lo hecho del dia", no solo pastillas.
  caja.querySelectorAll('.it[data-ej]').forEach((b) => b.addEventListener('click', () => alternarEjercicio(b)));
  caja.querySelectorAll('.pep-ver').forEach((b) => b.addEventListener('click', () => {
    const it = (S.items || []).find((x) => x.id === b.dataset.pep);
    if (it) abrirJeringa(it);
  }));
  pintarEntreno();
}

/* ---------- péptidos en unidades ---------- */
function abrirJeringa(i) {
  const un = Number(i.dose_un);
  const mg = mgDeUnidades({ un, vial_mg: i.vial_mg, vial_ml: i.vial_ml, jeringa: i.syringe });
  const ml = mlDeUnidades(un, i.syringe);
  const dias = etiquetaDias((i.days_of_week || []).map(Number));
  const hoy = hoyISO();

  const fondo = document.createElement('div');
  fondo.className = 'jer-fondo';
  fondo.innerHTML = `<div class="jer-hoja" role="dialog" aria-modal="true" aria-label="Dosis de ${esc(i.title)}">
    <div class="jer-asa"></div>
    <div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:14px">
      <h2 style="margin:0;font-size:19px;font-weight:700">${esc(i.title)}</h2>
      <button type="button" id="jer-x" style="font:inherit;font-size:13.5px;font-weight:600;color:var(--muted);background:none;border:0;cursor:pointer">Cerrar</button>
    </div>
    <div class="jer-fila">
      ${jeringaVertical(un, i.syringe)}
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:12px">
        <div>
          <div style="display:flex;align-items:baseline;gap:7px">
            <span class="jer-num">${un}</span>
            <span style="font-size:17px;font-weight:700;color:var(--muted)">UN</span>
          </div>
          <p style="margin:5px 0 0;font-size:14px;line-height:1.4">Jala el émbolo hasta la <b style="color:#c0521a">raya naranja</b>.</p>
        </div>
        <div class="jer-eq">Son <b>${esc(textoMl(ml))}</b><br>= <b>${esc(textoMg(mg))}</b> de ${esc(i.title)}</div>
        <p class="muted small" style="margin:0">Jeringa <b>${esc(i.syringe)}</b>. Si la tuya dice otra cosa, no la uses.</p>
      </div>
    </div>
    <div class="jer-ojo"><b>Tu vial dice ${esc(String(i.vial_mg))} mg en ${esc(String(i.vial_ml))} mL</b>
      (${esc(textoConc(concentracion(i.vial_mg, i.vial_ml)))}). Compruébalo en la etiqueta antes de cargar.
      Si el tuyo dice otra cosa, <b>no te la pongas</b>: las mismas ${un} unidades serían otra dosis.
      Avísale a tu médica desde Dudas y mensajes.</div>
    ${dias ? `<div style="margin-top:14px">
      <p class="muted small" style="margin:0 0 7px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">Tus días</p>
      ${chipsDias(i)}
      ${(i.days_of_week || []).map(Number).includes(hoy) ? '<p class="muted small" style="margin:6px 0 0">Hoy te toca.</p>' : ''}
    </div>` : ''}
  </div>`;

  const cerrar = () => fondo.remove();
  fondo.addEventListener('click', (e) => { if (e.target === fondo) cerrar(); });
  fondo.querySelector('#jer-x').addEventListener('click', cerrar);
  document.body.append(fondo);
}

async function alternar(btn) {
  const id = btn.dataset.id;
  if (!S.registro.supplements_taken) S.registro.supplements_taken = {};
  const nuevo = !S.registro.supplements_taken[id];
  if (nuevo) S.registro.supplements_taken[id] = new Date().toISOString();
  else delete S.registro.supplements_taken[id];
  btn.classList.toggle('on', nuevo);
  btn.setAttribute('aria-pressed', nuevo ? 'true' : 'false');

  const per = S.periodico[id];
  if (per && nuevo) {
    // Al marcarla, pasa a "ya aplicado" en el momento, con su proxima fecha.
    // El calculo es el mismo que hace el servidor, asi que no hace falta ir.
    const prox = new Date(`${S.fecha}T12:00:00`);
    prox.setDate(prox.getDate() + per.intervalo);
    S.periodico[id] = { ...per, ultima: S.fecha, dias_desde: 0, atraso: 0,
      toca_hoy: false, proxima: iso(prox) };
  }
  pintarHoy();
  guardar();

  // Al desmarcarla hay que volver a buscar cual fue la anterior: eso no se
  // puede calcular aqui.
  if (per && !nuevo) {
    const { data } = await supabase.rpc('estado_periodico', { p_patient: S.paciente.id });
    S.periodico = data || {};
    pintarHoy();
  }
}

let temporizador = null;
function guardar() { clearTimeout(temporizador); temporizador = setTimeout(escribir, 600); }
async function escribir() {
  if (S.guardando) { S.pendiente = true; return; }
  S.guardando = true;
  try {
    await supabase.from('daily_checkins').upsert({
      patient_id: S.paciente.id,
      checkin_date: S.fecha,
      supplements_taken: S.registro.supplements_taken || {},
      // La columna `trained` existia desde el principio y NADIE la escribia:
      // 0 de 11 registros la traian. El entrenamiento era la unica parte del
      // plan sin forma de decir "ya".
      trained: S.registro.trained ?? null,
    }, { onConflict: 'patient_id,checkin_date' });
  } catch (e) { console.error(e); }
  finally {
    S.guardando = false;
    if (S.pendiente) { S.pendiente = false; escribir(); }
  }
}

// El programa CABLEADO en programa_entrenamiento sigue aqui como red: si el
// plan todavia no trae renglones de ejercicio, el paciente ve su rutina igual
// que antes. En cuanto la medica aplica una plantilla, los renglones del plan
// mandan y esto deja de dibujarse. Asi nadie se queda sin rutina en la
// migracion, que era el riesgo real de apagar la funcion de golpe.
function pintarEntreno() {
  const delPlan = ejerciciosDeHoy(S.ejercicios, new Date(`${S.fecha}T12:00:00`));
  if (delPlan.length) {
    // La guia ilustrada sigue valiendo: se dibuja arriba de los renglones.
    const b = (delPlan[0].bloque || '').toLowerCase();
    const k = b.includes('jal') ? 'jalon' : b.includes('empuj') ? 'empuje'
      : b.includes('pierna') ? 'pierna' : null;
    if (!k) return;
    const fr = $('hoy-contenido').querySelector(`.fr[data-bloque]`);
    if (!fr || fr.querySelector('.entreno')) return;
    const img = document.createElement('div');
    img.className = 'entreno';
    img.innerHTML = `<img src="${ENTRENO_IMG[k]}" alt="Guía ilustrada del día de ${k}" loading="lazy" width="822" height="900">`;
    fr.insertBefore(img, fr.querySelector('.lista'));
    return;
  }

  const dia = entrenoDeHoy();
  if (!dia) return;

  const foco = (dia.foco || '').toLowerCase();
  const clave = foco.includes('jalon') ? 'jalon' : foco.includes('empuje') ? 'empuje'
    : foco.includes('pierna') ? 'pierna' : null;

  const ejs = (dia.ejercicios || []).map((e) =>
    `<div><b>${esc(e.nombre)}</b><span>${esc(e.series || '')}</span></div>`).join('');

  const hecho = S.registro?.trained === true;
  const div = document.createElement('div');
  div.className = 'fr';
  div.innerHTML = `<h3>Entrenamiento de hoy</h3>
    <div class="entreno${hecho ? ' listo' : ''}">
      ${clave ? `<img src="${ENTRENO_IMG[clave]}" alt="Guía ilustrada del día de ${clave}" loading="lazy" width="822" height="900">` : ''}
      <div class="bd"><div class="nm"><b>${esc(dia.dia)} · ${esc(dia.foco)}</b>
        <div class="sub">${(dia.ejercicios || []).length} ejercicios</div></div></div>
      <div class="ejs">${ejs}</div>
    </div>
    <div class="lista" style="margin-top:8px">
      <button class="it${hecho ? ' on' : ''}" type="button" id="btn-entreno"
              aria-pressed="${hecho ? 'true' : 'false'}">
        <span class="cb">${PALOMA}</span>
        <span class="nm"><b>${hecho ? 'Entrenamiento hecho' : 'Marcar como hecho'}</b>
          <span>${hecho ? '¡Bien! Ya quedó registrado.' : 'Cuando termines, pálomea aquí.'}</span></span>
      </button>
    </div>`;
  $('hoy-contenido').append(div);
  div.querySelector('#btn-entreno').addEventListener('click', () => {
    S.registro.trained = S.registro.trained === true ? false : true;
    guardar();
    pintarHoy();
  });
}

// Palomear un ejercicio. Misma llave que un suplemento, y de paso se mantiene
// `trained` al dia: queda en true cuando TODOS los ejercicios del dia estan
// hechos, para que el panel medico tenga una bandera simple que leer.
function alternarEjercicio(btn) {
  const id = btn.dataset.ej;
  if (!S.registro.supplements_taken) S.registro.supplements_taken = {};
  if (S.registro.supplements_taken[id]) delete S.registro.supplements_taken[id];
  else S.registro.supplements_taken[id] = new Date().toISOString();

  const ejs = ejerciciosDeHoy(S.ejercicios, new Date(`${S.fecha}T12:00:00`));
  S.registro.trained = ejs.length
    ? ejs.every((i) => !!S.registro.supplements_taken[i.id])
    : null;

  guardar();
  pintarHoy();
}

/* ---------------- Registro rápido: el botón "+" ----------------
   Seis cosas, en una hoja que sube desde abajo. El orden no es alfabético: es
   por cuántas veces al día se usa. La comida va primera porque se pide cuatro
   veces; el mensaje va al final porque se usa una vez al mes.

   Todas abren una sección que ya existe. El "+" no es una pantalla nueva: es
   quitar los tres toques que había entre el paciente y la captura. */

const RAPIDAS = [
  ['comida', 'Una comida', 'Foto, código o búsqueda', 'alimentacion', { modo: 'plato' }],
  ['presion', 'Mi presión', 'Foto del baumanómetro', 'presion', null],
  ['bascula', 'Mi peso', 'De tu báscula de casa', 'peso', null],
  ['animo', '¿Cómo te sientes?', 'Ánimo, energía y sueño', 'animo', null],
  ['lab', 'Un estudio', 'Sube un PDF o una foto', 'pendientes', null],
  ['chat', 'Una duda', 'Escríbele a tu médica', 'mensajes', null],
];

const ICO_RAPIDO = {
  bascula: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M7.5 13a4.5 4.5 0 0 1 9 0"/><path d="M12 13l2.5-2.5"/>',
  animo: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0"/><path d="M9 9h.01M15 9h.01"/>',
};

function cerrarRapidas() {
  document.getElementById('hoja-rapidas')?.remove();
  document.removeEventListener('keydown', escRapidas);
}
function escRapidas(e) { if (e.key === 'Escape') cerrarRapidas(); }

function abrirRapidas() {
  if (document.getElementById('hoja-rapidas')) return;
  const fondo = document.createElement('div');
  fondo.className = 'hoja-fondo';
  fondo.id = 'hoja-rapidas';
  fondo.innerHTML = `<div class="hoja" role="dialog" aria-modal="true" aria-label="Registrar algo">
    <span class="hoja-asa"></span>
    <h2>¿Qué quieres registrar?</h2>
    <div class="rapidas">
      ${RAPIDAS.map(([ic, t, sub, sec]) => `
        <button class="rapida" type="button" data-sec="${sec}">
          <span class="ic"><svg viewBox="0 0 24 24">${ICO_RAPIDO[ic] || ICO[ic]}</svg></span>
          <span><b>${esc(t)}</b><span>${esc(sub)}</span></span>
        </button>`).join('')}
    </div>
  </div>`;

  // Tocar el fondo cierra. Tocar la hoja no: sin esto, cada toque dentro de la
  // hoja la cerraría y el paciente nunca llegaría a elegir.
  fondo.addEventListener('click', (e) => { if (e.target === fondo) cerrarRapidas(); });

  fondo.querySelectorAll('[data-sec]').forEach((b, i) => {
    b.addEventListener('click', () => {
      const extra = RAPIDAS[i][4];
      cerrarRapidas();
      // El registro rápido vive en "Hoy", pero las secciones se dibujan en la
      // pestaña "Mi salud". Hay que mover al paciente antes de abrirlas, o la
      // sección se pinta en una pestaña que no está a la vista.
      irATab('salud');
      document.getElementById('salud-hero')?.classList.add('hidden');
      abrirSeccion(b.dataset.sec, S.paciente, extra || undefined);
    });
  });

  document.body.appendChild(fondo);
  document.addEventListener('keydown', escRapidas);
  fondo.querySelector('.rapida')?.focus();
}

function irATab(id) {
  document.querySelectorAll('.pg').forEach((pg) => pg.classList.toggle('on', pg.id === `pg-${id}`));
  document.querySelectorAll('#tabbar .tb').forEach((x) => {
    const suyo = x.dataset.pg === id;
    x.classList.toggle('on', suyo);
    x.setAttribute('aria-pressed', suyo ? 'true' : 'false');
  });
  scrollTo({ top: 0 });
}

/* ---------------- Mi salud ---------------- */
const ICO = {
  plan: '<path d="M9 3h6v3H9z"/><rect x="4" y="5" width="16" height="17" rx="2"/><path d="M8 11h8M8 15h5"/>',
  lab: '<path d="M9 3v7L4 20a2 2 0 0 0 1.7 3h12.6A2 2 0 0 0 20 20l-5-10V3"/><path d="M8 3h8M7.5 14h9"/>',
  pin: '<path d="M12 21v-7"/><path d="M8 3h8l-1 6 3 3H6l3-3z"/>',
  comida: '<path d="M5 3v8a2 2 0 0 0 4 0V3M7 11v10"/><path d="M17 3c-2 0-3 3-3 6s1 4 3 4v8"/>',
  pesa: '<path d="M2 12h3M19 12h3M6 8v8M18 8v8M9 6v12M15 6v12M9 12h6"/>',
  chat: '<path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  grafica: '<path d="M3 3v18h18"/><path d="M7 15l4-5 3 3 5-7"/>',
  perfil: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  presion: '<path d="M12 21s-7-4.6-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.4-7 10-7 10z"/><path d="M8.5 12h2l1-2 1.5 4 1-2h2"/>',
  engrane: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"/>',
};
const acceso = (icono, titulo, sub, sec, cuenta) => `
  <button class="acceso" type="button" data-sec="${sec}">
    <span class="ic"><svg viewBox="0 0 24 24">${ICO[icono]}</svg></span>
    <span class="nm"><b>${esc(titulo)}</b><span>${esc(sub)}</span></span>
    ${cuenta ? `<span class="cuenta">${cuenta}</span>` : '<span class="ch">›</span>'}
  </button>`;

async function pintarSalud(nLab, faltantes) {
  const caja = $('semaforo');
  let estado = null;
  try {
    const { data } = await supabase.rpc('estado_por_sistema', { p_patient: S.paciente.id });
    estado = data;
  } catch (e) { console.error(e); }

  if (!estado?.listo) {
    $('salud-sub').textContent = 'Todavía no hay resultados liberados.';
    caja.innerHTML = `<div class="notice">${esc(estado?.motivo
      || 'Tu médico está revisando tus estudios. En cuanto los libere verás aquí tu estado por sistema.')}</div>`;
  } else {
    $('salud-sub').textContent = `Tu estado por sistema, con ${estado.n_resultados} resultados.`;
    let html = '<div class="sem">';
    (estado.sistemas || []).forEach((s) => {
      html += `<div class="sy ${esc(s.color)}"><b><span class="pt"></span>${esc(s.nombre)}</b>
        <span>${esc(s.resumen || '')}</span></div>`;
    });
    html += '</div>';
    const cv = estado.riesgo_cv;
    if (cv && cv.calculable === false && Array.isArray(cv.falta) && cv.falta.length) {
      html += `<div class="notice" style="margin-top:12px"><strong>Falta un dato.</strong>
        Para calcular tu riesgo cardiovascular nos falta: ${esc(cv.falta.join(', '))}.</div>`;
    }
    caja.innerHTML = html;
  }

  const nav = $('salud-nav');
  nav.innerHTML = [
    acceso('plan', 'Mi protocolo', S.plan ? `Versión ${S.plan.version} · firmado por tu médica`
      : 'Pendiente de firma médica', 'protocolo'),
    acceso('presion', 'Mi presión', 'Tómale foto a tu baumanómetro', 'presion'),
    acceso('lab', 'Mis estudios', nLab ? `${nLab} resultados disponibles` : 'Aún no hay resultados liberados', 'estudios'),
    faltantes ? acceso('pin', 'Estudios pendientes', 'Lo que falta por hacerte', 'pendientes', faltantes) : '',
    acceso('comida', 'Mi alimentación', 'Tus macros y un día de ejemplo', 'alimentacion'),
    acceso('pesa', 'Mi entrenamiento', 'Tu programa de la semana', 'entrenamiento'),
    acceso('chat', 'Dudas y mensajes', 'Escríbele a tu médica', 'mensajes'),
    acceso('grafica', 'Mi avance', 'Peso, cintura y constancia', 'avance'),
    acceso('perfil', 'Mi perfil', 'Tus datos y tu cuenta', 'perfil'),
    acceso('engrane', 'Ajustes', 'Avisos y tu reloj', 'ajustes'),
  ].filter(Boolean).join('');

  nav.querySelectorAll('[data-sec]').forEach((b) => {
    b.addEventListener('click', () => {
      $('salud-hero')?.classList.add('hidden');
      abrirSeccion(b.dataset.sec, S.paciente, S.plan);
    });
  });
}

/* ---------------- arranque ---------------- */
export async function pintarPaciente(patient, extras = {}) {
  S.paciente = patient;
  montarTabs();

  // El resumen se pide en paralelo con el plan: es una sola llamada y sirve
  // aunque todavia no haya protocolo entregado.
  //
  // OJO: supabase.rpc() NO devuelve una promesa, devuelve un thenable que solo tiene
  // .then. Llamarle .catch() directamente revienta con "catch is not a function" y,
  // como pasa antes de dibujar nada, la app se queda cargando para siempre.
  // El resumen es opcional: si falla, la pantalla tiene que seguir funcionando.
  const pedirResumen = async () => {
    try {
      const { data, error } = await supabase.rpc('resumen_hoy', { p_patient: patient.id });
      return error ? null : data;
    } catch (_) { return null; }
  };

  const [{ data: planes }, resumen] = await Promise.all([
    supabase.from('protocols')
      .select('id,version,status,signed_at,start_date')
      .eq('patient_id', patient.id).eq('status', 'delivered')
      .order('version', { ascending: false }),
    pedirResumen(),
  ]);
  S.resumen = resumen || null;

  if (planes?.length) {
    S.plan = planes[0];
    vigilarPlan(patient, extras);
    $('onboarding').classList.add('hidden');
    $('hoy-sub').textContent = 'Esto es lo que te toca hoy.';

    const { data: items } = await supabase.from('protocol_items')
      .select('id,category,title,dose,reconstitution,timing,frequency,instructions,sort_order,dose_un,vial_mg,vial_ml,syringe,days_of_week,slots,catalog_code,series,reps,rpe,descanso,bloque')
      .eq('protocol_id', S.plan.id).eq('is_active', true).order('sort_order');
    S.items = (items || []).filter((i) => CON_TOMA.includes(i.category));
    // El ejercicio es un renglon del plan como cualquier otro. Antes se
    // filtraba y desaparecia, y la rutina venia de una funcion cableada aparte.
    S.ejercicios = (items || []).filter((i) => i.category === 'exercise');
    // El patron muscular se hereda del catalogo, no se guarda en el renglon:
    // asi no puede contradecir al ejercicio.
    const codigos = [...new Set(S.ejercicios.map((i) => i.catalog_code).filter(Boolean))];
    if (codigos.length) {
      const { data: cat } = await supabase.from('catalog_exercises')
        .select('code,pattern,primary_muscles,how_to,cautions,common_errors,equipment')
        .in('code', codigos);
      const porCodigo = Object.fromEntries((cat || []).map((c) => [c.code, c]));
      S.ejercicios.forEach((i) => {
        const c = porCodigo[i.catalog_code];
        if (c) { i.patron_es = c.pattern; i.catalogo = c; }
      });
    }

    // Las horas de cada franja viven en los recordatorios del paciente: son
    // las suyas, las que ya configuro. Si falla, la pantalla se dibuja sin hora.
    const { data: rec } = await supabase.from('patient_reminders').select('horas')
      .eq('patient_id', patient.id).maybeSingle();
    S.horas = rec?.horas || null;

    const { data: reg } = await supabase.from('daily_checkins').select('*')
      .eq('patient_id', patient.id).eq('checkin_date', S.fecha).maybeSingle();
    S.registro = reg || { supplements_taken: {} };
    if (!S.registro.supplements_taken) S.registro.supplements_taken = {};

    // Lo que no se toma a diario (la inyeccion semanal, el hierro en dias
    // alternos) no se puede resolver con el palomeo del dia: el check-in se
    // guarda por fecha, asi que marcar el martes no se ve el miercoles.
    const { data: per } = await supabase.rpc('estado_periodico', { p_patient: patient.id });
    S.periodico = per || {};

    // El programa se carga ANTES de pintar. Antes se pedia dentro de
    // pintarEntreno(), que corre despues, y por eso el anillo no podia contar
    // el entrenamiento: ya estaba dibujado cuando llegaba la respuesta.
    try {
      const { data: prog } = await supabase.rpc('programa_entrenamiento', { p_patient: patient.id });
      S.programa = prog || null;
    } catch (_) { S.programa = null; }

    pintarHoy();
  } else {
    $('hoy-sub').textContent = 'Aquí verás tus tomas diarias cuando tu médico entregue tu plan.';
    // Sin plan todavia puede haber comidas o reloj. Mas vale enseñar eso que
    // una pantalla en blanco.
    const tarjetas = tarjetasResumen(S.resumen);
    const caja = $('hoy-contenido');
    if (caja && tarjetas) caja.innerHTML = tarjetas + tiraSemana(S.resumen?.semana);
  }

  await pintarSalud(extras.nLab || 0, extras.faltantes || 0);
  montarAccesosEncabezado(patient);
}

/* ---------- cuando la médica cambia el plan ----------
   El plan se vuelve a leer cada vez que la app se abre, asi que el caso normal
   ya funciona. Lo que faltaba es el telefono que se queda abierto: el paciente
   lo deja en la mesa, la medica entrega una version nueva, y el ve la vieja.
   No se escucha la base en vivo a proposito: lo unico que hay que saber es si
   cambio el id del plan entregado, y eso es una consulta de una fila. */
let vigilante = null;

function vigilarPlan(patient, extras) {
  if (vigilante) return;
  let recargando = false;

  const revisar = async () => {
    if (recargando || document.hidden || !S.plan) return;
    try {
      const { data, error } = await supabase.from('protocols')
        .select('id,version')
        .eq('patient_id', patient.id).eq('status', 'delivered')
        .order('version', { ascending: false }).limit(1);
      if (error || !data?.length) return;
      if (data[0].id === S.plan.id) return;
      recargando = true;
      // El aviso va DESPUES de repintar: pintarPaciente reescribe el contenedor
      // y se llevaba el aviso por delante.
      await pintarPaciente(patient, extras);
      avisarPlanNuevo();
      recargando = false;
    } catch (_) { recargando = false; }
  };

  document.addEventListener('visibilitychange', () => { if (!document.hidden) revisar(); });
  vigilante = setInterval(revisar, 90000);
}

// Un plan que cambia solo, sin avisar, se siente como un error de la app. Se
// dice qué pasó y quién lo hizo.
function avisarPlanNuevo() {
  if (document.getElementById('aviso-plan')) return;
  const c = document.createElement('div');
  c.id = 'aviso-plan';
  c.className = 'notice';
  c.style.cssText = 'margin:12px';
  c.textContent = 'Tu médica actualizó tu plan. Esto es lo que te toca ahora.';
  const caja = document.getElementById('hoy-contenido') || document.body;
  caja.prepend(c);
  setTimeout(() => c.remove(), 12000);
}

// Engrane y persona del encabezado. Llevan a la pestaña "Mi salud" y abren la
// seccion directo, sin que el paciente tenga que bajar a buscarla en la lista.
function montarAccesosEncabezado(patient) {
  const irA = (seccion) => {
    document.querySelector('.tb[data-pg="salud"]')?.click();
    abrirSeccion(seccion, patient);
  };
  const perfil = document.getElementById('btn-perfil');
  const ajustes = document.getElementById('btn-ajustes');
  const logout = document.getElementById('btn-logout');

  if (perfil && !perfil.dataset.listo) {
    perfil.dataset.listo = '1';
    perfil.addEventListener('click', () => irA('perfil'));
  }
  if (ajustes && !ajustes.dataset.listo) {
    ajustes.dataset.listo = '1';
    ajustes.addEventListener('click', () => irA('ajustes'));
  }
  perfil?.classList.remove('hidden');
  ajustes?.classList.remove('hidden');
  // Cerrar sesion ya vive dentro de Mi perfil. Tres controles en el encabezado de
  // un telefono es uno de mas.
  logout?.classList.add('hidden');
}
