require('fake-indexeddb/auto');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const babel = require('@babel/core');
const { DatabaseSync } = require('node:sqlite');

test('browser upgrade retains existing revision completion and reflections', async () => {
  const request = indexedDB.open('studyvault-browser', 2);
  request.onupgradeneeded = () => {
    const notes = request.result.createObjectStore('notes', { keyPath: 'id', autoIncrement: true });
    const revisions = request.result.createObjectStore('revisions', { keyPath: 'note_id' });
    notes.add({ id: 7, title: 'Chapter 2', module: 'IT3133', category: 'Exam Formula Sheets', updated_at: 'now' });
    revisions.add({ note_id: 7, completed: 1, reflection: 'Revise examples', updated_at: 'now' });
  };
  const old = await new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  old.close();
  const module = { exports: {} };
  const code = babel.transformSync(fs.readFileSync('src/data/browserVault.js', 'utf8'), {
    configFile: false, babelrc: false, plugins: ['@babel/plugin-transform-modules-commonjs'],
  }).code;
  new Function('require', 'module', 'exports', code)(name => name==='./seed'?{initialNotes:[]}:require('./loadSource.cjs')('src/data/study.js'), module, module.exports);
  const data = await module.exports.readVault();
  assert.equal(data.notes[0].category, 'Chapter Short Note');
  assert.deepEqual(data.revisionTasks, [{ id: 'note-7', title: 'Chapter 2', module: 'IT3133',
    completed: 1, reflection: 'Revise examples', updated_at: 'now' }]);
});

test('SQLite migrates old revisions once without recreating removed tasks', async () => {
  const db = new DatabaseSync(':memory:');
  const source = fs.readFileSync('src/context/VaultContext.js', 'utf8');
  db.exec(source.match(/execAsync\(`([\s\S]*?)`\)/)[1]);
  db.exec("INSERT INTO notes (title,module,category,priority,content,created_at,updated_at) VALUES ('Chapter 2','IT3133','Chapter Short Note','Normal','Notes','now','now'); INSERT INTO revisions (note_id,completed,reflection,updated_at) VALUES (1,1,'Revise examples','now')");
  const adapter = { execAsync: async sql => db.exec(sql), getAllAsync: async sql => db.prepare(sql).all(),
    getFirstAsync: async sql => db.prepare(sql).get(), runAsync: async (sql, args=[]) => db.prepare(sql).run(...args), closeAsync: async () => {} };
  const setup = source.slice(source.indexOf('let dbPromise'), source.indexOf('export function VaultProvider'));
  const load = () => new Function('SQLite', 'initialNotes', setup + 'return getDB;')({ openDatabaseAsync: async () => adapter }, [])();
  try {
    await load();
    const task = db.prepare('SELECT * FROM revision_tasks').get();
    assert.equal(task.title, 'Chapter 2');
    assert.equal(task.completed, 1);
    assert.equal(task.reflection, 'Revise examples');
    db.prepare('DELETE FROM revision_tasks WHERE id=?').run(task.id);
    await load();
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM revision_tasks').get().n, 0);
  } finally { db.close(); }
});
