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


/* ---------------- catalogos de la Biblioteca ----------------
   La Biblioteca se agrego en v0.88 y NO se simulo en el mismo cambio, asi que
   la pestana salia vacia en la demo. Eso rompe la regla de este archivo: una
   demo que falla en silencio ensena que la app no sirve. Y ademas la demo es lo
   UNICO que puede recorrer un revisor de Google Play, porque el acceso real usa
   un codigo de un solo uso al correo.

   Es una MUESTRA, no el catalogo completo: dos suplementos, un peptido, dos
   ejercicios y los articulos. Los textos son los de la base, no inventados, y
   conservan su banda regulatoria y su banda de "sin revisar". El peptido que se
   muestra es el del plan de este paciente ficticio, para que la demo cuente una
   sola historia. El cuarto articulo va abreviado. */
const DEMO_SUPLEMENTOS = [ { "code": "MAGNESIO_GLI", "name_es": "Magnesio glicinato", "category": "mineral", "evidence_grade": "B", "purpose": "Sueño, recuperación muscular, sensibilidad a la insulina", "clase": "Mineral esencial unido a glicina, un aminoácido. Participa en más de 300 reacciones enzimáticas del cuerpo", "forma": "Bisglicinato o glicinato: el magnesio va unido a dos moléculas de glicina, lo que le permite usar las vías de absorción de aminoácidos en vez de competir por los canales de minerales. Esa es la razón de que no provoque la diarrea del óxido de magnesio. El ÓXIDO es el más barato y el peor: se absorbe alrededor del 4 por ciento y el resto se queda en el intestino jalando agua, que es por lo que funciona como laxante", "mecanismo": "Es cofactor de más de 300 enzimas, entre ellas todas las que usan ATP: en la práctica el ATP funcional es el complejo ATP-magnesio. Regula los canales de calcio y de potasio, bloquea el receptor NMDA (de ahí el efecto sobre sueño y ansiedad) y relaja el músculo liso. La glicina aporta su propio efecto sobre el sueño", "diana": "Enzimas dependientes de ATP, receptor NMDA y canales de calcio", "biodisponibilidad": "Del orden de 4 veces mejor que el óxido. La absorción del magnesio baja cuando la dosis sube, así que repartir 200 mg dos veces rinde más que 400 mg de golpe", "tiempo_efecto": "El efecto sobre sueño y calambres se nota en días a dos semanas. Reponer un déficit real de magnesio tisular tarda meses", "ciclo": "Uso continuo. No se cicla", "evidencia_resumen": "La deficiencia de magnesio es frecuente y está bien caracterizada. El bisglicinato tiene buena evidencia de absorción superior y de mejor tolerancia digestiva frente al óxido. Para calambres, estreñimiento y migraña hay ensayos de calidad variable con señal positiva", "evidencia_huecos": "La mayor parte de la evidencia es sobre corregir una deficiencia, no sobre suplementar a quien ya tiene magnesio suficiente. Los ensayos específicos de bisglicinato para ansiedad y sueño son pequeños y cortos. Y hay un problema de medición de fondo: el magnesio en sangre representa apenas el 1 por ciento del magnesio del cuerpo, así que un nivel normal en el laboratorio no descarta una deficiencia tisular", "efectos_frecuentes": "Heces blandas, mucho menos que con otras formas. Somnolencia, que en general es lo que se busca", "efectos_graves": "Hipermagnesemia, prácticamente sólo posible con insuficiencia renal: ahí sí puede llegar a arritmias y depresión respiratoria", "contraindicaciones": "Insuficiencia renal moderada o grave. Bloqueo cardiaco. Miastenia gravis", "interactions": "Separar 2 h de antibióticos y levotiroxina", "limite_superior": "El límite superior de 350 mg diarios para suplementos en adultos aplica al magnesio elemental, y existe por el efecto laxante, no por toxicidad. El magnesio de los alimentos no cuenta en ese tope", "con_que_tomarlo": "Por la noche si se busca sueño o relajación. Con comida se tolera mejor. SEPARADO al menos 2 horas del zinc, del hierro y del calcio en dosis altas, porque compiten por absorberse", "etiqueta": "Esto es lo más importante de toda la ficha: busca los mg de MAGNESIO ELEMENTAL, no los mg del compuesto. Una cápsula que dice 1000 mg de bisglicinato de magnesio aporta alrededor de 140 mg de magnesio elemental. Si la etiqueta no lo distingue, lo más probable es que el número grande sea del compuesto. Y revisa que no diga óxido en la lista de ingredientes: muchos productos mezclan glicinato con óxido para abaratar", "default_dose": "300-400 mg elemental", "default_timing": "Antes de dormir", "frequency": "Diario", "cautions": "Reducir dosis si hay diarrea. Precaución en insuficiencia renal", "alias": [ "Bisglicinato de magnesio", "Magnesium glycinate", "Quelato de magnesio" ], "is_active": true, "revisado_en": null }, { "code": "CREATINA", "name_es": "Creatina monohidratada", "category": "rendimiento", "evidence_grade": "A", "purpose": "Fuerza, masa muscular, rendimiento cognitivo", "clase": "Compuesto nitrogenado que el propio cuerpo fabrica a partir de glicina, arginina y metionina, y que además viene de la carne y el pescado", "forma": "Monohidratada. Es la única con evidencia sólida: las versiones llamadas avanzadas (HCl, kre-alkalyn, etil éster) cuestan más y ninguna ha demostrado ser mejor", "mecanismo": "Recarga el ATP. El músculo guarda creatina como fosfocreatina, que es un depósito de fosfato listo para regenerar ATP en los primeros segundos de un esfuerzo máximo. Suplementar llena ese depósito más de lo que la dieta consigue. También mete agua dentro de la célula muscular, que es lo que explica el aumento rápido de peso al inicio", "diana": "Sistema fosfocreatina-ATP en músculo y en cerebro", "biodisponibilidad": "Prácticamente completa por boca. No necesita nada especial para absorberse", "tiempo_efecto": "Con 5 g diarios el depósito se llena en 3 a 4 semanas. Con fase de carga de 20 g al día se llena en 5 a 7 días, pero el resultado final es el mismo: la carga sólo adelanta el calendario", "ciclo": "No se cicla. Es de los pocos suplementos donde el uso continuo es lo correcto. Al suspenderla, el depósito se vacía en unas 4 semanas", "evidencia_resumen": "Es, con diferencia, el suplemento deportivo con más evidencia que existe. Decenas de ensayos y varios metaanálisis muestran aumento de fuerza y de masa magra cuando acompaña al entrenamiento de resistencia, también en adultos mayores. Su seguridad se ha revisado de forma sistemática sin hallazgos relevantes", "evidencia_huecos": "El efecto sobre memoria y estado de ánimo es prometedor pero mucho menos sólido que el muscular. Hay bastantes menos estudios en mujeres que en hombres. Y aunque el mito del daño renal no tiene respaldo en personas con riñón sano, tampoco hay ensayos largos en quien ya tiene enfermedad renal: ahí la falta de datos es real", "efectos_frecuentes": "Aumento de 1 a 2 kg de peso en las primeras semanas, que es agua dentro del músculo y no grasa. Molestia digestiva si se toma mucho de golpe", "efectos_graves": "No se han documentado en personas sanas en los ensayos publicados", "contraindicaciones": "Enfermedad renal establecida, por falta de datos y no por daño demostrado", "interactions": "Ninguna relevante", "limite_superior": "No hay tope oficial. Lo estudiado va de 3 a 5 g diarios, con cargas de hasta 20 g por una semana", "con_que_tomarlo": "A cualquier hora, con o sin comida. Con carbohidrato se absorbe un poco mejor, pero la diferencia es pequeña. Lo único que importa de verdad es la constancia", "etiqueta": "Que diga MONOHIDRATO y, de preferencia, que traiga el sello Creapure. Desconfía de las mezclas donde la creatina aparece como un ingrediente más de una lista larga: ahí casi nunca llegan los 5 g", "default_dose": "5 g", "default_timing": "Cualquier hora", "frequency": "Diario", "cautions": "Aumenta creatinina sin daño renal: avisar al laboratorio", "alias": [ "Monohidrato de creatina", "Creatine monohydrate" ], "is_active": true, "revisado_en": null } ];

const DEMO_PEPTIDOS = [ { "code": "RETATRUTIDE", "name_es": "Retatrutide", "evidence_grade": "B", "regulatory_status": "investigacion", "regulatory_note": "Agonista triple en investigación clínica. No se identifica registro COFEPRIS para uso comercial. Requiere consentimiento informado específico.", "purpose": "Pérdida de grasa, control de apetito, sensibilidad a la insulina", "clase": "Agonista triple de los receptores de GLP-1, GIP y glucagón", "secuencia": null, "formula": null, "peso_molecular": null, "mecanismo": "Activa tres receptores a la vez. La rama GLP-1 reduce el apetito y enlentece el vaciamiento del estómago, la rama GIP potencia ese efecto y parece mejorar la tolerancia digestiva, y la rama de glucagón aumenta el gasto de energía. Esa tercera rama es lo que la distingue de semaglutida y de tirzepatida", "diana": "Receptores de GLP-1, de GIP y de glucagón", "vida_media": "Cerca de 6 días, que es lo que permite aplicarla una vez por semana", "tiempo_efecto": "El apetito baja en las primeras semanas. A diferencia de otros agonistas, la pérdida de peso todavía no llegaba a meseta a las 48 semanas", "ciclo": "No hay duración establecida, porque no está aprobada. En el ensayo fase 2 se usó 48 semanas con escalamiento gradual de dosis", "evidencia_resumen": "Un ensayo fase 2 aleatorizado y controlado con placebo en 338 adultos con obesidad (Jastreboff y cols., NEJM 2023) reportó una pérdida de peso promedio de 24.2 por ciento a las 48 semanas con la dosis de 12 mg: la cifra más alta publicada para un fármaco. Los ensayos fase 3 están en curso", "evidencia_huecos": "NO está aprobada en ningún país. No hay fase 3 publicada, ni datos de seguridad a largo plazo, ni desenlaces cardiovasculares. No se sabe qué pasa al suspenderla, ni cuánta masa muscular se pierde con un descenso de esa magnitud. Y lo que se consigue fuera de un ensayo clínico no tiene control de pureza ni de dosis: la etiqueta no garantiza lo que trae el vial", "efectos_frecuentes": "Náusea, vómito, diarrea y estreñimiento, más marcados al subir la dosis. Aumento de la frecuencia cardiaca", "efectos_graves": "Pancreatitis. Empeoramiento de retinopatía diabética. En roedores, tumores de células C de tiroides, un hallazgo que comparte toda la clase de los agonistas de GLP-1", "contraindicaciones": "Antecedente personal o familiar de carcinoma medular de tiroides o de neoplasia endocrina múltiple tipo 2. Pancreatitis previa. Gastroparesia. Embarazo y lactancia", "interacciones": "Al enlentecer el vaciamiento del estómago puede alterar la absorción de medicamentos orales. Con insulina o sulfonilureas, riesgo de hipoglucemia", "almacenamiento": "Refrigerada entre 2 y 8 grados, protegida de la luz", "sitios_inyeccion": "Subcutánea en abdomen, muslo o parte posterior del brazo, rotando el sitio", "typical_dose": "Escalamiento desde 2 mg", "frequency": "1 vez por semana, día fijo", "route": "subcutanea", "reconstitution_hint": "Según presentación del producto: anotar mg por vial y mL de diluyente", "monitoring": "Peso y composición corporal, glucosa, HbA1c, lipasa si hay dolor abdominal", "cautions": "Náusea, vómito, estreñimiento. Antecedente de pancreatitis, gastroparesia o carcinoma medular de tiroides lo contraindican. Riesgo de pérdida de masa magra si la proteína y la fuerza no se cuidan.", "alias": [ "LY3437943" ], "is_active": true, "revisado_en": null } ];

const DEMO_EJERCICIOS = [ { "code": "CAMINATA_POST", "name_es": "Caminata después de comer", "modality": "neat", "pattern": "glucosa posprandial", "primary_muscles": "Metabolismo", "equipment": "Ninguno", "how_to": "Camina 10 a 15 minutos al terminar cada comida principal. No necesita ser rápido.", "cautions": "Baja el pico de glucosa e insulina", "common_errors": "Sentarse de inmediato después de comer.", "sets_reps_hint": "10-15 min tras cada comida principal", "rpe_hint": "Ligero", "is_active": true, "revisado_en": null }, { "code": "CAMINATA_Z2", "name_es": "Caminata rápida en zona 2", "modality": "cardio", "pattern": "aerobico base", "primary_muscles": "Sistema cardiovascular", "equipment": "Ninguno o caminadora", "how_to": "Camina a un paso en el que puedas conversar pero no cantar. Si traes reloj, la frecuencia ronda el 60 a 70 por ciento de tu máximo.", "cautions": "Prioridad alta: es la base de la salud metabólica", "common_errors": "Ir tan rápido que ya no puedas hablar: eso deja de ser zona 2.", "sets_reps_hint": "45-60 min", "rpe_hint": "Zona 2: puede conversar", "is_active": true, "revisado_en": null } ];

const DEMO_REFERENCIAS = [ { "id": "ART-NORMAL-OPTIMO", "ambito": "general", "code": "ART-NORMAL-OPTIMO", "titulo": "¿Tus análisis salen normales? Normal no es lo mismo que óptimo", "autores": "Podcast Código Vital, con Daniela Ganoza. Invitado: Dr. Mauricio Acevedo Miño, cardiólogo", "publicacion": "YouTube · Podcast Código Vital", "anio": null, "enlace": "https://youtu.be/lCIXaktBpLg", "resumen": "Resumen de un episodio del podcast Código Vital.", "etiquetas": [ "Medicina funcional", "Biomarcadores", "Metabólico" ], "revisado_en": null, "cuerpo": [ { "t": "De quién es esto, antes de leerlo", "p": [ "Esto no lo escribió tu médica. Es el resumen de un episodio del podcast Código Vital." ] }, { "t": "La tesis: normal no es lo mismo que óptimo", "fig": "normal-vs-optimo", "p": [ "Los rangos de referencia se construyen a partir de cómo se reparte cada valor en la población actual.", "Caber dentro del rango no equivale a tener una función metabólica óptima." ] }, { "t": null, "p": [ "Glucosa en ayunas. Normal del laboratorio: 70 a 110 mg/dL. Objetivo inicial: menos de 90.", "Vitamina D. Normal: más de 30 ng/mL. Objetivo inicial: más de 60." ] }, { "t": "Dónde esto no coincide con los rangos de tu hoja", "aviso": true, "p": [ "En cuatro de esos marcadores, el objetivo del documento y el rango óptimo de tu hoja no dicen lo mismo.", "Vitamina D. Tu hoja marca el óptimo en 40 a 60 ng/mL, con techo en 60. El documento propone arriba de 60 sostenida.", "Ferritina. Tu hoja tiene piso: 50 a 150 ng/mL en hombres y 50 a 120 en mujeres." ] } ] }, { "id": "ART-SUENO", "ambito": "general", "code": "ART-SUENO", "titulo": "Cómo dormir mejor: lo que sí mueve la aguja", "resumen": "Las pocas cosas que de verdad cambian el sueño, en orden de importancia, y las que están sobrevaloradas. Incluye qué hacer si el problema ya es insomnio crónico.", "etiquetas": [ "Sueño", "Hábitos", "Salud metabólica" ], "cuerpo": [ { "t": "Empieza por la hora a la que te levantas, no por la hora a la que te acuestas", "p": [ "Acostarte a una hora fija es un buen deseo. Levantarte a una hora fija es una palanca. La hora de despertar, con luz, es la señal principal que tu reloj interno usa para acomodar todo lo demás, incluida la hora a la que te va a dar sueño esa noche.", "Elige una hora de despertar que puedas sostener los siete días, con media hora de margen el fin de semana. Si te acuestas tarde, levántate igual. Vas a dormir mal una noche y vas a recuperar la hora de dormir en tres." ], "fig": "dia-del-sueno" }, { "t": "La luz de la noche mueve tu reloj más de lo que crees", "p": [ "No hace falta una pantalla a diez centímetros de la cara. En un estudio con 116 personas, la luz normal de una habitación, menos de 200 lux, en las 8 horas antes de acostarse, retrasó el inicio de la melatonina en 99 de cada 100 personas y acortó su duración alrededor de 90 minutos.", "Lo práctico: en las dos horas antes de dormir, baja la luz de la casa en lugar de pelearte con el celular. Lámparas de piso en vez de luz de techo, modo cálido, y el cuarto oscuro de verdad para dormir. Y al revés, en la mañana sal a la luz del día en los primeros 30 a 60 minutos. Eso es lo que adelanta el reloj." ] }, { "t": "La cafeína dura mucho más de lo que la sientes", "p": [ "Que ya no te sientas despierto no significa que la cafeína se fue. En un estudio en casa, 400 mg de cafeína tomados 0, 3 o incluso 6 horas antes de la hora habitual de dormir empeoraron el sueño frente a placebo, en los tres horarios.", "Seis horas antes. Si te duermes a las 11, eso es cortar a las 5 de la tarde. Para mucha gente la regla sencilla es: nada de café después de la comida." ] }, { "t": "El alcohol no es un somnífero, es un ladrón de la segunda mitad de la noche", "p": [ "La copa de la noche acorta el tiempo que tardas en dormirte, y por eso se siente que funciona. Lo que hace después es lo caro: fragmenta la segunda mitad de la noche, suprime el sueño REM y te despierta de madrugada cuando el cuerpo termina de metabolizarlo.", "Si vas a tomar, que sea temprano y poco. Usarlo como ayuda para dormir es cambiar media hora de inicio por dos horas de calidad." ] }, { "t": "Frío, oscuro y aburrido", "p": [ "Para dormirte, tu temperatura central tiene que bajar. Un cuarto fresco ayuda a eso. Un baño o una ducha caliente una o dos horas antes también, aunque suene contradictorio: el calor manda sangre a la piel, la piel disipa calor y la temperatura central termina más baja que si no te hubieras bañado.", "Oscuro de verdad, sin la luz del cargador ni la del clima. Y aburrido: la cama es para dormir. Si llevas 20 minutos despierto y peleando, levántate, ve a otro cuarto con luz tenue y haz algo tedioso hasta que vuelva el sueño. Quedarte en la cama frustrado le enseña a tu cerebro que la cama es el lugar donde uno se frustra." ] }, { "t": "Si llevas meses durmiendo mal, el tratamiento no empieza con una pastilla", "p": [ "El tratamiento de primera línea para el insomnio crónico es la terapia cognitivo conductual para el insomnio, que se abrevia TCC-I. No es hablar de tu infancia: son técnicas concretas, sobre todo restricción del tiempo en cama y control de estímulos.", "Una revisión de 20 ensayos aleatorizados con 1,162 adultos con insomnio crónico encontró que reduce el tiempo que tardas en dormirte en unos 19 minutos, reduce el tiempo despierto a mitad de la noche en unos 26 minutos y mejora la eficiencia del sueño cerca de 10 puntos porcentuales. Esos efectos se sostienen cuando el tratamiento termina, que es justo lo que no pasa con un hipnótico.", "Si ese es tu caso, no lo resuelvas con los consejos de este artículo. Dilo en consulta." ] }, { "t": "El ejercicio ayuda, y el de la noche no es el enemigo que se dice", "p": [ "Un metaanálisis de 66 estudios encontró que el ejercicio agudo mejora el tiempo total de sueño, lo que tardas en dormirte, la eficiencia y el sueño profundo, y que el ejercicio regular mejora además la calidad percibida. Los efectos son de pequeños a moderados: real, no milagroso.", "La regla de evitar entrenar de noche aplica sobre todo a sesiones muy intensas muy pegadas a la hora de dormir. Si entrenar a las 8 de la noche es la única manera de que entrenes, entrena a las 8 de la noche." ] }, { "t": "Lo que está sobrevalorado", "p": [ "La melatonina en frasco. Es útil para desfase horario y para correr el reloj en quien se duerme muy tarde, en dosis bajas y temprano en la noche. Como pastilla para dormir en la dosis de 5 o 10 mg que se vende en la farmacia, es mucho menos de lo que promete.", "Los anillos y relojes de sueño. Sirven para ver tendencias de semanas. Sus etapas de sueño noche a noche no son confiables, y hay gente que empeora su sueño por la ansiedad de verse el puntaje cada mañana.", "Los suplementos en general. Ninguno se acerca a lo que hacen la hora fija de despertar, la luz de la mañana, cortar la cafeína y la TCC-I." ] } ], "autores": null, "publicacion": null, "anio": null, "enlace": null, "revisado_en": null }, { "id": "ART-PROTEINA", "ambito": "general", "code": "ART-PROTEINA", "titulo": "Comer más proteína ayuda a perder grasa: por qué, y cuánta", "resumen": "Con el mismo déficit de calorías, más proteína cambia de dónde sale el peso que pierdes. Qué dice el ensayo más claro, los tres mecanismos, cuánta necesitas y qué NO hace.", "etiquetas": [ "Nutrición", "Composición corporal", "Proteína" ], "cuerpo": [ { "t": "La respuesta corta", "p": [ "Sí, y el mecanismo no es que la proteína queme grasa. Es que, con el mismo déficit de calorías, comer más proteína cambia de dónde sale el peso que pierdes: más grasa y menos músculo. Y además hace que el déficit sea más llevadero.", "Sin déficit de calorías no hay pérdida de grasa, por mucha proteína que comas. La proteína no sustituye al déficit, lo hace mejor." ] }, { "t": "El ensayo que lo muestra más limpio", "p": [ "Cuarenta hombres jóvenes, cuatro semanas, una dieta con un déficit cercano al 40 por ciento de sus requerimientos, todos entrenando fuerza y haciendo intervalos de alta intensidad. La única diferencia entre los dos grupos fue la proteína: 2.4 gramos por kilo de peso al día contra 1.2.", "El grupo de proteína alta ganó 1.2 kg de masa magra. El de proteína baja ganó 0.1 kg. Y además perdió más grasa: 4.8 kg contra 3.5 kg.", "Ganar músculo mientras pierdes casi 5 kilos de grasa en cuatro semanas es poco común, y pasó con un déficit agresivo y entrenamiento controlado. Léelo como una demostración del mecanismo, no como una promesa de resultados." ], "fig": "proteina-longland" }, { "t": "Por qué funciona: tres razones, ninguna mágica", "p": [ "Saciedad. La proteína es el macronutriente que más llena por caloría. El efecto no está en una báscula, está en que a las 4 de la tarde no tienes hambre de alacena.", "Costo de digerirla. Entre el 20 y el 30 por ciento de las calorías de la proteína se gastan en procesarla, contra 5 a 10 por ciento de los carbohidratos y 0 a 3 por ciento de las grasas. Sobre 150 gramos de proteína eso son alrededor de 120 a 180 calorías al día. No cambia tu vida, pero suma en la dirección correcta.", "Protege el músculo. En déficit, el cuerpo también gasta músculo. La proteína más el entrenamiento de fuerza son las dos cosas que frenan eso. Y el músculo que conservas es el que sostiene tu gasto en reposo después, cuando dejas de hacer dieta." ] }, { "t": "Cuánta", "p": [ "Para alguien con peso normal que entrena, de 1.6 a 2.2 gramos por kilo de peso corporal al día. Dentro de ese rango no hay mucha diferencia, así que quédate donde puedas sostenerlo.", "Si tienes sobrepeso importante, el cálculo sobre el peso total se dispara. Es más razonable calcularlo sobre tu peso objetivo o usar de 1.2 a 1.5 gramos por kilo de peso actual. Esto es justo lo que conviene definir con tu médica, no con una regla de internet.", "En términos de comida: 30 a 40 gramos de proteína por comida son unos 150 gramos de pollo o pescado, o 5 huevos, o 200 gramos de yogur griego más un scoop de proteína." ] }, { "t": "Cómo repartirla", "p": [ "Tres o cuatro tomas de 30 a 40 gramos funcionan mejor que una sola comida enorme con todo. No porque el cuerpo desperdicie lo demás, sino porque es más fácil llegar al total y porque cada toma suficiente dispara la síntesis de proteína muscular.", "La que más se le olvida a la gente es la del desayuno. Un desayuno de 10 gramos de proteína te deja persiguiendo el total el resto del día." ] }, { "t": "Lo que la proteína NO hace", "p": [ "No es un quemagrasa. Si comes más proteína encima de lo que ya comías, sin quitar nada, subes de peso.", "No compensa no entrenar fuerza. El efecto grande sobre la composición corporal aparece cuando van juntas.", "No hace falta tomarla en los 30 minutos después de entrenar. Esa ventana resultó ser mucho más ancha de lo que se creía. Lo que cuenta es el total del día." ] }, { "t": "¿Y el riñón?", "p": [ "En personas con función renal normal, no hay evidencia de que una dieta alta en proteína dañe el riñón. La creencia viene de extrapolar lo que sí pasa en personas que ya tienen enfermedad renal.", "Si tienes enfermedad renal conocida, o tu filtrado glomerular está bajo, esto cambia por completo y la cantidad de proteína se individualiza. No lo decidas con este artículo." ] } ], "autores": null, "publicacion": null, "anio": null, "enlace": null, "revisado_en": null }, { "id": "ART-INCLINADO", "ambito": "general", "code": "ART-INCLINADO", "titulo": "Caminar inclinado: por qué sirve, y por qué no es por quemar más grasa", "resumen": "La zona quemagrasa es un malentendido entre porcentaje y gramos. La caminata inclinada sigue siendo excelente, pero por razones distintas. Cómo usarla.", "etiquetas": [ "Ejercicio", "Cardio", "Composición corporal" ], "cuerpo": [ { "t": "La respuesta incómoda, primero", "p": [ "No. Caminar inclinado no quema más grasa que correr. Quema un porcentaje mayor de grasa, que no es lo mismo, y es de donde viene toda la confusión.", "Dicho eso, caminar inclinado sí es una de las mejores herramientas que existen para perder grasa. Sólo que por razones distintas a las que se dicen, y vale la pena entender cuáles, porque esas razones cambian cómo deberías usarlo." ] }, { "t": "Porcentaje contra gramos", "p": [ "A intensidad baja, una mayor proporción de la energía que usas viene de la grasa. A intensidad alta, esa proporción cae y predomina el carbohidrato. Eso es cierto y está bien medido.", "Lo que se omite es que el total crece mucho más rápido que lo que cae el porcentaje. Un ejemplo con números redondos: caminando quemas 300 calorías en una hora y el 60 por ciento viene de grasa, o sea 180. Corriendo quemas 600 en esa hora y el 40 por ciento viene de grasa, o sea 240. El porcentaje de la caminata es mejor. Los gramos de grasa de la carrera son más.", "Y hay algo más: el cuerpo no cierra las cuentas al terminar la sesión, las cierra al final del día. Si en el entrenamiento usaste más carbohidrato, en las horas siguientes oxidas más grasa. Lo que queda de pie al final del día es el balance de energía, no de qué sustrato salió la energía durante esos 45 minutos." ], "fig": "grasa-caminar-correr" }, { "t": "El punto de cruce", "p": [ "La idea tiene nombre desde 1994: el concepto de cruce. Describe el punto de intensidad donde el combustible principal pasa de la grasa al carbohidrato. En personas entrenadas en resistencia, por debajo de alrededor del 45 por ciento del VO2 máximo predomina la grasa, y cerca del 75 por ciento predomina el carbohidrato.", "El concepto es real y es útil para entender el metabolismo del ejercicio. Lo que nunca dijo es que entrenar por debajo del cruce haga perder más grasa corporal. Esa parte se la agregó la industria del fitness." ] }, { "t": "La zona quemagrasa tampoco predice quién adelgaza", "p": [ "Existe una prueba de laboratorio que identifica la intensidad donde cada persona oxida más grasa por minuto. Se le llama Fatmax. Cuando se ha evaluado si prescribir el entrenamiento a esa intensidad da mejores resultados que otras formas de prescribirlo, el beneficio ha resultado limitado.", "Si ni siquiera medir tu zona quemagrasa con un analizador de gases mejora el resultado, la zona que te marca la caminadora del gimnasio con tu edad y tu frecuencia cardiaca no va a hacerlo." ] }, { "t": "Entonces, ¿por qué sí vale la pena caminar inclinado?", "p": [ "Porque el gasto es alto para lo poco que cuesta. Subir la inclinación al 10 o 12 por ciento a 5 km por hora pone tu gasto cerca del de un trote suave, sin la fase de vuelo. Esa es la diferencia: al caminar siempre hay un pie en el piso, así que no hay impacto de aterrizaje.", "Porque no compite con tu entrenamiento de fuerza. Correr fuerte y en volumen interfiere con la recuperación de las piernas. Caminar inclinado casi no.", "Porque lo puedes hacer todos los días, y eso es lo que de verdad mueve el gasto semanal. Treinta minutos diarios suman más que dos sesiones heroicas a las que faltas la mitad de las veces.", "Porque el esfuerzo percibido es bajo. Puedes sostener una conversación, oír un podcast, contestar correos. La adherencia es el factor que más predice el resultado a seis meses, y ninguna sesión funciona mejor que la que sí haces.", "Porque si tienes rodillas, cadera o espalda sensibles, o sobrepeso importante, es de las pocas maneras de acumular gasto sin pagar la carga articular de correr." ] }, { "t": "Cómo hacerlo", "p": [ "Inclinación entre 8 y 15 por ciento, velocidad entre 4.5 y 6 km por hora, de 30 a 45 minutos. El punto correcto es donde puedes hablar en frases completas pero no cantar.", "No te agarres del barandal. Agarrarte quita entre el 20 y el 30 por ciento del trabajo y te deja con una cifra bonita en la pantalla y menos gasto real. Si no puedes soltarte, baja la inclinación hasta que puedas.", "De tres a cinco veces por semana, además de dos o tres sesiones de fuerza. La fuerza no es opcional aquí: es lo que decide cuánto del peso que pierdes es grasa." ] }, { "t": "Qué decide de verdad la pérdida de grasa", "p": [ "El balance de energía de la semana, no el porcentaje de grasa oxidada durante la sesión.", "La proteína y el entrenamiento de fuerza, que deciden cuánto de lo que pierdes es grasa y cuánto es músculo.", "El sueño y el alcohol, que mueven el hambre y la adherencia más de lo que mueve la elección entre caminar y correr.", "Haz la modalidad que puedas sostener. Si eso es caminar inclinado, es una excelente elección. Sólo que no por quemar más grasa." ] } ], "autores": null, "publicacion": null, "anio": null, "enlace": null, "revisado_en": null }, { "id": "https://pubmed.ncbi.nlm.nih.gov/26054060/", "ambito": "general", "code": "ART-SUENO", "titulo": "Cognitive Behavioral Therapy for Chronic Insomnia: A Systematic Review and Meta-analysis", "resumen": "Veinte ensayos aleatorizados, 1,162 adultos con insomnio cronico. La TCC-I redujo el tiempo para dormirse 19.0 minutos, el tiempo despierto a media noche 26.0 minutos y mejoro la eficiencia del sueno 9.9 puntos porcentuales.", "etiquetas": null, "cuerpo": null, "autores": null, "publicacion": "Annals of Internal Medicine", "anio": 2015, "enlace": "https://pubmed.ncbi.nlm.nih.gov/26054060/", "revisado_en": null }, { "id": "https://pmc.ncbi.nlm.nih.gov/articles/PMC3047226", "ambito": "general", "code": "ART-SUENO", "titulo": "Exposure to Room Light before Bedtime Suppresses Melatonin Onset and Shortens Melatonin Duration in Humans", "resumen": "En 116 adultos de 18 a 30 anos, la luz de habitacion (menos de 200 lux) en las 8 horas previas a dormir retraso el inicio de la melatonina en 99.0 por ciento de las personas y acorto su duracion unos 90 minutos.", "etiquetas": null, "cuerpo": null, "autores": "Gooley JJ, Chamberlain K, Smith KA, Khalsa SBS, Rajaratnam SMW, Van Reen E, Zeitzer JM, Czeisler CA, Lockley SW", "publicacion": "The Journal of Clinical Endocrinology & Metabolism", "anio": 2011, "enlace": "https://pmc.ncbi.nlm.nih.gov/articles/PMC3047226", "revisado_en": null }, { "id": "https://pubmed.ncbi.nlm.nih.gov/25596964/", "ambito": "general", "code": "ART-SUENO", "titulo": "The effects of physical activity on sleep: a meta-analytic review", "resumen": "Metaanalisis de 66 estudios. El ejercicio agudo tuvo efectos pequenos sobre tiempo total de sueno, latencia, eficiencia y sueno profundo, y moderado sobre el tiempo despierto tras dormirse. El ejercicio regular mejoro ademas la calidad percibida.", "etiquetas": null, "cuerpo": null, "autores": null, "publicacion": "Journal of Behavioral Medicine", "anio": 2015, "enlace": "https://pubmed.ncbi.nlm.nih.gov/25596964/", "revisado_en": null }, { "id": "https://pubmed.ncbi.nlm.nih.gov/26817506/", "ambito": "general", "code": "ART-PROTEINA", "titulo": "Higher compared with lower dietary protein during an energy deficit combined with intense exercise promotes greater lean mass gain and fat mass loss: a randomized trial", "resumen": "Cuarenta hombres jovenes, 4 semanas, deficit cercano al 40 por ciento, con fuerza e intervalos. Con 2.4 g/kg/dia de proteina la masa magra subio 1.2 kg contra 0.1 kg con 1.2 g/kg/dia, y la grasa bajo 4.8 kg contra 3.5 kg.", "etiquetas": null, "cuerpo": null, "autores": "Longland TM, Oikawa SY, Mitchell CJ, Devries MC, Phillips SM", "publicacion": "The American Journal of Clinical Nutrition", "anio": 2016, "enlace": "https://pubmed.ncbi.nlm.nih.gov/26817506/", "revisado_en": null }, { "id": "https://pubmed.ncbi.nlm.nih.gov/16046715/", "ambito": "general", "code": "ART-PROTEINA", "titulo": "Dietary protein and exercise have additive effects on body composition during weight loss in adult women", "resumen": null, "etiquetas": null, "cuerpo": null, "autores": null, "publicacion": null, "anio": null, "enlace": "https://pubmed.ncbi.nlm.nih.gov/16046715/", "revisado_en": null }, { "id": "https://pubmed.ncbi.nlm.nih.gov/18589032/", "ambito": "general", "code": "ART-PROTEINA", "titulo": "Lean mass loss is associated with low protein intake during dietary-induced weight loss in postmenopausal women", "resumen": null, "etiquetas": null, "cuerpo": null, "autores": null, "publicacion": null, "anio": null, "enlace": "https://pubmed.ncbi.nlm.nih.gov/18589032/", "revisado_en": null }, { "id": "https://pubmed.ncbi.nlm.nih.gov/7928844/", "ambito": "general", "code": "ART-INCLINADO", "titulo": "Balance of carbohydrate and lipid utilization during exercise: the crossover concept", "resumen": "Articulo de revision que introduce el concepto de cruce. En personas entrenadas en resistencia, por debajo de cerca del 45 por ciento del VO2 maximo predomina el lipido como sustrato, y alrededor del 75 por ciento predomina el carbohidrato.", "etiquetas": null, "cuerpo": null, "autores": null, "publicacion": "Journal of Applied Physiology", "anio": 1994, "enlace": "https://pubmed.ncbi.nlm.nih.gov/7928844/", "revisado_en": null }, { "id": "https://pubmed.ncbi.nlm.nih.gov/24022578/", "ambito": "general", "code": "ART-INCLINADO", "titulo": "Limited benefit of Fatmax-test to derive training prescriptions", "resumen": null, "etiquetas": null, "cuerpo": null, "autores": null, "publicacion": null, "anio": null, "enlace": "https://pubmed.ncbi.nlm.nih.gov/24022578/", "revisado_en": null }, { "id": "https://pubmed.ncbi.nlm.nih.gov/11842071/", "ambito": "general", "code": "ART-INCLINADO", "titulo": "Effect of exercise training at different intensities on fat metabolism of obese men", "resumen": null, "etiquetas": null, "cuerpo": null, "autores": null, "publicacion": null, "anio": null, "enlace": "https://pubmed.ncbi.nlm.nih.gov/11842071/", "revisado_en": null } ];

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
  catalog_supplements: DEMO_SUPLEMENTOS,
  catalog_peptides: DEMO_PEPTIDOS,
  catalog_exercises: DEMO_EJERCICIOS,
  catalog_referencias: DEMO_REFERENCIAS,
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
