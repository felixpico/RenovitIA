// Datos ficticios para la vista previa del panel médico (?demo=1). Nada se guarda.
const now = Date.now();
const iso = (minAgo) => new Date(now - minAgo * 60000).toISOString();
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));

const DOC = { user_id: 'doc-1', full_name: 'Dra. Paula Méndez (demo)', cedula_profesional: '12345678', specialty: 'Medicina interna' };

const PATIENTS = [
  { id: 'p-roberto', first_name: 'Roberto', last_name: 'Garza (ficticio)', email: 'roberto@ejemplo.mx', phone: '8111111111', birth_date: '1978-05-10', sex_at_birth: 'M', status: 'onboarding', assigned_physician_id: 'doc-1', updated_at: iso(300) },
  { id: 'p-mariana', first_name: 'Mariana', last_name: 'López (ficticia)', email: 'mariana@ejemplo.mx', phone: '8122222222', birth_date: '1990-02-14', sex_at_birth: 'F', status: 'onboarding', assigned_physician_id: 'doc-1', updated_at: iso(40) },
  { id: 'p-daniel', first_name: 'Daniel', last_name: 'Treviño (ficticio)', email: 'daniel@ejemplo.mx', phone: '8133333333', birth_date: '1985-09-01', sex_at_birth: 'M', status: 'onboarding', assigned_physician_id: 'doc-1', updated_at: iso(1500) },
  { id: 'p-lucia', first_name: 'Lucía', last_name: 'Salinas (ficticia)', email: 'lucia@ejemplo.mx', phone: '8144444444', birth_date: null, sex_at_birth: 'F', status: 'invited', assigned_physician_id: 'doc-1', updated_at: iso(3000) },
];

const INTAKES = [
  { id: 'i-roberto', patient_id: 'p-roberto', template_id: 'demo-template', status: 'submitted', started_at: iso(400), submitted_at: iso(300), review_notes: '' },
  { id: 'i-mariana', patient_id: 'p-mariana', template_id: 'demo-template', status: 'submitted', started_at: iso(90), submitted_at: iso(40), review_notes: '' },
  { id: 'i-daniel', patient_id: 'p-daniel', template_id: 'demo-template', status: 'in_progress', started_at: iso(1500), submitted_at: null, review_notes: '' },
];

const ANSWERS = {
  'i-roberto': {
    '0.1': true, '0.2': { name: 'Roberto Garza', accepted: true, at: iso(395) }, '0.3': 'Sí',
    A1: 'Roberto Garza', A2: '1978-05-10', A3: 'Masculino', A5: { telefono: '8111111111', correo: 'roberto@ejemplo.mx' }, A6: 'San Pedro', A7: { ocupacion: 'Director comercial', tipo: 'Sedentario' }, A8: 'Rotativo',
    B1: { selected: ['Perder grasa', 'Más energía', 'Mejorar análisis (colesterol, glucosa)'], other: '', detail: '' }, B2: 8, B4: '30–60',
    C1: { peso_kg: 98, estatura_cm: 175 }, C2: 96, C3: { peso_6m: 105, peso_12m: 104, intencional: 'No intencional' }, C4: { sistolica: 150, diastolica: 95 },
    D1: { members: ['Madre'], none: false, unknown: false }, D3: { members: ['Padre'], none: false, unknown: false, detail: 'Infarto a los 52' }, D5: { members: [], none: true },
    E2: { selected: ['diabetes tipo 2', 'hígado graso'], none: false, other: '', detail: 'Diagnóstico 2021, en tratamiento' },
    H2: { selected: ['Metformina', 'Glibenclamida'], none: false, other: '', detail: 'Metformina 850 mg c/12 h; glibenclamida 5 mg AM' },
    J1: ['Penicilina'], L1: { items: [1, 1, 0, 0, 0, 0, 1, 0, 1, 0] }, L2: 'Frecuente',
    M5: { items: { 'antojos de azúcar': 3, 'hambre a las 2 h de comer': 1, 'temblor/mareo si no come': 1 } },
    M6: { skipped: true }, Q4: { skipped: true },
    M11: { items: { 'Dolor u opresión en el pecho con esfuerzo': 'No', Desmayo: 'No', 'Sangre en heces u orina': 'No', 'Vómito con sangre': 'No', 'Falta de aire en reposo': 'No', 'Fiebre o sudoración nocturna sin causa': 'No', 'Un bulto nuevo': 'No' } },
    N1: { items: [1, 0, 0, 1, 1, 0, 0] }, N2: { dias: 1, minutos: 30 }, N3: { dias: 2, minutos: 30 }, N4: { dias: 5, minutos: 20 }, N5: { horas: 9 },
    O1: { acostarse: '23:30', levantarse: '06:00' }, O2: { acostarse: '02:00', levantarse: '10:30' }, O11: { items: [1, 1, 1, 1, 0, 0, 1, 1] },
    P1: { items: [2, 3, 3, 1, 1, 3, 1, 1, 2, 3] }, P2: { items: [2, 2, 1, 2, 1, 1, 1, 0] }, P3: { items: [1] }, P4: { items: [2, 2, 2, 1, 1, 2, 1] },
    Q1: 'Omnívoro', Q8: { items: [3, 2, 1] }, Q9: { items: [0, 0, 0, 0, 0] }, R1: { estado: 'Vapeo', cantidad: 10, anios: 3 },
    Z1: true, Z2: true,
  },
  'i-mariana': {
    '0.1': true, '0.2': { name: 'Mariana López', accepted: true, at: iso(88) }, '0.3': 'Sí',
    A1: 'Mariana López', A2: '1990-02-14', A3: 'Femenino', B1: { selected: ['Dormir mejor', 'Manejar estrés', 'Salud hormonal'], other: '', detail: '' },
    C1: { peso_kg: 61, estatura_cm: 163 }, C4: { sistolica: 118, diastolica: 76 },
    K1: 'No', K3: { regular: 'No', ciclo_dias: 42, sangrado_dias: 6 }, K5: { selected: ['Sangrado abundante'], none: false, other: '' },
    M9: { items: { palpitaciones: 2, 'falta de aire': 0, 'hinchazón de piernas': 0 } },
    M11: { items: { 'Dolor u opresión en el pecho con esfuerzo': 'Sí', Desmayo: 'No', 'Sangre en heces u orina': 'No', 'Vómito con sangre': 'No', 'Falta de aire en reposo': 'No', 'Fiebre o sudoración nocturna sin causa': 'No', 'Un bulto nuevo': 'No' } },
    P2: { items: [1, 1, 2, 2, 1, 0, 1, 0] }, P3: { items: [0] }, P4: { items: [2, 3, 2, 3, 2, 2, 1] },
    Z1: true, Z2: true,
  },
  'i-daniel': { '0.1': true, '0.2': { name: 'Daniel Treviño', accepted: true, at: iso(1490) }, '0.3': 'Sí', A1: 'Daniel Treviño', A3: 'Masculino', C1: { peso_kg: 82, estatura_cm: 180 } },
};

const ALERTS = [
  ['i-roberto', 'urgent', 'P3_U', 'Ideación de muerte o autolesión', 'PHQ-9 reactivo 9 = 1 (varios días)', 'Cualquier valor > 0 → recursos de crisis + contacto el mismo día', 310],
  ['i-roberto', 'block', 'H2_B', 'Insulina o sulfonilurea', 'Metformina, Glibenclamida', 'Riesgo de hipoglucemia con ayuno o dieta baja en carbohidratos', 300],
  ['i-roberto', 'block', 'E2_B', 'Diabetes diagnosticada', 'diabetes tipo 2, hígado graso', 'Sin ayunos ni restricción de carbohidratos sin médico', 300],
  ['i-roberto', 'block', 'C3_B', 'Pérdida de peso no intencional > 5 %', '105 kg → 98 kg en 6 meses (6.7 %), intencional: No intencional', 'Consulta antes de protocolo', 300],
  ['i-roberto', 'block', 'O11_B', 'Riesgo alto de apnea (STOP-BANG ≥ 5)', 'STOP-BANG = 6', 'Derivar a estudio de sueño', 300],
  ['i-roberto', 'block', 'P2_B', 'PHQ-9 ≥ 10', 'PHQ-9 = 11 (moderada)', '≥ 10 consulta; ≥ 15 derivación', 300],
  ['i-roberto', 'block', 'P4_B', 'GAD-7 ≥ 10', 'GAD-7 = 11 (moderada)', 'Consulta; evitar estimulantes', 300],
  ['i-roberto', 'block', 'N1_B', 'PAR-Q+ positivo', '3 respuesta(s) afirmativa(s) en PAR-Q+', 'Autorización médica antes de ejercicio intenso', 300],
  ['i-roberto', 'prioritize', 'C4_P', 'Presión arterial elevada', 'Presión reportada 150/95', 'Confirmar en consulta', 300],
  ['i-roberto', 'prioritize', 'D3_P', 'Familiar con evento cardiovascular', 'Evento CV: Padre', 'Lp(a) y ApoB obligatorios', 300],
  ['i-roberto', 'prioritize', 'C2_P', 'Cintura/estatura ≥ 0.5', 'Cintura 96 cm / estatura 175 cm = 0.55', 'Riesgo cardiometabólico', 300],
  ['i-roberto', 'prioritize', 'L1_P', 'ADAM positivo', 'ADAM positivo (4 de 10)', 'Panel androgénico completo', 300],
  ['i-roberto', 'prioritize', 'Q8_P', 'AUDIT-C positivo', 'AUDIT-C = 6 (positivo)', 'Módulo de alcohol en protocolo', 300],
  ['i-roberto', 'prioritize', 'R1_P', 'Fumador o vapeador actual', 'Vapeo · 10 al día · 3 años', 'Módulo de cesación', 300],
  ['i-mariana', 'urgent', 'M11_U', 'Síntomas de alarma', 'Marcó: Dolor u opresión en el pecho con esfuerzo', 'Acudir a atención médica hoy', 42],
  ['i-mariana', 'block', 'M9_B', 'Palpitaciones o edema frecuentes', 'palpitaciones (2)', 'Consulta', 40],
  ['i-mariana', 'block', 'P4_B', 'GAD-7 ≥ 10', 'GAD-7 = 15 (severa)', 'Consulta; evitar estimulantes', 40],
  ['i-mariana', 'prioritize', 'K3_P', 'Ciclo menstrual irregular', 'Regular: No · ciclo 42 días', 'Prioriza SOP/tiroides/prolactina', 40],
  ['i-mariana', 'prioritize', 'K5_P', 'Sangrado menstrual abundante', 'Sangrado abundante', 'Ferritina prioritaria', 40],
].map(([intake, level, rule, title, detail, action, min]) => {
  const it = INTAKES.find((i) => i.id === intake);
  const p = PATIENTS.find((x) => x.id === it.patient_id);
  return { id: uuid(), intake_id: intake, patient_id: p.id, patient_name: `${p.first_name} ${p.last_name}`, phone: p.phone, email: p.email, level, status: 'open', rule_code: rule, title, detail, action_physician: action, created_at: iso(min) };
});

const SCORES = {
  'i-roberto': [['PHQ9', 11, 'moderada'], ['GAD7', 11, 'moderada'], ['PSS10', 28, 'alto'], ['STOPBANG', 6, 'alto'], ['AUDITC', 6, 'positivo'], ['SCOFF', 0, 'negativo'], ['PARQ', 3, 'requiere autorización'], ['ADAM', 4, 'positivo'], ['IPAQ', 810, 'moderada'], ['IMC', 32, 'obesidad I'], ['CINTURA_ESTATURA', 0.55, 'riesgo']],
  'i-mariana': [['PHQ9', 8, 'leve'], ['GAD7', 15, 'severa'], ['IMC', 23, 'normal']],
};

const PROVIDERS = [
  { id: 'prov-body', name: 'BodyStats', provider_type: 'dexa' },
  { id: 'prov-swiss', name: 'Swisslab', provider_type: 'lab' },
  { id: 'prov-chopo', name: 'Chopo Empresas', provider_type: 'both' },
  { id: 'prov-lapi', name: 'Lapi', provider_type: 'lab' },
];
const SUGGEST_BY_RULE = { D3_P: [['APOB', 'LPA', 'HSCRP'], 'Evento cardiovascular en la familia'], L1_P: [['TT', 'SHBG', 'LH', 'FSH', 'PRL', 'E2'], 'ADAM positivo'], E2_B: [['HBA1C', 'INS', 'CYSC'], 'Diabetes diagnosticada'], P2_B: [['TSH', 'FT4', 'VITD', 'B12', 'FERRITIN'], 'Descartar causas orgánicas de síntomas depresivos'], K3_P: [['PRL', 'TSH', 'TT', 'SHBG'], 'Ciclo irregular'], K5_P: [['FERRITIN', 'HGB'], 'Sangrado abundante'], P4_B: [['TSH', 'FT4'], 'Descartar hipertiroidismo como causa de ansiedad'] };
const ORDERS = [
  { id: 'o-rob-lab', patient_id: 'p-roberto', provider_id: 'prov-swiss', order_type: 'lab', round: 'baseline', folio: 'RNV-2026-00001', status: 'results_received', indications: 'Ayuno de 10 a 12 horas (sólo agua).\nToma de muestra entre 7:00 y 9:00 am.', signed_by: 'doc-1', signed_at: iso(240), sample_taken_at: iso(200), results_received_at: iso(60), cost_mxn: 7850, created_at: iso(250) },
  { id: 'o-rob-dexa', patient_id: 'p-roberto', provider_id: 'prov-body', order_type: 'dexa', round: 'baseline', folio: 'RNV-2026-00002', status: 'scheduled', indications: 'Ropa cómoda sin partes metálicas.', signed_by: 'doc-1', signed_at: iso(238), scheduled_at: new Date(now + 2 * 86400000).toISOString(), cost_mxn: 1200, created_at: iso(245) },
];
const ITEMS = [
  ...['GLU', 'INS', 'HBA1C', 'APOB', 'LPA', 'TG', 'HDL', 'LDL', 'HSCRP', 'TT', 'SHBG', 'VITD', 'FERRITIN', 'TSH'].map((c) => ({ id: uuid(), order_id: 'o-rob-lab', biomarker_id: `b-${c}`, study_name: c })),
  { id: uuid(), order_id: 'o-rob-dexa', biomarker_id: null, study_name: 'Composición corporal DEXA (cuerpo completo)' },
];
const RESULTS = [
  ['GLU', 132, 'mg/dL', 70, 99], ['INS', 21.4, 'µUI/mL', 2.6, 24.9], ['HBA1C', 7.1, '%', 4, 5.6], ['APOB', 118, 'mg/dL', 52, 109], ['LPA', 142, 'nmol/L', null, 75],
  ['TG', 238, 'mg/dL', null, 150], ['HDL', 36, 'mg/dL', 40, null], ['LDL', 128, 'mg/dL', null, 100], ['HSCRP', 4.2, 'mg/L', null, 3], ['TT', 298, 'ng/dL', 264, 916],
  ['SHBG', 22, 'nmol/L', 16.5, 55.9], ['VITD', 19, 'ng/mL', 30, 100], ['FERRITIN', 310, 'ng/mL', 30, 400], ['TSH', 2.1, 'µUI/mL', 0.4, 4],
].map(([c, v, u, lo, hi]) => ({ id: uuid(), patient_id: 'p-roberto', order_id: 'o-rob-lab', biomarker_id: `b-${c}`, raw_name: c, value_numeric: v, unit: u, lab_reference_low: lo, lab_reference_high: hi, collected_at: iso(200).slice(0, 10) }));
const BODYCOMP = [];
const DOCUMENTS = [{ id: uuid(), patient_id: 'p-roberto', order_id: 'o-rob-lab', kind: 'lab_report', storage_path: 'demo', original_filename: 'Swisslab_Roberto_Garza.pdf', created_at: iso(60) }];
let biomarkers = null;
async function loadBiomarkers() {
  if (!biomarkers) { const list = await (await fetch('assets/data/biomarkers.demo.json')).json(); biomarkers = list; for (const it of ITEMS) { const b = list.find((x) => x.id === it.biomarker_id); if (b) it.study_name = b.name_es; } for (const r of RESULTS) { const b = list.find((x) => x.id === r.biomarker_id); if (b) r.raw_name = b.name_es; } }
  return biomarkers;
}

let template = null;
async function loadTemplate() {
  if (!template) template = await (await fetch('assets/data/form-v0.2.demo.json')).json();
  return template;
}

export const demoApi = {
  async me() { return { id: 'doc-1', email: 'medico@demo.mx', roles: ['physician'], physician: DOC }; },
  async alerts() { return ALERTS.map((a) => ({ ...a })).sort((a, b) => ({ urgent: 0, block: 1, prioritize: 2 }[a.level] - { urgent: 0, block: 1, prioritize: 2 }[b.level]) || b.created_at.localeCompare(a.created_at)); },
  async updateAlert(id, patch) { Object.assign(ALERTS.find((a) => a.id === id), patch); },
  async patients() { return { patients: PATIENTS, intakes: INTAKES, alerts: ALERTS }; },
  async physicians() { return [DOC]; },
  async invite(row) { const p = { id: uuid(), updated_at: new Date().toISOString(), ...row }; PATIENTS.unshift(p); return p; },
  async patient(id) {
    const t = await loadTemplate();
    const patient = PATIENTS.find((p) => p.id === id);
    if (!patient) throw new Error('Paciente no encontrado');
    const intake = INTAKES.find((i) => i.patient_id === id) || null;
    const byCode = new Map(t.questions.map((q) => [q.question_code, q]));
    const answers = intake ? Object.entries(ANSWERS[intake.id] || {}).map(([code, value]) => ({ question_id: byCode.get(code)?.id, value })).filter((a) => a.question_id) : [];
    const scores = intake ? (SCORES[intake.id] || []).map(([instrument, score, category]) => ({ instrument, score, category })) : [];
    const consents = intake ? ['privacy_notice', 'international_transfer', 'informed_consent', 'data_sharing'].map((c) => ({ consent_type: c, accepted: true, accepted_at: intake.started_at })) : [];
    return { patient, intake, sections: t.sections, questions: t.questions, answers, scores, alerts: ALERTS.filter((a) => a.patient_id === id), consents };
  },
  async updateIntake(id, patch) { Object.assign(INTAKES.find((i) => i.id === id), patch); },
  async reevaluate() { return { new_alerts: 0 }; },
  async studies(patientId) {
    const bms = await loadBiomarkers();
    const orders = ORDERS.filter((o) => o.patient_id === patientId).sort((a, b) => b.created_at.localeCompare(a.created_at));
    return { orders, items: ITEMS.filter((i) => orders.some((o) => o.id === i.order_id)), providers: PROVIDERS, documents: DOCUMENTS.filter((d) => d.patient_id === patientId), results: RESULTS.filter((r) => r.patient_id === patientId), bodycomp: BODYCOMP.filter((b) => b.patient_id === patientId), biomarkers: bms };
  },
  async suggest(patientId) {
    const bms = await loadBiomarkers();
    const p = PATIENTS.find((x) => x.id === patientId);
    const age = p.birth_date ? Math.floor((now - new Date(p.birth_date)) / 31557600000) : null;
    const extra = new Map();
    ALERTS.filter((a) => a.patient_id === patientId && ['open', 'acknowledged'].includes(a.status)).forEach((a) => {
      const m = SUGGEST_BY_RULE[a.rule_code]; if (!m) return;
      m[0].forEach((c) => { if (!extra.has(c)) extra.set(c, []); extra.get(c).push(m[1]); });
    });
    return bms.filter((b) => (!b.sex_specific || !p.sex_at_birth || b.sex_specific === p.sex_at_birth) && !['HOMA_IR', 'TG_HDL', 'NONHDL', 'EGFR', 'FT_CALC'].includes(b.code))
      .map((b) => ({ biomarker_id: b.id, code: b.code, name_es: b.name_es, category: b.category, panel_tier: b.panel_tier,
        suggested: (b.panel_tier != null && (!['PSA', 'FPSA'].includes(b.code) || (age ?? 0) >= 45)) || extra.has(b.code),
        reasons: extra.get(b.code) || (b.panel_tier ? [`Panel base nivel ${b.panel_tier}`] : []) }));
  },
  async createOrder(order, items) { const o = { id: uuid(), status: 'draft', folio: null, created_at: new Date().toISOString(), ...order }; ORDERS.push(o); items.forEach((i) => ITEMS.push({ id: uuid(), order_id: o.id, ...i })); return o; },
  async signOrder(id) { const o = ORDERS.find((x) => x.id === id); Object.assign(o, { status: 'signed', signed_by: 'doc-1', signed_at: new Date().toISOString(), folio: `RNV-2026-${String(ORDERS.filter((x) => x.folio).length + 1).padStart(5, '0')}` }); },
  async updateOrder(id, patch) { Object.assign(ORDERS.find((x) => x.id === id), patch); },
  async deleteOrder(id) { const i = ORDERS.findIndex((x) => x.id === id); if (i >= 0) ORDERS.splice(i, 1); },
  async saveResults(rows) { rows.forEach((r) => { if (r.id) Object.assign(RESULTS.find((x) => x.id === r.id), r); else RESULTS.push({ ...r, id: uuid() }); }); },
  async saveBodyComp(row) { BODYCOMP.unshift({ id: uuid(), ...row }); },
  async releaseResults(patientId) {
    const at = new Date().toISOString(); let n = 0;
    [...RESULTS, ...BODYCOMP, ...DOCUMENTS].forEach((r) => { if (r.patient_id === patientId && !r.released_at) { r.released_at = at; n++; } });
    return { laboratorio: n };
  },
  async holdResults(patientId) {
    [...RESULTS, ...BODYCOMP, ...DOCUMENTS].forEach((r) => { if (r.patient_id === patientId) r.released_at = null; });
    return { laboratorio: 0 };
  },
  async uploadDoc(patientId, order, file) { DOCUMENTS.push({ id: uuid(), patient_id: patientId, order_id: order.id, kind: 'lab_report', storage_path: 'demo', original_filename: file.name, created_at: new Date().toISOString() }); },
  async docUrl() { throw new Error('En la vista previa no hay archivos reales'); },
  async orderForPrint(id) {
    await loadBiomarkers();
    const order = ORDERS.find((o) => o.id === id); if (!order) throw new Error('Orden no encontrada');
    return { order, items: ITEMS.filter((i) => i.order_id === id), patient: PATIENTS.find((p) => p.id === order.patient_id), provider: PROVIDERS.find((p) => p.id === order.provider_id), physician: { ...DOC, cedula_profesional: '12345678', specialty: 'Medicina interna' } };
  },
};
