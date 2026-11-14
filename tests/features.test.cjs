require('fake-indexeddb/auto');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./loadSource.cjs');
const study = load('src/data/study.js');
const store = load('src/data/browserVault.js', { './seed': { initialNotes: [] } });

test('dates and task schedules reject impossible dates and retain completion time', () => {
  assert.equal(study.validDate('2026-02-30'), false);
  assert.equal(study.validDate('2028-02-29'), true);
  assert.throws(() => study.validateTask({title:'Study',due_date:'2026-02-30'}), /due date/);
  assert.throws(() => study.validateTask({title:'Study',priority:'Urgent'}), /priority/);
  const complete=study.validateTask({title:'Study',completed:1});
  assert.ok(complete.completed_at);
  assert.equal(study.validateTask(complete).completed_at,complete.completed_at);
  assert.equal(study.validateTask({...complete,completed:0}).completed_at,'');
});

test('browser backup round-trip includes files, folders, deadlines, flashcards, sessions, exams, and theme', async () => {
  const date='2026-11-13T10:00:00.000Z';
  const note={id:100,title:'Backup note',module:'IT3133',category:'Chapter Short Note',priority:'Normal',tags:'test',content:'Notes',folder:'Semester 1',chapter:'Chapter 2',created_at:date,updated_at:date,attachments:[{name:'file.txt',mimeType:'text/plain',data:'aGVsbG8='}]};
  const task={id:'task-backup',title:'Review notes',module:'IT3133',note_id:100,completed:0,due_date:'2026-11-30',priority:'High',reminder_at:'2026-11-29T12:00:00.000Z',updated_at:date};
  const state={settings:{darkMode:true},flashcards:[{id:'card1',question:'Q',answer:'A',module:'IT3133',note_id:100}],sessions:[{id:'session1',seconds:1500,module:'IT3133',finished_at:date}],exams:[{id:'exam1',title:'Exam',module:'IT3133',date:'2026-12-01'}]};
  const backup=study.validateBackup(study.makeBackup([note],[task],[],state));
  await store.restoreBrowserVault(backup);
  assert.deepEqual((await store.readVault()).notes,[note]);
  assert.equal((await store.readVault()).revisionTasks[0].due_date,task.due_date);
  assert.deepEqual(await store.readBrowserStudyState(),state);
  await store.saveBrowserNote({...note,chapter:'Chapter 3'});
  assert.equal((await store.readVault()).notes[0].chapter,'Chapter 3');
  await store.restoreBrowserVault(backup);
  assert.equal((await store.readVault()).notes[0].chapter,'Chapter 2');
  const malformed=structuredClone(backup);malformed.revisionTasks[0].note_id=999;
  assert.throws(()=>study.validateBackup(malformed),/note link/);
  const invalid=structuredClone(backup);invalid.studyState.sessions[0].seconds=-1;
  assert.throws(()=>study.validateBackup(invalid),/session/);
  assert.equal((await store.readVault()).notes[0].title,'Backup note');
});
