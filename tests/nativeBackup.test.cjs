const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const study = require('./loadSource.cjs')('src/data/study.js');

test('SQLite backup restores all data atomically and keeps note links consistent', async () => {
  const db = new DatabaseSync(':memory:');
  const source = fs.readFileSync('src/context/VaultContext.js','utf8');
  let rejectWrite = false;
  const adapter = { execAsync: async sql=>db.exec(sql),getAllAsync:async sql=>db.prepare(sql).all(),getFirstAsync:async(sql,args=[])=>db.prepare(sql).get(...args),
    runAsync:async(sql,args=[])=>{if(rejectWrite&&sql.startsWith('INSERT INTO study_state'))throw new Error('Simulated disk failure');return db.prepare(sql).run(...args);},closeAsync:async()=>{},
    withTransactionAsync:async action=>{db.exec('BEGIN');try{await action();db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}} };
  const setup=source.slice(source.indexOf('let dbPromise'),source.indexOf('export function VaultProvider'));
  const restore=source.slice(source.indexOf(' const restoreBackup='),source.indexOf(' return <Context.Provider'));
  const deletion=source.slice(source.indexOf(' const deleteNote='),source.indexOf(' const toggleFavorite='));
  const api=new Function('SQLite','initialNotes','validateBackup','validateTask','normalizeStudyState',setup+'const refresh=async()=>{},studyQueue={current:Promise.resolve()};'+restore+deletion+'return{getDB,restoreBackup,deleteNote};')({openDatabaseAsync:async()=>adapter},[],study.validateBackup,study.validateTask,study.normalizeStudyState);
  const stamp='2026-11-13T12:00:00.000Z';
  const note={id:4,title:'Stored note',module:'IT3133',category:'Chapter Short Note',priority:'Normal',tags:'',content:'Hello',created_at:stamp,updated_at:stamp,attachments:[],folder:'Semester 1',chapter:'Chapter 3'};
  const task={id:'task1',title:'Review',module:'IT3133',note_id:4,completed:0,due_date:'2026-12-01',priority:'High',updated_at:stamp};
  const state={...study.emptyStudyState(),flashcards:[{id:'card1',module:'IT3133',question:'Q',answer:'A',note_id:4}]};
  const backup=study.makeBackup([note],[task],[],state);
  try{
    await api.restoreBackup(backup);
    assert.equal(db.prepare('SELECT folder FROM notes WHERE id=4').get().folder,'Semester 1');
    assert.equal(db.prepare('SELECT due_date FROM revision_tasks').get().due_date,'2026-12-01');
    rejectWrite=true;
    const replacement=structuredClone(backup);replacement.notes[0].title='Replacement';
    await assert.rejects(api.restoreBackup(replacement),/disk failure/);
    assert.equal(db.prepare('SELECT title FROM notes WHERE id=4').get().title,'Stored note');
    rejectWrite=false;
    await api.deleteNote(4);
    assert.equal(db.prepare('SELECT note_id FROM revision_tasks').get().note_id,null);
    assert.equal(JSON.parse(db.prepare('SELECT value FROM study_state').get().value).flashcards[0].note_id,null);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM notes').get().n,0);
  }finally{db.close();}
});
