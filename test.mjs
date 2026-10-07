import assert from 'node:assert/strict';
import * as model from './model.mjs';
const { dateKey, monthDates, parseNotes } = model;

// Catches UTC date shifts, missing leap days, and unsafe saved-data overwrites.
assert.equal(dateKey(new Date(2026, 9, 6, 23, 59)), '2026-10-06');
assert.equal(monthDates(new Date(2024, 1, 15)).length, 29);
assert.equal(dateKey(monthDates(new Date(2026, 11, 1)).at(-1)), '2026-12-31');
const note = { id: 'a', date: '2026-10-06', title: '<script>', body: 'Hello', color: 'yellow', kind: 'note', items: [] };
assert.deepEqual(parseNotes(JSON.stringify({ version: 1, notes: [note] })), [note]);
const general = { ...note, id: 'general', date: null, minimized: true };
assert.deepEqual(parseNotes(JSON.stringify({ version: 1, notes: [general] })), [general]);
const checklist = { ...general, kind: 'checklist', items: [{ text: 'Keep across days', done: true }] };
assert.deepEqual(parseNotes(JSON.stringify({ version: 1, notes: [checklist] })), [checklist]);
assert.deepEqual(parseNotes(JSON.stringify({ version: 1, notes: [{ ...note, pinned: true }] })), [note]);
assert.throws(() => parseNotes(JSON.stringify({ version: 1, notes: [{ ...note, minimized: 'yes' }] })));
assert.throws(() => parseNotes('{broken'));
assert.throws(() => parseNotes('{"version":1,"notes":[{"id":"a"}]}'));
assert.throws(() => parseNotes(JSON.stringify({ version: 1, notes: [{ ...note, date: '2026-02-31' }] })));
assert.throws(() => parseNotes(JSON.stringify({ version: 1, notes: [note, note] })));
assert.throws(() => parseNotes(JSON.stringify({ version: 2, notes: [] })));
// Scheduled items must survive reload, reject impossible dates, and retain their source identity.
const scheduled = { ...checklist, items: [{ text: 'Read chapter', done: false, date: '2026-10-09' }, { text: 'Undated', done: false }] };
assert.deepEqual(parseNotes(JSON.stringify({ version: 1, notes: [scheduled] })), [scheduled]);
for (const date of ['2026-02-30', 'not-a-date', 42, '2026-13-01']) {
  assert.throws(() => parseNotes(JSON.stringify({ version: 1, notes: [{ ...scheduled, items: [{ text: 'Invalid', done: false, date }] }] })));
}
const daily = { ...scheduled, id: 'daily', date: '2026-10-06', items: [{ text: 'From another day', done: true, date: '2026-10-09' }] };
assert.equal(typeof model.scheduledTasks, 'function', 'Scheduled task lookup is missing');
const tasks = model.scheduledTasks([scheduled, daily, { ...note, items: [{ text: 'Hidden item', done: false, date: '2026-10-09' }] }], '2026-10-09');
assert.deepEqual(tasks.map(({ item }) => item.text), ['Read chapter', 'From another day']);
assert.equal(tasks[0].note, scheduled);
tasks[0].item.done = true;
assert.equal(scheduled.items[0].done, true, 'Daily view must update the original item');
assert.deepEqual(model.scheduledTasks([scheduled, daily], '2026-10-10'), []);
scheduled.items[0].date = '2026-10-10';
assert.equal(model.scheduledTasks([scheduled, daily], '2026-10-09').length, 1);
delete scheduled.items[0].date;
assert.deepEqual(model.scheduledTasks([scheduled], '2026-10-10'), []);
console.log('Calendar, saved-note, and scheduled-task checks passed.');
