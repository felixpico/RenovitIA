// Catálogos del consultorio: péptidos, suplementos, ejercicios y comida.
//
// Esto NO es una lista de opciones: es contenido clínico. Lo que se escriba
// aquí como dosis típica se prellena solo en cada plan futuro y, en la pantalla
// de la médica, va a parecer un dato validado. Por eso el formulario pide
// fuente antes que dosis, y por eso nada se borra: se desactiva.
//
// Y lo que más confunde si no se dice: editar un renglón de aquí NO cambia las
// recetas ya firmadas. protocol_items guarda su propia copia del título y la
// dosis al momento de capturar. La pantalla lo dice en voz alta.

export const CATALOGOS = [
  {
    id: 'peptides', tabla: 'catalog_peptides', nombre: 'Péptidos',
    riesgo: 'alto',
    orden: 'name_es',
    nota: 'La dosis que escribas aquí se prellena en cada plan futuro. Para los que no tienen dosis establecida en humanos, el renglón debe decirlo, no traer un número.',
    exigeFuente: true,
    campos: [
      ['code', 'Código', 'texto', true],
      ['name_es', 'Nombre', 'texto', true],
      ['route', 'Vía', 'texto'],
      ['typical_dose', 'Dosis típica', 'texto'],
      ['reconstitution_hint', 'Reconstitución sugerida', 'texto'],
      ['frequency', 'Frecuencia', 'texto'],
      ['purpose', 'Para qué', 'texto'],
      ['evidence_grade', 'Evidencia', 'enum', false, ['', 'A', 'B', 'C', 'D']],
      ['regulatory_status', 'Estatus regulatorio', 'enum', false,
        ['', 'aprobado', 'investigacion', 'no_aprobado_uso_humano']],
      ['regulatory_note', 'Nota regulatoria', 'area'],
      ['cautions', 'Precauciones', 'area'],
      ['monitoring', 'Monitoreo', 'area'],
    ],
    resumen: (r) => [r.route, r.typical_dose, r.frequency].filter(Boolean).join(' · '),
    sello: (r) => ESTATUS[r.regulatory_status] || r.regulatory_status,
  },
  {
    id: 'supplements', tabla: 'catalog_supplements', nombre: 'Suplementos',
    riesgo: 'medio',
    orden: 'name_es',
    nota: 'Una dosis por omisión mal puesta se repite en todos los planes que se generen después.',
    exigeFuente: true,
    campos: [
      ['code', 'Código', 'texto', true],
      ['name_es', 'Nombre', 'texto', true],
      ['category', 'Categoría', 'texto'],
      ['default_dose', 'Dosis por omisión', 'texto'],
      ['default_timing', 'Horario por omisión', 'texto'],
      ['frequency', 'Frecuencia', 'texto'],
      ['purpose', 'Para qué', 'texto'],
      ['evidence_grade', 'Evidencia', 'enum', false, ['', 'A', 'B', 'C', 'D']],
      ['cautions', 'Precauciones', 'area'],
      ['interactions', 'Interacciones', 'area'],
    ],
    resumen: (r) => [r.default_dose, r.default_timing, r.frequency].filter(Boolean).join(' · '),
    sello: (r) => (r.evidence_grade ? `Evidencia ${r.evidence_grade}` : null),
  },
  {
    id: 'exercises', tabla: 'catalog_exercises', nombre: 'Ejercicios',
    riesgo: 'bajo',
    orden: 'name_es',
    nota: 'Las precauciones de un ejercicio son lo que protege un hombro operado. No las dejes vacías.',
    exigeFuente: false,
    campos: [
      ['code', 'Código', 'texto', true],
      ['name_es', 'Nombre', 'texto', true],
      ['modality', 'Modalidad', 'texto'],
      ['pattern', 'Patrón', 'texto'],
      ['primary_muscles', 'Músculos', 'texto'],
      ['equipment', 'Equipo', 'texto'],
      ['level', 'Nivel', 'texto'],
      ['sets_reps_hint', 'Series y repeticiones', 'texto'],
      ['rpe_hint', 'RPE sugerido', 'texto'],
      ['how_to', 'Cómo se hace', 'area'],
      ['common_errors', 'Errores comunes', 'area'],
      ['cautions', 'Precauciones', 'area'],
      ['svg_key', 'Ilustración (clave)', 'texto'],
    ],
    resumen: (r) => [r.modality, r.equipment, r.sets_reps_hint].filter(Boolean).join(' · '),
    sello: (r) => r.level,
  },
  {
    id: 'foods', tabla: 'catalog_foods', nombre: 'Platillos de ejemplo',
    riesgo: 'bajo',
    orden: 'name_es',
    // Son dos cosas distintas con nombre parecido, y confundirlas es editar la
    // tabla equivocada: aqui viven los ejemplos de un dia, no la base que el
    // paciente busca al registrar lo que come.
    nota: 'Estos son los platillos de ejemplo de "Mi alimentación". NO es la base de alimentos que busca el paciente al registrar una comida: esa es otra tabla, con 150 renglones de valores nutricionales.',
    exigeFuente: false,
    campos: [
      ['code', 'Código', 'texto', true],
      ['name_es', 'Nombre', 'texto', true],
      ['role', 'Momento', 'texto'],
      ['unit_label', 'Porción', 'texto'],
      ['kcal', 'Calorías', 'numero'],
      ['protein_g', 'Proteína (g)', 'numero'],
      ['carb_g', 'Carbohidrato (g)', 'numero'],
      ['fat_g', 'Grasa (g)', 'numero'],
      ['fiber_g', 'Fibra (g)', 'numero'],
      ['note', 'Nota', 'area'],
    ],
    resumen: (r) => [r.role, r.unit_label,
      r.kcal != null ? `${r.kcal} kcal` : null,
      r.protein_g != null ? `${r.protein_g} g prot` : null].filter(Boolean).join(' · '),
    sello: (r) => r.role,
  },
];

// El estatus se guarda como clave, pero en pantalla tiene que leerse. Un
// "no_aprobado_uso_humano" con guiones bajos se lee como un error del sistema,
// no como lo que es: una advertencia.
const ESTATUS = {
  aprobado: 'Con registro',
  investigacion: 'En investigación',
  no_aprobado_uso_humano: 'Sin aprobación',
};

const FECHA = (t) => (t ? new Date(t).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : null);
const sinAcentos = (t) => String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export async function viewCatalogs(root, ctx) {
  const { h, modal, toast, api, setNav } = ctx;
  setNav?.('catalogos');

  let actual = CATALOGOS[0];
  let verInactivos = false;
  let filtro = '';

  const cabecera = h('div');
  const cuerpo = h('div');
  root.append(h('h1', { text: 'Catálogos' }),
    h('p', { class: 'muted', style: 'margin:-6px 0 14px',
      text: 'Lo que vive aquí se prellena en los planes que se generen después. Editar un renglón NO cambia las recetas ya firmadas: cada plan guarda su propia copia.' }),
    cabecera, cuerpo);

  const pestanas = () => {
    cabecera.innerHTML = '';
    const tira = h('div', { class: 'tabs', role: 'tablist' });
    CATALOGOS.forEach((c) => {
      tira.append(h('button', {
        type: 'button', role: 'tab', text: c.nombre,
        class: c.id === actual.id ? 'active' : '',
        'aria-selected': c.id === actual.id ? 'true' : 'false',
        onclick: () => { actual = c; filtro = ''; pestanas(); cargar(); },
      }));
    });
    cabecera.append(tira);
  };

  const cargar = async () => {
    cuerpo.innerHTML = '';
    cuerpo.append(h('div', { class: 'spinner' }));
    let filas = [];
    try { filas = await api.catalogRows(actual.tabla, actual.orden); }
    catch (e) {
      cuerpo.innerHTML = '';
      cuerpo.append(h('div', { class: 'notice danger', text: `No se pudo leer el catálogo: ${e.message}` }));
      return;
    }
    pintar(filas);
  };

  const pintar = (filas) => {
    cuerpo.innerHTML = '';

    if (actual.nota) {
      cuerpo.append(h('div', { class: actual.riesgo === 'alto' ? 'notice danger' : 'notice' },
        h('span', { text: actual.nota })));
    }

    const buscar = h('input', { class: 'input', type: 'search', placeholder: `Buscar en ${actual.nombre.toLowerCase()}…` });
    buscar.value = filtro;
    const ck = h('input', { type: 'checkbox' });
    ck.checked = verInactivos;
    const nuevo = h('button', { class: 'btn btn-primary btn-sm', type: 'button', text: '+ Nuevo',
      onclick: () => editar(null) });

    const lista = h('div', { class: 'list' });
    const dibujar = () => {
      const q = sinAcentos(filtro).trim();
      const vistas = filas
        .filter((r) => (verInactivos ? true : r.is_active !== false))
        .filter((r) => !q || sinAcentos(`${r.name_es} ${r.code} ${actual.resumen(r) || ''}`).includes(q));
      lista.innerHTML = '';
      if (!vistas.length) {
        lista.append(h('div', { class: 'empty-state', text: q ? 'Nada con ese nombre.' : 'Este catálogo está vacío.' }));
        return;
      }
      vistas.forEach((r) => lista.append(renglon(r)));
      conteo.textContent = `${vistas.length} de ${filas.length}`;
    };
    const conteo = h('span', { class: 'muted small' });
    buscar.addEventListener('input', () => { filtro = buscar.value; dibujar(); });
    ck.addEventListener('change', () => { verInactivos = ck.checked; dibujar(); });

    cuerpo.append(h('div', { class: 'toolbar', style: 'margin:12px 0' },
      buscar, conteo,
      h('label', { class: 'small', style: 'display:flex;align-items:center;gap:6px' }, ck,
        h('span', { text: 'Ver desactivados' })),
      nuevo), lista);
    dibujar();

    function renglon(r) {
      const inactivo = r.is_active === false;
      const sello = actual.sello(r);
      const sinFuente = actual.exigeFuente && !String(r.fuente || '').trim();
      return h('div', { class: 'row-card', style: inactivo ? 'opacity:.55' : '' },
        h('div', { class: 'row-top' },
          h('strong', { class: 'grow', text: r.name_es || r.code }),
          sello ? h('span', { class: `pill ${r.regulatory_status === 'aprobado' ? 'verde' : r.regulatory_status ? 'amarillo' : ''}`, text: sello }) : null,
          inactivo ? h('span', { class: 'pill', text: 'Desactivado' }) : null),
        h('div', { class: 'muted small', text: actual.resumen(r) || '—' }),
        sinFuente ? h('div', { class: 'small', style: 'color:var(--danger);margin-top:4px',
          text: 'Sin fuente. No se sabe de dónde salió esta dosis.' }) : null,
        h('div', { class: 'muted small', style: 'margin-top:4px',
          text: [r.code,
                 r.revisado_en ? `revisado ${FECHA(r.revisado_en)}` : 'sin revisar',
                 r.updated_at ? `último cambio ${FECHA(r.updated_at)}` : null].filter(Boolean).join(' · ') }),
        h('div', { class: 'toolbar', style: 'margin-top:8px' },
          h('button', { class: 'btn-link btn-sm', type: 'button', text: 'Editar', onclick: () => editar(r) }),
          h('button', { class: 'btn-link btn-sm', type: 'button',
            text: inactivo ? 'Reactivar' : 'Desactivar',
            onclick: () => alternar(r) })));
    }

    async function alternar(r) {
      const apagar = r.is_active !== false;
      const texto = apagar
        ? 'Deja de aparecer en el selector de planes nuevos. Los planes que ya lo tienen NO cambian: cada uno guarda su copia.'
        : 'Vuelve a aparecer en el selector de planes nuevos.';
      if (!(await modal(apagar ? 'Desactivar del catálogo' : 'Reactivar',
        h('div', { class: 'stack' },
          h('p', { text: `${r.name_es || r.code}` }),
          h('p', { class: 'small', text: texto })),
        apagar ? 'Desactivar' : 'Reactivar'))) return;
      try {
        await api.catalogSave(actual.tabla, { id: r.id, is_active: !apagar });
        toast(apagar ? 'Desactivado' : 'Reactivado');
        cargar();
      } catch (e) { toast(`Error: ${e.message}`, true); }
    }

    async function editar(r) {
      const campo = (l, el) => h('label', { class: 'field' }, h('span', { class: 'field-label small', text: l }), el);
      const controles = {};
      const partes = [];

      actual.campos.forEach(([clave, etiqueta, tipo, requerido, opciones]) => {
        let el;
        if (tipo === 'area') { el = h('textarea', { class: 'input', rows: 2 }); }
        else if (tipo === 'enum') {
          el = h('select', { class: 'input' }, ...opciones.map((o) => h('option', { value: o, text: o || '—' })));
        } else {
          el = h('input', { class: 'input', type: tipo === 'numero' ? 'number' : 'text' });
          if (tipo === 'numero') el.step = '0.1';
        }
        el.value = r?.[clave] ?? '';
        if (requerido) el.required = true;
        controles[clave] = { el, tipo, etiqueta, requerido };
        partes.push(campo(requerido ? `${etiqueta} *` : etiqueta, el));
      });

      // La fuente va al final y con su propia explicacion: es el campo que
      // separa un dato de una ocurrencia.
      const fuente = h('textarea', { class: 'input', rows: 2,
        placeholder: 'Etiqueta del producto, ensayo clínico, guía… con liga si la hay' });
      fuente.value = r?.fuente ?? '';
      const revisado = h('input', { class: 'input', type: 'date' });
      revisado.value = r?.revisado_en ?? '';

      const cuerpoForm = h('div', { class: 'stack' },
        ...partes,
        h('hr', { style: 'border:0;border-top:1px solid var(--border);margin:6px 0' }),
        campo(actual.exigeFuente ? 'De dónde salió *' : 'De dónde salió', fuente),
        h('p', { class: 'muted small', style: 'margin:-4px 0 0',
          text: 'Una letra de evidencia sin cita no es evidencia. Si no tiene fuente, escribe que no la tiene.' }),
        campo('Revisado el', revisado));

      for (;;) {
        if (!(await modal(r ? 'Editar renglón' : 'Nuevo renglón', cuerpoForm, 'Guardar'))) return;
        const faltan = actual.campos
          .filter(([clave, , , req]) => req && !String(controles[clave].el.value).trim())
          .map(([, etiqueta]) => etiqueta);
        if (faltan.length) { toast(`Falta ${faltan.join(' y ')}`, true); continue; }
        if (actual.exigeFuente && !fuente.value.trim()) {
          toast('Escribe de dónde salió. Si no tiene fuente publicada, escríbelo así.', true);
          continue;
        }
        break;
      }

      const fila = { id: r?.id };
      actual.campos.forEach(([clave, , tipo]) => {
        const v = String(controles[clave].el.value).trim();
        fila[clave] = v === '' ? null : (tipo === 'numero' ? Number(v) : v);
      });
      fila.fuente = fuente.value.trim() || null;
      fila.revisado_en = revisado.value || null;
      if (!r) fila.is_active = true;

      try {
        await api.catalogSave(actual.tabla, fila);
        toast('Guardado');
        cargar();
      } catch (e) { toast(`Error: ${e.message}`, true); }
    }
  };

  pestanas();
  await cargar();
}
