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

  /* ── O365 / Azure AD Config ── */
  async getO365Config() {
    const doc = await db.collection('config').doc('o365').get();
    return doc.exists ? doc.data() : null;
  },
  async setO365Config(cfg) {
    await db.collection('config').doc('o365').set(cfg);
  },
  async clearO365Config() {
    await db.collection('config').doc('o365').delete();
  },

  /* ── Examiner Domain Whitelist ── */
  async getExaminerDomains() {
    const doc = await db.collection('config').doc('examinerDomains').get();
    return doc.exists ? (doc.data().domains || []) : [];
  },
  async setExaminerDomains(domains) {
    await db.collection('config').doc('examinerDomains').set({ domains });
  },

  /* ── EmailJS Config ── */
  async getEmailJS() {
    const doc = await db.collection('config').doc('emailjs').get();
    return doc.exists ? doc.data() : null;
  },
  async setEmailJS(cfg) {
    await db.collection('config').doc('emailjs').set(cfg);
  },
  async clearEmailJS() {
    await db.collection('config').doc('emailjs').delete();
  },

  /* ── Examiners ── */
  async getExaminers() {
    const snap = await db.collection('examiners').get();
    return snap.docs.map(d => d.data()).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  },
  async getExaminerByEmail(email) {
    const snap = await db.collection('examiners').where('email', '==', email).get();
    return snap.empty ? null : snap.docs[0].data();
  },
  async upsertExaminer(e) {
    await db.collection('examiners').doc(e.id).set(e);
  },
  async deleteExaminer(id) {
    await db.collection('examiners').doc(id).delete();
  },
  async getExaminerTests(examinerId) {
    const snap = await db.collection('tests').where('examinerId', '==', examinerId).get();
    return snap.docs.map(d => d.data()).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  },
  async getExaminerSubs(examinerId) {
    const snap = await db.collection('submissions').where('examinerId', '==', examinerId).get();
    return snap.docs.map(d => d.data());
  },

  /* ── Downloads ── */
  async getDownloads() {
    const snap = await db.collection('downloads').get();
    return snap.docs.map(d => d.data()).sort((a, b) => (b.uploadedAt || '').localeCompare(a.uploadedAt || ''));
  },
  async upsertDownload(dl) {
    await db.collection('downloads').doc(dl.id).set(dl);
  },
  async deleteDownload(id) {
    await db.collection('downloads').doc(id).delete();
  },

  /* ── Drive Files (metadata for public downloads page) ── */
  async getDriveFiles() {
    const snap = await db.collection('driveFiles').get();
    return snap.docs.map(d => d.data()).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  },
  async upsertDriveFile(f) {
    await db.collection('driveFiles').doc(f.id).set(f);
  },
  async deleteDriveFile(fileId) {
    await db.collection('driveFiles').doc(fileId).delete();
  },

  _hash(s) {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = (((h << 5) + h) + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }
};
