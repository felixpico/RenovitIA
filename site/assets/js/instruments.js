// Cuestionarios validados. Textos en español: VALIDAR contra la versión oficial en español de México antes del lanzamiento.
const F_2W = [
  { v: 0, t: 'Nunca' }, { v: 1, t: 'Varios días' }, { v: 2, t: 'Más de la mitad de los días' }, { v: 3, t: 'Casi todos los días' },
];
const PSS = [
  { v: 0, t: 'Nunca' }, { v: 1, t: 'Casi nunca' }, { v: 2, t: 'De vez en cuando' }, { v: 3, t: 'A menudo' }, { v: 4, t: 'Muy a menudo' },
];
const YN = [{ v: 1, t: 'Sí' }, { v: 0, t: 'No' }];
const MRS_S = [{ v: 0, t: 'Nada' }, { v: 1, t: 'Leve' }, { v: 2, t: 'Moderado' }, { v: 3, t: 'Severo' }, { v: 4, t: 'Muy severo' }];

const PHQ_ITEMS = [
  'Poco interés o placer en hacer las cosas',
  'Se ha sentido decaído(a), deprimido(a) o sin esperanza',
  'Dificultad para quedarse o permanecer dormido(a), o ha dormido demasiado',
  'Se ha sentido cansado(a) o con poca energía',
  'Sin apetito o ha comido en exceso',
  'Se ha sentido mal consigo mismo(a), que es un fracaso o que ha quedado mal con usted mismo(a) o con su familia',
  'Dificultad para concentrarse en cosas como leer o ver televisión',
  '¿Se ha movido o hablado tan lento que otras personas lo notaron? O lo contrario: muy inquieto(a), moviéndose más de lo normal',
];

export const INSTRUMENTS = {
  PHQ9_A: { // P2: reactivos 1–8
    intro: 'Durante las últimas 2 semanas, ¿con qué frecuencia le han molestado los siguientes problemas?',
    scale: F_2W, items: PHQ_ITEMS,
  },
  PHQ9_B: { // P3: reactivo 9 (seguridad)
    intro: 'Durante las últimas 2 semanas, ¿con qué frecuencia ha tenido…',
    scale: F_2W, items: ['Pensamientos de que estaría mejor muerto(a) o de lastimarse de alguna manera'],
  },
  GAD7: {
    intro: 'Durante las últimas 2 semanas, ¿con qué frecuencia le han molestado los siguientes problemas?',
    scale: F_2W,
    items: [
      'Se ha sentido nervioso(a), ansioso(a) o con los nervios de punta',
      'No ha podido dejar de preocuparse o controlar la preocupación',
      'Se ha preocupado demasiado por diferentes cosas',
      'Ha tenido dificultad para relajarse',
      'Se ha sentido tan inquieto(a) que no ha podido quedarse quieto(a)',
      'Se ha molestado o irritado fácilmente',
      'Ha sentido miedo de que algo terrible fuera a pasar',
    ],
  },
  PSS10: {
    intro: 'En el último mes, ¿con qué frecuencia…',
    scale: PSS,
    reverse: [3, 4, 6, 7], // índices base 0 de los reactivos 4, 5, 7 y 8
    items: [
      '…ha estado afectado(a) por algo que ocurrió inesperadamente?',
      '…se ha sentido incapaz de controlar las cosas importantes de su vida?',
      '…se ha sentido nervioso(a) o estresado(a)?',
      '…ha estado seguro(a) de su capacidad para manejar sus problemas personales?',
      '…ha sentido que las cosas le van bien?',
      '…ha sentido que no podía afrontar todas las cosas que tenía que hacer?',
      '…ha podido controlar las dificultades de su vida?',
      '…ha sentido que tenía todo bajo control?',
      '…ha estado enojado(a) porque las cosas que le ocurrieron estaban fuera de su control?',
      '…ha sentido que las dificultades se acumulaban tanto que no podía superarlas?',
    ],
  },
  STOPBANG: {
    intro: 'Responda Sí o No.',
    scale: YN,
    items: [
      '¿Ronca fuerte (se escucha a través de una puerta cerrada)?',
      '¿Se siente cansado(a) o somnoliento(a) durante el día con frecuencia?',
      '¿Alguien ha observado que deja de respirar mientras duerme?',
      '¿Tiene o está en tratamiento por presión arterial alta?',
      '¿Su índice de masa corporal es mayor a 35? (si no sabe, lo calculamos con su peso y estatura)',
      '¿Tiene más de 50 años?',
      '¿Su cuello mide más de 40 cm?',
      '¿Es hombre?',
    ],
  },
  AUDITC: {
    intro: 'Una copa = 1 cerveza, 1 copa de vino o 1 trago de destilado.',
    perItemScale: [
      { t: '¿Con qué frecuencia consume alguna bebida alcohólica?', s: [{ v: 0, t: 'Nunca' }, { v: 1, t: '1 vez al mes o menos' }, { v: 2, t: '2–4 veces al mes' }, { v: 3, t: '2–3 veces por semana' }, { v: 4, t: '4 o más por semana' }] },
      { t: '¿Cuántas copas toma en un día típico en que bebe?', s: [{ v: 0, t: '1–2' }, { v: 1, t: '3–4' }, { v: 2, t: '5–6' }, { v: 3, t: '7–9' }, { v: 4, t: '10 o más' }] },
      { t: '¿Con qué frecuencia toma 6 o más copas en una sola ocasión?', s: [{ v: 0, t: 'Nunca' }, { v: 1, t: 'Menos de 1 vez al mes' }, { v: 2, t: 'Mensualmente' }, { v: 3, t: 'Semanalmente' }, { v: 4, t: 'A diario o casi' }] },
    ],
  },
  SCOFF: {
    intro: 'Responda con sinceridad; esta información es confidencial.',
    scale: YN,
    items: [
      '¿Se provoca el vómito porque se siente incómodamente lleno(a)?',
      '¿Le preocupa haber perdido el control sobre cuánto come?',
      '¿Ha perdido más de 6 kg en los últimos 3 meses?',
      '¿Cree que está gordo(a) aunque otros le digan que está delgado(a)?',
      '¿Diría que la comida domina su vida?',
    ],
  },
  ADAM: {
    intro: 'Responda Sí o No.',
    scale: YN,
    items: [
      '¿Ha notado disminución en su deseo sexual?',
      '¿Siente falta de energía?',
      '¿Ha notado disminución de fuerza o resistencia?',
      '¿Ha perdido estatura?',
      '¿Ha notado que disfruta menos de la vida?',
      '¿Se siente triste o de mal humor?',
      '¿Sus erecciones son menos firmes?',
      '¿Ha notado una disminución reciente en su capacidad para hacer deporte?',
      '¿Se queda dormido(a) después de cenar?',
      '¿Ha disminuido recientemente su desempeño en el trabajo?',
    ],
  },
  MRS: {
    intro: '¿Cuánto le molestan actualmente estos síntomas?',
    scale: MRS_S,
    items: [
      'Bochornos, sudoración', 'Molestias del corazón (palpitaciones, opresión)', 'Problemas de sueño', 'Ánimo depresivo',
      'Irritabilidad', 'Ansiedad', 'Agotamiento físico y mental', 'Problemas sexuales', 'Problemas de vejiga',
      'Sequedad vaginal', 'Molestias musculares y articulares',
    ],
  },
  PARQ: {
    intro: 'Preguntas de seguridad antes de hacer ejercicio.',
    scale: YN,
    items: [
      '¿Algún médico le ha dicho que tiene una condición del corazón o presión arterial alta?',
      '¿Siente dolor en el pecho en reposo, en actividades diarias o al hacer ejercicio?',
      '¿Ha perdido el equilibrio por mareo o ha perdido el conocimiento en los últimos 12 meses?',
      '¿Le han diagnosticado otra enfermedad crónica?',
      '¿Toma medicamentos recetados para una enfermedad crónica?',
      '¿Tiene (o tuvo en los últimos 12 meses) un problema de huesos, articulaciones o músculos que empeore con el ejercicio?',
      '¿Algún médico le ha indicado que sólo haga actividad física supervisada?',
    ],
  },
};

export function instrumentKey(q) {
  if (q.question_code === 'P2') return 'PHQ9_A';
  if (q.question_code === 'P3') return 'PHQ9_B';
  return q.instrument;
}

export function scoreInstrument(key, items) {
  const vals = (items || []).map((x) => (typeof x === 'number' ? x : null));
  const def = INSTRUMENTS[key];
  if (!def) return null;
  const n = def.perItemScale ? def.perItemScale.length : def.items.length;
  if (vals.filter((v) => v !== null).length < n) return null;
  if (key === 'PSS10') {
    return vals.reduce((a, v, i) => a + (def.reverse.includes(i) ? 4 - v : v), 0);
  }
  return vals.reduce((a, v) => a + v, 0);
}
