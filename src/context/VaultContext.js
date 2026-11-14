import React,{createContext,useContext,useEffect,useState,useCallback} from 'react';
import * as SQLite from 'expo-sqlite';
import { initialNotes } from '../data/seed';
const Context=createContext(null);
export const useVault=()=>useContext(Context);
let dbPromise;
const getDB=()=>{
 if(!dbPromise){
  dbPromise=(async()=>{
   const db=await SQLite.openDatabaseAsync('studyvault.db');
   try{
    await db.execAsync(`PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL,module TEXT NOT NULL,category TEXT NOT NULL,priority TEXT NOT NULL,tags TEXT NOT NULL DEFAULT '',content TEXT NOT NULL,favorite INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL,updated_at TEXT NOT NULL); CREATE TABLE IF NOT EXISTS revisions (id INTEGER PRIMARY KEY AUTOINCREMENT,note_id INTEGER NOT NULL UNIQUE,completed INTEGER NOT NULL DEFAULT 0,reflection TEXT NOT NULL DEFAULT '',updated_at TEXT NOT NULL,FOREIGN KEY(note_id) REFERENCES notes(id) ON DELETE CASCADE);`);await db.execAsync(`CREATE TABLE IF NOT EXISTS revision_tasks (id TEXT PRIMARY KEY,title TEXT NOT NULL,module TEXT NOT NULL DEFAULT '',completed INTEGER NOT NULL DEFAULT 0,reflection TEXT NOT NULL DEFAULT '',updated_at TEXT NOT NULL); CREATE TABLE IF NOT EXISTS vault_migrations (name TEXT PRIMARY KEY);`);const taskColumns=await db.getAllAsync('PRAGMA table_info(revision_tasks)');if(!taskColumns.some(c=>c.name==='note_id'))await db.execAsync('ALTER TABLE revision_tasks ADD COLUMN note_id INTEGER');const migrated=await db.getFirstAsync("SELECT name FROM vault_migrations WHERE name='revision_tasks'");if(!migrated){await db.execAsync(`BEGIN; INSERT OR IGNORE INTO revision_tasks (id,title,module,completed,reflection,updated_at) SELECT 'note-' || r.note_id,n.title,n.module,r.completed,r.reflection,r.updated_at FROM revisions r JOIN notes n ON n.id=r.note_id; INSERT INTO vault_migrations (name) VALUES ('revision_tasks'); COMMIT;`);}await db.execAsync('PRAGMA foreign_keys = ON;');const columns=await db.getAllAsync('PRAGMA table_info(notes)');if(!columns.some(c=>c.name==='attachments'))await db.execAsync("ALTER TABLE notes ADD COLUMN attachments TEXT NOT NULL DEFAULT '[]'");for(const field of ['code','output']){if(!columns.some(c=>c.name===field))await db.execAsync('ALTER TABLE notes ADD COLUMN '+field+" TEXT NOT NULL DEFAULT ''");}await db.runAsync('UPDATE notes SET category=? WHERE category=?',['Chapter Short Note','Exam Formula Sheets']);const row=await db.getFirstAsync('SELECT COUNT(*) AS total FROM notes');if(row.total===0){for(const note of initialNotes){const now=new Date().toISOString();await db.runAsync('INSERT INTO notes (title,module,category,priority,tags,content,favorite,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)',[note.title,note.module,note.category,note.priority,note.tags,note.content,note.favorite,now,now]);}}
    return db;
   }catch(error){
    await db.closeAsync().catch(()=>{});
    throw error;
   }
  })().catch(error=>{dbPromise=undefined;throw error;});
 }
 return dbPromise;
};
export function VaultProvider({children}){
 const [notes,setNotes]=useState([]),[revisions,setRevisions]=useState([]),[revisionTasks,setRevisionTasks]=useState([]),[loading,setLoading]=useState(true);
 const refresh=useCallback(async()=>{const db=await getDB(); const [n,r,t]=await Promise.all([db.getAllAsync('SELECT * FROM notes ORDER BY updated_at DESC'),db.getAllAsync('SELECT * FROM revisions ORDER BY id DESC'),db.getAllAsync('SELECT * FROM revision_tasks ORDER BY updated_at DESC')]);setNotes(n.map(note=>({...note,attachments:JSON.parse(note.attachments || '[]')})));setRevisions(r);setRevisionTasks(t);},[]);
 useEffect(()=>{let active=true;(async()=>{try{await refresh();}catch(e){console.error('Database initialization failed',e);}finally{if(active)setLoading(false);}})();return()=>{active=false;};},[refresh]);
 const saveNote=async(note)=>{const db=await getDB(),now=new Date().toISOString();if(note.id){await db.runAsync('UPDATE notes SET title=?,module=?,category=?,priority=?,tags=?,content=?,attachments=?,code=?,output=?,updated_at=? WHERE id=?',[note.title,note.module,note.category,note.priority,note.tags,note.content,JSON.stringify(note.attachments || []),note.code||'',note.output||'',now,note.id]);}else{await db.runAsync('INSERT INTO notes (title,module,category,priority,tags,content,attachments,code,output,favorite,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',[note.title,note.module,note.category,note.priority,note.tags,note.content,JSON.stringify(note.attachments || []),note.code||'',note.output||'',0,now,now]);}await refresh();};
 const deleteNote=async(id)=>{const db=await getDB();await db.withTransactionAsync(async()=>{await db.runAsync('UPDATE revision_tasks SET note_id=NULL WHERE note_id=?',[id]);await db.runAsync('DELETE FROM notes WHERE id=?',[id]);});await refresh();};
 const toggleFavorite=async(id)=>{const db=await getDB();await db.runAsync('UPDATE notes SET favorite=CASE WHEN favorite=1 THEN 0 ELSE 1 END, updated_at=? WHERE id=?',[new Date().toISOString(),id]);await refresh();};
 const saveRevision=async(noteId,completed,reflection)=>{const db=await getDB();await db.runAsync('INSERT INTO revisions (note_id,completed,reflection,updated_at) VALUES (?,?,?,?) ON CONFLICT(note_id) DO UPDATE SET completed=excluded.completed,reflection=excluded.reflection,updated_at=excluded.updated_at',[noteId,completed?1:0,reflection,new Date().toISOString()]);await refresh();};
 const saveRevisionTask=async(task)=>{if(!task.title.trim())throw new Error('Enter a revision task.');const db=await getDB();if(task.note_id&&!(await db.getFirstAsync('SELECT id FROM notes WHERE id=?',[task.note_id])))throw new Error('The linked note no longer exists. Choose another note.');await db.runAsync('INSERT INTO revision_tasks (id,title,module,completed,reflection,updated_at,note_id) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,module=excluded.module,completed=excluded.completed,reflection=excluded.reflection,updated_at=excluded.updated_at,note_id=excluded.note_id',[task.id,task.title,task.module||'',task.completed?1:0,task.reflection||'',new Date().toISOString(),task.note_id||null]);await refresh();};
 const deleteRevisionTask=async(id)=>{const db=await getDB();await db.runAsync('DELETE FROM revision_tasks WHERE id=?',[id]);await refresh();};
 return <Context.Provider value={{notes,revisions,revisionTasks,saveRevisionTask,deleteRevisionTask,loading,saveNote,deleteNote,toggleFavorite,saveRevision}}>{children}</Context.Provider>;
}
