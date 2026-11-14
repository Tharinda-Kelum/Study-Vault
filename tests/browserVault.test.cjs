require('fake-indexeddb/auto');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const babel = require('@babel/core');

function loadStore() {
  const module = { exports: {} };
  const code = babel.transformSync(fs.readFileSync('src/data/browserVault.js', 'utf8'), {
    configFile: false, babelrc: false, plugins: ['@babel/plugin-transform-modules-commonjs'],
  }).code;
  new Function('require', 'module', 'exports', code)(() => ({ initialNotes: [] }), module, module.exports);
  return module.exports;
}

test('browser storage retries, persists attachments across reloads, and preserves note operations', async () => {
  const store = loadStore();
  const storage = globalThis.indexedDB;
  globalThis.indexedDB = undefined;
  await assert.rejects(store.readVault(), /storage is unavailable/);
  globalThis.indexedDB = storage;

  const note = { title: 'Lecture', module: 'IT3133', category: 'Lecture Slides', priority: 'Normal',
    content: '', tags: '', attachments: [{ name: 'lecture.pdf', mimeType: 'application/pdf', data: 'JVBERg==' }] };
  await store.saveBrowserNote(note);
  const reloadedStore = loadStore();
  let { notes } = await reloadedStore.readVault();
  assert.equal(notes.length, 1);
  assert.deepEqual(notes[0].attachments, note.attachments);
  assert.equal(notes[0].content, '');
  const id = notes[0].id;

  await reloadedStore.toggleBrowserFavorite(id);
  await reloadedStore.saveBrowserNote({ ...notes[0], title: 'Edited' });
  notes = (await reloadedStore.readVault()).notes;
  assert.equal(notes[0].favorite, 1);
  assert.equal(notes[0].title, 'Edited');
  assert.deepEqual(notes[0].attachments, note.attachments);

  await reloadedStore.saveBrowserRevision(id, true, 'Review chapter 2');
  await reloadedStore.saveBrowserRevision(id, false, 'Updated reflection');
  const { revisions } = await reloadedStore.readVault();
  assert.equal(revisions.length, 1);
  assert.equal(revisions[0].completed, 0);
  assert.equal(revisions[0].reflection, 'Updated reflection');

  await reloadedStore.saveBrowserNote({ ...notes[0], content: 'Description', attachments: [] });
  assert.deepEqual((await reloadedStore.readVault()).notes[0].attachments, []);
  await reloadedStore.deleteBrowserNote(id);
  assert.deepEqual(await reloadedStore.readVault(), { notes: [], revisions: [] });
  await assert.rejects(reloadedStore.saveBrowserRevision(id, true, 'Deleted note'));
  assert.deepEqual(await loadStore().readVault(), { notes: [], revisions: [] });
});
