/**
 * DOKUMENT — Funksione ndihmëse
 */

/* ---------------------------------------------------------------- DOM ----- */

export const $ = (selector, scope = document) => scope.querySelector(selector);
export const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

/** Krijon element me atribute dhe përmbajtje. */
export function el(tag, attrs = {}, html = '') {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else node.setAttribute(key, value === true ? '' : String(value));
  }
  if (html) node.innerHTML = html;
  return node;
}

/** Mbron nga XSS kur futet tekst i përdoruesit në HTML. */
export function esc(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Mbron tekstin që futet brenda atributeve. */
export const escAttr = esc;

/* -------------------------------------------------------------- Numra ----- */

/** 1536000 → "1.5 MB" */
export function formatBytes(bytes, decimals = 1) {
  const n = Number(bytes) || 0;
  if (n === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1);
  const value = n / Math.pow(1024, i);
  const d = i === 0 ? 0 : value >= 100 ? 0 : decimals;
  return `${value.toFixed(d).replace(/\.0$/, '')} ${units[i]}`;
}

export function formatNumber(value) {
  return new Intl.NumberFormat('sq-AL').format(Number(value) || 0);
}

export const clamp = (n, min, max) => Math.min(Math.max(n, min), max);

/* --------------------------------------------------------------- Data ----- */

const MONTHS_SQ_FULL = [
  'janar', 'shkurt', 'mars', 'prill', 'maj', 'qershor',
  'korrik', 'gusht', 'shtator', 'oktober', 'nëntor', 'dhjetor'
];

/** "2026-03-14" → "14.03.2026" */
export function formatDate(value) {
  if (!value) return '—';
  const d = toDate(value);
  if (!d) return '—';
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}

/** "2026-03-14" → "14 mars 2026" */
export function formatDateLong(value) {
  const d = toDate(value);
  if (!d) return '—';
  return `${d.getDate()} ${MONTHS_SQ_FULL[d.getMonth()]} ${d.getFullYear()}`;
}

/** Data + ora: "14.03.2026, 09:42" */
export function formatDateTime(value) {
  const d = toDate(value);
  if (!d) return '—';
  const p = (n) => String(n).padStart(2, '0');
  return `${formatDate(d)}, ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** "2026-01" → "Jan 2026" (për grafikun e dashboard-it) */
export function formatMonthShort(ym) {
  if (!ym || typeof ym !== 'string') return '';
  const [year, month] = ym.split('-').map(Number);
  if (!year || !month) return ym;
  const name = MONTHS_SQ_FULL[month - 1] || '';
  return `${name.charAt(0).toUpperCase()}${name.slice(1, 3)} ${String(year).slice(2)}`;
}

export function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  // Datat "YYYY-MM-DD" lexohen si lokale, për të shmangur zhvendosjen e zonës orare
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Ditët deri në datën e dhënë (negative = e kaluar). */
export function daysUntil(value) {
  const d = toDate(value);
  if (!d) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d - today) / 86400000);
}

/** "para 3 ditësh", "pas 2 muajsh" */
export function relativeTime(value) {
  const d = toDate(value);
  if (!d) return '—';
  const diffMs = d.getTime() - Date.now();
  const past = diffMs < 0;
  const abs = Math.abs(diffMs);

  const min = Math.round(abs / 60000);
  const hours = Math.round(abs / 3600000);
  const days = Math.round(abs / 86400000);
  const months = Math.round(days / 30.44);
  const years = Math.round(days / 365.25);

  // Format rrjedhore: "para 3 ditësh", "pas 2 muajsh"
  const fmt = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  let text;
  if (abs < 45000) return 'tani';
  else if (min < 60) text = fmt(min, 'minute', 'minutash');
  else if (hours < 24) text = fmt(hours, 'ore', 'orësh');
  else if (days < 31) text = fmt(days, 'dite', 'ditësh');
  else if (months < 12) text = fmt(months, 'muaji', 'muajsh');
  else text = fmt(years, 'viti', 'vjetësh');

  return past ? `para ${text}` : `pas ${text}`;
}

/** Statusi i skadimit i një dokumenti. */
export function expiryStatus(expiryDate, warningDays = 30) {
  if (!expiryDate) return { key: 'none', label: 'Pa skadim', tone: 'badge', days: null };
  const days = daysUntil(expiryDate);
  if (days === null) return { key: 'none', label: 'Pa skadim', tone: 'badge', days: null };
  if (days < 0) {
    return {
      key: 'expired',
      label: days === -1 ? 'Skaduar dje' : `Skaduar para ${Math.abs(days)} ditësh`,
      tone: 'badge-danger',
      days
    };
  }
  if (days === 0) return { key: 'expiring', label: 'Skadon sot', tone: 'badge-danger', days };
  if (days <= warningDays) {
    return {
      key: 'expiring',
      label: days === 1 ? 'Skadon nesër' : `Skadon pas ${days} ditësh`,
      tone: 'badge-warning',
      days
    };
  }
  return { key: 'valid', label: 'Në fuqi', tone: 'badge-success', days };
}

/** "YYYY-MM-DD" për input[type=date] */
export function toInputDate(value) {
  const d = toDate(value);
  if (!d) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/* ------------------------------------------------------------ Skedarë ----- */

/** Ikona Lucide sipas tipit MIME. */
export function fileIconName(mime = '', fileName = '') {
  const m = String(mime).toLowerCase();
  const ext = String(fileName).split('.').pop()?.toLowerCase() || '';
  if (m.startsWith('image/')) return 'file-image';
  if (m === 'application/pdf' || ext === 'pdf') return 'file-text';
  if (m.includes('spreadsheet') || m.includes('excel') || ['xls', 'xlsx', 'csv', 'ods'].includes(ext))
    return 'file-spreadsheet';
  if (m.includes('zip') || ['zip', 'rar', '7z'].includes(ext)) return 'file-archive';
  if (m.includes('word') || ['doc', 'docx', 'odt', 'rtf'].includes(ext)) return 'file-text';
  if (m.includes('presentation') || ['ppt', 'pptx'].includes(ext)) return 'file-code';
  if (m.startsWith('text/')) return 'file-text';
  return 'file';
}

/** Emërtim i lexueshëm i tipit të skedarit. */
export function fileTypeLabel(mime = '', fileName = '') {
  const ext = String(fileName).split('.').pop()?.toUpperCase();
  if (ext && ext.length <= 5 && /^[A-Z0-9]+$/.test(ext)) return ext;
  const m = String(mime).toLowerCase();
  if (m === 'application/pdf') return 'PDF';
  if (m.startsWith('image/')) return m.split('/')[1].toUpperCase();
  return 'SKEDAR';
}

export const isImage = (mime = '') => String(mime).startsWith('image/') && !String(mime).includes('svg');
export const isPdf = (mime = '') => String(mime) === 'application/pdf';
export const isPreviewable = (mime = '') => isImage(mime) || isPdf(mime) || String(mime).startsWith('text/');

/** Pastron emrin e skedarit për Storage (ASCII, pa hapësira). */
export function safeFileName(name = 'skedar') {
  const map = { ë: 'e', Ë: 'E', ç: 'c', Ç: 'C' };
  const cleaned = String(name)
    .replace(/[ëËçÇ]/g, (c) => map[c])
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '');
  const final = cleaned || 'skedar';
  return final.length > 120 ? final.slice(-120) : final;
}

/** Shkarkon një Blob ose URL si skedar. */
export function downloadBlob(blobOrUrl, fileName) {
  const isBlob = blobOrUrl instanceof Blob;
  const url = isBlob ? URL.createObjectURL(blobOrUrl) : blobOrUrl;
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName || 'skedar';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (isBlob) setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/* ------------------------------------------------------------- Tjera ------ */

export function debounce(fn, delay = 280) {
  let timer;
  const wrapped = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
  wrapped.cancel = () => clearTimeout(timer);
  return wrapped;
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function initials(name = '', email = '') {
  const source = String(name).trim() || String(email).split('@')[0] || '?';
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

export const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(String(value).trim());

/** Forca e fjalëkalimit: 0–4 */
export function passwordStrength(password = '') {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return Math.min(score, 4);
}

export const STRENGTH_LABELS = ['Shumë i dobët', 'I dobët', 'I pranueshëm', 'I mirë', 'I fortë'];

/** Përkthen gabimet e Supabase në shqip. */
export function translateError(error) {
  if (!error) return 'Ndodhi një gabim i panjohur.';
  const raw = typeof error === 'string' ? error : error.message || error.error_description || '';
  const msg = raw.toLowerCase();
  const code = (error && (error.code || error.status)) || '';

  const map = [
    ['invalid login credentials', 'Email-i ose fjalëkalimi është i pasaktë.'],
    ['email not confirmed', 'Email-i nuk është konfirmuar. Kontrolloni inboksin tuaj.'],
    ['user already registered', 'Ky email është i regjistruar më parë.'],
    ['already been registered', 'Ky email është i regjistruar më parë.'],
    ['password should be at least', 'Fjalëkalimi duhet të ketë së paku 8 karaktere.'],
    ['password should contain', 'Fjalëkalimi nuk i përmbush kërkesat e sigurisë.'],
    ['new password should be different', 'Fjalëkalimi i ri duhet të dallojë nga i vjetri.'],
    ['unable to validate email', 'Adresa e email-it nuk është e vlefshme.'],
    ['email address is invalid', 'Adresa e email-it nuk është e vlefshme.'],
    ['for security purposes', 'Shumë kërkesa. Provoni përsëri pas një minute.'],
    ['email rate limit', 'Limiti i email-eve u arrit. Provoni më vonë.'],
    ['over_request_rate_limit', 'Shumë kërkesa. Provoni përsëri pas pak.'],
    ['token has expired', 'Lidhja ka skaduar. Kërkoni një lidhje të re.'],
    ['invalid or has expired', 'Lidhja është e pavlefshme ose ka skaduar.'],
    ['auth session missing', 'Sesioni ka skaduar. Kyçuni përsëri.'],
    ['jwt expired', 'Sesioni ka skaduar. Kyçuni përsëri.'],
    ['refresh_token_not_found', 'Sesioni ka skaduar. Kyçuni përsëri.'],
    ['duplicate key value', 'Kjo e dhënë ekziston tashmë.'],
    ['violates row-level security', 'Nuk keni të drejtë për këtë veprim.'],
    ['violates foreign key', 'Elementi i lidhur nuk ekziston.'],
    ['violates check constraint', 'Të dhënat nuk janë në formatin e kërkuar.'],
    ['payload too large', 'Skedari është shumë i madh.'],
    ['exceeded the maximum allowed size', 'Skedari e kalon madhësinë maksimale të lejuar (50 MB).'],
    ['mime type', 'Ky lloj skedari nuk lejohet.'],
    ['object not found', 'Skedari nuk u gjet në server.'],
    ['bucket not found', 'Bucket-i "documents" nuk ekziston. Ekzekutoni supabase/schema.sql.'],
    ['could not find the function', 'Funksionet e databazës mungojnë. Ekzekutoni supabase/schema.sql.'],
    ['does not exist', 'Struktura e databazës mungon. Ekzekutoni supabase/schema.sql.'],
    ['failed to fetch', 'Nuk ka lidhje me serverin. Kontrolloni internetin.'],
    ['networkerror', 'Problem me rrjetin. Provoni përsëri.'],
    ['load failed', 'Nuk ka lidhje me serverin. Provoni përsëri.'],
    ['kërkohet autentikim', 'Sesioni ka skaduar. Kyçuni përsëri.']
  ];

  for (const [needle, translation] of map) {
    if (msg.includes(needle)) return translation;
  }
  if (code === '23505') return 'Kjo e dhënë ekziston tashmë.';
  if (code === '42501') return 'Nuk keni të drejtë për këtë veprim.';
  if (code === 'PGRST116') return 'Të dhënat nuk u gjetën.';
  return raw || 'Ndodhi një gabim. Provoni përsëri.';
}

/** Lexon parametrat e URL-së (query + hash). */
export function readUrlParams() {
  const out = {};
  const apply = (source) => {
    new URLSearchParams(source).forEach((value, key) => {
      out[key] = value;
    });
  };
  if (location.search) apply(location.search.slice(1));
  if (location.hash && location.hash.includes('=')) apply(location.hash.replace(/^#\/?/, ''));
  return out;
}

export function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  return new Promise((resolve, reject) => {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      resolve();
    } catch (error) {
      reject(error);
    }
  });
}

/** Grupon një listë sipas një fushe. */
export function groupBy(list, keyFn) {
  return list.reduce((acc, item) => {
    const key = keyFn(item);
    (acc[key] ||= []).push(item);
    return acc;
  }, {});
}
