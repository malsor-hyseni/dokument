/**
 * build-config.mjs
 * -----------------------------------------------------------------------------
 * Gjeneron `assets/js/env.js` nga variablat e ambientit.
 *
 * Përdoret automatikisht gjatë `npm run build` (dhe nga Vercel).
 * Nëse variablat e ambientit nuk ekzistojnë (p.sh. zhvillim lokal), skedari
 * ekzistues `assets/js/env.js` NUK mbishkruhet — kështu mund ta plotësosh
 * manualisht lokalisht pa u fshirë.
 *
 * Variablat e pranuara (çdo alias funksionon):
 *   SUPABASE_URL | VITE_SUPABASE_URL | NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_ANON_KEY | VITE_SUPABASE_ANON_KEY | NEXT_PUBLIC_SUPABASE_ANON_KEY
 *
 * KUJDES: këtu përdoret VETËM çelësi publik `anon`. Service Role key nuk
 * vendoset kurrë në frontend.
 */

import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const target = resolve(__dirname, '../assets/js/env.js');

const pick = (...keys) => {
  for (const key of keys) {
    const value = process.env[key];
    if (typeof value === 'string' && value.trim() !== '') return value.trim();
  }
  return '';
};

const url = pick('SUPABASE_URL', 'VITE_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'PUBLIC_SUPABASE_URL');
const anonKey = pick(
  'SUPABASE_ANON_KEY',
  'VITE_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'PUBLIC_SUPABASE_ANON_KEY'
);

if (/service_role/i.test(anonKey)) {
  console.error('\n  [DOKUMENT] GABIM: duket se po përdorni Service Role key. Përdorni vetëm çelësin `anon`.\n');
  process.exit(1);
}

if (!url || !anonKey) {
  if (existsSync(target)) {
    const current = readFileSync(target, 'utf8');
    const hasValues = /SUPABASE_URL:\s*'(?!\s*')[^']+'/.test(current);
    console.log(
      `  [DOKUMENT] Variablat e ambientit nuk u gjetën — po ruhet "assets/js/env.js" ekzistues${
        hasValues ? ' (me kredenciale lokale)' : ''
      }.`
    );
    process.exit(0);
  }
  console.log('  [DOKUMENT] Variablat e ambientit nuk u gjetën — po krijohet "assets/js/env.js" bosh.');
}

const banner = `/**
 * GJENERUAR AUTOMATIKISHT nga scripts/build-config.mjs — mos e modifikoni në prodhim.
 * Në zhvillim lokal mund ta plotësoni manualisht me kredencialet tuaja.
 * Përdoret vetëm çelësi publik \`anon\`, i cili mbrohet nga Row Level Security.
 */`;

const contents = `${banner}
window.DOKUMENT_ENV = {
  SUPABASE_URL: '${url.replace(/'/g, "\\'")}',
  SUPABASE_ANON_KEY: '${anonKey.replace(/'/g, "\\'")}'
};
`;

writeFileSync(target, contents, 'utf8');
console.log(`  [DOKUMENT] U shkrua assets/js/env.js ${url ? '✓ me kredenciale' : '(bosh)'}`);
