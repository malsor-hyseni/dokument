/**
 * DOKUMENT — Kredencialet e Supabase
 * -----------------------------------------------------------------------------
 * HAPI 1: Krijo projektin në https://supabase.com
 * HAPI 2: Project Settings → API → kopjo "Project URL" dhe çelësin "anon public"
 * HAPI 3: Vendosi më poshtë.
 *
 * Në Vercel ky skedar gjenerohet automatikisht gjatë build-it nga variablat e
 * ambientit SUPABASE_URL dhe SUPABASE_ANON_KEY (shih scripts/build-config.mjs).
 *
 * SIGURIA: këtu vendoset VETËM çelësi publik `anon`. Ai është i dizajnuar për
 * frontend dhe mbrohet nga Row Level Security. Çelësi `service_role` nuk
 * vendoset KURRË këtu.
 */
window.DOKUMENT_ENV = {
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: ''
};
