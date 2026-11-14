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
    await db.execAsync(`PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL,module TEXT NOT NULL,category TEXT NOT NULL,priority TEXT NOT NULL,tags TEXT NOT NULL DEFAULT '',content TEXT NOT NULL,favorite INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL,updated_at TEXT NOT NULL); CREATE TABLE IF NOT EXISTS revisions (id INTEGER PRIMARY KEY AUTOINCREMENT,note_id INTEGER NOT NULL UNIQUE,completed INTEGER NOT NULL DEFAULT 0,reflection TEXT NOT NULL DEFAULT '',updated_at TEXT NOT NULL,FOREIGN KEY(note_id) REFERENCES notes(id) ON DELETE CASCADE);`);await db.execAsync('PRAGMA foreign_keys = ON;');const columns=await db.getAllAsync('PRAGMA table_info(notes)');if(!columns.some(c=>c.name==='attachments'))await db.execAsync("ALTER TABLE notes ADD COLUMN attachments TEXT NOT NULL DEFAULT '[]'");const row=await db.getFirstAsync('SELECT COUNT(*) AS total FROM notes');if(row.total===0){for(const note of initialNotes){const now=new Date().toISOString();await db.runAsync('INSERT INTO notes (title,module,category,priority,tags,content,favorite,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)',[note.title,note.module,note.category,note.priority,note.tags,note.content,note.favorite,now,now]);}}
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
 const [notes,setNotes]=useState([]),[revisions,setRevisions]=useState([]),[loading,setLoading]=useState(true);
 const refresh=useCallback(async()=>{const db=await getDB(); const [n,r]=await Promise.all([db.getAllAsync('SELECT * FROM notes ORDER BY updated_at DESC'),db.getAllAsync('SELECT * FROM revisions ORDER BY id DESC')]);setNotes(n.map(note=>({...note,attachments:JSON.parse(note.attachments || '[]')})));setRevisions(r);},[]);
 useEffect(()=>{let active=true;(async()=>{try{await refresh();}catch(e){console.error('Database initialization failed',e);}finally{if(active)setLoading(false);}})();return()=>{active=false;};},[refresh]);
 const saveNote=async(note)=>{const db=await getDB(),now=new Date().toISOString();if(note.id){await db.runAsync('UPDATE notes SET title=?,module=?,category=?,priority=?,tags=?,content=?,attachments=?,updated_at=? WHERE id=?',[note.title,note.module,note.category,note.priority,note.tags,note.content,JSON.stringify(note.attachments || []),now,note.id]);}else{await db.runAsync('INSERT INTO notes (title,module,category,priority,tags,content,attachments,favorite,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)',[note.title,note.module,note.category,note.priority,note.tags,note.content,JSON.stringify(note.attachments || []),0,now,now]);}await refresh();};
 const deleteNote=async(id)=>{const db=await getDB();await db.runAsync('DELETE FROM notes WHERE id=?',[id]);await refresh();};
 const toggleFavorite=async(id)=>{const db=await getDB();await db.runAsync('UPDATE notes SET favorite=CASE WHEN favorite=1 THEN 0 ELSE 1 END, updated_at=? WHERE id=?',[new Date().toISOString(),id]);await refresh();};
 const saveRevision=async(noteId,completed,reflection)=>{const db=await getDB();await db.runAsync('INSERT INTO revisions (note_id,completed,reflection,updated_at) VALUES (?,?,?,?) ON CONFLICT(note_id) DO UPDATE SET completed=excluded.completed,reflection=excluded.reflection,updated_at=excluded.updated_at',[noteId,completed?1:0,reflection,new Date().toISOString()]);await refresh();};
 return <Context.Provider value={{notes,revisions,loading,saveNote,deleteNote,toggleFavorite,saveRevision}}>{children}</Context.Provider>;
}
