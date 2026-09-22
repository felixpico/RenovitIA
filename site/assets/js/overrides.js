// Definiciones de UI para preguntas donde el texto de la plantilla no basta para construir el control.
// Tipos: fields | choices | multi | yesno_list | consent | signature | info
const SI_NO = ['Sí', 'No'];

export const OVERRIDES = {
  '0.1': { type: 'consent', text: 'Acepto el aviso de privacidad. Entiendo que mis datos de salud son datos personales sensibles, que se almacenan cifrados en servidores de Supabase ubicados en Estados Unidos y que sólo mi médico del programa y el personal autorizado pueden verlos.' },
  '0.2': { type: 'signature', text: 'Acepto participar en el programa piloto. Entiendo que no sustituye la atención de urgencias y que mi protocolo será revisado y firmado por un médico.' },
  '0.3': { type: 'choices', options: SI_NO },

  A5: { type: 'fields', fields: [{ k: 'telefono', l: 'Teléfono (WhatsApp)', t: 'tel' }, { k: 'correo', l: 'Correo', t: 'email' }] },
  A7: { type: 'fields', fields: [{ k: 'ocupacion', l: 'Ocupación', t: 'text' }, { k: 'tipo', l: 'Tipo de trabajo', t: 'select', o: ['Sedentario', 'De pie', 'Físico pesado'] }] },

  C1: { type: 'fields', fields: [{ k: 'peso_kg', l: 'Peso (kg)', t: 'number', step: '0.1' }, { k: 'estatura_cm', l: 'Estatura (cm)', t: 'number' }] },
  C4: { type: 'fields', fields: [{ k: 'sistolica', l: 'Sistólica (alta)', t: 'number' }, { k: 'diastolica', l: 'Diastólica (baja)', t: 'number' }, { k: 'fecha', l: 'Fecha aproximada', t: 'month' }, { k: 'no_se', l: '¿No la conoce?', t: 'select', o: ['La conozco', 'No sé'] }] },

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

  J4: { type: 'multi', options: ['Mariscos', 'Pescado', 'Soya', 'Cacahuate'] },

  K3: { type: 'fields', fields: [{ k: 'regular', l: '¿Ciclos regulares?', t: 'select', o: ['Sí', 'No', 'No menstrúo'] }, { k: 'ciclo_dias', l: 'Duración del ciclo (días)', t: 'number' }, { k: 'sangrado_dias', l: 'Días de sangrado', t: 'number' }] },
  K5: { type: 'multi', options: ['Síntomas premenstruales intensos', 'Sangrado abundante', 'Dolor menstrual intenso'] },
  K7: { type: 'fields', fields: [{ k: 'embarazos', l: 'Embarazos', t: 'number' }, { k: 'partos', l: 'Partos', t: 'number' }, { k: 'cesareas', l: 'Cesáreas', t: 'number' }, { k: 'perdidas', l: 'Pérdidas', t: 'number' }] },
  K8: { type: 'fields', fields: [{ k: 'estado', l: 'Estado', t: 'select', o: ['Premenopausia', 'Perimenopausia', 'Menopausia', 'No sé'] }, { k: 'edad', l: 'Edad de última menstruación', t: 'number' }] },
  K10: { type: 'fields', fields: [{ k: 'mastografia', l: 'Última mastografía', t: 'month' }, { k: 'papanicolaou', l: 'Último Papanicolaou / VPH', t: 'month' }] },
  L5: { type: 'fields', fields: [{ k: 'fecha', l: 'Fecha', t: 'month' }, { k: 'valor', l: 'Valor (ng/mL)', t: 'number', step: '0.01' }] },

  M11: { type: 'yesno_list', items: ['Dolor u opresión en el pecho con esfuerzo', 'Desmayo', 'Sangre en heces u orina', 'Vómito con sangre', 'Falta de aire en reposo', 'Fiebre o sudoración nocturna sin causa', 'Un bulto nuevo'] },

  N2: { type: 'fields', fields: [{ k: 'dias', l: 'Días', t: 'number', min: 0, max: 7 }, { k: 'minutos', l: 'Minutos por día', t: 'number' }] },
  N3: { type: 'fields', fields: [{ k: 'dias', l: 'Días', t: 'number', min: 0, max: 7 }, { k: 'minutos', l: 'Minutos por día', t: 'number' }] },
  N4: { type: 'fields', fields: [{ k: 'dias', l: 'Días', t: 'number', min: 0, max: 7 }, { k: 'minutos', l: 'Minutos por día', t: 'number' }] },
  N5: { type: 'fields', fields: [{ k: 'horas', l: 'Horas sentado', t: 'number', step: '0.5' }] },
  N6: { type: 'fields', fields: [{ k: 'dias', l: 'Días por semana', t: 'number', min: 0, max: 7 }, { k: 'tipo', l: 'Tipo', t: 'select', o: ['No hago', 'Pesas libres', 'Máquinas', 'Calistenia', 'Clases (crossfit, funcional…)', 'Mixto'] }, { k: 'anios', l: 'Años de experiencia', t: 'number', step: '0.5' }] },
  N7: { type: 'fields', fields: [{ k: 'tipo', l: 'Tipo (correr, bici, natación…)', t: 'text' }, { k: 'dias', l: 'Días por semana', t: 'number' }, { k: 'minutos', l: 'Minutos por sesión', t: 'number' }, { k: 'zonas', l: '¿Conoce sus zonas de FC?', t: 'select', o: SI_NO }] },
  N9: { type: 'choices', options: ['Gimnasio completo', 'Casa con pesas', 'Sin equipo'] },

  O1: { type: 'fields', fields: [{ k: 'acostarse', l: 'Me acuesto', t: 'time' }, { k: 'levantarse', l: 'Me levanto', t: 'time' }] },
  O2: { type: 'fields', fields: [{ k: 'acostarse', l: 'Me acuesto', t: 'time' }, { k: 'levantarse', l: 'Me levanto', t: 'time' }] },
  O4: { type: 'fields', fields: [{ k: 'veces', l: 'Veces por noche', t: 'number' }, { k: 'cuesta', l: '¿Le cuesta volver a dormir?', t: 'select', o: SI_NO }] },
  O7: { type: 'choices', options: ['No tomo siestas', 'Menos de 30 min, ocasional', 'Menos de 30 min, diario', 'Más de 30 min, ocasional', 'Más de 30 min, diario'] },
  O8: { type: 'fields', fields: [{ k: 'tazas', l: 'Tazas al día', t: 'number' }, { k: 'ultima', l: 'Hora de la última', t: 'time' }] },
  O12: { type: 'choices', options: ['No lo monitoreo', 'Apple Watch', 'Oura', 'Whoop', 'Garmin', 'Fitbit', 'Otro'] },
  O13: { type: 'info', text: 'Este cuestionario se aplicará durante tu consulta.' },

  Q2: { type: 'fields', fields: [{ k: 'comidas', l: 'Comidas al día', t: 'number' }, { k: 'primera', l: 'Primera comida', t: 'time' }, { k: 'ultima', l: 'Última comida', t: 'time' }] },
  Q3: { type: 'fields', fields: [{ k: 'tipo', l: 'Tipo', t: 'select', o: ['No ayuno', '12:12', '16:8', 'Una comida al día', 'Ayunos prolongados (> 24 h)'] }, { k: 'frecuencia', l: 'Días por semana', t: 'number' }] },
  Q13: { type: 'choices', options: ['Menos de $1,000', '$1,000–2,000', '$2,000–3,500', 'Más de $3,500 MXN'] },

  R3: { type: 'fields', fields: [{ k: 'minutos', l: 'Minutos de sol al día', t: 'number' }, { k: 'bloqueador', l: 'Bloqueador', t: 'select', o: ['Siempre', 'A veces', 'Nunca'] }] },

  S4: { type: 'info', text: 'La conexión con Apple Health / Health Connect estará disponible en la app móvil.' },

  T1: { type: 'fields', fields: [{ k: 'dias', l: 'Días por semana', t: 'number', min: 0, max: 7 }, { k: 'minutos', l: 'Minutos por sesión', t: 'number' }] },
  T5: { type: 'fields', fields: [{ k: 'canal', l: 'Canal', t: 'select', o: ['WhatsApp', 'App', 'Llamada'] }, { k: 'horario', l: 'Horario', t: 'select', o: ['Mañana', 'Mediodía', 'Tarde', 'Noche'] }] },
};

export const FAMILY_COLUMNS = ['Padre', 'Madre', 'Hermanos', 'Abuelos', 'Hijos'];
