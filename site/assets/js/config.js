// Configuración pública. La publishable key es segura en el navegador: el acceso real lo controlan las políticas RLS.
export const CONFIG = {
  // Entrar con Google. Apagarlo aqui esconde el boton sin tocar nada mas.
  GOOGLE_LOGIN: true,
  APP_NAME: 'RenovitIA',
  TAGLINE: 'Regenera – Reconstruye – Renace',
  SUPABASE_URL: 'https://pvexfqdqrepxtnljypav.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_mdAo8DNmiqndm1e3dikazw_4M0YUcjG',
  TEMPLATE_CODE: 'historia_clinica_funcional',
  PRIVACY_NOTICE_VERSION: '2026-11-v1',
  CONSENT_VERSION: '2026-11-v1',
  STORAGE_BUCKET: 'patient-documents',
  CRISIS_LINE: '800 911 2000',     // Línea de la Vida (24 h)
  EMERGENCY: '911',
};
