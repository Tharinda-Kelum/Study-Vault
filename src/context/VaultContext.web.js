import {normalizeStudyState,validateBackup} from '../data/study';
import React, { createContext, useCallback, useContext, useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { readVault, saveBrowserNote, deleteBrowserNote, toggleBrowserFavorite, saveBrowserRevision, saveBrowserRevisionTask, deleteBrowserRevisionTask, readBrowserStudyState, saveBrowserStudyState, restoreBrowserVault } from '../data/browserVault';
import { styles } from '../theme/styles';

const Context = createContext(null);
export const useVault = () => useContext(Context);

export function VaultProvider({ children }) {
  const [studyState,setStudyState]=useState(normalizeStudyState());const studyRef=useRef(studyState),studyQueue=useRef(Promise.resolve());
  const [notes, setNotes] = useState([]);
  const [revisions, setRevisions] = useState([]);
  const [revisionTasks, setRevisionTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    const [data,state] = await Promise.all([readVault(),readBrowserStudyState()]);
    studyRef.current=normalizeStudyState(state);setStudyState(studyRef.current);
    setNotes(data.notes);
    setRevisions(data.revisions);
    setRevisionTasks(data.revisionTasks);
  }, []);

  const initialize = useCallback(async () => {
    setLoading(true);
    setError('');
    try { await refresh(); }
    catch (e) { setError(e.message || 'Unable to open browser storage.'); }
    finally { setLoading(false); }
  }, [refresh]);

  useEffect(() => { initialize(); }, [initialize]);

  if (error) return <View style={styles.container}>
    <Text style={styles.heading}>Unable to load notes</Text>
    <Text accessibilityRole="alert" style={styles.text}>{error}</Text>
    <TouchableOpacity style={styles.button} onPress={initialize}><Text style={styles.buttonText}>Try again</Text></TouchableOpacity>
  </View>;

  const saveNote = async note => { await saveBrowserNote(note); await refresh(); };
  const deleteNote = async id => { await studyQueue.current.catch(()=>{});await deleteBrowserNote(id); await refresh(); };
  const toggleFavorite = async id => { await toggleBrowserFavorite(id); await refresh(); };
  const saveRevision = async (noteId, completed, reflection) => {
    await saveBrowserRevision(noteId, completed, reflection);
    await refresh();
  };

  const saveRevisionTask = async task => { await saveBrowserRevisionTask(task); await refresh(); };
  const deleteRevisionTask = async id => { await deleteBrowserRevisionTask(id); await refresh(); };
  const saveStudyState=value=>{const operation=studyQueue.current.catch(()=>{}).then(async()=>{const next=typeof value==='function'?value(studyRef.current):value;await saveBrowserStudyState(next);studyRef.current=normalizeStudyState(next);setStudyState(studyRef.current);});studyQueue.current=operation;return operation;};
  const restoreBackup=async data=>{await studyQueue.current.catch(()=>{});await restoreBrowserVault(validateBackup(data));await refresh();};
  return <Context.Provider value={{ studyState,saveStudyState,restoreBackup,notes, revisions, revisionTasks, saveRevisionTask, deleteRevisionTask, loading, saveNote, deleteNote, toggleFavorite, saveRevision }}>{children}</Context.Provider>;
}
