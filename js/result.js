document.addEventListener('DOMContentLoaded', async () => {
  const subId = param('id');
  if (!subId) { location.href = 'index.html'; return; }

  const sub  = await DB.getSub(subId);
  const test = sub ? await DB.getTest(sub.testId) : null;

  if (!sub || !test) {
    document.body.innerHTML = `
      <div class="empty-state" style="margin-top:5rem">
        <h3>Result not found</h3>
        <p>This result may have been cleared from storage.</p>
        <a href="index.html" class="btn btn-primary" style="margin-top:1rem">Back to Tests</a>
      </div>`;
    return;
  }

  qs('#metaTestTitle').textContent = test.title;
  qs('#metaName').textContent      = sub.name;
  qs('#metaTime').textContent      = fmtDuration(sub.timeTaken);
  qs('#metaDate').textContent      = fmtDate(sub.submittedAt);
  qs('#backBtn').href               = 'index.html';
});
