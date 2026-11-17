/**
 * DOKUMENT — Kategoritë
 * -----------------------------------------------------------------------------
 * Rrjet i kategorive me ngjyrë, ikonë, numër dokumentesh dhe hapësirë të zënë.
 */

import { categories } from '../api.js';
import { icon } from '../icons.js';
import { refreshAll } from '../store.js';
import { navigate } from '../routing.js';
import {
  openModal, confirmDialog, toastError, toastSuccess, emptyState, openDropdown
} from '../ui.js';
import { esc, formatBytes, formatNumber } from '../utils.js';
import { colorPicker, wireColorPicker, iconPicker, wireIconPicker, formError } from '../pickers.js';

function openCategoryModal({ category = null, onDone } = {}) {
  const editing = !!category;

  const { panel, close } = openModal({
    title: editing ? 'Redakto kategorinë' : 'Kategori e re',
    size: 'md',
    body: `
      <form id="category-form" class="space-y-4" novalidate>
        <div>
          <label class="label label-req" for="cat-name">Emri</label>
          <input type="text" class="input" id="cat-name" name="name" maxlength="60" required
                 value="${esc(category?.name || '')}" placeholder="P.sh. Dokumente personale" data-autofocus>
        </div>

        <div>
          <label class="label" for="cat-desc">Përshkrimi</label>
          <input type="text" class="input" id="cat-desc" name="description" maxlength="300"
                 value="${esc(category?.description || '')}" placeholder="Opsionale">
        </div>

        <div>
          <label class="label">Ngjyra</label>
          ${colorPicker(category?.color || 'blue')}
        </div>

        <div>
          <label class="label">Ikona</label>
          ${iconPicker(category?.icon || 'folder')}
        </div>

        <div data-form-error hidden></div>
      </form>`,
    footer: `
      <button type="button" class="btn btn-secondary" data-modal-close>Anulo</button>
      <button type="submit" form="category-form" class="btn btn-primary" data-submit>
        ${editing ? 'Ruaj' : 'Krijo kategorinë'}
      </button>`
  });

  const form = panel.querySelector('#category-form');
  const submit = panel.querySelector('[data-submit]');
  const getColor = wireColorPicker(panel);
  const getIcon = wireIconPicker(panel);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    formError(panel, null);

    const name = form.name.value.trim();
    if (!name) {
      formError(panel, 'Shkruani emrin e kategorisë.');
      return;
    }

    submit.disabled = true;
    submit.innerHTML = `${icon('loader-circle', 'w-3.5 h-3.5 animate-spin')}<span>Duke ruajtur…</span>`;

    try {
      const payload = {
        name,
        description: form.description.value.trim() || null,
        color: getColor(),
        icon: getIcon()
      };
      if (editing) await categories.update(category.id, payload);
      else await categories.create(payload);

      toastSuccess(editing ? 'Kategoria u përditësua.' : 'Kategoria u krijua.');
      close();
      await onDone?.();
    } catch (error) {
      formError(panel, error.message || 'Ruajtja dështoi.');
      submit.disabled = false;
      submit.textContent = editing ? 'Ruaj' : 'Krijo kategorinë';
    }
  });
}

export default async function renderCategories(view) {
  view.innerHTML = `
    <div class="p-5 sm:p-6 max-w-6xl mx-auto space-y-5">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 class="text-xl font-semibold text-ink">Kategoritë</h2>
          <p class="mt-1 text-sm text-ink-muted">Duke ngarkuar…</p>
        </div>
      </div>
      <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        ${Array.from({ length: 6 }).map(() => '<div class="skeleton h-[122px] rounded-xl"></div>').join('')}
      </div>
    </div>`;

  let list;
  try {
    list = await categories.listWithCounts();
  } catch (error) {
    view.innerHTML = `<div class="p-6">${emptyState({
      icon: 'circle-alert',
      title: 'Kategoritë nuk u ngarkuan',
      description: error.message
    })}</div>`;
    return;
  }

  const totalDocs = list.reduce((sum, item) => sum + Number(item.document_count || 0), 0);

  view.innerHTML = `
    <div class="p-5 sm:p-6 max-w-6xl mx-auto space-y-5">

      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 class="text-xl font-semibold text-ink">Kategoritë</h2>
          <p class="mt-1 text-sm text-ink-muted">
            ${
              list.length
                ? `${formatNumber(list.length)} kategori · ${formatNumber(totalDocs)} dokumente të klasifikuara`
                : 'Krijoni kategorinë e parë për të klasifikuar dokumentet.'
            }
          </p>
        </div>
        <button type="button" class="btn btn-primary" data-new-category>
          ${icon('plus')}<span>Kategori e re</span>
        </button>
      </div>

      ${
        list.length
          ? `<div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
               ${list
                 .map(
                   (category) => `
                 <article class="card card-pad hover:border-line-strong transition-colors"
                          data-category="${esc(category.id)}">
                   <div class="flex items-start justify-between gap-3">
                     <span class="w-9 h-9 rounded-lg flex items-center justify-center flex-none border
                                  tint-${esc(category.color)}">${icon(category.icon || 'folder', 'w-4 h-4')}</span>
                     <button type="button" class="btn btn-ghost btn-icon btn-sm -mt-1 -mr-1"
                             data-menu="${esc(category.id)}" aria-label="Veprimet">
                       ${icon('ellipsis-vertical')}
                     </button>
                   </div>

                   <button type="button" class="block w-full text-left mt-3.5" data-open="${esc(category.id)}">
                     <h3 class="text-sm font-semibold text-ink truncate">${esc(category.name)}</h3>
                     <p class="mt-1 text-xs text-ink-muted truncate">
                       ${
                         category.description
                           ? esc(category.description)
                           : Number(category.document_count)
                           ? `${formatNumber(category.document_count)} ${
                               Number(category.document_count) === 1 ? 'dokument' : 'dokumente'
                             }`
                           : 'Bosh'
                       }
                     </p>
                   </button>

                   <div class="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-line">
                     <span class="text-xs text-ink-muted tabular">
                       ${formatNumber(category.document_count || 0)} dok.
                     </span>
                     <span class="text-xs text-ink-subtle tabular">${esc(formatBytes(category.total_size || 0))}</span>
                   </div>
                 </article>`
                 )
                 .join('')}
             </div>`
          : `<div class="card">${emptyState({
              icon: 'layout-grid',
              title: 'Asnjë kategori',
              description:
                'Kategoritë bazë krijohen automatikisht me llogarinë. Nëse i fshini, mund të krijoni të tjera sipas nevojës.',
              action: '<button type="button" class="btn btn-primary" data-new-category>Krijo kategori</button>'
            })}</div>`
      }

      ${
        list.length
          ? `<p class="text-xs text-ink-subtle leading-6">
               Fshirja e një kategorie nuk fshin dokumentet — ato mbeten pa kategori.
             </p>`
          : ''
      }
    </div>`;

  const reload = async () => {
    await refreshAll();
    await renderCategories(view);
  };

  view.querySelectorAll('[data-new-category]').forEach((button) =>
    button.addEventListener('click', () => openCategoryModal({ onDone: reload }))
  );

  view.querySelectorAll('[data-open]').forEach((button) =>
    button.addEventListener('click', () => navigate('documents', { category: button.dataset.open }))
  );

  view.querySelectorAll('[data-menu]').forEach((button) =>
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const category = list.find((item) => item.id === button.dataset.menu);
      if (!category) return;

      openDropdown(button, [
        {
          label: 'Shiko dokumentet',
          icon: 'file-text',
          onClick: () => navigate('documents', { category: category.id })
        },
        { label: 'Redakto', icon: 'pencil', onClick: () => openCategoryModal({ category, onDone: reload }) },
        { separator: true },
        {
          label: 'Fshi kategorinë',
          icon: 'trash-2',
          danger: true,
          onClick: async () => {
            const count = Number(category.document_count || 0);
            const ok = await confirmDialog({
              title: 'Fshi kategorinë?',
              message: count
                ? `"${category.name}" do të fshihet. ${count} ${
                    count === 1 ? 'dokument' : 'dokumente'
                  } do të mbeten pa kategori.`
                : `"${category.name}" do të fshihet.`,
              confirmText: 'Fshi',
              danger: true
            });
            if (!ok) return;
            try {
              await categories.remove(category.id);
              toastSuccess('Kategoria u fshi.');
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
