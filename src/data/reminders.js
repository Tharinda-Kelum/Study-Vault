import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }) });

export async function enableReminders() {
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('study', { name: 'Study reminders', importance: Notifications.AndroidImportance.DEFAULT });
  const permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) throw new Error('Notifications are disabled. Allow notifications in your device settings to receive reminders.');
}

async function reconcileReminders(tasks) {
  const pending = await Notifications.getAllScheduledNotificationsAsync();
  const wanted = new Map(tasks.filter(task => !task.completed && task.reminder_at && new Date(task.reminder_at).getTime() > Date.now()).map(task => [`study-${task.id}`, task]));
  for (const item of pending.filter(item => item.identifier.startsWith('study-'))) {
    const task = wanted.get(item.identifier);
    if (!task || item.content.data?.reminder_at !== task.reminder_at || item.content.title !== task.title) await Notifications.cancelScheduledNotificationAsync(item.identifier);
    else wanted.delete(item.identifier);
  }
  if (!(await Notifications.getPermissionsAsync()).granted) return;
  for (const [identifier, task] of wanted) await Notifications.scheduleNotificationAsync({ identifier,
    content: { title: task.title, body: task.module ? `Time to study ${task.module}` : 'Your study task is ready.', data: { reminder_at: task.reminder_at, taskId: task.id } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(task.reminder_at), channelId: 'study' } });
}

let queue=Promise.resolve();
export function syncReminders(tasks){const operation=queue.catch(()=>{}).then(()=>reconcileReminders(tasks));queue=operation;return operation;}
