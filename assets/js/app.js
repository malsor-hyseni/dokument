/**
 * DOKUMENT — Shell-i i aplikacionit
 * -----------------------------------------------------------------------------
 * Verifikon sesionin, ndërton sidebar-in dhe topbar-in, ngarkon pamjet sipas
 * hash-it të URL-së dhe trajton panelin e njoftimeve.
 */

import { auth, profiles, notifications } from './api.js';
import { isConfigured } from './supabase.js';
import { icon } from './icons.js';
import { APP } from './config.js';
import { state, refreshAll, onStateChange, setProfile } from './store.js';
import { parseHash, navigate, requestRender, onRenderRequest } from './routing.js';
import {
  initTheme, cycleTheme, themeIcon, themeLabel, applyTheme,
  toastError, openDropdown, closeDropdown, confirmDialog,
  startPageProgress, stopPageProgress, bindShortcuts, emptyState
} from './ui.js';
import { $, $$, esc, formatBytes, formatNumber, relativeTime, debounce, initials } from './utils.js';

import renderDashboard from './pages/dashboard.js';
import renderDocuments from './pages/documents.js';
import renderFolders from './pages/folders.js';
import renderCategories from './pages/categories.js';
import renderTags from './pages/tags.js';
import renderSettings from './pages/settings.js';
import { openUploadModal, openPreviewModal } from './documents-ui.js';

/* ============================================================ RRUGËT ====== */

const ROUTES = [
  { id: 'dashboard', path: 'dashboard', title: 'Dashboard', icon: 'layout-dashboard', render: renderDashboard },
  { id: 'documents', path: 'documents', title: 'Dokumentet', icon: 'file-text', render: renderDocuments },
  { id: 'folders', path: 'folders', title: 'Dosjet', icon: 'folders', render: renderFolders },
  { id: 'categories', path: 'categories', title: 'Kategoritë', icon: 'layout-grid', render: renderCategories },
  { id: 'tags', path: 'tags', title: 'Etiketat', icon: 'tags', render: renderTags },
  { id: 'settings', path: 'settings', title: 'Cilësimet', icon: 'settings', render: renderSettings }
];

const STATUS_TITLES = {
  favorite: 'Të preferuarat',
  expiring: 'Po skadojnë',
  expired: 'Të skaduara',
  archived: 'Arkiva'
};

let renderToken = 0;

async function handleRoute() {
  const { path, params } = parseHash();
  const route = ROUTES.find((r) => r.path === path) || ROUTES[0];
  state.route = { ...route, params };

  const token = ++renderToken;
  const view = $('#view');
  const title =
    path === 'documents' && STATUS_TITLES[params.status] ? STATUS_TITLES[params.status] : route.title;
  $('#page-title').textContent = title;
  document.title = `${title} · DOKUMENT`;
  renderNav();
  closeDropdown();

  const search = $('#global-search');
  if (search && document.activeElement !== search) {
    search.value = path === 'documents' ? params.q || '' : '';
  }

  startPageProgress();
  view.scrollTop = 0;
  try {
    await route.render(view, params);
  } catch (error) {
    console.error('[DOKUMENT] Gabim në pamje:', error);
    if (token === renderToken) {
      view.innerHTML = `<div class="p-6">${emptyState({
        icon: 'circle-alert',
        title: 'Pamja nuk u ngarkua',
        description: error.message || 'Ndodhi një gabim gjatë ngarkimit.',
        action: '<button type="button" class="btn btn-secondary" data-retry>Provo përsëri</button>'
      })}</div>`;
      view.querySelector('[data-retry]')?.addEventListener('click', () => handleRoute());
    }
  } finally {
    if (token === renderToken) stopPageProgress();
  }

  closeSidebar();
}

/* =========================================================== SIDEBAR ====== */

function renderNav() {
  const nav = $('#nav');
  if (!nav) return;
  const current = state.route?.path;
  const activeStatus = current === 'documents' ? state.route?.params?.status : null;
  const activeCategory = current === 'documents' ? state.route?.params?.category : null;
  const plain = current === 'documents' && !activeStatus && !activeCategory;

  const counts = {
    documents: state.stats?.total_documents,
    folders: state.stats?.total_folders,
    categories: state.stats?.total_categories,
    tags: state.stats?.total_tags
  };

  const main = ROUTES.filter((route) => route.id !== 'settings');
  const quick = [
    { key: 'favorite', label: 'Të preferuarat', icon: 'star', count: state.stats?.favorite_documents },
    { key: 'expiring', label: 'Po skadojnë', icon: 'calendar-clock', count: state.stats?.expiring_soon },
    { key: 'expired', label: 'Të skaduara', icon: 'triangle-alert', count: state.stats?.expired },
    { key: 'archived', label: 'Arkiva', icon: 'archive', count: state.stats?.archived_documents }
  ];

  const isActive = (route) => {
    if (route.path !== current) return false;
    if (route.path === 'documents') return plain;
    return true;
  };

  nav.innerHTML = `
    <div class="space-y-0.5">
      ${main
        .map(
          (route) => `
        <a href="#/${route.path}" class="nav-item${isActive(route) ? ' is-active' : ''}">
          ${icon(route.icon)}
          <span class="truncate">${esc(route.title)}</span>
          ${
            counts[route.id] !== undefined && counts[route.id] !== null
              ? `<span class="nav-count">${formatNumber(counts[route.id])}</span>`
              : ''
          }
        </a>`
        )
        .join('')}
    </div>

    <div class="pt-4">
      <p class="px-2.5 pb-1.5 text-2xs font-medium uppercase tracking-wider text-ink-subtle">Shkurtesat</p>
      <div class="space-y-0.5">
        ${quick
          .map(
            (item) => `
          <a href="#/documents?status=${item.key}" class="nav-item${
              activeStatus === item.key ? ' is-active' : ''
            }">
            ${icon(item.icon)}
            <span class="truncate">${esc(item.label)}</span>
            ${item.count ? `<span class="nav-count">${formatNumber(item.count)}</span>` : ''}
          </a>`
          )
          .join('')}
      </div>
    </div>

    ${
      state.categories.length
        ? `<div class="pt-4">
             <p class="px-2.5 pb-1.5 text-2xs font-medium uppercase tracking-wider text-ink-subtle">Kategoritë</p>
             <div class="space-y-0.5">
               ${state.categories
                 .slice(0, 8)
                 .map(
                   (category) => `
                 <a href="#/documents?category=${encodeURIComponent(category.id)}"
                    class="nav-item${activeCategory === category.id ? ' is-active' : ''}">
                   <span class="dot dot-${esc(category.color)} ml-1 mr-0.5"></span>
                   <span class="truncate">${esc(category.name)}</span>
                 </a>`
                 )
                 .join('')}
               ${
                 state.categories.length > 8
                   ? `<a href="#/categories" class="nav-item text-ink-subtle">
                        ${icon('ellipsis')}<span>Të gjitha kategoritë</span>
                      </a>`
                   : ''
               }
             </div>
           </div>`
        : ''
    }

    <div class="pt-4">
      <a href="#/settings" class="nav-item${current === 'settings' ? ' is-active' : ''}">
        ${icon('settings')}<span>Cilësimet</span>
      </a>
    </div>`;
}

function renderStorageWidget() {
  const node = $('#storage-widget');
  if (!node) return;
  const used = Number(state.stats?.storage_used || 0);
  const quota = Number(state.stats?.storage_quota || APP.defaultQuota);
  const percent = quota > 0 ? Math.min(100, (used / quota) * 100) : 0;
  const barColor =
    percent > 90 ? 'rgb(var(--danger))' : percent > 75 ? 'rgb(var(--warning))' : 'rgb(var(--accent))';

  node.innerHTML = `
    <div class="flex items-center justify-between mb-2">
      <span class="text-2xs font-medium uppercase tracking-wider text-ink-subtle">Hapësira</span>
      <span class="text-xs text-ink-muted tabular">${percent.toFixed(0)}%</span>
    </div>
    <div class="progress">
      <div class="progress-bar" style="width:${percent}%;background-color:${barColor}"></div>
    </div>
    <p class="mt-2 text-xs text-ink-subtle tabular">${formatBytes(used)} nga ${formatBytes(quota)}</p>`;
}

function renderUserButton() {
  const button = $('#user-menu-btn');
  if (!button) return;
  const name = state.profile?.full_name || state.user?.email?.split('@')[0] || 'Përdorues';
  const email = state.profile?.email || state.user?.email || '';
  const avatar = state.profile?.avatar_url;

  button.innerHTML = `
    ${
      avatar
        ? `<img src="${esc(avatar)}" alt="" class="w-8 h-8 rounded-full object-cover flex-none border border-line">`
        : `<span class="w-8 h-8 rounded-full bg-accent/10 text-accent flex items-center justify-center
                       text-xs font-semibold flex-none">${esc(initials(name, email))}</span>`
    }
    <span class="min-w-0 flex-1">
      <span class="block text-xs font-medium text-ink truncate">${esc(name)}</span>
      <span class="block text-2xs text-ink-subtle truncate">${esc(email)}</span>
    </span>
    <span class="text-ink-subtle flex-none text-xs">${icon('chevron-down')}</span>`;
}

function openSidebar() {
  $('#sidebar').classList.remove('-translate-x-full');
  $('#sidebar-backdrop').hidden = false;
}

function closeSidebar() {
  if (window.innerWidth < 1024) {
    $('#sidebar').classList.add('-translate-x-full');
    $('#sidebar-backdrop').hidden = true;
  }
}

/* ========================================================= NJOFTIMET ====== */

async function refreshBell() {
  try {
    const count = await notifications.unreadCount();
    const dot = $('#bell-dot');
    if (dot) dot.hidden = count === 0;
    return count;
  } catch {
    return 0;
  }
}

async function openNotifications() {
  const panel = $('#notifications-panel');
  const list = $('#notifications-list');
  panel.hidden = false;
  list.innerHTML = `<div class="p-4 space-y-3">${Array.from({ length: 4 })
    .map(() => '<div class="skeleton h-16 rounded-lg"></div>')
    .join('')}</div>`;

  try {
    await notifications.sync();
    const items = await notifications.list();

    if (!items.length) {
      list.innerHTML = emptyState({
        icon: 'bell',
        title: 'Nuk ka njoftime',
        description: 'Kur një dokument i afrohet datës së skadimit, njoftimi shfaqet këtu.'
      });
      await refreshBell();
      return;
    }

    list.innerHTML = items
      .map((item) => {
        const expired = item.type === 'expired';
        return `
        <div class="flex gap-3 p-4 border-b border-line${item.is_read ? '' : ' bg-accent/5'}"
             data-notification="${esc(item.id)}">
          <span class="w-8 h-8 rounded-md flex items-center justify-center flex-none ${
            expired ? 'bg-danger/10 text-danger' : 'bg-warning/10 text-warning'
          }">${icon(expired ? 'triangle-alert' : 'calendar-clock', 'w-4 h-4')}</span>
          <div class="min-w-0 flex-1">
            <div class="flex items-start gap-2">
              <p class="text-sm font-medium text-ink truncate flex-1">${esc(item.title)}</p>
              ${item.is_read ? '' : '<span class="w-1.5 h-1.5 rounded-full bg-accent flex-none mt-1.5"></span>'}
            </div>
            <p class="mt-1 text-xs text-ink-muted leading-5">${esc(item.body || '')}</p>
            <div class="mt-2 flex items-center gap-3">
              ${
                item.document_id
                  ? `<button type="button" class="text-xs font-medium text-accent hover:underline"
                             data-open-doc="${esc(item.document_id)}">Hap dokumentin</button>`
                  : ''
              }
              <span class="text-2xs text-ink-subtle">${esc(relativeTime(item.created_at))}</span>
              <button type="button" class="text-2xs text-ink-subtle hover:text-danger ml-auto"
                      data-remove-notification="${esc(item.id)}">Largo</button>
            </div>
          </div>
        </div>`;
      })
      .join('');

    list.querySelectorAll('[data-open-doc]').forEach((button) =>
      button.addEventListener('click', async () => {
        const row = button.closest('[data-notification]');
        if (row) await notifications.markRead(row.dataset.notification).catch(() => {});
        closeNotifications();
        await openPreviewModal(button.dataset.openDoc, {
          onChange: async () => {
            await refreshAll();
            requestRender();
          }
        });
        await refreshBell();
      })
    );

    list.querySelectorAll('[data-remove-notification]').forEach((button) =>
      button.addEventListener('click', async () => {
        try {
          await notifications.remove(button.dataset.removeNotification);
          button.closest('[data-notification]')?.remove();
          await refreshBell();
          if (!list.querySelector('[data-notification]')) await openNotifications();
        } catch (error) {
          toastError(error.message);
        }
      })
    );

    await refreshBell();
  } catch (error) {
    list.innerHTML = emptyState({
      icon: 'circle-alert',
      title: 'Njoftimet nuk u ngarkuan',
      description: error.message
    });
  }
}

function closeNotifications() {
  $('#notifications-panel').hidden = true;
}

/* ============================================================ LIDHJET ===== */

function openUpload() {
  openUploadModal({
    onDone: async () => {
      await refreshAll();
      requestRender();
    }
  });
}

function wireShell() {
  // Tema
  const themeButton = $('#theme-toggle');
  const paintTheme = () => {
    themeButton.innerHTML = icon(themeIcon());
    themeButton.title = `Tema: ${themeLabel()}`;
  };
  paintTheme();
  themeButton.addEventListener('click', () => {
    const next = cycleTheme();
    paintTheme();
    if (state.profile) {
      state.profile.theme = next;
      profiles.update({ theme: next }).catch(() => {});
    }
  });

  // Ikonat statike
  $('#sidebar-open').innerHTML = icon('menu');
  $('#sidebar-close').innerHTML = icon('x');
  $('#search-icon').innerHTML = icon('search');
  $('#search-mobile').innerHTML = icon('search');
  $('#bell-btn').insertAdjacentHTML('afterbegin', icon('bell'));
  $$('[data-close-panel]').forEach((node) => {
    if (node.tagName === 'BUTTON' && !node.innerHTML.trim()) node.innerHTML = icon('x');
    node.addEventListener('click', closeNotifications);
  });

  // Sidebar
  $('#sidebar-open').addEventListener('click', openSidebar);
  $('#sidebar-close').addEventListener('click', closeSidebar);
  $('#sidebar-backdrop').addEventListener('click', closeSidebar);

  // Ngarkimi
  $('#upload-btn').addEventListener('click', openUpload);

  // Kërkimi global
  const search = $('#global-search');
  const runSearch = debounce((value) => {
    const { path, params } = parseHash();
    if (!value && path !== 'documents') return;
    const base = path === 'documents' ? { ...params } : {};
    delete base.page;
    navigate('documents', { ...base, q: value });
  }, 320);

  search.addEventListener('input', (event) => runSearch(event.target.value));
  search.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      runSearch.cancel();
      navigate('documents', { q: event.target.value });
    } else if (event.key === 'Escape') {
      event.target.value = '';
      event.target.blur();
    }
  });
  $('#search-mobile').addEventListener('click', () => {
    navigate('documents', {});
    setTimeout(() => $('#view').querySelector('[data-view-search]')?.focus(), 260);
  });

  // Njoftimet
  $('#bell-btn').addEventListener('click', openNotifications);
  $('#mark-all-read').addEventListener('click', async () => {
    try {
      await notifications.markAllRead();
      await openNotifications();
    } catch (error) {
      toastError(error.message);
    }
  });

  // Menyja e përdoruesit
  $('#user-menu-btn').addEventListener('click', (event) => {
    openDropdown(
      event.currentTarget,
      [
        { label: 'Profili', icon: 'user', onClick: () => navigate('settings', { tab: 'profile' }) },
        { label: 'Cilësimet', icon: 'settings', onClick: () => navigate('settings', { tab: 'preferences' }) },
        { label: 'Eksporto të dhënat', icon: 'download', onClick: () => navigate('settings', { tab: 'data' }) },
        { separator: true },
        {
          label: 'Çkyçu',
          icon: 'log-out',
          danger: true,
          onClick: async () => {
            const ok = await confirmDialog({
              title: 'Çkyçu nga llogaria?',
              message: 'Do të duhet të kyçeni përsëri për të arritur dokumentet.',
              confirmText: 'Çkyçu',
              danger: true
            });
            if (!ok) return;
            try {
              await auth.signOut();
            } catch {
              /* vazhdojmë gjithsesi */
            }
            location.replace('/login.html');
          }
        }
      ],
      { align: 'left', width: 215 }
    );
  });

  // Shkurtesat e tastierës
  bindShortcuts({
    search: () => {
      if (window.innerWidth < 640) {
        navigate('documents', {});
        setTimeout(() => $('#view').querySelector('[data-view-search]')?.focus(), 260);
      } else {
        const input = $('#global-search');
        input.focus();
        input.select();
      }
    },
    upload: openUpload
  });

  // Rruga
  window.addEventListener('hashchange', handleRoute);
  onRenderRequest(handleRoute);

  // Gjendja → chrome
  onStateChange(() => {
    renderNav();
    renderStorageWidget();
    renderUserButton();
  });

  // Sesioni
  auth.onChange((event) => {
    if (event === 'SIGNED_OUT') location.replace('/login.html');
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth >= 1024) {
      $('#sidebar').classList.remove('-translate-x-full');
      $('#sidebar-backdrop').hidden = true;
    } else {
      $('#sidebar').classList.add('-translate-x-full');
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !$('#notifications-panel').hidden) closeNotifications();
  });
}

/* ============================================================== NISJA ===== */

(async function start() {
  initTheme();
  if (!isConfigured) return; // supabase.js shfaq ekranin udhëzues

  let session = null;
  try {
    session = await auth.getSession();
  } catch (error) {
    console.error('[DOKUMENT] Sesioni nuk u lexua:', error);
  }

  if (!session) {
    location.replace(`/login.html?next=${encodeURIComponent('/app.html')}`);
    return;
  }
  state.user = session.user;

  try {
    const profile = await profiles.get();
    setProfile(profile);
    if (profile?.theme) applyTheme(profile.theme);
  } catch (error) {
    console.warn('[DOKUMENT] Profili nuk u lexua:', error.message);
    toastError(error.message);
  }

  $('#boot').hidden = true;
  $('#shell').hidden = false;

  wireShell();
  renderUserButton();
  renderStorageWidget();

  await refreshAll();
  await handleRoute();

  notifications.sync().then(refreshBell).catch(() => {});
  setInterval(refreshBell, 5 * 60 * 1000);
})();

export { handleRoute, refreshBell, ROUTES };
