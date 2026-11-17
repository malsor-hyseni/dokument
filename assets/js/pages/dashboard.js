/**
 * DOKUMENT — Dashboard
 * -----------------------------------------------------------------------------
 * Statistikat kryesore, dokumentet që po skadojnë, të ngarkuarat së fundi,
 * ndarja sipas kategorive dhe historiku i aktivitetit.
 */

import { documents, stats as statsApi } from '../api.js';
import { icon } from '../icons.js';
import { state, refreshAll, warningDays } from '../store.js';
import { emptyState } from '../ui.js';
import {
  esc, formatBytes, formatNumber, formatDate, formatMonthShort, relativeTime,
  expiryStatus, fileIconName
} from '../utils.js';
import { openUploadModal, wireDocumentList } from '../documents-ui.js';

const ACTIONS = {
  created: { label: 'Krijoi', icon: 'file-plus' },
  updated: { label: 'Përditësoi', icon: 'square-pen' },
  deleted: { label: 'Fshiu', icon: 'trash-2' },
  downloaded: { label: 'Shkarkoi', icon: 'download' },
  viewed: { label: 'Hapi', icon: 'eye' }
};

function statCard({ label, value, hint, iconName, tone = '', href }) {
  const inner = `
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <p class="text-2xs font-medium uppercase tracking-wider text-ink-subtle">${esc(label)}</p>
        <p class="mt-2 text-2xl font-semibold text-ink tabular">${esc(value)}</p>
        ${hint ? `<p class="mt-1 text-xs text-ink-subtle truncate">${esc(hint)}</p>` : ''}
      </div>
      <span class="w-8 h-8 rounded-md flex items-center justify-center flex-none border ${
        tone || 'bg-surface-inset border-line text-ink-muted'
      }">${icon(iconName, 'w-4 h-4')}</span>
    </div>`;

  return href
    ? `<a href="${href}" class="card card-pad hover:border-line-strong transition-colors block">${inner}</a>`
    : `<div class="card card-pad">${inner}</div>`;
}

function skeleton() {
  return `
    <div class="p-5 sm:p-6 max-w-7xl mx-auto space-y-6">
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        ${Array.from({ length: 4 }).map(() => '<div class="skeleton h-[104px] rounded-xl"></div>').join('')}
      </div>
      <div class="grid lg:grid-cols-[1.4fr_1fr] gap-5">
        <div class="skeleton h-80 rounded-xl"></div>
        <div class="skeleton h-80 rounded-xl"></div>
      </div>
    </div>`;
}

export default async function renderDashboard(view) {
  view.innerHTML = skeleton();

  const [data, recent, expiring, activity] = await Promise.all([
    state.stats ? Promise.resolve(state.stats) : statsApi.dashboard(),
    documents.recent(6),
    documents.expiring(warningDays(), 6),
    statsApi.activity(8).catch(() => [])
  ]);

  const s = data || {};
  const byCategory = (s.by_category || []).filter((entry) => entry.count > 0);
  const byMonth = s.by_month || [];
  const maxMonth = Math.max(1, ...byMonth.map((m) => Number(m.count) || 0));
  const totalCategorized = byCategory.reduce((sum, entry) => sum + Number(entry.count), 0);
  const firstName = (state.profile?.full_name || '').trim().split(/\s+/)[0];
  const quota = Number(s.storage_quota || 0);
  const used = Number(s.storage_used || 0);

  view.innerHTML = `
    <div class="p-5 sm:p-6 max-w-7xl mx-auto space-y-6">

      <!-- Përshëndetja -->
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 class="text-xl font-semibold text-ink">
            ${firstName ? `Përshëndetje, ${esc(firstName)}` : 'Përshëndetje'}
          </h2>
          <p class="mt-1 text-sm text-ink-muted">
            ${
              Number(s.total_documents) === 0
                ? 'Ngarkoni dokumentin e parë për të filluar.'
                : `Keni ${formatNumber(s.total_documents)} dokumente të ruajtura.`
            }
          </p>
        </div>
        <button type="button" class="btn btn-primary" data-upload>
          ${icon('plus')}<span>Ngarko dokument</span>
        </button>
      </div>

      <!-- Statistikat -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        ${statCard({
          label: 'Dokumente',
          value: formatNumber(s.total_documents || 0),
          hint: s.added_this_month ? `+${formatNumber(s.added_this_month)} këtë muaj` : 'Asnjë shtim këtë muaj',
          iconName: 'file-text',
          href: '#/documents'
        })}
        ${statCard({
          label: 'Hapësira',
          value: formatBytes(used),
          hint: quota ? `nga ${formatBytes(quota)}` : '',
          iconName: 'hard-drive'
        })}
        ${statCard({
          label: 'Po skadojnë',
          value: formatNumber(s.expiring_soon || 0),
          hint: `brenda ${formatNumber(s.warning_days || warningDays())} ditëve`,
          iconName: 'calendar-clock',
          tone: Number(s.expiring_soon) ? 'bg-warning/10 border-warning/20 text-warning' : '',
          href: '#/documents?status=expiring'
        })}
        ${statCard({
          label: 'Të skaduara',
          value: formatNumber(s.expired || 0),
          hint: Number(s.expired) ? 'kërkojnë rinovim' : 'asgjë e skaduar',
          iconName: 'triangle-alert',
          tone: Number(s.expired) ? 'bg-danger/10 border-danger/20 text-danger' : '',
          href: '#/documents?status=expired'
        })}
      </div>

      <div class="grid lg:grid-cols-[1.45fr_1fr] gap-5 items-start">

        <!-- Dokumentet e fundit -->
        <section class="card overflow-hidden">
          <div class="card-head">
            <h3 class="text-sm font-semibold text-ink">Të ngarkuarat së fundi</h3>
            <a href="#/documents" class="text-xs font-medium text-accent hover:underline">Shiko të gjitha</a>
          </div>
          ${
            recent.length
              ? `<div class="divide-y divide-line" id="recent-list">
                   ${recent
                     .map(
                       (doc) => `
                     <div class="flex items-center gap-3 px-4 py-3 hover:bg-surface-inset/50 transition-colors cursor-pointer"
                          data-doc="${esc(doc.id)}">
                       <span class="file-icon">${icon(fileIconName(doc.mime_type, doc.file_name))}</span>
                       <div class="min-w-0 flex-1">
                         <p class="text-sm font-medium text-ink truncate">${esc(doc.title)}</p>
                         <p class="text-xs text-ink-subtle truncate">
                           ${
                             doc.categories
                               ? `<span class="inline-flex items-center gap-1.5">
                                    <span class="dot dot-${esc(doc.categories.color)}"></span>${esc(
                                   doc.categories.name
                                 )}</span> · `
                               : ''
                           }<span class="tabular">${esc(formatBytes(doc.file_size))}</span>
                         </p>
                       </div>
                       <span class="text-2xs text-ink-subtle flex-none">${esc(relativeTime(doc.created_at))}</span>
                     </div>`
                     )
                     .join('')}
                 </div>`
              : emptyState({
                  icon: 'file-plus',
                  title: 'Asnjë dokument',
                  description: 'Ngarkoni dokumentin e parë — pasaportën, kontratën ose faturën.',
                  action: '<button type="button" class="btn btn-primary" data-upload>Ngarko dokument</button>'
                })
          }
        </section>

        <!-- Po skadojnë -->
        <section class="card overflow-hidden">
          <div class="card-head">
            <h3 class="text-sm font-semibold text-ink">Afatet</h3>
            <a href="#/documents?status=expiring" class="text-xs font-medium text-accent hover:underline">Shiko</a>
          </div>
          ${
            expiring.length
              ? `<div class="divide-y divide-line" id="expiring-list">
                   ${expiring
                     .map((doc) => {
                       const status = expiryStatus(doc.expiry_date, warningDays());
                       return `
                       <div class="flex items-center gap-3 px-4 py-3 hover:bg-surface-inset/50 transition-colors cursor-pointer"
                            data-doc="${esc(doc.id)}">
                         <div class="min-w-0 flex-1">
                           <p class="text-sm font-medium text-ink truncate">${esc(doc.title)}</p>
                           <p class="text-xs text-ink-subtle tabular">${esc(formatDate(doc.expiry_date))}</p>
                         </div>
                         <span class="badge ${status.tone} flex-none">${esc(status.label)}</span>
                       </div>`;
                     })
                     .join('')}
                 </div>`
              : emptyState({
                  icon: 'circle-check-big',
                  title: 'Asnjë afat i afërt',
                  description: 'Të gjitha dokumentet me datë skadimi janë në rregull.'
                })
          }
        </section>
      </div>

      <div class="grid lg:grid-cols-2 gap-5 items-start">

        <!-- Sipas kategorive -->
        <section class="card overflow-hidden">
          <div class="card-head">
            <h3 class="text-sm font-semibold text-ink">Sipas kategorive</h3>
            <a href="#/categories" class="text-xs font-medium text-accent hover:underline">Menaxho</a>
          </div>
          ${
            byCategory.length
              ? `<div class="p-4 space-y-3.5">
                   ${byCategory
                     .sort((a, b) => b.count - a.count)
                     .slice(0, 7)
                     .map((entry) => {
                       const percent = totalCategorized
                         ? (Number(entry.count) / totalCategorized) * 100
                         : 0;
                       return `
                       <a href="#/documents?category=${encodeURIComponent(entry.id)}" class="block group">
                         <div class="flex items-center justify-between gap-3 mb-1.5">
                           <span class="flex items-center gap-2 min-w-0 text-sm text-ink">
                             <span class="dot dot-${esc(entry.color)}"></span>
                             <span class="truncate group-hover:text-accent transition-colors">${esc(entry.name)}</span>
                           </span>
                           <span class="text-xs text-ink-subtle tabular flex-none">
                             ${formatNumber(entry.count)} · ${esc(formatBytes(entry.size))}
                           </span>
                         </div>
                         <div class="progress h-1.5">
                           <div class="progress-bar" style="width:${percent}%;background-color:rgb(var(--c-${esc(
                         entry.color
                       )}))"></div>
                         </div>
                       </a>`;
                     })
                     .join('')}
                 </div>`
              : emptyState({
                  icon: 'layout-grid',
                  title: 'Pa të dhëna',
                  description: 'Caktoni kategori dokumenteve për të pasur këtë ndarje.'
                })
          }
        </section>

        <!-- Aktiviteti -->
        <section class="card overflow-hidden">
          <div class="card-head">
            <h3 class="text-sm font-semibold text-ink">Aktiviteti</h3>
            ${
              byMonth.length
                ? `<span class="text-2xs text-ink-subtle">6 muajt e fundit</span>`
                : ''
            }
          </div>

          ${
            byMonth.length
              ? `<div class="px-4 pt-4">
                   <div class="flex items-end gap-2 h-20">
                     ${byMonth
                       .map((month) => {
                         const height = Math.max(4, (Number(month.count) / maxMonth) * 100);
                         return `
                         <div class="flex-1 flex flex-col items-center gap-1.5" title="${esc(
                           formatMonthShort(month.month)
                         )}: ${formatNumber(month.count)}">
                           <span class="text-2xs text-ink-subtle tabular">${formatNumber(month.count)}</span>
                           <div class="w-full rounded-t bg-accent/75 hover:bg-accent transition-colors"
                                style="height:${height}%"></div>
                         </div>`;
                       })
                       .join('')}
                   </div>
                   <div class="flex gap-2 mt-2 pb-3 border-b border-line">
                     ${byMonth
                       .map(
                         (month) =>
                           `<span class="flex-1 text-center text-2xs text-ink-subtle">${esc(
                             formatMonthShort(month.month)
                           )}</span>`
                       )
                       .join('')}
                   </div>
                 </div>`
              : ''
          }

          ${
            activity.length
              ? `<div class="divide-y divide-line">
                   ${activity
                     .map((item) => {
                       const meta = ACTIONS[item.action] || { label: item.action, icon: 'activity' };
                       return `
                       <div class="flex items-center gap-3 px-4 py-2.5">
                         <span class="w-6 h-6 rounded bg-surface-inset border border-line
                                      flex items-center justify-center text-ink-subtle flex-none text-2xs">
                           ${icon(meta.icon)}
                         </span>
                         <p class="text-xs text-ink-muted truncate flex-1">
                           <span class="text-ink">${esc(meta.label)}</span> ${esc(item.label || 'dokument')}
                         </p>
                         <span class="text-2xs text-ink-subtle flex-none">${esc(relativeTime(item.created_at))}</span>
                       </div>`;
                     })
                     .join('')}
                 </div>`
              : emptyState({
                  icon: 'activity',
                  title: 'Pa aktivitet',
                  description: 'Veprimet mbi dokumentet shfaqen këtu.'
                })
          }
        </section>
      </div>
    </div>`;

  /* ---- Lidhjet ---- */
  const reload = async () => {
    await refreshAll();
    await renderDashboard(view);
  };

  view.querySelectorAll('[data-upload]').forEach((button) =>
    button.addEventListener('click', () => openUploadModal({ onDone: reload }))
  );

  const recentList = view.querySelector('#recent-list');
  if (recentList) wireDocumentList(recentList, recent, { onChange: reload });

  const expiringList = view.querySelector('#expiring-list');
  if (expiringList) wireDocumentList(expiringList, expiring, { onChange: reload });
}
