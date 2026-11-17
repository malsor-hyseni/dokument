/**
 * DOKUMENT — Komponentët e dokumenteve
 * -----------------------------------------------------------------------------
 * Modalet dhe veprimet e përbashkëta: ngarkimi, redaktimi, parashikimi,
 * shkarkimi dhe fshirja. Përdoren nga dashboard-i dhe faqja e dokumenteve.
 */

import { documents, tags as tagsApi } from './api.js';
import { APP, ACCEPT_ATTR } from './config.js';
import { icon } from './icons.js';
import { state, refreshAll, warningDays } from './store.js';
import { openModal, confirmDialog, toastSuccess, toastError, openDropdown } from './ui.js';
import {
  esc, formatBytes, formatDate, formatDateTime, toInputDate, fileIconName, fileTypeLabel,
  expiryStatus, isImage, isPdf, downloadBlob, relativeTime
} from './utils.js';

/* ========================================================= NDIHMËSA ====== */

/** Opsionet e kategorive për <select>. */
function categoryOptions(selectedId) {
  return [
    `<option value="">Pa kategori</option>`,
    ...state.categories.map(
      (category) =>
        `<option value="${esc(category.id)}"${category.id === selectedId ? ' selected' : ''}>${esc(
          category.name
        )}</option>`
    )
  ].join('');
}

/** Opsionet e dosjeve për <select>, me indentim sipas thellësisë. */
function folderOptions(selectedId) {
  return [
    `<option value="">Pa dosje</option>`,
    ...state.folders.map((folder) => {
      const indent = '  '.repeat(folder.depth || 0);
      const prefix = folder.depth ? `${indent}└ ` : '';
      return `<option value="${esc(folder.id)}"${folder.id === selectedId ? ' selected' : ''}>${prefix}${esc(
        folder.name
      )}</option>`;
    })
  ].join('');
}

/** Zgjedhësi i etiketave: chip-a për etiketat ekzistuese + fushë për të reja. */
function tagPickerHtml(selectedIds = []) {
  return `
    <div data-tag-picker>
      ${
        state.tags.length
          ? `<div class="flex flex-wrap gap-1.5 mb-2" data-tag-chips>
               ${state.tags
                 .map(
                   (tag) => `
                 <button type="button" class="chip" data-tag-id="${esc(tag.id)}"
                         aria-pressed="${selectedIds.includes(tag.id) ? 'true' : 'false'}">
                   <span class="dot dot-${esc(tag.color)}"></span>${esc(tag.name)}
                 </button>`
                 )
                 .join('')}
             </div>`
          : ''
      }
      <input type="text" class="input" data-new-tags placeholder="Etiketa të reja, ndara me presje">
      <span class="field-hint">P.sh. urgjent, skanuar, origjinal</span>
    </div>`;
}

/** Lexon etiketat e zgjedhura dhe krijon të rejat. */
async function resolveTags(panel) {
  const picker = panel.querySelector('[data-tag-picker]');
  if (!picker) return [];
  const selected = Array.from(picker.querySelectorAll('[data-tag-id][aria-pressed="true"]')).map(
    (chip) => chip.dataset.tagId
  );
  const fresh = (picker.querySelector('[data-new-tags]')?.value || '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);

  if (!fresh.length) return selected;
  const created = await tagsApi.ensureMany(fresh);
  return [...new Set([...selected, ...created.map((tag) => tag.id)])];
}

function wireTagChips(panel) {
  panel.querySelectorAll('[data-tag-id]').forEach((chip) =>
    chip.addEventListener('click', () => {
      chip.setAttribute('aria-pressed', chip.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
    })
  );
}

/** Fusha e formularit me etiketë. */
const field = (label, control, { hint = '', required = false, id = '' } = {}) => `
  <div>
    <label class="label${required ? ' label-req' : ''}"${id ? ` for="${id}"` : ''}>${esc(label)}</label>
    ${control}
    ${hint ? `<span class="field-hint">${esc(hint)}</span>` : ''}
  </div>`;

function setFormError(panel, message) {
  let box = panel.querySelector('[data-form-error]');
  if (!box) {
    box = document.createElement('div');
    box.setAttribute('data-form-error', '');
    box.className = 'flex items-start gap-2 p-2.5 rounded-lg border border-danger/25 bg-danger/5 text-danger text-sm mb-4';
    panel.querySelector('.modal-body')?.prepend(box);
  }
  box.innerHTML = `<span class="mt-0.5 flex-none">${icon('circle-alert')}</span><span>${esc(message)}</span>`;
  box.hidden = false;
  box.scrollIntoView({ block: 'nearest' });
}

function clearFormError(panel) {
  const box = panel.querySelector('[data-form-error]');
  if (box) box.hidden = true;
}

/* ====================================================== NGARKIMI ========= */

/**
 * Hap modalin e ngarkimit të një dokumenti të re.
 * @param {{onDone?:Function, defaults?:{categoryId?:string, folderId?:string}}} options
 */
export function openUploadModal({ onDone, defaults = {} } = {}) {
  let selectedFile = null;

  const { panel, close } = openModal({
    title: 'Ngarko dokument',
    description: 'Lejohen PDF, imazhe, Word, Excel, tekst dhe ZIP — deri në 50 MB.',
    size: 'lg',
    body: `
      <form id="upload-form" class="space-y-4" novalidate>
        <div>
          <div class="dropzone p-6 text-center" data-dropzone tabindex="0" role="button"
               aria-label="Zgjidh ose zvarrit skedarin">
            <div data-dz-empty>
              <span class="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-surface
                           border border-line text-ink-muted mb-3">${icon('cloud-upload', 'w-5 h-5')}</span>
              <p class="text-sm font-medium text-ink">Zvarrit skedarin këtu</p>
              <p class="mt-1 text-xs text-ink-muted">ose kliko për të zgjedhur</p>
            </div>
            <div data-dz-file class="hidden"></div>
          </div>
          <input type="file" class="hidden" data-file-input accept="${ACCEPT_ATTR}">
        </div>

        ${field(
          'Titulli',
          `<input type="text" class="input" name="title" maxlength="160" required
                  placeholder="P.sh. Pasaportë e Republikës së Kosovës">`,
          { required: true, id: 'title' }
        )}

        ${field(
          'Përshkrimi',
          `<textarea class="textarea" name="description" maxlength="2000" rows="2"
                     placeholder="Shënime për dokumentin (opsionale)"></textarea>`
        )}

        <div class="grid sm:grid-cols-2 gap-4">
          ${field('Kategoria', `<select class="select" name="category_id">${categoryOptions(defaults.categoryId)}</select>`)}
          ${field('Dosja', `<select class="select" name="folder_id">${folderOptions(defaults.folderId)}</select>`)}
        </div>

        <div class="grid sm:grid-cols-2 gap-4">
          ${field('Data e lëshimit', `<input type="date" class="input" name="issue_date">`)}
          ${field('Data e skadimit', `<input type="date" class="input" name="expiry_date">`, {
            hint: 'Lëreni bosh nëse dokumenti nuk skadon.'
          })}
        </div>

        ${field('Etiketat', tagPickerHtml([]))}

        <div data-progress hidden>
          <div class="flex items-center justify-between mb-1.5">
            <span class="text-xs text-ink-muted" data-progress-label>Duke ngarkuar…</span>
            <span class="text-xs text-ink-muted tabular" data-progress-value>0%</span>
          </div>
          <div class="progress"><div class="progress-bar" style="width:0%"></div></div>
        </div>
      </form>`,
    footer: `
      <button type="button" class="btn btn-secondary" data-modal-close>Anulo</button>
      <button type="submit" form="upload-form" class="btn btn-primary" data-submit>Ngarko dokumentin</button>`
  });

  const form = panel.querySelector('#upload-form');
  const dropzone = panel.querySelector('[data-dropzone]');
  const fileInput = panel.querySelector('[data-file-input]');
  const emptyBox = panel.querySelector('[data-dz-empty]');
  const fileBox = panel.querySelector('[data-dz-file]');
  const progress = panel.querySelector('[data-progress]');
  const submit = panel.querySelector('[data-submit]');

  wireTagChips(panel);

  function showFile(file) {
    selectedFile = file;
    emptyBox.classList.add('hidden');
    fileBox.classList.remove('hidden');
    fileBox.innerHTML = `
      <div class="flex items-center gap-3 text-left">
        <span class="file-icon file-icon-lg">${icon(fileIconName(file.type, file.name))}</span>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium text-ink truncate">${esc(file.name)}</p>
          <p class="text-xs text-ink-muted tabular">${esc(formatBytes(file.size))} · ${esc(
            fileTypeLabel(file.type, file.name)
          )}</p>
        </div>
        <button type="button" class="btn btn-ghost btn-icon btn-sm" data-clear-file aria-label="Largo skedarin">
          ${icon('x')}
        </button>
      </div>`;
    fileBox.querySelector('[data-clear-file]').addEventListener('click', (event) => {
      event.stopPropagation();
      selectedFile = null;
      fileInput.value = '';
      fileBox.classList.add('hidden');
      emptyBox.classList.remove('hidden');
    });

    // Plotëso titullin nga emri i skedarit, nëse është bosh
    if (!form.title.value.trim()) {
      form.title.value = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim().slice(0, 160);
    }
    clearFormError(panel);
  }

  function pick(file) {
    if (!file) return;
    if (file.size > APP.maxFileSize) {
      setFormError(panel, `Skedari është ${formatBytes(file.size)} — kufiri është 50 MB.`);
      return;
    }
    if (file.size === 0) {
      setFormError(panel, 'Skedari është bosh.');
      return;
    }
    showFile(file);
  }

  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      fileInput.click();
    }
  });
  fileInput.addEventListener('change', () => pick(fileInput.files?.[0]));

  ['dragenter', 'dragover'].forEach((type) =>
    dropzone.addEventListener(type, (event) => {
      event.preventDefault();
      dropzone.classList.add('is-over');
    })
  );
  ['dragleave', 'drop'].forEach((type) =>
    dropzone.addEventListener(type, (event) => {
      event.preventDefault();
      dropzone.classList.remove('is-over');
    })
  );
  dropzone.addEventListener('drop', (event) => pick(event.dataTransfer?.files?.[0]));

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFormError(panel);

    if (!selectedFile) {
      setFormError(panel, 'Zgjedhni një skedar për ngarkim.');
      return;
    }
    const title = form.title.value.trim();
    if (!title) {
      setFormError(panel, 'Shkruani titullin e dokumentit.');
      form.title.focus();
      return;
    }
    const issue = form.issue_date.value || null;
    const expiry = form.expiry_date.value || null;
    if (issue && expiry && expiry < issue) {
      setFormError(panel, 'Data e skadimit nuk mund të jetë para datës së lëshimit.');
      return;
    }

    submit.disabled = true;
    submit.innerHTML = `${icon('loader-circle', 'w-3.5 h-3.5 animate-spin')}<span>Duke ngarkuar…</span>`;
    progress.hidden = false;

    const bar = progress.querySelector('.progress-bar');
    const value = progress.querySelector('[data-progress-value]');
    const label = progress.querySelector('[data-progress-label]');
    const setProgress = (percent, text) => {
      bar.style.width = `${percent}%`;
      value.textContent = `${Math.round(percent)}%`;
      if (text) label.textContent = text;
    };

    try {
      const tagIds = await resolveTags(panel);
      setProgress(20, 'Duke ngarkuar skedarin…');

      await documents.create({
        file: selectedFile,
        title,
        description: form.description.value,
        categoryId: form.category_id.value || null,
        folderId: form.folder_id.value || null,
        issueDate: issue,
        expiryDate: expiry,
        tagIds,
        onProgress: ({ phase, percent }) =>
          setProgress(
            percent,
            phase === 'save' ? 'Duke ruajtur të dhënat…' : phase === 'done' ? 'Përfundoi' : undefined
          )
      });

      setProgress(100, 'Përfundoi');
      toastSuccess('Dokumenti u ngarkua.');
      close();
      await onDone?.();
    } catch (error) {
      setFormError(panel, error.message || 'Ngarkimi dështoi.');
      progress.hidden = true;
      submit.disabled = false;
      submit.textContent = 'Ngarko dokumentin';
    }
  });

  return { close, panel };
}

/* ====================================================== REDAKTIMI ======== */

/**
 * Hap modalin e redaktimit të një dokumenti.
 * @param {string|object} docOrId
 */
export async function openEditModal(docOrId, { onDone } = {}) {
  let doc = docOrId;
  if (typeof docOrId === 'string') {
    try {
      doc = await documents.get(docOrId);
    } catch (error) {
      toastError(error.message);
      return;
    }
  }

  const currentTagIds = (doc.document_tags || []).map((link) => link.tag?.id).filter(Boolean);
  let replacement = null;

  const { panel, close } = openModal({
    title: 'Redakto dokumentin',
    description: doc.file_name,
    size: 'lg',
    body: `
      <form id="edit-form" class="space-y-4" novalidate>
        ${field(
          'Titulli',
          `<input type="text" class="input" name="title" maxlength="160" required value="${esc(doc.title)}">`,
          { required: true }
        )}

        ${field(
          'Përshkrimi',
          `<textarea class="textarea" name="description" maxlength="2000" rows="2">${esc(
            doc.description || ''
          )}</textarea>`
        )}

        <div class="grid sm:grid-cols-2 gap-4">
          ${field('Kategoria', `<select class="select" name="category_id">${categoryOptions(doc.category_id)}</select>`)}
          ${field('Dosja', `<select class="select" name="folder_id">${folderOptions(doc.folder_id)}</select>`)}
        </div>

        <div class="grid sm:grid-cols-2 gap-4">
          ${field('Data e lëshimit', `<input type="date" class="input" name="issue_date" value="${esc(
            toInputDate(doc.issue_date)
          )}">`)}
          ${field('Data e skadimit', `<input type="date" class="input" name="expiry_date" value="${esc(
            toInputDate(doc.expiry_date)
          )}">`)}
        </div>

        ${field('Etiketat', tagPickerHtml(currentTagIds))}

        <div class="panel p-3.5">
          <div class="flex items-center gap-3">
            <span class="file-icon">${icon(fileIconName(doc.mime_type, doc.file_name))}</span>
            <div class="min-w-0 flex-1">
              <p class="text-xs font-medium text-ink truncate" data-file-label>${esc(doc.file_name)}</p>
              <p class="text-2xs text-ink-subtle tabular" data-file-meta>${esc(formatBytes(doc.file_size))}</p>
            </div>
            <button type="button" class="btn btn-secondary btn-sm" data-replace>Zëvendëso</button>
          </div>
          <input type="file" class="hidden" data-replace-input accept="${ACCEPT_ATTR}">
        </div>
      </form>`,
    footer: `
      <button type="button" class="btn btn-secondary" data-modal-close>Anulo</button>
      <button type="submit" form="edit-form" class="btn btn-primary" data-submit>Ruaj ndryshimet</button>`
  });

  const form = panel.querySelector('#edit-form');
  const submit = panel.querySelector('[data-submit]');
  const replaceInput = panel.querySelector('[data-replace-input]');
  wireTagChips(panel);

  panel.querySelector('[data-replace]').addEventListener('click', () => replaceInput.click());
  replaceInput.addEventListener('change', () => {
    const file = replaceInput.files?.[0];
    if (!file) return;
    if (file.size > APP.maxFileSize) {
      setFormError(panel, `Skedari është ${formatBytes(file.size)} — kufiri është 50 MB.`);
      replaceInput.value = '';
      return;
    }
    replacement = file;
    panel.querySelector('[data-file-label]').textContent = file.name;
    panel.querySelector('[data-file-meta]').textContent = `${formatBytes(file.size)} · do të zëvendësohet`;
    clearFormError(panel);
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFormError(panel);

    const title = form.title.value.trim();
    if (!title) {
      setFormError(panel, 'Titulli nuk mund të jetë bosh.');
      return;
    }
    const issue = form.issue_date.value || null;
    const expiry = form.expiry_date.value || null;
    if (issue && expiry && expiry < issue) {
      setFormError(panel, 'Data e skadimit nuk mund të jetë para datës së lëshimit.');
      return;
    }

    submit.disabled = true;
    submit.innerHTML = `${icon('loader-circle', 'w-3.5 h-3.5 animate-spin')}<span>Duke ruajtur…</span>`;

    try {
      if (replacement) await documents.replaceFile(doc.id, replacement);

      await documents.update(doc.id, {
        title,
        description: form.description.value,
        category_id: form.category_id.value || null,
        folder_id: form.folder_id.value || null,
        issue_date: issue,
        expiry_date: expiry
      });

      const tagIds = await resolveTags(panel);
      await documents.setTags(doc.id, tagIds);

      toastSuccess('Ndryshimet u ruajtën.');
      close();
      await onDone?.();
    } catch (error) {
      setFormError(panel, error.message || 'Ruajtja dështoi.');
      submit.disabled = false;
      submit.textContent = 'Ruaj ndryshimet';
    }
  });

  return { close, panel };
}

/* ====================================================== PARASHIKIMI ====== */

/** Hap modalin me detajet dhe parashikimin e dokumentit. */
export async function openPreviewModal(docOrId, { onChange } = {}) {
  let doc;
  try {
    doc = typeof docOrId === 'string' ? await documents.get(docOrId) : await documents.get(docOrId.id);
  } catch (error) {
    toastError(error.message);
    return;
  }

  const status = expiryStatus(doc.expiry_date, warningDays());
  const docTags = (doc.document_tags || []).map((link) => link.tag).filter(Boolean);

  const detail = (label, value) => `
    <div class="flex items-start justify-between gap-4 py-2.5 border-b border-line last:border-0">
      <span class="text-xs text-ink-subtle flex-none">${esc(label)}</span>
      <span class="text-xs text-ink text-right min-w-0">${value}</span>
    </div>`;

  const { panel, close } = openModal({
    title: doc.title,
    description: `${fileTypeLabel(doc.mime_type, doc.file_name)} · ${formatBytes(doc.file_size)}`,
    size: 'xl',
    body: `
      <div class="grid lg:grid-cols-[1fr_280px] gap-5">
        <div class="min-w-0">
          <div class="rounded-lg border border-line bg-surface-inset/50 overflow-hidden
                      flex items-center justify-center" style="min-height:300px" data-preview>
            <div class="flex flex-col items-center gap-3 py-12 text-ink-subtle">
              ${icon('loader-circle', 'w-5 h-5 animate-spin')}
              <span class="text-xs">Duke hapur parashikimin…</span>
            </div>
          </div>
        </div>

        <div class="min-w-0">
          <div class="flex flex-wrap gap-2 mb-4">
            <button type="button" class="btn btn-primary btn-sm flex-1" data-download>
              ${icon('download')}<span>Shkarko</span>
            </button>
            <button type="button" class="btn btn-secondary btn-sm" data-edit aria-label="Redakto">
              ${icon('pencil')}
            </button>
            <button type="button" class="btn btn-secondary btn-sm" data-favorite
                    aria-label="Shëno si të preferuar">
              ${icon('star')}
            </button>
            <button type="button" class="btn btn-secondary btn-sm" data-more aria-label="Më shumë">
              ${icon('ellipsis')}
            </button>
          </div>

          ${
            doc.description
              ? `<p class="text-sm text-ink-muted leading-6 mb-4 whitespace-pre-line">${esc(doc.description)}</p>`
              : ''
          }

          <div class="panel px-3.5 py-1">
            ${detail('Kategoria', doc.categories
              ? `<span class="inline-flex items-center gap-1.5"><span class="dot dot-${esc(
                  doc.categories.color
                )}"></span>${esc(doc.categories.name)}</span>`
              : '<span class="text-ink-subtle">—</span>')}
            ${detail('Dosja', doc.folders ? esc(doc.folders.name) : '<span class="text-ink-subtle">—</span>')}
            ${detail('Statusi', `<span class="badge ${status.tone}">${esc(status.label)}</span>`)}
            ${detail('Data e lëshimit', esc(formatDate(doc.issue_date)))}
            ${detail('Data e skadimit', esc(formatDate(doc.expiry_date)))}
            ${detail('Skedari', `<span class="break-all">${esc(doc.file_name)}</span>`)}
            ${detail('Madhësia', esc(formatBytes(doc.file_size)))}
            ${detail('Ngarkuar', esc(formatDateTime(doc.created_at)))}
            ${
              doc.updated_at && doc.updated_at !== doc.created_at
                ? detail('Përditësuar', esc(relativeTime(doc.updated_at)))
                : ''
            }
          </div>

          ${
            docTags.length
              ? `<div class="mt-4">
                   <p class="text-2xs uppercase tracking-wider text-ink-subtle mb-2">Etiketat</p>
                   <div class="flex flex-wrap gap-1.5">
                     ${docTags
                       .map(
                         (tag) =>
                           `<span class="badge"><span class="dot dot-${esc(tag.color)}"></span>${esc(
                             tag.name
                           )}</span>`
                       )
                       .join('')}
                   </div>
                 </div>`
              : ''
          }
        </div>
      </div>`
  });

  /* ---- Parashikimi ---- */
  const previewBox = panel.querySelector('[data-preview]');
  let objectUrl = null;

  (async () => {
    try {
      if (isImage(doc.mime_type)) {
        const url = await documents.signedUrl(doc.storage_path);
        previewBox.innerHTML = `<img src="${esc(url)}" alt="${esc(doc.title)}"
             class="max-w-full max-h-[60vh] object-contain">`;
      } else if (isPdf(doc.mime_type)) {
        const blob = await documents.download(doc.storage_path);
        objectUrl = URL.createObjectURL(blob);
        previewBox.innerHTML = `<iframe src="${objectUrl}#view=FitH" title="${esc(doc.title)}"
             class="w-full" style="height:min(70vh,640px);border:0"></iframe>`;
      } else if (String(doc.mime_type).startsWith('text/')) {
        const blob = await documents.download(doc.storage_path);
        const text = (await blob.text()).slice(0, 20000);
        previewBox.innerHTML = `<pre class="w-full h-full max-h-[60vh] overflow-auto p-4 text-xs
             font-mono text-ink whitespace-pre-wrap break-words">${esc(text)}</pre>`;
      } else {
        previewBox.innerHTML = `
          <div class="flex flex-col items-center gap-3 py-14 px-6 text-center">
            <span class="file-icon file-icon-lg">${icon(fileIconName(doc.mime_type, doc.file_name))}</span>
            <p class="text-sm font-medium text-ink">Parashikimi nuk mbështetet</p>
            <p class="text-xs text-ink-muted max-w-xs leading-6">
              Skedarët ${esc(fileTypeLabel(doc.mime_type, doc.file_name))} hapen në aplikacionin e kompjuterit.
              Shkarkoni për ta shikuar.
            </p>
          </div>`;
      }
    } catch (error) {
      previewBox.innerHTML = `
        <div class="flex flex-col items-center gap-2 py-14 px-6 text-center">
          <span class="text-danger">${icon('circle-alert', 'w-5 h-5')}</span>
          <p class="text-sm text-ink">Parashikimi nuk u hap</p>
          <p class="text-xs text-ink-muted">${esc(error.message)}</p>
        </div>`;
    }
  })();

  panel.closest('.modal-backdrop')?.addEventListener('transitionend', () => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  });

  /* ---- Veprimet ---- */
  const favButton = panel.querySelector('[data-favorite]');
  const paintFav = () => {
    favButton.innerHTML = icon('star');
    favButton.classList.toggle('!text-warning', !!doc.is_favorite);
    favButton.title = doc.is_favorite ? 'Largo nga të preferuarat' : 'Shëno si të preferuar';
  };
  paintFav();

  panel.querySelector('[data-download]').addEventListener('click', (event) =>
    downloadDocument(doc, event.currentTarget)
  );

  panel.querySelector('[data-edit]').addEventListener('click', () => {
    close();
    openEditModal(doc.id, { onDone: onChange });
  });

  favButton.addEventListener('click', async () => {
    try {
      await documents.toggleFavorite(doc.id, !doc.is_favorite);
      doc.is_favorite = !doc.is_favorite;
      paintFav();
      toastSuccess(doc.is_favorite ? 'Shtuar te të preferuarat.' : 'Larguar nga të preferuarat.');
      await onChange?.();
    } catch (error) {
      toastError(error.message);
    }
  });

  panel.querySelector('[data-more]').addEventListener('click', (event) => {
    openDropdown(event.currentTarget, [
      {
        label: doc.is_archived ? 'Kthe nga arkiva' : 'Arkivo',
        icon: doc.is_archived ? 'archive-restore' : 'archive',
        onClick: async () => {
          try {
            await documents.setArchived(doc.id, !doc.is_archived);
            doc.is_archived = !doc.is_archived;
            toastSuccess(doc.is_archived ? 'Dokumenti u arkivua.' : 'Dokumenti u kthye nga arkiva.');
            close();
            await onChange?.();
          } catch (error) {
            toastError(error.message);
          }
        }
      },
      {
        label: 'Hap në skedë të re',
        icon: 'external-link',
        onClick: async () => {
          try {
            const url = await documents.signedUrl(doc.storage_path);
            window.open(url, '_blank', 'noopener');
          } catch (error) {
            toastError(error.message);
          }
        }
      },
      { separator: true },
      {
        label: 'Fshi dokumentin',
        icon: 'trash-2',
        danger: true,
        onClick: async () => {
          const deleted = await confirmDeleteDocument(doc);
          if (deleted) {
            close();
            await onChange?.();
          }
        }
      }
    ]);
  });

  return { close, panel };
}

/* ======================================================== VEPRIMET ======= */

/** Shkarkon dokumentin duke e marrë nga Storage-i privat. */
export async function downloadDocument(doc, button) {
  const restore = button
    ? (() => {
        const original = button.innerHTML;
        button.disabled = true;
        button.innerHTML = `${icon('loader-circle', 'w-3.5 h-3.5 animate-spin')}<span>Duke shkarkuar…</span>`;
        return () => {
          button.disabled = false;
          button.innerHTML = original;
        };
      })()
    : () => {};

  try {
    const blob = await documents.download(doc.storage_path);
    downloadBlob(blob, doc.file_name);
    documents.logDownload(doc.id, doc.title);
    toastSuccess('Shkarkimi filloi.');
  } catch (error) {
    toastError(error.message || 'Shkarkimi dështoi.');
  } finally {
    restore();
  }
}

/** Konfirmon dhe fshin një dokument. Kthen true nëse u fshi. */
export async function confirmDeleteDocument(doc) {
  const ok = await confirmDialog({
    title: 'Fshi dokumentin?',
    message: `"${doc.title}" dhe skedari i tij do të fshihen përgjithmonë. Ky veprim nuk mund të kthehet.`,
    confirmText: 'Fshi',
    danger: true
  });
  if (!ok) return false;

  try {
    await documents.remove(doc.id);
    toastSuccess('Dokumenti u fshi.');
    await refreshAll();
    return true;
  } catch (error) {
    toastError(error.message || 'Fshirja dështoi.');
    return false;
  }
}

/** Menyja e veprimeve për një dokument. */
export function openDocumentMenu(anchor, doc, { onChange } = {}) {
  openDropdown(anchor, [
    {
      label: 'Hap',
      icon: 'eye',
      onClick: () => openPreviewModal(doc.id, { onChange })
    },
    { label: 'Shkarko', icon: 'download', onClick: () => downloadDocument(doc) },
    { label: 'Redakto', icon: 'pencil', onClick: () => openEditModal(doc.id, { onDone: onChange }) },
    {
      label: doc.is_favorite ? 'Largo nga të preferuarat' : 'Shëno si të preferuar',
      icon: 'star',
      onClick: async () => {
        try {
          await documents.toggleFavorite(doc.id, !doc.is_favorite);
          toastSuccess(!doc.is_favorite ? 'Shtuar te të preferuarat.' : 'Larguar nga të preferuarat.');
          await onChange?.();
        } catch (error) {
          toastError(error.message);
        }
      }
    },
    {
      label: doc.is_archived ? 'Kthe nga arkiva' : 'Arkivo',
      icon: doc.is_archived ? 'archive-restore' : 'archive',
      onClick: async () => {
        try {
          await documents.setArchived(doc.id, !doc.is_archived);
          toastSuccess(!doc.is_archived ? 'Dokumenti u arkivua.' : 'Dokumenti u kthye nga arkiva.');
          await onChange?.();
        } catch (error) {
          toastError(error.message);
        }
      }
    },
    { separator: true },
    {
      label: 'Fshi',
      icon: 'trash-2',
      danger: true,
      onClick: async () => {
        if (await confirmDeleteDocument(doc)) await onChange?.();
      }
    }
  ]);
}

/* ==================================================== PËRBËRËS LISTE ===== */

/** Një rresht dokumenti për tabelë. */
export function documentRow(doc, { selectable = false } = {}) {
  const status = expiryStatus(doc.expiry_date, warningDays());
  const docTags = Array.isArray(doc.tags) ? doc.tags : [];

  return `
    <tr data-doc="${esc(doc.id)}" class="cursor-pointer">
      ${
        selectable
          ? `<td class="w-10 pr-0" data-no-open>
               <input type="checkbox" class="checkbox" data-select="${esc(doc.id)}"
                      aria-label="Zgjidh dokumentin">
             </td>`
          : ''
      }
      <td>
        <div class="flex items-center gap-3 min-w-0">
          <span class="file-icon">${icon(fileIconName(doc.mime_type, doc.file_name))}</span>
          <div class="min-w-0">
            <div class="flex items-center gap-1.5">
              <p class="font-medium text-ink truncate">${esc(doc.title)}</p>
              ${doc.is_favorite ? `<span class="text-warning flex-none text-xs">${icon('star')}</span>` : ''}
              ${doc.is_archived ? `<span class="badge">Arkivë</span>` : ''}
            </div>
            <p class="text-xs text-ink-subtle truncate">
              ${esc(doc.file_name)} · <span class="tabular">${esc(formatBytes(doc.file_size))}</span>
            </p>
          </div>
        </div>
      </td>
      <td class="hidden md:table-cell">
        ${
          doc.category_name
            ? `<span class="inline-flex items-center gap-2 text-ink-muted whitespace-nowrap">
                 <span class="dot dot-${esc(doc.category_color || 'slate')}"></span>${esc(doc.category_name)}
               </span>`
            : '<span class="text-ink-subtle">—</span>'
        }
      </td>
      <td class="hidden lg:table-cell">
        ${
          docTags.length
            ? `<div class="flex flex-wrap gap-1 max-w-[180px]">
                 ${docTags
                   .slice(0, 2)
                   .map(
                     (tag) =>
                       `<span class="badge"><span class="dot dot-${esc(tag.color)}"></span>${esc(tag.name)}</span>`
                   )
                   .join('')}
                 ${docTags.length > 2 ? `<span class="badge">+${docTags.length - 2}</span>` : ''}
               </div>`
            : '<span class="text-ink-subtle">—</span>'
        }
      </td>
      <td class="whitespace-nowrap">
        ${
          doc.expiry_date
            ? `<div class="flex flex-col gap-1">
                 <span class="badge ${status.tone} w-fit">${esc(status.label)}</span>
                 <span class="text-2xs text-ink-subtle tabular">${esc(formatDate(doc.expiry_date))}</span>
               </div>`
            : '<span class="badge">Pa skadim</span>'
        }
      </td>
      <td class="hidden sm:table-cell text-ink-subtle text-xs whitespace-nowrap">
        ${esc(formatDate(doc.created_at))}
      </td>
      <td class="w-10 text-right" data-no-open>
        <button type="button" class="btn btn-ghost btn-icon btn-sm" data-menu="${esc(doc.id)}"
                aria-label="Veprimet">${icon('ellipsis-vertical')}</button>
      </td>
    </tr>`;
}

/** Një kartë dokumenti për pamjen me rrjet. */
export function documentCard(doc) {
  const status = expiryStatus(doc.expiry_date, warningDays());
  const docTags = Array.isArray(doc.tags) ? doc.tags : [];

  return `
    <article class="doc-card" data-doc="${esc(doc.id)}">
      <div class="flex items-start gap-3">
        <span class="file-icon file-icon-lg">${icon(fileIconName(doc.mime_type, doc.file_name))}</span>
        <div class="min-w-0 flex-1">
          <div class="flex items-start gap-1.5">
            <h3 class="text-sm font-medium text-ink truncate-2 leading-5 flex-1">${esc(doc.title)}</h3>
            ${doc.is_favorite ? `<span class="text-warning flex-none text-xs mt-0.5">${icon('star')}</span>` : ''}
          </div>
          <p class="mt-1 text-xs text-ink-subtle truncate">${esc(doc.file_name)}</p>
        </div>
        <button type="button" class="btn btn-ghost btn-icon btn-sm -mt-1 -mr-1 flex-none"
                data-menu="${esc(doc.id)}" data-no-open aria-label="Veprimet">
          ${icon('ellipsis-vertical')}
        </button>
      </div>

      <div class="flex items-center justify-between gap-2 mt-auto">
        ${
          doc.category_name
            ? `<span class="inline-flex items-center gap-1.5 text-xs text-ink-muted min-w-0">
                 <span class="dot dot-${esc(doc.category_color || 'slate')}"></span>
                 <span class="truncate">${esc(doc.category_name)}</span>
               </span>`
            : '<span class="text-xs text-ink-subtle">Pa kategori</span>'
        }
        <span class="text-2xs text-ink-subtle tabular flex-none">${esc(formatBytes(doc.file_size))}</span>
      </div>

      <div class="flex items-center justify-between gap-2 pt-3 border-t border-line">
        ${
          doc.expiry_date
            ? `<span class="badge ${status.tone}">${esc(status.label)}</span>`
            : '<span class="badge">Pa skadim</span>'
        }
        ${
          docTags.length
            ? `<span class="text-2xs text-ink-subtle">${docTags.length} etiketa</span>`
            : `<span class="text-2xs text-ink-subtle">${esc(formatDate(doc.created_at))}</span>`
        }
      </div>
    </article>`;
}

/**
 * Lidh klikimet e listës së dokumenteve (hapje + meny).
 * @param {HTMLElement} scope
 * @param {Array} rows
 */
export function wireDocumentList(scope, rows, { onChange } = {}) {
  const byId = new Map(rows.map((row) => [row.id, row]));

  scope.querySelectorAll('[data-doc]').forEach((node) => {
    node.addEventListener('click', (event) => {
      if (event.target.closest('[data-no-open]')) return;
      const doc = byId.get(node.dataset.doc);
      if (doc) openPreviewModal(doc.id, { onChange });
    });
  });

  scope.querySelectorAll('[data-menu]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const doc = byId.get(button.dataset.menu);
      if (doc) openDocumentMenu(button, doc, { onChange });
    });
  });
}

