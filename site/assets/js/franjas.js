// Franjas horarias compartidas por la hoja impresa y el panel diario del
// paciente. Vive aparte para que las dos pantallas agrupen igual: si cambia
// aqui, cambia en las dos.
export const FRANJAS = [
  ['ayunas', 'En ayunas, al despertar'],
  ['desayuno', 'Con el desayuno'],
  ['entreno', 'Alrededor del entrenamiento'],
  ['comida', 'Con la comida'],
  ['cena', 'Con la cena'],
  ['dormir', 'Antes de dormir'],
  ['semanal', 'Un día fijo de la semana'],
  ['indefinido', 'Sin horario definido'],
];

export const NOMBRE_FRANJA = Object.fromEntries(FRANJAS);

export function franjaDe(i) {
  const t = `${i.timing || ''} ${i.frequency || ''}`.toLowerCase();
  // \b es necesario: sin el, "desayuno" hace match con /ayun/ y cae en ayunas.
  if (/\bayun/.test(t)) return 'ayunas';
  if (/(entren|pre-?entreno|post-?entreno|gimnasio)/.test(t)) return 'entreno';
  if (/(dormir|acostar|antes de la cama)/.test(t)) return 'dormir';
  if (/(desayun|ma[nñ]ana|matutin|am\b)/.test(t)) return 'desayuno';
  if (/cena/.test(t)) return 'cena';
  if (/(comida principal|con la comida|mediod|almuerz)/.test(t)) return 'comida';
  if (/(semana|semanal)/.test(t) && /(1 vez|una vez|d[ií]a fijo)/.test(t)) return 'semanal';
  if (/noche/.test(t)) return 'cena';
  if (/(comida|aliment)/.test(t)) return 'comida';
  return 'indefinido';
}

// Un renglon semanal sólo toca el dia que el medico fijó. Si no se puede
// deducir, se muestra todos los dias: mejor recordarlo de mas que de menos.
export function tocaHoy(i, fecha = new Date()) {
  const t = `${i.timing || ''} ${i.frequency || ''}`.toLowerCase();
  const dias = ['domingo', 'lunes', 'martes', 'mi', 'jueves', 'viernes', 's'];
  if (/d[ií]as alternos|cada tercer d[ií]a|cada 2 d[ií]as/.test(t)) return 'alterno';
  if (franjaDe(i) !== 'semanal') return true;
  const hoy = fecha.getDay();
  for (let d = 0; d < 7; d += 1) {
    const nombre = ['domingo', 'lunes', 'martes', 'miercoles|miércoles', 'jueves', 'viernes', 'sabado|sábado'][d];
    if (new RegExp(nombre).test(t)) return d === hoy;
  }
  return true;
}
