/**
 * DOKUMENT — Zgjedhësit e ngjyrës dhe ikonës
 * -----------------------------------------------------------------------------
 * Përdoren nga kategoritë, dosjet dhe etiketat.
 */

import { COLORS, CATEGORY_ICONS } from './config.js';
import { icon } from './icons.js';
import { esc } from './utils.js';

/** HTML-i i zgjedhësit të ngjyrave. */
export function colorPicker(selected = 'slate') {
  return `
    <div class="flex flex-wrap gap-2" data-color-picker role="group" aria-label="Ngjyra">
      ${COLORS.map(
        (color) => `
        <button type="button" class="swatch" data-color="${color.id}" title="${esc(color.label)}"
                aria-label="${esc(color.label)}" aria-pressed="${color.id === selected ? 'true' : 'false'}"
                style="background-color:rgb(var(--c-${color.id}))"></button>`
      ).join('')}
    </div>`;
}

/** Lidh zgjedhësin e ngjyrave. Kthen funksionin që lexon ngjyrën e zgjedhur. */
export function wireColorPicker(scope) {
  const picker = scope.querySelector('[data-color-picker]');
  if (!picker) return () => 'slate';

  picker.querySelectorAll('[data-color]').forEach((button) =>
    button.addEventListener('click', () => {
      picker.querySelectorAll('[data-color]').forEach((other) =>
        other.setAttribute('aria-pressed', other === button ? 'true' : 'false')
      );
    })
  );

  return () => picker.querySelector('[data-color][aria-pressed="true"]')?.dataset.color || 'slate';
}

/** HTML-i i zgjedhësit të ikonave. */
export function iconPicker(selected = 'folder') {
  return `
    <div class="grid grid-cols-8 gap-1.5 p-2 rounded-lg border border-line bg-surface-inset/40"
         data-icon-picker role="group" aria-label="Ikona">
      ${CATEGORY_ICONS.map(
        (name) => `
        <button type="button" data-icon-name="${name}" aria-pressed="${name === selected ? 'true' : 'false'}"
                class="aspect-square rounded-md flex items-center justify-center text-ink-muted
                       hover:bg-surface hover:text-ink transition-colors text-sm
                       aria-pressed:bg-accent aria-pressed:text-accent-ink"
                title="${name}" aria-label="${name}">${icon(name)}</button>`
      ).join('')}
    </div>`;
}

/** Lidh zgjedhësin e ikonave. Kthen funksionin që lexon ikonën e zgjedhur. */
export function wireIconPicker(scope) {
  const picker = scope.querySelector('[data-icon-picker]');
  if (!picker) return () => 'folder';

  const paint = () => {
    picker.querySelectorAll('[data-icon-name]').forEach((button) => {
      const active = button.getAttribute('aria-pressed') === 'true';
      button.style.backgroundColor = active ? 'rgb(var(--accent))' : '';
      button.style.color = active ? 'rgb(var(--accent-ink))' : '';
    });
  };

  picker.querySelectorAll('[data-icon-name]').forEach((button) =>
    button.addEventListener('click', () => {
      picker.querySelectorAll('[data-icon-name]').forEach((other) =>
        other.setAttribute('aria-pressed', other === button ? 'true' : 'false')
      );
      paint();
    })
  );
  paint();

  return () => picker.querySelector('[data-icon-name][aria-pressed="true"]')?.dataset.iconName || 'folder';
}

/** Kutia e gabimit brenda një formulari modal. */
export function formError(scope, message) {
  const box = scope.querySelector('[data-form-error]');
  if (!box) return;
  if (!message) {
    box.hidden = true;
    return;
  }
  box.className =
    'flex items-start gap-2 p-2.5 rounded-lg border border-danger/25 bg-danger/5 text-danger text-sm';
  box.innerHTML = `<span class="mt-0.5 flex-none">${icon('circle-alert')}</span><span>${esc(message)}</span>`;
  box.hidden = false;
}
