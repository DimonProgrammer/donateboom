/* ================================================================
   DonateBoom — Auth System
   localStorage key: 'db_auth'
   Screens: 1=login, 2=register, 3=forgot, 4=otp, 5=new-password
================================================================= */

(function () {
  'use strict';

  /* ---------- State ---------- */
  var _auth = null;
  var _step = 1;
  var _forgotEmail = '';
  var _otpTimer = null;

  /* ---------- Init ---------- */
  // Pages that require auth — redirect to index + open modal if not logged in
  var PROTECTED_PAGES = ['profile.html', 'checkout.html'];

  function init() {
    _auth = loadAuth();
    injectModal();
    updateNavButton();

    // Auth guard for protected pages
    var page = location.pathname.split('/').pop() || 'index.html';
    if (PROTECTED_PAGES.indexOf(page) !== -1 && !_auth) {
      location.href = 'index.html?auth=1';
      return;
    }

    // Open modal if URL has ?auth=1
    if (location.search.indexOf('auth=1') !== -1) openAuthModal();
  }

  /* ---------- XSS helper ---------- */
  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ---------- Storage ---------- */
  function loadAuth() {
    try { return JSON.parse(localStorage.getItem('db_auth')); } catch(e) { return null; }
  }

  function saveAuth(data) {
    _auth = data;
    localStorage.setItem('db_auth', JSON.stringify(data));
  }

  function clearAuth() {
    _auth = null;
    localStorage.removeItem('db_auth');
  }

  /* ---------- Nav button update ---------- */
  function updateNavButton() {
    var btn = document.getElementById('authNavBtn');
    if (!btn) return;
    var wrapper = btn.parentElement; // position:relative wrapper

    if (_auth) {
      var safeName = esc(_auth.name || 'Профиль');
      var initials = esc((_auth.name || 'П').charAt(0).toUpperCase());
      btn.innerHTML =
        '<span style="width:30px;height:30px;border-radius:50%;background:var(--lime);display:inline-flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;color:#fff;flex-shrink:0">' + initials + '</span>' +
        '<span style="max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + safeName + '</span>' +
        '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
      btn.style.gap = '8px';
      btn.onclick = function(e) { e.stopPropagation(); toggleUserDropdown(); };
      // Ensure dropdown lives inside the wrapper
      if (!document.getElementById('userDropdown') && wrapper) {
        injectUserDropdown(wrapper);
      }
    } else {
      btn.innerHTML = 'Личный кабинет';
      btn.style.gap = '';
      btn.onclick = function(e) { e.stopPropagation(); openAuthModal(); };
    }
  }

  function injectUserDropdown(parent) {
    var dd = document.createElement('div');
    dd.id = 'userDropdown';
    dd.className = 'user-dropdown';
    dd.innerHTML = [
      '<a href="profile.html" class="user-dd-item">',
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
      'Профиль',
      '</a>',
      '<button class="user-dd-item danger" onclick="logout()">',
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
      'Выйти',
      '</button>'
    ].join('');
    parent.appendChild(dd);
  }

  /* ---------- User dropdown ---------- */
  function toggleUserDropdown() {
    var dd = document.getElementById('userDropdown');
    if (!dd) return;
    dd.classList.toggle('open');
    document.addEventListener('click', closeUserDropdownOutside, { once: true });
  }

  function closeUserDropdownOutside() {
    var dd = document.getElementById('userDropdown');
    if (dd) dd.classList.remove('open');
  }

  /* ---------- Modal open/close ---------- */
  function openAuthModal(step) {
    var overlay = document.getElementById('authModal');
    if (!overlay) return;
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    goToStep(step || 1);
  }

  function closeAuthModal() {
    var overlay = document.getElementById('authModal');
    if (!overlay) return;
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    clearOtpTimer();
  }

  /* ---------- Step navigation ---------- */
  function goToStep(n) {
    _step = n;
    [1,2,3,4,5].forEach(function(i) {
      var s = document.getElementById('auth-step-' + i);
      if (s) s.style.display = (i === n) ? '' : 'none';
    });
    var titles = ['', 'Вход в аккаунт', 'Регистрация', 'Восстановление пароля', 'Введите код', 'Новый пароль'];
    var titleEl = document.getElementById('authModalTitle');
    if (titleEl) titleEl.textContent = titles[n] || '';

    if (n === 4) startOtpTimer();
  }

  /* ---------- OTP timer ---------- */
  function startOtpTimer() {
    clearOtpTimer();
    var sec = 59;
    var el = document.getElementById('otp-resend-timer');
    if (!el) return;
    el.innerHTML = 'Отправить снова через <b>' + sec + 'с</b>';
    _otpTimer = setInterval(function() {
      sec--;
      if (sec <= 0) {
        clearOtpTimer();
        el.innerHTML = '<button class="auth-link" onclick="authResendOtp()">Отправить снова</button>';
      } else {
        el.innerHTML = 'Отправить снова через <b>' + sec + 'с</b>';
      }
    }, 1000);
  }

  function clearOtpTimer() {
    if (_otpTimer) { clearInterval(_otpTimer); _otpTimer = null; }
  }

  /* ---------- Simulate actions ---------- */
  function simulateLogin(data) {
    saveAuth(data);
    closeAuthModal();
    updateNavButton();
    // Redirect to profile if on auth-only page
    if (location.pathname.indexOf('profile') !== -1) location.reload();
  }

  function logout() {
    clearAuth();
    updateNavButton();
    var dd = document.getElementById('userDropdown');
    if (dd) dd.classList.remove('open');
    if (location.pathname.indexOf('profile') !== -1) location.href = 'index.html';
  }

  /* ---------- Form handlers ---------- */
  function handleLogin(e) {
    e.preventDefault();
    var email = document.getElementById('login-email').value.trim();
    var pass = document.getElementById('login-pass').value;
    if (!email || !pass) { showError('login-error', 'Заполните все поля'); return; }
    simulateLogin({ email: email, name: email.split('@')[0], via: 'email' });
  }

  function handleRegister(e) {
    e.preventDefault();
    var email = document.getElementById('reg-email').value.trim();
    var pass = document.getElementById('reg-pass').value;
    var pass2 = document.getElementById('reg-pass2').value;
    var agree = document.getElementById('reg-agree').checked;
    if (!email || !pass || !pass2) { showError('reg-error', 'Заполните все поля'); return; }
    if (pass !== pass2) { showError('reg-error', 'Пароли не совпадают'); return; }
    if (!agree) { showError('reg-error', 'Примите условия оферты'); return; }
    simulateLogin({ email: email, name: email.split('@')[0], via: 'email' });
  }

  function handleForgot(e) {
    e.preventDefault();
    var email = document.getElementById('forgot-email').value.trim();
    if (!email) { showError('forgot-error', 'Введите email'); return; }
    _forgotEmail = email;
    goToStep(4);
  }

  function handleOtp(e) {
    e.preventDefault();
    var code = '';
    document.querySelectorAll('.otp-input').forEach(function(inp) { code += inp.value; });
    if (code.length < 6) { showError('otp-error', 'Введите все 6 цифр'); return; }
    goToStep(5);
  }

  function handleNewPass(e) {
    e.preventDefault();
    var pass = document.getElementById('newpass-pass').value;
    var pass2 = document.getElementById('newpass-pass2').value;
    if (pass.length < 8) { showError('newpass-error', 'Минимум 8 символов'); return; }
    if (pass !== pass2) { showError('newpass-error', 'Пароли не совпадают'); return; }
    simulateLogin({ email: _forgotEmail, name: _forgotEmail.split('@')[0], via: 'email' });
  }

  function handleSocial(via) {
    var name = via === 'telegram' ? 'Telegram User' : 'VK User';
    simulateLogin({ email: via + '@social.db', name: name, via: via });
  }

  /* ---------- Password strength ---------- */
  function checkPassStrength(val) {
    var reqs = [
      { id: 'req-len', ok: val.length >= 8 },
      { id: 'req-upper', ok: /[A-ZА-Я]/.test(val) },
      { id: 'req-digit', ok: /[0-9]/.test(val) }
    ];
    reqs.forEach(function(r) {
      var el = document.getElementById(r.id);
      if (!el) return;
      el.className = 'pass-req ' + (r.ok ? 'ok' : '');
    });
  }

  /* ---------- OTP input auto-advance ---------- */
  function initOtpInputs() {
    var inputs = document.querySelectorAll('.otp-input');
    inputs.forEach(function(inp, i) {
      inp.addEventListener('input', function() {
        inp.value = inp.value.replace(/\D/g,'').slice(-1);
        if (inp.value && i < inputs.length - 1) inputs[i+1].focus();
      });
      inp.addEventListener('keydown', function(e) {
        if (e.key === 'Backspace' && !inp.value && i > 0) inputs[i-1].focus();
      });
    });
  }

  function authResendOtp() {
    startOtpTimer();
    document.querySelectorAll('.otp-input').forEach(function(i){ i.value=''; });
    var first = document.querySelector('.otp-input');
    if (first) first.focus();
  }

  /* ---------- Error display ---------- */
  function showError(id, msg) {
    var el = document.getElementById(id);
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
    setTimeout(function(){ el.style.display = 'none'; }, 3500);
  }

  /* ---------- Modal HTML injection ---------- */
  function injectModal() {
    if (document.getElementById('authModal')) return;

    var html = [
      '<div id="authModal" class="auth-overlay" onclick="closeAuthModal()">',
      '<div class="auth-box" onclick="event.stopPropagation()">',

      '<!-- Close -->',
      '<button class="auth-close" onclick="closeAuthModal()">',
      '<svg width="18" height="18" viewBox="0 0 18 18" fill="none">',
      '<path d="M14 4L4 14M4 4L14 14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
      '</svg></button>',

      '<div id="authModalTitle" class="auth-title">Вход в аккаунт</div>',

      /* ── Step 1: Login ── */
      '<div id="auth-step-1">',
      '<div class="auth-social-row">',
      '<button class="auth-social-btn tg" onclick="handleSocial(\'telegram\')">',
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.12 14.051l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.838.508z"/></svg>',
      'Войти через Telegram',
      '</button>',
      '<button class="auth-social-btn vk" onclick="handleSocial(\'vk\')">',
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M15.684 0H8.316C1.592 0 0 1.592 0 8.316v7.368C0 22.408 1.592 24 8.316 24h7.368C22.408 24 24 22.408 24 15.684V8.316C24 1.592 22.408 0 15.684 0zm3.692 17.123h-1.744c-.66 0-.862-.523-2.049-1.714-1.033-1-1.49-.574-1.49.387v1.327c0 .306-.096.387-1.123.387C10.3 17.51 8.3 16.2 6.974 13.917c-1.627-2.715-2.082-4.774-2.082-5.185 0-.248.096-.48.578-.48h1.744c.432 0 .594.192.76.64.836 2.408 2.238 4.525 2.815 4.525.217 0 .314-.1.314-.644V10.29c-.069-1.156-.676-1.254-.676-1.664 0-.192.157-.387.407-.387h2.745c.365 0 .49.192.49.614v3.302c0 .368.162.492.263.492.217 0 .398-.124.794-.52 1.227-1.372 2.101-3.484 2.101-3.484.115-.248.327-.48.756-.48h1.744c.528 0 .64.271.528.64-.219.9-2.36 4.033-2.36 4.033-.186.306-.252.443 0 .782.186.252.793.774 1.197 1.24.744.852 1.312 1.566 1.466 2.059.148.487-.1.735-.576.735z"/></svg>',
      'Войти через ВКонтакте',
      '</button>',
      '</div>',
      '<div class="auth-divider"><span>или</span></div>',
      '<form id="loginForm" onsubmit="handleLogin(event)">',
      '<div id="login-error" class="auth-error" style="display:none"></div>',
      '<div class="auth-field"><label>Email</label>',
      '<input id="login-email" type="email" placeholder="your@email.ru" autocomplete="email"></div>',
      '<div class="auth-field"><label>Пароль</label>',
      '<input id="login-pass" type="password" placeholder="••••••••" autocomplete="current-password"></div>',
      '<label class="auth-check"><input type="checkbox" id="login-remember"><span>Запомнить меня</span></label>',
      '<button type="submit" class="auth-btn-primary">Войти</button>',
      '</form>',
      '<div class="auth-footer-links">',
      '<button class="auth-link" onclick="goToStep(2)">Нет аккаунта? Регистрация</button>',
      '<button class="auth-link" onclick="goToStep(3)">Забыли пароль?</button>',
      '</div>',
      '</div>',

      /* ── Step 2: Register ── */
      '<div id="auth-step-2" style="display:none">',
      '<div class="auth-social-row">',
      '<button class="auth-social-btn tg" onclick="handleSocial(\'telegram\')">',
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.12 14.051l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.838.508z"/></svg>',
      'Зарегистрироваться через Telegram',
      '</button>',
      '<button class="auth-social-btn vk" onclick="handleSocial(\'vk\')">',
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M15.684 0H8.316C1.592 0 0 1.592 0 8.316v7.368C0 22.408 1.592 24 8.316 24h7.368C22.408 24 24 22.408 24 15.684V8.316C24 1.592 22.408 0 15.684 0zm3.692 17.123h-1.744c-.66 0-.862-.523-2.049-1.714-1.033-1-1.49-.574-1.49.387v1.327c0 .306-.096.387-1.123.387C10.3 17.51 8.3 16.2 6.974 13.917c-1.627-2.715-2.082-4.774-2.082-5.185 0-.248.096-.48.578-.48h1.744c.432 0 .594.192.76.64.836 2.408 2.238 4.525 2.815 4.525.217 0 .314-.1.314-.644V10.29c-.069-1.156-.676-1.254-.676-1.664 0-.192.157-.387.407-.387h2.745c.365 0 .49.192.49.614v3.302c0 .368.162.492.263.492.217 0 .398-.124.794-.52 1.227-1.372 2.101-3.484 2.101-3.484.115-.248.327-.48.756-.48h1.744c.528 0 .64.271.528.64-.219.9-2.36 4.033-2.36 4.033-.186.306-.252.443 0 .782.186.252.793.774 1.197 1.24.744.852 1.312 1.566 1.466 2.059.148.487-.1.735-.576.735z"/></svg>',
      'Зарегистрироваться через VK',
      '</button>',
      '</div>',
      '<div class="auth-divider"><span>или</span></div>',
      '<form id="regForm" onsubmit="handleRegister(event)">',
      '<div id="reg-error" class="auth-error" style="display:none"></div>',
      '<div class="auth-field"><label>Email</label>',
      '<input id="reg-email" type="email" placeholder="your@email.ru" autocomplete="email"></div>',
      '<div class="auth-field"><label>Пароль</label>',
      '<input id="reg-pass" type="password" placeholder="••••••••" autocomplete="new-password" oninput="checkPassStrength(this.value)"></div>',
      '<div class="auth-field"><label>Повторите пароль</label>',
      '<input id="reg-pass2" type="password" placeholder="••••••••" autocomplete="new-password"></div>',
      '<label class="auth-check"><input type="checkbox" id="reg-agree">',
      '<span>Согласен с <a href="legal.html" target="_blank" class="auth-link-inline">условиями оферты</a></span></label>',
      '<button type="submit" class="auth-btn-primary">Создать аккаунт</button>',
      '</form>',
      '<div class="auth-footer-links">',
      '<button class="auth-link" onclick="goToStep(1)">Уже есть аккаунт? Войти</button>',
      '</div>',
      '</div>',

      /* ── Step 3: Forgot ── */
      '<div id="auth-step-3" style="display:none">',
      '<p style="color:var(--t3);font-size:14px;margin-bottom:20px;">Введите email — вышлем код для сброса пароля.</p>',
      '<form id="forgotForm" onsubmit="handleForgot(event)">',
      '<div id="forgot-error" class="auth-error" style="display:none"></div>',
      '<div class="auth-field"><label>Email</label>',
      '<input id="forgot-email" type="email" placeholder="your@email.ru" autocomplete="email"></div>',
      '<button type="submit" class="auth-btn-primary">Отправить код</button>',
      '</form>',
      '<div class="auth-footer-links">',
      '<button class="auth-link" onclick="goToStep(1)">&#8592; Назад</button>',
      '</div>',
      '</div>',

      /* ── Step 4: OTP ── */
      '<div id="auth-step-4" style="display:none">',
      '<p style="color:var(--t3);font-size:14px;margin-bottom:20px;">Код отправлен на ваш email. Введите 6 цифр:</p>',
      '<form id="otpForm" onsubmit="handleOtp(event)">',
      '<div id="otp-error" class="auth-error" style="display:none"></div>',
      '<div class="otp-row">',
      '<input class="otp-input" type="text" maxlength="1" inputmode="numeric">',
      '<input class="otp-input" type="text" maxlength="1" inputmode="numeric">',
      '<input class="otp-input" type="text" maxlength="1" inputmode="numeric">',
      '<input class="otp-input" type="text" maxlength="1" inputmode="numeric">',
      '<input class="otp-input" type="text" maxlength="1" inputmode="numeric">',
      '<input class="otp-input" type="text" maxlength="1" inputmode="numeric">',
      '</div>',
      '<div id="otp-resend-timer" style="text-align:center;font-size:13px;color:var(--t3);margin-bottom:20px;"></div>',
      '<button type="submit" class="auth-btn-primary">Подтвердить</button>',
      '</form>',
      '<div class="auth-footer-links">',
      '<button class="auth-link" onclick="goToStep(3)">&#8592; Назад</button>',
      '</div>',
      '</div>',

      /* ── Step 5: New password ── */
      '<div id="auth-step-5" style="display:none">',
      '<form id="newpassForm" onsubmit="handleNewPass(event)">',
      '<div id="newpass-error" class="auth-error" style="display:none"></div>',
      '<div class="auth-field"><label>Новый пароль</label>',
      '<input id="newpass-pass" type="password" placeholder="••••••••" oninput="checkPassStrength(this.value)" autocomplete="new-password"></div>',
      '<div class="auth-field"><label>Повторите пароль</label>',
      '<input id="newpass-pass2" type="password" placeholder="••••••••" autocomplete="new-password"></div>',
      '<div class="pass-reqs">',
      '<div id="req-len" class="pass-req">Минимум 8 символов</div>',
      '<div id="req-upper" class="pass-req">Одна заглавная буква</div>',
      '<div id="req-digit" class="pass-req">Одна цифра</div>',
      '</div>',
      '<button type="submit" class="auth-btn-primary">Сохранить</button>',
      '</form>',
      '</div>',

      '</div>', // auth-box
      '</div>', // auth-overlay

      /* ── Styles ── */
      '<style>',
      '.auth-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.7);backdrop-filter:blur(6px);z-index:9000;display:none;align-items:center;justify-content:center;padding:16px}',
      '.auth-overlay.open{display:flex}',
      '.auth-box{background:var(--s1);border:1px solid var(--border);border-radius:20px;padding:32px;width:100%;max-width:400px;position:relative;max-height:90vh;overflow-y:auto}',
      '.auth-title{font-family:var(--d);font-weight:900;font-size:1.4rem;letter-spacing:-0.03em;margin-bottom:24px;color:var(--w)}',
      '.auth-close{position:absolute;top:16px;right:16px;background:var(--s2);border:none;border-radius:8px;width:32px;height:32px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--t3);transition:color .2s}',
      '.auth-close:hover{color:var(--w)}',
      '.auth-social-row{display:flex;flex-direction:column;gap:10px;margin-bottom:20px}',
      '.auth-social-btn{display:flex;align-items:center;justify-content:center;gap:10px;padding:13px;border-radius:12px;border:none;cursor:pointer;font-family:var(--b);font-size:14px;font-weight:600;transition:opacity .2s}',
      '.auth-social-btn:hover{opacity:.85}',
      '.auth-social-btn.tg{background:#229ED9;color:#fff}',
      '.auth-social-btn.vk{background:#0077FF;color:#fff}',
      '.auth-divider{display:flex;align-items:center;gap:12px;margin-bottom:20px}',
      '.auth-divider::before,.auth-divider::after{content:"";flex:1;height:1px;background:var(--border)}',
      '.auth-divider span{font-size:12px;color:var(--t3)}',
      '.auth-field{margin-bottom:16px}',
      '.auth-field label{display:block;font-size:12px;font-weight:600;color:var(--t3);margin-bottom:6px;letter-spacing:0.04em}',
      '.auth-field input{width:100%;background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:11px 14px;font-size:14px;font-family:var(--b);color:var(--w);outline:none;transition:border-color .2s;box-sizing:border-box}',
      '.auth-field input:focus{border-color:rgba(255,255,255,0.25)}',
      '.auth-field input::placeholder{color:var(--t4,var(--t3))}',
      '.auth-check{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--t3);margin-bottom:20px;cursor:pointer}',
      '.auth-check input[type=checkbox]{width:16px;height:16px;accent-color:var(--lime);flex-shrink:0}',
      '.auth-btn-primary{width:100%;background:var(--lime);color:#fff;border:none;border-radius:12px;padding:14px;font-family:var(--b);font-size:15px;font-weight:700;cursor:pointer;transition:opacity .2s;margin-bottom:16px}',
      '.auth-btn-primary:hover{opacity:.88}',
      '.auth-footer-links{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap}',
      '.auth-link{background:none;border:none;color:var(--t3);font-size:13px;cursor:pointer;font-family:var(--b);padding:0;transition:color .2s}',
      '.auth-link:hover{color:var(--w)}',
      '.auth-link-inline{color:var(--lime);text-decoration:none}',
      '.auth-error{background:rgba(234,58,59,0.12);color:#EA3A3B;border-radius:8px;padding:10px 14px;font-size:13px;margin-bottom:16px}',
      '.otp-row{display:flex;gap:8px;justify-content:center;margin-bottom:16px}',
      '.otp-input{width:44px;height:52px;background:var(--bg);border:1px solid var(--border);border-radius:10px;text-align:center;font-size:22px;font-weight:700;font-family:var(--m,monospace);color:var(--w);outline:none;transition:border-color .2s}',
      '.otp-input:focus{border-color:rgba(255,255,255,0.3)}',
      '.pass-reqs{margin-bottom:20px;display:flex;flex-direction:column;gap:6px}',
      '.pass-req{font-size:12px;color:var(--t3);padding-left:18px;position:relative}',
      '.pass-req::before{content:"○";position:absolute;left:0;color:var(--t3)}',
      '.pass-req.ok{color:var(--mint,#7ae8a0)}',
      '.pass-req.ok::before{content:"✓";color:var(--mint,#7ae8a0)}',
      /* User dropdown */
      '.user-dropdown{position:absolute;top:calc(100% + 8px);right:0;background:var(--s1);border:1px solid var(--border);border-radius:12px;padding:6px;min-width:160px;opacity:0;transform:translateY(-6px);pointer-events:none;transition:opacity .18s,transform .18s;z-index:201}',
      '.user-dropdown.open{opacity:1;transform:translateY(0);pointer-events:auto}',
      '.user-dd-item{display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:8px;font-size:14px;font-weight:500;color:var(--t2);cursor:pointer;background:none;border:none;width:100%;text-decoration:none;font-family:var(--b);transition:background .15s,color .15s}',
      '.user-dd-item:hover{background:var(--s2);color:var(--w)}',
      '.user-dd-item.danger:hover{color:#EA3A3B;background:rgba(234,58,59,0.08)}',
      '</style>'
    ].join('\n');

    var div = document.createElement('div');
    div.innerHTML = html;
    document.body.appendChild(div);

    // Init OTP inputs after injection
    setTimeout(initOtpInputs, 100);

    // Close on Escape
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') closeAuthModal();
    });
  }

  /* ---------- Expose globals ---------- */
  window.openAuthModal = openAuthModal;
  window.closeAuthModal = closeAuthModal;
  window.goToStep = goToStep;
  window.handleLogin = handleLogin;
  window.handleRegister = handleRegister;
  window.handleForgot = handleForgot;
  window.handleOtp = handleOtp;
  window.handleNewPass = handleNewPass;
  window.handleSocial = handleSocial;
  window.checkPassStrength = checkPassStrength;
  window.logout = logout;
  window.authResendOtp = authResendOtp;

  /* ---------- Run ---------- */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
