// Firebase Cloud Functions — Google Drive API proxy.
// Runs server-side using the Firebase App Engine service account.
// No browser OAuth popup needed — Drive access is fully silent.
const functions = require('firebase-functions');
const { google }  = require('googleapis');
const https       = require('https');

const PARENT_FOLDER = '11T-WLpE7RhbCEFQAVi1Zts7DJZFZBnrr';

async function getDrive() {
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/drive']
  });
  return google.drive({ version: 'v3', auth });
}

async function getAccessToken() {
  const auth   = new google.auth.GoogleAuth({ scopes: ['https://www.googleapis.com/auth/drive'] });
  const client = await auth.getClient();
  const t      = await client.getAccessToken();
  return t.token;
}

function wrap(e) {
  return new functions.https.HttpsError('internal', e.message || String(e));
}

// Create an exam subfolder inside the parent Drive folder
exports.driveCreateFolder = functions.https.onCall(async (data) => {
  try {
    const drive  = await getDrive();
    const res    = await drive.files.create({
      requestBody: {
        name:     data.name,
        mimeType: 'application/vnd.google-apps.folder',
        parents:  [PARENT_FOLDER]
      },
      fields: 'id'
    });
    const folderId = res.data.id;
    await drive.permissions.create({
      fileId:      folderId,
      requestBody: { role: 'reader', type: 'anyone' }
    });
    return { folderId };
  } catch (e) { throw wrap(e); }
});

// List files inside a specific folder
exports.driveListFiles = functions.https.onCall(async (data) => {
  try {
    const drive = await getDrive();
    const res   = await drive.files.list({
      q:       `'${data.folderId}' in parents and trashed=false`,
      fields:  'files(id,name,size,mimeType,createdTime)',
      orderBy: 'name'
    });
    return { files: res.data.files || [] };
  } catch (e) { throw wrap(e); }
});

// Create a Drive resumable upload session.
// Returns sessionUri — the browser uploads the file bytes directly to that URI
// (no size limit, real upload progress via XHR).
exports.driveCreateUploadSession = functions.https.onCall(async (data) => {
  try {
    const { folderId, fileName, mimeType } = data;
    const token    = await getAccessToken();
    const metadata = JSON.stringify({ name: fileName, parents: [folderId] });

    const sessionUri = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'www.googleapis.com',
        path:     '/upload/drive/v3/files?uploadType=resumable&fields=id,name,size',
        method:   'POST',
        headers:  {
          Authorization:          `Bearer ${token}`,
          'Content-Type':         'application/json; charset=UTF-8',
          'Content-Length':       Buffer.byteLength(metadata),
          'X-Upload-Content-Type': mimeType || 'application/octet-stream'
        }
      }, res => {
        if (res.statusCode !== 200) {
          reject(new Error(`Drive API ${res.statusCode}`));
          return;
        }
        const loc = res.headers['location'];
        if (!loc) reject(new Error('No Location header'));
        else resolve(loc);
      });
      req.on('error', reject);
      req.write(metadata);
      req.end();
    });

    return { sessionUri };
  } catch (e) { throw wrap(e); }
});

// Make a file publicly readable so anyone with the link can download it
exports.driveSetPublic = functions.https.onCall(async (data) => {
  try {
    const drive = await getDrive();
    await drive.permissions.create({
      fileId:      data.fileId,
      requestBody: { role: 'reader', type: 'anyone' }
    });
    return { ok: true };
  } catch (e) { throw wrap(e); }
});

// Delete a file from Drive
exports.driveDeleteFile = functions.https.onCall(async (data) => {
  try {
    const drive = await getDrive();
    await drive.files.delete({ fileId: data.fileId });
    return { ok: true };
  } catch (e) { throw wrap(e); }
});
