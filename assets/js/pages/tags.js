/**
 * DOKUMENT — Etiketat
 * -----------------------------------------------------------------------------
 * Krijimi, riemërtimi dhe fshirja e etiketave, me numrin e dokumenteve të lidhura.
 */

import { tags } from '../api.js';
import { icon } from '../icons.js';
import { refreshAll } from '../store.js';
import { navigate } from '../routing.js';
import {
  openModal, confirmDialog, toastError, toastSuccess, emptyState, openDropdown
} from '../ui.js';
import { esc, formatNumber } from '../utils.js';
import { colorPicker, wireColorPicker, formError } from '../pickers.js';

function openTagModal({ tag = null, onDone } = {}) {
  const editing = !!tag;

  const { panel, close } = openModal({
    title: editing ? 'Redakto etiketën' : 'Etiketë e re',
    size: 'sm',
    body: `
      <form id="tag-form" class="space-y-4" novalidate>
        <div>
          <label class="label label-req" for="tag-name">Emri</label>
          <input type="text" class="input" id="tag-name" name="name" maxlength="40" required
                 value="${esc(tag?.name || '')}" placeholder="P.sh. urgjent" data-autofocus>
        </div>
        <div>
          <label class="label">Ngjyra</label>
          ${colorPicker(tag?.color || 'slate')}
        </div>
        <div data-form-error hidden></div>
      </form>`,
    footer: `
      <button type="button" class="btn btn-secondary" data-modal-close>Anulo</button>
      <button type="submit" form="tag-form" class="btn btn-primary" data-submit>
        ${editing ? 'Ruaj' : 'Krijo etiketën'}
      </button>`
  });

  const form = panel.querySelector('#tag-form');
  const submit = panel.querySelector('[data-submit]');
  const getColor = wireColorPicker(panel);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    formError(panel, null);

    const name = form.name.value.trim();
    if (!name) {
      formError(panel, 'Shkruani emrin e etiketës.');
      return;
    }

    submit.disabled = true;
    submit.innerHTML = `${icon('loader-circle', 'w-3.5 h-3.5 animate-spin')}<span>Duke ruajtur…</span>`;

    try {
      if (editing) await tags.update(tag.id, { name, color: getColor() });
      else await tags.create({ name, color: getColor() });

      toastSuccess(editing ? 'Etiketa u përditësua.' : 'Etiketa u krijua.');
      close();
      await onDone?.();
    } catch (error) {
      formError(panel, error.message || 'Ruajtja dështoi.');
      submit.disabled = false;
      submit.textContent = editing ? 'Ruaj' : 'Krijo etiketën';
    }
  });
}

export default async function renderTags(view) {
  view.innerHTML = `
    <div class="p-5 sm:p-6 max-w-4xl mx-auto space-y-5">
      <div class="h-9"></div>
      <div class="card overflow-hidden">
        ${Array.from({ length: 5 })
          .map(
            () => `<div class="flex items-center gap-3 px-4 py-3 border-b border-line last:border-0">
                     <div class="skeleton w-6 h-6 rounded-md"></div>
                     <div class="skeleton h-3 w-32"></div>
                   </div>`
          )
          .join('')}
      </div>
    </div>`;

  let list;
  try {
    list = await tags.listWithCounts();
  } catch (error) {
    view.innerHTML = `<div class="p-6">${emptyState({
      icon: 'circle-alert',
      title: 'Etiketat nuk u ngarkuan',
      description: error.message
    })}</div>`;
    return;
  }

  const used = list.filter((tag) => Number(tag.document_count) > 0).length;

  view.innerHTML = `
    <div class="p-5 sm:p-6 max-w-4xl mx-auto space-y-5">

      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 class="text-xl font-semibold text-ink">Etiketat</h2>
          <p class="mt-1 text-sm text-ink-muted">
            ${
              list.length
                ? `${formatNumber(list.length)} ${list.length === 1 ? 'etiketë' : 'etiketa'} · ${formatNumber(
                    used
                  )} në përdorim`
                : 'Etiketat shtojnë një shtresë fleksibile mbi kategoritë.'
            }
          </p>
        </div>
        <button type="button" class="btn btn-primary" data-new-tag>
          ${icon('plus')}<span>Etiketë e re</span>
        </button>
      </div>

      ${
        list.length
          ? `<div class="card overflow-hidden">
               <div class="divide-y divide-line">
                 ${list
                   .map(
                     (tag) => `
                   <div class="flex items-center gap-3 px-4 py-3 hover:bg-surface-inset/50 transition-colors">
                     <span class="badge tint-${esc(tag.color)} !h-6 !px-2.5">
                       <span class="dot dot-${esc(tag.color)}"></span>${esc(tag.name)}
                     </span>
                     <button type="button" class="flex-1 text-left text-xs text-ink-subtle"
                             data-open="${esc(tag.id)}">
                       ${
                         Number(tag.document_count)
                           ? `${formatNumber(tag.document_count)} ${
                               Number(tag.document_count) === 1 ? 'dokument' : 'dokumente'
                             }`
                           : 'Pa dokumente'
                       }
                     </button>
                     <button type="button" class="btn btn-ghost btn-icon btn-sm flex-none"
                             data-menu="${esc(tag.id)}" aria-label="Veprimet">
                       ${icon('ellipsis-vertical')}
                     </button>
                   </div>`
                   )
                   .join('')}
               </div>
             </div>`
          : `<div class="card">${emptyState({
              icon: 'tags',
              title: 'Asnjë etiketë',
              description:
                'Etiketat janë fjalë kyçe të lira: "origjinal", "skanuar", "urgjent". Një dokument mund të ketë sa të doni.',
              action: '<button type="button" class="btn btn-primary" data-new-tag>Krijo etiketën e parë</button>'
            })}</div>`
      }

      ${
        list.length
          ? `<p class="text-xs text-ink-subtle leading-6">
               Etiketat mund të krijohen edhe direkt gjatë ngarkimit të një dokumenti.
             </p>`
          : ''
      }
    </div>`;

  const reload = async () => {
    await refreshAll();
    await renderTags(view);
  };

  view.querySelectorAll('[data-new-tag]').forEach((button) =>
    button.addEventListener('click', () => openTagModal({ onDone: reload }))
  );

  view.querySelectorAll('[data-open]').forEach((button) =>
    button.addEventListener('click', () => navigate('documents', { tag: button.dataset.open }))
  );

  view.querySelectorAll('[data-menu]').forEach((button) =>
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const tag = list.find((item) => item.id === button.dataset.menu);
      if (!tag) return;

      openDropdown(button, [
        {
          label: 'Shiko dokumentet',
          icon: 'file-text',
          onClick: () => navigate('documents', { tag: tag.id })
        },
        { label: 'Redakto', icon: 'pencil', onClick: () => openTagModal({ tag, onDone: reload }) },
        { separator: true },
        {
          label: 'Fshi etiketën',
          icon: 'trash-2',
          danger: true,
          onClick: async () => {
            const count = Number(tag.document_count || 0);
            const ok = await confirmDialog({
              title: 'Fshi etiketën?',
              message: count
                ? `"${tag.name}" do të largohet nga ${count} ${count === 1 ? 'dokument' : 'dokumente'}.`
                : `"${tag.name}" do të fshihet.`,
              confirmText: 'Fshi',
              danger: true
            });
            if (!ok) return;
            try {
              await tags.remove(tag.id);
              toastSuccess('Etiketa u fshi.');
              await reload();
            } catch (error) {
              toastError(error.message);
            }
          }
        }
      ]);
    })
  );
}
