const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');

test('SQLite migrates existing notes and saves code/output without changing whitespace', async () => {
  const source = fs.readFileSync('src/context/VaultContext.js', 'utf8');
  const db = new DatabaseSync(':memory:');
  db.exec("CREATE TABLE notes (id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL,module TEXT NOT NULL,category TEXT NOT NULL,priority TEXT NOT NULL,tags TEXT NOT NULL DEFAULT '',content TEXT NOT NULL,favorite INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL,updated_at TEXT NOT NULL); INSERT INTO notes (title,module,category,priority,content,created_at,updated_at) VALUES ('Existing','IT3133','Lecture Slides','Normal','Original','now','now')");
  const adapter = {
    execAsync: async sql => db.exec(sql),
    getAllAsync: async sql => db.prepare(sql).all(),
    getFirstAsync: async (sql,args=[]) => db.prepare(sql).get(...args),
    runAsync: async (sql, args) => db.prepare(sql).run(...args), closeAsync: async () => {},
  };
  const setup = source.slice(source.indexOf('let dbPromise'), source.indexOf('export function VaultProvider'));
  const save = source.slice(source.indexOf(' const saveNote='), source.indexOf(' const deleteNote='));
  const taskMethods = source.slice(source.indexOf(' const saveRevisionTask='), source.indexOf(' return <Context.Provider'));
  const api = new Function('SQLite', 'initialNotes', setup + 'const refresh=async()=>{};' + save + taskMethods + 'return {getDB,saveNote,saveRevisionTask,deleteRevisionTask};')({ openDatabaseAsync: async () => adapter }, []);
  try {
    await api.getDB();
    const existing = db.prepare('SELECT * FROM notes WHERE id=1').get();
    assert.equal(existing.content, 'Original');
    assert.equal(existing.code, '');
    assert.equal(existing.output, '');
    const note = { title: 'Snippet', module: 'IT3133', category: 'Code Snippets', priority: 'Normal', tags: '', content: '',
      code: '  console.log(`hello`);\n', output: 'hello\n', attachments: [] };
    await api.saveNote(note);
    const saved = db.prepare('SELECT * FROM notes WHERE id=2').get();
    assert.equal(saved.code, note.code);
    assert.equal(saved.output, note.output);
    await api.saveNote({ ...note, id: 2, code: 'console.log(2);', output: '2' });
    const edited = db.prepare('SELECT * FROM notes WHERE id=2').get();
    assert.equal(edited.code, 'console.log(2);');
    assert.equal(edited.output, '2');
    const task={note_id:2,id:'task-test',title:'Study chapter 2',module:'IT3133',completed:0,reflection:''};
    await api.saveRevisionTask(task);
    assert.equal(db.prepare('SELECT title FROM revision_tasks').get().title,task.title);
    assert.equal(db.prepare('SELECT note_id FROM revision_tasks').get().note_id,2);
    await api.saveRevisionTask({...task,completed:1});
    assert.equal(db.prepare('SELECT completed FROM revision_tasks').get().completed,1);
    await api.saveRevisionTask({...task,completed:0});
    assert.equal(db.prepare('SELECT completed FROM revision_tasks').get().completed,0);
    await assert.rejects(api.saveRevisionTask({...task,title:' '}),/Enter a revision task/);
    await api.saveRevisionTask({...task,note_id:null});
    assert.equal(db.prepare('SELECT note_id FROM revision_tasks').get().note_id,null);
    await assert.rejects(api.saveRevisionTask({...task,note_id:999}),/no longer exists/);
    await api.deleteRevisionTask(task.id);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM revision_tasks').get().n,0);
  } finally { db.close(); }
});
