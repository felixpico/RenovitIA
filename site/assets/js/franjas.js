// Franjas horarias. Las comparten la hoja impresa, el panel del paciente y el
// panel medico: si cambian aqui, cambian en los tres.
//
// Siete, fijas, y se ELIGEN: no se adivinan de un texto libre. La version
// anterior derivaba la franja de lo que la medica escribiera, y eso mandaba
// "Tesamorelina, noche" a la cena cuando debia ir antes de dormir, y dejaba
// "Mio-inositol, manana y noche" con una sola toma visible.
export const FRANJAS = [
  ['ayunas', 'Al despertar, en ayunas', 'En ayunas'],
  ['desayuno', 'Con el desayuno', 'Desayuno'],
  ['entreno', 'Alrededor del entrenamiento', 'Entrenamiento'],
  ['comida', 'Con la comida', 'Comida'],
  ['cena', 'Con la cena', 'Cena'],
  ['dormir', 'Antes de dormir', 'Antes de dormir'],
  ['cualquiera', 'A cualquier hora', 'A cualquier hora'],
];

export const NOMBRE_FRANJA = Object.fromEntries(FRANJAS.map(([k, n]) => [k, n]));
export const CORTO_FRANJA = Object.fromEntries(FRANJAS.map(([k, , c]) => [k, c]));
export const CLAVES_FRANJA = FRANJAS.map(([k]) => k);

// Compatibilidad: los renglones viejos todavia no tienen slots. Mientras la
// medica no los defina, se sigue leyendo el texto, con las mismas reglas de
// antes, para que nadie se quede sin ver su toma.
export function franjasDe(i) {
  if (Array.isArray(i?.slots) && i.slots.length) {
    const limpias = i.slots.filter((s) => CLAVES_FRANJA.includes(s));
    if (limpias.length) return limpias;
  }
  return [franjaHeredada(i)];
}

function franjaHeredada(i) {
  const t = `${i?.timing || ''} ${i?.frequency || ''}`.toLowerCase();
  if (/\bayun|al despertar/.test(t)) return 'ayunas';
  if (/(entren|gimnasio)/.test(t)) return 'entreno';
  if (/(dormir|acostar|antes de la cama)/.test(t)) return 'dormir';
  if (/(desayun|ma[nñ]ana|matutin|am\b)/.test(t)) return 'desayuno';
  if (/cena/.test(t)) return 'cena';
  if (/(comida principal|con la comida|mediod|almuerz)/.test(t)) return 'comida';
  if (/noche/.test(t)) return 'cena';
  if (/(comida|aliment)/.test(t)) return 'comida';
  return 'cualquiera';
}

// Orden del dia. Un renglon de dos franjas aparece en las dos.
export function porFranja(items) {
  const mapa = new Map(CLAVES_FRANJA.map((k) => [k, []]));
  (items || []).forEach((i) => {
    franjasDe(i).forEach((f) => {
      if (mapa.has(f)) mapa.get(f).push(i);
    });
  });
  return mapa;
}

// La llave del palomeo.
//
// Un renglon de UNA franja conserva su id pelon: asi el historial que ya
// existe -- y el calculo de la inyeccion semanal, que busca el id -- siguen
// funcionando sin migrar nada. Solo los de VARIAS franjas llevan sufijo, para
// que marcar la toma de la manana no de por hecha la de la noche.
export function llaveToma(i, franja) {
  const fs = franjasDe(i);
  return fs.length > 1 ? `${i.id}#${franja}` : i.id;
}

// La hora de reloj que el paciente configuro para sus recordatorios. Es SU
// hora, no una inventada por el sistema.
export function horaDe(franja, horas) {
  const h = horas && horas[franja];
  return typeof h === 'string' && /^\d{1,2}:\d{2}/.test(h) ? h.slice(0, 5) : null;
}

// Un renglon semanal solo toca el dia que la medica fijo. Con days_of_week la
// respuesta es exacta. Sin el, se cae al texto, como antes.
export function tocaHoy(i, fecha = new Date()) {
  if (Array.isArray(i?.days_of_week) && i.days_of_week.length) {
    const d = fecha.getDay() === 0 ? 7 : fecha.getDay();
    return i.days_of_week.map(Number).includes(d);
  }
  const t = `${i?.timing || ''} ${i?.frequency || ''}`.toLowerCase();
  if (/d[ií]as alternos|cada tercer d[ií]a|cada 2 d[ií]as/.test(t)) return 'alterno';
  const semanal = /(semana|semanal)/.test(t) && /(1 vez|una vez|d[ií]a fijo)/.test(t);
  if (!semanal) return true;
  const nombres = ['domingo', 'lunes', 'martes', 'miercoles|miércoles', 'jueves', 'viernes', 'sabado|sábado'];
  for (let d = 0; d < 7; d += 1) {
    if (new RegExp(nombres[d]).test(t)) return d === fecha.getDay();
  }
  return true;
}

// Compatibilidad hacia atras: la hoja impresa y la pantalla "Mi dia" todavia
// piden UNA franja por renglon. Reciben la primera. Mientras no se actualicen,
// un renglon de dos franjas les sale una sola vez.
export const franjaDe = (i) => franjasDe(i)[0];
