import { dateKey, monthDates, parseNotes, isDateKey, scheduledTasks } from './model.mjs';

const $ = selector => document.querySelector(selector);
const paths = {
  left: '<path d="m14 6-6 6 6 6"/>', right: '<path d="m10 6 6 6-6 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', close: '<path d="m7 7 10 10M17 7 7 17"/>',
  check: '<path d="m5 12 4 4L19 6"/>', search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
  calendar: '<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M8 3v4M16 3v4M4 10h16M8 14h2M14 14h2"/>',
  board: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M9 9h12"/>',
  grid: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11M4 6h1M4 12h1M4 18h1"/>',
  note: '<path d="M5 3h14v13l-5 5H5zM14 21v-5h5M9 8h6M9 12h4"/>',
  checklist: '<path d="m3 6 2 2 3-4M11 6h10m-18 8 2 2 3-4M11 14h10M11 20h10"/>',
  minimize: '<path d="M6 12h12"/>',
  moon: '<path d="M20.5 13A8.5 8.5 0 0 1 11 3.5 8.5 8.5 0 1 0 20.5 13z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  drag: '<path d="M9 5h.1M15 5h.1M9 12h.1M15 12h.1M9 19h.1M15 19h.1" stroke-width="3"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v6M14 10v6"/>',
  copy: '<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
  up: '<path d="m6 14 6-6 6 6"/>', down: '<path d="m6 10 6 6 6-6"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  upload: '<path d="M12 15V3m-5 5 5-5 5 5M4 16v5h16v-5"/>'
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.note}</svg>`;
document.querySelectorAll('[data-icon]').forEach(element => element.innerHTML = icon(element.dataset.icon));

const key = 'sourcenote.v1';
const colors = { yellow: '#f5efb9', blue: '#dcecf4', pink: '#f3dfdc', green: '#e3ecd8', white: '#fff' };
let selected = new Date();
let month = new Date(selected.getFullYear(), selected.getMonth(), 1);
let notes = [];
let unreadable = null;
let storageError = false;
let undoData = null;
let draggedId = null;
let draggedTask = null;
const format = (date, options) => date.toLocaleDateString('en-US', options);
const todayKey = () => dateKey(new Date());

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const dark = theme === 'dark';
  const label = `Switch to ${dark ? 'light' : 'dark'} mode`;
  const toggle = $('#theme-toggle');
  toggle.setAttribute('aria-label', label); toggle.title = label;
  toggle.setAttribute('aria-pressed', String(dark));
  toggle.innerHTML = icon(dark ? 'sun' : 'moon');
  $('meta[name="theme-color"]').content = dark ? '#171b18' : '#f7f8fa';
  window.chrome?.webview?.postMessage(`theme:${theme}`);
}
applyTheme(document.documentElement.dataset.theme);
$('#theme-toggle').onclick = () => {
  const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  applyTheme(theme);
  try { localStorage.setItem('sourcenote.theme', theme); }
  catch { toast('Theme could not be saved'); }
};

function starterNotes() {
  const date = todayKey();
  return [
    { id: crypto.randomUUID(), date, title: "Today's focus", body: '', color: 'yellow', kind: 'checklist', items: [{ text: 'Plan the week ahead', done: true }, { text: 'Make time for the side project', done: false }, { text: 'Go for an evening walk', done: false }] },
    { id: crypto.randomUUID(), date, title: 'A little idea', body: 'A place for the thoughts that show up between everything else.\n\nMake something small. See where it goes.', color: 'blue', kind: 'note', items: [] },
    { id: crypto.randomUUID(), date, title: 'Reading list', body: 'The Creative Act\nA chapter before bed.\n\nKeep a few lines worth remembering here.', color: 'pink', kind: 'note', items: [] },
    { id: crypto.randomUUID(), date, title: 'Little things', body: '', color: 'green', kind: 'checklist', items: [{ text: 'Water the plants', done: true }, { text: 'Pick up coffee', done: false }, { text: 'Call home', done: false }] }
  ];
}

try {
  const saved = localStorage.getItem(key);
  if (saved === null) { notes = starterNotes(); save(); }
  else { unreadable = saved; notes = parseNotes(saved); unreadable = null; }
} catch {
  if (unreadable === null) storageError = true;
}

function save() {
  if (unreadable !== null) return;
  try { localStorage.setItem(key, JSON.stringify({ version: 1, notes })); storageError = false; }
  catch { storageError = true; }
  showSaveStatus();
}

function showSaveStatus() {
  const status = $('#save-status');
  status.classList.toggle('error', storageError || unreadable !== null);
  status.innerHTML = unreadable !== null ? 'Saved notes could not be read. Export a backup.' : storageError ? 'Changes are not saved. Export a backup.' : `${icon('check')}All changes saved`;
}

function grow(field) { if (field.getClientRects().length) { field.style.height = 'auto'; field.style.height = `${field.scrollHeight}px`; } }

function renderDays(scroll = false) {
  $('#month-name').textContent = format(month, { month: 'short' });
  $('#month-name').title = format(month, { month: 'long', year: 'numeric' });
  $('#month-year').textContent = month.getFullYear();
  const counts = new Map();
  notes.filter(note => note.date !== null).forEach(note => counts.set(note.date, (counts.get(note.date) || 0) + 1));
  const tasks = new Map();
  notes.filter(note => note.kind === 'checklist').forEach(note => note.items.forEach(item => {
    if (item.date) tasks.set(item.date, (tasks.get(item.date) || 0) + 1);
  }));
  $('#days').replaceChildren(...monthDates(month).map(date => {
    const day = document.createElement('button');
    const value = dateKey(date);
    const current = value === dateKey(selected);
    day.className = `day${current ? ' active' : ''}${value === todayKey() ? ' today' : ''}`;
    day.dataset.date = value;
    day.setAttribute('aria-label', `${format(date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}${counts.has(value) ? `, ${counts.get(value)} ${counts.get(value) === 1 ? 'note' : 'notes'}` : ''}${tasks.has(value) ? `, ${tasks.get(value)} ${tasks.get(value) === 1 ? 'task' : 'tasks'}` : ''}`);
    day.setAttribute('aria-pressed', String(current));
    if (value === todayKey()) day.setAttribute('aria-current', 'date');
    day.innerHTML = `<span class="day-number">${String(date.getDate()).padStart(2, '0')}</span><span class="day-weekday">${format(date, { weekday: 'short' })}</span>${value === todayKey() ? '<span class="day-today-dot"></span>' : counts.has(value) || tasks.has(value) ? '<span class="day-note-dot"></span>' : ''}`;
    day.onclick = () => { selected = date; $('#search').value = ''; renderDays(); renderBoard(); };
    day.ondragover = event => { if (draggedTask) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; day.classList.add('task-drop'); } };
    day.ondragleave = event => { if (!day.contains(event.relatedTarget)) day.classList.remove('task-drop'); };
    day.ondrop = event => {
      if (!draggedTask) return;
      event.preventDefault();
      const { note, item } = draggedTask;
      draggedTask = null;
      scheduleTask(note, item, value);
      toast(`Task scheduled for ${format(date, { month: 'short', day: 'numeric' })}`);
    };
    return day;
  }));
  if (scroll) $('#days .active')?.scrollIntoView({ block: 'nearest', inline: 'center' });
}

function dayNotes() {
  return notes.filter(note => note.date === null || note.date === dateKey(selected));
}

function renderBoard(focusId) {
  $('#weekday').textContent = format(selected, { weekday: 'long' });
  $('#date-heading').textContent = format(selected, { month: 'long', day: 'numeric' });
  $('#today-badge').hidden = dateKey(selected) !== todayKey();
  $('#add-day-note span:last-child').textContent = dateKey(selected) === todayKey() ? 'Today note' : 'Day note';
  $('#add-day-note').title = `Add a note for ${format(selected, { month: 'long', day: 'numeric' })}`;
  const current = dayNotes();
  $('#note-count').textContent = `${current.length} ${current.length === 1 ? 'note' : 'notes'}`;
  const query = $('#search').value.trim().toLowerCase();
  const filtered = current.filter(note => `${note.title}\n${note.body}\n${note.items.map(item => item.text).join('\n')}`.toLowerCase().includes(query));
  $('#board').replaceChildren(...filtered.map(renderNote));
  renderScheduledTasks();
  $('#empty-search').hidden = !query || filtered.length > 0 || $('#scheduled-tasks') !== null;
  if (!query && unreadable === null) {
    const add = document.createElement('div');
    add.className = 'new-card';
    add.innerHTML = `<button aria-label="New note"><span>${icon('plus')}</span><span>New note</span></button><button class="add-checklist">${icon('checklist')}Day checklist</button>`;
    add.firstElementChild.onclick = () => addNote('note');
    add.lastElementChild.onclick = () => addNote('checklist', dateKey(selected));
    $('#board').append(add);
  }
  $('#add-note').disabled = unreadable !== null;
  $('#add-day-note').disabled = unreadable !== null;
  $('#add-general-checklist').disabled = unreadable !== null;
  $('#add-day-checklist').disabled = unreadable !== null;
  requestAnimationFrame(() => {
    document.querySelectorAll('#board textarea').forEach(grow);
    if (focusId) {
      const card = [...document.querySelectorAll('.note')].find(card => card.dataset.id === focusId);
      card?.querySelector('.note-title').focus();
      card?.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    }
  });
  showSaveStatus();
}

function renderNote(note) {
  const card = document.createElement('article');
  card.className = `note${note.minimized ? ' minimized' : ''}`;
  card.dataset.color = note.color;
  card.dataset.id = note.id;
  card.setAttribute('aria-label', note.title || 'Untitled note');
  card.innerHTML = `<div class="note-toolbar"><span class="note-type">${icon(note.kind)}${note.date === null ? 'General' : 'Day'} ${note.kind === 'checklist' ? 'checklist' : 'note'}</span><div class="note-actions"><button class="icon-button drag-handle" draggable="true" aria-label="Drag to reorder" title="Drag to reorder">${icon('drag')}</button><button class="icon-button minimize-button" aria-label="${note.minimized ? 'Restore note' : 'Minimize note'}" title="${note.minimized ? 'Restore note' : 'Minimize note'}" aria-expanded="${!note.minimized}">${icon(note.minimized ? 'down' : 'minimize')}</button><details class="note-menu"><summary class="icon-button" aria-label="Note options">${icon('more')}</summary><div class="menu-panel"><div class="color-picker" role="group" aria-label="Note color"></div><button class="menu-action move-up">${icon('up')}Move earlier</button><button class="menu-action move-down">${icon('down')}Move later</button><button class="menu-action duplicate">${icon('copy')}Duplicate</button><button class="menu-action danger delete">${icon('trash')}Delete note</button></div></details></div></div><textarea class="note-title" rows="1" placeholder="Untitled" aria-label="Note title"></textarea><div class="note-content"${note.minimized ? ' hidden' : ''}></div><div class="note-bottom"${note.minimized ? ' hidden' : ''}><span></span></div>`;
  const title = card.querySelector('.note-title');
  title.value = note.title;
  title.oninput = () => { note.title = title.value; card.setAttribute('aria-label', title.value || 'Untitled note'); grow(title); save(); renderScheduledTasks(); };
  const content = card.querySelector('.note-content');
  if (note.kind === 'note') {
    const body = document.createElement('textarea');
    body.className = 'note-body';
    body.rows = 5;
    body.placeholder = 'Start writing...';
    body.setAttribute('aria-label', 'Note text');
    body.value = note.body;
    body.oninput = () => { note.body = body.value; grow(body); save(); };
    content.append(body);
  } else renderChecklist(card, note);
  updateBottom(card, note);
  const picker = card.querySelector('.color-picker');
  Object.entries(colors).forEach(([name, hex]) => {
    const button = document.createElement('button');
    button.className = `color-swatch${note.color === name ? ' selected' : ''}`;
    button.style.setProperty('--swatch', hex);
    button.setAttribute('aria-label', `${name[0].toUpperCase() + name.slice(1)} note`);
    button.setAttribute('aria-pressed', String(note.color === name));
    button.onclick = () => { note.color = name; save(); renderBoard(); };
    picker.append(button);
  });
  card.querySelector('.minimize-button').onclick = event => {
    note.minimized = !note.minimized;
    card.classList.toggle('minimized', note.minimized);
    content.hidden = note.minimized;
    card.querySelector('.note-bottom').hidden = note.minimized;
    const button = event.currentTarget;
    button.setAttribute('aria-expanded', String(!note.minimized));
    button.setAttribute('aria-label', note.minimized ? 'Restore note' : 'Minimize note');
    button.title = note.minimized ? 'Restore note' : 'Minimize note';
    button.innerHTML = icon(note.minimized ? 'down' : 'minimize');
    card.querySelectorAll('textarea').forEach(grow);
    save();
  };
  const siblings = dayNotes();
  const position = siblings.indexOf(note);
  const up = card.querySelector('.move-up');
  const down = card.querySelector('.move-down');
  up.disabled = position === 0;
  down.disabled = position === siblings.length - 1;
  up.onclick = () => swapNotes(note, siblings[position - 1]);
  down.onclick = () => swapNotes(note, siblings[position + 1]);
  card.querySelector('.duplicate').onclick = () => {
    const copy = structuredClone(note);
    copy.id = crypto.randomUUID();
    notes.splice(notes.indexOf(note) + 1, 0, copy);
    save(); renderDays(); renderBoard(copy.id);
  };
  card.querySelector('.delete').onclick = () => {
    undoData = { note, index: notes.indexOf(note) };
    notes.splice(undoData.index, 1);
    save(); renderDays(); renderBoard(); toast('Note deleted', true);
  };
  const handle = card.querySelector('.drag-handle');
  handle.ondragstart = event => {
    draggedId = note.id; event.dataTransfer.setData('text/plain', note.id); event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setDragImage(card, 30, 20); card.classList.add('dragging');
  };
  handle.ondragend = () => { draggedId = null; document.querySelectorAll('.dragging, .drag-over').forEach(el => el.classList.remove('dragging', 'drag-over')); };
  card.ondragover = event => { if (draggedId && draggedId !== note.id) { event.preventDefault(); card.classList.add('drag-over'); } };
  card.ondragleave = event => { if (!card.contains(event.relatedTarget)) card.classList.remove('drag-over'); };
  card.ondrop = event => {
    event.preventDefault();
    const source = notes.find(other => other.id === draggedId);
    draggedId = null;
    card.classList.remove('drag-over');
    if (source && dayNotes().includes(source)) swapNotes(source, note);
  };
  return card;
}

function updateBottom(card, note) {
  card.querySelector('.note-bottom span').textContent = note.kind === 'checklist' ? `${note.items.filter(item => item.done).length} of ${note.items.length} done` : note.date === null ? 'All days' : format(new Date(`${note.date}T12:00:00`), { month: 'short', day: 'numeric' });
}

function renderChecklist(card, note, focusLast = false) {
  const content = card.querySelector('.note-content');
  const list = document.createElement('div');
  list.className = 'checklist';
  note.items.forEach((item, index) => {
    const row = document.createElement('div');
    row.className = `check-row${item.done ? ' done' : ''}`;
    row.dataset.noteId = note.id;
    row.dataset.itemIndex = index;
    row.innerHTML = `<input type="checkbox"><textarea rows="1" class="check-text" placeholder="New item" aria-label="Checklist item"></textarea><button class="icon-button remove-item" aria-label="Remove item">${icon('close')}</button>`;
    const check = row.querySelector('input');
    check.checked = item.done;
    check.setAttribute('aria-label', `Complete ${item.text || 'item'}`);
    check.onchange = () => setTaskDone(note, item, check.checked);
    const text = row.querySelector('textarea');
    text.value = item.text;
    text.oninput = () => { item.text = text.value; check.setAttribute('aria-label', `Complete ${item.text || 'item'}`); grow(text); save(); renderScheduledTasks(); };
    text.onkeydown = event => { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); note.items.splice(index + 1, 0, { text: '', done: false }); save(); renderChecklist(card, note); renderScheduledTasks(); const next = content.querySelectorAll('textarea')[index + 1]; next.focus(); grow(next); } };
    row.querySelector('button').onclick = () => { note.items.splice(index, 1); save(); renderChecklist(card, note); renderDays(); renderScheduledTasks(); };
    row.insertBefore(taskSchedule(note, item), row.lastElementChild);
    taskDrag(row, note, item);
    list.append(row);
  });
  const add = document.createElement('button');
  add.className = 'add-item';
  add.innerHTML = `${icon('plus')}Add item`;
  add.onclick = () => { note.items.push({ text: '', done: false }); save(); renderChecklist(card, note, true); };
  content.replaceChildren(list, add);
  updateBottom(card, note);
  requestAnimationFrame(() => { content.querySelectorAll('textarea').forEach(grow); if (focusLast) content.querySelector('.check-row:last-child textarea')?.focus(); });
}

function scheduleTask(note, item, date) {
  if (!notes.includes(note) || !note.items.includes(item) || (date && !isDateKey(date))) return;
  if (date) item.date = date;
  else delete item.date;
  save(); renderDays(); renderBoard();
  const control = [...document.querySelectorAll('.check-row')].find(row => row.dataset.noteId === note.id && Number(row.dataset.itemIndex) === note.items.indexOf(item));
  (control?.querySelector('.task-schedule summary') || $('#days .active'))?.focus();
}

function taskSchedule(note, item) {
  const menu = document.createElement('details');
  menu.className = `task-schedule${item.date ? ' assigned' : ''}`;
  menu.innerHTML = `<summary aria-label="Schedule task">${icon('calendar')}<span></span></summary><div class="task-date-panel"><label>Schedule<input type="date" aria-label="Task date"></label><button class="clear-task-date">Clear date</button></div>`;
  const summary = menu.querySelector('summary');
  summary.title = item.date ? format(new Date(`${item.date}T12:00:00`), { month: 'long', day: 'numeric', year: 'numeric' }) : 'Schedule task';
  menu.querySelector('summary span').textContent = item.date ? format(new Date(`${item.date}T12:00:00`), { month: 'short', day: 'numeric' }) : '';
  const input = menu.querySelector('input');
  input.value = item.date || '';
  input.onchange = () => scheduleTask(note, item, input.value);
  const clear = menu.querySelector('button');
  clear.disabled = !item.date;
  clear.onclick = () => scheduleTask(note, item, '');
  return menu;
}

function taskDrag(row, note, item) {
  const handle = document.createElement('button');
  handle.className = 'icon-button task-drag';
  handle.draggable = true;
  handle.setAttribute('aria-label', 'Drag task to a day');
  handle.title = 'Drag task to a day';
  handle.innerHTML = icon('drag');
  handle.ondragstart = event => {
    event.stopPropagation(); draggedId = null; draggedTask = { note, item };
    event.dataTransfer.setData('text/plain', item.text); event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setDragImage(row, 20, 10); row.classList.add('dragging-task');
  };
  handle.ondragend = () => { draggedTask = null; document.querySelectorAll('.dragging-task, .task-drop').forEach(element => element.classList.remove('dragging-task', 'task-drop')); };
  row.append(handle);
}

function setTaskDone(note, item, done) {
  item.done = done;
  document.querySelectorAll('.check-row').forEach(row => {
    if (row.dataset.noteId !== note.id || Number(row.dataset.itemIndex) !== note.items.indexOf(item)) return;
    row.classList.toggle('done', done);
    row.querySelector('input[type="checkbox"]').checked = done;
  });
  const source = [...document.querySelectorAll('.note[data-id]')].find(card => card.dataset.id === note.id);
  if (source) updateBottom(source, note);
  const checks = [...document.querySelectorAll('#scheduled-tasks input[type="checkbox"]')];
  if ($('#scheduled-tasks')) $('#scheduled-tasks .note-bottom span').textContent = `${checks.filter(check => check.checked).length} of ${checks.length} done`;
  save();
}

function renderScheduledTasks() {
  const query = $('#search').value.trim().toLowerCase();
  const tasks = scheduledTasks(notes, dateKey(selected)).filter(({ note, item }) => `${note.title}\n${item.text}`.toLowerCase().includes(query));
  $('#scheduled-tasks')?.remove();
  if (!tasks.length) return;
  const card = document.createElement('article');
  card.id = 'scheduled-tasks';
  card.className = 'note scheduled-card';
  card.dataset.color = 'white';
  card.setAttribute('aria-label', 'Scheduled tasks');
  card.innerHTML = `<div class="note-toolbar"><span class="note-type">${icon('calendar')}Scheduled</span></div><h2>Scheduled tasks</h2><div class="checklist"></div><div class="note-bottom"><span>${tasks.filter(({ item }) => item.done).length} of ${tasks.length} done</span></div>`;
  tasks.forEach(({ note, item }) => {
    const row = document.createElement('div');
    row.className = `check-row scheduled-row${item.done ? ' done' : ''}`;
    row.dataset.noteId = note.id;
    row.dataset.itemIndex = note.items.indexOf(item);
    row.innerHTML = `<input type="checkbox"><div class="scheduled-text"><span class="check-text"></span><button class="task-source"></button></div>`;
    const check = row.querySelector('input');
    check.checked = item.done;
    check.setAttribute('aria-label', `Complete ${item.text || 'item'}`);
    check.onchange = () => setTaskDone(note, item, check.checked);
    row.querySelector('.check-text').textContent = item.text || 'Untitled task';
    const source = row.querySelector('.task-source');
    source.textContent = note.title || 'Untitled checklist';
    source.title = 'Open original checklist';
    source.onclick = () => {
      if (note.date) { selected = new Date(`${note.date}T12:00:00`); month = new Date(selected.getFullYear(), selected.getMonth(), 1); }
      note.minimized = false; $('#search').value = ''; save(); renderDays(true); renderBoard(note.id);
    };
    row.append(taskSchedule(note, item));
    taskDrag(row, note, item);
    card.querySelector('.checklist').append(row);
  });
  $('#board').prepend(card);
}

function swapNotes(a, b) {
  if (!b || a === b) return;
  const first = notes.indexOf(a), second = notes.indexOf(b);
  [notes[first], notes[second]] = [notes[second], notes[first]];
  save(); renderBoard();
}

function addNote(kind = 'note', date = null) {
  if (unreadable !== null) return;
  $('#search').value = '';
  const note = { id: crypto.randomUUID(), date, title: '', body: '', color: Object.keys(colors)[dayNotes().length % 4], kind, items: kind === 'checklist' ? [{ text: '', done: false }] : [] };
  notes.push(note); save(); renderDays(); renderBoard(note.id);
}

function toast(message, undo = false) { $('#toast-message').textContent = message; $('#undo').hidden = !undo; $('#toast').hidden = false; }
$('#undo').onclick = () => {
  if (!undoData) return;
  notes.splice(Math.min(undoData.index, notes.length), 0, undoData.note);
  if (undoData.note.date !== null) selected = new Date(`${undoData.note.date}T12:00:00`);
  month = new Date(selected.getFullYear(), selected.getMonth(), 1);
  undoData = null; $('#toast').hidden = true; save(); renderDays(true); renderBoard();
};
$('#dismiss-toast').onclick = () => { $('#toast').hidden = true; };
$('#add-note').onclick = () => addNote();
$('#add-day-note').onclick = () => addNote('note', dateKey(selected));
$('#add-general-checklist').onclick = () => addNote('checklist');
$('#add-day-checklist').onclick = () => addNote('checklist', dateKey(selected));
$('#search').oninput = () => renderBoard();
$('#today').onclick = () => { selected = new Date(); month = new Date(selected.getFullYear(), selected.getMonth(), 1); $('#search').value = ''; renderDays(true); renderBoard(); };
for (const [selector, delta] of [['#prev-month', -1], ['#next-month', 1]]) {
  $(selector).onclick = () => { const day = selected.getDate(); month = new Date(month.getFullYear(), month.getMonth() + delta, 1); selected = new Date(month.getFullYear(), month.getMonth(), Math.min(day, monthDates(month).length)); $('#search').value = ''; renderDays(true); renderBoard(); };
}
for (const [selector, list] of [['#board-view', false], ['#list-view', true]]) {
  $(selector).onclick = () => {
    $('#board').classList.toggle('list-layout', list);
    $('#board-view').classList.toggle('active', !list); $('#board-view').setAttribute('aria-pressed', String(!list));
    $('#list-view').classList.toggle('active', list); $('#list-view').setAttribute('aria-pressed', String(list));
    document.querySelectorAll('#board textarea').forEach(grow);
  };
}
$('#export').onclick = () => {
  const blob = new Blob([unreadable ?? JSON.stringify({ version: 1, notes }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = `sourcenote-${todayKey()}.json`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
document.addEventListener('click', event => { document.querySelectorAll('.note-menu[open], .task-schedule[open]').forEach(menu => { if (!menu.contains(event.target)) menu.open = false; }); });
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') { document.querySelectorAll('.note-menu[open], .task-schedule[open]').forEach(menu => { menu.open = false; menu.querySelector('summary').focus(); }); $('#toast').hidden = true; }
  if (event.altKey && event.key.toLowerCase() === 'n') { event.preventDefault(); addNote(); }
});
// Another tab's saved edits become visible instead of being silently overwritten.
window.addEventListener('storage', event => {
  if (event.key !== key) return;
  if (event.newValue === null) { unreadable = null; notes = []; }
  else { try { notes = parseNotes(event.newValue); unreadable = null; } catch { unreadable = event.newValue; notes = []; } }
  renderDays(); renderBoard();
});
let narrow = innerWidth <= 640;
window.addEventListener('resize', () => {
  if (narrow !== (innerWidth <= 640)) { narrow = innerWidth <= 640; renderDays(true); }
  document.querySelectorAll('#board textarea').forEach(grow);
});
renderDays(true);
renderBoard();
if (window.chrome?.webview) {
  const desktop = window.chrome.webview;
  $('#import').hidden = false;
  $('#import').onclick = () => desktop.postMessage('import');
  desktop.addEventListener('message', event => {
    try {
      const imported = parseNotes(event.data);
      localStorage.setItem(key, JSON.stringify({ version: 1, notes: imported }));
      notes = imported; unreadable = null; storageError = false;
      renderDays(); renderBoard(); toast('Notes imported');
      desktop.postMessage('imported');
    } catch { desktop.postMessage('import-error'); }
  });
}
