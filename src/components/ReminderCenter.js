import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { useVault } from '../context/VaultContext';
import { syncReminders } from '../data/reminders';
import { useTheme } from '../theme/styles';

export default function ReminderCenter() {
  const { revisionTasks } = useVault();
  const { styles, colors } = useTheme();
  const [now, setNow] = useState(Date.now());
  const [dismissed, setDismissed] = useState([]);
  const [warning, setWarning] = useState('');
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(id); }, []);
  useEffect(() => {
    let cancelled = false;
    syncReminders(revisionTasks).then(() => { if (!cancelled) setWarning(''); }).catch(() => { if (!cancelled) setWarning('Device reminders could not be scheduled. Your tasks are saved.'); });
    return () => { cancelled = true; };
  }, [revisionTasks]);
  const due = revisionTasks.filter(task => !task.completed && task.reminder_at && new Date(task.reminder_at).getTime() <= now && !dismissed.includes(`${task.id}:${task.reminder_at}`));
  useEffect(() => {
    if (Platform.OS !== 'web' || !('Notification' in globalThis) || Notification.permission !== 'granted') return;
    for (const task of due) {
      const key = `study-reminder:${task.id}:${task.reminder_at}`;
      try { if (!localStorage.getItem(key)) { new Notification(task.title, { body: task.module || 'Time to study.', tag: task.id }); localStorage.setItem(key, 'sent'); } } catch {}
    }
  }, [now, revisionTasks, dismissed]);
  if (!due.length && !warning) return null;
  return <View style={{ backgroundColor: colors.white, padding: 12, borderBottomWidth: 1, borderColor: colors.border }}>
    {!!warning && <TouchableOpacity onPress={() => setWarning('')}><Text style={styles.text}>{warning} · Dismiss</Text></TouchableOpacity>}
    {due.slice(0, 3).map(task => <View key={task.id} style={styles.row}><Text style={[styles.title, { flex: 1, fontSize: 14 }]}>Reminder: {task.title}</Text><TouchableOpacity onPress={() => setDismissed(items => [...items, `${task.id}:${task.reminder_at}`])} style={{ padding: 8 }}><Text style={styles.chipText}>Dismiss</Text></TouchableOpacity></View>)}
  </View>;
}
