document.addEventListener('DOMContentLoaded', async () => {
  const grid    = qs('#testsGrid');
  const empty   = qs('#emptyState');
  const countEl = qs('#testCount');
  const search  = qs('#searchInput');

  grid.innerHTML = '<div style="text-align:center;padding:3rem;color:var(--gray-400)">Loading tests…</div>';

  await window.seedReady;

  async function render(filter) {
    filter = (filter || '').toLowerCase();
    const tests = (await DB.getPublished()).filter(t =>
      !filter ||
      t.title.toLowerCase().includes(filter) ||
      (t.description || '').toLowerCase().includes(filter)
    );

    countEl.textContent = `${tests.length} test${tests.length !== 1 ? 's' : ''}`;

    if (!tests.length) {
      grid.innerHTML = '';
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';

    grid.innerHTML = tests.map(t => {
      const qCount  = (t.questions || []).length;
      const timeStr = t.timeLimit ? `${t.timeLimit} min` : 'No limit';
      return `
        <div class="test-card" onclick="location.href='test.html?id=${t.id}'">
          <div class="test-card-title">${escHtml(t.title)}</div>
          <div class="test-card-desc">${escHtml(t.description || 'No description provided.')}</div>
          <div class="test-card-meta">
            <span>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              ${escHtml(timeStr)}
            </span>
            <span>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 12h6M9 16h6M9 8h6M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
              ${qCount} question${qCount !== 1 ? 's' : ''}
            </span>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-top:auto">
            <span class="badge badge-${t.passingScore ? 'primary' : 'gray'}">
              ${t.passingScore ? `Pass: ${t.passingScore}%` : 'No pass score'}
            </span>
            <span class="btn btn-primary btn-sm">Start Test →</span>
          </div>
        </div>`;
    }).join('');
  }

  await render();

  let debounce;
  search.addEventListener('input', e => {
    clearTimeout(debounce);
    debounce = setTimeout(() => render(e.target.value), 220);
  });
});
