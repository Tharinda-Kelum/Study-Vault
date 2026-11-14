import { initialNotes } from './seed';

let databasePromise;

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = resolve;
    transaction.onabort = () => reject(transaction.error || new Error('Storage operation was cancelled.'));
    transaction.onerror = () => reject(transaction.error);
  });
}

async function getDatabase() {
  if (!databasePromise) {
    databasePromise = (async () => {
      if (!globalThis.indexedDB) throw new Error('Browser storage is unavailable. Open the app in a regular browser window.');
      const request = indexedDB.open('studyvault-browser', 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        const notes = db.createObjectStore('notes', { keyPath: 'id', autoIncrement: true });
        db.createObjectStore('revisions', { keyPath: 'note_id' });
        const now = new Date().toISOString();
        for (const note of initialNotes) {
          notes.add({ ...note, attachments: [], created_at: now, updated_at: now });
        }
      };
      const db = await requestResult(request);
      db.onversionchange = () => { db.close(); databasePromise = undefined; };
      return db;
    })().catch(error => { databasePromise = undefined; throw error; });
  }
  return databasePromise;
}

export async function readVault() {
  const db = await getDatabase();
  const transaction = db.transaction(['notes', 'revisions'], 'readonly');
  const done = transactionDone(transaction);
  const [notes, revisions] = await Promise.all([
    requestResult(transaction.objectStore('notes').getAll()),
    requestResult(transaction.objectStore('revisions').getAll()),
    done,
  ]);
  notes.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  revisions.sort((a, b) => b.note_id - a.note_id);
  return { notes, revisions };
}

async function writeVault(stores, mutate) {
  const db = await getDatabase();
  const transaction = db.transaction(stores, 'readwrite');
  const done = transactionDone(transaction);
  mutate(transaction);
  await done;
}

export async function saveBrowserNote(note) {
  const now = new Date().toISOString();
  await writeVault(['notes'], transaction => {
    const store = transaction.objectStore('notes');
    const values = { title: note.title, module: note.module, category: note.category, priority: note.priority,
      code: note.code || '', output: note.output || '', tags: note.tags || '', content: note.content || '', attachments: note.attachments || [], updated_at: now };
    if (note.id) {
      const request = store.get(note.id);
      request.onsuccess = () => {
        if (!request.result) { transaction.abort(); return; }
        store.put({ ...request.result, ...values });
      };
    } else {
      store.add({ ...values, favorite: 0, created_at: now });
    }
  });
}

export async function deleteBrowserNote(id) {
  await writeVault(['notes', 'revisions'], transaction => {
    transaction.objectStore('notes').delete(id);
    transaction.objectStore('revisions').delete(id);
  });
}

export async function toggleBrowserFavorite(id) {
  await writeVault(['notes'], transaction => {
    const store = transaction.objectStore('notes');
    const request = store.get(id);
    request.onsuccess = () => {
      if (!request.result) { transaction.abort(); return; }
      store.put({ ...request.result, favorite: request.result.favorite ? 0 : 1, updated_at: new Date().toISOString() });
    };
  });
}

export async function saveBrowserRevision(noteId, completed, reflection) {
  await writeVault(['notes', 'revisions'], transaction => {
    const request = transaction.objectStore('notes').get(noteId);
    request.onsuccess = () => {
      if (!request.result) { transaction.abort(); return; }
      transaction.objectStore('revisions').put({ note_id: noteId, completed: completed ? 1 : 0,
        reflection, updated_at: new Date().toISOString() });
    };
  });
}
