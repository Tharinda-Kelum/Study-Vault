import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { readVault, saveBrowserNote, deleteBrowserNote, toggleBrowserFavorite, saveBrowserRevision } from '../data/browserVault';
import { styles } from '../theme/styles';

const Context = createContext(null);
export const useVault = () => useContext(Context);

export function VaultProvider({ children }) {
  const [notes, setNotes] = useState([]);
  const [revisions, setRevisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    const data = await readVault();
    setNotes(data.notes);
    setRevisions(data.revisions);
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
  const deleteNote = async id => { await deleteBrowserNote(id); await refresh(); };
  const toggleFavorite = async id => { await toggleBrowserFavorite(id); await refresh(); };
  const saveRevision = async (noteId, completed, reflection) => {
    await saveBrowserRevision(noteId, completed, reflection);
    await refresh();
  };

  return <Context.Provider value={{ notes, revisions, loading, saveNote, deleteNote, toggleFavorite, saveRevision }}>{children}</Context.Provider>;
}
