/* ── View router ── */
let currentView = 'tests', editingTest = null, editingQIdx = null;

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
  navigate('tests');
}

/* ── Navigation ── */
function navigate(view) {
  currentView = view;
  qsa('.admin-nav-item').forEach(el => el.classList.toggle('active', el.dataset.view === view));
  qsa('.admin-view').forEach(el => el.style.display = el.id === `view_${view}` ? '' : 'none');

  if (view === 'tests')   renderTestsList();
  if (view === 'results') renderResultsList();
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
          ${(t.allowedEmails||[]).length > 0 ? `<br><span class="badge badge-warning" style="margin-top:.25rem;font-size:.7rem">🔒 ${t.allowedEmails.length} allowed email${t.allowedEmails.length>1?'s':''}</span>` : ''}
        </td>
        <td>${qCount}</td>
        <td><span class="badge badge-${t.published ? 'success' : 'gray'}">${t.published ? 'Published' : 'Draft'}</span></td>
        <td>${subCounts[i]}</td>
        <td>${t.timeLimit ? t.timeLimit + ' min' : 'None'}</td>
        <td>
          <div style="display:flex;gap:.4rem;flex-wrap:wrap">
            <button class="btn btn-secondary btn-sm" onclick="openEditTest('${t.id}')">Edit</button>
            <button class="btn btn-${t.published ? 'warning' : 'success'} btn-sm" onclick="togglePublish('${t.id}')">${t.published ? 'Unpublish' : 'Publish'}</button>
            <button class="btn btn-ghost btn-sm" onclick="copyLink('${t.id}')">Copy Link</button>
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
  updateEmailCount();
  qs('#editorAllowedEmails').addEventListener('input', updateEmailCount);
  renderQList();
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

  const typeLabels = { mcq: 'Multiple Choice', truefalse: 'True / False', fillblank: 'Fill in the Blank', multi: 'Multi-Select' };
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
qs('#saveTestBtn').addEventListener('click', async () => {
  const title = qs('#editorTitle').value.trim();
  if (!title) { toast('Test title is required.', 'danger'); return; }

  const btn = qs('#saveTestBtn');
  btn.disabled    = true;
  btn.textContent = 'Saving…';

  editingTest.title         = title;
  editingTest.description   = qs('#editorDesc').value.trim();
  editingTest.timeLimit     = parseInt(qs('#editorTime').value) || 0;
  editingTest.passingScore  = parseInt(qs('#editorPassing').value) || 0;
  editingTest.allowedEmails = parseAllowedEmails();

  await DB.upsertTest(editingTest);
  editingTest = null;
  btn.disabled    = false;
  btn.textContent = 'Save Test';
  toast('Test saved!');
  navigate('tests');
});

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

/* ── Copy share link ── */
function copyLink(id) {
  const url = `${location.origin}${location.pathname.replace('admin.html', '')}test.html?id=${id}`;
  navigator.clipboard.writeText(url).then(() => toast('Link copied!')).catch(() => { prompt('Copy this link:', url); });
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
  const q = idx !== null ? editingTest.questions[idx] : { type: 'mcq', text: '', points: 1, options: ['', ''], correctIndex: 0 };

  qs('#qModalTitle').textContent = idx !== null ? 'Edit Question' : 'Add Question';
  qs('#qType').value    = q.type || 'mcq';
  qs('#qText').value    = q.text || '';
  qs('#qPoints').value  = q.points || 1;
  qs('#qExplain').value = q.explanation || '';

  renderQTypeFields(q);
  qs('#qModalOverlay').style.display = 'flex';

  qs('#qType').onchange = () => {
    const defaults = {
      mcq:       { options: ['', ''], correctIndex: 0 },
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

  if (type === 'mcq') {
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

  if (type === 'mcq') {
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
  tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--gray-400)">Loading…</td></tr>`;

  const [tests, allSubs] = await Promise.all([DB.getTests(), DB.getSubs()]);

  qs('#statTests').textContent     = tests.length;
  qs('#statPublished').textContent = tests.filter(t => t.published).length;
  qs('#statSubs').textContent      = allSubs.length;
  const passCount = allSubs.filter(s => s.passed === true).length;
  qs('#statPass').textContent      = allSubs.length ? Math.round((passCount / allSubs.length) * 100) + '%' : '—';

  const currentFilter = qs('#resultTestFilter').value;
  qs('#resultTestFilter').innerHTML = `<option value="">All Tests</option>` +
    tests.map(t => `<option value="${t.id}" ${t.id === currentFilter ? 'selected' : ''}>${escHtml(t.title)}</option>`).join('');
  if (currentFilter) qs('#resultTestFilter').value = currentFilter;

  const filterTestId = qs('#resultTestFilter').value;
  const subs = filterTestId ? allSubs.filter(s => s.testId === filterTestId) : allSubs;

  if (!subs.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:2.5rem;color:var(--gray-400)">No submissions yet.</td></tr>`;
    return;
  }

  const sorted = [...subs].sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  tbody.innerHTML = sorted.map(s => {
    const t = tests.find(t => t.id === s.testId);
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
        <td><strong>${s.score}%</strong> <span style="color:var(--gray-400);font-size:.8rem">(${s.earned}/${s.total}pts)</span></td>
        <td>${passedBadge}</td>
        <td>${fmtDuration(s.timeTaken)}</td>
        <td>${fmtDate(s.submittedAt)}</td>
      </tr>`;
  }).join('');
}

qs('#resultTestFilter').addEventListener('change', renderResultsList);

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
  const allSubs      = await DB.getSubs();
  const filterTestId = qs('#resultTestFilter').value;
  const subs         = filterTestId ? allSubs.filter(s => s.testId === filterTestId) : allSubs;

  if (!subs.length) { toast('No results to export.', 'warning'); return; }

  const tests = await DB.getTests();
  const rows  = [['Name', 'Email', 'Test', 'Score (%)', 'Points Earned', 'Total Points', 'Status', 'Time Taken', 'Submitted At']];
  subs.forEach(s => {
    const t      = tests.find(t => t.id === s.testId);
    const status = s.passed === true ? 'Passed' : s.passed === false ? 'Failed' : 'Completed';
    rows.push([s.name, s.email, t?.title || '', s.score, s.earned, s.total, status, fmtDuration(s.timeTaken), fmtDate(s.submittedAt)]);
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
      if (!text || !['mcq','truefalse','fillblank','multi'].includes(type)) { skipped++; continue; }

      const opts   = [get(2), get(3), get(4), get(5)].filter(o => o);
      const answer = get(6);
      const points = parseInt(get(7)) || 1;
      let q = { text, points };

      if (type === 'mcq') {
        if (!opts.length || !answer) { skipped++; continue; }
        const ansUp = answer.toUpperCase();
        let idx = ['A','B','C','D'].includes(ansUp) ? ['A','B','C','D'].indexOf(ansUp) : (parseInt(answer) || 0);
        if (idx >= opts.length) idx = 0;
        q = { ...q, type: 'mcq', options: opts, correctIndex: idx };

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
    ['mcq',       'What is 2 + 2?',               '3', '4', '5', '6',  'B',     '1'],
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
