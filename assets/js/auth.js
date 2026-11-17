/**
 * DOKUMENT — Logjika e faqeve të autentikimit
 * -----------------------------------------------------------------------------
 * Një modul i vetëm që shërben katër faqet: login, register, forgot-password
 * dhe reset-password. Aktivizohet sipas formularit që ekziston në faqe.
 */

import { auth } from './api.js';
import { isConfigured } from './supabase.js';
import { icon } from './icons.js';
import { initTheme, cycleTheme, themeIcon, themeLabel, toastSuccess, toastError } from './ui.js';
import {
  $, esc, isEmail, passwordStrength, STRENGTH_LABELS, readUrlParams, translateError
} from './utils.js';

/* ============================================================== TEMA ====== */

function setupThemeToggle() {
  initTheme();
  const button = $('#theme-toggle');
  if (!button) return;
  const paint = () => {
    button.innerHTML = icon(themeIcon());
    button.title = `Tema: ${themeLabel()}`;
  };
  paint();
  button.addEventListener('click', () => {
    cycleTheme();
    paint();
  });
}

/* ========================================================= NDIHMËSA ====== */

function alertBox(message, type = 'error') {
  const tones = {
    error: 'bg-danger/5 border-danger/25 text-danger',
    success: 'bg-success/5 border-success/25 text-success',
    info: 'bg-accent/5 border-accent/25 text-accent'
  };
  const icons = { error: 'circle-alert', success: 'circle-check', info: 'info' };
  return `
    <div class="flex items-start gap-2.5 p-3 rounded-lg border text-sm leading-6 ${tones[type]}">
      <span class="mt-0.5 flex-none">${icon(icons[type])}</span>
      <div class="min-w-0">${message}</div>
    </div>`;
}

function showAlert(message, type = 'error') {
  const box = $('#form-alert');
  if (!box) return;
  box.innerHTML = alertBox(message, type);
  box.hidden = false;
  box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function hideAlert() {
  const box = $('#form-alert');
  if (box) box.hidden = true;
}

function setFieldError(name, message) {
  const field = document.getElementById(name);
  const target = document.querySelector(`[data-error-for="${name}"]`);
  if (field) field.classList.toggle('input-error', !!message);
  if (target) {
    target.textContent = message || '';
    target.hidden = !message;
  }
}

function clearFieldErrors(form) {
  form.querySelectorAll('[data-error-for]').forEach((node) => {
    node.hidden = true;
    node.textContent = '';
  });
  form.querySelectorAll('.input-error').forEach((node) => node.classList.remove('input-error'));
}

function setLoading(button, loading, label) {
  if (!button) return;
  if (loading) {
    button.dataset.label = button.textContent.trim();
    button.disabled = true;
    button.innerHTML = `${icon('loader-circle', 'w-4 h-4 animate-spin')}<span>${esc(label || 'Duke punuar…')}</span>`;
  } else {
    button.disabled = false;
    button.textContent = button.dataset.label || 'Vazhdo';
  }
}

function setupPasswordToggles() {
  document.querySelectorAll('[data-toggle-password]').forEach((button) => {
    const input = document.getElementById(button.dataset.togglePassword);
    if (!input) return;
    const paint = () => {
      button.innerHTML = icon(input.type === 'password' ? 'eye' : 'eye-off');
    };
    paint();
    button.addEventListener('click', () => {
      input.type = input.type === 'password' ? 'text' : 'password';
      paint();
      input.focus();
    });
  });
}

function setupStrengthMeter() {
  const wrap = $('#strength');
  const input = $('#password');
  if (!wrap || !input) return;

  const colors = ['bg-danger', 'bg-danger', 'bg-warning', 'bg-accent', 'bg-success'];
  input.addEventListener('input', () => {
    const value = input.value;
    wrap.hidden = value.length === 0;
    const score = passwordStrength(value);
    wrap.querySelectorAll('[data-bar]').forEach((bar, index) => {
      bar.className = `h-1 flex-1 rounded-full transition-colors ${
        index < score ? colors[score] : 'bg-surface-inset'
      }`;
    });
    const label = wrap.querySelector('[data-strength-label]');
    if (label) label.textContent = value ? STRENGTH_LABELS[score] : '';
  });
}

const FEATURES = [
  { icon: 'scan-line', text: 'Ngarkoni PDF-të, imazhet dhe skedarët Office' },
  { icon: 'folders', text: 'Organizoni me kategori, dosje dhe etiketa' },
  { icon: 'bell-ring', text: 'Njoftime para se dokumenti të skadojë' },
  { icon: 'shield-check', text: 'Hapësirë private, e izoluar sipas llogarisë' }
];

function renderFeatureList() {
  const list = $('#feature-list');
  if (!list) return;
  list.innerHTML = FEATURES.map(
    (item) => `
    <li class="flex items-start gap-3">
      <span class="w-6 h-6 rounded-md bg-surface-inset border border-line flex items-center justify-center
                   text-ink-muted flex-none mt-0.5 text-xs">${icon(item.icon)}</span>
      <span class="text-sm text-ink-muted leading-6">${esc(item.text)}</span>
    </li>`
  ).join('');
}

function renderPageIcon(name) {
  const node = $('#page-icon');
  if (node) node.innerHTML = icon(name, 'w-4 h-4');
}

/* ============================================= RIDREJTIMI KUR KA SESION === */

async function redirectIfSignedIn() {
  if (!isConfigured) return false;
  const session = await auth.getSession();
  if (session) {
    const params = readUrlParams();
    location.replace(params.next && params.next.startsWith('/') ? params.next : '/app.html');
    return true;
  }
  return false;
}

/* ============================================================== KYÇJA ===== */

function initLogin() {
  const form = $('#login-form');
  const button = $('#submit-btn');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideAlert();
    clearFieldErrors(form);

    const email = form.email.value.trim();
    const password = form.password.value;

    let valid = true;
    if (!email) { setFieldError('email', 'Shkruani email-in.'); valid = false; }
    else if (!isEmail(email)) { setFieldError('email', 'Email-i nuk është i vlefshëm.'); valid = false; }
    if (!password) { setFieldError('password', 'Shkruani fjalëkalimin.'); valid = false; }
    if (!valid) return;

    setLoading(button, true, 'Duke u kyçur…');
    try {
      await auth.signIn({ email, password });
      const params = readUrlParams();
      location.replace(params.next && params.next.startsWith('/') ? params.next : '/app.html');
    } catch (error) {
      const message = error.message || 'Kyçja dështoi.';
      if (/konfirmuar/i.test(message)) {
        showAlert(
          `${esc(message)} <button type="button" id="resend-confirm"
             class="underline font-medium ml-1">Ridërgo email-in</button>`,
          'error'
        );
        $('#resend-confirm')?.addEventListener('click', async (e) => {
          e.target.disabled = true;
          try {
            await auth.resendConfirmation(email);
            showAlert('Email-i i konfirmimit u ridërgua.', 'success');
          } catch (err) {
            showAlert(err.message, 'error');
          }
        });
      } else {
        showAlert(esc(message), 'error');
      }
      setLoading(button, false);
    }
  });
}

/* ======================================================== REGJISTRIMI ===== */

function initRegister() {
  const form = $('#register-form');
  const button = $('#submit-btn');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideAlert();
    clearFieldErrors(form);

    const fullName = form.full_name.value.trim();
    const email = form.email.value.trim();
    const password = form.password.value;
    const confirm = form.password_confirm.value;
    const terms = form.terms.checked;

    let valid = true;
    if (fullName.length < 2) { setFieldError('full_name', 'Shkruani emrin tuaj.'); valid = false; }
    if (!isEmail(email)) { setFieldError('email', 'Email-i nuk është i vlefshëm.'); valid = false; }
    if (password.length < 8) { setFieldError('password', 'Së paku 8 karaktere.'); valid = false; }
    if (password !== confirm) { setFieldError('password_confirm', 'Fjalëkalimet nuk përputhen.'); valid = false; }
    if (!terms) { setFieldError('terms', 'Duhet të pranoni kushtet.'); valid = false; }
    if (!valid) return;

    setLoading(button, true, 'Duke krijuar…');
    try {
      const result = await auth.signUp({ email, password, fullName });

      if (result.needsConfirmation) {
        form.hidden = true;
        showAlert(
          `<strong class="block mb-1">Konfirmoni email-in</strong>
           Dërguam një lidhje konfirmimi te <strong>${esc(email)}</strong>.
           Hapeni atë lidhje për të aktivizuar llogarinë.`,
          'success'
        );
        return;
      }
      location.replace('/app.html');
    } catch (error) {
      const message = error.message || 'Regjistrimi dështoi.';
      if (/regjistruar më parë/i.test(message)) {
        setFieldError('email', message);
        showAlert(
          `${esc(message)} <a href="/login.html" class="underline font-medium">Kyçu</a>`,
          'error'
        );
      } else {
        showAlert(esc(message), 'error');
      }
      setLoading(button, false);
    }
  });
}

/* ================================================= HARRIMI I FJALËKALIMIT = */

function initForgot() {
  const form = $('#forgot-form');
  const button = $('#submit-btn');
  renderPageIcon('key');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideAlert();
    clearFieldErrors(form);

    const email = form.email.value.trim();
    if (!isEmail(email)) {
      setFieldError('email', 'Email-i nuk është i vlefshëm.');
      return;
    }

    setLoading(button, true, 'Duke dërguar…');
    try {
      await auth.requestPasswordReset(email);
      form.hidden = true;
      showAlert(
        `<strong class="block mb-1">Kontrolloni email-in</strong>
         Nëse ekziston një llogari me <strong>${esc(email)}</strong>, lidhja për rivendosje është dërguar.
         Lidhja vlen për një kohë të kufizuar.`,
        'success'
      );
    } catch (error) {
      showAlert(esc(error.message || 'Dërgimi dështoi.'), 'error');
      setLoading(button, false);
    }
  });
}

/* ================================================== FJALËKALIMI I RI ====== */

async function initReset() {
  const form = $('#reset-form');
  const button = $('#submit-btn');
  renderPageIcon('lock-keyhole');

  // Supabase e shkëmben kodin e rikuperimit automatikisht (detectSessionInUrl).
  // Presim derisa sesioni i rikuperimit të bëhet i disponueshëm.
  const params = readUrlParams();
  if (params.error_description || params.error) {
    form.hidden = true;
    showAlert(
      `${esc(translateError({ message: params.error_description || params.error }))}
       <a href="/forgot-password.html" class="underline font-medium ml-1">Kërko lidhje të re</a>`,
      'error'
    );
    return;
  }

  let session = await auth.getSession();
  if (!session) {
    session = await new Promise((resolve) => {
      const timer = setTimeout(() => resolve(null), 3500);
      const unsubscribe = auth.onChange((event, current) => {
        if (current) {
          clearTimeout(timer);
          unsubscribe();
          resolve(current);
        }
      });
    });
  }

  if (!session) {
    form.hidden = true;
    showAlert(
      `Lidhja është e pavlefshme ose ka skaduar.
       <a href="/forgot-password.html" class="underline font-medium ml-1">Kërko lidhje të re</a>`,
      'error'
    );
    return;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideAlert();
    clearFieldErrors(form);

    const password = form.password.value;
    const confirm = form.password_confirm.value;

    let valid = true;
    if (password.length < 8) { setFieldError('password', 'Së paku 8 karaktere.'); valid = false; }
    if (password !== confirm) { setFieldError('password_confirm', 'Fjalëkalimet nuk përputhen.'); valid = false; }
    if (!valid) return;

    setLoading(button, true, 'Duke ruajtur…');
    try {
      await auth.updatePassword(password);
      toastSuccess('Fjalëkalimi u ndryshua.');
      form.hidden = true;
      showAlert(
        `<strong class="block mb-1">Fjalëkalimi u ndryshua</strong>
         Po ju ridrejtojmë te aplikacioni…`,
        'success'
      );
      setTimeout(() => location.replace('/app.html'), 1400);
    } catch (error) {
      showAlert(esc(error.message || 'Ndryshimi dështoi.'), 'error');
      toastError(error.message || 'Ndryshimi dështoi.');
      setLoading(button, false);
    }
  });
}

/* ============================================================== NISJA ===== */

(async function start() {
  setupThemeToggle();
  renderFeatureList();
  setupPasswordToggles();
  setupStrengthMeter();

  if (!isConfigured) {
    document.querySelectorAll('form').forEach((form) => {
      form.querySelectorAll('input, button').forEach((node) => (node.disabled = true));
    });
    return;
  }

  const isResetPage = !!$('#reset-form');
  if (!isResetPage && (await redirectIfSignedIn())) return;

  if ($('#login-form')) initLogin();
  else if ($('#register-form')) initRegister();
  else if ($('#forgot-form')) initForgot();
  else if (isResetPage) await initReset();
})();
