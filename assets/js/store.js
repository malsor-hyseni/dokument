/**
 * DOKUMENT — Gjendja e përbashkët
 * -----------------------------------------------------------------------------
 * Një burim i vetëm i vërtetësisë për përdoruesin, profilin, kategoritë, dosjet,
 * etiketat dhe statistikat. Pamjet dhe shell-i abonohen për rifreskim.
 */

import { categories, folders, tags, stats } from './api.js';

export const state = {
  user: null,
  profile: null,
  categories: [],
  folders: [],
  tags: [],
  stats: null,
  route: null
};

const listeners = new Set();

/** Abonohu në ndryshimet e gjendjes. Kthen funksionin e shkëputjes. */
export function onStateChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit() {
  listeners.forEach((listener) => {
    try {
      listener(state);
    } catch (error) {
      console.error('[DOKUMENT] Gabim në dëgjuesin e gjendjes:', error);
    }
  });
}

/** Rifreskon kategoritë, dosjet dhe etiketat. */
export async function refreshLookups() {
  const [cats, flds, tgs] = await Promise.all([
    categories.list().catch(() => state.categories),
    folders.tree().catch(() => state.folders),
    tags.list().catch(() => state.tags)
  ]);
  state.categories = cats || [];
  state.folders = flds || [];
  state.tags = tgs || [];
  emit();
  return state;
}

/** Rifreskon statistikat e dashboard-it. */
export async function refreshStats() {
  try {
    state.stats = await stats.dashboard();
  } catch (error) {
    console.warn('[DOKUMENT] Statistikat nuk u lexuan:', error.message);
  }
  emit();
  return state.stats;
}

/** Rifreskon të gjitha të dhënat e përbashkëta. */
export async function refreshAll() {
  await Promise.all([refreshLookups(), refreshStats()]);
  return state;
}

/** Përditëson profilin në gjendje dhe njofton dëgjuesit. */
export function setProfile(profile) {
  state.profile = profile;
  emit();
  return profile;
}

/** Numri i ditëve të paralajmërimit sipas cilësimeve të përdoruesit. */
export const warningDays = () => Number(state.profile?.expiry_warning_days || 30);

/** Gjen një kategori sipas id-së. */
export const findCategory = (id) => state.categories.find((c) => c.id === id) || null;

/** Gjen një dosje sipas id-së. */
export const findFolder = (id) => state.folders.find((f) => f.id === id) || null;
