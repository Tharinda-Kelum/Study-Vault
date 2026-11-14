import { initialNotes } from './seed';
import { validateTask } from './study';

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

const DATABASE_NAME = 'studyvault-browser';
const SCHEMA_VERSION = 4;
const REQUIRED_STORES = ['notes', 'revisions', 'revisionTasks', 'study'];

async function openDatabase(version) {
  const request = version === undefined
    ? indexedDB.open(DATABASE_NAME)
    : indexedDB.open(DATABASE_NAME, version);
      request.onupgradeneeded = event => {
        const db = request.result;
        if (!db.objectStoreNames.contains('study')) db.createObjectStore('study', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('notes')) {
          const notes = db.createObjectStore('notes', { keyPath: 'id', autoIncrement: true });

          const now = new Date().toISOString();
          for (const note of initialNotes) {
            notes.add({ ...note, attachments: [], created_at: now, updated_at: now });
          }
        }
        if (!db.objectStoreNames.contains('revisions')) db.createObjectStore('revisions', { keyPath: 'note_id' });
        if (!db.objectStoreNames.contains('revisionTasks')) {
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

  return new Promise((resolve, reject) => {
    let blocked = false;
    request.onblocked = () => {
      blocked = true;
      reject(new Error('Close other StudyVault tabs, then try again to finish updating storage.'));
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      if (blocked) { request.result.close(); return; }
      resolve(request.result);
    };
  });
}

async function getDatabase() {
  if (!databasePromise) {
    databasePromise = (async () => {
      if (!globalThis.indexedDB) throw new Error('Browser storage is unavailable. Open the app in a regular browser window.');
      // Open the stored version first so an older tab never requests a downgrade.
      let db = await openDatabase();
      if (db.version < SCHEMA_VERSION || REQUIRED_STORES.some(name => !db.objectStoreNames.contains(name))) {
        const nextVersion = Math.max(SCHEMA_VERSION, db.version + 1);
        db.close();
        db = await openDatabase(nextVersion);
      }
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
      folder: note.folder || '', chapter: note.chapter || '', code: note.code || '', output: note.output || '', tags: note.tags || '', content: note.content || '', attachments: note.attachments || [], updated_at: now };
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
  await writeVault(['notes', 'revisions', 'revisionTasks', 'study'], transaction => {
    transaction.objectStore('notes').delete(id);
    transaction.objectStore('revisions').delete(id);
    const request = transaction.objectStore('revisionTasks').openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      if (cursor.value.note_id === id) cursor.update({ ...cursor.value, note_id: null });
      cursor.continue();
    };
    const study = transaction.objectStore('study');
    const state = study.get('state');
    state.onsuccess = () => {
      if (state.result?.value?.flashcards) study.put({ ...state.result, value: { ...state.result.value,
        flashcards: state.result.value.flashcards.map(card => card.note_id === id ? { ...card, note_id: null } : card) } });
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
  task = validateTask(task);
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

export async function readBrowserStudyState() {
  const db = await getDatabase();
  const transaction = db.transaction('study', 'readonly');
  const done = transactionDone(transaction);
  const [row] = await Promise.all([requestResult(transaction.objectStore('study').get('state')), done]);
  return row?.value;
}

export async function saveBrowserStudyState(value) {
  await writeVault(['study'], transaction => transaction.objectStore('study').put({ id: 'state', value }));
}

export async function restoreBrowserVault(data) {
  await writeVault(['notes', 'revisionTasks', 'revisions', 'study'], transaction => {
    for (const name of ['notes', 'revisionTasks', 'revisions']) {
      const store = transaction.objectStore(name);
      store.clear();
      for (const row of data[name]) store.put(row);
    }
    transaction.objectStore('study').put({ id: 'state', value: data.studyState });
  });
}
