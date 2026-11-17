/**
 * DOKUMENT — Dosjet
 * -----------------------------------------------------------------------------
 * Pema hierarkike e dosjeve me krijim, riemërtim, zhvendosje dhe fshirje.
 */

import { folders } from '../api.js';
import { icon } from '../icons.js';
import { state, refreshAll } from '../store.js';
import { navigate } from '../routing.js';
import {
  openModal, confirmDialog, toastError, toastSuccess, emptyState, openDropdown
} from '../ui.js';
import { esc, formatNumber } from '../utils.js';
import { colorPicker, wireColorPicker, formError } from '../pickers.js';

/** Opsionet e dosjes prind, duke përjashtuar vetveten dhe pasardhësit. */
function parentOptions(selectedId, excludeId = null) {
  const excluded = new Set();
  if (excludeId) {
    excluded.add(excludeId);
    let changed = true;
    while (changed) {
      changed = false;
      state.folders.forEach((folder) => {
        if (folder.parent_id && excluded.has(folder.parent_id) && !excluded.has(folder.id)) {
          excluded.add(folder.id);
          changed = true;
        }
      });
    }
  }

  return [
    `<option value="">Dosje kryesore</option>`,
    ...state.folders
      .filter((folder) => !excluded.has(folder.id))
      .map((folder) => {
        const prefix = folder.depth ? `${'  '.repeat(folder.depth)}└ ` : '';
        return `<option value="${esc(folder.id)}"${
          folder.id === selectedId ? ' selected' : ''
        }>${prefix}${esc(folder.name)}</option>`;
      })
  ].join('');
}

/** Modali i krijimit/redaktimit. */
function openFolderModal({ folder = null, parentId = null, onDone } = {}) {
  const editing = !!folder;

  const { panel, close } = openModal({
    title: editing ? 'Redakto dosjen' : 'Dosje e re',
    size: 'sm',
    body: `
      <form id="folder-form" class="space-y-4" novalidate>
        <div>
          <label class="label label-req" for="folder-name">Emri</label>
          <input type="text" class="input" id="folder-name" name="name" maxlength="80" required
                 value="${esc(folder?.name || '')}" placeholder="P.sh. Dokumente 2026" data-autofocus>
        </div>
        <div>
          <label class="label" for="folder-parent">Brenda dosjes</label>
          <select class="select" id="folder-parent" name="parent_id">
            ${parentOptions(editing ? folder.parent_id : parentId, folder?.id)}
          </select>
        </div>
        <div>
          <label class="label">Ngjyra</label>
          ${colorPicker(folder?.color || 'slate')}
        </div>
        <div data-form-error hidden></div>
      </form>`,
    footer: `
      <button type="button" class="btn btn-secondary" data-modal-close>Anulo</button>
      <button type="submit" form="folder-form" class="btn btn-primary" data-submit>
        ${editing ? 'Ruaj' : 'Krijo dosjen'}
      </button>`
  });

  const form = panel.querySelector('#folder-form');
  const submit = panel.querySelector('[data-submit]');
  const getColor = wireColorPicker(panel);
  const showError = (message) => formError(panel, message);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    formError(panel, null);

    const name = form.name.value.trim();
    if (!name) {
      showError('Shkruani emrin e dosjes.');
      return;
    }

    submit.disabled = true;
    submit.innerHTML = `${icon('loader-circle', 'w-3.5 h-3.5 animate-spin')}<span>Duke ruajtur…</span>`;

    try {
      const payload = {
        name,
        parent_id: form.parent_id.value || null,
        color: getColor()
      };
      if (editing) await folders.update(folder.id, payload);
      else await folders.create(payload);

      toastSuccess(editing ? 'Dosja u përditësua.' : 'Dosja u krijua.');
      close();
      await onDone?.();
    } catch (error) {
      showError(error.message || 'Ruajtja dështoi.');
      submit.disabled = false;
      submit.textContent = editing ? 'Ruaj' : 'Krijo dosjen';
    }
  });
}

export default async function renderFolders(view) {
  const tree = state.folders;
  const totalDocs = tree.reduce((sum, folder) => sum + Number(folder.document_count || 0), 0);

  view.innerHTML = `
    <div class="p-5 sm:p-6 max-w-5xl mx-auto space-y-5">

      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 class="text-xl font-semibold text-ink">Dosjet</h2>
          <p class="mt-1 text-sm text-ink-muted">
            ${
              tree.length
                ? `${formatNumber(tree.length)} ${tree.length === 1 ? 'dosje' : 'dosje'} · ${formatNumber(
                    totalDocs
                  )} dokumente të organizuara`
                : 'Krijoni dosje për të strukturuar dokumentet tuaja.'
            }
          </p>
        </div>
        <button type="button" class="btn btn-primary" data-new-folder>
          ${icon('folder-plus')}<span>Dosje e re</span>
        </button>
      </div>

      ${
        tree.length
          ? `<div class="card overflow-hidden">
               <div class="divide-y divide-line">
                 ${tree
                   .map(
                     (folder) => `
                   <div class="flex items-center gap-3 px-4 py-3 hover:bg-surface-inset/50 transition-colors group"
                        data-folder="${esc(folder.id)}">
                     <div style="width:${(folder.depth || 0) * 18}px" class="flex-none"></div>
                     <span class="flex-none text-ink-muted">
                       ${folder.depth ? icon('corner-down-right', 'w-3.5 h-3.5 opacity-50') : ''}
                     </span>
                     <span class="w-8 h-8 rounded-md flex items-center justify-center flex-none border
                                  tint-${esc(folder.color)}">${icon('folder', 'w-4 h-4')}</span>
                     <button type="button" class="min-w-0 flex-1 text-left" data-open="${esc(folder.id)}">
                       <p class="text-sm font-medium text-ink truncate">${esc(folder.name)}</p>
                       <p class="text-xs text-ink-subtle">
                         ${
                           Number(folder.document_count)
                             ? `${formatNumber(folder.document_count)} ${
                                 Number(folder.document_count) === 1 ? 'dokument' : 'dokumente'
                               }`
                             : 'Bosh'
                         }
                       </p>
                     </button>
                     <button type="button" class="btn btn-ghost btn-icon btn-sm flex-none"
                             data-menu="${esc(folder.id)}" aria-label="Veprimet">
                       ${icon('ellipsis-vertical')}
                     </button>
                   </div>`
                   )
                   .join('')}
               </div>
             </div>`
          : `<div class="card">${emptyState({
              icon: 'folders',
              title: 'Asnjë dosje',
              description:
                'Dosjet ndihmojnë për të grupuar dokumentet sipas vitit, familjes ose qëllimit. Mund të ndërthurin edhe nën-dosje.',
              action: '<button type="button" class="btn btn-primary" data-new-folder>Krijo dosjen e parë</button>'
            })}</div>`
      }

      ${
        tree.length
          ? `<p class="text-xs text-ink-subtle leading-6">
               Fshirja e një dosjeje largon edhe nën-dosjet e saj. Dokumentet nuk fshihen —
               thjesht mbeten pa dosje.
             </p>`
          : ''
      }
    </div>`;

  const reload = async () => {
    await refreshAll();
    await renderFolders(view);
  };

  view.querySelectorAll('[data-new-folder]').forEach((button) =>
    button.addEventListener('click', () => openFolderModal({ onDone: reload }))
  );

  view.querySelectorAll('[data-open]').forEach((button) =>
    button.addEventListener('click', () => navigate('documents', { folder: button.dataset.open }))
  );

  view.querySelectorAll('[data-menu]').forEach((button) =>
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const folder = tree.find((item) => item.id === button.dataset.menu);
      if (!folder) return;

      openDropdown(button, [
        {
          label: 'Shiko dokumentet',
          icon: 'file-text',
          onClick: () => navigate('documents', { folder: folder.id })
        },
        {
          label: 'Nën-dosje e re',
          icon: 'folder-plus',
          onClick: () => openFolderModal({ parentId: folder.id, onDone: reload })
        },
        { label: 'Redakto', icon: 'pencil', onClick: () => openFolderModal({ folder, onDone: reload }) },
        { separator: true },
        {
          label: 'Fshi dosjen',
          icon: 'trash-2',
          danger: true,
          onClick: async () => {
            const children = tree.filter((item) => item.parent_id === folder.id).length;
            const ok = await confirmDialog({
              title: 'Fshi dosjen?',
              message: `"${folder.name}"${
                children ? ` dhe ${children} nën-dosje` : ''
              } do të fshihet. Dokumentet brenda mbeten, por pa dosje.`,
              confirmText: 'Fshi',
              danger: true
            });
            if (!ok) return;
            try {
              await folders.remove(folder.id);
              toastSuccess('Dosja u fshi.');
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
