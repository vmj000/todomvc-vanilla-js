import test from 'node:test';
import assert from 'node:assert/strict';
import { createController } from '../js/controller.js';
import { visibleTodos } from '../js/model.js';
import { STORAGE_UNAVAILABLE } from '../js/storage.js';

function setup(options = {}) {
  const saves = [];
  const renders = [];
  let id = 0;
  const controller = createController({
    initialTodos: [
      { id: 'a', title: 'Read', completed: false },
      { id: 'b', title: 'Walk', completed: true },
      { id: 'c', title: 'Write', completed: false },
    ],
    createId: () => `new-${++id}`,
    save: todos => { saves.push(todos); return ''; },
    render: state => renders.push(state),
    ...options,
  });
  return { controller, saves, renders };
}

test('adding blank text is a no-op and valid additions save once', () => {
  const { controller, saves, renders } = setup();
  assert.equal(controller.add('  '), false);
  assert.equal(saves.length, 0);
  assert.equal(renders.length, 0);
  assert.equal(controller.add('  Tea  '), true);
  assert.deepEqual(controller.snapshot().todos.at(-1), { id: 'new-1', title: 'Tea', completed: false });
  assert.equal(saves.length, 1);
});

test('editing commits only once when Enter is followed by blur', () => {
  const { controller, saves } = setup();
  controller.startEdit('a');
  controller.setDraft('a', '  Read more  ');
  controller.finishEdit('a');
  controller.finishEdit('a');
  assert.equal(controller.snapshot().todos[0].title, 'Read more');
  assert.equal(controller.snapshot().editing, null);
  assert.equal(saves.length, 1);
});

test('Escape cancels a blank draft and subsequent blur cannot delete the todo', () => {
  const { controller, saves } = setup();
  controller.startEdit('a');
  controller.setDraft('a', '');
  controller.finishEdit('a', true);
  controller.finishEdit('a');
  assert.equal(controller.snapshot().todos[0].title, 'Read');
  assert.equal(controller.snapshot().todos.length, 3);
  assert.equal(saves.length, 0);
});

test('blur commits and blank committed edits delete, with duplicate finish ignored', () => {
  const { controller, saves } = setup();
  controller.startEdit('b');
  controller.setDraft('b', '  ');
  controller.finishEdit('b');
  controller.finishEdit('b');
  assert.deepEqual(controller.snapshot().todos.map(todo => todo.id), ['a', 'c']);
  assert.equal(saves.length, 1);
});

test('unchanged edits do not write storage', () => {
  const { controller, saves } = setup();
  controller.startEdit('a');
  controller.setDraft('a', ' Read ');
  controller.finishEdit('a');
  assert.equal(saves.length, 0);
});

test('starting another edit commits the previous draft and selects the new original', () => {
  const { controller } = setup();
  controller.startEdit('a');
  controller.setDraft('a', 'New title');
  controller.startEdit('b');
  assert.equal(controller.snapshot().todos[0].title, 'New title');
  assert.deepEqual(controller.snapshot().editing, { id: 'b', draft: 'Walk' });
  controller.startEdit('b');
  controller.setDraft('missing', 'ignored');
  assert.equal(controller.snapshot().editing.draft, 'Walk');
});

test('missing edits and stale blur events do not affect the current editor', () => {
  const { controller } = setup();
  controller.startEdit('missing');
  assert.equal(controller.snapshot().editing, null);
  controller.startEdit('b');
  controller.finishEdit('a');
  assert.equal(controller.snapshot().editing.id, 'b');
});

test('routing commits an edit, normalizes unknown filters, and does not itself save', () => {
  const { controller, saves } = setup();
  controller.startEdit('a');
  controller.setDraft('a', 'Changed before routing');
  controller.setFilter('completed');
  assert.equal(controller.snapshot().editing, null);
  assert.equal(controller.snapshot().todos[0].title, 'Changed before routing');
  assert.equal(controller.snapshot().filter, 'completed');
  controller.setFilter('unsupported');
  assert.equal(controller.snapshot().filter, 'all');
  assert.equal(saves.length, 1);
  assert.equal(setup({ filter: 'unsupported' }).controller.snapshot().filter, 'all');
});

test('toggle-all targets hidden items and leaves an empty active-filter view', () => {
  const { controller } = setup();
  controller.setFilter('active');
  controller.dispatch({ type: 'toggle-all' });
  assert.ok(controller.snapshot().todos.every(todo => todo.completed));
  assert.equal(visibleTodos(controller.snapshot().todos, 'active').length, 0);
  controller.dispatch({ type: 'toggle-all' });
  assert.ok(controller.snapshot().todos.every(todo => !todo.completed));
});

test('clear completed removes hidden completed items without changing the filter', () => {
  const { controller } = setup();
  controller.setFilter('active');
  controller.dispatch({ type: 'clear-completed' });
  assert.deepEqual(controller.snapshot().todos.map(todo => todo.id), ['a', 'c']);
  assert.equal(controller.snapshot().filter, 'active');
});

test('deleting the current edit target closes the editor and ignores its later blur', () => {
  const { controller, saves } = setup();
  controller.startEdit('b');
  controller.dispatch({ type: 'delete', id: 'b' });
  controller.finishEdit('b');
  assert.equal(controller.snapshot().editing, null);
  assert.equal(controller.snapshot().todos.length, 2);
  assert.equal(saves.length, 1);
});

test('failed saves retain in-memory state, warn, and recover after a successful save', () => {
  let blocked = true;
  const { controller } = setup({ save: () => blocked ? STORAGE_UNAVAILABLE : '' });
  controller.add('Unsaved');
  assert.equal(controller.snapshot().todos.length, 4);
  assert.equal(controller.snapshot().storageError, STORAGE_UNAVAILABLE);
  blocked = false;
  controller.dispatch({ type: 'toggle', id: 'a' });
  assert.equal(controller.snapshot().storageError, '');
  assert.equal(controller.snapshot().todos.length, 4);
});

test('initial load warnings are rendered and no-op operations do not hide them', () => {
  const { controller, renders, saves } = setup({ initialError: STORAGE_UNAVAILABLE });
  controller.render();
  controller.dispatch({ type: 'delete', id: 'missing' });
  assert.equal(renders.at(-1).storageError, STORAGE_UNAVAILABLE);
  assert.equal(saves.length, 0);
});
