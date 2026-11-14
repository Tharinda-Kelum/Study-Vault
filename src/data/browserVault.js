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
      const request = indexedDB.open('studyvault-browser', 3);
      request.onupgradeneeded = event => {
        const db = request.result;
        if (event.oldVersion < 1) {
          const notes = db.createObjectStore('notes', { keyPath: 'id', autoIncrement: true });
          db.createObjectStore('revisions', { keyPath: 'note_id' });
          const now = new Date().toISOString();
          for (const note of initialNotes) {
            notes.add({ ...note, attachments: [], created_at: now, updated_at: now });
          }
        }
        if (event.oldVersion < 3) {
          const tasks = db.createObjectStore('revisionTasks', { keyPath: 'id' });
          const revisions = request.transaction.objectStore('revisions').openCursor();
          revisions.onsuccess = () => {
            const cursor = revisions.result;
            if (!cursor) return;
            const revision = cursor.value;
            const note = request.transaction.objectStore('notes').get(revision.note_id);
            note.onsuccess = () => {
              if (note.result) tasks.put({ id: `note-${revision.note_id}`, title: note.result.title,
                module: note.result.module, completed: revision.completed,
                reflection: revision.reflection, updated_at: revision.updated_at });
            };
            cursor.continue();
          };
        }
        const cursorRequest = request.transaction.objectStore('notes').openCursor();
        cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result;
          if (!cursor) return;
          if (cursor.value.category === 'Exam Formula Sheets') {
            cursor.update({ ...cursor.value, category: 'Chapter Short Note' });
          }
          cursor.continue();
        };
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
  const transaction = db.transaction(['notes', 'revisions', 'revisionTasks'], 'readonly');
  const done = transactionDone(transaction);
  const [notes, revisions, revisionTasks] = await Promise.all([
    requestResult(transaction.objectStore('notes').getAll()),
    requestResult(transaction.objectStore('revisions').getAll()),
    requestResult(transaction.objectStore('revisionTasks').getAll()),
    done,
  ]);
  notes.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  revisions.sort((a, b) => b.note_id - a.note_id);
  return { notes, revisions, revisionTasks };
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
  await writeVault(['notes', 'revisions', 'revisionTasks'], transaction => {
    transaction.objectStore('notes').delete(id);
    transaction.objectStore('revisions').delete(id);
    const request = transaction.objectStore('revisionTasks').openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      if (cursor.value.note_id === id) cursor.update({ ...cursor.value, note_id: null });
      cursor.continue();
    };
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

export async function saveBrowserRevisionTask(task) {
  if (!task.title.trim()) throw new Error('Enter a revision task.');
  await writeVault(['notes', 'revisionTasks'], transaction => {
    const save = () => transaction.objectStore('revisionTasks').put({ ...task, note_id: task.note_id || null, updated_at: new Date().toISOString() });
    if (task.note_id) {
      const request = transaction.objectStore('notes').get(task.note_id);
      request.onsuccess = () => {
        if (!request.result) { transaction.abort(); return; }
        save();
      };
    } else save();
  });
}

export async function deleteBrowserRevisionTask(id) {
  await writeVault(['revisionTasks'], transaction => transaction.objectStore('revisionTasks').delete(id));
}
