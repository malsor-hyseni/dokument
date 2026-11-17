/**
 * DOKUMENT — Lista e dokumenteve
 * -----------------------------------------------------------------------------
 * Kërkim, filtrim, renditje, faqezim, pamje tabelë/rrjet dhe veprime në grup.
 */

import { documents } from '../api.js';
import { APP } from '../config.js';
import { icon } from '../icons.js';
import { state, refreshAll } from '../store.js';
import { navigate, updateParams, parseHash } from '../routing.js';
import { emptyState, skeletonRows, toastError, toastSuccess, confirmDialog, openDropdown } from '../ui.js';
import { esc, formatNumber, debounce } from '../utils.js';
import { openUploadModal, documentRow, documentCard, wireDocumentList } from '../documents-ui.js';

const STATUS_FILTERS = [
  { key: 'all', label: 'Të gjitha' },
  { key: 'valid', label: 'Në fuqi' },
  { key: 'expiring', label: 'Po skadojnë' },
  { key: 'expired', label: 'Të skaduara' },
  { key: 'no_expiry', label: 'Pa skadim' },
  { key: 'favorite', label: 'Të preferuarat' },
  { key: 'archived', label: 'Arkiva' }
];

const SORTS = [
  { key: 'created_desc', label: 'Më të rejat' },
  { key: 'created_asc', label: 'Më të vjetrat' },
  { key: 'title_asc', label: 'Titulli A–Z' },
  { key: 'title_desc', label: 'Titulli Z–A' },
  { key: 'expiry_asc', label: 'Skadimi më i afërt' },
  { key: 'expiry_desc', label: 'Skadimi më i largët' },
  { key: 'size_desc', label: 'Më të mëdhatë' },
  { key: 'size_asc', label: 'Më të voglat' }
];

const LAYOUT_KEY = 'dokument.layout';
const getLayout = () => {
  try {
    return localStorage.getItem(LAYOUT_KEY) === 'grid' ? 'grid' : 'table';
  } catch {
    return 'table';
  }
};
const setLayout = (value) => {
  try {
    localStorage.setItem(LAYOUT_KEY, value);
  } catch {
    /* pa localStorage */
  }
};

/** Mban dokumentet e zgjedhura mes rirenderimeve brenda së njëjtës pamje. */
let selection = new Set();

/** Kujton nëse fusha e kërkimit ishte në fokus, për t'u rikthyer pas rirenderimit. */
let searchHadFocus = false;

export default async function renderDocuments(view, params = {}) {
  const layout = params.layout || getLayout();
  const page = Math.max(1, Number(params.page) || 1);
  const status = params.status || 'all';
  const sort = params.sort || 'created_desc';
  const query = params.q || '';
  const categoryId = params.category || null;
  const folderId = params.folder || null;
  const tagId = params.tag || null;

  const activeCategory = state.categories.find((c) => c.id === categoryId);
  const activeFolder = state.folders.find((f) => f.id === folderId);
  const activeTag = state.tags.find((t) => t.id === tagId);
  const hasFilters = !!(query || categoryId || folderId || tagId || (status && status !== 'all'));

  /* ---------------------------------------------------------- Skeleti ---- */
  view.innerHTML = `
    <div class="max-w-7xl mx-auto">
      <div id="toolbar"></div>
      <div class="px-5 sm:px-6 pb-6">
        <div class="card overflow-hidden">${skeletonRows(6)}</div>
      </div>
    </div>`;

  renderToolbar();

  /* ----------------------------------------------------- Të dhënat ------- */
  let result;
  try {
    result = await documents.search({
      query,
      categoryId,
      folderId,
      tagId,
      status,
      sort,
      page,
      pageSize: APP.pageSize
    });
  } catch (error) {
    view.querySelector('.card').outerHTML = `<div class="card">${emptyState({
      icon: 'circle-alert',
      title: 'Lista nuk u ngarkua',
      description: error.message
    })}</div>`;
    return;
  }

  const { rows, total } = result;
  const totalPages = Math.max(1, Math.ceil(total / APP.pageSize));

  // Pastro zgjedhjet që nuk janë më në listë
  selection = new Set([...selection].filter((id) => rows.some((row) => row.id === id)));

  /* ------------------------------------------------------- Renderimi ---- */
  const body = rows.length
    ? layout === 'grid'
      ? `<div class="grid sm:grid-cols-2 xl:grid-cols-3 gap-4" id="doc-list">
           ${rows.map(documentCard).join('')}
         </div>`
      : `<div class="card overflow-hidden">
           <div class="overflow-x-auto">
             <table class="table" id="doc-list">
               <thead>
                 <tr>
                   <th class="w-10 pr-0">
                     <input type="checkbox" class="checkbox" id="select-all" aria-label="Zgjidh të gjitha">
                   </th>
                   <th>Dokumenti</th>
                   <th class="hidden md:table-cell">Kategoria</th>
                   <th class="hidden lg:table-cell">Etiketat</th>
                   <th>Skadimi</th>
                   <th class="hidden sm:table-cell">Ngarkuar</th>
                   <th class="w-10"></th>
                 </tr>
               </thead>
               <tbody>
                 ${rows.map((row) => documentRow(row, { selectable: true })).join('')}
               </tbody>
             </table>
           </div>
         </div>`
    : `<div class="card">${
        hasFilters
          ? emptyState({
              icon: 'search',
              title: 'Asnjë rezultat',
              description: 'Provoni të ndryshoni kërkimin ose filtrat.',
              action: '<button type="button" class="btn btn-secondary" data-clear-filters>Pastro filtrat</button>'
            })
          : emptyState({
              icon: 'file-plus',
              title: 'Asnjë dokument',
              description: 'Ngarkoni dokumentin e parë për të filluar organizimin.',
              action: '<button type="button" class="btn btn-primary" data-upload>Ngarko dokument</button>'
            })
      }</div>`;

  view.innerHTML = `
    <div class="max-w-7xl mx-auto">
      <div id="toolbar"></div>
      <div class="px-5 sm:px-6 pb-6 space-y-4">
        <div id="bulk-bar"></div>
        ${body}
        ${
          totalPages > 1
            ? `<nav class="flex items-center justify-between gap-3" aria-label="Faqezimi">
                 <p class="text-xs text-ink-subtle tabular">
                   Faqja ${formatNumber(page)} nga ${formatNumber(totalPages)} · ${formatNumber(total)} dokumente
                 </p>
                 <div class="flex items-center gap-1.5">
                   <button type="button" class="btn btn-secondary btn-sm" data-page="1"
                           ${page === 1 ? 'disabled' : ''} aria-label="Faqja e parë">
                     ${icon('chevrons-left')}
                   </button>
                   <button type="button" class="btn btn-secondary btn-sm" data-page="${page - 1}"
                           ${page === 1 ? 'disabled' : ''}>
                     ${icon('chevron-left')}<span class="hidden sm:inline">Para</span>
                   </button>
                   <button type="button" class="btn btn-secondary btn-sm" data-page="${page + 1}"
                           ${page >= totalPages ? 'disabled' : ''}>
                     <span class="hidden sm:inline">Pas</span>${icon('chevron-right')}
                   </button>
                   <button type="button" class="btn btn-secondary btn-sm" data-page="${totalPages}"
                           ${page >= totalPages ? 'disabled' : ''} aria-label="Faqja e fundit">
                     ${icon('chevrons-right')}
                   </button>
                 </div>
               </nav>`
            : rows.length
            ? `<p class="text-xs text-ink-subtle tabular">${formatNumber(total)} ${
                total === 1 ? 'dokument' : 'dokumente'
              }</p>`
            : ''
        }
      </div>
    </div>`;

  renderToolbar();
  renderBulkBar();

  const list = view.querySelector('#doc-list');
  if (list) wireDocumentList(list, rows, { onChange: reload });

  // Zgjedhjet
  view.querySelectorAll('[data-select]').forEach((box) => {
    box.checked = selection.has(box.dataset.select);
    box.addEventListener('change', () => {
      if (box.checked) selection.add(box.dataset.select);
      else selection.delete(box.dataset.select);
      syncSelectAll();
      renderBulkBar();
    });
  });

  const selectAll = view.querySelector('#select-all');
  if (selectAll) {
    syncSelectAll();
    selectAll.addEventListener('change', () => {
      rows.forEach((row) => (selectAll.checked ? selection.add(row.id) : selection.delete(row.id)));
      view.querySelectorAll('[data-select]').forEach((box) => (box.checked = selectAll.checked));
      renderBulkBar();
    });
  }

  // Faqezimi
  view.querySelectorAll('[data-page]').forEach((button) =>
    button.addEventListener('click', () => {
      selection.clear();
      updateParams({ page: button.dataset.page === '1' ? '' : button.dataset.page });
    })
  );

  view.querySelectorAll('[data-upload]').forEach((button) =>
    button.addEventListener('click', () => openUploadModal({ onDone: reload, defaults: { categoryId, folderId } }))
  );
  view.querySelectorAll('[data-clear-filters]').forEach((button) =>
    button.addEventListener('click', () => navigate('documents', {}))
  );

  /* ---------------------------------------------------------- Funksione -- */

  function syncSelectAll() {
    const box = view.querySelector('#select-all');
    if (!box) return;
    const selectedHere = rows.filter((row) => selection.has(row.id)).length;
    box.checked = selectedHere > 0 && selectedHere === rows.length;
    box.indeterminate = selectedHere > 0 && selectedHere < rows.length;
  }

  async function reload() {
    await refreshAll();
    const current = parseHash();
    await renderDocuments(view, current.params);
  }

  function renderBulkBar() {
    const bar = view.querySelector('#bulk-bar');
    if (!bar) return;
    if (!selection.size) {
      bar.innerHTML = '';
      return;
    }

    bar.innerHTML = `
      <div class="flex flex-wrap items-center gap-2 p-2.5 pl-4 rounded-lg border border-accent/25 bg-accent/5 animate-slide-up">
        <span class="text-sm font-medium text-ink">
          ${formatNumber(selection.size)} ${selection.size === 1 ? 'i zgjedhur' : 'të zgjedhur'}
        </span>
        <div class="flex-1"></div>
        <button type="button" class="btn btn-secondary btn-sm" data-bulk-move>
          ${icon('move')}<span>Zhvendos</span>
        </button>
        <button type="button" class="btn btn-danger-soft btn-sm" data-bulk-delete>
          ${icon('trash-2')}<span>Fshi</span>
        </button>
        <button type="button" class="btn btn-ghost btn-sm" data-bulk-clear>Anulo</button>
      </div>`;

    bar.querySelector('[data-bulk-clear]').addEventListener('click', () => {
      selection.clear();
      view.querySelectorAll('[data-select]').forEach((box) => (box.checked = false));
      syncSelectAll();
      renderBulkBar();
    });

    bar.querySelector('[data-bulk-move]').addEventListener('click', (event) => {
      openDropdown(
        event.currentTarget,
        [
          {
            label: 'Pa dosje',
            icon: 'undo-2',
            onClick: () => moveSelection(null)
          },
          ...(state.folders.length ? [{ separator: true }] : []),
          ...state.folders.map((folder) => ({
            label: `${'— '.repeat(folder.depth || 0)}${folder.name}`,
            icon: 'folder',
            onClick: () => moveSelection(folder.id)
          }))
        ],
        { width: 230 }
      );
    });

    bar.querySelector('[data-bulk-delete]').addEventListener('click', async () => {
      const count = selection.size;
      const ok = await confirmDialog({
        title: `Fshi ${count} ${count === 1 ? 'dokument' : 'dokumente'}?`,
        message: 'Skedarët do të fshihen përgjithmonë. Ky veprim nuk mund të kthehet.',
        confirmText: 'Fshi',
        danger: true
      });
      if (!ok) return;
      try {
        const ids = [...selection];
        selection.clear();
        const { deleted } = await documents.removeMany(ids);
        toastSuccess(`${formatNumber(deleted)} ${deleted === 1 ? 'dokument u fshi' : 'dokumente u fshinë'}.`);
        await reload();
      } catch (error) {
        toastError(error.message);
      }
    });
  }

  async function moveSelection(folderTarget) {
    try {
      const ids = [...selection];
      await documents.moveMany(ids, folderTarget);
      selection.clear();
      toastSuccess('Dokumentet u zhvendosën.');
      await reload();
    } catch (error) {
      toastError(error.message);
    }
  }

  function renderToolbar() {
    const toolbar = view.querySelector('#toolbar');
    if (!toolbar) return;

    toolbar.innerHTML = `
      <div class="px-5 sm:px-6 pt-5 pb-4 space-y-3">
        <!-- Rreshti 1: kërkimi dhe veprimet -->
        <div class="flex flex-wrap items-center gap-2">
          <div class="relative flex-1 min-w-[200px]">
            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle pointer-events-none text-sm">
              ${icon('search')}
            </span>
            <input type="search" class="input !pl-9" data-view-search value="${esc(query)}"
                   placeholder="Kërko sipas titullit, përshkrimit ose skedarit…" autocomplete="off">
          </div>

          <button type="button" class="btn btn-secondary" data-sort>
            ${icon('list')}
            <span class="hidden sm:inline">${esc(
              SORTS.find((item) => item.key === sort)?.label || 'Renditja'
            )}</span>
            ${icon('chevron-down')}
          </button>

          <div class="flex items-center p-0.5 rounded-lg border border-line-strong bg-surface">
            <button type="button" class="btn btn-ghost btn-icon btn-sm ${
              layout === 'table' ? '!bg-surface-inset !text-ink' : ''
            }" data-layout="table" aria-label="Pamje tabelë" title="Pamje tabelë">${icon('list')}</button>
            <button type="button" class="btn btn-ghost btn-icon btn-sm ${
              layout === 'grid' ? '!bg-surface-inset !text-ink' : ''
            }" data-layout="grid" aria-label="Pamje rrjet" title="Pamje rrjet">${icon('layout-grid')}</button>
          </div>

          <button type="button" class="btn btn-primary" data-upload>
            ${icon('plus')}<span class="hidden sm:inline">Ngarko</span>
          </button>
        </div>

        <!-- Rreshti 2: filtrat -->
        <div class="flex flex-wrap items-center gap-1.5">
          ${STATUS_FILTERS.map(
            (filter) => `
            <button type="button" class="chip" data-status="${filter.key}"
                    aria-pressed="${status === filter.key ? 'true' : 'false'}">
              ${esc(filter.label)}
            </button>`
          ).join('')}

          <span class="w-px h-5 bg-line mx-1"></span>

          <button type="button" class="chip" data-filter-category
                  aria-pressed="${activeCategory ? 'true' : 'false'}">
            ${activeCategory ? `<span class="dot dot-${esc(activeCategory.color)}"></span>` : icon('layout-grid')}
            ${esc(activeCategory ? activeCategory.name : 'Kategoria')}
          </button>

          <button type="button" class="chip" data-filter-folder
                  aria-pressed="${activeFolder ? 'true' : 'false'}">
            ${icon('folder')}${esc(activeFolder ? activeFolder.name : 'Dosja')}
          </button>

          <button type="button" class="chip" data-filter-tag
                  aria-pressed="${activeTag ? 'true' : 'false'}">
            ${activeTag ? `<span class="dot dot-${esc(activeTag.color)}"></span>` : icon('tag')}
            ${esc(activeTag ? activeTag.name : 'Etiketa')}
          </button>

          ${
            hasFilters
              ? `<button type="button" class="chip !border-transparent !bg-transparent text-ink-subtle hover:text-danger"
                         data-clear-filters>${icon('x')}Pastro</button>`
              : ''
          }
        </div>
      </div>`;

    // Kërkimi brenda pamjes
    const searchInput = toolbar.querySelector('[data-view-search]');
    const runSearch = debounce((value) => updateParams({ q: value, page: '' }), 320);
    searchInput.addEventListener('input', (event) => runSearch(event.target.value));
    searchInput.addEventListener('focus', () => (searchHadFocus = true));
    searchInput.addEventListener('blur', () => (searchHadFocus = false));
    searchInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        runSearch.cancel();
        updateParams({ q: event.target.value, page: '' });
      } else if (event.key === 'Escape') {
        searchHadFocus = false;
        event.target.blur();
        if (query) updateParams({ q: '', page: '' });
      }
    });

    // Rikthe fokusin kur rirenderimi shkaktohet nga shkrimi në fushë
    if (searchHadFocus) {
      searchInput.focus({ preventScroll: true });
      const end = searchInput.value.length;
      searchInput.setSelectionRange?.(end, end);
    }

    // Statusi
    toolbar.querySelectorAll('[data-status]').forEach((chip) =>
      chip.addEventListener('click', () => {
        selection.clear();
        updateParams({ status: chip.dataset.status === 'all' ? '' : chip.dataset.status, page: '' });
      })
    );

    // Renditja
    toolbar.querySelector('[data-sort]').addEventListener('click', (event) =>
      openDropdown(
        event.currentTarget,
        SORTS.map((item) => ({
          label: item.label,
          icon: item.key === sort ? 'check' : undefined,
          onClick: () => updateParams({ sort: item.key === 'created_desc' ? '' : item.key, page: '' })
        })),
        { width: 215 }
      )
    );

    // Pamja
    toolbar.querySelectorAll('[data-layout]').forEach((button) =>
      button.addEventListener('click', () => {
        if (button.dataset.layout === layout) return;
        setLayout(button.dataset.layout);
        updateParams({ layout: button.dataset.layout === 'table' ? '' : 'grid' });
      })
    );

    // Filtri i kategorisë
    toolbar.querySelector('[data-filter-category]').addEventListener('click', (event) =>
      openDropdown(
        event.currentTarget,
        [
          { label: 'Të gjitha kategoritë', icon: categoryId ? undefined : 'check', onClick: () => updateParams({ category: '', page: '' }) },
          ...(state.categories.length ? [{ separator: true }] : []),
          ...state.categories.map((category) => ({
            label: category.name,
            icon: category.id === categoryId ? 'check' : undefined,
            onClick: () => updateParams({ category: category.id, page: '' })
          }))
        ],
        { width: 235 }
      )
    );

    // Filtri i dosjes
    toolbar.querySelector('[data-filter-folder]').addEventListener('click', (event) =>
      openDropdown(
        event.currentTarget,
        [
          { label: 'Të gjitha dosjet', icon: folderId ? undefined : 'check', onClick: () => updateParams({ folder: '', page: '' }) },
          ...(state.folders.length ? [{ separator: true }] : []),
          ...state.folders.map((folder) => ({
            label: `${'— '.repeat(folder.depth || 0)}${folder.name}`,
            icon: folder.id === folderId ? 'check' : undefined,
            onClick: () => updateParams({ folder: folder.id, page: '' })
          }))
        ],
        { width: 235 }
      )
    );

    // Filtri i etiketës
    toolbar.querySelector('[data-filter-tag]').addEventListener('click', (event) =>
      openDropdown(
        event.currentTarget,
        [
          { label: 'Të gjitha etiketat', icon: tagId ? undefined : 'check', onClick: () => updateParams({ tag: '', page: '' }) },
          ...(state.tags.length ? [{ separator: true }] : []),
          ...state.tags.map((tag) => ({
            label: tag.name,
            icon: tag.id === tagId ? 'check' : undefined,
            onClick: () => updateParams({ tag: tag.id, page: '' })
          }))
        ],
        { width: 235 }
      )
    );

    toolbar.querySelectorAll('[data-clear-filters]').forEach((button) =>
      button.addEventListener('click', () => {
        selection.clear();
        navigate('documents', {});
      })
    );

    toolbar.querySelectorAll('[data-upload]').forEach((button) =>
      button.addEventListener('click', () =>
        openUploadModal({ onDone: reload, defaults: { categoryId, folderId } })
      )
    );
  }
}
