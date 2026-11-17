/**
 * DOKUMENT — Faqja hyrëse
 * -----------------------------------------------------------------------------
 * Shfaq temën, listat e përmbajtjes dhe një pamje statike të ndërfaqes.
 * Nëse përdoruesi është i kyçur, butonat e navigacionit shkojnë te aplikacioni.
 */

import { icon } from './icons.js';
import { initTheme, cycleTheme, themeIcon, themeLabel } from './ui.js';
import { $, esc } from './utils.js';
import { isConfigured } from './supabase.js';

/* ------------------------------------------------------------------ TEMA -- */

initTheme();
const themeButton = $('#theme-toggle');
const paintTheme = () => {
  themeButton.innerHTML = icon(themeIcon());
  themeButton.title = `Tema: ${themeLabel()}`;
};
paintTheme();
themeButton.addEventListener('click', () => {
  cycleTheme();
  paintTheme();
});

/* ------------------------------------------------------------ PËRMBAJTJA -- */

const FEATURES = [
  {
    icon: 'cloud-upload',
    title: 'Ngarkim i shpejtë',
    text: 'PDF, imazhe, Word, Excel dhe ZIP deri në 50 MB. Me titull, përshkrim, etiketa dhe data.'
  },
  {
    icon: 'folders',
    title: 'Kategori dhe dosje',
    text: 'Kategori me ngjyrë e ikonë, plus dosje të ndërthurura për strukturën tuaj.'
  },
  {
    icon: 'search',
    title: 'Kërkim i menjëhershëm',
    text: 'Kërkim full-text në titull, përshkrim dhe emër skedari — pa shenja diakritike.'
  },
  {
    icon: 'bell-ring',
    title: 'Njoftime për skadim',
    text: 'Vendosni datën e skadimit dhe merrni paralajmërim në afatin që zgjedhni vetë.'
  },
  {
    icon: 'chart-column',
    title: 'Dashboard me statistika',
    text: 'Numri i dokumenteve, hapësira e shfrytëzuar, ndarja sipas kategorive dhe aktiviteti.'
  },
  {
    icon: 'moon',
    title: 'Light dhe Dark Mode',
    text: 'Ndërfaqe e lexueshme ditë e natë, që ndjek edhe cilësimin e sistemit.'
  }
];

const STEPS = [
  { title: 'Krijo llogarinë', text: 'Regjistrohu me email dhe fjalëkalim. Kategoritë bazë krijohen automatikisht.' },
  { title: 'Ngarko dokumentet', text: 'Zgjidh skedarin, shto titullin, kategorinë, etiketat dhe datën e skadimit.' },
  { title: 'Mos harro afatet', text: 'Dashboard-i dhe njoftimet tregojnë çfarë skadon së afërmi.' }
];

const SECURITY = [
  { icon: 'shield-check', title: 'Row Level Security', text: 'Politika në nivel databaze për çdo tabelë — izolimi garantohet nga PostgreSQL.' },
  { icon: 'lock', title: 'Storage privat', text: 'Bucket-i i dokumenteve nuk është publik. Shikimi bëhet me URL të nënshkruara me afat.' },
  { icon: 'key', title: 'Autentikim i Supabase', text: 'Sesione me rifreskim automatik, konfirmim email-i dhe rikuperim fjalëkalimi.' },
  { icon: 'ban', title: 'Pa çelësa të ndjeshëm', text: 'Në frontend përdoret vetëm çelësi publik anon. Service Role nuk ekziston në kod.' }
];

const PREVIEW_NAV = [
  { icon: 'layout-dashboard', label: 'Dashboard' },
  { icon: 'file-text', label: 'Dokumentet', active: true },
  { icon: 'folders', label: 'Dosjet' },
  { icon: 'layout-grid', label: 'Kategoritë' },
  { icon: 'tags', label: 'Etiketat' },
  { icon: 'settings', label: 'Cilësimet' }
];

const PREVIEW_STATS = [
  { label: 'Dokumente', value: '48' },
  { label: 'Hapësira', value: '126 MB' },
  { label: 'Skadojnë', value: '3' },
  { label: 'Kategori', value: '8' }
];

const PREVIEW_ROWS = [
  { title: 'Pasaportë', file: 'pasaporta.pdf', category: 'Dokumente personale', color: 'blue', status: 'Skadon pas 14 ditësh', tone: 'badge-warning' },
  { title: 'Patentë shoferi', file: 'patenta.jpg', category: 'Automjet', color: 'teal', status: 'Në fuqi', tone: 'badge-success' },
  { title: 'Kontratë qiraje', file: 'kontrata-2026.pdf', category: 'Banesë', color: 'orange', status: 'Pa skadim', tone: 'badge' },
  { title: 'Diplomë bachelor', file: 'diploma.pdf', category: 'Arsim', color: 'violet', status: 'Në fuqi', tone: 'badge-success' }
];

/* ------------------------------------------------------------- RENDERIMI -- */

$('#features-grid').innerHTML = FEATURES.map(
  (item) => `
  <article class="card card-pad">
    <div class="w-8 h-8 rounded-md bg-surface-inset border border-line flex items-center justify-center text-ink-muted mb-4">
      ${icon(item.icon, 'w-4 h-4')}
    </div>
    <h3 class="text-sm font-semibold text-ink">${esc(item.title)}</h3>
    <p class="mt-2 text-sm text-ink-muted leading-6">${esc(item.text)}</p>
  </article>`
).join('');

$('#steps-grid').innerHTML = STEPS.map(
  (step, index) => `
  <li class="card card-pad">
    <span class="inline-flex items-center justify-center w-6 h-6 rounded-md bg-accent/10 text-accent
                 text-xs font-semibold tabular">${index + 1}</span>
    <h3 class="mt-4 text-sm font-semibold text-ink">${esc(step.title)}</h3>
    <p class="mt-2 text-sm text-ink-muted leading-6">${esc(step.text)}</p>
  </li>`
).join('');

$('#security-list').innerHTML = SECURITY.map(
  (item) => `
  <li class="flex gap-3.5 p-4 rounded-lg border border-line bg-surface-muted">
    <span class="w-8 h-8 rounded-md bg-surface border border-line flex items-center justify-center
                 text-ink-muted flex-none">${icon(item.icon, 'w-4 h-4')}</span>
    <div class="min-w-0">
      <h3 class="text-sm font-semibold text-ink">${esc(item.title)}</h3>
      <p class="mt-1 text-sm text-ink-muted leading-6">${esc(item.text)}</p>
    </div>
  </li>`
).join('');

$('#preview-nav').innerHTML = PREVIEW_NAV.map(
  (item) => `
  <div class="nav-item${item.active ? ' is-active' : ''} pointer-events-none">
    ${icon(item.icon)}<span>${esc(item.label)}</span>
  </div>`
).join('');

$('#preview-stats').innerHTML = PREVIEW_STATS.map(
  (stat) => `
  <div class="rounded-lg border border-line p-3">
    <p class="text-2xs uppercase tracking-wider text-ink-subtle">${esc(stat.label)}</p>
    <p class="mt-1.5 text-lg font-semibold text-ink tabular">${esc(stat.value)}</p>
  </div>`
).join('');

$('#preview-rows').innerHTML = PREVIEW_ROWS.map(
  (row) => `
  <tr>
    <td>
      <div class="flex items-center gap-3">
        <span class="file-icon">${icon('file-text')}</span>
        <div class="min-w-0">
          <p class="font-medium text-ink truncate">${esc(row.title)}</p>
          <p class="text-xs text-ink-subtle truncate">${esc(row.file)}</p>
        </div>
      </div>
    </td>
    <td class="hidden sm:table-cell">
      <span class="inline-flex items-center gap-2 text-ink-muted">
        <span class="dot dot-${row.color}"></span>${esc(row.category)}
      </span>
    </td>
    <td><span class="badge ${row.tone}">${esc(row.status)}</span></td>
  </tr>`
).join('');

/* ------------------------------------------- RIDREJTIMI KUR KA SESION ---- */

if (isConfigured) {
  (async () => {
    try {
      const { auth } = await import('./api.js');
      const session = await auth.getSession();
      if (!session) return;
      const cta = $('#nav-cta');
      const hero = $('#hero-cta');
      const login = $('#nav-login');
      if (cta) {
        cta.textContent = 'Hap aplikacionin';
        cta.href = '/app.html';
      }
      if (hero) {
        hero.textContent = 'Hap aplikacionin';
        hero.href = '/app.html';
      }
      if (login) login.hidden = true;
    } catch {
      /* faqja hyrëse funksionon edhe pa sesion */
    }
  })();
}
