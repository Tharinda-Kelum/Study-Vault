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
  new Function('require', 'module', 'exports', code)(name => name==='./seed'?{initialNotes:[]}:require('./loadSource.cjs')('src/data/study.js'), module, module.exports);
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
  assert.deepEqual(await reloadedStore.readVault(), { notes: [], revisions: [], revisionTasks: [] });
  await assert.rejects(reloadedStore.saveBrowserRevision(id, true, 'Deleted note'));
  assert.deepEqual(await loadStore().readVault(), { notes: [], revisions: [], revisionTasks: [] });

  await store.saveBrowserNote(note);
  const linkedNoteId=(await store.readVault()).notes[0].id;
  const task = { note_id:linkedNoteId, id: 'task-test', title: 'Review chapter 3', module: 'IT3133', completed: 0, reflection: '' };
  await store.saveBrowserRevisionTask(task);
  assert.equal((await loadStore().readVault()).revisionTasks[0].title, task.title);
  assert.equal((await loadStore().readVault()).revisionTasks[0].note_id,linkedNoteId);
  await store.saveBrowserRevisionTask({ ...task, completed: 1 });
  assert.equal((await loadStore().readVault()).revisionTasks[0].completed, 1);
  await store.saveBrowserRevisionTask({ ...task, completed: 0 });
  assert.equal((await loadStore().readVault()).revisionTasks[0].completed, 0);
  await assert.rejects(store.saveBrowserRevisionTask({ ...task, title: ' ' }), /Enter a task/);
  await store.saveBrowserRevisionTask({...task,note_id:null});
  assert.equal((await loadStore().readVault()).revisionTasks[0].note_id,null);
  await store.saveBrowserRevisionTask(task);
  await store.deleteBrowserNote(linkedNoteId);
  const detached=(await loadStore().readVault()).revisionTasks[0];
  assert.equal(detached.note_id,null);
  assert.equal(detached.title,task.title);
  await assert.rejects(store.saveBrowserRevisionTask(task));
  await store.deleteBrowserRevisionTask(task.id);
  assert.deepEqual((await loadStore().readVault()).revisionTasks, []);
  const snippet = { ...note, category: 'Code Snippets', attachments: [],
    code: 'const value = `hello`;\n  console.log(value);\n', output: 'hello\n' };
  await store.saveBrowserNote(snippet);
  const saved = (await loadStore().readVault()).notes[0];
  assert.equal(saved.code, snippet.code);
  assert.equal(saved.output, snippet.output);
  await store.saveBrowserNote({ ...saved, code: 'console.log(2);', output: '2' });
  const edited = (await loadStore().readVault()).notes[0];
  assert.equal(edited.code, 'console.log(2);');
  assert.equal(edited.output, '2');
  await store.deleteBrowserNote(saved.id);
});
