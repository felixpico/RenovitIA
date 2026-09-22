// Definiciones de UI para preguntas donde el texto de la plantilla no basta para construir el control.
// Tipos: fields | choices | multi | yesno_list | consent | signature | info
const SI_NO = ['Sí', 'No'];

export const OVERRIDES = {
  '0.1': { type: 'consent', text: 'Acepto el aviso de privacidad. Entiendo que mis datos de salud son datos personales sensibles, que se almacenan cifrados en servidores de Supabase ubicados en Estados Unidos y que sólo mi médico del programa y el personal autorizado pueden verlos.' },
  '0.2': { type: 'signature', text: 'Acepto participar en el programa piloto. Entiendo que no sustituye la atención de urgencias y que mi protocolo será revisado y firmado por un médico.' },
  '0.3': { type: 'choices', options: SI_NO },

  A5: { type: 'fields', fields: [{ k: 'telefono', l: 'Teléfono (WhatsApp)', t: 'tel' }, { k: 'correo', l: 'Correo', t: 'email' }] },

  C1: { type: 'fields', fields: [{ k: 'peso_kg', l: 'Peso (kg)', t: 'number', step: '0.1' }, { k: 'estatura_cm', l: 'Estatura (cm)', t: 'number' }] },

  E10: { type: 'choices', options: ['Nunca he tenido cáncer', 'En remisión', 'En tratamiento actualmente', 'Activo sin tratamiento'], detail: 'Tipo de cáncer y año' },
  G3: { type: 'multi', options: ['Vesícula', 'Tiroides', 'Útero', 'Ovarios'] },

  H1: { type: 'multi', options: ['Warfarina', 'Rivaroxabán', 'Apixabán', 'Dabigatrán', 'Clopidogrel', 'Aspirina diaria'], detail: 'Nombre, dosis y frecuencia' },
  H2: { type: 'multi', options: ['Insulina', 'Glibenclamida', 'Glimepirida', 'Metformina', 'Semaglutida (Ozempic / Wegovy)', 'Tirzepatida (Mounjaro)', 'Otro para diabetes'], detail: 'Nombre, dosis y frecuencia' },
  H3: { type: 'multi', options: ['Antidepresivo (sertralina, escitalopram, fluoxetina, venlafaxina…)', 'Ansiolítico / benzodiacepina (clonazepam, alprazolam…)', 'Antipsicótico', 'Litio', 'Estabilizador del ánimo (valproato, lamotrigina…)'], detail: 'Nombre, dosis y frecuencia' },
  H4: { type: 'multi', options: ['Levotiroxina', 'Metimazol'], detail: 'Dosis' },
  H5: { type: 'multi', options: ['Anticonceptivo oral', 'DIU hormonal, implante o inyección', 'Terapia hormonal de menopausia'], detail: 'Nombre y dosis' },
  H6: { type: 'multi', options: ['Testosterona recetada por médico', 'Testosterona u otros anabólicos sin supervisión', 'SARMs', 'Hormona de crecimiento', 'Péptidos'], detail: 'Nombre, dosis y desde cuándo' },
  H7: { type: 'multi', options: ['Estatina (atorvastatina, rosuvastatina…)', 'Ezetimiba', 'Otro para colesterol'], detail: 'Nombre y dosis' },
  H8: { type: 'multi', options: ['Enalapril / captopril', 'Losartán / telmisartán', 'Diurético', 'Betabloqueador', 'Amlodipino', 'Otro'], detail: 'Nombre y dosis' },
  H9: { type: 'multi', options: ['Corticoide oral por más de 3 semanas', 'Inmunosupresor (metotrexato, azatioprina…)', 'Biológico (adalimumab…)'], detail: 'Nombre y dosis' },

  K3: { type: 'fields', fields: [{ k: 'regular', l: '¿Ciclos regulares?', t: 'select', o: ['Sí', 'No', 'No menstrúo'] }, { k: 'ciclo_dias', l: 'Duración del ciclo (días)', t: 'number' }, { k: 'sangrado_dias', l: 'Días de sangrado', t: 'number' }] },
  K5: { type: 'multi', options: ['Síntomas premenstruales intensos', 'Sangrado abundante', 'Dolor menstrual intenso'] },
  K8: { type: 'fields', fields: [{ k: 'estado', l: 'Estado', t: 'select', o: ['Premenopausia', 'Perimenopausia', 'Menopausia', 'No sé'] }, { k: 'edad', l: 'Edad de última menstruación', t: 'number' }] },
  K10: { type: 'fields', fields: [{ k: 'mastografia', l: 'Última mastografía', t: 'month' }, { k: 'papanicolaou', l: 'Último Papanicolaou / VPH', t: 'month' }] },

  N9: { type: 'choices', options: ['Gimnasio completo', 'Casa con pesas', 'Sin equipo'] },

  O1: { type: 'fields', fields: [{ k: 'acostarse', l: 'Me acuesto', t: 'time' }, { k: 'levantarse', l: 'Me levanto', t: 'time' }] },
  O2: { type: 'fields', fields: [{ k: 'acostarse', l: 'Me acuesto', t: 'time' }, { k: 'levantarse', l: 'Me levanto', t: 'time' }] },
  O8: { type: 'fields', fields: [{ k: 'tazas', l: 'Tazas al día', t: 'number' }, { k: 'ultima', l: 'Hora de la última', t: 'time' }] },
  O12: { type: 'choices', options: ['No lo monitoreo', 'Apple Watch', 'Oura', 'Whoop', 'Garmin', 'Fitbit', 'Otro'] },

  T1: { type: 'fields', fields: [{ k: 'dias', l: 'Días por semana', t: 'number', min: 0, max: 7 }, { k: 'minutos', l: 'Minutos por sesión', t: 'number' }] },
};

export const FAMILY_COLUMNS = ['Padre', 'Madre', 'Hermanos', 'Abuelos', 'Hijos'];
