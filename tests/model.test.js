import test from 'node:test';
import assert from 'node:assert/strict';
import { filterFromHash, remainingCount, updateTodos, visibleTodos } from '../js/model.js';

const fixture = () => [
  { id: 'a', title: 'Read', completed: false },
  { id: 'b', title: 'Walk', completed: true },
  { id: 'c', title: 'Write', completed: false },
];

test('adding trims titles, appends active items, and leaves the input array untouched', () => {
  const todos = fixture();
  const result = updateTodos(todos, { type: 'add', id: 'd', title: '  Make tea \n' });
  assert.deepEqual(result.at(-1), { id: 'd', title: 'Make tea', completed: false });
  assert.deepEqual(result.slice(0, 3), todos);
  assert.equal(todos.length, 3);
});

test('blank additions and duplicate IDs are no-ops', () => {
  const todos = fixture();
  assert.equal(updateTodos(todos, { type: 'add', id: 'd', title: ' \n\t' }), todos);
  assert.equal(updateTodos(todos, { type: 'add', id: 'a', title: 'Duplicate' }), todos);
});

test('individual completion affects only the target without mutating it', () => {
  const todos = fixture();
  const result = updateTodos(todos, { type: 'toggle', id: 'a' });
  assert.equal(result[0].completed, true);
  assert.equal(todos[0].completed, false);
  assert.equal(result[1], todos[1]);
  assert.equal(updateTodos(todos, { type: 'toggle', id: 'missing' }), todos);
});

test('toggle-all completes a mixed collection, then activates the whole collection', () => {
  const complete = updateTodos(fixture(), { type: 'toggle-all' });
  assert.ok(complete.every(todo => todo.completed));
  assert.ok(updateTodos(complete, { type: 'toggle-all' }).every(todo => !todo.completed));
  const empty = [];
  assert.equal(updateTodos(empty, { type: 'toggle-all' }), empty);
});

test('editing trims, preserves ID/completion/order, and skips unchanged or missing titles', () => {
  const todos = fixture();
  const result = updateTodos(todos, { type: 'edit', id: 'b', title: '  Long walk  ' });
  assert.deepEqual(result[1], { id: 'b', title: 'Long walk', completed: true });
  assert.equal(todos[1].title, 'Walk');
  assert.equal(updateTodos(todos, { type: 'edit', id: 'b', title: ' Walk ' }), todos);
  assert.equal(updateTodos(todos, { type: 'edit', id: 'missing', title: 'New' }), todos);
});

test('blank committed edits delete only that item', () => {
  assert.deepEqual(updateTodos(fixture(), { type: 'edit', id: 'b', title: '\t ' }).map(todo => todo.id), ['a', 'c']);
});

test('deleting and clearing completed preserve the order of surviving items', () => {
  const todos = fixture();
  assert.deepEqual(updateTodos(todos, { type: 'delete', id: 'a' }).map(todo => todo.id), ['b', 'c']);
  assert.deepEqual(updateTodos(todos, { type: 'clear-completed' }).map(todo => todo.id), ['a', 'c']);
  assert.equal(updateTodos(todos, { type: 'delete', id: 'missing' }), todos);
  const active = visibleTodos(todos, 'active');
  assert.equal(updateTodos(active, { type: 'clear-completed' }), active);
});

test('filters preserve order and counts always describe the whole collection', () => {
  const todos = fixture();
  assert.equal(visibleTodos(todos, 'all'), todos);
  assert.deepEqual(visibleTodos(todos, 'active').map(todo => todo.id), ['a', 'c']);
  assert.deepEqual(visibleTodos(todos, 'completed').map(todo => todo.id), ['b']);
  assert.equal(remainingCount(todos), 2);
  assert.equal(remainingCount([]), 0);
  assert.equal(updateTodos(todos, { type: 'unknown' }), todos);
});

test('hash routing recognizes the supported filters and safely defaults to All', () => {
  assert.equal(filterFromHash('#/active'), 'active');
  assert.equal(filterFromHash('#/completed'), 'completed');
  for (const hash of ['', '#/', '#/unknown', '#/Active', '#/<script>']) {
    assert.equal(filterFromHash(hash), 'all');
  }
});

test('HTML-like todo titles stay literal data during additions and edits', () => {
  const title = '<img src=x onerror=alert(1)>';
  const todos = updateTodos([], { type: 'add', id: 'a', title });
  assert.equal(todos[0].title, title);
  assert.equal(updateTodos(todos, { type: 'edit', id: 'a', title: '<script>x</script>' })[0].title, '<script>x</script>');
});
