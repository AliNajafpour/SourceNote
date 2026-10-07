export function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function monthDates(date) {
  return Array.from({ length: new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate() }, (_, i) => new Date(date.getFullYear(), date.getMonth(), i + 1));
}

export function isDateKey(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && dateKey(new Date(`${value}T12:00:00`)) === value;
}

export function scheduledTasks(notes, date) {
  return notes.filter(note => note.kind === 'checklist').flatMap(note => note.items.filter(item => item.date === date).map(item => ({ note, item })));
}

export function parseNotes(raw) {
  const data = JSON.parse(raw);
  const colors = ['yellow', 'blue', 'pink', 'green', 'white'];
  const ids = new Set();
  if (data?.version !== 1 || !Array.isArray(data.notes)) throw new Error('Unsupported saved notes');
  for (const note of data.notes) {
    if (!note || typeof note.id !== 'string' || !note.id || ids.has(note.id) ||
      (note.date !== null && !isDateKey(note.date)) ||
      typeof note.title !== 'string' || typeof note.body !== 'string' ||
      !colors.includes(note.color) || !['note', 'checklist'].includes(note.kind) ||
      (note.pinned !== undefined && typeof note.pinned !== 'boolean') ||
      (note.minimized !== undefined && typeof note.minimized !== 'boolean') ||
      !Array.isArray(note.items) || note.items.some(item => !item || typeof item.text !== 'string' || typeof item.done !== 'boolean' ||
        (item.date !== undefined && item.date !== null && !isDateKey(item.date)))) {
      throw new Error('Invalid saved note');
    }
    ids.add(note.id);
  }
  return data.notes.map(({ pinned, ...note }) => note);
}
