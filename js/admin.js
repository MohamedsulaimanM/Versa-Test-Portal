/* ── View router ── */
let currentView = 'tests', editingTest = null, editingQIdx = null;
let _tests = [], _subs = [];

document.addEventListener('DOMContentLoaded', async () => {
  const configured = await DB.isConfigured();
  if (!configured) { showAuth('setup'); return; }
  if (!adminSess.ok()) { showAuth('login'); return; }
  showApp();
});

/* ── Auth ── */
function showAuth(mode) {
  qs('#authScreen').style.display = '';
  qs('#appScreen').style.display  = 'none';

  if (mode === 'setup') {
    qs('#authTitle').textContent      = 'Set Admin Password';
    qs('#authSubtitle').textContent   = 'Create a password to protect the admin panel.';
    qs('#confirmGroup').style.display = '';
    qs('#authBtn').textContent        = 'Set Password';
  } else {
    qs('#authTitle').textContent      = 'Admin Login';
    qs('#authSubtitle').textContent   = 'Enter your password to access the admin panel.';
    qs('#confirmGroup').style.display = 'none';
    qs('#authBtn').textContent        = 'Login';
  }

  qs('#authForm').onsubmit = async e => {
    e.preventDefault();
    const pw  = qs('#authPw').value;
    const pw2 = qs('#authPw2').value;
    const err = qs('#authError');
    const btn = qs('#authBtn');

    if (!pw || pw.length < 4) { err.textContent = 'Password must be at least 4 characters.'; err.style.display = 'block'; return; }

    btn.disabled    = true;
    btn.textContent = mode === 'setup' ? 'Setting up…' : 'Logging in…';

    if (mode === 'setup') {
      if (pw !== pw2) { err.textContent = 'Passwords do not match.'; err.style.display = 'block'; btn.disabled = false; btn.textContent = 'Set Password'; return; }
      await DB.setPw(pw);
      adminSess.set();
      showApp();
    } else {
      if (!await DB.checkPw(pw)) { err.textContent = 'Incorrect password.'; err.style.display = 'block'; btn.disabled = false; btn.textContent = 'Login'; return; }
      adminSess.set();
      showApp();
    }
  };
}

function showApp() {
  qs('#authScreen').style.display = 'none';
  qs('#appScreen').style.display  = '';
  DRIVE.init();
  navigate('tests');
}

/* ── Navigation ── */
function navigate(view) {
  currentView = view;
  qsa('.admin-nav-item').forEach(el => el.classList.toggle('active', el.dataset.view === view));
  qsa('.admin-view').forEach(el => el.style.display = el.id === `view_${view}` ? '' : 'none');

  if (view === 'tests')     renderTestsList();
  if (view === 'results')   renderResultsList();
  if (view === 'downloads') renderDownloadsList();
  if (view === 'settings')  loadEmailJSConfig();
  if (view === 'examiners') renderExaminersList();
  if (view === 'create' && !editingTest) openCreateTest();
}

qsa('.admin-nav-item').forEach(el => el.addEventListener('click', () => navigate(el.dataset.view)));

/* ── Tests list ── */
async function renderTestsList() {
  const tbody = qs('#testsTableBody');
  tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--gray-400)">Loading…</td></tr>`;
  const tests = await DB.getTests();

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
          ${t.isPrivate ? `<span class="badge badge-gray" style="margin-top:.25rem;font-size:.7rem">🔒 Private</span>` : ''}
          ${(t.allowedEmails||[]).length > 0 ? `<br><span class="badge badge-warning" style="margin-top:.25rem;font-size:.7rem">🔒 ${t.allowedEmails.length} allowed email${t.allowedEmails.length>1?'s':''}</span>` : ''}
          ${t.requireOTP ? `<span class="badge badge-info" style="margin-top:.25rem;margin-left:.25rem;font-size:.7rem">✉ OTP</span>` : ''}
          ${t.driveFolderId ? `<br><a href="https://drive.google.com/drive/folders/${t.driveFolderId}" target="_blank" class="badge badge-info" style="margin-top:.25rem;font-size:.7rem;text-decoration:none">📁 Drive Folder</a>` : ''}
        </td>
        <td>${qCount}</td>
        <td><span class="badge badge-${t.published ? 'success' : 'gray'}">${t.published ? 'Published' : 'Draft'}</span></td>
        <td>${subCounts[i]}</td>
        <td>${t.timeLimit ? t.timeLimit + ' min' : 'None'}</td>
        <td>
          <div style="display:flex;gap:.4rem;flex-wrap:wrap">
            <button class="btn btn-secondary btn-sm" onclick="openEditTest('${t.id}')">Edit</button>
            <button class="btn btn-${t.published ? 'warning' : 'success'} btn-sm" onclick="togglePublish('${t.id}')">${t.published ? 'Unpublish' : 'Publish'}</button>
            <button class="btn btn-ghost btn-sm" onclick="copyLink('${t.id}')">Copy Test Link</button>
            <button class="btn btn-ghost btn-sm" onclick="copyDlLink('${t.id}')">📥 Download Link</button>
            <button class="btn btn-ghost btn-sm" onclick="exportTestTemplate('${t.id}')">⬇ Export Template</button>
            <button class="btn btn-danger btn-sm" onclick="deleteTest('${t.id}')">Delete</button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

/* ── Create / Edit Test ── */
function openCreateTest() {
  editingTest = {
    id: uid(), title: '', description: '', timeLimit: 0, passingScore: 70,
    published: false, questions: [], createdAt: new Date().toISOString()
  };
  renderEditor();
}

async function openEditTest(id) {
  editingTest = JSON.parse(JSON.stringify(await DB.getTest(id)));
  navigate('create');
  renderEditor();
}

function renderEditor() {
  qs('#editorTitle').value         = editingTest.title || '';
  qs('#editorDesc').value          = editingTest.description || '';
  qs('#editorTime').value          = editingTest.timeLimit || '';
  qs('#editorPassing').value       = editingTest.passingScore || '';
  qs('#editorAllowedEmails').value = (editingTest.allowedEmails || []).join('\n');
  qs('#editorPrivate').checked     = !!editingTest.isPrivate;
  qs('#editorRequireOTP').checked  = !!editingTest.requireOTP;
  updateEmailCount();
  qs('#editorAllowedEmails').addEventListener('input', updateEmailCount);

  // Populate examiner dropdown
  const current = editingTest.examinerId || '';
  DB.getExaminers().then(examiners => {
    const approved = examiners.filter(e => e.status === 'approved');
    const sel = qs('#editorExaminer');
    sel.innerHTML = `<option value="">— Not assigned —</option>` +
      approved.map(e =>
        `<option value="${e.id}" data-name="${escHtml(e.name)}" ${e.id === current ? 'selected' : ''}>${escHtml(e.name)} (${escHtml(e.email)})</option>`
      ).join('');
    if (current && !approved.find(e => e.id === current)) {
      sel.innerHTML += `<option value="${current}" data-name="${escHtml(editingTest.examinerName || '')}" selected>[Removed examiner]</option>`;
    }
  });
  checkOtpWarning();
  qs('#editorRequireOTP').onchange = checkOtpWarning;
  renderQList();
  renderDlFileList();
}

/* ── Download Files ── */
document.getElementById('dlAddBtn').addEventListener('click', () => {
  if (!editingTest) return;
  const name = qs('#dlFileName').value.trim();
  const url  = qs('#dlFileUrl').value.trim();
  if (!name) { toast('Enter a file name.', 'warning'); return; }
  if (!url)  { toast('Paste the SharePoint link.', 'warning'); return; }
  if (!editingTest.downloads) editingTest.downloads = [];
  editingTest.downloads.push({ name, url });
  qs('#dlFileName').value = '';
  qs('#dlFileUrl').value  = '';
  renderDlFileList();
  toast('File added.');
});

function renderDlFileList() {
  const files = editingTest ? (editingTest.downloads || []) : [];
  const el    = qs('#dlFileList');
  if (!el) return;
  if (!files.length) {
    el.innerHTML = `<div style="color:var(--gray-400);font-size:.8rem;padding:.2rem 0">No files added yet.</div>`;
    return;
  }
  el.innerHTML = files.map((f, i) => `
    <div style="display:flex;align-items:center;gap:.5rem;padding:.35rem 0;border-bottom:1px solid var(--gray-100)">
      <span style="flex:1;font-size:.875rem">📄 ${escHtml(f.name)}</span>
      <button class="btn btn-danger btn-sm" onclick="removeDownloadFile(${i})">✕</button>
    </div>`).join('');
}

function removeDownloadFile(idx) {
  if (!editingTest) return;
  editingTest.downloads.splice(idx, 1);
  renderDlFileList();
}

async function checkOtpWarning() {
  const warn = qs('#otpNotConfiguredWarn');
  if (!warn) return;
  if (!qs('#editorRequireOTP').checked) { warn.style.display = 'none'; return; }
  const cfg = await DB.getEmailJS();
  warn.style.display = (!cfg || !cfg.serviceId) ? '' : 'none';
}

function updateEmailCount() {
  const emails = parseAllowedEmails();
  const badge  = qs('#emailCountBadge');
  if (emails.length > 0) {
    badge.style.display = '';
    qs('#emailCountText').textContent = `${emails.length} email${emails.length > 1 ? 's' : ''} allowed`;
  } else {
    badge.style.display = 'none';
  }
}

function parseAllowedEmails() {
  return (qs('#editorAllowedEmails').value || '')
    .split('\n').map(e => e.trim().toLowerCase()).filter(e => e.length > 0);
}

function renderQList() {
  const container = qs('#qList');
  const qs2 = editingTest.questions || [];

  if (!qs2.length) {
    container.innerHTML = `<div style="text-align:center;padding:2rem;color:var(--gray-400);font-size:.875rem">No questions yet. Add one below.</div>`;
    return;
  }

  const typeLabels = { single: 'Multiple Choice', truefalse: 'True / False', fillblank: 'Fill in the Blank', multi: 'Multi-Select' };
  container.innerHTML = qs2.map((q, i) => `
    <div class="q-editor">
      <div class="q-editor-header">
        <div class="q-number-badge">${i + 1}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:.875rem;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(q.text || '(empty)')}</div>
          <div class="q-type-tag">${typeLabels[q.type] || q.type} · ${q.points || 1} pt</div>
        </div>
        <div style="display:flex;gap:.3rem;flex-shrink:0">
          <button class="btn btn-secondary btn-sm" onclick="editQuestion(${i})">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="removeQuestion(${i})">✕</button>
        </div>
      </div>
    </div>`).join('');
}

/* ── Save test ── */
document.getElementById('saveTestBtn').onclick = async function() {
  const title = qs('#editorTitle').value.trim();
  if (!title) { toast('Test title is required.', 'danger'); return; }
  if (!parseAllowedEmails().length) { toast('At least one allowed email is required.', 'danger'); return; }

  this.disabled    = true;
  this.textContent = 'Saving…';

  editingTest.title         = title;
  editingTest.description   = qs('#editorDesc').value.trim();
  editingTest.timeLimit     = parseInt(qs('#editorTime').value) || 0;
  editingTest.passingScore  = parseInt(qs('#editorPassing').value) || 0;
  editingTest.allowedEmails = parseAllowedEmails();
  editingTest.isPrivate     = qs('#editorPrivate').checked;
  editingTest.requireOTP    = qs('#editorRequireOTP').checked;
  editingTest.downloads     = editingTest.downloads || [];
  const examSel             = qs('#editorExaminer');
  editingTest.examinerId    = examSel.value || '';
  editingTest.examinerName  = examSel.value ? (examSel.selectedOptions[0]?.dataset.name || '') : '';

  await DB.upsertTest(editingTest);
  const otpStatus = editingTest.requireOTP ? 'Email OTP: ON' : 'Email OTP: OFF';
  toast(`Test saved! (${otpStatus})`);

  editingTest = null;
  this.disabled    = false;
  this.textContent = 'Save Test';
  navigate('tests');
};

/* ── Publish toggle ── */
async function togglePublish(id) {
  const t = await DB.getTest(id);
  if (!t) return;
  if (!t.published && !t.questions?.length) { toast('Add at least one question before publishing.', 'warning'); return; }
  t.published = !t.published;
  await DB.upsertTest(t);
  renderTestsList();
  toast(t.published ? 'Test published!' : 'Test moved to draft.');
}

/* ── Delete test ── */
async function deleteTest(id) {
  const t    = await DB.getTest(id);
  if (!t) return;
  const subs = await DB.getTestSubs(id);
  if (!confirm(`Delete "${t.title}"? This will also remove all ${subs.length} submission(s). This cannot be undone.`)) return;
  await DB.deleteTest(id);
  renderTestsList();
  toast('Test deleted.', 'warning');
}

/* ── Export test questions as CSV template ── */
async function exportTestTemplate(id) {
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

/* ── Copy share link ── */
function copyLink(id) {
  const url = `${location.origin}${location.pathname.replace('admin.html', '')}test.html?id=${id}`;
  navigator.clipboard.writeText(url).then(() => toast('Link copied!')).catch(() => { prompt('Copy this link:', url); });
}

function copyDlLink(id) {
  const url = `${location.origin}${location.pathname.replace('admin.html', '')}downloads.html?test=${id}`;
  navigator.clipboard.writeText(url).then(() => toast('Download link copied!')).catch(() => { prompt('Copy this link:', url); });
}

/* ── Question modal ── */
qs('#addQBtn').addEventListener('click', () => openQModal(null));

function editQuestion(idx) { openQModal(idx); }

function removeQuestion(idx) {
  if (!confirm('Remove this question?')) return;
  editingTest.questions.splice(idx, 1);
  renderQList();
}

function openQModal(idx) {
  editingQIdx = idx;
  const q = idx !== null ? editingTest.questions[idx] : { type: 'single', text: '', points: 1, options: ['', ''], correctIndex: 0 };

  qs('#qModalTitle').textContent = idx !== null ? 'Edit Question' : 'Add Question';
  qs('#qType').value    = q.type || 'single';
  qs('#qText').value    = q.text || '';
  qs('#qPoints').value  = q.points || 1;
  qs('#qExplain').value = q.explanation || '';

  renderQTypeFields(q);
  qs('#qModalOverlay').style.display = 'flex';

  qs('#qType').onchange = () => {
    const defaults = {
      single:    { options: ['', ''], correctIndex: 0 },
      truefalse: { correctBool: true },
      fillblank: { correctText: '' },
      multi:     { options: ['', ''], correctIndices: [0] }
    };
    renderQTypeFields({ type: qs('#qType').value, ...defaults[qs('#qType').value] });
  };
}

function renderQTypeFields(q) {
  const type    = q.type || qs('#qType').value;
  const fieldsEl = qs('#qTypeFields');

  if (type === 'single') {
    const opts = q.options?.length ? q.options : ['', ''];
    fieldsEl.innerHTML = `
      <div class="form-group">
        <label class="form-label">Options <span class="req">*</span></label>
        <div id="optList">${opts.map((o, i) => optRowHtml(i, o, q.correctIndex === i)).join('')}</div>
        <button type="button" class="btn btn-ghost btn-sm" style="margin-top:.4rem" onclick="addOptRow()">+ Add Option</button>
        <div class="form-hint">Select the radio button next to the correct answer.</div>
      </div>`;
  } else if (type === 'multi') {
    const opts    = q.options?.length ? q.options : ['', ''];
    const correct = q.correctIndices || [0];
    fieldsEl.innerHTML = `
      <div class="form-group">
        <label class="form-label">Options <span class="req">*</span></label>
        <div id="optList">${opts.map((o, i) => optRowHtmlMulti(i, o, correct.includes(i))).join('')}</div>
        <button type="button" class="btn btn-ghost btn-sm" style="margin-top:.4rem" onclick="addOptRow()">+ Add Option</button>
        <div class="form-hint">Check all correct answers.</div>
      </div>`;
  } else if (type === 'truefalse') {
    fieldsEl.innerHTML = `
      <div class="form-group">
        <label class="form-label">Correct Answer <span class="req">*</span></label>
        <div style="display:flex;gap:1rem;margin-top:.25rem">
          <label class="option-label" style="flex:1"><input type="radio" name="tfCorrect" value="true" ${q.correctBool !== false ? 'checked' : ''}> True</label>
          <label class="option-label" style="flex:1"><input type="radio" name="tfCorrect" value="false" ${q.correctBool === false ? 'checked' : ''}> False</label>
        </div>
      </div>`;
  } else if (type === 'fillblank') {
    fieldsEl.innerHTML = `
      <div class="form-group">
        <label class="form-label">Correct Answer <span class="req">*</span></label>
        <input type="text" id="fibAnswer" class="form-control" value="${escHtml(q.correctText || '')}" placeholder="Accepted answer (case-insensitive)">
      </div>`;
  }
}

function optRowHtml(i, val, checked) {
  return `<div class="option-row" id="optRow_${i}">
    <input type="radio" name="optCorrect" value="${i}" class="option-correct-check" ${checked ? 'checked' : ''} title="Mark as correct">
    <input type="text" class="form-control" id="opt_${i}" value="${escHtml(val)}" placeholder="Option ${i + 1}">
    <button type="button" class="btn btn-ghost btn-sm" onclick="removeOptRow(${i})" title="Remove">✕</button>
  </div>`;
}

function optRowHtmlMulti(i, val, checked) {
  return `<div class="option-row" id="optRow_${i}">
    <input type="checkbox" name="optCorrect" value="${i}" class="option-correct-check" ${checked ? 'checked' : ''} title="Mark as correct">
    <input type="text" class="form-control" id="opt_${i}" value="${escHtml(val)}" placeholder="Option ${i + 1}">
    <button type="button" class="btn btn-ghost btn-sm" onclick="removeOptRow(${i})" title="Remove">✕</button>
  </div>`;
}

function addOptRow() {
  const list = qs('#optList');
  const rows = qsa('.option-row', list);
  const i    = rows.length;
  const type = qs('#qType').value;
  const div  = document.createElement('div');
  div.innerHTML = type === 'multi' ? optRowHtmlMulti(i, '', false) : optRowHtml(i, '', false);
  list.appendChild(div.firstElementChild);
}

function removeOptRow(i) {
  const row = qs(`#optRow_${i}`);
  if (row) row.remove();
  qsa('.option-row', qs('#optList')).forEach((r, ni) => {
    r.id = `optRow_${ni}`;
    const radio = r.querySelector('input[type="radio"],input[type="checkbox"]');
    const text  = r.querySelector('input[type="text"]');
    const btn   = r.querySelector('button');
    if (radio) radio.value = ni;
    if (text)  { text.id = `opt_${ni}`; text.placeholder = `Option ${ni + 1}`; }
    if (btn)   btn.setAttribute('onclick', `removeOptRow(${ni})`);
  });
}

/* ── Save question ── */
qs('#saveQBtn').addEventListener('click', () => {
  const type        = qs('#qType').value;
  const text        = qs('#qText').value.trim();
  const points      = parseInt(qs('#qPoints').value) || 1;
  const explanation = qs('#qExplain').value.trim();

  if (!text) { toast('Question text is required.', 'danger'); return; }

  const q = { type, text, points, explanation };

  if (type === 'single') {
    const rows     = qsa('.option-row', qs('#optList'));
    const options  = rows.map(r => r.querySelector('input[type="text"]').value.trim());
    const correctEl = qs('input[name="optCorrect"]:checked');
    if (!correctEl) { toast('Select the correct answer.', 'danger'); return; }
    if (options.some(o => !o)) { toast('All options must have text.', 'danger'); return; }
    q.options      = options;
    q.correctIndex = rows.findIndex(r => r.querySelector('input[type="radio"]') === correctEl);
  } else if (type === 'multi') {
    const rows        = qsa('.option-row', qs('#optList'));
    const options     = rows.map(r => r.querySelector('input[type="text"]').value.trim());
    const checkedEls  = qsa('input[name="optCorrect"]:checked');
    if (!checkedEls.length) { toast('Select at least one correct answer.', 'danger'); return; }
    if (options.some(o => !o)) { toast('All options must have text.', 'danger'); return; }
    q.options         = options;
    q.correctIndices  = checkedEls.map(el => parseInt(el.value));
  } else if (type === 'truefalse') {
    const checked = qs('input[name="tfCorrect"]:checked');
    if (!checked) { toast('Select True or False.', 'danger'); return; }
    q.correctBool = checked.value === 'true';
  } else if (type === 'fillblank') {
    const ans = qs('#fibAnswer').value.trim();
    if (!ans) { toast('Enter the correct answer.', 'danger'); return; }
    q.correctText = ans;
  }

  if (editingQIdx !== null) {
    editingTest.questions[editingQIdx] = q;
  } else {
    editingTest.questions.push(q);
  }

  closeQModal();
  renderQList();
  toast(editingQIdx !== null ? 'Question updated.' : 'Question added.');
  editingQIdx = null;
});

function closeQModal() { qs('#qModalOverlay').style.display = 'none'; }
qs('#qModalClose').addEventListener('click', closeQModal);
qs('#qModalCancel').addEventListener('click', closeQModal);
qs('#qModalOverlay').addEventListener('click', e => { if (e.target === qs('#qModalOverlay')) closeQModal(); });

/* ── Results view ── */
async function renderResultsList() {
  const tbody = qs('#resultsTableBody');
  tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--gray-400)">Loading…</td></tr>`;

  const [tests, allSubs, examiners] = await Promise.all([DB.getTests(), DB.getSubs(), DB.getExaminers()]);
  _tests = tests; _subs = allSubs;

  qs('#statTests').textContent     = tests.length;
  qs('#statPublished').textContent = tests.filter(t => t.published).length;
  qs('#statSubs').textContent      = allSubs.length;
  const passCount = allSubs.filter(s => s.passed === true).length;
  qs('#statPass').textContent      = allSubs.length ? Math.round((passCount / allSubs.length) * 100) + '%' : '—';

  const currentTestFilter = qs('#resultTestFilter').value;
  qs('#resultTestFilter').innerHTML = `<option value="">All Tests</option>` +
    tests.map(t => `<option value="${t.id}" ${t.id === currentTestFilter ? 'selected' : ''}>${escHtml(t.title)}</option>`).join('');
  if (currentTestFilter) qs('#resultTestFilter').value = currentTestFilter;

  // Populate examiner filter from unique examiners present in submissions
  const currentExamFilter = qs('#resultExaminerFilter').value;
  const examinerIds = [...new Set(allSubs.map(s => s.examinerId).filter(Boolean))];
  const examinerOpts = examinerIds.map(id => {
    const e = examiners.find(x => x.id === id);
    const name = e?.name || allSubs.find(s => s.examinerId === id)?.examinerName || id;
    return `<option value="${id}" ${id === currentExamFilter ? 'selected' : ''}>${escHtml(name)}</option>`;
  }).join('');
  qs('#resultExaminerFilter').innerHTML = `<option value="">All Examiners</option>` + examinerOpts;
  if (currentExamFilter) qs('#resultExaminerFilter').value = currentExamFilter;

  const filterTestId     = qs('#resultTestFilter').value;
  const filterExaminerId = qs('#resultExaminerFilter').value;
  let subs = allSubs;
  if (filterTestId)     subs = subs.filter(s => s.testId === filterTestId);
  if (filterExaminerId) subs = subs.filter(s => s.examinerId === filterExaminerId);

  if (!subs.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:2.5rem;color:var(--gray-400)">No submissions yet.</td></tr>`;
    return;
  }

  const sorted = [...subs].sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  tbody.innerHTML = sorted.map(s => {
    const t = tests.find(t => t.id === s.testId);
    const examinerName = s.examinerName
      || (t?.examinerId ? examiners.find(e => e.id === t.examinerId)?.name : null)
      || '';
    const examinerCell = examinerName
      ? escHtml(examinerName)
      : `<span style="color:var(--gray-400)">—</span>`;
    const passedBadge = s.passed === true
      ? `<span class="badge badge-success">Passed</span>`
      : s.passed === false
        ? `<span class="badge badge-danger">Failed</span>`
        : `<span class="badge badge-gray">Completed</span>`;
    return `
      <tr>
        <td>${escHtml(s.name)}</td>
        <td>${escHtml(s.email)}</td>
        <td>${escHtml(t?.title || '—')}</td>
        <td>${examinerCell}</td>
        <td><strong>${s.score}%</strong> <span style="color:var(--gray-400);font-size:.8rem">(${s.earned}/${s.total}pts)</span></td>
        <td>${passedBadge}</td>
        <td>${fmtDuration(s.timeTaken)}</td>
        <td>${fmtDate(s.submittedAt)}</td>
        <td><button class="btn btn-secondary btn-sm" onclick="viewSub('${s.id}')">View</button></td>
      </tr>`;
  }).join('');
}

qs('#resultTestFilter').addEventListener('change', renderResultsList);
qs('#resultExaminerFilter').addEventListener('change', renderResultsList);

qs('#clearResultsBtn').addEventListener('click', async () => {
  const filterTestId = qs('#resultTestFilter').value;
  const label = filterTestId ? 'results for this test' : 'ALL results';
  if (!confirm(`Are you sure you want to delete ${label}? This cannot be undone.`)) return;

  qs('#clearResultsBtn').disabled = true;
  await DB.clearSubs(filterTestId || null);
  qs('#clearResultsBtn').disabled = false;
  await renderResultsList();
  toast('Results cleared.', 'success');
});

qs('#exportCsvBtn').addEventListener('click', async () => {
  const allSubs          = await DB.getSubs();
  const filterTestId     = qs('#resultTestFilter').value;
  const filterExaminerId = qs('#resultExaminerFilter').value;
  let subs = allSubs;
  if (filterTestId)     subs = subs.filter(s => s.testId === filterTestId);
  if (filterExaminerId) subs = subs.filter(s => s.examinerId === filterExaminerId);

  if (!subs.length) { toast('No results to export.', 'warning'); return; }

  const [tests, examiners] = await Promise.all([DB.getTests(), DB.getExaminers()]);
  const rows  = [['Name', 'Email', 'Test', 'Examiner', 'Score (%)', 'Points Earned', 'Total Points', 'Status', 'Time Taken', 'Submitted At']];
  subs.forEach(s => {
    const t        = tests.find(t => t.id === s.testId);
    const examinerName = s.examinerName
      || (t?.examinerId ? examiners.find(e => e.id === t.examinerId)?.name : '')
      || '';
    const status   = s.passed === true ? 'Passed' : s.passed === false ? 'Failed' : 'Completed';
    rows.push([s.name, s.email, t?.title || '', examinerName, s.score, s.earned, s.total, status, fmtDuration(s.timeTaken), fmtDate(s.submittedAt)]);
  });
  downloadCsv(rows, `results_${Date.now()}.csv`);
  toast('CSV downloaded!');
});

/* ── Change password ── */
qs('#changePwBtn').addEventListener('click', async () => {
  const np  = qs('#newPw').value;
  const np2 = qs('#newPw2').value;
  const err = qs('#pwError');
  if (np.length < 4) { err.textContent = 'Minimum 4 characters.'; err.style.display = 'block'; return; }
  if (np !== np2)    { err.textContent = 'Passwords do not match.'; err.style.display = 'block'; return; }
  await DB.setPw(np);
  err.style.display = 'none';
  qs('#newPw').value = qs('#newPw2').value = '';
  toast('Password updated!');
});

qs('#logoutBtn').addEventListener('click', () => { adminSess.clear(); location.reload(); });

/* ── Examiner Domain Whitelist ── */
async function loadExaminerDomains() {
  const domains = await DB.getExaminerDomains();
  qs('#examinerDomainsInput').value = domains.join('\n');
}

document.getElementById('saveExaminerDomainsBtn').onclick = async function() {
  const domains = (qs('#examinerDomainsInput').value || '')
    .split('\n').map(d => d.trim().toLowerCase()).filter(d => d.length > 0);
  this.disabled = true;
  this.textContent = 'Saving…';
  try {
    await DB.setExaminerDomains(domains);
    toast(domains.length ? `${domains.length} domain${domains.length > 1 ? 's' : ''} saved.` : 'Domain restriction removed.');
  } catch(e) {
    alert('Save failed: ' + e.message);
  }
  this.disabled = false;
  this.textContent = 'Save Domains';
};

/* ── O365 Config ── */
async function loadO365Config() {
  const cfg   = await DB.getO365Config();
  const badge = qs('#o365StatusBadge');
  badge.style.display = '';
  if (cfg && cfg.clientId) {
    badge.innerHTML = '<span class="badge badge-success">O365 Sign-In Enabled</span>';
    qs('#o365ClientId').value = cfg.clientId  || '';
    qs('#o365TenantId').value = cfg.tenantId  || '';
    qs('#o365Domain').value   = cfg.domain    || '';
  } else {
    badge.innerHTML = '<span class="badge badge-gray">O365 Sign-In Disabled</span>';
    qs('#o365ClientId').value = qs('#o365TenantId').value = qs('#o365Domain').value = '';
  }
}

document.getElementById('saveO365Btn').onclick = async function() {
  const clientId = qs('#o365ClientId').value.trim();
  const tenantId = qs('#o365TenantId').value.trim() || 'common';
  const domain   = qs('#o365Domain').value.trim().toLowerCase();
  if (!clientId) { toast('Client ID is required.', 'danger'); return; }
  if (!domain)   { toast('Allowed domain is required.', 'danger'); return; }
  this.disabled = true; this.textContent = 'Saving…';
  try {
    await DB.setO365Config({ clientId, tenantId, domain });
    qs('#o365StatusBadge').style.display = '';
    qs('#o365StatusBadge').innerHTML = '<span class="badge badge-success">O365 Sign-In Enabled</span>';
    toast('O365 sign-in enabled for @' + domain);
  } catch(e) { alert('Save failed: ' + e.message); }
  this.disabled = false; this.textContent = 'Save & Enable';
};

document.getElementById('clearO365Btn').onclick = async function() {
  if (!confirm('Disable O365 sign-in? Examiners will need to use email/password.')) return;
  this.disabled = true;
  try {
    await DB.clearO365Config();
    qs('#o365StatusBadge').innerHTML = '<span class="badge badge-gray">O365 Sign-In Disabled</span>';
    qs('#o365ClientId').value = qs('#o365TenantId').value = qs('#o365Domain').value = '';
    toast('O365 sign-in disabled.', 'warning');
  } catch(e) { alert('Error: ' + e.message); }
  this.disabled = false;
};

/* ── EmailJS Config ── */
async function loadEmailJSConfig() {
  loadExaminerDomains();
  loadO365Config();
  const cfg    = await DB.getEmailJS();
  const badge  = qs('#ejsStatusBadge');
  badge.style.display = '';
  if (cfg && cfg.serviceId) {
    badge.innerHTML = '<span class="badge badge-success">OTP Enabled</span>';
    qs('#ejsServiceId').value  = cfg.serviceId  || '';
    qs('#ejsTemplateId').value = cfg.templateId || '';
    qs('#ejsPublicKey').value  = cfg.publicKey  || '';
  } else {
    badge.innerHTML = '<span class="badge badge-gray">OTP Disabled — test takers can start without email verification</span>';
    qs('#ejsServiceId').value = qs('#ejsTemplateId').value = qs('#ejsPublicKey').value = '';
  }
}

document.getElementById('saveEjsBtn').onclick = async function() {
  const serviceId  = document.getElementById('ejsServiceId').value.trim();
  const templateId = document.getElementById('ejsTemplateId').value.trim();
  const publicKey  = document.getElementById('ejsPublicKey').value.trim();
  if (!serviceId || !templateId || !publicKey) {
    alert('Please fill in all three EmailJS fields (Service ID, Template ID, Public Key).');
    return;
  }
  this.disabled = true;
  this.textContent = 'Saving…';
  try {
    await DB.setEmailJS({ serviceId, templateId, publicKey });
    qs('#ejsStatusBadge').style.display = '';
    qs('#ejsStatusBadge').innerHTML = '<span class="badge badge-success">OTP Enabled</span>';
    toast('EmailJS saved — OTP verification is now active.');
  } catch(e) {
    alert('Save failed: ' + e.message);
  }
  this.disabled = false;
  this.textContent = 'Save & Enable OTP';
};

document.getElementById('clearEjsBtn').onclick = async function() {
  if (!confirm('Disable OTP verification? Test takers will be able to start tests without email verification.')) return;
  this.disabled = true;
  try {
    await DB.clearEmailJS();
    qs('#ejsStatusBadge').innerHTML = '<span class="badge badge-gray">OTP Disabled</span>';
    qs('#ejsServiceId').value = qs('#ejsTemplateId').value = qs('#ejsPublicKey').value = '';
    toast('OTP verification disabled.', 'warning');
  } catch(e) {
    alert('Error: ' + e.message);
  }
  this.disabled = false;
};

/* ── Submission Detail ── */
function viewSub(subId) {
  const sub  = _subs.find(s => s.id === subId);
  const test = _tests.find(t => t.id === sub?.testId);
  if (!sub || !test) { toast('Could not load details.', 'danger'); return; }

  qs('#subDetailTitle').textContent = `${escHtml(sub.name)} — ${escHtml(test.title)}`;

  const statusBadge = sub.passed === true
    ? `<span class="badge badge-success">Passed</span>`
    : sub.passed === false
      ? `<span class="badge badge-danger">Failed</span>`
      : `<span class="badge badge-gray">Completed</span>`;

  const questions = test.questions || [];
  const answers   = sub.answers   || [];

  qs('#subDetailBody').innerHTML = `
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

  qs('#subDetailOverlay').style.display = 'flex';
}

function renderSubAnswer(q, idx, ans) {
  const correct   = ans?.correct;
  const given     = ans?.given;
  const cardStyle = correct
    ? 'border:1px solid #bbf7d0;background:#f0fdf4'
    : 'border:1px solid #fecaca;background:#fff7f7';
  const icon = correct ? '✓' : '✗';
  const iconColor = correct ? 'var(--success)' : 'var(--danger)';

  let bodyHtml = '';

  if (q.type === 'single') {
    bodyHtml = (q.options || []).map((opt, i) => {
      const sel = given === i, isAns = i === q.correctIndex;
      const bg  = sel && isAns  ? '#dcfce7;border-color:#86efac'
                : sel && !isAns ? '#fee2e2;border-color:#fca5a5'
                : isAns         ? '#f0fdf4;border-color:#86efac'
                : '';
      const prefix = sel ? (isAns ? '✓ ' : '✗ ') : isAns ? '→ ' : '○ ';
      return `<div class="option-label" style="margin-bottom:.3rem;${bg ? 'background:'+bg : ''}">${prefix}${escHtml(opt)}</div>`;
    }).join('');

  } else if (q.type === 'truefalse') {
    ['True','False'].forEach(v => {
      const val = v === 'True', sel = given === val, isAns = val === q.correctBool;
      const bg  = sel && isAns  ? '#dcfce7;border-color:#86efac'
                : sel && !isAns ? '#fee2e2;border-color:#fca5a5'
                : isAns         ? '#f0fdf4;border-color:#86efac' : '';
      const prefix = sel ? (isAns ? '✓ ' : '✗ ') : isAns ? '→ ' : '○ ';
      bodyHtml += `<div class="option-label" style="margin-bottom:.3rem;${bg ? 'background:'+bg : ''}">${prefix}${v}</div>`;
    });

  } else if (q.type === 'fillblank') {
    const userAns = given !== undefined && given !== null && given !== '' ? escHtml(String(given)) : '<em style="color:var(--gray-400)">No answer</em>';
    bodyHtml = `<div style="margin-bottom:.3rem">
      <span style="color:var(--gray-500);font-size:.8rem">Selected:</span>
      <strong style="color:${correct ? 'var(--success)' : 'var(--danger)'}">${userAns}</strong>
    </div>`;
    if (!correct) bodyHtml += `<div><span style="color:var(--gray-500);font-size:.8rem">Correct answer:</span> <strong style="color:var(--success)">${escHtml(q.correctText || '')}</strong></div>`;

  } else if (q.type === 'multi') {
    const givenArr   = Array.isArray(given) ? given : [];
    const correctArr = q.correctIndices || [];
    bodyHtml = (q.options || []).map((opt, i) => {
      const sel = givenArr.includes(i), isAns = correctArr.includes(i);
      const bg  = sel && isAns  ? '#dcfce7;border-color:#86efac'
                : sel && !isAns ? '#fee2e2;border-color:#fca5a5'
                : isAns         ? '#f0fdf4;border-color:#86efac' : '';
      const prefix = sel ? (isAns ? '✓ ' : '✗ ') : isAns ? '→ ' : '○ ';
      return `<div class="option-label" style="margin-bottom:.3rem;${bg ? 'background:'+bg : ''}">${prefix}${escHtml(opt)}</div>`;
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

qs('#subDetailClose').addEventListener('click', () => { qs('#subDetailOverlay').style.display = 'none'; });
qs('#subDetailOverlay').addEventListener('click', e => { if (e.target === qs('#subDetailOverlay')) qs('#subDetailOverlay').style.display = 'none'; });



/* ── Excel Import ── */
qs('#importExcelBtn').addEventListener('click', () => {
  if (typeof XLSX !== 'undefined') { qs('#excelFileInput').click(); return; }
  const btn = qs('#importExcelBtn');
  btn.textContent = 'Loading…';
  btn.disabled = true;
  const s = document.createElement('script');
  s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
  s.onload  = () => { btn.textContent = '↑ Import Excel'; btn.disabled = false; qs('#excelFileInput').click(); };
  s.onerror = () => { btn.textContent = '↑ Import Excel'; btn.disabled = false; toast('Failed to load Excel parser.', 'danger'); };
  document.head.appendChild(s);
});

qs('#excelFileInput').addEventListener('change', e => {
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

      editingTest.questions.push(q);
      imported++;
    }

    e.target.value = '';
    renderQList();
    if (imported) toast(`${imported} question${imported > 1 ? 's' : ''} imported!`);
    if (skipped)  toast(`${skipped} row${skipped > 1 ? 's' : ''} skipped (invalid format).`, 'warning');
  };
  reader.readAsBinaryString(file);
});

/* ── Download CSV Template ── */
qs('#dlTemplateBtn').addEventListener('click', () => {
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
});

/* ── Examiners Management ── */
async function renderExaminersList() {
  const tbody = qs('#examinersTableBody');
  tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:2rem;color:var(--gray-400)">Loading…</td></tr>`;
  const examiners = await DB.getExaminers();

  qs('#examStatTotal').textContent    = examiners.length;
  qs('#examStatPending').textContent  = examiners.filter(e => e.status === 'pending').length;
  qs('#examStatApproved').textContent = examiners.filter(e => e.status === 'approved').length;

  if (!examiners.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:2.5rem;color:var(--gray-400)">No examiner requests yet.</td></tr>`;
    return;
  }

  const statusBadge = s => s === 'approved'
    ? `<span class="badge badge-success">Approved</span>`
    : s === 'rejected'
      ? `<span class="badge badge-danger">Rejected</span>`
      : `<span class="badge badge-warning">Pending</span>`;

  tbody.innerHTML = examiners.map(e => `
    <tr>
      <td><strong>${escHtml(e.name)}</strong></td>
      <td>${escHtml(e.email)}</td>
      <td>${fmtDate(e.createdAt)}</td>
      <td>${statusBadge(e.status)}</td>
      <td>
        <div style="display:flex;gap:.4rem;flex-wrap:wrap">
          ${e.status !== 'approved' ? `<button class="btn btn-success btn-sm" onclick="examinerAction('approve','${e.id}')">Approve</button>` : ''}
          ${e.status !== 'rejected' ? `<button class="btn btn-warning btn-sm" onclick="examinerAction('reject','${e.id}')">Reject</button>` : ''}
          <button class="btn btn-danger btn-sm" onclick="examinerAction('delete','${e.id}')">Delete</button>
        </div>
      </td>
    </tr>`).join('');
}

async function examinerAction(action, id) {
  if (action === 'delete' && !confirm('Delete this examiner account? This cannot be undone.')) return;
  if (action === 'reject' && !confirm('Reject this examiner? They will not be able to access the portal.')) return;

  if (action === 'delete') {
    await DB.deleteExaminer(id);
    toast('Examiner deleted.', 'warning');
  } else {
    const examiners = await DB.getExaminers();
    const e = examiners.find(x => x.id === id);
    if (!e) return;
    e.status = action === 'approve' ? 'approved' : 'rejected';
    await DB.upsertExaminer(e);
    toast(action === 'approve' ? 'Examiner approved!' : 'Examiner rejected.', action === 'approve' ? 'success' : 'warning');
  }
  renderExaminersList();
}