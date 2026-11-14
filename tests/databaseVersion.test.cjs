const { test } = require('node:test');
const assert = require('node:assert/strict');
const { IDBFactory } = require('fake-indexeddb');
const load = require('./loadSource.cjs');

for (const version of [1, 4, 5]) {
  test(`opening stored database version ${version} preserves notes and supports saving`, async () => {
    const factory = new IDBFactory();
    const request = factory.open('studyvault-browser', version);
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore('notes', { keyPath: 'id', autoIncrement: true });
      db.createObjectStore('revisions', { keyPath: 'note_id' });
      if (version >= 4) {
        db.createObjectStore('revisionTasks', { keyPath: 'id' });
        db.createObjectStore('study', { keyPath: 'id' });
      }
      request.transaction.objectStore('notes').add({ id: 8, title: 'Existing note', module: 'IT3133',
        category: 'Lecture Slides', priority: 'Normal', tags: '', content: 'Keep this content',
        attachments: [{ name: 'test.txt', mimeType: 'text/plain', data: 'aGVsbG8=' }], updated_at: '2026-11-13T12:00:00Z' });
    };
    const db = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    db.close();
    const original = globalThis.indexedDB;
    const versions = [];
    globalThis.indexedDB = { open: (name, requestedVersion) => {
      versions.push(requestedVersion);
      return requestedVersion === undefined ? factory.open(name) : factory.open(name, requestedVersion);
    } };
    try {
      const store = load('src/data/browserVault.js', { './seed': { initialNotes: [] } });
      const before = (await store.readVault()).notes;
      assert.equal(before[0].title, 'Existing note');
      assert.equal(before[0].attachments[0].data, 'aGVsbG8=');
      await store.saveBrowserNote({ ...before[0], title: 'Edited note' });
      await store.saveBrowserNote({ title: 'New note', module: 'IT3133', category: 'Lecture Slides', priority: 'Normal', content: 'Saved', attachments: [] });
      const notes = (await store.readVault()).notes;
      assert.equal(notes.length, 2);
      assert.equal(notes.find(note => note.id === 8).title, 'Edited note');
      assert.equal(versions[0], undefined);
      assert.ok(versions.slice(1).every(requestedVersion => requestedVersion >= version));
      await store.saveBrowserStudyState({ settings: { darkMode: true }, flashcards: [], sessions: [], exams: [] });
      assert.equal((await store.readBrowserStudyState()).settings.darkMode, true);
    } finally { globalThis.indexedDB = original; }
  });
}
