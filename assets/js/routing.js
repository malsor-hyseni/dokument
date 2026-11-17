/**
 * DOKUMENT — Routing me hash
 * -----------------------------------------------------------------------------
 * Shembull: "#/documents?status=expiring&page=2"
 * Moduli nuk ka varësi të tjera, kështu që çdo pamje mund ta importojë lirshëm.
 */

const RENDER_EVENT = 'dokument:render';

/** Lexon rrugën aktuale nga hash-i. */
export function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '') || 'dashboard';
  const [path, queryString = ''] = raw.split('?');
  const params = {};
  new URLSearchParams(queryString).forEach((value, key) => {
    if (value !== '') params[key] = value;
  });
  return { path: path || 'dashboard', params };
}

/** Ndërton hash-in për një rrugë. */
export function buildHash(path, params = {}) {
  const entries = Object.entries(params).filter(
    ([, value]) => value !== null && value !== undefined && value !== ''
  );
  const query = new URLSearchParams(entries).toString();
  return `#/${path}${query ? `?${query}` : ''}`;
}

/** Navigon te një rrugë. Nëse rruga është e njëjta, rirenderon pamjen. */
export function navigate(path, params = {}) {
  const next = buildHash(path, params);
  if (location.hash === next) requestRender();
  else location.hash = next;
}

/** Përditëson vetëm parametrat e rrugës aktuale. */
export function updateParams(patch = {}) {
  const { path, params } = parseHash();
  navigate(path, { ...params, ...patch });
}

/** Kërkon rirenderim të pamjes aktuale (pa ndryshuar URL-në). */
export function requestRender() {
  document.dispatchEvent(new CustomEvent(RENDER_EVENT));
}

/** Regjistron funksionin që rirenderon pamjen. */
export function onRenderRequest(handler) {
  document.addEventListener(RENDER_EVENT, handler);
  return () => document.removeEventListener(RENDER_EVENT, handler);
}
