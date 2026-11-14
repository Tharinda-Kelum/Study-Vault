import TaskSchedule,{scheduleDraft,scheduleValues} from '../components/TaskSchedule';
import {localDate} from '../data/study';
﻿import React, { useState } from 'react';
import { View, Text, FlatList, ScrollView, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createRevisionStyles } from '../theme/revisionStyles';
import { useVault } from '../context/VaultContext';
import { createRevisionTask } from '../data/revisionTasks';
import {useTheme} from '../theme/styles';

function NotePicker({ notes, value, onChange, disabled }) { const {styles,colors,dark}=useTheme(); const ui=createRevisionStyles(colors,dark);
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
    {selected && <View style={ui.selected}>
      <Text style={[ui.eyebrow,{marginBottom:6}]}>LINKED NOTE</Text>
      <Text style={styles.title}>{selected.title}</Text>
      <Text style={styles.text}>{selected.module}</Text>
      <View style={{ flexDirection: 'row', marginTop: 10 }}>
        <TouchableOpacity disabled={disabled} style={styles.chip} onPress={() => setSearching(current => !current)}><Text style={styles.chipText}>{searching ? 'Cancel search' : 'Change note'}</Text></TouchableOpacity>
        <TouchableOpacity disabled={disabled} style={styles.chip} onPress={() => choose(null)}><Text style={{ color: colors.danger }}>Remove link</Text></TouchableOpacity>
      </View>
    </View>}
    {(!selected || searching) && <>
      <View style={ui.search}><Ionicons name="search-outline" size={19} color={colors.muted}/><TextInput accessibilityLabel="Search notes to link" style={ui.searchInput} value={query} onChangeText={setQuery} editable={!disabled} placeholder="Search notes by title, module or keyword" placeholderTextColor="#8792A7" autoCapitalize="none" autoCorrect={false} />{!!query&&<TouchableOpacity accessibilityLabel="Clear note search" disabled={disabled} onPress={()=>setQuery('')} style={{padding:6}}><Ionicons name="close-circle" size={18} color={colors.muted}/></TouchableOpacity>}</View>
      {!terms.length && <Text style={ui.helper}>{notes.length ? 'Start typing to find a note. Linking is optional.' : 'Create a note to link it here.'}</Text>}
      {!!terms.length && <>
        <Text accessibilityLiveRegion="polite" style={ui.helper}>{matches.length ? `${matches.length} ${matches.length === 1 ? 'note found' : 'notes found'} — select one to link` : 'No notes found. Try another title, module or keyword.'}</Text>
        {!!matches.length && <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={ui.results}>
          {matches.map(note => <TouchableOpacity key={note.id} disabled={disabled} accessibilityRole="button" accessibilityLabel={`Link ${note.title}, ${note.module}`} style={ui.result} onPress={() => choose(note.id)}><View style={ui.iconBox}><Ionicons name="document-text-outline" size={18} color={colors.primary}/></View><View style={{flex:1}}>
            <Text style={styles.chipText}>{note.title}</Text><Text style={styles.text}>{note.module} · {note.category}</Text>
          </View><Ionicons name="add-circle-outline" size={22} color={colors.primary}/></TouchableOpacity>)}
        </ScrollView>}
      </>}
    </>}
  </View>;
}

function RevisionItem({ task, notes, onOpenNote, onSave, onDelete }) { const {styles,colors,dark}=useTheme(); const ui=createRevisionStyles(colors,dark);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [removing, setRemoving] = useState(false);
  const [linking, setLinking] = useState(false);
  const [editing,setEditing]=useState(false);const [schedule,setSchedule]=useState(()=>scheduleDraft(task));
  const linkedNote = notes.find(note => note.id === task.note_id);
  const act = async action => {
    if (busy) return;
    setBusy(true);
    setError('');
    try { await action(); }
    catch (e) { setError(e.message || 'Unable to update task. Please try again.'); }
    finally { setBusy(false); }
  };
  return <View style={[ui.task,!!task.completed&&ui.taskDone]}>
    <TouchableOpacity accessibilityRole="checkbox" accessibilityState={{ checked: !!task.completed, disabled: busy }}
      accessibilityLabel={task.title} disabled={busy} onPress={() => act(() => onSave({ ...task, completed: task.completed ? 0 : 1 }))}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }}>
      <View style={{ width: 26, height: 26, borderRadius: 6, borderWidth: 2, borderColor: task.completed ? colors.success : colors.border,
        backgroundColor: task.completed ? colors.success : 'white', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="checkmark" size={18} color={task.completed?'white':'transparent'}/>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, task.completed && { textDecorationLine: 'line-through', color: colors.muted }]}>{task.title}</Text>
        {!!task.module && <Text style={ui.badge}>{task.module}</Text>}
      </View>
      {busy && <ActivityIndicator color={colors.primary} />}
    </TouchableOpacity>
    <View style={{flexDirection:'row',flexWrap:'wrap',gap:12,marginTop:6}}><Text style={{color:task.priority==='High'?colors.danger:colors.muted,fontWeight:'700',fontSize:12}}>{task.priority||'Medium'} priority</Text>{!!task.due_date&&<Text style={{color:!task.completed&&task.due_date<localDate()?colors.danger:colors.muted,fontSize:12}}>{!task.completed&&task.due_date<localDate()?'Overdue ? ':''}Due {task.due_date}</Text>}{!!task.reminder_at&&<Text style={styles.text}>Reminder {new Date(task.reminder_at).toLocaleString()}</Text>}</View>
    <TouchableOpacity disabled={busy} onPress={()=>{setSchedule(scheduleDraft(task));setEditing(current=>!current);}} style={{paddingVertical:10}}><Text style={styles.chipText}>{editing?'Close schedule':'Edit date & priority'}</Text></TouchableOpacity>
    {editing&&<View><TaskSchedule value={schedule} onChange={setSchedule} disabled={busy}/><TouchableOpacity style={styles.button} disabled={busy} onPress={()=>act(async()=>{await onSave({...task,...scheduleValues(schedule,task.reminder_at)});setEditing(false);})}><Text style={styles.buttonText}>Save schedule</Text></TouchableOpacity></View>}
    {!!task.reflection && <Text style={styles.text}>{task.reflection}</Text>}
    {!!linkedNote && <TouchableOpacity accessibilityRole="link" onPress={() => onOpenNote(linkedNote.id)} style={ui.linked}><Ionicons name="document-text-outline" size={16} color={colors.primary}/><Text numberOfLines={1} style={[styles.chipText,{flexShrink:1,fontSize:12}]}>{linkedNote.title}</Text><Ionicons name="arrow-forward" size={14} color={colors.primary}/></TouchableOpacity>}
    <View style={ui.taskActions}><TouchableOpacity disabled={busy} onPress={() => setLinking(current => !current)} style={{ paddingVertical: 8 }}><Text style={styles.chipText}>{linking ? 'Close note picker' : linkedNote ? 'Change linked note' : 'Link a note'}</Text></TouchableOpacity>
    <TouchableOpacity accessibilityLabel={'Remove '+task.title} disabled={busy} onPress={()=>setRemoving(current=>!current)} style={{padding:10}}><Ionicons name="trash-outline" size={17} color={colors.muted}/></TouchableOpacity></View>
    {linking && <NotePicker notes={notes} value={task.note_id} disabled={busy} onChange={noteId => act(async () => { await onSave({ ...task, note_id: noteId }); setLinking(false); })} />}
    {!!error && <Text accessibilityRole="alert" style={{ color: colors.danger, marginVertical: 8 }}>{error}</Text>}
    {removing ? <View>
      <Text style={styles.text}>Remove this task?</Text>
      <View style={styles.row}>
        <TouchableOpacity disabled={busy} onPress={() => act(() => onDelete(task.id))} style={styles.chip}><Text style={{ color: colors.danger }}>Confirm Remove</Text></TouchableOpacity>
        <TouchableOpacity disabled={busy} onPress={() => setRemoving(false)} style={styles.chip}><Text style={styles.chipText}>Cancel</Text></TouchableOpacity>
      </View>
    </View> : null}
  </View>;
}

export default function Revision({ navigation }) { const {styles,colors,dark}=useTheme(); const ui=createRevisionStyles(colors,dark);
  const { notes, revisionTasks, saveRevisionTask, deleteRevisionTask, loading } = useVault();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [module, setModule] = useState('');
  const [noteId, setNoteId] = useState(null);
  const [schedule,setSchedule]=useState(()=>scheduleDraft());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('All');
  const completed = revisionTasks.filter(task => task.completed).length;
  const tasks = revisionTasks.filter(task => filter === 'All' || (filter === 'Completed' ? task.completed : !task.completed))
    .sort((a,b)=>Number(a.completed)-Number(b.completed)||(a.due_date||'9999').localeCompare(b.due_date||'9999')||(['High','Medium','Low'].indexOf(a.priority||'Medium')-['High','Medium','Low'].indexOf(b.priority||'Medium'))||b.updated_at.localeCompare(a.updated_at));
  const add = async () => {
    if (saving) return;
    setError('');
    if (!title.trim()) { setError('Enter a task.'); return; }
    setSaving(true);
    try {
      if (noteId && !notes.some(note => note.id === noteId)) throw new Error('The selected note was deleted. Choose another note.');
      await saveRevisionTask({...createRevisionTask(title, module, noteId),...scheduleValues(schedule)});
      setTitle(''); setModule(''); setNoteId(null);setSchedule(scheduleDraft()); setAdding(false);
    } catch (e) { setError(e.message || 'Unable to add task. Please try again.'); }
    finally { setSaving(false); }
  };
  return <View style={styles.screen}><FlatList keyboardShouldPersistTaps="handled" contentContainerStyle={ui.page}
    data={tasks} keyExtractor={task => task.id} ListHeaderComponent={<>
      <Text style={ui.eyebrow}>YOUR STUDY SPACE</Text>
      <Text style={ui.heading}>A little progress, every day.</Text>
      <Text style={ui.subtitle}>Turn your study plans into small wins. One task at a time.</Text>
      <View style={ui.hero}>
        <View style={ui.heroTop}><View style={{flex:1}}><Text style={ui.heroLabel}>Your task progress</Text><Text style={ui.heroNumber}>{completed}<Text style={{fontSize:20,color:'#AEBBD9'}}> / {revisionTasks.length}</Text></Text><Text style={ui.heroCaption}>tasks completed</Text></View><View style={ui.heroIcon}><Ionicons name="checkmark-done-outline" size={34} color="#C7D2FE"/></View></View>
        <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: revisionTasks.length || 1, now: completed }} style={ui.progress}><View style={[ui.progressFill,{width: revisionTasks.length ? completed/revisionTasks.length*100+'%' : '0%'}]}/></View>
        <View style={ui.heroFooter}><Text style={ui.heroCaption}>{revisionTasks.length-completed} left to do</Text><Text style={ui.heroCaption}>{revisionTasks.length?Math.round(completed/revisionTasks.length*100):0}% complete</Text></View>
      </View>
      <View style={ui.toolbar}><Text style={ui.sectionTitle}>To Do</Text>{!adding&&<TouchableOpacity style={ui.primary} onPress={()=>setAdding(true)}><Ionicons name="add" size={19} color="white"/><Text style={styles.buttonText}>Add task</Text></TouchableOpacity>}</View>
      {adding ? <View style={ui.form}>
        <View style={ui.formHeader}><View style={ui.iconBox}><Ionicons name="create-outline" size={22} color={colors.primary}/></View><View><Text style={styles.title}>Add a task</Text><Text style={ui.helper}>What would you like to work on?</Text></View></View>
        <Text style={styles.label}>Task *</Text>
        <TextInput accessibilityLabel="Task title" style={ui.field} placeholder="e.g. Review chapter 3 and practise questions" value={title} onChangeText={setTitle} editable={!saving} />
        <Text style={styles.label}>Module (optional)</Text>
        <TextInput accessibilityLabel="Task module" style={ui.field} placeholder="e.g. IT3133" autoCapitalize="characters" value={module} onChangeText={setModule} editable={!saving} />
        <TaskSchedule value={schedule} onChange={setSchedule} disabled={saving}/><NotePicker notes={notes} value={noteId} disabled={saving} onChange={setNoteId} />
        {!!error && <Text accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Text>}
        <View style={ui.footer}><TouchableOpacity style={ui.quietButton} disabled={saving} onPress={()=>{setAdding(false);setError('');}}><Text style={styles.chipText}>Cancel</Text></TouchableOpacity><TouchableOpacity style={[ui.primary,saving&&{opacity:0.5}]} disabled={saving} onPress={add}>{saving?<ActivityIndicator color="white"/>:<Ionicons name="add" size={18} color="white"/>}<Text style={styles.buttonText}>{saving?'Adding...':'Add task'}</Text></TouchableOpacity></View>
      </View> : null}
      <View style={ui.segments}>{['All', 'To Do', 'Completed'].map(value => <TouchableOpacity key={value} accessibilityState={{ selected: filter === value }} style={[ui.segment,filter===value&&ui.segmentActive]} onPress={() => setFilter(value)}><Text style={[ui.segmentText,filter===value&&{color:colors.dark}]}>{value}</Text></TouchableOpacity>)}</View>
    </>} renderItem={({ item }) => <RevisionItem task={item} notes={notes} onOpenNote={id => navigation.navigate('Detail', { id })} onSave={saveRevisionTask} onDelete={deleteRevisionTask} />}
    ListEmptyComponent={loading ? <ActivityIndicator color={colors.primary} /> : <View style={ui.empty}><View style={[ui.iconBox,{width:56,height:56,borderRadius:18}]}><Ionicons name="checkbox-outline" size={28} color={colors.primary}/></View><Text style={styles.title}>{revisionTasks.length?'All clear here':'Make room for your next small win'}</Text><Text style={[ui.helper,{textAlign:'center',maxWidth:320}]}>{revisionTasks.length?'No tasks match this filter. Switch lists to see your other tasks.':'Add a task and link your study notes to get started.'}</Text></View>} />
  </View>;
}
