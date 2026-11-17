/**
 * DOKUMENT — Cilësimet
 * -----------------------------------------------------------------------------
 * Profili, preferencat, siguria dhe të dhënat e llogarisë.
 */

import { auth, profiles, account } from '../api.js';
import { APP } from '../config.js';
import { icon } from '../icons.js';
import { state, refreshAll, setProfile } from '../store.js';
import { updateParams } from '../routing.js';
import {
  applyTheme, confirmDialog, toastError, toastSuccess, toastInfo, setButtonLoading
} from '../ui.js';
import {
  esc, formatBytes, formatNumber, formatDateTime, initials, isEmail,
  passwordStrength, STRENGTH_LABELS, downloadBlob
} from '../utils.js';

const TABS = [
  { key: 'profile', label: 'Profili', icon: 'user' },
  { key: 'preferences', label: 'Preferencat', icon: 'settings' },
  { key: 'security', label: 'Siguria', icon: 'shield' },
  { key: 'data', label: 'Të dhënat', icon: 'database' }
];

const section = (title, description, body, footer = '') => `
  <section class="card">
    <div class="px-5 pt-5 pb-4">
      <h3 class="text-sm font-semibold text-ink">${esc(title)}</h3>
      ${description ? `<p class="mt-1 text-xs text-ink-muted leading-6">${esc(description)}</p>` : ''}
    </div>
    <div class="px-5 pb-5">${body}</div>
    ${footer ? `<div class="px-5 py-3.5 border-t border-line bg-surface-inset/40 flex justify-end gap-2">${footer}</div>` : ''}
  </section>`;

/* ============================================================= PROFILI ==== */

function profileTab() {
  const profile = state.profile || {};
  const name = profile.full_name || '';
  const email = profile.email || state.user?.email || '';

  return `
    ${section(
      'Fotografia',
      'PNG, JPG ose WebP deri në 2 MB.',
      `<div class="flex items-center gap-4">
         ${
           profile.avatar_url
             ? `<img src="${esc(profile.avatar_url)}" alt="" id="avatar-preview"
                     class="w-16 h-16 rounded-full object-cover border border-line flex-none">`
             : `<span id="avatar-preview" class="w-16 h-16 rounded-full bg-accent/10 text-accent flex items-center
                       justify-center text-lg font-semibold flex-none">${esc(initials(name, email))}</span>`
         }
         <div class="flex flex-wrap gap-2">
           <button type="button" class="btn btn-secondary btn-sm" data-avatar-pick>
             ${icon('camera')}<span>Zgjidh foto</span>
           </button>
           ${
             profile.avatar_url
               ? `<button type="button" class="btn btn-ghost btn-sm text-danger" data-avatar-remove>Largo</button>`
               : ''
           }
           <input type="file" class="hidden" data-avatar-input accept="image/png,image/jpeg,image/webp,image/gif">
         </div>
       </div>`
    )}

    ${section(
      'Të dhënat personale',
      '',
      `<form id="profile-form" class="space-y-4" novalidate>
         <div class="grid sm:grid-cols-2 gap-4">
           <div>
             <label class="label" for="full_name">Emri i plotë</label>
             <input type="text" class="input" id="full_name" name="full_name" maxlength="120"
                    value="${esc(name)}" placeholder="Emri dhe mbiemri">
           </div>
           <div>
             <label class="label" for="phone">Telefoni</label>
             <input type="tel" class="input" id="phone" name="phone" maxlength="40"
                    value="${esc(profile.phone || '')}" placeholder="+383 4X XXX XXX">
           </div>
         </div>
         <div>
           <label class="label" for="email-display">Email</label>
           <div class="flex flex-wrap gap-2">
             <input type="email" class="input flex-1 min-w-[200px]" id="email-display" value="${esc(email)}" disabled>
             <button type="button" class="btn btn-secondary" data-change-email>Ndrysho</button>
           </div>
           <span class="field-hint">Ndryshimi kërkon konfirmim në email-in e re.</span>
         </div>
       </form>`,
      `<button type="submit" form="profile-form" class="btn btn-primary" data-save-profile>Ruaj ndryshimet</button>`
    )}

    ${section(
      'Llogaria',
      '',
      `<dl class="divide-y divide-line text-sm">
         <div class="flex items-center justify-between gap-4 py-2.5">
           <dt class="text-ink-muted">Krijuar</dt>
           <dd class="text-ink tabular">${esc(formatDateTime(profile.created_at || state.user?.created_at))}</dd>
         </div>
         <div class="flex items-center justify-between gap-4 py-2.5">
           <dt class="text-ink-muted">Kyçja e fundit</dt>
           <dd class="text-ink tabular">${esc(formatDateTime(state.user?.last_sign_in_at))}</dd>
         </div>
         <div class="flex items-center justify-between gap-4 py-2.5">
           <dt class="text-ink-muted">Identifikuesi</dt>
           <dd class="text-ink font-mono text-2xs">${esc(state.user?.id || '')}</dd>
         </div>
       </dl>`
    )}`;
}

function wireProfileTab(view, reload) {
  const avatarInput = view.querySelector('[data-avatar-input]');

  view.querySelector('[data-avatar-pick]')?.addEventListener('click', () => avatarInput.click());

  avatarInput?.addEventListener('change', async () => {
    const file = avatarInput.files?.[0];
    if (!file) return;
    if (file.size > APP.maxAvatarSize) {
      toastError('Imazhi duhet të jetë nën 2 MB.');
      avatarInput.value = '';
      return;
    }
    try {
      toastInfo('Duke ngarkuar fotografinë…', 1800);
      const url = await profiles.uploadAvatar(file);
      setProfile({ ...state.profile, avatar_url: url });
      toastSuccess('Fotografia u përditësua.');
      await reload();
    } catch (error) {
      toastError(error.message);
    }
  });

  view.querySelector('[data-avatar-remove]')?.addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: 'Largo fotografinë?',
      message: 'Do të shfaqen përsëri inicialet e emrit.',
      confirmText: 'Largo',
      danger: true
    });
    if (!ok) return;
    try {
      await profiles.removeAvatar();
      setProfile({ ...state.profile, avatar_url: null });
      toastSuccess('Fotografia u largua.');
      await reload();
    } catch (error) {
      toastError(error.message);
    }
  });

  const form = view.querySelector('#profile-form');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = view.querySelector('[data-save-profile]');
    const restore = setButtonLoading(button, 'Duke ruajtur…');
    try {
      const updated = await profiles.update({
        full_name: form.full_name.value.trim() || null,
        phone: form.phone.value.trim() || null
      });
      setProfile({ ...state.profile, ...updated });
      toastSuccess('Profili u ruajt.');
    } catch (error) {
      toastError(error.message);
    } finally {
      restore();
    }
  });

  view.querySelector('[data-change-email]')?.addEventListener('click', async () => {
    const { openModal } = await import('../ui.js');
    const { panel, close } = openModal({
      title: 'Ndrysho email-in',
      description: 'Do të dërgojmë një lidhje konfirmimi te adresa e re.',
      size: 'sm',
      body: `
        <form id="email-form" class="space-y-3" novalidate>
          <div>
            <label class="label label-req" for="new-email">Email-i i ri</label>
            <input type="email" class="input" id="new-email" name="email" required data-autofocus
                   placeholder="emri@shembull.com">
          </div>
          <div data-form-error hidden></div>
        </form>`,
      footer: `
        <button type="button" class="btn btn-secondary" data-modal-close>Anulo</button>
        <button type="submit" form="email-form" class="btn btn-primary" data-submit>Dërgo konfirmimin</button>`
    });

    const emailForm = panel.querySelector('#email-form');
    const errorBox = panel.querySelector('[data-form-error]');
    const submit = panel.querySelector('[data-submit]');

    emailForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      errorBox.hidden = true;
      const value = emailForm.email.value.trim();
      if (!isEmail(value)) {
        errorBox.className = 'text-sm text-danger';
        errorBox.textContent = 'Email-i nuk është i vlefshëm.';
        errorBox.hidden = false;
        return;
      }
      const restore = setButtonLoading(submit, 'Duke dërguar…');
      try {
        await auth.updateEmail(value);
        close();
        toastSuccess('Kontrolloni email-in e re për konfirmim.');
      } catch (error) {
        errorBox.className = 'text-sm text-danger';
        errorBox.textContent = error.message;
        errorBox.hidden = false;
        restore();
      }
    });
  });
}

/* ========================================================= PREFERENCAT ==== */

function preferencesTab() {
  const profile = state.profile || {};
  const theme = profile.theme || 'system';
  const themes = [
    { key: 'light', label: 'E çelur', icon: 'sun' },
    { key: 'dark', label: 'E errët', icon: 'moon' },
    { key: 'system', label: 'Sistemi', icon: 'monitor' }
  ];
  const presets = [7, 14, 30, 60, 90];
  const warn = Number(profile.expiry_warning_days || 30);

  return `
    ${section(
      'Pamja',
      'Zgjedhja ruhet në llogarinë tuaj dhe zbatohet në çdo pajisje.',
      `<div class="grid grid-cols-3 gap-3" data-theme-picker>
         ${themes
           .map(
             (item) => `
           <button type="button" class="p-3 rounded-lg border text-center transition-colors
                          ${
                            theme === item.key
                              ? 'border-accent bg-accent/5 text-ink'
                              : 'border-line hover:border-line-strong text-ink-muted'
                          }"
                   data-theme="${item.key}" aria-pressed="${theme === item.key ? 'true' : 'false'}">
             <span class="flex justify-center mb-2 ${theme === item.key ? 'text-accent' : ''}">
               ${icon(item.icon, 'w-4 h-4')}
             </span>
             <span class="text-xs font-medium">${esc(item.label)}</span>
           </button>`
           )
           .join('')}
       </div>`
    )}

    ${section(
      'Njoftimet për skadim',
      'Sa ditë para datës së skadimit duhet të paralajmëroheni.',
      `<div class="space-y-4">
         <div class="flex flex-wrap gap-1.5" data-warn-presets>
           ${presets
             .map(
               (days) => `
             <button type="button" class="chip" data-warn="${days}"
                     aria-pressed="${warn === days ? 'true' : 'false'}">${days} ditë</button>`
             )
             .join('')}
         </div>
         <div class="flex items-end gap-3">
           <div class="w-32">
             <label class="label" for="warn-days">Vlera</label>
             <input type="number" class="input" id="warn-days" min="1" max="365" value="${warn}">
           </div>
           <button type="button" class="btn btn-secondary" data-save-warn>Ruaj</button>
         </div>

         <label class="flex items-center justify-between gap-4 pt-2">
           <span>
             <span class="block text-sm text-ink">Njoftime brenda aplikacionit</span>
             <span class="block text-xs text-ink-muted mt-0.5">
               Shfaq shenjën dhe listën e njoftimeve në shiritin e sipërm.
             </span>
           </span>
           <input type="checkbox" class="switch flex-none" id="notif-toggle"
                  ${profile.notifications_enabled !== false ? 'checked' : ''}>
         </label>
       </div>`
    )}

    ${section(
      'Shkurtesat e tastierës',
      '',
      `<dl class="divide-y divide-line text-sm">
         <div class="flex items-center justify-between gap-4 py-2.5">
           <dt class="text-ink-muted">Kërko dokumente</dt>
           <dd class="flex gap-1"><span class="kbd">⌘</span><span class="kbd">K</span></dd>
         </div>
         <div class="flex items-center justify-between gap-4 py-2.5">
           <dt class="text-ink-muted">Kërko (shkurtesë e dytë)</dt>
           <dd><span class="kbd">/</span></dd>
         </div>
         <div class="flex items-center justify-between gap-4 py-2.5">
           <dt class="text-ink-muted">Ngarko dokument</dt>
           <dd><span class="kbd">N</span></dd>
         </div>
         <div class="flex items-center justify-between gap-4 py-2.5">
           <dt class="text-ink-muted">Mbyll dritaren</dt>
           <dd><span class="kbd">Esc</span></dd>
         </div>
       </dl>`
    )}`;
}

function wirePreferencesTab(view, reload) {
  view.querySelectorAll('[data-theme]').forEach((button) =>
    button.addEventListener('click', async () => {
      const value = button.dataset.theme;
      applyTheme(value);
      try {
        await profiles.update({ theme: value });
        setProfile({ ...state.profile, theme: value });
        await reload();
      } catch (error) {
        toastError(error.message);
      }
    })
  );

  const input = view.querySelector('#warn-days');

  view.querySelectorAll('[data-warn]').forEach((chip) =>
    chip.addEventListener('click', () => {
      input.value = chip.dataset.warn;
      saveWarn();
    })
  );

  view.querySelector('[data-save-warn]')?.addEventListener('click', saveWarn);

  async function saveWarn() {
    const value = Math.min(365, Math.max(1, Number(input.value) || 30));
    input.value = value;
    const button = view.querySelector('[data-save-warn]');
    const restore = setButtonLoading(button, 'Duke ruajtur…');
    try {
      await profiles.update({ expiry_warning_days: value });
      setProfile({ ...state.profile, expiry_warning_days: value });
      toastSuccess(`Paralajmërimi u caktuar në ${value} ditë.`);
      await refreshAll();
      await reload();
    } catch (error) {
      toastError(error.message);
      restore();
    }
  }

  view.querySelector('#notif-toggle')?.addEventListener('change', async (event) => {
    try {
      await profiles.update({ notifications_enabled: event.target.checked });
      setProfile({ ...state.profile, notifications_enabled: event.target.checked });
      toastSuccess(event.target.checked ? 'Njoftimet u aktivizuan.' : 'Njoftimet u çaktivizuan.');
    } catch (error) {
      toastError(error.message);
      event.target.checked = !event.target.checked;
    }
  });
}

/* ============================================================= SIGURIA ==== */

function securityTab() {
  return `
    ${section(
      'Fjalëkalimi',
      'Fjalëkalimi duhet të ketë së paku 8 karaktere.',
      `<form id="password-form" class="space-y-4" novalidate>
         <div>
           <label class="label label-req" for="current_password">Fjalëkalimi aktual</label>
           <input type="password" class="input" id="current_password" name="current_password"
                  autocomplete="current-password" required placeholder="••••••••">
         </div>
         <div class="grid sm:grid-cols-2 gap-4">
           <div>
             <label class="label label-req" for="new_password">Fjalëkalimi i ri</label>
             <input type="password" class="input" id="new_password" name="new_password"
                    autocomplete="new-password" minlength="8" required placeholder="Së paku 8 karaktere">
             <div class="mt-2" id="pw-strength" hidden>
               <div class="flex gap-1" aria-hidden="true">
                 ${Array.from({ length: 4 })
                   .map(() => '<span class="h-1 flex-1 rounded-full bg-surface-inset" data-bar></span>')
                   .join('')}
               </div>
               <p class="mt-1.5 text-xs text-ink-subtle" data-strength-label></p>
             </div>
           </div>
           <div>
             <label class="label label-req" for="confirm_password">Përsërit</label>
             <input type="password" class="input" id="confirm_password" name="confirm_password"
                    autocomplete="new-password" required placeholder="••••••••">
           </div>
         </div>
         <div data-pw-error hidden class="text-sm text-danger"></div>
       </form>`,
      `<button type="submit" form="password-form" class="btn btn-primary" data-save-password>
         Ndrysho fjalëkalimin
       </button>`
    )}

    ${section(
      'Sesionet',
      'Çkyçja nga të gjitha pajisjet mbyll sesionet aktive kudo.',
      `<div class="flex items-start gap-3 p-3.5 panel">
         <span class="w-8 h-8 rounded-md bg-surface border border-line flex items-center justify-center
                      text-ink-muted flex-none">${icon('monitor', 'w-4 h-4')}</span>
         <div class="min-w-0 flex-1">
           <p class="text-sm text-ink">Sesioni aktual</p>
           <p class="text-xs text-ink-muted mt-0.5">
             Kyçja e fundit: ${esc(formatDateTime(state.user?.last_sign_in_at))}
           </p>
         </div>
       </div>`,
      `<button type="button" class="btn btn-secondary" data-signout-all>
         ${icon('log-out')}<span>Çkyçu nga të gjitha pajisjet</span>
       </button>`
    )}

    ${section(
      'Si mbrohen të dhënat',
      '',
      `<ul class="space-y-3">
         ${[
           ['shield-check', 'Row Level Security', 'Çdo tabelë ka politika që lejojnë vetëm rreshtat e llogarisë tuaj.'],
           ['lock', 'Storage privat', 'Dokumentet ruhen në bucket privat; shikimi bëhet me URL të nënshkruara me afat.'],
           ['ban', 'Pa çelësa të ndjeshëm', 'Frontend-i përdor vetëm çelësin publik anon.']
         ]
           .map(
             ([iconName, title, text]) => `
           <li class="flex gap-3">
             <span class="w-7 h-7 rounded-md bg-surface-inset border border-line flex items-center
                          justify-center text-ink-muted flex-none">${icon(iconName, 'w-3.5 h-3.5')}</span>
             <div class="min-w-0">
               <p class="text-sm text-ink">${esc(title)}</p>
               <p class="text-xs text-ink-muted mt-0.5 leading-6">${esc(text)}</p>
             </div>
           </li>`
           )
           .join('')}
       </ul>`
    )}`;
}

function wireSecurityTab(view) {
  const form = view.querySelector('#password-form');
  const errorBox = view.querySelector('[data-pw-error]');
  const strength = view.querySelector('#pw-strength');
  const colors = ['bg-danger', 'bg-danger', 'bg-warning', 'bg-accent', 'bg-success'];

  form?.new_password.addEventListener('input', (event) => {
    const value = event.target.value;
    strength.hidden = !value;
    const score = passwordStrength(value);
    strength.querySelectorAll('[data-bar]').forEach((bar, index) => {
      bar.className = `h-1 flex-1 rounded-full ${index < score ? colors[score] : 'bg-surface-inset'}`;
    });
    strength.querySelector('[data-strength-label]').textContent = value ? STRENGTH_LABELS[score] : '';
  });

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorBox.hidden = true;

    const current = form.current_password.value;
    const next = form.new_password.value;
    const confirm = form.confirm_password.value;

    const fail = (message) => {
      errorBox.textContent = message;
      errorBox.hidden = false;
    };

    if (!current) return fail('Shkruani fjalëkalimin aktual.');
    if (next.length < 8) return fail('Fjalëkalimi i ri duhet të ketë së paku 8 karaktere.');
    if (next !== confirm) return fail('Fjalëkalimet e re nuk përputhen.');
    if (next === current) return fail('Fjalëkalimi i ri duhet të dallojë nga aktuali.');

    const button = view.querySelector('[data-save-password]');
    const restore = setButtonLoading(button, 'Duke ndryshuar…');
    try {
      const email = state.profile?.email || state.user?.email;
      const valid = await auth.verifyPassword(email, current);
      if (!valid) {
        fail('Fjalëkalimi aktual është i pasaktë.');
        return;
      }
      await auth.updatePassword(next);
      form.reset();
      strength.hidden = true;
      toastSuccess('Fjalëkalimi u ndryshua.');
    } catch (error) {
      fail(error.message);
    } finally {
      restore();
    }
  });

  view.querySelector('[data-signout-all]')?.addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: 'Çkyçu nga të gjitha pajisjet?',
      message: 'Të gjitha sesionet aktive do të mbyllen, përfshirë këtë.',
      confirmText: 'Çkyçu',
      danger: true
    });
    if (!ok) return;
    try {
      const { supabase } = await import('../supabase.js');
      await supabase.auth.signOut({ scope: 'global' });
    } catch {
      /* vazhdojmë gjithsesi */
    }
    location.replace('/login.html');
  });
}

/* =========================================================== TË DHËNAT ==== */

function dataTab() {
  const s = state.stats || {};
  const used = Number(s.storage_used || 0);
  const quota = Number(s.storage_quota || APP.defaultQuota);
  const percent = quota ? Math.min(100, (used / quota) * 100) : 0;

  const metric = (label, value) => `
    <div class="rounded-lg border border-line p-3">
      <p class="text-2xs uppercase tracking-wider text-ink-subtle">${esc(label)}</p>
      <p class="mt-1.5 text-lg font-semibold text-ink tabular">${esc(value)}</p>
    </div>`;

  return `
    ${section(
      'Hapësira',
      '',
      `<div class="space-y-4">
         <div>
           <div class="flex items-center justify-between mb-2 text-sm">
             <span class="text-ink tabular">${esc(formatBytes(used))}</span>
             <span class="text-ink-subtle tabular">nga ${esc(formatBytes(quota))}</span>
           </div>
           <div class="progress h-2">
             <div class="progress-bar" style="width:${percent}%;background-color:${
               percent > 90 ? 'rgb(var(--danger))' : percent > 75 ? 'rgb(var(--warning))' : 'rgb(var(--accent))'
             }"></div>
           </div>
         </div>
         <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
           ${metric('Dokumente', formatNumber(s.total_documents || 0))}
           ${metric('Kategori', formatNumber(s.total_categories || 0))}
           ${metric('Dosje', formatNumber(s.total_folders || 0))}
           ${metric('Etiketa', formatNumber(s.total_tags || 0))}
         </div>
       </div>`
    )}

    ${section(
      'Eksporto të dhënat',
      'Shkarkon një skedar JSON me profilin, kategoritë, dosjet, etiketat dhe metadatat e dokumenteve. Skedarët fizikë shkarkohen veçmas nga lista e dokumenteve.',
      `<div class="flex items-start gap-3 p-3.5 panel">
         <span class="w-8 h-8 rounded-md bg-surface border border-line flex items-center justify-center
                      text-ink-muted flex-none">${icon('download', 'w-4 h-4')}</span>
         <div class="min-w-0">
           <p class="text-sm text-ink">dokument-eksport.json</p>
           <p class="text-xs text-ink-muted mt-0.5">Përfshin të gjitha metadatat e llogarisë tuaj.</p>
         </div>
       </div>`,
      `<button type="button" class="btn btn-secondary" data-export>Eksporto JSON</button>`
    )}

    ${section(
      'Fshi të gjitha të dhënat',
      'Fshin përgjithmonë të gjitha dokumentet, skedarët, dosjet, kategoritë dhe etiketat. Llogaria mbetet aktive, por bosh.',
      `<div class="flex items-start gap-3 p-3.5 rounded-lg border border-danger/25 bg-danger/5">
         <span class="text-danger flex-none mt-0.5">${icon('triangle-alert', 'w-4 h-4')}</span>
         <p class="text-sm text-danger leading-6">
           Ky veprim nuk mund të kthehet. Sigurohuni që keni eksportuar atë që doni të ruani.
         </p>
       </div>`,
      `<button type="button" class="btn btn-danger" data-delete-all>Fshi të gjitha të dhënat</button>`
    )}`;
}

function wireDataTab(view, reload) {
  view.querySelector('[data-export]')?.addEventListener('click', async (event) => {
    const restore = setButtonLoading(event.currentTarget, 'Duke përgatitur…');
    try {
      const data = await account.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const stamp = new Date().toISOString().slice(0, 10);
      downloadBlob(blob, `dokument-eksport-${stamp}.json`);
      toastSuccess('Eksportimi përfundoi.');
    } catch (error) {
      toastError(error.message);
    } finally {
      restore();
    }
  });

  view.querySelector('[data-delete-all]')?.addEventListener('click', async () => {
    const first = await confirmDialog({
      title: 'Fshi të gjitha të dhënat?',
      message: 'Të gjitha dokumentet dhe skedarët do të fshihen përgjithmonë.',
      confirmText: 'Vazhdo',
      danger: true
    });
    if (!first) return;

    const { openModal } = await import('../ui.js');
    const { panel, close } = openModal({
      title: 'Konfirmo fshirjen',
      description: 'Shkruani FSHI për të vazhduar.',
      size: 'sm',
      body: `
        <form id="confirm-delete" novalidate>
          <input type="text" class="input" name="word" placeholder="FSHI" autocomplete="off" data-autofocus>
          <span class="field-hint">Shkruani fjalën me shkronja të madhe.</span>
        </form>`,
      footer: `
        <button type="button" class="btn btn-secondary" data-modal-close>Anulo</button>
        <button type="submit" form="confirm-delete" class="btn btn-danger" data-submit disabled>
          Fshi përgjithmonë
        </button>`
    });

    const form = panel.querySelector('#confirm-delete');
    const submit = panel.querySelector('[data-submit]');
    form.word.addEventListener('input', () => {
      submit.disabled = form.word.value.trim() !== 'FSHI';
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (form.word.value.trim() !== 'FSHI') return;
      const restore = setButtonLoading(submit, 'Duke fshirë…');
      try {
        const result = await account.deleteAllData();
        close();
        toastSuccess(
          `U fshinë ${formatNumber(result?.deleted_documents || 0)} dokumente dhe të dhënat përkatëse.`
        );
        await refreshAll();
        await reload();
      } catch (error) {
        toastError(error.message);
        restore();
      }
    });
  });
}

/* ============================================================ RENDERIMI === */

export default async function renderSettings(view, params = {}) {
  const active = TABS.some((tab) => tab.key === params.tab) ? params.tab : 'profile';

  const bodies = {
    profile: profileTab,
    preferences: preferencesTab,
    security: securityTab,
    data: dataTab
  };

  view.innerHTML = `
    <div class="p-5 sm:p-6 max-w-3xl mx-auto space-y-5">
      <div>
        <h2 class="text-xl font-semibold text-ink">Cilësimet</h2>
        <p class="mt-1 text-sm text-ink-muted">Profili, preferencat dhe siguria e llogarisë.</p>
      </div>

      <div class="flex gap-1 p-1 rounded-lg border border-line bg-surface overflow-x-auto" role="tablist">
        ${TABS.map(
          (tab) => `
          <button type="button" role="tab" aria-selected="${tab.key === active}"
                  class="flex items-center gap-2 px-3 h-8 rounded-md text-xs font-medium whitespace-nowrap
                         transition-colors ${
                           tab.key === active
                             ? 'bg-surface-inset text-ink'
                             : 'text-ink-muted hover:text-ink'
                         }"
                  data-tab="${tab.key}">
            ${icon(tab.icon)}<span>${esc(tab.label)}</span>
          </button>`
        ).join('')}
      </div>

      <div class="space-y-5" id="tab-body">${bodies[active]()}</div>
    </div>`;

  const reload = async () => renderSettings(view, { tab: active });

  view.querySelectorAll('[data-tab]').forEach((button) =>
    button.addEventListener('click', () => updateParams({ tab: button.dataset.tab }))
  );

  if (active === 'profile') wireProfileTab(view, reload);
  else if (active === 'preferences') wirePreferencesTab(view, reload);
  else if (active === 'security') wireSecurityTab(view);
  else if (active === 'data') wireDataTab(view, reload);
}
