import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Platform } from 'react-native';
import { enableReminders } from '../data/reminders';
import { useTheme } from '../theme/styles';
import { validDate } from '../data/study';

export function scheduleDraft(task = {}) {
  const reminder = task.reminder_at ? new Date(task.reminder_at) : null;
  const pad = value => String(value).padStart(2, '0');
  return { due_date: task.due_date || '', priority: task.priority || 'Medium', reminder: reminder && !Number.isNaN(reminder.getTime())
    ? `${reminder.getFullYear()}-${pad(reminder.getMonth()+1)}-${pad(reminder.getDate())} ${pad(reminder.getHours())}:${pad(reminder.getMinutes())}` : '' };
}
export function scheduleValues(draft, previousReminder = '') {
  let reminder_at = '';
  if (draft.due_date && !validDate(draft.due_date)) throw new Error('Enter a valid due date: YYYY-MM-DD.');
  if (draft.reminder) {
    const [date, time] = draft.reminder.trim().split(' ');
    if (!validDate(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time || '')) throw new Error('Enter reminder time as YYYY-MM-DD HH:mm.');
    reminder_at = new Date(`${date}T${time}:00`).toISOString();
    if (new Date(reminder_at).getTime() <= Date.now() && reminder_at !== previousReminder) throw new Error('Choose a reminder time in the future.');
  }
  return { due_date: draft.due_date, priority: draft.priority, reminder_at };
}

export default function TaskSchedule({ value, onChange, disabled }) {
  const { styles, colors } = useTheme();
  const [notice, setNotice] = useState('');
  const field = (key, text) => onChange({ ...value, [key]: text });
  return <View>
    <Text style={styles.label}>Priority</Text><View style={{ flexDirection: 'row' }}>{['High','Medium','Low'].map(priority => <TouchableOpacity key={priority} disabled={disabled} accessibilityState={{ selected: value.priority === priority }} onPress={() => field('priority', priority)} style={[styles.chip, value.priority === priority && { backgroundColor: colors.primary }]}><Text style={[styles.chipText, value.priority === priority && { color: colors.onPrimary }]}>{priority}</Text></TouchableOpacity>)}</View>
    <Text style={styles.label}>Due date (optional)</Text><TextInput accessibilityLabel="Task due date" style={styles.input} value={value.due_date} onChangeText={text => field('due_date', text)} placeholder="YYYY-MM-DD" editable={!disabled} />
    <Text style={styles.label}>Reminder (optional, local time)</Text><TextInput accessibilityLabel="Task reminder time" style={styles.input} value={value.reminder} onChangeText={text => field('reminder', text)} placeholder="YYYY-MM-DD HH:mm" editable={!disabled} />
    <TouchableOpacity disabled={disabled} style={styles.chip} onPress={async () => { try { await enableReminders(); setNotice('Notifications enabled. Add a reminder time, then save your task.'); } catch(e) { setNotice(e.message); } }}><Text style={styles.chipText}>Enable notifications</Text></TouchableOpacity>
    <Text style={styles.text}>{Platform.OS === 'web' ? 'Browser reminders need this app open. Times use your current device timezone.' : 'Reminders are scheduled locally on this device.'}</Text>
    {!!notice && <Text accessibilityLiveRegion="polite" style={styles.text}>{notice}</Text>}
  </View>;
}
