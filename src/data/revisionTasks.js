export function createRevisionTask(title, module = '', noteId = null) {
  if (!title.trim()) throw new Error('Enter a revision task.');
  return { id: `task-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    title: title.trim(), module: module.trim().toUpperCase(), note_id: noteId, completed: 0,
    reflection: '', updated_at: new Date().toISOString() };
}
