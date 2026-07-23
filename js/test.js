/* ── State ── */
let test = null, answers = {}, timerInterval = null, startedAt = null, secondsLeft = 0, currentQ = 0;

document.addEventListener('DOMContentLoaded', async () => {
  const testId = param('id');
  if (!testId) { location.href = 'index.html'; return; }

  await window.seedReady;
  test = await DB.getTest(testId);
  if (!test || !test.published) { showView('notFound'); return; }

  qs('#regTestTitle').textContent   = test.title;
  qs('#regDescription').textContent = test.description || '';

  const meta = [];
  if (test.timeLimit) meta.push(`⏱ ${test.timeLimit} minute${test.timeLimit > 1 ? 's' : ''}`);
  meta.push(`📝 ${(test.questions || []).length} question${(test.questions||[]).length !== 1 ? 's' : ''}`);
  if (test.passingScore) meta.push(`✅ Pass: ${test.passingScore}%`);
  qs('#regMeta').textContent = meta.join('  ·  ');

  showView('register');

  qs('#regForm').addEventListener('submit', handleRegister);
});

function showView(name) {
  ['notFound','register','testView'].forEach(v => {
    const el = qs(`#${v}`);
    if (el) el.style.display = v === name ? '' : 'none';
  });
}

async function handleRegister(e) {
  e.preventDefault();
  const name  = qs('#nameInput').value.trim();
  const email = qs('#emailInput').value.trim().toLowerCase();
  const errEl = qs('#regError');
  const btn   = qs('#regForm button[type="submit"]');

  if (!name || !email) { errEl.textContent = 'Please fill in all fields.'; errEl.style.display = 'block'; return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { errEl.textContent = 'Enter a valid email address.'; errEl.style.display = 'block'; return; }

  const allowed = test.allowedEmails || [];
  if (allowed.length > 0 && !allowed.includes(email)) {
    errEl.textContent = 'This email address is not registered for this test. Please contact your Versa proctor.';
    errEl.style.display = 'block';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Checking…';

  const took = await DB.emailTook(test.id, email);
  if (took) {
    errEl.textContent = 'This email has already taken this test. Each email can only attempt the test once.';
    errEl.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Start Test →';
    return;
  }

  errEl.style.display = 'none';
  sessionStorage.setItem('_tp_taker', JSON.stringify({ name, email }));
  startTest();
}

function startTest() {
  if (!test.questions || !test.questions.length) {
    showView('notFound');
    qs('#notFound').innerHTML = '<div class="empty-state"><h3>This test has no questions yet.</h3></div>';
    return;
  }

  currentQ = 0;
  test = Object.assign({}, test, {
    questions: [...test.questions].sort(() => Math.random() - 0.5)
  });
  showView('testView');
  qs('#tvTitle').textContent = test.title;
  startedAt = new Date().toISOString();

  renderQuestion();

  if (test.timeLimit) {
    secondsLeft = test.timeLimit * 60;
    updateTimerDisplay();
    timerInterval = setInterval(() => {
      secondsLeft--;
      updateTimerDisplay();
      if (secondsLeft <= 0) { clearInterval(timerInterval); handleSubmit(true); }
    }, 1000);
  } else {
    qs('#timerWrap').style.display = 'none';
  }
}

/* ── Render single question ── */
function renderQuestion() {
  const q     = test.questions[currentQ];
  const total = test.questions.length;

  qs('#progressBar').style.width  = Math.round(((currentQ) / total) * 100) + '%';
  qs('#progressText').textContent = `${currentQ + 1} / ${total}`;

  const container = qs('#questionsContainer');
  container.innerHTML = buildQuestionHtml(q, currentQ);
  wireInputs(q, currentQ);

  const isLast = currentQ === total - 1;
  qs('#prevBtn').style.display   = currentQ > 0 ? '' : 'none';
  qs('#nextBtn').style.display   = !isLast ? '' : 'none';
  qs('#submitBtn').style.display = isLast ? '' : 'none';

  restoreAnswer(q, currentQ);
}

function buildQuestionHtml(q, idx) {
  const pts = `<span class="question-points">${q.points || 1} pt${(q.points||1) > 1 ? 's' : ''}</span>`;
  let optionsHtml = '';

  if (q.type === 'mcq') {
    optionsHtml = (q.options || []).map((opt, i) => `
      <label class="option-label opt-label-${idx}" data-val="${i}">
        <input type="radio" name="q${idx}" value="${i}">
        <span>${escHtml(opt)}</span>
      </label>`).join('');
  } else if (q.type === 'multi') {
    optionsHtml = `<div class="form-hint" style="margin-bottom:.75rem">Select all that apply.</div>` +
      (q.options || []).map((opt, i) => `
        <label class="option-label opt-label-${idx}" data-val="${i}">
          <input type="checkbox" name="q${idx}" value="${i}">
          <span>${escHtml(opt)}</span>
        </label>`).join('');
  } else if (q.type === 'truefalse') {
    optionsHtml = ['True','False'].map(v => `
      <label class="option-label opt-label-${idx}" data-val="${v.toLowerCase()}">
        <input type="radio" name="q${idx}" value="${v.toLowerCase()}">
        <span>${v}</span>
      </label>`).join('');
  } else if (q.type === 'fillblank') {
    optionsHtml = `<div><input id="fib_${idx}" class="fill-blank-input" type="text" placeholder="Type your answer…" autocomplete="off"></div>`;
  }

  return `
    <div class="question-card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.4rem">
        <div class="question-number">Question ${idx + 1} of ${test.questions.length}</div>
        ${pts}
      </div>
      <div class="question-text">${escHtml(q.text)}</div>
      ${optionsHtml}
    </div>`;
}

function wireInputs(q, idx) {
  if (q.type === 'fillblank') {
    const inp = qs(`#fib_${idx}`);
    if (inp) inp.addEventListener('input', () => { answers[idx] = inp.value; });
  } else if (q.type === 'multi') {
    qsa(`input[name="q${idx}"]`).forEach(cb => {
      cb.addEventListener('change', () => {
        answers[idx] = qsa(`input[name="q${idx}"]:checked`).map(c => parseInt(c.value));
        qsa(`.opt-label-${idx}`).forEach(lbl => lbl.classList.toggle('selected', (answers[idx]||[]).includes(parseInt(lbl.dataset.val))));
      });
    });
  } else {
    qsa(`input[name="q${idx}"]`).forEach(radio => {
      radio.addEventListener('change', () => {
        answers[idx] = q.type === 'truefalse' ? (radio.value === 'true') : parseInt(radio.value);
        qsa(`.opt-label-${idx}`).forEach(lbl => lbl.classList.toggle('selected', lbl.dataset.val === radio.value));
      });
    });
  }
}

function restoreAnswer(q, idx) {
  const saved = answers[idx];
  if (saved === undefined || saved === null) return;

  if (q.type === 'fillblank') {
    const inp = qs(`#fib_${idx}`);
    if (inp) inp.value = saved;
  } else if (q.type === 'multi') {
    const vals = saved || [];
    qsa(`input[name="q${idx}"]`).forEach(cb => { cb.checked = vals.includes(parseInt(cb.value)); });
    qsa(`.opt-label-${idx}`).forEach(lbl => lbl.classList.toggle('selected', vals.includes(parseInt(lbl.dataset.val))));
  } else {
    const strVal = String(saved);
    qsa(`input[name="q${idx}"]`).forEach(radio => { radio.checked = radio.value === strVal; });
    qsa(`.opt-label-${idx}`).forEach(lbl => lbl.classList.toggle('selected', lbl.dataset.val === strVal));
  }
}

/* ── Navigation ── */
qs('#prevBtn') && qs('#prevBtn').addEventListener('click', () => {
  if (currentQ > 0) { currentQ--; renderQuestion(); window.scrollTo(0,0); }
});

qs('#nextBtn') && qs('#nextBtn').addEventListener('click', () => {
  if (currentQ < test.questions.length - 1) { currentQ++; renderQuestion(); window.scrollTo(0,0); }
});

function updateTimerDisplay() {
  const m  = Math.floor(secondsLeft / 60).toString().padStart(2,'0');
  const s  = (secondsLeft % 60).toString().padStart(2,'0');
  const el = qs('#timer');
  el.textContent = `⏱ ${m}:${s}`;
  el.className   = 'timer' + (secondsLeft < 60 ? ' danger' : secondsLeft < 180 ? ' warning' : '');
}

/* ── Submit ── */
async function handleSubmit(auto) {
  if (auto !== true) {
    const unanswered = test.questions.filter((_, i) => {
      const a = answers[i];
      if (a === undefined || a === null || a === '') return true;
      if (Array.isArray(a)) return a.length === 0;
      return false;
    }).length;
    if (unanswered > 0 && !confirm(`You have ${unanswered} unanswered question${unanswered > 1 ? 's' : ''}. Submit anyway?`)) return;
  }

  clearInterval(timerInterval);

  const submitBtn = qs('#submitBtn');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Submitting…'; }

  const taker       = JSON.parse(sessionStorage.getItem('_tp_taker') || '{}');
  const submittedAt = new Date().toISOString();
  const secs        = Math.round((new Date(submittedAt) - new Date(startedAt)) / 1000);

  let earned = 0, total = 0;
  const gradedAnswers = test.questions.map((q, i) => {
    const pts     = q.points || 1;
    total        += pts;
    const correct = isCorrect(q, answers[i]);
    if (correct) earned += pts;
    return { given: answers[i], correct };
  });

  const pct    = total ? Math.round((earned / total) * 100) : 0;
  const passed = test.passingScore ? pct >= test.passingScore : null;

  const sub = {
    id: uid(), testId: test.id,
    name: taker.name || 'Unknown', email: taker.email || '',
    score: pct, passed, earned, total,
    timeTaken: secs, startedAt, submittedAt, answers: gradedAnswers
  };

  await DB.addSub(sub);
  location.href = `result.html?id=${sub.id}`;
}

function isCorrect(q, given) {
  if (q.type === 'mcq')       return given === q.correctIndex;
  if (q.type === 'truefalse') return given === q.correctBool;
  if (q.type === 'fillblank') {
    if (given === undefined || given === null || given === '') return false;
    return String(given).trim().toLowerCase() === String(q.correctText || '').trim().toLowerCase();
  }
  if (q.type === 'multi') {
    const g = [...(given || [])].sort((a,b) => a - b);
    const c = [...(q.correctIndices || [])].sort((a,b) => a - b);
    return JSON.stringify(g) === JSON.stringify(c);
  }
  return false;
}
