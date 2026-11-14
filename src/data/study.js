export const emptyStudyState = () => ({ settings: { darkMode: false }, flashcards: [], sessions: [], exams: [] });
export const uid = prefix => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
export function normalizeStudyState(value) {
  return { ...emptyStudyState(), ...value, settings: { darkMode: false, ...value?.settings } };
}
export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  return !Number.isNaN(date.getTime()) && localDate(date) === value;
}
export function validateTask(task) {
  if (!task.title?.trim()) throw new Error('Enter a task.');
  if (task.due_date && !validDate(task.due_date)) throw new Error('Use a valid due date in YYYY-MM-DD format.');
  if (task.priority && !['High', 'Medium', 'Low'].includes(task.priority)) throw new Error('Choose a valid priority.');
  if (task.reminder_at && Number.isNaN(new Date(task.reminder_at).getTime())) throw new Error('Enter a valid reminder date and time.');
  return { ...task, priority: task.priority || 'Medium', due_date: task.due_date || '', reminder_at: task.reminder_at || '',
    completed_at: task.completed ? (task.completed_at || new Date().toISOString()) : '' };
}
export function makeBackup(notes, revisionTasks, revisions, studyState) {
  return { format: 'studyvault', version: 1, exported_at: new Date().toISOString(), notes, revisionTasks, revisions, studyState };
}
export function validateBackup(data) {
  if (data?.format !== 'studyvault' || data.version !== 1 || !Array.isArray(data.notes) || !Array.isArray(data.revisionTasks) || !Array.isArray(data.revisions)) throw new Error('This is not a supported StudyVault backup.');
  const ids = new Set();
  const text = value => typeof value === 'string';
  const timestamp = value => text(value) && Number.isFinite(new Date(value).getTime());
  for (const note of data.notes) {
    if (!Number.isSafeInteger(note.id) || note.id < 1 || ids.has(note.id) || !text(note.title) || !note.title.trim() || !text(note.module) || !text(note.category) || !text(note.priority) || !text(note.content) || !text(note.tags) || !timestamp(note.created_at) || !timestamp(note.updated_at) || !Array.isArray(note.attachments)) throw new Error('Backup contains an invalid note.');
    if (note.attachments.some(file => !text(file.name) || !text(file.data) || !text(file.mimeType) || !/^[A-Za-z0-9+/]*={0,2}$/.test(file.data))) throw new Error('Backup contains an invalid attachment.');
    ids.add(note.id);
  }
  const taskIds = new Set();
  for (const task of data.revisionTasks) {
    validateTask(task);
    if (!text(task.id) || taskIds.has(task.id) || !text(task.module) || !timestamp(task.updated_at) || (task.note_id && !ids.has(task.note_id))) throw new Error('Backup contains an invalid task or note link.');
    taskIds.add(task.id);
  }
  for (const revision of data.revisions) if (!ids.has(revision.note_id) || !text(revision.reflection) || !timestamp(revision.updated_at)) throw new Error('Backup contains an invalid revision.');
  const state = normalizeStudyState(data.studyState);
  if (typeof state.settings.darkMode !== 'boolean') throw new Error('Backup contains invalid settings.');
  if (![state.flashcards, state.sessions, state.exams].every(Array.isArray)) throw new Error('Backup contains invalid study data.');
  const unique = items => { const seen = new Set(); for (const item of items) { if (!text(item.id) || seen.has(item.id)) throw new Error('Duplicate or invalid study item.'); seen.add(item.id); } };
  for (const items of [state.flashcards, state.sessions, state.exams]) unique(items);
  if (state.flashcards.some(card => !text(card.question) || !text(card.answer) || !text(card.module) || (card.note_id && !ids.has(card.note_id)))) throw new Error('Backup contains an invalid flashcard.');
  if (state.sessions.some(session => !Number.isFinite(session.seconds) || session.seconds <= 0 || !timestamp(session.finished_at) || !text(session.module))) throw new Error('Backup contains an invalid study session.');
  if (state.exams.some(exam => !text(exam.title) || !text(exam.module) || !validDate(exam.date))) throw new Error('Backup contains an invalid exam.');
  if (state.activeTimer) {
    const timer = state.activeTimer;
    if (!text(timer.id) || !['focus','break'].includes(timer.phase) || !Number.isFinite(timer.duration) || timer.duration <= 0 || timer.duration > 10800 || !Number.isFinite(timer.endAt) || !text(timer.module) || typeof timer.paused !== 'boolean' || (timer.paused && (!Number.isFinite(timer.remaining) || timer.remaining < 0 || timer.remaining > timer.duration))) throw new Error('Backup contains an invalid timer.');
  }
  return { ...data, studyState: state };
}
