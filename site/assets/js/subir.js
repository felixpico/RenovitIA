// Subir un estudio desde el celular. Lo usan "Estudios pendientes" y la pantalla
// vacia de esa misma seccion.
//
// Lo que el paciente sube NO se vuelve un resultado suyo de inmediato. El
// extractor transcribe, y los valores quedan como "extraidos" hasta que su
// medica los confirma contra el archivo original. La pantalla lo dice asi,
// porque dejar creer que ya estan listos es peor que no tener el boton.
import { supabase } from './supabase.js';

const MAX = 15 * 1024 * 1024; // el extractor rechaza arriba de esto
const TIPOS = 'application/pdf,image/jpeg,image/png,image/heic,image/heif,image/webp';

const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function cajaSubir(id = 'sub') {
  return `<div class="subir" id="${id}">
    <input type="file" class="sb-in" accept="${TIPOS}" multiple hidden>
    <button class="btn btn-primary btn-block sb-go" type="button">Subir mi resultado</button>
    <p class="nota-chica">PDF o fotos. Si tu estudio trae varias hojas, selecciónalas todas
      de una vez. Máximo 15 MB por archivo.</p>
    <div class="sb-estado"></div>
  </div>`;
}

const aviso = (caja, html, malo) => {
  caja.querySelector('.sb-estado').innerHTML = html
    ? `<div class="dato ${malo ? 'alerta' : ''}"><span class="dic">${malo ? '⚠️' : 'ℹ️'}</span><div>${html}</div></div>`
    : '';
};

// Sin callback de "ya termine": re-dibujar la seccion borraba justo el resumen
// que el paciente estuvo esperando. La lista de pendientes se actualiza la
// proxima vez que entre, y el resumen se lo dice.
export function montarSubir(p, id = 'sub') {
  const caja = document.getElementById(id);
  if (!caja) return;
  const input = caja.querySelector('.sb-in');
  const boton = caja.querySelector('.sb-go');

  boton.addEventListener('click', () => input.click());

  input.addEventListener('change', async (ev) => {
    const files = Array.from(ev.target.files || []);
    ev.target.value = '';
    if (!files.length) return;

    const grandes = files.filter((f) => f.size > MAX);
    if (grandes.length) {
      aviso(caja, `${grandes.length === 1 ? 'Un archivo pasa' : `${grandes.length} archivos pasan`}
        de 15 MB. Si es una foto, tómala de nuevo con menos resolución. Si es un PDF, súbelo por páginas.`, true);
      return;
    }

    boton.disabled = true;
    const resumen = [];
    let fallaron = 0;

    for (let i = 0; i < files.length; i += 1) {
      const f = files[i];
      const cual = files.length > 1 ? ` (${i + 1} de ${files.length})` : '';
      try {
        aviso(caja, `Subiendo <b>${esc(f.name)}</b>${cual}…`);
        const ext = (f.name.split('.').pop() || 'bin').toLowerCase().slice(0, 5);
        const ruta = `${p.id}/lab/${Date.now()}-${i}.${ext}`;
        const up = await supabase.storage.from('patient-documents')
          .upload(ruta, f, { contentType: f.type || 'application/octet-stream' });
        if (up.error) throw up.error;

        const { data: doc, error: eDoc } = await supabase.from('documents').insert({
          patient_id: p.id, kind: 'lab_report', storage_path: ruta,
          original_filename: f.name.slice(0, 200), mime_type: f.type || null,
          extraction_status: 'pending',
        }).select('id').single();
        if (eDoc) throw eDoc;

        aviso(caja, `Leyendo <b>${esc(f.name)}</b>${cual}… Esto puede tardar medio minuto.`);
        const { data: r, error: eFn } = await supabase.functions
          .invoke('extract-study', { body: { document_id: doc.id } });
        if (eFn || r?.error) throw new Error(r?.error || eFn.message);

        // El tipo lo decide el extractor leyendo el documento, no una suposicion
        // del telefono por el nombre del archivo.
        if (r.tipo === 'composicion_corporal') {
          await supabase.from('documents').update({ kind: 'dexa_report' }).eq('id', doc.id);
        }
        resumen.push({ nombre: f.name, ...r });
      } catch (e) {
        console.error(e);
        fallaron += 1;
        resumen.push({ nombre: f.name, fallo: String(e.message || e) });
      }
    }

    boton.disabled = false;
    pintarResumen(caja, resumen, fallaron);
    caja.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}

function pintarResumen(caja, resumen, fallaron) {
  const ok = resumen.filter((x) => !x.fallo);
  const analitos = ok.reduce((n, x) => n + (x.analitos || 0), 0);
  const comp = ok.reduce((n, x) => n + (x.composicion || 0), 0);
  const dudosos = ok.reduce((n, x) => n + (x.baja_confianza || 0), 0);
  const sinCat = ok.reduce((n, x) => n + (x.sin_catalogo || 0), 0);

  let h = '';
  if (ok.length) {
    h += `<div class="dato"><span class="dic">📄</span><div>
      <b>Listo. ${analitos > 0 ? `Se leyeron ${analitos} valores` : ''}${analitos > 0 && comp ? ' y ' : ''}${comp ? 'tu composición corporal' : ''}${analitos === 0 && !comp ? 'Subimos tu archivo' : ''}.</b>
      <br>Tu médica los revisa contra el archivo original antes de que aparezcan en
      <b>Mis estudios</b>. Mientras tanto no los vas a ver ahí, y eso es normal.
      <br>Tu lista de pendientes se actualiza la próxima vez que entres.`;
    if (dudosos) {
      h += `<br><br>${dudosos} ${dudosos === 1 ? 'valor quedó dudoso' : 'valores quedaron dudosos'}
        (texto borroso o cortado). Tu médica los va a checar con más cuidado.`;
    }
    if (sinCat) {
      h += `<br><br>${sinCat} ${sinCat === 1 ? 'valor no corresponde' : 'valores no corresponden'}
        a nuestro catálogo. Se guardan igual para que tu médica los vea.`;
    }
    const vacios = ok.filter((x) => x.aviso);
    if (vacios.length) h += `<br><br>${esc(vacios[0].aviso)}`;
    h += '</div></div>';
  }
  if (fallaron) {
    const malos = resumen.filter((x) => x.fallo);
    h += `<div class="dato alerta"><span class="dic">⚠️</span><div>
      <b>No se ${fallaron === 1 ? 'pudo leer un archivo' : `pudieron leer ${fallaron} archivos`}.</b>
      <ul>${malos.map((m) => `<li>${esc(m.nombre)}: ${esc(m.fallo)}</li>`).join('')}</ul>
      Puedes volver a intentarlo, o mandárselo a tu médica desde <b>Dudas y mensajes</b>.</div></div>`;
  }
  caja.querySelector('.sb-estado').innerHTML = h;
}
