/**
 * DOKUMENT — Konfigurimi i aplikacionit
 */

const env = (typeof window !== 'undefined' && window.DOKUMENT_ENV) || {};

export const SUPABASE_URL = (env.SUPABASE_URL || '').trim();
export const SUPABASE_ANON_KEY = (env.SUPABASE_ANON_KEY || '').trim();

/** A janë vendosur kredencialet e Supabase? */
export const isConfigured =
  SUPABASE_URL.startsWith('http') && SUPABASE_ANON_KEY.length > 20;

export const APP = {
  name: 'DOKUMENT',
  tagline: 'Dokumentet tuaja, të organizuara.',
  version: '1.0.0',
  /** Bucket-i privat i dokumenteve */
  bucket: 'documents',
  /** Bucket-i i fotove të profilit */
  avatarBucket: 'avatars',
  /** Madhësia maksimale e skedarit — duhet të përputhet me schema.sql */
  maxFileSize: 50 * 1024 * 1024,
  maxAvatarSize: 2 * 1024 * 1024,
  /** Afati i URL-ve të nënshkruara (sekonda) */
  signedUrlTtl: 60 * 10,
  /** Dokumente për faqe */
  pageSize: 20,
  /** Kufiri i hapësirës për përdorues (vetëm informativ në ndërfaqe) */
  defaultQuota: 1024 * 1024 * 1024
};

/** Llojet e skedarëve të lejuar — duhet të përputhen me politikat e Storage. */
export const ALLOWED_MIME = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  'image/svg+xml',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'text/plain',
  'text/csv',
  'text/markdown',
  'application/zip',
  'application/x-zip-compressed',
  'application/rtf'
];

export const ACCEPT_ATTR =
  '.pdf,.png,.jpg,.jpeg,.webp,.gif,.heic,.heif,.svg,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.txt,.csv,.md,.zip,.rtf';

/** Paleta e ngjyrave për kategori, dosje dhe etiketa (duhet të përputhet me CHECK-un në SQL). */
export const COLORS = [
  { id: 'slate', label: 'Gri' },
  { id: 'blue', label: 'Kaltër' },
  { id: 'green', label: 'Gjelbër' },
  { id: 'amber', label: 'Ambër' },
  { id: 'red', label: 'Kuqe' },
  { id: 'violet', label: 'Vjollcë' },
  { id: 'teal', label: 'Bruz' },
  { id: 'rose', label: 'Rozë' },
  { id: 'orange', label: 'Portokalli' },
  { id: 'indigo', label: 'Indigo' }
];

/** Ikonat e disponueshme për kategoritë. */
export const CATEGORY_ICONS = [
  'folder', 'user', 'wallet', 'heart-pulse', 'graduation-cap', 'briefcase',
  'car', 'house', 'shield', 'file-text', 'credit-card', 'plane',
  'stethoscope', 'gavel', 'receipt', 'building-2', 'globe', 'key',
  'bookmark', 'star', 'zap', 'database'
];

/** Rrugët e aplikacionit. */
export const ROUTES = {
  landing: '/index.html',
  login: '/login.html',
  register: '/register.html',
  forgot: '/forgot-password.html',
  reset: '/reset-password.html',
  app: '/app.html'
};
