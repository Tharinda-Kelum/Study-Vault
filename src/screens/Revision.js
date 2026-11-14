import React, { useState } from 'react';
import { View, Text, FlatList, ScrollView, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useVault } from '../context/VaultContext';
import { createRevisionTask } from '../data/revisionTasks';
import { styles, colors } from '../theme/styles';

function NotePicker({ notes, value, onChange, disabled }) {
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const selected = notes.find(note => note.id === value);
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matches = terms.length ? notes.filter(note => {
    const text = `${note.title} ${note.module} ${note.tags || ''} ${note.category || ''}`.toLowerCase();
    return terms.every(term => text.includes(term));
  }) : [];
  const choose = noteId => { onChange(noteId); setQuery(''); setSearching(false); };
  return <View style={{ marginVertical: 10 }}>
    <Text style={styles.label}>Link to a note (optional)</Text>
    {selected && <View style={styles.card}>
      <Text style={styles.text}>Linked note</Text>
      <Text style={styles.title}>{selected.title}</Text>
      <Text style={styles.text}>{selected.module}</Text>
      <View style={{ flexDirection: 'row', marginTop: 10 }}>
        <TouchableOpacity disabled={disabled} style={styles.chip} onPress={() => setSearching(current => !current)}><Text style={styles.chipText}>{searching ? 'Cancel search' : 'Change note'}</Text></TouchableOpacity>
        <TouchableOpacity disabled={disabled} style={styles.chip} onPress={() => choose(null)}><Text style={{ color: colors.danger }}>Remove link</Text></TouchableOpacity>
      </View>
    </View>}
    {(!selected || searching) && <>
      <TextInput accessibilityLabel="Search notes to link" style={styles.input} value={query} onChangeText={setQuery} editable={!disabled} placeholder="Type a note title, module or keyword to find a note" autoCapitalize="none" autoCorrect={false} />
      {!terms.length && <Text style={styles.text}>{notes.length ? 'Start typing to find a note. Linking is optional.' : 'Create a note to link it here.'}</Text>}
      {!!terms.length && <>
        <Text accessibilityLiveRegion="polite" style={styles.text}>{matches.length ? `${matches.length} ${matches.length === 1 ? 'note found' : 'notes found'} — select one to link` : 'No notes found. Try another title, module or keyword.'}</Text>
        {!!matches.length && <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={{ maxHeight: 240, marginTop: 8 }}>
          {matches.map(note => <TouchableOpacity key={note.id} disabled={disabled} accessibilityRole="button" accessibilityLabel={`Link ${note.title}, ${note.module}`} style={styles.card} onPress={() => choose(note.id)}>
            <Text style={styles.chipText}>{note.title}</Text><Text style={styles.text}>{note.module} · {note.category}</Text>
          </TouchableOpacity>)}
        </ScrollView>}
      </>}
    </>}
  </View>;
}

function RevisionItem({ task, notes, onOpenNote, onSave, onDelete }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [removing, setRemoving] = useState(false);
  const [linking, setLinking] = useState(false);
  const linkedNote = notes.find(note => note.id === task.note_id);
  const act = async action => {
    if (busy) return;
    setBusy(true);
    setError('');
    try { await action(); }
    catch (e) { setError(e.message || 'Unable to update revision. Please try again.'); }
    finally { setBusy(false); }
  };
  return <View style={styles.card}>
    <TouchableOpacity accessibilityRole="checkbox" accessibilityState={{ checked: !!task.completed, disabled: busy }}
      accessibilityLabel={task.title} disabled={busy} onPress={() => act(() => onSave({ ...task, completed: task.completed ? 0 : 1 }))}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }}>
      <View style={{ width: 26, height: 26, borderRadius: 6, borderWidth: 2, borderColor: task.completed ? colors.success : colors.border,
        backgroundColor: task.completed ? colors.success : 'white', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: 'white', fontWeight: '800' }}>{task.completed ? '\u2713' : ''}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, task.completed && { textDecorationLine: 'line-through', color: colors.muted }]}>{task.title}</Text>
        {!!task.module && <Text style={styles.text}>{task.module}</Text>}
      </View>
      {busy && <ActivityIndicator color={colors.primary} />}
    </TouchableOpacity>
    {!!task.reflection && <Text style={styles.text}>{task.reflection}</Text>}
    {!!linkedNote && <TouchableOpacity accessibilityRole="link" onPress={() => onOpenNote(linkedNote.id)} style={{ paddingVertical: 10 }}><Text style={styles.chipText}>Open note: {linkedNote.title}</Text></TouchableOpacity>}
    <TouchableOpacity disabled={busy} onPress={() => setLinking(current => !current)} style={{ paddingVertical: 8 }}><Text style={styles.chipText}>{linking ? 'Close note picker' : linkedNote ? 'Change linked note' : 'Link a note'}</Text></TouchableOpacity>
    {linking && <NotePicker notes={notes} value={task.note_id} disabled={busy} onChange={noteId => act(async () => { await onSave({ ...task, note_id: noteId }); setLinking(false); })} />}
    {!!error && <Text accessibilityRole="alert" style={{ color: colors.danger, marginVertical: 8 }}>{error}</Text>}
    {removing ? <View>
      <Text style={styles.text}>Remove this revision task?</Text>
      <View style={styles.row}>
        <TouchableOpacity disabled={busy} onPress={() => act(() => onDelete(task.id))} style={styles.chip}><Text style={{ color: colors.danger }}>Confirm Remove</Text></TouchableOpacity>
        <TouchableOpacity disabled={busy} onPress={() => setRemoving(false)} style={styles.chip}><Text style={styles.chipText}>Cancel</Text></TouchableOpacity>
      </View>
    </View> : <TouchableOpacity accessibilityLabel={'Remove ' + task.title} disabled={busy} onPress={() => setRemoving(true)} style={{ alignSelf: 'flex-end', padding: 8 }}><Text style={{ color: colors.danger }}>Remove</Text></TouchableOpacity>}
  </View>;
}

export default function Revision({ navigation }) {
  const { notes, revisionTasks, saveRevisionTask, deleteRevisionTask, loading } = useVault();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [module, setModule] = useState('');
  const [noteId, setNoteId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('All');
  const completed = revisionTasks.filter(task => task.completed).length;
  const tasks = revisionTasks.filter(task => filter === 'All' || (filter === 'Completed' ? task.completed : !task.completed))
    .sort((a, b) => Number(a.completed) - Number(b.completed) || b.updated_at.localeCompare(a.updated_at));
  const add = async () => {
    if (saving) return;
    setError('');
    if (!title.trim()) { setError('Enter a revision task.'); return; }
    setSaving(true);
    try {
      if (noteId && !notes.some(note => note.id === noteId)) throw new Error('The selected note was deleted. Choose another note.');
      await saveRevisionTask(createRevisionTask(title, module, noteId));
      setTitle(''); setModule(''); setNoteId(null); setAdding(false);
    } catch (e) { setError(e.message || 'Unable to add revision. Please try again.'); }
    finally { setSaving(false); }
  };
  return <View style={styles.screen}><FlatList keyboardShouldPersistTaps="handled" contentContainerStyle={styles.container}
    data={tasks} keyExtractor={task => task.id} ListHeaderComponent={<>
      <Text style={styles.heading}>Revision To-Do List</Text>
      <Text style={styles.sub}>Plan what to study and tick off each task as you finish.</Text>
      <View style={styles.card}>
        <Text style={styles.title}>{completed} of {revisionTasks.length} tasks completed</Text>
        <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: revisionTasks.length || 1, now: completed }} style={{ height: 10, backgroundColor: colors.border, borderRadius: 10, marginTop: 12 }}>
          <View style={{ height: 10, width: `${revisionTasks.length ? completed / revisionTasks.length * 100 : 0}%`, backgroundColor: colors.success, borderRadius: 10 }} />
        </View>
      </View>
      {adding ? <View style={styles.card}>
        <Text style={styles.title}>Add Revision</Text>
        <Text style={styles.label}>Task *</Text>
        <TextInput accessibilityLabel="Revision task" style={styles.input} placeholder="e.g. Review chapter 3 and practise questions" value={title} onChangeText={setTitle} editable={!saving} />
        <Text style={styles.label}>Module (optional)</Text>
        <TextInput accessibilityLabel="Revision module" style={styles.input} placeholder="e.g. IT3133" autoCapitalize="characters" value={module} onChangeText={setModule} editable={!saving} />
        <NotePicker notes={notes} value={noteId} disabled={saving} onChange={setNoteId} />
        {!!error && <Text accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Text>}
        <TouchableOpacity style={[styles.button, saving && { opacity: 0.5 }]} disabled={saving} onPress={add}><Text style={styles.buttonText}>{saving ? 'Adding...' : 'Add Task'}</Text></TouchableOpacity>
        <TouchableOpacity style={styles.chip} disabled={saving} onPress={() => { setAdding(false); setError(''); }}><Text style={styles.chipText}>Cancel</Text></TouchableOpacity>
      </View> : <TouchableOpacity style={styles.button} onPress={() => setAdding(true)}><Text style={styles.buttonText}>+ Add Revision</Text></TouchableOpacity>}
      <View style={{ flexDirection: 'row', marginVertical: 12 }}>{['All', 'To Do', 'Completed'].map(value => <TouchableOpacity key={value} accessibilityState={{ selected: filter === value }} style={[styles.chip, filter === value && { backgroundColor: colors.primary }]} onPress={() => setFilter(value)}><Text style={[styles.chipText, filter === value && { color: 'white' }]}>{value}</Text></TouchableOpacity>)}</View>
    </>} renderItem={({ item }) => <RevisionItem task={item} notes={notes} onOpenNote={id => navigation.navigate('Detail', { id })} onSave={saveRevisionTask} onDelete={deleteRevisionTask} />}
    ListEmptyComponent={loading ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.empty}>{revisionTasks.length ? 'No tasks in this list.' : 'No revisions yet. Add your first revision task above.'}</Text>} />
  </View>;
}
