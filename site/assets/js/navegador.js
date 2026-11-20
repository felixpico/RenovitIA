// Donde esta parado el paciente, y si desde ahi se puede instalar.
//
// El caso que nos rompe en la practica: la Dra. manda la liga por WhatsApp, el
// paciente la abre DENTRO de WhatsApp, e inicia sesion ahi. Ese navegador
// incrustado no puede instalar nada y su sesion no existe fuera de el. Cuando
// luego abre Chrome, no esta dentro y cree que la app lo expulso.
//
// No se puede forzar la salida en iPhone. Lo unico honesto es avisarselo antes
// de que se meta, y darle la liga para pegarla donde si funciona.

export const esIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export const esAndroid = () => /android/i.test(navigator.userAgent);

export const instalada = () => window.matchMedia('(display-mode: standalone)').matches
  || navigator.standalone === true;

// Navegador incrustado dentro de otra app. La lista es de los que de verdad usan
// los pacientes; cualquiera que no reconozcamos se trata como navegador normal,
// porque un falso positivo asusta mas de lo que ayuda.
export function navegadorIncrustado() {
  const ua = navigator.userAgent;
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) return 'Facebook';
  if (/Instagram/i.test(ua)) return 'Instagram';
  if (/Messenger/i.test(ua)) return 'Messenger';
  if (/\bLine\//i.test(ua)) return 'LINE';
  if (/TikTok|BytedanceWebview|musical_ly/i.test(ua)) return 'TikTok';
  // WhatsApp no se anuncia. En Android deja la marca wv; en iPhone el truco es
  // que Safari aparece sin la version, cosa que el Safari de verdad nunca hace.
  if (/WhatsApp/i.test(ua)) return 'WhatsApp';
  if (esAndroid() && /\bwv\b/.test(ua)) return 'otra app';
  if (esIOS() && /Safari/i.test(ua) && !/Version\/\d/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua)) return 'otra app';
  return null;
}

// En iPhone, cual navegador. Safari es el unico que instala de verdad.
export function navegadorIOS() {
  const ua = navigator.userAgent;
  if (/CriOS/i.test(ua)) return 'Chrome';
  if (/FxiOS/i.test(ua)) return 'Firefox';
  if (/EdgiOS/i.test(ua)) return 'Edge';
  return 'Safari';
}

export const puedeInstalar = () => !navegadorIncrustado() && (esAndroid() || (esIOS() && navegadorIOS() === 'Safari'));

const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Aviso de una sola pieza, para la pantalla de entrada y la de instalar.
// Devuelve el elemento o null si no hay nada que avisar.
export function avisoIncrustado(liga) {
  const app = navegadorIncrustado();
  if (!app) return null;

  const salida = esIOS()
    ? 'Toca el menú <strong>•••</strong> de esta ventana y elige <strong>Abrir en Safari</strong>.'
    : 'Toca el menú <strong>⋮</strong> de esta ventana y elige <strong>Abrir en Chrome</strong>.';

  const div = document.createElement('div');
  div.className = 'notice warn';
  div.setAttribute('role', 'status');
  div.innerHTML = `<strong>Estás dentro de ${esc(app)}.</strong> Desde aquí no se puede instalar RenovitIA,
    y la sesión que inicies no va a existir en tu navegador. ${salida}
    <button type="button" class="btn btn-ghost btn-block" data-copiar style="margin-top:10px">Copiar la liga</button>`;

  const btn = div.querySelector('[data-copiar]');
  btn.addEventListener('click', async () => {
    const url = liga || location.href;
    try {
      await navigator.clipboard.writeText(url);
      btn.textContent = 'Liga copiada · pégala en tu navegador';
    } catch {
      btn.textContent = url;
      btn.style.wordBreak = 'break-all';
    }
  });
  return div;
}
