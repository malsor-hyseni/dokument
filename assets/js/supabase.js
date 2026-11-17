/**
 * DOKUMENT — Klienti i Supabase
 * -----------------------------------------------------------------------------
 * Inicializon një klient të vetëm (singleton) që përdoret nga i gjithë
 * aplikacioni. Nëse kredencialet mungojnë, shfaqet një ekran udhëzues në vend
 * që aplikacioni të dështojë në heshtje.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.119.0';
import { SUPABASE_URL, SUPABASE_ANON_KEY, isConfigured } from './config.js';

/** Shfaq ekranin e konfigurimit kur mungojnë kredencialet. */
function renderSetupScreen() {
  const html = `
    <div style="position:fixed;inset:0;z-index:999;display:flex;align-items:center;justify-content:center;padding:24px;
                background:#0d0e12;color:#edeef3;font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;overflow:auto">
      <div style="max-width:560px;width:100%;background:#15161b;border:1px solid #282b33;border-radius:14px;padding:28px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:18px">
          <div style="width:30px;height:30px;border-radius:8px;background:#2f56d6;display:flex;align-items:center;justify-content:center">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
                 stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/>
              <path d="M14 2v5a1 1 0 0 0 1 1h5"/>
            </svg>
          </div>
          <strong style="font-size:15px;letter-spacing:0.14em">DOKUMENT</strong>
        </div>
        <h1 style="font-size:21px;margin:0 0 10px;letter-spacing:-0.02em">Konfigurimi nuk ka përfunduar</h1>
        <p style="color:#969ca9;font-size:14px;line-height:1.6;margin:0 0 20px">
          Aplikacioni nuk mund të lidhet me Supabase sepse mungojnë kredencialet.
          Ndiqni tre hapat e mëposhtëm.
        </p>
        <ol style="color:#c9ccd4;font-size:13.5px;line-height:1.75;padding-left:20px;margin:0 0 20px">
          <li>Krijoni një projekt te <strong>supabase.com</strong>.</li>
          <li>Hapni <strong>SQL Editor</strong> dhe ekzekutoni skedarin <code style="background:#202329;padding:2px 6px;border-radius:4px">supabase/schema.sql</code>.</li>
          <li>Te <strong>Project Settings → API</strong> kopjoni <em>Project URL</em> dhe çelësin <em>anon public</em>, pastaj vendosni te
            <code style="background:#202329;padding:2px 6px;border-radius:4px">assets/js/env.js</code>.</li>
        </ol>
        <pre style="background:#0d0e12;border:1px solid #282b33;border-radius:9px;padding:14px;font-size:12.5px;
                    color:#969ca9;overflow:auto;margin:0 0 18px"><code>window.DOKUMENT_ENV = {
  SUPABASE_URL: 'https://xxxx.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOi...'
};</code></pre>
        <p style="color:#70767f;font-size:12.5px;line-height:1.6;margin:0">
          Në Vercel vendosini si variabla ambienti me të njëjtat emra — skedari gjenerohet automatikisht gjatë build-it.
          Mos përdorni kurrë çelësin <strong>service_role</strong> këtu.
        </p>
      </div>
    </div>`;

  const mount = () => document.body.insertAdjacentHTML('beforeend', html);
  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);
}

if (!isConfigured) {
  renderSetupScreen();
}

/**
 * Klienti i vetëm i Supabase.
 * Kur kredencialet mungojnë përdoren vlera fiktive që klienti të mos hedhë
 * përjashtim gjatë importit — ekrani udhëzues është tashmë i shfaqur.
 */
export const supabase = createClient(
  isConfigured ? SUPABASE_URL : 'https://pa-konfiguruar.supabase.co',
  isConfigured ? SUPABASE_ANON_KEY : 'public-anon-key-placeholder',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
      storageKey: 'dokument.auth'
    },
    global: {
      headers: { 'x-application-name': 'dokument' }
    },
    db: { schema: 'public' }
  }
);

export { isConfigured };
export default supabase;
