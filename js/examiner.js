/* ── Session ── */
const examSess = {
  set(data) { sessionStorage.setItem('_tp_exam', JSON.stringify(data)); },
  get()     { try { return JSON.parse(sessionStorage.getItem('_tp_exam')); } catch { return null; } },
  clear()   { sessionStorage.removeItem('_tp_exam'); }
};

/* ── State ── */
let examCurrentView = 'tests';
let examEditingTest = null;
let examEditingQIdx = null;
let _examTests = [];
let _examSubs  = [];

/* ── Boot ── */
document.addEventListener('DOMContentLoaded', async () => {

  /* Wire up all event handlers first so elements are ready regardless of which screen shows */
  qs('#loginBtn').onclick    = handleLogin;
  qs('#registerBtn').onclick = handleRegister;

  qs('#examLogoutBtn').onclick = () => { examSess.clear(); location.reload(); };

  qs('#examAddQBtn').onclick      = () => openExamQModal(null);
  qs('#examSaveTestBtn').onclick  = saveExamTest;

  qs('#examQModalCancel').onclick  = closeExamQModal;
  qs('#examQModalClose').onclick   = closeExamQModal;
  qs('#examQModalOverlay').onclick = e => { if (e.target === qs('#examQModalOverlay')) closeExamQModal(); };
  qs('#examSaveQBtn').onclick      = saveExamQuestion;

  qs('#examSubDetailClose').onclick   = () => { qs('#examSubDetailOverlay').style.display = 'none'; };
  qs('#examSubDetailOverlay').onclick = e => { if (e.target === qs('#examSubDetailOverlay')) qs('#examSubDetailOverlay').style.display = 'none'; };

  qs('#examExportCsvBtn').onclick  = exportExamCsv;
  qs('#examResultFilter').onchange = renderExamResults;

  qs('#examEditorAllowedEmails').oninput = examUpdateEmailCount;
  qs('#examEditorRequireOTP').onchange   = examCheckOtpWarning;

  /* Sidebar nav — only items with data-view get the nav handler; logout is wired above */
  qsa('.admin-nav-item[data-view]').forEach(el => {
    el.onclick = () => examNav(el.dataset.view);
  });

  /* Session check */
  const sess = examSess.get();
  if (sess && sess.id) {
    try {
      const examiner = await DB.getExaminerByEmail(sess.email);
      if (examiner) {
        if (examiner.status === 'approved') {
          examSess.set({ id: examiner.id, name: examiner.name, email: examiner.email });
          showExamApp();
        } else {
          showPending(examiner.status);
        }
      } else {
        examSess.clear();
        showAuth();
      }
    } catch (e) {
      examSess.clear();
      showAuth();
    }
  } else {
    showAuth();
  }
});

/* ════════════════════════════════════════════
   AUTH / SCREEN VISIBILITY
════════════════════════════════════════════ */

function showAuth() {
  qs('#authScreen').style.display    = '';
  qs('#pendingScreen').style.display = 'none';
  qs('#appScreen').style.display     = 'none';
  initO365();
}

function showPending(status) {
  qs('#authScreen').style.display    = 'none';
  qs('#pendingScreen').style.display = '';
  qs('#appScreen').style.display     = 'none';
  const msg = qs('#pendingMessage');
  if (status === 'rejected') {
    msg.className   = 'alert alert-danger';
    msg.textContent = 'Your account request has been rejected. Please contact the administrator for more information.';
  } else {
    msg.className   = 'alert alert-warning';
    msg.textContent = 'Your account is pending approval from the administrator. You will be notified once approved.';
  }
}

function showExamApp() {
  qs('#authScreen').style.display    = 'none';
  qs('#pendingScreen').style.display = 'none';
  qs('#appScreen').style.display     = '';
  DRIVE.init();
  examNav('tests');
}

/* ── Tab switcher ── */
function switchAuthTab(tab) {
  const loginTab = qs('#tabLogin');
  const regTab   = qs('#tabRegister');
  const loginBtn = qs('#tabLoginBtn');
  const regBtn   = qs('#tabRegBtn');
  qs('#authError').style.display = 'none';

  if (tab === 'login') {
    loginTab.style.display          = '';
    regTab.style.display            = 'none';
    loginBtn.style.borderBottomColor = 'var(--primary)';
    loginBtn.style.fontWeight        = '600';
    regBtn.style.borderBottomColor   = 'transparent';
    regBtn.style.fontWeight          = '400';
  } else {
    loginTab.style.display          = 'none';
    regTab.style.display            = '';
    loginBtn.style.borderBottomColor = 'transparent';
    loginBtn.style.fontWeight        = '400';
    regBtn.style.borderBottomColor   = 'var(--primary)';
    regBtn.style.fontWeight          = '600';
  }
}

/* ════════════════════════════════════════════
   LOGIN
════════════════════════════════════════════ */

async function handleLogin() {
  const email = qs('#loginEmail').value.trim().toLowerCase();
  const pw    = qs('#loginPw').value;
  const err   = qs('#authError');
  const btn   = qs('#loginBtn');

  err.style.display = 'none';
  if (!email || !pw) {
    err.textContent   = 'Email and password are required.';
    err.style.display = 'block';
    return;
  }

  btn.disabled    = true;
  btn.textContent = 'Logging in…';

  try {
    const examiner = await DB.getExaminerByEmail(email);
    if (!examiner) {
      err.textContent   = 'No account found with that email address.';
      err.style.display = 'block';
      btn.disabled      = false;
      btn.textContent   = 'Login';
      return;
    }

    if (examiner.password !== DB._hash(pw)) {
      err.textContent   = 'Incorrect password.';
      err.style.display = 'block';
      btn.disabled      = false;
      btn.textContent   = 'Login';
      return;
    }

    if (examiner.status === 'approved') {
      examSess.set({ id: examiner.id, name: examiner.name, email: examiner.email });
      showExamApp();
    } else {
      showPending(examiner.status);
    }
  } catch (e) {
    err.textContent   = 'Login failed: ' + e.message;
    err.style.display = 'block';
    btn.disabled      = false;
    btn.textContent   = 'Login';
  }
}

/* ════════════════════════════════════════════
   O365 / MICROSOFT LOGIN
════════════════════════════════════════════ */

let _o365Config = null;

async function initO365() {
  _o365Config = await DB.getO365Config();
  if (_o365Config && _o365Config.clientId) {
    qs('#msLoginSection').style.display = '';
  }
}

function loadMsal() {
  return new Promise((resolve, reject) => {
    if (window.msal) { resolve(); return; }
    const urls = [
      'https://cdn.jsdelivr.net/npm/@azure/msal-browser@2.38.3/lib/msal-browser.min.js',
      'https://unpkg.com/@azure/msal-browser@2.38.3/lib/msal-browser.min.js',
      'https://alcdn.msauth.net/browser/2.38.3/js/msal-browser.min.js'
    ];
    let idx = 0;
    function tryNext() {
      if (idx >= urls.length) { reject(new Error('Could not load Microsoft sign-in library. Check your network and try again.')); return; }
      const s = document.createElement('script');
      s.src = urls[idx++];
      s.onload  = resolve;
      s.onerror = tryNext;
      document.head.appendChild(s);
    }
    tryNext();
  });
}

qs('#msLoginBtn').addEventListener('click', async () => {
  const btn = qs('#msLoginBtn');
  const err = qs('#authError');
  err.style.display = 'none';

  if (!_o365Config || !_o365Config.clientId) {
    err.textContent = 'O365 sign-in is not configured.';
    err.style.display = 'block';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Opening Microsoft login…';

  try {
    await loadMsal();

    const msalApp = new msal.PublicClientApplication({
      auth: {
        clientId:    _o365Config.clientId,
        authority:   `https://login.microsoftonline.com/${_o365Config.tenantId || 'common'}`,
        redirectUri: window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '/'),
      },
      cache: { cacheLocation: 'sessionStorage', storeAuthStateInCookie: false }
    });

    await msalApp.initialize();

    const result = await msalApp.loginPopup({
      scopes: ['openid', 'profile', 'email'],
      prompt: 'select_account'
    });

    const email  = (result.account.username || '').toLowerCase();
    const domain = email.split('@')[1] || '';

    if (domain !== (_o365Config.domain || '').toLowerCase()) {
      err.textContent   = `O365 sign-in is only available for @${_o365Config.domain} accounts.`;
      err.style.display = 'block';
      btn.disabled = false;
      btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 21 21" fill="none"><rect x="1" y="1" width="9" height="9" fill="#F25022"/><rect x="11" y="1" width="9" height="9" fill="#7FBA00"/><rect x="1" y="11" width="9" height="9" fill="#00A4EF"/><rect x="11" y="11" width="9" height="9" fill="#FFB900"/></svg> Sign in with Microsoft';
      return;
    }

    const name = result.account.name || email.split('@')[0];
    let examiner = await DB.getExaminerByEmail(email);

    if (!examiner) {
      examiner = {
        id:        uid(),
        name,
        email,
        password:  '',
        status:    'approved',
        authType:  'o365',
        createdAt: new Date().toISOString()
      };
      await DB.upsertExaminer(examiner);
    } else if (examiner.status !== 'approved') {
      examiner.status   = 'approved';
      examiner.authType = 'o365';
      await DB.upsertExaminer(examiner);
    }

    examSess.set({ id: examiner.id, name: examiner.name, email: examiner.email });
    showExamApp();

  } catch (e) {
    if (e.errorCode !== 'user_cancelled') {
      err.textContent   = 'Microsoft sign-in failed: ' + (e.message || e.errorCode || e);
      err.style.display = 'block';
    }
    btn.disabled = false;
    btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 21 21" fill="none"><rect x="1" y="1" width="9" height="9" fill="#F25022"/><rect x="11" y="1" width="9" height="9" fill="#7FBA00"/><rect x="1" y="11" width="9" height="9" fill="#00A4EF"/><rect x="11" y="11" width="9" height="9" fill="#FFB900"/></svg> Sign in with Microsoft';
  }
});

/* ════════════════════════════════════════════
   REGISTER
════════════════════════════════════════════ */

async function handleRegister() {
  const name  = qs('#regName').value.trim();
  const email = qs('#regEmail').value.trim().toLowerCase();
  const pw    = qs('#regPw').value;
  const pw2   = qs('#regPw2').value;
  const err   = qs('#authError');
  const btn   = qs('#registerBtn');

  err.style.display = 'none';

  if (!name)          { err.textContent = 'Full name is required.';                   err.style.display = 'block'; return; }
  if (!email)         { err.textContent = 'Email is required.';                       err.style.display = 'block'; return; }
  if (pw.length < 4)  { err.textContent = 'Password must be at least 4 characters.'; err.style.display = 'block'; return; }
  if (pw !== pw2)     { err.textContent = 'Passwords do not match.';                  err.style.display = 'block'; return; }

  btn.disabled    = true;
  btn.textContent = 'Creating account…';

  try {
    const allowedDomains = await DB.getExaminerDomains();
    if (!allowedDomains.length) {
      err.textContent   = 'Registration is currently not available. Contact the administrator.';
      err.style.display = 'block';
      btn.disabled      = false;
      btn.textContent   = 'Create Account';
      return;
    }
    const emailDomain = email.split('@')[1] || '';
    if (!allowedDomains.includes(emailDomain)) {
      err.textContent   = `Registration is restricted. Your email domain (@${emailDomain}) is not allowed.`;
      err.style.display = 'block';
      btn.disabled      = false;
      btn.textContent   = 'Create Account';
      return;
    }

    const existing = await DB.getExaminerByEmail(email);
    if (existing) {
      err.textContent   = 'An account with that email address already exists.';
      err.style.display = 'block';
      btn.disabled      = false;
      btn.textContent   = 'Create Account';
      return;
    }

    const examiner = {
      id:        uid(),
      name,
      email,
      password:  DB._hash(pw),
      status:    'pending',
      createdAt: new Date().toISOString()
    };

    await DB.upsertExaminer(examiner);
    showPending('pending');
  } catch (e) {
    err.textContent   = 'Registration failed: ' + e.message;
    err.style.display = 'block';
    btn.disabled      = false;
    btn.textContent   = 'Create Account';
  }
}

/* ════════════════════════════════════════════
   NAVIGATION
════════════════════════════════════════════ */

function examNav(view) {
  examCurrentView = view;
  qsa('.admin-nav-item').forEach(el => el.classList.toggle('active', el.dataset.view === view));
  qsa('.admin-view').forEach(el => el.style.display = el.id === `view_${view}` ? '' : 'none');

  if (view === 'tests')                      renderExamTests();
  if (view === 'results')                    renderExamResults();
  if (view === 'downloads')                  renderExamDownloads();
  if (view === 'create' && !examEditingTest) openExamCreateTest();
}

/* ════════════════════════════════════════════
   TESTS LIST
════════════════════════════════════════════ */

async function renderExamTests() {
  const tbody = qs('#examTestsBody');
  tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--gray-400)">Loading…</td></tr>`;

  const sess = examSess.get();
  if (!sess) return;

  const tests = await DB.getExaminerTests(sess.id);
  if (!tests.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2.5rem;color:var(--gray-400)">No tests yet. Click "New Test" to create one.</td></tr>`;
    return;
  }

  const subCounts = await Promise.all(tests.map(t => DB.getTestSubs(t.id).then(s => s.length)));

  tbody.innerHTML = tests.map((t, i) => {
    const qCount = (t.questions || []).length;
    return `
      <tr>
        <td>
          <strong>${escHtml(t.title)}</strong>
          ${(t.allowedEmails || []).length > 0
            ? `<br><span class="badge badge-warning" style="margin-top:.25rem;font-size:.7rem">&#128274; ${t.allowedEmails.length} allowed email${t.allowedEmails.length > 1 ? 's' : ''}</span>`
            : ''}
          ${t.requireOTP
            ? `<span class="badge badge-info" style="margin-top:.25rem;margin-left:.25rem;font-size:.7rem">&#9993; OTP</span>`
            : ''}
          ${t.driveFolderId ? `<br><a href="https://drive.google.com/drive/folders/${t.driveFolderId}" target="_blank" class="badge badge-info" style="margin-top:.25rem;font-size:.7rem;text-decoration:none">&#128193; Drive Folder</a>` : ''}
        </td>
        <td>${qCount}</td>
        <td><span class="badge badge-${t.published ? 'success' : 'gray'}">${t.published ? 'Published' : 'Draft'}</span></td>
        <td>${subCounts[i]}</td>
        <td>${t.timeLimit ? t.timeLimit + ' min' : 'None'}</td>
        <td>
          <div style="display:flex;gap:.4rem;flex-wrap:wrap">
            <button class="btn btn-secondary btn-sm" onclick="openExamEditTest('${t.id}')">Edit</button>
            <button class="btn btn-${t.published ? 'warning' : 'success'} btn-sm" onclick="examTogglePublish('${t.id}')">${t.published ? 'Unpublish' : 'Publish'}</button>
            <button class="btn btn-ghost btn-sm" onclick="examCopyLink('${t.id}')">Copy Test Link</button>
            <button class="btn btn-ghost btn-sm" onclick="examCopyDlLink('${t.id}')">📥 Download Link</button>
            <button class="btn btn-ghost btn-sm" onclick="examExportTemplate('${t.id}')">&#8659; Export Template</button>
            <button class="btn btn-danger btn-sm" onclick="examDeleteTest('${t.id}')">Delete</button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

/* ════════════════════════════════════════════
   TEST EDITOR — CREATE / EDIT
════════════════════════════════════════════ */

function openExamCreateTest() {
  const sess = examSess.get();
  examEditingTest = {
    id:          uid(),
    title:       '',
    description: '',
    timeLimit:   0,
    passingScore: 70,
    published:   false,
    questions:   [],
    examinerId:  sess ? sess.id : '',
    createdAt:   new Date().toISOString()
  };
  renderExamEditor();
}

async function openExamEditTest(id) {
  examEditingTest = JSON.parse(JSON.stringify(await DB.getTest(id)));
  examNav('create');
  renderExamEditor();
}

function renderExamEditor() {
  qs('#examEditorTitle').value          = examEditingTest.title || '';
  qs('#examEditorDesc').value           = examEditingTest.description || '';
  qs('#examEditorTime').value           = examEditingTest.timeLimit || '';
  qs('#examEditorPassing').value        = examEditingTest.passingScore || '';
  qs('#examEditorAllowedEmails').value  = (examEditingTest.allowedEmails || []).join('\n');
  qs('#examEditorPrivate').checked      = !!examEditingTest.isPrivate;
  qs('#examEditorRequireOTP').checked   = !!examEditingTest.requireOTP;
  examUpdateEmailCount();
  examCheckOtpWarning();
  renderExamQList();
  renderExamDlFileList();
}

function renderExamDlFileList() {
  const files = examEditingTest ? (examEditingTest.downloads || []) : [];
  const el    = qs('#examDlFileList');
  if (!el) return;
  if (!files.length) {
    el.innerHTML = `<div style="color:var(--gray-400);font-size:.8rem;padding:.2rem 0">No files added yet.</div>`;
    return;
  }
  el.innerHTML = files.map((f, i) => `
    <div style="display:flex;align-items:center;gap:.5rem;padding:.35rem 0;border-bottom:1px solid var(--gray-100)">
      <span style="flex:1;font-size:.875rem">&#128196; ${escHtml(f.name)}</span>
      <button class="btn btn-danger btn-sm" onclick="removeExamDownloadFile(${i})">&#10005;</button>
    </div>`).join('');
}

function removeExamDownloadFile(idx) {
  if (!examEditingTest) return;
  examEditingTest.downloads.splice(idx, 1);
  renderExamDlFileList();
}

async function examCheckOtpWarning() {
  const warn = qs('#examOtpWarn');
  if (!warn) return;
  if (!qs('#examEditorRequireOTP').checked) { warn.style.display = 'none'; return; }
  const cfg = await DB.getEmailJS();
  warn.style.display = (!cfg || !cfg.serviceId) ? '' : 'none';
}

function examUpdateEmailCount() {
  const emails = examParseAllowedEmails();
  const badge  = qs('#examEmailCountBadge');
  if (emails.length > 0) {
    badge.style.display = '';
    qs('#examEmailCountText').textContent = `${emails.length} email${emails.length > 1 ? 's' : ''} allowed`;
  } else {
    badge.style.display = 'none';
  }
}

function examParseAllowedEmails() {
  return (qs('#examEditorAllowedEmails').value || '')
    .split('\n')
    .map(e => e.trim().toLowerCase())
    .filter(e => e.length > 0);
}

function renderExamQList() {
  const container = qs('#examQList');
  const questions = examEditingTest.questions || [];

  if (!questions.length) {
    container.innerHTML = `<div style="text-align:center;padding:2rem;color:var(--gray-400);font-size:.875rem">No questions yet. Add one above.</div>`;
    return;
  }

  const typeLabels = {
    single:    'Multiple Choice',
    truefalse: 'True / False',
    fillblank: 'Fill in the Blank',
    multi:     'Multi-Select'
  };

  container.innerHTML = questions.map((q, i) => `
    <div class="q-editor">
      <div class="q-editor-header">
        <div class="q-number-badge">${i + 1}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:.875rem;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(q.text || '(empty)')}</div>
          <div class="q-type-tag">${typeLabels[q.type] || q.type} &middot; ${q.points || 1} pt</div>
        </div>
        <div style="display:flex;gap:.3rem;flex-shrink:0">
          <button class="btn btn-secondary btn-sm" onclick="openExamQModal(${i})">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="removeExamQuestion(${i})">&#10005;</button>
        </div>
      </div>
    </div>`).join('');
}

/* ── Save Test ── */
async function saveExamTest() {
  const btn   = qs('#examSaveTestBtn');
  const title = qs('#examEditorTitle').value.trim();
  if (!title) { toast('Test title is required.', 'danger'); return; }
  if (!examParseAllowedEmails().length) { toast('At least one allowed email is required.', 'danger'); return; }

  btn.disabled    = true;
  btn.textContent = 'Saving…';

  const sess = examSess.get();
  examEditingTest.title         = title;
  examEditingTest.description   = qs('#examEditorDesc').value.trim();
  examEditingTest.timeLimit     = parseInt(qs('#examEditorTime').value) || 0;
  examEditingTest.passingScore  = parseInt(qs('#examEditorPassing').value) || 0;
  examEditingTest.allowedEmails = examParseAllowedEmails();
  examEditingTest.isPrivate     = qs('#examEditorPrivate').checked;
  examEditingTest.requireOTP    = qs('#examEditorRequireOTP').checked;
  examEditingTest.examinerId    = sess ? sess.id : (examEditingTest.examinerId || '');
  examEditingTest.downloads     = examEditingTest.downloads || [];

  await DB.upsertTest(examEditingTest);

  const otpStatus = examEditingTest.requireOTP ? 'Email OTP: ON' : 'Email OTP: OFF';
  toast(`Test saved! (${otpStatus})`);

  examEditingTest = null;
  btn.disabled    = false;
  btn.textContent = 'Save Test';
  examNav('tests');
}

/* ── Publish Toggle ── */
async function examTogglePublish(id) {
  const t = await DB.getTest(id);
  if (!t) return;
  if (!t.published && !(t.questions && t.questions.length)) {
    toast('Add at least one question before publishing.', 'warning');
    return;
  }
  t.published = !t.published;
  await DB.upsertTest(t);
  renderExamTests();
  toast(t.published ? 'Test published!' : 'Test moved to draft.');
}

/* ── Delete Test ── */
async function examDeleteTest(id) {
  const t = await DB.getTest(id);
  if (!t) return;
  const subs = await DB.getTestSubs(id);
  if (!confirm(`Delete "${t.title}"? This will also remove all ${subs.length} submission(s). This cannot be undone.`)) return;
  await DB.deleteTest(id);
  renderExamTests();
  toast('Test deleted.', 'warning');
}

/* ── Copy Link ── */
function examCopyLink(id) {
  const url = `${location.origin}${location.pathname.replace('examiner.html', '')}test.html?id=${id}`;
  navigator.clipboard
    .writeText(url)
    .then(() => toast('Link copied!'))
    .catch(() => { prompt('Copy this link:', url); });
}

/* ════════════════════════════════════════════
   QUESTION MODAL
════════════════════════════════════════════ */

function openExamQModal(idx) {
  examEditingQIdx = idx;
  const q = idx !== null
    ? examEditingTest.questions[idx]
    : { type: 'single', text: '', points: 1, options: ['', ''], correctIndex: 0 };

  qs('#examQModalTitle').textContent = idx !== null ? 'Edit Question' : 'Add Question';
  qs('#examQType').value    = q.type    || 'single';
  qs('#examQText').value    = q.text    || '';
  qs('#examQPoints').value  = q.points  || 1;
  qs('#examQExplain').value = q.explanation || '';

  renderExamQTypeFields(q);
  qs('#examQModalOverlay').style.display = 'flex';

  qs('#examQType').onchange = () => {
    const defaults = {
      single:    { options: ['', ''], correctIndex: 0 },
      truefalse: { correctBool: true },
      fillblank: { correctText: '' },
      multi:     { options: ['', ''], correctIndices: [0] }
    };
    renderExamQTypeFields({ type: qs('#examQType').value, ...defaults[qs('#examQType').value] });
  };
}

function renderExamQTypeFields(q) {
  const type     = q.type || qs('#examQType').value;
  const fieldsEl = qs('#examQTypeFields');

  if (type === 'single') {
    const opts = q.options && q.options.length ? q.options : ['', ''];
    fieldsEl.innerHTML = `
      <div class="form-group">
        <label class="form-label">Options <span class="req">*</span></label>
        <div id="examOptList">${opts.map((o, i) => examOptRowHtml(i, o, q.correctIndex === i)).join('')}</div>
        <button type="button" class="btn btn-ghost btn-sm" style="margin-top:.4rem" onclick="examAddOptRow()">+ Add Option</button>
        <div class="form-hint">Select the radio button next to the correct answer.</div>
      </div>`;

  } else if (type === 'multi') {
    const opts    = q.options && q.options.length ? q.options : ['', ''];
    const correct = q.correctIndices || [0];
    fieldsEl.innerHTML = `
      <div class="form-group">
        <label class="form-label">Options <span class="req">*</span></label>
        <div id="examOptList">${opts.map((o, i) => examOptRowHtmlMulti(i, o, correct.includes(i))).join('')}</div>
        <button type="button" class="btn btn-ghost btn-sm" style="margin-top:.4rem" onclick="examAddOptRow()">+ Add Option</button>
        <div class="form-hint">Check all correct answers.</div>
      </div>`;

  } else if (type === 'truefalse') {
    fieldsEl.innerHTML = `
      <div class="form-group">
        <label class="form-label">Correct Answer <span class="req">*</span></label>
        <div style="display:flex;gap:1rem;margin-top:.25rem">
          <label class="option-label" style="flex:1"><input type="radio" name="examTfCorrect" value="true" ${q.correctBool !== false ? 'checked' : ''}> True</label>
          <label class="option-label" style="flex:1"><input type="radio" name="examTfCorrect" value="false" ${q.correctBool === false ? 'checked' : ''}> False</label>
        </div>
      </div>`;

  } else if (type === 'fillblank') {
    fieldsEl.innerHTML = `
      <div class="form-group">
        <label class="form-label">Correct Answer <span class="req">*</span></label>
        <input type="text" id="examFibAnswer" class="form-control" value="${escHtml(q.correctText || '')}" placeholder="Accepted answer (case-insensitive)">
      </div>`;
  }
}

function examOptRowHtml(i, val, checked) {
  return `<div class="option-row" id="examOptRow_${i}">
    <input type="radio" name="examOptCorrect" value="${i}" class="option-correct-check" ${checked ? 'checked' : ''} title="Mark as correct">
    <input type="text" class="form-control" id="examOpt_${i}" value="${escHtml(val)}" placeholder="Option ${i + 1}">
    <button type="button" class="btn btn-ghost btn-sm" onclick="examRemoveOptRow(${i})" title="Remove">&#10005;</button>
  </div>`;
}

function examOptRowHtmlMulti(i, val, checked) {
  return `<div class="option-row" id="examOptRow_${i}">
    <input type="checkbox" name="examOptCorrect" value="${i}" class="option-correct-check" ${checked ? 'checked' : ''} title="Mark as correct">
    <input type="text" class="form-control" id="examOpt_${i}" value="${escHtml(val)}" placeholder="Option ${i + 1}">
    <button type="button" class="btn btn-ghost btn-sm" onclick="examRemoveOptRow(${i})" title="Remove">&#10005;</button>
  </div>`;
}

function examAddOptRow() {
  const list = qs('#examOptList');
  const rows = qsa('.option-row', list);
  const i    = rows.length;
  const type = qs('#examQType').value;
  const div  = document.createElement('div');
  div.innerHTML = type === 'multi' ? examOptRowHtmlMulti(i, '', false) : examOptRowHtml(i, '', false);
  list.appendChild(div.firstElementChild);
}

function examRemoveOptRow(i) {
  const row = qs(`#examOptRow_${i}`);
  if (row) row.remove();
  qsa('.option-row', qs('#examOptList')).forEach((r, ni) => {
    r.id = `examOptRow_${ni}`;
    const radio = r.querySelector('input[type="radio"],input[type="checkbox"]');
    const text  = r.querySelector('input[type="text"]');
    const btn   = r.querySelector('button');
    if (radio) radio.value = ni;
    if (text)  { text.id = `examOpt_${ni}`; text.placeholder = `Option ${ni + 1}`; }
    if (btn)   btn.setAttribute('onclick', `examRemoveOptRow(${ni})`);
  });
}

function removeExamQuestion(idx) {
  if (!confirm('Remove this question?')) return;
  examEditingTest.questions.splice(idx, 1);
  renderExamQList();
}

/* ── Save Question ── */
function saveExamQuestion() {
  const type        = qs('#examQType').value;
  const text        = qs('#examQText').value.trim();
  const points      = parseInt(qs('#examQPoints').value) || 1;
  const explanation = qs('#examQExplain').value.trim();

  if (!text) { toast('Question text is required.', 'danger'); return; }

  const q = { type, text, points, explanation };

  if (type === 'single') {
    const rows      = qsa('.option-row', qs('#examOptList'));
    const options   = rows.map(r => r.querySelector('input[type="text"]').value.trim());
    const correctEl = qs('input[name="examOptCorrect"]:checked');
    if (!correctEl)              { toast('Select the correct answer.', 'danger'); return; }
    if (options.some(o => !o))   { toast('All options must have text.', 'danger'); return; }
    q.options      = options;
    q.correctIndex = rows.findIndex(r => r.querySelector('input[type="radio"]') === correctEl);

  } else if (type === 'multi') {
    const rows       = qsa('.option-row', qs('#examOptList'));
    const options    = rows.map(r => r.querySelector('input[type="text"]').value.trim());
    const checkedEls = qsa('input[name="examOptCorrect"]:checked');
    if (!checkedEls.length)    { toast('Select at least one correct answer.', 'danger'); return; }
    if (options.some(o => !o)) { toast('All options must have text.', 'danger'); return; }
    q.options        = options;
    q.correctIndices = checkedEls.map(el => parseInt(el.value));

  } else if (type === 'truefalse') {
    const checked = qs('input[name="examTfCorrect"]:checked');
    if (!checked) { toast('Select True or False.', 'danger'); return; }
    q.correctBool = checked.value === 'true';

  } else if (type === 'fillblank') {
    const ans = qs('#examFibAnswer').value.trim();
    if (!ans) { toast('Enter the correct answer.', 'danger'); return; }
    q.correctText = ans;
  }

  if (examEditingQIdx !== null) {
    examEditingTest.questions[examEditingQIdx] = q;
  } else {
    examEditingTest.questions.push(q);
  }

  const wasEditing = examEditingQIdx !== null;
  closeExamQModal();
  renderExamQList();
  toast(wasEditing ? 'Question updated.' : 'Question added.');
  examEditingQIdx = null;
}

function closeExamQModal() {
  qs('#examQModalOverlay').style.display = 'none';
}

/* ── Download Files — Add button ── */
qs('#examDlAddBtn').addEventListener('click', () => {
  if (!examEditingTest) return;
  const name = qs('#examDlFileName').value.trim();
  const url  = qs('#examDlFileUrl').value.trim();
  if (!name) { toast('Enter a file name.', 'warning'); return; }
  if (!url)  { toast('Paste the SharePoint link.', 'warning'); return; }
  if (!examEditingTest.downloads) examEditingTest.downloads = [];
  examEditingTest.downloads.push({ name, url });
  qs('#examDlFileName').value = '';
  qs('#examDlFileUrl').value  = '';
  renderExamDlFileList();
  toast('File added.');
});

/* ── Excel Import ── */
qs('#examImportExcelBtn').addEventListener('click', () => {
  if (typeof XLSX !== 'undefined') { qs('#examExcelFileInput').click(); return; }
  const btn = qs('#examImportExcelBtn');
  btn.textContent = 'Loading…';
  btn.disabled = true;
  const s = document.createElement('script');
  s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
  s.onload  = () => { btn.textContent = '↑ Import Excel'; btn.disabled = false; qs('#examExcelFileInput').click(); };
  s.onerror = () => { btn.textContent = '↑ Import Excel'; btn.disabled = false; toast('Failed to load Excel parser.', 'danger'); };
  document.head.appendChild(s);
});

qs('#examExcelFileInput').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = evt => {
    const wb   = XLSX.read(evt.target.result, { type: 'binary' });
    const ws   = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

    if (rows.length < 2) { toast('No data rows found in Excel.', 'warning'); return; }

    let imported = 0, skipped = 0;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.every(c => !c)) continue;

      const get  = idx => String(row[idx] || '').trim();
      const type = get(0).toLowerCase();
      const text = get(1);
      if (!text || !['single','truefalse','fillblank','multi'].includes(type)) { skipped++; continue; }

      const opts   = [get(2), get(3), get(4), get(5)].filter(o => o);
      const answer = get(6);
      const points = parseInt(get(7)) || 1;
      let q = { text, points };

      if (type === 'single') {
        if (!opts.length || !answer) { skipped++; continue; }
        const ansUp = answer.toUpperCase();
        let idx = ['A','B','C','D'].includes(ansUp) ? ['A','B','C','D'].indexOf(ansUp) : (parseInt(answer) || 0);
        if (idx >= opts.length) idx = 0;
        q = { ...q, type: 'single', options: opts, correctIndex: idx };

      } else if (type === 'truefalse') {
        q = { ...q, type: 'truefalse', correctBool: answer.toLowerCase() === 'true' };

      } else if (type === 'fillblank') {
        if (!answer) { skipped++; continue; }
        q = { ...q, type: 'fillblank', correctText: answer };

      } else if (type === 'multi') {
        if (!opts.length || !answer) { skipped++; continue; }
        const correctIndices = answer.split(',').map(a => {
          const up = a.trim().toUpperCase();
          return ['A','B','C','D'].includes(up) ? ['A','B','C','D'].indexOf(up) : (parseInt(a) || 0);
        }).filter(idx => idx < opts.length);
        q = { ...q, type: 'multi', options: opts, correctIndices: correctIndices.length ? correctIndices : [0] };
      }

      examEditingTest.questions.push(q);
      imported++;
    }

    e.target.value = '';
    renderExamQList();
    if (imported) toast(`${imported} question${imported > 1 ? 's' : ''} imported!`);
    if (skipped)  toast(`${skipped} row${skipped > 1 ? 's' : ''} skipped (invalid format).`, 'warning');
  };
  reader.readAsBinaryString(file);
});

/* ── Download CSV Template ── */
function downloadExamTemplate() {
  const rows = [
    ['Type', 'Question', 'Option A', 'Option B', 'Option C', 'Option D', 'Answer', 'Points'],
    ['single',    'What is 2 + 2?',               '3', '4', '5', '6',  'B',     '1'],
    ['truefalse', 'The sky is blue.',              '',  '',  '',  '',   'True',  '1'],
    ['fillblank', 'The capital of France is ___', '',  '',  '',  '',   'Paris', '1'],
    ['multi',     'Select all prime numbers.',     '2', '3', '4', '5',  'A,B,D', '2'],
  ];
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const a   = document.createElement('a');
  a.href    = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = 'question_template.csv';
  a.click();
  toast('Template downloaded!');
}

qs('#examDlTemplateBtn').addEventListener('click', downloadExamTemplate);
qs('#examDlTemplateBtnMain').addEventListener('click', downloadExamTemplate);

/* ════════════════════════════════════════════
   RESULTS
════════════════════════════════════════════ */

async function renderExamResults() {
  const tbody = qs('#examResultsBody');
  tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--gray-400)">Loading…</td></tr>`;

  const sess = examSess.get();
  if (!sess) return;

  // Query subs directly by examinerId (frozen at submit time) so results
  // persist even after admin revokes or reassigns the test.
  const [allSubs, allTests] = await Promise.all([
    DB.getExaminerSubs(sess.id),
    DB.getTests()
  ]);
  _examSubs  = allSubs;

  // Only show tests that actually have submissions for this examiner
  const testIdsInSubs = [...new Set(allSubs.map(s => s.testId))];
  const tests = allTests.filter(t => testIdsInSubs.includes(t.id));
  _examTests  = tests;

  qs('#statExamTests').textContent = tests.length;
  qs('#statExamSubs').textContent  = allSubs.length;
  const passCount = allSubs.filter(s => s.passed === true).length;
  qs('#statExamPass').textContent  = allSubs.length
    ? Math.round((passCount / allSubs.length) * 100) + '%'
    : '—';

  const currentFilter = qs('#examResultFilter').value;
  qs('#examResultFilter').innerHTML = `<option value="">All My Tests</option>` +
    tests.map(t => `<option value="${t.id}" ${t.id === currentFilter ? 'selected' : ''}>${escHtml(t.title)}</option>`).join('');
  if (currentFilter) qs('#examResultFilter').value = currentFilter;

  const filterTestId = qs('#examResultFilter').value;
  const subs = filterTestId ? allSubs.filter(s => s.testId === filterTestId) : allSubs;

  if (!subs.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:2.5rem;color:var(--gray-400)">No submissions yet.</td></tr>`;
    return;
  }

  const sorted = [...subs].sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  tbody.innerHTML = sorted.map(s => {
    const t = allTests.find(t => t.id === s.testId);
    const passedBadge = s.passed === true
      ? `<span class="badge badge-success">Passed</span>`
      : s.passed === false
        ? `<span class="badge badge-danger">Failed</span>`
        : `<span class="badge badge-gray">Completed</span>`;
    return `
      <tr>
        <td>${escHtml(s.name)}</td>
        <td>${escHtml(s.email)}</td>
        <td>${escHtml(t ? t.title : '—')}</td>
        <td><strong>${s.score}%</strong> <span style="color:var(--gray-400);font-size:.8rem">(${s.earned}/${s.total}pts)</span></td>
        <td>${passedBadge}</td>
        <td>${fmtDuration(s.timeTaken)}</td>
        <td>${fmtDate(s.submittedAt)}</td>
        <td><button class="btn btn-secondary btn-sm" onclick="examViewSub('${s.id}')">View</button></td>
      </tr>`;
  }).join('');
}

/* ── Export CSV ── */
async function exportExamCsv() {
  if (!_examSubs.length) { toast('No results to export.', 'warning'); return; }

  const filterTestId = qs('#examResultFilter').value;
  const subs = filterTestId ? _examSubs.filter(s => s.testId === filterTestId) : _examSubs;

  if (!subs.length) { toast('No results to export.', 'warning'); return; }

  const rows = [['Name', 'Email', 'Test', 'Score (%)', 'Points Earned', 'Total Points', 'Status', 'Time Taken', 'Submitted At']];
  subs.forEach(s => {
    const t      = _examTests.find(t => t.id === s.testId);
    const status = s.passed === true ? 'Passed' : s.passed === false ? 'Failed' : 'Completed';
    rows.push([
      s.name, s.email,
      t ? t.title : '',
      s.score, s.earned, s.total,
      status,
      fmtDuration(s.timeTaken),
      fmtDate(s.submittedAt)
    ]);
  });
  downloadCsv(rows, `exam_results_${Date.now()}.csv`);
  toast('CSV downloaded!');
}

/* ════════════════════════════════════════════
   SUBMISSION DETAIL
════════════════════════════════════════════ */

function examViewSub(subId) {
  const sub  = _examSubs.find(s => s.id === subId);
  const test = _examTests.find(t => t.id === (sub && sub.testId));
  if (!sub || !test) { toast('Could not load submission details.', 'danger'); return; }

  qs('#examSubDetailTitle').textContent = `${escHtml(sub.name)} — ${escHtml(test.title)}`;

  const statusBadge = sub.passed === true
    ? `<span class="badge badge-success">Passed</span>`
    : sub.passed === false
      ? `<span class="badge badge-danger">Failed</span>`
      : `<span class="badge badge-gray">Completed</span>`;

  const questions = test.questions || [];
  const answers   = sub.answers   || [];

  qs('#examSubDetailBody').innerHTML = `
    <div style="display:flex;gap:1.5rem;flex-wrap:wrap;margin-bottom:1.25rem;padding-bottom:1rem;border-bottom:1px solid var(--gray-200)">
      <div><span style="color:var(--gray-500);font-size:.8rem">Score</span><br><strong>${sub.score}%</strong></div>
      <div><span style="color:var(--gray-500);font-size:.8rem">Points</span><br><strong>${sub.earned}/${sub.total}</strong></div>
      <div><span style="color:var(--gray-500);font-size:.8rem">Status</span><br>${statusBadge}</div>
      <div><span style="color:var(--gray-500);font-size:.8rem">Time</span><br><strong>${fmtDuration(sub.timeTaken)}</strong></div>
      <div><span style="color:var(--gray-500);font-size:.8rem">Email</span><br><strong>${escHtml(sub.email)}</strong></div>
    </div>
    ${answers.map((ans, i) => {
      const q = questions[ans.originalIdx !== undefined ? ans.originalIdx : i] || questions[i];
      return renderSubAnswer(q, i, ans);
    }).join('')}`;

  qs('#examSubDetailOverlay').style.display = 'flex';
}

/* ════════════════════════════════════════════
   DOWNLOADS
════════════════════════════════════════════ */

function renderExamDownloads() {
  const container = qs('#examSharePointContent');
  if (!container) return;
  container.innerHTML = `
    <div class="card">
      <div class="card-body" style="text-align:center;padding:2.5rem 1.5rem">
        <div style="font-size:2rem;margin-bottom:.75rem">&#128193;</div>
        <p style="color:var(--gray-500);margin-bottom:1rem">Upload and manage training files directly in SharePoint.</p>
        <div style="margin-bottom:1.5rem;padding:.65rem .85rem;background:#fffbeb;border:1px solid #fcd34d;border-radius:6px;font-size:.85rem;color:#92400e;line-height:1.6;text-align:left;max-width:460px;margin-left:auto;margin-right:auto">
          <strong>Note:</strong> Create a folder with your <strong>test name</strong> and upload the files that need to be shared with the test takers.
        </div>
        <a href="https://versanetworks.sharepoint.com/:f:/g/IgAEhhHXCJCxQIqNOG6SFdZIAW7S9-BKJ59Oa0xnYtxd5Fo?e=g57niV"
           target="_blank" class="btn btn-primary">Open SharePoint Folder</a>
      </div>
    </div>`;
}

async function examLoadFolderFiles(testId, folderId) {
  const el = qs(`#examFolder_${testId}`);
  if (!el) return true;
  try {
    const files = await DRIVE.listFolderFiles(folderId);
    if (!files.length) {
      el.innerHTML = `<span style="color:var(--gray-400)">No files yet — click Upload to add files.</span>`;
      return true;
    }
    el.innerHTML = `
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="color:var(--gray-500);font-size:.75rem;text-transform:uppercase;border-bottom:1px solid var(--gray-200)">
            <th style="text-align:left;padding:.35rem 0;font-weight:500">Name</th>
            <th style="text-align:left;padding:.35rem 0;font-weight:500">Size</th>
            <th style="text-align:right;padding:.35rem 0;font-weight:500">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${files.map(f => `
            <tr style="border-bottom:1px solid var(--gray-100)">
              <td style="padding:.45rem 0">&#128196; ${escHtml(f.name)}</td>
              <td style="padding:.45rem 0;color:var(--gray-500)">${fmtFileSize(parseInt(f.size) || 0)}</td>
              <td style="padding:.45rem 0;text-align:right">
                <a href="https://drive.google.com/uc?export=download&id=${f.id}" target="_blank" class="btn btn-secondary btn-sm">&#8595; Download</a>
                <button class="btn btn-danger btn-sm"
                  onclick="examDeleteDriveFile('${testId}','${folderId}','${f.id}','${escHtml(f.name).replace(/'/g,"\\'")}')">Delete</button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>`;
    return true;
  } catch (e) {
    el.innerHTML = `<span style="color:var(--gray-400);font-size:.8rem">⚠️ ${escHtml(e.message)}</span>`;
  }
}

async function examExportTemplate(id) {
  const t = await DB.getTest(id);
  if (!t || !t.questions || !t.questions.length) { toast('No questions to export.', 'warning'); return; }

  const letters = ['A','B','C','D','E','F'];
  const rows = [['Type','Question','Option A','Option B','Option C','Option D','Answer','Points']];

  for (const q of t.questions) {
    const opts = q.options || [];
    let answer = '';
    if (q.type === 'single')    answer = letters[q.correctIndex] ?? '';
    if (q.type === 'multi')     answer = (q.correctIndices || []).map(i => letters[i]).join(',');
    if (q.type === 'truefalse') answer = q.correctBool ? 'True' : 'False';
    if (q.type === 'fillblank') answer = q.correctText || '';
    rows.push([q.type, q.text, opts[0]||'', opts[1]||'', opts[2]||'', opts[3]||'', answer, q.points ?? 1]);
  }

  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = `${(t.title || 'questions').replace(/[^a-z0-9]/gi,'_')}_template.csv`;
  a.click();
  toast('Template exported!');
}

function examCopyDlLink(testId) {
  const base = location.href.replace(/examiner\.html.*$/, 'downloads.html');
  const url  = `${base}?test=${testId}`;
  navigator.clipboard.writeText(url)
    .then(() => toast('Download link copied!'))
    .catch(() => prompt('Copy this link:', url));
}

async function examUploadToDriveFolder(testId, folderId, input) {
  const files = Array.from(input.files);
  if (!files.length) return;
  input.value = '';
  const test = await DB.getTest(testId);
  const folderEl = qs(`#examFolder_${testId}`);
  for (const file of files) {
    if (folderEl) folderEl.innerHTML = `<span style="color:var(--gray-400)">Uploading ${escHtml(file.name)}…</span>`;
    try {
      const uploaded = await DRIVE.uploadFile(folderId, file);
      await DB.upsertDriveFile({
        id: uploaded.id, name: file.name, size: file.size,
        testId, testTitle: test ? test.title : '', folderId,
        uploadedAt: new Date().toISOString()
      });
      toast(`${file.name} uploaded!`);
    } catch (e) {
      toast(`Upload failed: ${e.message}`, 'danger');
    }
  }
  await examLoadFolderFiles(testId, folderId);
}

async function examDeleteDriveFile(testId, folderId, fileId, fileName) {
  if (!confirm(`Delete "${fileName}" from Google Drive? This cannot be undone.`)) return;
  try {
    await DRIVE.deleteFile(fileId);
    await DB.deleteDriveFile(fileId);
    toast('File deleted.', 'warning');
    await examLoadFolderFiles(testId, folderId);
  } catch (e) {
    toast(`Delete failed: ${e.message}`, 'danger');
  }
}

/* ════════════════════════════════════════════
   SUBMISSION DETAIL
════════════════════════════════════════════ */

function renderSubAnswer(q, idx, ans) {
  if (!q) {
    return `<div style="margin-bottom:1rem;padding:.875rem;border-radius:8px;border:1px solid var(--gray-200);background:var(--gray-50)">
      <em style="color:var(--gray-400)">Question data unavailable.</em>
    </div>`;
  }

  const correct   = ans && ans.correct;
  const given     = ans && ans.given;
  const cardStyle = correct
    ? 'border:1px solid #bbf7d0;background:#f0fdf4'
    : 'border:1px solid #fecaca;background:#fff7f7';
  const icon      = correct ? '&#10003;' : '&#10007;';
  const iconColor = correct ? 'var(--success)' : 'var(--danger)';

  let bodyHtml = '';

  if (q.type === 'single') {
    bodyHtml = (q.options || []).map((opt, i) => {
      const sel   = given === i;
      const isAns = i === q.correctIndex;
      const bg    = sel && isAns  ? '#dcfce7;border-color:#86efac'
                  : sel && !isAns ? '#fee2e2;border-color:#fca5a5'
                  : isAns         ? '#f0fdf4;border-color:#86efac'
                  : '';
      const prefix = sel ? (isAns ? '&#10003; ' : '&#10007; ') : isAns ? '&#8594; ' : '&#9675; ';
      return `<div class="option-label" style="margin-bottom:.3rem;${bg ? 'background:' + bg : ''}">${prefix}${escHtml(opt)}</div>`;
    }).join('');

  } else if (q.type === 'truefalse') {
    ['True', 'False'].forEach(v => {
      const val   = v === 'True';
      const sel   = given === val;
      const isAns = val === q.correctBool;
      const bg    = sel && isAns  ? '#dcfce7;border-color:#86efac'
                  : sel && !isAns ? '#fee2e2;border-color:#fca5a5'
                  : isAns         ? '#f0fdf4;border-color:#86efac' : '';
      const prefix = sel ? (isAns ? '&#10003; ' : '&#10007; ') : isAns ? '&#8594; ' : '&#9675; ';
      bodyHtml += `<div class="option-label" style="margin-bottom:.3rem;${bg ? 'background:' + bg : ''}">${prefix}${v}</div>`;
    });

  } else if (q.type === 'fillblank') {
    const userAns = given !== undefined && given !== null && given !== ''
      ? escHtml(String(given))
      : '<em style="color:var(--gray-400)">No answer</em>';
    bodyHtml = `<div style="margin-bottom:.3rem">
      <span style="color:var(--gray-500);font-size:.8rem">Answered:</span>
      <strong style="color:${correct ? 'var(--success)' : 'var(--danger)'}">${userAns}</strong>
    </div>`;
    if (!correct) {
      bodyHtml += `<div><span style="color:var(--gray-500);font-size:.8rem">Correct answer:</span> <strong style="color:var(--success)">${escHtml(q.correctText || '')}</strong></div>`;
    }

  } else if (q.type === 'multi') {
    const givenArr   = Array.isArray(given) ? given : [];
    const correctArr = q.correctIndices || [];
    bodyHtml = (q.options || []).map((opt, i) => {
      const sel   = givenArr.includes(i);
      const isAns = correctArr.includes(i);
      const bg    = sel && isAns  ? '#dcfce7;border-color:#86efac'
                  : sel && !isAns ? '#fee2e2;border-color:#fca5a5'
                  : isAns         ? '#f0fdf4;border-color:#86efac' : '';
      const prefix = sel ? (isAns ? '&#10003; ' : '&#10007; ') : isAns ? '&#8594; ' : '&#9675; ';
      return `<div class="option-label" style="margin-bottom:.3rem;${bg ? 'background:' + bg : ''}">${prefix}${escHtml(opt)}</div>`;
    }).join('');
  }

  return `<div style="margin-bottom:1rem;padding:.875rem;border-radius:8px;${cardStyle}">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:.6rem;gap:.5rem">
      <div style="font-size:.875rem;font-weight:600">Q${idx + 1}. ${escHtml(q.text)}</div>
      <span style="color:${iconColor};font-weight:700;flex-shrink:0">${icon}</span>
    </div>
    ${bodyHtml}
  </div>`;
}
