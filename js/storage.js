const DB = {
  /* ── Tests ── */
  async getTests() {
    const snap = await db.collection('tests').get();
    return snap.docs.map(d => d.data()).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  },
  async getPublished() {
    const snap = await db.collection('tests').where('published', '==', true).get();
    return snap.docs.map(d => d.data());
  },
  async getTest(id) {
    const doc = await db.collection('tests').doc(id).get();
    return doc.exists ? doc.data() : null;
  },
  async upsertTest(test) {
    await db.collection('tests').doc(test.id).set(test);
  },
  async deleteTest(id) {
    const subs = await db.collection('submissions').where('testId', '==', id).get();
    const batch = db.batch();
    batch.delete(db.collection('tests').doc(id));
    subs.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
  },

  /* ── Submissions ── */
  async getSubs() {
    const snap = await db.collection('submissions').get();
    return snap.docs.map(d => d.data());
  },
  async getTestSubs(testId) {
    const snap = await db.collection('submissions').where('testId', '==', testId).get();
    return snap.docs.map(d => d.data());
  },
  async getSub(id) {
    const doc = await db.collection('submissions').doc(id).get();
    return doc.exists ? doc.data() : null;
  },
  async emailTook(testId, email) {
    const snap = await db.collection('submissions').where('testId', '==', testId).get();
    return snap.docs.some(d => d.data().email === email.toLowerCase());
  },
  async addSub(sub) {
    await db.collection('submissions').doc(sub.id).set(sub);
  },
  async clearSubs(testId) {
    const q = testId
      ? db.collection('submissions').where('testId', '==', testId)
      : db.collection('submissions');
    const snap = await q.get();
    if (!snap.empty) {
      const batch = db.batch();
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
  },

  /* ── Admin ── */
  async isConfigured() {
    const doc = await db.collection('config').doc('admin').get();
    return doc.exists && !!doc.data().pw;
  },
  async checkPw(pw) {
    const doc = await db.collection('config').doc('admin').get();
    return doc.exists && doc.data().pw === this._hash(pw);
  },
  async setPw(pw) {
    await db.collection('config').doc('admin').set({ pw: this._hash(pw) });
  },

  /* ── Seed ── */
  async isSeeded() {
    const doc = await db.collection('config').doc('seeded').get();
    return doc.exists;
  },
  async setSeeded() {
    await db.collection('config').doc('seeded').set({ v1: true });
  },

  _hash(s) {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = (((h << 5) + h) + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }
};
