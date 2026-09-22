import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { CONFIG } from './config.js';

export const supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
});

export const isDemo = () => new URLSearchParams(location.search).has('demo');

export function applyBranding() {
  document.querySelectorAll('[data-app-name]').forEach((el) => { el.textContent = CONFIG.APP_NAME; });
  document.querySelectorAll('[data-app-initial]').forEach((el) => { el.textContent = CONFIG.APP_NAME.charAt(0); });
  document.title = document.title.replace('{APP}', CONFIG.APP_NAME);
}
