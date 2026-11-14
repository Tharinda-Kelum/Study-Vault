export async function enableReminders() {
  if (!('Notification' in globalThis)) throw new Error('This browser supports in-app reminders only. Keep StudyVault open.');
  if (await Notification.requestPermission() !== 'granted') throw new Error('Browser notifications are blocked. In-app reminders will still appear while StudyVault is open.');
}
export async function syncReminders() {}
export function showBrowserReminder(task) {
  if ('Notification' in globalThis && Notification.permission === 'granted') new Notification(task.title, { body: task.module || 'Time for your study task.', tag: task.id });
}
