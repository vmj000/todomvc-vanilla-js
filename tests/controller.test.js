import test from 'node:test';
import assert from 'node:assert/strict';
import { createController } from '../js/controller.js';
import { remainingCount, visibleTodos } from '../js/model.js';
import { STORAGE_UNAVAILABLE } from '../js/storage.js';

function setup(options = {}) {
  const saves = [];
  const renders = [];
  let id = 0;
  const controller = createController({
    initialTodos: [
      { id: 'a', title: 'Read', location: '', completed: false },
      { id: 'b', title: 'Walk', location: '', completed: true },
      { id: 'c', title: 'Write', location: '', completed: false },
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
  assert.deepEqual(controller.snapshot().todos.at(-1), { id: 'new-1', title: 'Tea', location: '', completed: false });
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
  assert.deepEqual(controller.snapshot().editing, { id: 'b', draft: 'Walk', locationDraft: '' });
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

test('optional creation locations are trimmed and a location alone cannot create a todo', () => {
  const { controller, saves } = setup();
  assert.equal(controller.add(' ', 'Office'), false);
  assert.equal(saves.length, 0);
  controller.add(' Tea ', ' Kitchen ');
  assert.deepEqual(controller.snapshot().todos.at(-1), { id: 'new-1', title: 'Tea', location: 'Kitchen', completed: false });
});

test('title and location drafts are independent and commit atomically only once', () => {
  const { controller, saves } = setup();
  controller.startEdit('b');
  controller.setDraft('b', ' Longer walk ');
  controller.setLocationDraft('b', ' Park ');
  assert.deepEqual(controller.snapshot().editing, { id: 'b', draft: ' Longer walk ', locationDraft: ' Park ' });
  assert.equal(saves.length, 0);
  controller.finishEdit('b');
  controller.finishEdit('b');
  assert.deepEqual(controller.snapshot().todos[1], { id: 'b', title: 'Longer walk', location: 'Park', completed: true });
  assert.equal(saves.length, 1);
});

test('cancel restores both original fields and stale blur/draft updates cannot change them', () => {
  const { controller, saves } = setup({ initialTodos: [{ id: 'a', title: 'Read', location: 'Home', completed: false }] });
  controller.startEdit('a');
  controller.setDraft('a', '');
  controller.setLocationDraft('a', 'Library');
  controller.finishEdit('a', true);
  controller.finishEdit('a');
  controller.setLocationDraft('a', 'Stale');
  assert.deepEqual(controller.snapshot().todos[0], { id: 'a', title: 'Read', location: 'Home', completed: false });
  assert.equal(saves.length, 0);
});

test('clearing a location does not delete the task and filter changes save location drafts', () => {
  const { controller } = setup({ initialTodos: [{ id: 'a', title: 'Read', location: 'Home', completed: false }] });
  controller.startEdit('a');
  controller.setLocationDraft('a', ' ');
  controller.finishEdit('a');
  assert.equal(controller.snapshot().todos.length, 1);
  assert.equal(controller.snapshot().todos[0].location, '');
  controller.startEdit('a');
  controller.setLocationDraft('a', 'Library');
  controller.setFilter('completed');
  assert.equal(controller.snapshot().todos[0].location, 'Library');
  assert.equal(controller.snapshot().editing, null);
});

test('legacy todos without locations start with an empty location draft', () => {
  const { controller } = setup({ initialTodos: [{ id: 'old', title: 'Existing task', completed: true }] });
  controller.startEdit('old');
  assert.equal(controller.snapshot().editing.locationDraft, '');
  controller.setLocationDraft('old', 'Home');
  controller.finishEdit('old');
  assert.deepEqual(controller.snapshot().todos[0], { id: 'old', title: 'Existing task', location: 'Home', completed: true });
});

test('hiding a focused Edit button during startEdit cannot reentrantly end editing', () => {
  let controller;
  let renders = 0;
  ({ controller } = setup({
    render: state => {
      renders++;
      if (state.editing) controller.finishEditOnFocusOut(state.editing.id, 'edit', false);
    },
  }));
  controller.startEdit('a');
  assert.equal(renders, 1);
  assert.equal(controller.snapshot().editing.id, 'a');
  controller.setDraft('a', 'Changed task');
  controller.setLocationDraft('a', 'Library');
  controller.finishEdit('a');
  assert.deepEqual(controller.snapshot().todos[0], { id: 'a', title: 'Changed task', location: 'Library', completed: false });
});

test('focus transitions within the edited row keep both drafts; leaving a real edit control commits', () => {
  const { controller, saves } = setup();
  controller.startEdit('a');
  controller.setDraft('a', 'Read more');
  controller.setLocationDraft('a', 'Library');
  for (const action of ['editor', 'save', 'cancel']) {
    controller.finishEditOnFocusOut('a', action, true);
    assert.equal(controller.snapshot().editing.id, 'a');
  }
  for (const action of ['edit', 'delete', 'toggle', undefined]) {
    controller.finishEditOnFocusOut('a', action, false);
    assert.equal(controller.snapshot().editing.id, 'a');
  }
  assert.equal(saves.length, 0);
  controller.finishEditOnFocusOut('a', 'editor', false);
  assert.equal(controller.snapshot().editing, null);
  assert.equal(controller.snapshot().todos[0].location, 'Library');
  assert.equal(saves.length, 1);
});

test('query changes render without saving or replacing todos, and filters preserve the query', () => {
  const { controller, saves, renders } = setup();
  const original = controller.snapshot().todos;
  assert.equal(controller.snapshot().query, '');
  controller.setFilter('active');
  controller.setQuery('  READ ');
  assert.equal(controller.snapshot().query, '  READ ');
  assert.equal(controller.snapshot().filter, 'active');
  assert.equal(controller.snapshot().todos, original);
  assert.equal(renders.at(-1).query, '  READ ');
  controller.setFilter('completed');
  const { todos, filter, query } = controller.snapshot();
  assert.equal(query, '  READ ');
  assert.deepEqual(visibleTodos(todos, filter, query), []);
  controller.setQuery('   ');
  assert.deepEqual(visibleTodos(todos, filter, controller.snapshot().query).map(todo => todo.id), ['b']);
  controller.setQuery('');
  assert.equal(saves.length, 0);
  assert.equal(setup({ initialTodos: todos, filter }).controller.snapshot().query, '');
});

test('searching commits both pending edit drafts once before hiding the row', () => {
  const { controller, saves } = setup();
  controller.startEdit('a');
  controller.setDraft('a', 'Read more');
  controller.setLocationDraft('a', 'Library');
  controller.setQuery('walk');
  controller.finishEdit('a');
  assert.equal(controller.snapshot().editing, null);
  assert.deepEqual(controller.snapshot().todos[0], { id: 'a', title: 'Read more', location: 'Library', completed: false });
  assert.equal(controller.snapshot().query, 'walk');
  assert.equal(saves.length, 1);
  controller.setQuery('read');
  assert.equal(saves.length, 1);
});

test('search leaves counts and bulk operations scoped to all todos, including hidden rows', () => {
  const { controller, saves } = setup();
  const visible = () => {
    const { todos, filter, query } = controller.snapshot();
    return visibleTodos(todos, filter, query).map(todo => todo.id);
  };
  controller.setQuery('read');
  assert.deepEqual(visible(), ['a']);
  assert.equal(remainingCount(controller.snapshot().todos), 2);
  controller.dispatch({ type: 'toggle-all' });
  assert.ok(controller.snapshot().todos.every(todo => todo.completed));
  assert.equal(remainingCount(controller.snapshot().todos), 0);
  assert.deepEqual(visible(), ['a']);
  assert.equal(saves.length, 1);
  assert.ok(saves[0].every(todo => todo.completed));
  controller.setFilter('active');
  assert.deepEqual(visible(), []);
  controller.dispatch({ type: 'toggle-all' });
  assert.deepEqual(visible(), ['a']);
  assert.equal(remainingCount(controller.snapshot().todos), 3);
  controller.dispatch({ type: 'toggle', id: 'b' });
  controller.dispatch({ type: 'clear-completed' });
  assert.deepEqual(controller.snapshot().todos.map(todo => todo.id), ['a', 'c']);
  assert.equal(controller.snapshot().filter, 'active');
  assert.equal(controller.snapshot().query, 'read');
});

test('empty-list search remains transient and new matching todos use the existing query', () => {
  const { controller, saves } = setup({ initialTodos: [], initialError: STORAGE_UNAVAILABLE });
  controller.setQuery(' OFFICE ');
  assert.equal(controller.snapshot().storageError, STORAGE_UNAVAILABLE);
  assert.equal(saves.length, 0);
  controller.add('Prepare demo', 'Office');
  const { todos, filter, query } = controller.snapshot();
  assert.deepEqual(visibleTodos(todos, filter, query).map(todo => todo.title), ['Prepare demo']);
  assert.equal(saves.length, 1);
  assert.ok(Array.isArray(saves[0]));
  assert.equal(saves[0][0].query, undefined);
});
