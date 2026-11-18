// Plantilla de comidas y armador de porciones. Vive aparte para que la hoja
// impresa y la pantalla del celular repartan los macros igual: si cambia aqui,
// cambia en las dos.
export const COMIDAS = [
  { nombre: 'Desayuno', p: 0.25, c: 0.30, g: 0.30,
    prot: [['HUEVO', 150], ['PROTEINA_POLVO', 40], ['YOGURT_GRIEGO', 250]],
    carb: [['AVENA', 100], ['FRUTA', 200]],
    gra:  [['NUECES', 40], ['ACEITE_OLIVA', 15]] },
  { nombre: 'Comida', p: 0.30, c: 0.35, g: 0.30,
    prot: [['POLLO', 220], ['ATUN', 150]],
    carb: [['ARROZ', 300], ['FRIJOL', 250]],
    gra:  [['AGUACATE', 120], ['ACEITE_OLIVA', 20]], verdura: true },
  { nombre: 'Cena', p: 0.30, c: 0.25, g: 0.30,
    prot: [['SALMON', 180], ['POLLO', 200]],
    carb: [['PAPA', 300], ['TORTILLA_MAIZ', 90]],
    gra:  [['ACEITE_OLIVA', 20], ['AGUACATE', 80]], verdura: true },
  { nombre: 'Colación', p: 0.15, c: 0.10, g: 0.10,
    prot: [['YOGURT_GRIEGO', 250], ['PROTEINA_POLVO', 30]],
    carb: [['FRUTA', 200]],
    gra:  [['SEMILLA_CHIA', 20], ['NUECES', 30]] },
];
export const r5 = (g) => Math.round(g / 5) * 5;

// Reparte una comida ajustando los tres macros a la vez. Hacerlo en un solo
// pase no funciona: cada alimento aporta algo de los otros dos macros, asi que
// se itera hasta que los tres caen cerca del objetivo.
export function armarComida(cm, meta, foods) {
  const fd = (code) => foods.find((x) => x.code === code);
  const grupos = [['carb_g', cm.carb, meta.c], ['fat_g', cm.gra, meta.g], ['protein_g', cm.prot, meta.p]];
  const gr = new Map();
  const total = (campo) => [...gr.entries()].reduce((a, [code, g]) => {
    const f = fd(code); return a + (f ? g * f[campo] / 100 : 0);
  }, 0);
  for (let it = 0; it < 14; it++) {
    for (const [campo, lista, objetivo] of grupos) {
      let falta = objetivo - total(campo);
      for (const [code, tope] of lista) {
        if (Math.abs(falta) < 0.4) break;
        const f = fd(code);
        if (!f || !f[campo]) continue;
        const nuevo = Math.max(0, Math.min(tope, (gr.get(code) || 0) + falta / (f[campo] / 100)));
        gr.set(code, nuevo);
        falta = objetivo - total(campo);
      }
    }
  }
  const orden = ['proteina', 'carbohidrato', 'fruta', 'grasa', 'verdura'];
  return [...gr.entries()]
    .map(([code, g]) => ({ f: fd(code), g: r5(g) }))
    .filter((x) => x.f && x.g >= (x.f.role === 'grasa' ? 5 : 10))
    .sort((a, b) => orden.indexOf(a.f.role) - orden.indexOf(b.f.role));
}

