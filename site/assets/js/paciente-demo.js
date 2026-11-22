// Modo demo del panel del paciente: ?demo=paciente
//
// Para que se pueda enseñar la app —en un video, a un paciente nuevo, a la
// medica— sin abrir el expediente de nadie. Sustituye al cliente de Supabase
// completo por uno que contesta de memoria. No hay red: este modulo no puede
// escribir en la base aunque se le pida.
//
// El paciente es el mismo "Daniel Treviño (ficticio)" del demo del panel
// medico, para que las dos demos cuenten la misma historia.
//
// Regla: aqui no se copian datos de nadie. Los numeros son inventados y
// clinicamente coherentes entre si.

const hoy = new Date();
const dISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const menos = (n) => { const d = new Date(hoy); d.setDate(d.getDate() - n); return dISO(d); };
const mas   = (n) => { const d = new Date(hoy); d.setDate(d.getDate() + n); return dISO(d); };
const HOY = dISO(hoy);

const PACIENTE = {
  id: 'demo-paciente',
  first_name: 'Daniel',
  last_name: 'Treviño (ficticio)',
  email: 'daniel@ejemplo.mx',
  phone: '81 1234 5678',
  birth_date: '1983-09-01',
  sex_at_birth: 'M',
  status: 'active',
};

const PLAN = { id: 'demo-plan', patient_id: PACIENTE.id, version: 2, status: 'delivered', signed_at: `${menos(9)}T17:20:00Z`, start_date: menos(8) };

const ITEMS = [
  { id: 'it-1', protocol_id: 'demo-plan', category: 'supplement', title: 'Vitamina D3 + K2', dose: '5,000 UI', reconstitution: null, timing: 'Con el desayuno', frequency: 'Diario', instructions: 'Con grasa: huevo, aguacate o aceite de oliva. Sin grasa se absorbe mal.', sort_order: 1, is_active: true },
  { id: 'it-2', protocol_id: 'demo-plan', category: 'supplement', title: 'Omega 3 (EPA/DHA)', dose: '2 g', reconstitution: null, timing: 'Con la comida', frequency: 'Diario', instructions: 'Dos cápsulas con el plato fuerte.', sort_order: 2, is_active: true },
  { id: 'it-3', protocol_id: 'demo-plan', category: 'supplement', title: 'Magnesio glicinato', dose: '400 mg', reconstitution: null, timing: 'Antes de dormir', frequency: 'Diario', instructions: 'Treinta minutos antes de acostarte.', sort_order: 3, is_active: true },
  { id: 'it-4', protocol_id: 'demo-plan', category: 'medication', title: 'Metformina XR', dose: '750 mg', reconstitution: null, timing: 'Con la cena', frequency: 'Diario', instructions: 'Siempre con alimento.', sort_order: 4, is_active: true },
  { id: 'it-5', protocol_id: 'demo-plan', category: 'supplement', title: 'Creatina monohidratada', dose: '5 g', reconstitution: null, timing: 'Alrededor del entrenamiento', frequency: 'Diario', instructions: 'En agua. El dia que no entrenes, tambien.', sort_order: 5, is_active: true },
  { id: 'it-6', protocol_id: 'demo-plan', category: 'supplement', title: 'Berberina', dose: '500 mg', reconstitution: null, timing: 'En ayunas', frequency: 'Diario', instructions: 'Veinte minutos antes del desayuno.', sort_order: 6, is_active: true },
  // Un peptido en unidades, con su vial completo: es el que estrena la hoja de
  // la jeringa. Los numeros son los de un vial real de 40 mg en 3 mL.
  // Dos franjas en un solo renglon: es el caso que antes salia una sola vez.
  { id: 'it-inositol', protocol_id: 'demo-plan', category: 'supplement', title: 'Mio-inositol',
    dose: '2 g', timing: 'Mañana y noche', frequency: 'Diario', slots: ['desayuno', 'dormir'],
    instructions: 'Disuelto en agua.', sort_order: 9, is_active: true },
  { id: 'it-pep', protocol_id: 'demo-plan', category: 'peptide', title: 'MOTS-c',
    dose: '30 UN (4 mg)', reconstitution: '40 mg en 3 mL (13.33 mg/mL) · jeringa U-100',
    dose_un: 30, vial_mg: 40, vial_ml: 3, syringe: 'U-100', days_of_week: [1, 3, 5],
    timing: 'AM', frequency: '3 veces por semana', instructions: 'Subcutánea en abdomen. Rota el sitio.',
    sort_order: 8, is_active: true },
  { id: 'it-7', protocol_id: 'demo-plan', category: 'peptide', title: 'Retatrutida', dose: '2 mg', reconstitution: '2 mg en 1 mL de agua bacteriostática', timing: 'Un día fijo de la semana', frequency: '1 vez por semana, domingo', instructions: 'Subcutánea en abdomen. Rota el sitio.', sort_order: 7, is_active: true },
  { id: 'it-8', protocol_id: 'demo-plan', category: 'nutrition', title: '30 g de proteína en el desayuno', dose: null, reconstitution: null, timing: 'Con el desayuno', frequency: 'Diario', instructions: '', sort_order: 8, is_active: true },
];

// Tres de los seis diarios ya palomeados: un dia a medias se ve mas real que
// uno perfecto, y deja ver el anillo a la mitad.
const CHECKIN = {
  patient_id: PACIENTE.id, checkin_date: HOY,
  supplements_taken: { 'it-1': true, 'it-2': true, 'it-6': true },
  sleep_hours: 7, energy: 4, mood: 4, stress: 2, trained: true, notes: '',
};

const RESUMEN = {
  fecha: HOY,
  sueno: { min: 432, eficiencia: 91, despierto_min: 42, profundo_min: 96, rem_min: 108, media_min: 401 },
  actividad: { pasos: 9430, media_pasos: 7620, strain: 12.4, entrenamientos: 1, minutos: 58 },
  recuperacion: { pct: 68, fc_reposo: 54, hrv: 62 },
  alimentacion: { comidas: 4, proteina_g: 118, kcal: 1840 },
  presion: { fecha: menos(2), sis: 124, dia: 78, dias: 2 },
  semana: { dias_con_tomas: 6, entrenos: 4, comidas: 23, dias_reloj: 7 },
};

const SISTEMAS = {
  listo: true,
  n_resultados: 54,
  sistemas: [
    { nombre: 'Metabólico', color: 'rojo', resumen: 'Resistencia a la insulina y triglicéridos altos' },
    { nombre: 'Inflamación', color: 'amarillo', resumen: 'PCR ultrasensible por encima de lo óptimo' },
    { nombre: 'Hormonal', color: 'amarillo', resumen: 'Testosterona total en el límite bajo' },
    { nombre: 'Tiroides', color: 'verde', resumen: 'En rango óptimo' },
    { nombre: 'Hígado y riñón', color: 'verde', resumen: 'Sin hallazgos' },
    { nombre: 'Nutricional', color: 'rojo', resumen: 'Vitamina D baja' },
  ],
  riesgo_cv: { calculable: true, pct_10: 6.2 },
};

const V = (code, nombre, valor, unidad, banda, extra = {}) =>
  Object.assign({ code, nombre, valor, unidad, banda, motivo: null, convertido: false }, extra);

const ESTUDIOS = {
  listo: true,
  fecha: menos(21),
  resumen: { total: 54, rojo: 5, amarillo: 7, verde: 42 },
  valores: [
    V('VITD', 'Vitamina D (25-OH)', 21, 'ng/mL', 'rojo', { rl: 30, rh: 100, ol: 50, oh: 80, exceso: 29 }),
    V('TG', 'Triglicéridos', 212, 'mg/dL', 'rojo', { rl: 0, rh: 150, oh: 90, exceso: 122 }),
    V('HOMA', 'HOMA-IR', 3.4, '', 'rojo', { rl: 0, rh: 2.5, oh: 1.5, exceso: 90 }),
    V('HSCRP', 'PCR ultrasensible', 2.8, 'mg/L', 'rojo', { rl: 0, rh: 3, oh: 1, exceso: 80 }),
    V('TT', 'Testosterona total', 412, 'ng/dL', 'amarillo', { rl: 300, rh: 1000, ol: 600, oh: 900, convertido: true, valor_lab: 14.3, unidad_lab: 'nmol/L' }),
    V('LPA', 'Lipoproteína (a)', 88, 'nmol/L', 'rojo', { rl: 0, rh: 75, oh: 50, exceso: 17 }),
    V('HDL', 'Colesterol HDL', 41, 'mg/dL', 'amarillo', { rl: 40, rh: 90, ol: 55 }),
    V('GLU', 'Glucosa en ayuno', 101, 'mg/dL', 'amarillo', { rl: 70, rh: 100, ol: 80, oh: 90 }),
    V('HBA1C', 'Hemoglobina glucosilada', 5.7, '%', 'amarillo', { rl: 4, rh: 5.7, oh: 5.3 }),
    V('FERR', 'Ferritina', 186, 'ng/mL', 'amarillo', { rl: 30, rh: 400, ol: 50, oh: 150 }),
    V('TSH', 'TSH', 1.8, 'uUI/mL', 'verde', { rl: 0.45, rh: 4.5, ol: 1, oh: 2.5 }),
    V('FT3', 'T3 libre', 3.2, 'pg/mL', 'verde', { rl: 2.3, rh: 4.2, ol: 3, oh: 4 }),
    V('ALT', 'ALT', 28, 'U/L', 'verde', { rl: 0, rh: 45, oh: 30 }),
    V('CREAT', 'Creatinina', 0.95, 'mg/dL', 'verde', { rl: 0.7, rh: 1.3 }),
    V('B12', 'Vitamina B12', 540, 'pg/mL', 'verde', { rl: 200, rh: 900, ol: 500, oh: 800 }),
    V('SHBG', 'SHBG', 32, 'nmol/L', 'gris', { motivo: 'unidad' }),
  ],
  acciones: {
    VITD: [{ titulo: 'Vitamina D3 + K2', dosis: '5,000 UI', categoria: 'supplement' }],
    TG: [{ titulo: 'Omega 3 (EPA/DHA)', dosis: '2 g', categoria: 'supplement' },
         { titulo: 'Bajar carbohidrato refinado', dosis: null, categoria: 'nutrition' }],
    HOMA: [{ titulo: 'Metformina XR', dosis: '750 mg', categoria: 'medication' },
           { titulo: 'Berberina', dosis: '500 mg', categoria: 'supplement' },
           { titulo: 'Retatrutida', dosis: '2 mg semanal', categoria: 'peptide' }],
    HSCRP: [{ titulo: 'Omega 3 (EPA/DHA)', dosis: '2 g', categoria: 'supplement' },
            { titulo: 'Control en 12 semanas', dosis: null, categoria: 'lab_followup' }],
  },
  textos: {
    VITD: 'Por debajo de 30 ng/mL el cuerpo la trata como escasez. Se corrige rápido y cambia energía, ánimo y hueso.',
    TG: 'Los triglicéridos altos con glucosa alta casi siempre van juntos: los dos vienen del mismo exceso de carbohidrato.',
    HOMA: 'Mide cuánta insulina necesitas para mantener tu glucosa. Es lo primero que se mueve cuando algo funciona.',
    HSCRP: 'Inflamación de fondo, sin infección. No se siente, pero se acumula.',
    LPA: 'Es de nacimiento y no se mueve con dieta ni ejercicio. Se mide una vez y cambia qué tan agresivo es el resto del plan.',
  },
};

const MACROS = {
  ok: true, kcal: 2050, proteina_g: 175, carbohidrato_g: 150, grasa_g: 79,
  proteina_pct: 34, carbohidrato_pct: 29, grasa_pct: 35,
  proteina_g_kg: 1.9, agua_ml: 3000, fibra_g: 35,
  enfoque_carbos: 'bajo', piso_aplicado: true, carbos_piso_g: 150,
  piso_razones: ['Entrenas fuerza cuatro días: por debajo de 150 g no recuperas.'],
  bloqueo: null,
  supuestos: { peso_kg: 92, ajuste: 'déficit moderado', nota: 'Calculado sobre tu peso y tu nivel de actividad. Tu médica puede ajustarlo.' },
};

/* ---------- alimentacion: la demo si suma ----------
   Sin esto el modulo no se puede ensenar: el buscador no contesta y guardar
   no mueve el anillo. Un paciente al que le ensenas eso concluye que la app
   no guarda. Los alimentos son de tabla, redondeados por 100 g. */
const sinAcentos = (t) => String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const CATALOGO = [
  { code: 'd-pollo',    nombre: 'Pechuga de pollo, asada',  grupo: 'carne',   tipo: 'base', fuente: 'tabla', medida: 'pieza',   medida_g: 120, kcal: 165, protein_g: 31,   carb_g: 0,    fat_g: 3.6,  fiber_g: 0, alias: 'pollo pechuga' },
  { code: 'd-huevo',    nombre: 'Huevo entero',             grupo: 'huevo',   tipo: 'base', fuente: 'tabla', medida: 'pieza',   medida_g: 50,  kcal: 143, protein_g: 12.6, carb_g: 0.7,  fat_g: 9.5,  fiber_g: 0, alias: 'huevo blanquillo' },
  { code: 'd-salmon',   nombre: 'Salmón',                   grupo: 'pescado', tipo: 'base', fuente: 'tabla', medida: 'filete',  medida_g: 150, kcal: 208, protein_g: 20,   carb_g: 0,    fat_g: 13,   fiber_g: 0, alias: 'salmon pescado' },
  { code: 'd-atun',     nombre: 'Atún en agua',             grupo: 'pescado', tipo: 'base', fuente: 'tabla', medida: 'lata',    medida_g: 80,  kcal: 116, protein_g: 26,   carb_g: 0,    fat_g: 0.8,  fiber_g: 0, alias: 'atun lata' },
  { code: 'd-res',      nombre: 'Bistec de res, magro',     grupo: 'carne',   tipo: 'base', fuente: 'tabla', medida: 'porción', medida_g: 150, kcal: 187, protein_g: 27,   carb_g: 0,    fat_g: 8,    fiber_g: 0, alias: 'res bistec carne' },
  { code: 'd-frijol',   nombre: 'Frijol negro, cocido',     grupo: 'legumbre',tipo: 'base', fuente: 'tabla', medida: 'taza',    medida_g: 170, kcal: 132, protein_g: 8.9,  carb_g: 24,   fat_g: 0.5,  fiber_g: 9, alias: 'frijol frijoles' },
  { code: 'd-arroz',    nombre: 'Arroz blanco, cocido',     grupo: 'cereal',  tipo: 'base', fuente: 'tabla', medida: 'taza',    medida_g: 158, kcal: 130, protein_g: 2.7,  carb_g: 28,   fat_g: 0.3,  fiber_g: 0.4, alias: 'arroz' },
  { code: 'd-tortilla', nombre: 'Tortilla de maíz',         grupo: 'cereal',  tipo: 'base', fuente: 'tabla', medida: 'pieza',   medida_g: 30,  kcal: 218, protein_g: 5.7,  carb_g: 45,   fat_g: 2.9,  fiber_g: 6.3, alias: 'tortilla maiz' },
  { code: 'd-aguacate', nombre: 'Aguacate',                 grupo: 'fruta',   tipo: 'base', fuente: 'tabla', medida: 'mitad',   medida_g: 100, kcal: 160, protein_g: 2,    carb_g: 9,    fat_g: 15,   fiber_g: 7, alias: 'aguacate' },
  { code: 'd-avena',    nombre: 'Avena en hojuelas, cruda', grupo: 'cereal',  tipo: 'base', fuente: 'tabla', medida: 'taza',    medida_g: 80,  kcal: 389, protein_g: 17,   carb_g: 66,   fat_g: 7,    fiber_g: 11, alias: 'avena' },
  { code: 'd-yogur',    nombre: 'Yogur griego natural',     grupo: 'lacteo',  tipo: 'base', fuente: 'tabla', medida: 'vaso',    medida_g: 170, kcal: 59,  protein_g: 10,   carb_g: 3.6,  fat_g: 0.4,  fiber_g: 0, alias: 'yogur yoghurt griego' },
  { code: 'd-queso',    nombre: 'Queso panela',             grupo: 'lacteo',  tipo: 'base', fuente: 'tabla', medida: 'rebanada',medida_g: 40,  kcal: 215, protein_g: 18,   carb_g: 3,    fat_g: 14,   fiber_g: 0, alias: 'queso panela' },
  { code: 'd-brocoli',  nombre: 'Brócoli cocido',           grupo: 'verdura', tipo: 'base', fuente: 'tabla', medida: 'taza',    medida_g: 156, kcal: 35,  protein_g: 2.4,  carb_g: 7,    fat_g: 0.4,  fiber_g: 3.3, alias: 'brocoli' },
  { code: 'd-platano',  nombre: 'Plátano',                  grupo: 'fruta',   tipo: 'base', fuente: 'tabla', medida: 'pieza',   medida_g: 118, kcal: 89,  protein_g: 1.1,  carb_g: 23,   fat_g: 0.3,  fiber_g: 2.6, alias: 'platano banana' },
  { code: 'd-whey',     nombre: 'Proteína de suero en polvo',grupo:'suplemento',tipo:'base',fuente: 'etiqueta', medida: 'scoop', medida_g: 30, kcal: 380, protein_g: 80,   carb_g: 7,    fat_g: 5,    fiber_g: 1, alias: 'proteina whey batido suero polvo' },
].map((a) => ({ ...a, busca: sinAcentos(`${a.nombre} ${a.alias}`) }));

const META_DIA = { kcal: 2050, proteina_g: 175, carbohidrato_g: 150, grasa_g: 79 };

const RENGLONES = [
  { id: 'c1', franja: 'desayuno', descripcion: 'Huevos revueltos con espinaca y aguacate', kcal: 420, proteina_g: 28, carbohidrato_g: 12, grasa_g: 29, origen: 'plan' },
  { id: 'c2', franja: 'comida', descripcion: 'Pechuga asada, arroz y ensalada', kcal: 610, proteina_g: 48, carbohidrato_g: 58, grasa_g: 18, origen: 'etiqueta' },
  { id: 'c3', franja: 'snack', descripcion: 'Batido de proteína', kcal: 180, proteina_g: 25, carbohidrato_g: 8, grasa_g: 3, origen: 'manual' },
  { id: 'c4', franja: 'cena', descripcion: 'Salmón con verduras', kcal: 630, proteina_g: 17, carbohidrato_g: 54, grasa_g: 21, origen: 'foto', ajustado: true },
];

const SEMANA_PREVIA = [
  { dia: menos(6), proteina_g: 168 }, { dia: menos(5), proteina_g: 141 },
  { dia: menos(4), proteina_g: 175 }, { dia: menos(3), proteina_g: 108 },
  { dia: menos(2), proteina_g: 162 }, { dia: menos(1), proteina_g: 171 },
];

const suma = (campo) => Math.round(RENGLONES.reduce((a, r) => a + Number(r[campo] || 0), 0));

const consumoDelDia = () => ({
  meta: META_DIA,
  hoy: {
    kcal: suma('kcal'), proteina_g: suma('proteina_g'),
    carbohidrato_g: suma('carbohidrato_g'), grasa_g: suma('grasa_g'),
    n_estimados: RENGLONES.filter((r) => r.origen === 'foto').length,
  },
  mostrar_kcal: true,
  renglones: RENGLONES,
  semana: [...SEMANA_PREVIA, { dia: HOY, proteina_g: suma('proteina_g') }],
});

// La fila que guarda comer.js trae nombres de columna. Aqui se traduce al
// nombre que la pantalla pinta, que no es el mismo.
const comoRenglon = (f) => ({
  id: `c${Date.now()}`,
  franja: f.franja || 'snack',
  descripcion: f.descripcion || 'Sin descripción',
  kcal: Number(f.kcal || 0),
  proteina_g: Number(f.protein_g || 0),
  carbohidrato_g: Number(f.carb_g || 0),
  grasa_g: Number(f.fat_g || 0),
  origen: f.origen || 'manual',
  ajustado: !!f.ajustado_por_paciente,
});

const CONSUMO = {
  meta: { kcal: 2050, proteina_g: 175, carbohidrato_g: 150, grasa_g: 79 },
  hoy: { kcal: 1840, proteina_g: 118, carbohidrato_g: 132, grasa_g: 71, n_estimados: 1 },
  mostrar_kcal: true,
  renglones: [
    { id: 'c1', franja: 'desayuno', descripcion: 'Huevos revueltos con espinaca y aguacate', kcal: 420, proteina_g: 28, carbohidrato_g: 12, grasa_g: 29, origen: 'plan' },
    { id: 'c2', franja: 'comida', descripcion: 'Pechuga asada, arroz y ensalada', kcal: 610, proteina_g: 48, carbohidrato_g: 58, grasa_g: 18, origen: 'etiqueta' },
    { id: 'c3', franja: 'entreno', descripcion: 'Batido de proteína', kcal: 180, proteina_g: 25, carbohidrato_g: 8, grasa_g: 3, origen: 'manual' },
    { id: 'c4', franja: 'cena', descripcion: 'Salmón con verduras', kcal: 630, proteina_g: 17, carbohidrato_g: 54, grasa_g: 21, origen: 'foto', ajustado: true },
  ],
  semana: [
    { dia: menos(6), proteina_g: 168 }, { dia: menos(5), proteina_g: 141 },
    { dia: menos(4), proteina_g: 175 }, { dia: menos(3), proteina_g: 108 },
    { dia: menos(2), proteina_g: 162 }, { dia: menos(1), proteina_g: 171 },
    { dia: HOY, proteina_g: 118 },
  ],
};

const ENTRENO = {
  nivel: 'intermedio',
  notas: ['Tu hombro derecho: nada de press por encima de la cabeza hasta que la Dra. lo revise.'],
  dias: [
    { dia: 'Lunes', foco: 'Jalón: espalda y bíceps', ejercicios: [
      { nombre: 'Dominadas asistidas', series: '4 × 8', equipo: 'Máquina asistida', musculos: 'Dorsal, bíceps', rpe: 'RPE 7',
        como: 'Cuelga con los brazos estirados, jala el pecho hacia la barra y baja contando tres segundos.',
        errores: 'Impulsarte con las piernas. Si no sale, sube la asistencia.' },
      { nombre: 'Remo con barra', series: '4 × 10', equipo: 'Barra', musculos: 'Espalda media', rpe: 'RPE 7' },
      { nombre: 'Face pull', series: '3 × 15', equipo: 'Polea', musculos: 'Hombro posterior', rpe: 'RPE 6' },
      { nombre: 'Curl martillo', series: '3 × 12', equipo: 'Mancuernas', musculos: 'Bíceps', rpe: 'RPE 7' },
    ] },
    { dia: 'Martes', foco: 'Pierna completa', ejercicios: [
      { nombre: 'Sentadilla', series: '4 × 8', equipo: 'Barra', musculos: 'Cuádriceps, glúteo', rpe: 'RPE 7',
        como: 'Pies al ancho de hombros, baja hasta que el muslo quede paralelo al piso.',
        errores: 'Meter peso antes de llegar a la profundidad.' },
      { nombre: 'Peso muerto rumano', series: '3 × 10', equipo: 'Barra', musculos: 'Isquiotibial, glúteo', rpe: 'RPE 7' },
      { nombre: 'Prensa', series: '3 × 12', equipo: 'Máquina', musculos: 'Cuádriceps', rpe: 'RPE 8' },
    ] },
    { dia: 'Jueves', foco: 'Empuje: pecho y hombro', ejercicios: [
      { nombre: 'Press de banca', series: '4 × 8', equipo: 'Barra', musculos: 'Pectoral, tríceps', rpe: 'RPE 7' },
      { nombre: 'Press inclinado con mancuernas', series: '3 × 10', equipo: 'Mancuernas', musculos: 'Pectoral superior', rpe: 'RPE 7' },
      { nombre: 'Fondos en banca', series: '3 × 12', equipo: 'Peso corporal', musculos: 'Tríceps', rpe: 'RPE 7' },
    ] },
    { dia: 'Sábado', foco: 'Pierna y glúteo', ejercicios: [
      { nombre: 'Zancadas caminando', series: '3 × 12', equipo: 'Mancuernas', musculos: 'Cuádriceps, glúteo', rpe: 'RPE 7' },
      { nombre: 'Hip thrust', series: '4 × 10', equipo: 'Barra', musculos: 'Glúteo', rpe: 'RPE 8' },
    ] },
  ],
  cardio: [{ tipo: 'Caminata rápida', dias: 'Miércoles y domingo', minutos: 40, zona: 'Zona 2' }],
};

const MENSAJES = [
  { id: 'm1', patient_id: PACIENTE.id, de: 'paciente', cuerpo: 'Doctora, llevo dos semanas con la berberina y no he sentido molestia. ¿Sigo igual?', created_at: `${menos(3)}T15:10:00Z` },
  { id: 'm2', patient_id: PACIENTE.id, de: 'medico', cuerpo: 'Perfecto, Daniel. Seguimos igual hasta el control de las 12 semanas. Lo que quiero ver bajar primero es el HOMA.', created_at: `${menos(3)}T19:02:00Z` },
  { id: 'm3', patient_id: PACIENTE.id, de: 'paciente', cuerpo: 'Va. Ya subí el estudio de la semana pasada.', created_at: `${menos(2)}T08:40:00Z` },
];

const PRESION = [
  { patient_id: PACIENTE.id, measured_at: `${menos(2)}T08:10:00Z`, sbp: 124, dbp: 78 },
  { patient_id: PACIENTE.id, measured_at: `${menos(9)}T08:05:00Z`, sbp: 131, dbp: 83 },
  { patient_id: PACIENTE.id, measured_at: `${menos(16)}T08:20:00Z`, sbp: 136, dbp: 86 },
];

const COMPO = [
  { patient_id: PACIENTE.id, measured_at: `${menos(7)}T09:00:00Z`, weight_kg: 92.1, body_fat_pct: 27.4, waist_cm: 99 },
  { patient_id: PACIENTE.id, measured_at: `${menos(35)}T09:00:00Z`, weight_kg: 95.8, body_fat_pct: 29.6, waist_cm: 104 },
  { patient_id: PACIENTE.id, measured_at: `${menos(63)}T09:00:00Z`, weight_kg: 98.4, body_fat_pct: 31.1, waist_cm: 107 },
];

const RACHA = Array.from({ length: 28 }, (_, k) => ({
  patient_id: PACIENTE.id,
  checkin_date: menos(27 - k),
  supplements_taken: (k % 7 === 3) ? { 'it-1': true } : { 'it-1': true, 'it-2': true, 'it-3': true, 'it-6': true },
}));

const ALIMENTOS = [
  { id: 'f1', name_es: 'Pechuga de pollo', kcal: 165, protein_g: 31, carb_g: 0, fat_g: 3.6, is_active: true, grupo: 'proteina' },
  { id: 'f2', name_es: 'Huevo entero', kcal: 143, protein_g: 13, carb_g: 1, fat_g: 10, is_active: true, grupo: 'proteina' },
  { id: 'f3', name_es: 'Arroz integral cocido', kcal: 123, protein_g: 2.7, carb_g: 26, fat_g: 1, is_active: true, grupo: 'carbo' },
  { id: 'f4', name_es: 'Avena', kcal: 389, protein_g: 17, carb_g: 66, fat_g: 7, is_active: true, grupo: 'carbo' },
  { id: 'f5', name_es: 'Aguacate', kcal: 160, protein_g: 2, carb_g: 9, fat_g: 15, is_active: true, grupo: 'grasa' },
  { id: 'f6', name_es: 'Aceite de oliva', kcal: 884, protein_g: 0, carb_g: 0, fat_g: 100, is_active: true, grupo: 'grasa' },
  { id: 'f7', name_es: 'Brócoli', kcal: 34, protein_g: 2.8, carb_g: 7, fat_g: 0.4, is_active: true, grupo: 'verdura' },
  { id: 'f8', name_es: 'Salmón', kcal: 208, protein_g: 20, carb_g: 0, fat_g: 13, is_active: true, grupo: 'proteina' },
];

const RECORDATORIOS = [{ patient_id: PACIENTE.id, tz: 'America/Monterrey',
  horas: { ayunas: '07:00', desayuno: '08:00', entreno: '18:00', comida: '14:00',
           cena: '20:00', dormir: '22:30' } }];

const CONEXIONES = [{
  patient_id: PACIENTE.id, proveedor: 'whoop', estado: 'activa',
  scopes: ['read:sleep', 'read:recovery', 'read:cycles'],
  ultima_sync: new Date(Date.now() - 2 * 3600000).toISOString(),
  conectado_en: `${menos(12)}T21:00:00Z`, con_problema: false,
}];

const TABLAS = {
  patients: [PACIENTE],
  user_roles: [],
  protocols: [PLAN],
  protocol_items: ITEMS,
  daily_checkins: RACHA.concat([CHECKIN]),
  catalog_foods: ALIMENTOS,
  patient_messages: MENSAJES,
  vital_signs: PRESION,
  body_composition: COMPO,
  conexiones_wearable: CONEXIONES,
  patient_reminders: RECORDATORIOS,
  food_items: CATALOGO,
  food_log: RENGLONES,
  lab_results: Array.from({ length: 51 }, (_, k) => ({ id: `l${k}`, patient_id: PACIENTE.id })),
  intakes: [{ id: 'demo-intake', patient_id: PACIENTE.id, status: 'reviewed', template_id: 'demo-tpl', started_at: `${menos(30)}T10:00:00Z`, submitted_at: `${menos(29)}T11:00:00Z` }],
  form_questions: Array.from({ length: 120 }, (_, k) => ({ id: `q${k}`, template_id: 'demo-tpl' })),
  intake_answers: Array.from({ length: 120 }, (_, k) => ({ id: `a${k}`, intake_id: 'demo-intake' })),
  orders: [],
  documents: [],
};

// Lo que ya comio este paciente ficticio y una combinacion ya armada, para que
// la demo ensene las dos listas llenas en vez de una pantalla vacia.
const RECIENTES = [
  { item_id: 'i-whey', code: 'PROTEINA_WHEY', nombre: 'Proteína en polvo (whey)', tipo: 'base',
    kcal: 114, protein_g: 23.4, carb_g: 2.1, fat_g: 1.5, fiber_g: 0, cantidad: 1, unidad: '1 scoop', veces: 9 },
  { item_id: 'i-huevo', code: 'HUEVO', nombre: 'Huevo entero', tipo: 'base',
    kcal: 143, protein_g: 12.6, carb_g: 0.7, fat_g: 9.5, fiber_g: 0, cantidad: 2, unidad: '1 pieza', veces: 6 },
  { item_id: null, code: null, nombre: 'Café con leche de almendra', tipo: 'libre',
    kcal: 45, protein_g: 1.2, carb_g: 3, fat_g: 3, fiber_g: 0.4, cantidad: 1, unidad: 'taza', veces: 4 },
  { item_id: 'i-pollo', code: 'POLLO_PECHUGA', nombre: 'Pechuga de pollo', tipo: 'base',
    kcal: 165, protein_g: 31, carb_g: 0, fat_g: 3.6, fiber_g: 0, cantidad: 1.5, unidad: '100 g', veces: 3 },
];

const COMBINACIONES = [
  { id: 'k-1', code: 'KIT_DEMO_0001', nombre: 'Licuado de la mañana', medida: '1 vaso',
    componentes: [{ code: 'PROTEINA_WHEY', g: 30 }, { code: 'FRESA', g: 100 }, { code: 'ALMENDRA', g: 15 }],
    macros: { kcal: 251, proteina_g: 27.6, carbohidrato_g: 16.7, grasa_g: 9, fibra_g: 5.2, faltantes: [] },
    veces_usado: 5 },
];

const RPC = {
  alimentos_recientes: () => RECIENTES,
  mis_combinaciones: () => COMBINACIONES,
  guardar_combinacion: ({ p_nombre }) => {
    COMBINACIONES.push({ id: 'k-' + Date.now(), code: 'KIT_DEMO_' + Date.now(), nombre: p_nombre,
      medida: '1 porción', componentes: [], macros: { proteina_g: 0 }, veces_usado: 0 });
    return COMBINACIONES.at(-1);
  },
  claim_patient_invitation: PACIENTE,
  resumen_hoy: RESUMEN,
  estado_por_sistema: SISTEMAS,
  estudios_paciente: ESTUDIOS,
  macros_objetivo: MACROS,
  consumo_del_dia: () => consumoDelDia(),
  buscar_alimento: ({ q = '', p_limite = 12 } = {}) => {
    const t = sinAcentos(q).trim();
    if (t.length < 2) return [];
    return CATALOGO.filter((a) => a.busca.includes(t)).slice(0, p_limite);
  },
  programa_entrenamiento: ENTRENO,
  estudios_faltantes: [
    { code: 'DEXA', titulo: 'DEXA de composición corporal', urgencia: 'antes_de_iniciar',
      para_el_paciente: 'Mide cuánto de lo que pesas es músculo y cuánto es grasa. Sin esto, la báscula no sabe si bajaste grasa o músculo.',
      faltan: ['masa magra', 'grasa visceral'] },
    { code: 'CTRL12', titulo: 'Control de 12 semanas: perfil metabólico', urgencia: 'conviene',
      para_el_paciente: 'Repetir glucosa, insulina, triglicéridos y PCR para ver si el plan está moviendo lo que debe mover.',
      faltan: [] },
  ],
  estado_periodico: { 'it-pep': { dias: [1, 3, 5], intervalo: null, ultima: menos(2),
                                dias_desde: 2, proxima: HOY, toca_hoy: true, atraso: 0 },
                      'it-7': { toca_hoy: hoy.getDay() === 0, ultima: menos(hoy.getDay() || 7),
                                proxima: mas(7 - (hoy.getDay() || 7)), cada_dias: 7 } },
  vincular_mi_cuenta: null,
  begin_public_intake: null,
};

/* ---------- el cliente falso ---------- */
const ok = (data, count) => Promise.resolve({ data, error: null, count: count ?? null, status: 200 });

function constructor(tabla) {
  const filtros = [];
  let cuenta = false; let soloCabeza = false; let uno = false; let limite = null; let orden = null;

  const resolver = () => {
    let filas = (TABLAS[tabla] || []).slice();
    filtros.forEach(([campo, valor]) => { filas = filas.filter((f) => f[campo] === valor); });
    if (orden) {
      const [campo, asc] = orden;
      filas.sort((x, y) => (x[campo] > y[campo] ? 1 : x[campo] < y[campo] ? -1 : 0) * (asc ? 1 : -1));
    }
    if (limite != null) filas = filas.slice(0, limite);
    const n = filas.length;
    if (soloCabeza) return ok(null, n);
    if (uno) return ok(filas[0] ?? null, cuenta ? n : null);
    return ok(filas, cuenta ? n : null);
  };

  const b = {
    select(_cols, opciones) {
      if (opciones?.count) cuenta = true;
      if (opciones?.head) soloCabeza = true;
      return b;
    },
    eq(campo, valor) { filtros.push([campo, valor]); return b; },
    neq() { return b; },
    not() { return b; },
    in() { return b; },
    is() { return b; },
    gte() { return b; },
    lte() { return b; },
    order(campo, opciones) { orden = [campo, opciones?.ascending !== false]; return b; },
    limit(n) { limite = n; return b; },
    range() { return b; },
    maybeSingle() { uno = true; return b; },
    single() { uno = true; return b; },
    // Nada sale a la red. Pero el registro de comida SI se guarda en memoria:
    // una demo donde guardas y el anillo no se mueve ensena justo lo contrario
    // de lo que hace la app. Al recargar la pagina vuelve a empezar.
    insert(fila) {
      const filas = Array.isArray(fila) ? fila : [fila];
      if (tabla === 'food_log') filas.forEach((f) => RENGLONES.push(comoRenglon(f)));
      // La presion tambien se queda: sin esto el paciente guarda y la lista no
      // crece, que es exactamente lo contrario de lo que hace la app.
      if (tabla === 'vital_signs') filas.forEach((f) => PRESION.unshift({ ...f, patient_id: PACIENTE.id }));
      const guardadas = filas.map((f, i) => ({ id: f.id || `demo-${Date.now()}-${i}`, ...f }));
      // insert(...).select('id').single() tiene que seguir encadenando.
      const enc = {
        select() { return enc; },
        single() { return ok(guardadas[0] ?? null); },
        maybeSingle() { return ok(guardadas[0] ?? null); },
        then(res, rej) { return ok(guardadas).then(res, rej); },
        catch(fn) { return ok(guardadas).catch(fn); },
        finally(fn) { return ok(guardadas).finally(fn); },
      };
      return enc;
    },
    upsert(fila) { return ok(Array.isArray(fila) ? fila : [fila]); },
    // update(...).eq(...) tiene que seguir encadenando: subir.js lo usa para
    // reclasificar un documento, y una promesa no tiene .eq.
    update() {
      const enc = {
        eq() { return enc; }, in() { return enc; }, select() { return enc; },
        single() { return ok(null); }, maybeSingle() { return ok(null); },
        then(res, rej) { return ok([]).then(res, rej); },
        catch(fn) { return ok([]).catch(fn); },
        finally(fn) { return ok([]).finally(fn); },
      };
      return enc;
    },
    delete() {
      if (tabla === 'food_log') {
        filtros.forEach(([campo, valor]) => {
          const i = RENGLONES.findIndex((r) => r[campo] === valor);
          if (i >= 0) RENGLONES.splice(i, 1);
        });
      }
      return ok([]);
    },
    then(res, rej) { return resolver().then(res, rej); },
    catch(fn) { return resolver().catch(fn); },
    finally(fn) { return resolver().finally(fn); },
  };
  return b;
}

export function clienteDemo() {
  const sesion = {
    user: { id: 'demo-user', email: PACIENTE.email, user_metadata: { full_name: 'Daniel Treviño (ficticio)' } },
    access_token: 'demo', expires_at: Math.floor(Date.now() / 1000) + 86400,
  };
  return {
    demo: true,
    auth: {
      getSession: () => ok({ session: sesion }),
      getUser: () => ok({ user: sesion.user }),
      signOut: () => ok(null),
      signInWithOtp: () => ok(null),
      signInWithOAuth: () => ok(null),
      verifyOtp: () => ok({ session: sesion }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
    from: (tabla) => constructor(tabla),
    rpc: (nombre, args) => {
      if (!(nombre in RPC)) {
        return Promise.resolve({ data: null, error: { message: `demo: ${nombre} no simulada` } });
      }
      const v = RPC[nombre];
      return ok(typeof v === 'function' ? v(args || {}) : v);
    },
    functions: {
      invoke: (nombre, opciones) => {
        if (nombre === 'sync-whoop') return ok({ detalle: [{ dias: 7 }] });
        if (nombre === 'sync-google') return ok({ detalle: [{ dias: 0 }] });
        // Lectura de foto. Se contesta lo mismo que contestaria el servidor,
        // con la confianza y el aviso incluidos: la pantalla tiene que poder
        // ensenar que una foto es ESTIMACION, no medicion.
        if (nombre === 'leer-alimento') {
          const modo = opciones?.body?.modo || 'plato';
          if (modo === 'codigo') {
            return ok({ ok: true, requiere_revision: false, aviso: 'Código leído. Compruébalo contra el empaque.',
                        lectura: { codigo: '7501030467090' } });
          }
          if (modo === 'etiqueta') {
            return ok({ ok: true, requiere_revision: false,
                        aviso: 'Transcrito de la etiqueta. Estos valores son exactos.',
                        lectura: { descripcion: 'Yogur griego natural', porcion: '1 vaso (170 g)',
                                   por_porcion: { kcal: 100, proteina_g: 17, carbohidrato_g: 6, grasa_g: 0.7 } } });
          }
          return ok({ ok: true, requiere_revision: true,
                      aviso: 'Esto es una estimación por foto, no una medición. Corrige lo que no cuadre.',
                      lectura: { descripcion: 'Pechuga asada con brócoli y arroz', confianza: 0.62,
                                 total: { kcal: 540, proteina_g: 46, carbohidrato_g: 44, grasa_g: 16 },
                                 supuestos: ['Pechuga de unos 150 g', 'Media taza de arroz', 'Sin aceite añadido visible'] } });
        }
        // Lectura del baumanometro. requiere_revision va en true a proposito:
        // un 136 leido como 186 cambia la banda de riesgo, y la pantalla tiene
        // que ensenar que el paciente confirma antes de guardar.
        if (nombre === 'leer-presion') {
          return ok({ ok: true, requiere_revision: true,
                      aviso: 'Leímos 128/82, pulso 66. Compruébalo contra la pantalla de tu aparato antes de guardar.',
                      lectura: { sistolica: 128, diastolica: 82, pulso: 66 } });
        }
        // Extraccion de un estudio. Se contesta con un valor dudoso y uno fuera
        // de catalogo: la pantalla tiene que poder decir que la medica revisa.
        if (nombre === 'extract-study') {
          return ok({ ok: true, tipo: 'laboratorio', analitos: 34, baja_confianza: 2,
                      sin_catalogo: 1, composicion: 0 });
        }
        if (nombre === 'buscar-producto') {
          return ok({ ok: true, requiere_revision: false, aviso: 'Encontrado en OpenFoodFacts.',
                      producto: { code: opciones?.body?.codigo || '7501030467090', nombre: 'Yogur griego natural',
                                  marca: 'Ejemplo', kcal: 59, protein_g: 10, carb_g: 3.6, fat_g: 0.4, fiber_g: 0,
                                  medida: 'vaso', medida_g: 170, fuente: 'openfoodfacts' } });
        }
        return ok({ error: 'En la demo esta función no se conecta de verdad.' });
      },
    },
    storage: { from: () => ({ upload: () => ok({ path: 'demo' }), remove: () => ok([]), getPublicUrl: () => ({ data: { publicUrl: '' } }) }) },
    channel: () => ({ on() { return this; }, subscribe() { return this; } }),
    removeChannel: () => {},
  };
}
