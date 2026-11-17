/**
 * DOKUMENT — Komponentët e ndërfaqes
 * -----------------------------------------------------------------------------
 * Tema (light/dark/system), njoftimet toast, modalet, dialogu i konfirmimit,
 * dropdown-at dhe shiriti i progresit.
 */

import { icon } from './icons.js';
import { esc } from './utils.js';

/* ============================================================== TEMA ====== */

const THEME_KEY = 'dokument.theme';

/** Vendos temën: 'light' | 'dark' | 'system' */
export function applyTheme(theme) {
  const value = ['light', 'dark', 'system'].includes(theme) ? theme : 'system';
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  const dark = value === 'dark' || (value === 'system' && prefersDark);
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.dataset.theme = value;
  try {
    localStorage.setItem(THEME_KEY, value);
  } catch { /* localStorage i bllokuar */ }
  document.dispatchEvent(new CustomEvent('themechange', { detail: { theme: value, dark } }));
  return value;
}

export function getTheme() {
  try {
    return localStorage.getItem(THEME_KEY) || 'system';
  } catch {
    return 'system';
  }
}

export function initTheme() {
  const theme = getTheme();
  applyTheme(theme);
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (getTheme() === 'system') applyTheme('system');
  });
  return theme;
}

/** Kalon ciklikisht light → dark → system */
export function cycleTheme() {
  const order = ['light', 'dark', 'system'];
  const next = order[(order.indexOf(getTheme()) + 1) % order.length];
  return applyTheme(next);
}

export const themeIcon = (theme = getTheme()) =>
  theme === 'light' ? 'sun' : theme === 'dark' ? 'moon' : 'monitor';

export const themeLabel = (theme = getTheme()) =>
  theme === 'light' ? 'E çelur' : theme === 'dark' ? 'E errët' : 'Sistemi';

/* ============================================================= TOAST ====== */

function toastStack() {
  let stack = document.getElementById('toast-stack');
  if (!stack) {
    stack = document.createElement('div');
    stack.id = 'toast-stack';
    stack.className = 'toast-stack';
    stack.setAttribute('role', 'status');
    stack.setAttribute('aria-live', 'polite');
    document.body.appendChild(stack);
  }
  return stack;
}

/**
 * Shfaq një njoftim.
 * @param {string} message
 * @param {'success'|'error'|'info'} type
 * @param {number} duration ms
 */
export function toast(message, type = 'info', duration = 4200) {
  const stack = toastStack();
  const icons = { success: 'circle-check', error: 'circle-alert', info: 'info' };
  const node = document.createElement('div');
  node.className = `toast toast-${type} animate-slide-left`;
  node.innerHTML = `
    ${icon(icons[type] || 'info')}
    <div class="flex-1 text-ink leading-5">${esc(message)}</div>
    <button type="button" class="text-ink-subtle hover:text-ink transition-colors -mt-0.5" aria-label="Mbyll">
      ${icon('x', 'w-3.5 h-3.5')}
    </button>`;

  const remove = () => {
    node.classList.remove('animate-slide-left');
    node.classList.add('animate-fade-out');
    setTimeout(() => node.remove(), 160);
  };
  node.querySelector('button').addEventListener('click', remove);
  stack.appendChild(node);
  if (duration > 0) setTimeout(remove, duration);
  return remove;
}

export const toastSuccess = (m, d) => toast(m, 'success', d);
export const toastError = (m, d) => toast(m, 'error', d ?? 5600);
export const toastInfo = (m, d) => toast(m, 'info', d);

/* ============================================================ MODALE ====== */

let openModals = 0;

/**
 * Hap një modal.
 * @param {{title?:string, description?:string, body:string, footer?:string,
 *          size?:'sm'|'md'|'lg'|'xl', closable?:boolean, onMount?:Function}} options
 * @returns {{close:Function, panel:HTMLElement, backdrop:HTMLElement}}
 */
export function openModal({
  title = '',
  description = '',
  body = '',
  footer = '',
  size = 'md',
  closable = true,
  onMount
} = {}) {
  const widths = { sm: '400px', md: '520px', lg: '680px', xl: '920px' };
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop animate-fade-in';
  backdrop.innerHTML = `
    <div class="modal-panel animate-scale-in" role="dialog" aria-modal="true"
         ${title ? 'aria-labelledby="modal-title"' : ''} style="max-width:${widths[size] || widths.md}">
      ${
        title
          ? `<div class="modal-head">
               <div class="min-w-0">
                 <h2 id="modal-title" class="text-base font-semibold text-ink truncate">${esc(title)}</h2>
                 ${description ? `<p class="text-xs text-ink-muted mt-1 leading-5">${esc(description)}</p>` : ''}
               </div>
               ${
                 closable
                   ? `<button type="button" data-modal-close class="btn btn-ghost btn-icon btn-sm -mr-1 -mt-0.5" aria-label="Mbyll">
                        ${icon('x')}
                      </button>`
                   : ''
               }
             </div>`
          : ''
      }
      <div class="modal-body">${body}</div>
      ${footer ? `<div class="modal-foot">${footer}</div>` : ''}
    </div>`;

  const panel = backdrop.querySelector('.modal-panel');
  const previousFocus = document.activeElement;

  const close = () => {
    if (!backdrop.isConnected) return;
    backdrop.classList.add('animate-fade-out');
    setTimeout(() => {
      backdrop.remove();
      openModals = Math.max(0, openModals - 1);
      if (openModals === 0) document.body.style.overflow = '';
      if (previousFocus instanceof HTMLElement) previousFocus.focus({ preventScroll: true });
    }, 130);
    document.removeEventListener('keydown', onKey);
  };

  function onKey(event) {
    if (event.key === 'Escape' && closable) {
      event.stopPropagation();
      close();
    }
    if (event.key === 'Tab') trapFocus(event, panel);
  }

  backdrop.addEventListener('mousedown', (event) => {
    if (event.target === backdrop && closable) close();
  });
  backdrop.querySelectorAll('[data-modal-close]').forEach((btn) =>
    btn.addEventListener('click', close)
  );
  document.addEventListener('keydown', onKey);

  document.body.appendChild(backdrop);
  openModals += 1;
  document.body.style.overflow = 'hidden';

  // Fokusi i parë
  const focusable = panel.querySelector(
    'input:not([type=hidden]):not([disabled]), textarea, select, [data-autofocus]'
  );
  (focusable || panel.querySelector('button') || panel).focus?.({ preventScroll: true });

  onMount?.({ panel, close, backdrop });
  return { close, panel, backdrop };
}

function trapFocus(event, container) {
  const nodes = Array.from(
    container.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')
  ).filter((n) => n.offsetParent !== null);
  if (!nodes.length) return;
  const first = nodes[0];
  const last = nodes[nodes.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

/**
 * Dialog konfirmimi.
 * @returns {Promise<boolean>}
 */
export function confirmDialog({
  title = 'A jeni të sigurt?',
  message = '',
  confirmText = 'Konfirmo',
  cancelText = 'Anulo',
  danger = false,
  icon: iconName = danger ? 'triangle-alert' : 'circle-help'
} = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const { close, panel } = openModal({
      size: 'sm',
      body: `
        <div class="flex gap-3.5">
          <div class="flex items-center justify-center w-9 h-9 rounded-md flex-none ${
            danger ? 'bg-danger/10 text-danger' : 'bg-accent/10 text-accent'
          }">${icon(iconName, 'w-4 h-4')}</div>
          <div class="min-w-0 pt-0.5">
            <h2 class="text-sm font-semibold text-ink">${esc(title)}</h2>
            ${message ? `<p class="text-sm text-ink-muted mt-1.5 leading-6">${esc(message)}</p>` : ''}
          </div>
        </div>`,
      footer: `
        <button type="button" class="btn btn-secondary" data-cancel>${esc(cancelText)}</button>
        <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-confirm data-autofocus>
          ${esc(confirmText)}
        </button>`
    });

    panel.querySelector('[data-cancel]').addEventListener('click', () => {
      finish(false);
      close();
    });
    panel.querySelector('[data-confirm]').addEventListener('click', () => {
      finish(true);
      close();
    });
    panel.closest('.modal-backdrop').addEventListener('mousedown', (event) => {
      if (event.target === event.currentTarget) finish(false);
    });
    document.addEventListener('keydown', function onEsc(event) {
      if (event.key === 'Escape') {
        finish(false);
        document.removeEventListener('keydown', onEsc);
      }
    });
  });
}

/* ========================================================== DROPDOWN ====== */

let activeDropdown = null;

/** Mbyll dropdown-in e hapur. */
export function closeDropdown() {
  if (activeDropdown) {
    activeDropdown.remove();
    activeDropdown = null;
    document.removeEventListener('mousedown', onOutside, true);
    document.removeEventListener('keydown', onDropdownKey, true);
    window.removeEventListener('resize', closeDropdown);
    window.removeEventListener('scroll', closeDropdown, true);
  }
}

function onOutside(event) {
  if (activeDropdown && !activeDropdown.contains(event.target)) closeDropdown();
}
function onDropdownKey(event) {
  if (event.key === 'Escape') closeDropdown();
}

/**
 * Hap një menu pranë një elementi.
 * @param {HTMLElement} anchor
 * @param {Array<{label:string, icon?:string, danger?:boolean, separator?:boolean, onClick?:Function, disabled?:boolean}>} items
 * @param {{align?:'left'|'right', width?:number}} options
 */
export function openDropdown(anchor, items, { align = 'right', width = 190 } = {}) {
  closeDropdown();
  const menu = document.createElement('div');
  menu.className = 'dropdown animate-scale-in';
  menu.setAttribute('role', 'menu');
  menu.style.minWidth = `${width}px`;

  items.forEach((item) => {
    if (item.separator) {
      menu.appendChild(Object.assign(document.createElement('div'), { className: 'dropdown-sep' }));
      return;
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `dropdown-item${item.danger ? ' is-danger' : ''}`;
    button.setAttribute('role', 'menuitem');
    if (item.disabled) {
      button.disabled = true;
      button.style.opacity = '0.45';
      button.style.cursor = 'not-allowed';
    }
    button.innerHTML = `${item.icon ? icon(item.icon) : ''}<span>${esc(item.label)}</span>`;
    button.addEventListener('click', () => {
      closeDropdown();
      item.onClick?.();
    });
    menu.appendChild(button);
  });

  document.body.appendChild(menu);
  const rect = anchor.getBoundingClientRect();
  const menuRect = menu.getBoundingClientRect();

  let top = rect.bottom + 6;
  if (top + menuRect.height > window.innerHeight - 8) {
    top = Math.max(8, rect.top - menuRect.height - 6);
  }
  let left = align === 'right' ? rect.right - menuRect.width : rect.left;
  left = Math.max(8, Math.min(left, window.innerWidth - menuRect.width - 8));

  menu.style.position = 'fixed';
  menu.style.top = `${top}px`;
  menu.style.left = `${left}px`;

  activeDropdown = menu;
  setTimeout(() => {
    document.addEventListener('mousedown', onOutside, true);
    document.addEventListener('keydown', onDropdownKey, true);
    window.addEventListener('resize', closeDropdown);
    window.addEventListener('scroll', closeDropdown, true);
  }, 0);
  return menu;
}

/* ========================================================== PROGRESI ====== */

let progressEl = null;
let progressTimer = null;

export function startPageProgress() {
  if (!progressEl) {
    progressEl = document.createElement('div');
    progressEl.className = 'page-progress';
    document.body.appendChild(progressEl);
  }
  progressEl.style.opacity = '1';
  progressEl.style.width = '12%';
  clearInterval(progressTimer);
  let value = 12;
  progressTimer = setInterval(() => {
    value = Math.min(value + Math.random() * 12, 88);
    progressEl.style.width = `${value}%`;
  }, 260);
}

export function stopPageProgress() {
  if (!progressEl) return;
  clearInterval(progressTimer);
  progressEl.style.width = '100%';
  setTimeout(() => {
    progressEl.style.opacity = '0';
    setTimeout(() => {
      if (progressEl) progressEl.style.width = '0%';
    }, 300);
  }, 180);
}

/* =========================================================== BUTONAT ====== */

/** Kalon një buton në gjendje "duke punuar" dhe kthen funksionin e rikthimit. */
export function setButtonLoading(button, loadingText) {
  if (!button) return () => {};
  const original = button.innerHTML;
  const wasDisabled = button.disabled;
  button.disabled = true;
  button.innerHTML = `${icon('loader-circle', 'w-3.5 h-3.5 animate-spin')}<span>${esc(
    loadingText || 'Duke punuar…'
  )}</span>`;
  return () => {
    button.disabled = wasDisabled;
    button.innerHTML = original;
  };
}

/* ====================================================== GJENDJET BOSH ===== */

export function emptyState({ icon: iconName = 'inbox', title, description = '', action = '' }) {
  return `
    <div class="empty-state">
      <div class="empty-icon">${icon(iconName)}</div>
      <h3 class="text-sm font-semibold text-ink">${esc(title)}</h3>
      ${description ? `<p class="text-sm text-ink-muted mt-1.5 max-w-sm leading-6">${esc(description)}</p>` : ''}
      ${action ? `<div class="mt-5">${action}</div>` : ''}
    </div>`;
}

export function skeletonRows(count = 5) {
  return Array.from({ length: count })
    .map(
      () => `
      <div class="flex items-center gap-3 px-4 py-3 border-b border-line last:border-0">
        <div class="skeleton w-8 h-8 rounded-md"></div>
        <div class="flex-1 space-y-2">
          <div class="skeleton h-3 w-2/5"></div>
          <div class="skeleton h-2.5 w-1/4"></div>
        </div>
        <div class="skeleton h-5 w-16 rounded-md"></div>
      </div>`
    )
    .join('');
}

/* ============================================================= FOKUS ====== */

/** Lidh shkurtesat e tastierës globale. */
export function bindShortcuts(handlers = {}) {
  document.addEventListener('keydown', (event) => {
    const tag = document.activeElement?.tagName;
    const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    const key = event.key.toLowerCase();

    if ((event.metaKey || event.ctrlKey) && key === 'k') {
      event.preventDefault();
      handlers.search?.();
      return;
    }
    if (typing || event.metaKey || event.ctrlKey || event.altKey) return;
    if (key === '/') {
      event.preventDefault();
      handlers.search?.();
    } else if (key === 'n') {
      handlers.upload?.();
    }
  });
}
