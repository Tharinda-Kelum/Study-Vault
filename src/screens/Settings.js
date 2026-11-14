import React, { useState } from 'react';
import { ScrollView, View, Text, Switch, TouchableOpacity } from 'react-native';
import { useVault } from '../context/VaultContext';
import { useTheme } from '../theme/styles';
import { makeBackup } from '../data/study';
import { exportBackupFile, pickBackupFile } from '../data/backupFiles';

export default function Settings() {
  const { notes, revisions, revisionTasks, studyState, saveStudyState, restoreBackup } = useVault();
  const { styles, colors, dark } = useTheme();
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const act = async action => { if (busy) return; setBusy(true); setNotice(''); try { await action(); } catch(e) { setNotice(e.message || 'Unable to complete this operation.'); } finally { setBusy(false); } };
  return <ScrollView style={styles.screen} contentContainerStyle={[styles.container,{width:'100%',maxWidth:800,alignSelf:'center'}]}>
    <Text style={styles.heading}>Settings & backup</Text><Text style={styles.sub}>Your workspace, your preferences.</Text>
    <View style={styles.card}><View style={styles.row}><View style={{flex:1}}><Text style={styles.title}>Dark mode</Text><Text style={styles.text}>A softer display for evening study.</Text></View><Switch accessibilityLabel="Dark mode" value={dark} disabled={busy} onValueChange={value=>act(()=>saveStudyState(current=>({...current,settings:{...current.settings,darkMode:value}})))}/></View></View>
    <View style={styles.card}><Text style={styles.title}>Backup your work</Text><Text style={styles.text}>Export notes, files, tasks, flashcards, exams, study sessions and settings in one JSON file. Keep it somewhere safe.</Text>
      <TouchableOpacity disabled={busy} style={styles.button} onPress={()=>act(async()=>{await exportBackupFile(makeBackup(notes,revisionTasks,revisions,studyState));setNotice('Backup export opened. Save the file to keep a copy.');})}><Text style={styles.buttonText}>Export backup</Text></TouchableOpacity>
      <TouchableOpacity disabled={busy} style={styles.chip} onPress={()=>act(async()=>setPending(await pickBackupFile()))}><Text style={styles.chipText}>Choose backup to restore</Text></TouchableOpacity>
    </View>
    {pending&&<View style={styles.card}><Text style={styles.title}>Restore this backup?</Text><Text style={styles.text}>{pending.notes.length} notes · {pending.revisionTasks.length} tasks · {pending.studyState.flashcards.length} flashcards</Text><Text style={styles.text}>This replaces all current data. Export a backup of your current work first if you want to keep it.</Text><TouchableOpacity disabled={busy} style={[styles.button,{backgroundColor:colors.danger}]} onPress={()=>act(async()=>{await restoreBackup(pending);setPending(null);setNotice('Backup restored successfully.');})}><Text style={styles.buttonText}>Replace data and restore</Text></TouchableOpacity><TouchableOpacity disabled={busy} style={styles.chip} onPress={()=>setPending(null)}><Text style={styles.chipText}>Cancel</Text></TouchableOpacity></View>}
    {!!notice&&<Text accessibilityLiveRegion="polite" style={styles.text}>{notice}</Text>}
    {busy&&<Text style={styles.text}>Working…</Text>}
  </ScrollView>;
}
