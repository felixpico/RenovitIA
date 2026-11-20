import { CONFIG } from './config.js';

const parametros = new URLSearchParams(location.search);

export const isDemo = () => parametros.has('demo');

// Demo del PACIENTE: ?demo=paciente. Se sustituye el cliente entero por uno que
// contesta de memoria, para poder ensenar la app sin abrir el expediente de
// nadie. Ni siquiera se baja la libreria de Supabase: la demo no toca la red,
// asi que no puede escribir en la base aunque se le pida. El panel medico usa
// ?demo=1 y NO entra por aqui: ese cambia su propio objeto api, no el cliente.
async function construir() {
  if (parametros.get('demo') === 'paciente') {
    return (await import('./paciente-demo.js')).clienteDemo();
  }
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  return createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
  });
}

export const supabase = await construir();

export function applyBranding() {
  document.querySelectorAll('[data-app-name]').forEach((el) => { el.textContent = CONFIG.APP_NAME; });
  document.querySelectorAll('[data-app-initial]').forEach((el) => { el.textContent = CONFIG.APP_NAME.charAt(0); });
  document.title = document.title.replace('{APP}', CONFIG.APP_NAME);
}
