// Google Drive integration via Google Apps Script web app.
// Runs as versatestportal@gmail.com — zero browser OAuth popup, no billing needed.
const DRIVE = (() => {

  // Paste your Apps Script web app URL here after deploying (Step 4 below)
  const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxzQVpE8OQsDQ6YKDavS34QtKR_w5CIBx-6D5qvRqSg53VAu5c5n5r563zgBr2Eu9ak1A/exec';

  async function callScript(action, params) {
    if (!SCRIPT_URL || SCRIPT_URL.includes('PASTE')) {
      throw new Error('Apps Script URL not set in drive.js — follow setup guide');
    }
    const qs  = new URLSearchParams({ action, ...params }).toString();
    const res = await fetch(`${SCRIPT_URL}?${qs}`);
    if (!res.ok) throw new Error(`Script HTTP ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data;
  }

  function init() {}
  function isReady() { return true; }

  async function ensureTestFolder(test) {
    if (test.driveFolderId) return test.driveFolderId;
    const { folderId } = await callScript('createFolder', { name: test.title || test.id });
    return folderId;
  }

  async function listFolderFiles(folderId) {
    const { files } = await callScript('listFiles', { folderId });
    return files;
  }

  // Two-step upload: Apps Script creates a Drive resumable session URI,
  // browser streams bytes directly — no size limit, real progress.
  async function uploadFile(folderId, file, onProgress) {
    if (onProgress) onProgress(0.05);

    const { sessionUri } = await callScript('createUploadSession', {
      folderId,
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream'
    });

    if (onProgress) onProgress(0.1);

    const fileId = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', sessionUri);
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
      if (onProgress) {
        xhr.upload.onprogress = e => {
          if (e.lengthComputable) onProgress(0.1 + 0.85 * (e.loaded / e.total));
        };
      }
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try { resolve(JSON.parse(xhr.responseText).id); }
          catch (_) { reject(new Error('Invalid upload response')); }
        } else {
          reject(new Error(`Upload failed (${xhr.status})`));
        }
      };
      xhr.onerror = () => reject(new Error('Network error during upload'));
      xhr.send(file);
    });

    await callScript('setPublic', { fileId });
    if (onProgress) onProgress(1);
    return { id: fileId, name: file.name, size: file.size };
  }

  async function deleteFile(fileId) {
    await callScript('deleteFile', { fileId });
  }

  return { init, isReady, ensureTestFolder, listFolderFiles, uploadFile, deleteFile };
})();
