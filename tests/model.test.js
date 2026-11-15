import test from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES, DEFAULT_CATEGORY, filterFromHash, remainingCount, updateTodos, visibleTodos } from '../js/model.js';

const fixture = () => [
  { id: 'a', title: 'Read', location: '', completed: false },
  { id: 'b', title: 'Walk', location: '', completed: true },
  { id: 'c', title: 'Write', location: '', completed: false },
];

test('adding trims titles, appends active items, and leaves the input array untouched', () => {
  const todos = fixture();
  const result = updateTodos(todos, { type: 'add', id: 'd', title: '  Make tea \n' });
  assert.deepEqual(result.at(-1), { id: 'd', title: 'Make tea', location: '', category: 'work', completed: false });
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
  assert.deepEqual(result[1], { id: 'b', title: 'Long walk', location: '', completed: true });
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

test('adding trims optional locations without requiring one', () => {
  const located = updateTodos([], { type: 'add', id: 'a', title: 'Buy milk', location: '  Corner shop \n' });
  assert.equal(located[0].location, 'Corner shop');
  assert.equal(updateTodos([], { type: 'add', id: 'b', title: 'Read', location: ' \t' })[0].location, '');
});

test('editing location alone preserves title, completion, identity, and order', () => {
  const todos = fixture();
  const result = updateTodos(todos, { type: 'edit', id: 'b', title: 'Walk', location: ' Park ' });
  assert.deepEqual(result[1], { id: 'b', title: 'Walk', location: 'Park', completed: true });
  assert.equal(todos[1].location, '');
  assert.equal(result[0], todos[0]);
  assert.equal(updateTodos(result, { type: 'edit', id: 'b', title: ' Walk ', location: ' Park ' }), result);
});

test('title-only edits preserve locations while an explicit blank clears only location', () => {
  const todos = [{ id: 'a', title: 'Read', location: 'Library', completed: false }];
  const renamed = updateTodos(todos, { type: 'edit', id: 'a', title: 'Read more' });
  assert.equal(renamed[0].location, 'Library');
  const cleared = updateTodos(renamed, { type: 'edit', id: 'a', title: 'Read more', location: '  ' });
  assert.equal(cleared.length, 1);
  assert.equal(cleared[0].location, '');
  assert.deepEqual(updateTodos(cleared, { type: 'edit', id: 'a', title: '', location: 'Library' }), []);
});

test('completion, filtering, deletion, and bulk operations never discard surviving locations', () => {
  const todos = fixture().map((todo, index) => ({ ...todo, location: ['Home', 'Park', 'Office'][index] }));
  const toggled = updateTodos(todos, { type: 'toggle-all' });
  assert.deepEqual(toggled.map(todo => todo.location), ['Home', 'Park', 'Office']);
  assert.deepEqual(visibleTodos(updateTodos(toggled, { type: 'toggle', id: 'b' }), 'active').map(todo => todo.location), ['Park']);
  assert.deepEqual(updateTodos(todos, { type: 'clear-completed' }).map(todo => todo.location), ['Home', 'Office']);
});

test('HTML-like location strings remain literal data', () => {
  const location = '<img src=x onerror=alert(1)>';
  const todos = updateTodos([], { type: 'add', id: 'a', title: 'Read', location });
  assert.equal(todos[0].location, location);
  assert.equal(updateTodos(todos, { type: 'edit', id: 'a', title: 'Read', location: '<script>x</script>' })[0].location, '<script>x</script>');
});

test('categories are exactly work, health, home and legacy add callers default to work', () => {
  assert.deepEqual(CATEGORIES, ['work', 'health', 'home']);
  assert.equal(DEFAULT_CATEGORY, 'work');
  assert.equal(updateTodos([], { type: 'add', id: 'old-caller', title: 'Read' })[0].category, 'work');
  for (const category of CATEGORIES) {
    assert.equal(updateTodos([], { type: 'add', id: category, title: 'Task', category })[0].category, category);
  }
});

test('category-only edits preserve title, location, ID, completion, order and original data', () => {
  const todos = fixture().map(todo => ({ ...todo, category: 'work' }));
  const result = updateTodos(todos, { type: 'edit', id: 'b', title: 'Walk', category: 'health' });
  assert.deepEqual(result[1], { ...todos[1], category: 'health' });
  assert.equal(todos[1].category, 'work');
  assert.equal(result[0], todos[0]);
  assert.deepEqual(result.map(todo => todo.id), ['a', 'b', 'c']);
  assert.equal(updateTodos(result, { type: 'edit', id: 'b', title: 'Walk', category: 'health' }), result);
});

test('old title/location edit callers preserve category and legacy work edits are no-ops', () => {
  const todos = [{ id: 'a', title: 'Read', location: 'Library', category: 'home', completed: true }];
  const result = updateTodos(todos, { type: 'edit', id: 'a', title: 'Read more', location: 'Park' });
  assert.equal(result[0].category, 'home');
  const legacy = fixture();
  assert.equal(updateTodos(legacy, { type: 'edit', id: 'a', title: 'Read', category: 'work' }), legacy);
});

test('invalid supplied categories cannot add, partly edit, or delete existing todos', () => {
  const todos = fixture();
  for (const category of [null, '', 'other', 'Work', ' work ', 42, {}, [], false, '<svg onload=alert(1)>']) {
    assert.equal(updateTodos(todos, { type: 'add', id: 'new', title: 'Task', category }), todos);
    assert.equal(updateTodos(todos, { type: 'edit', id: 'a', title: 'Changed', location: 'Changed', category }), todos);
    assert.equal(updateTodos(todos, { type: 'edit', id: 'a', title: '', category }), todos);
  }
});

test('completion, filtering, bulk actions and deletion retain surviving categories', () => {
  const todos = fixture().map((todo, index) => ({ ...todo, category: CATEGORIES[index] }));
  const toggled = updateTodos(todos, { type: 'toggle-all' });
  assert.deepEqual(toggled.map(todo => todo.category), CATEGORIES);
  assert.deepEqual(visibleTodos(updateTodos(toggled, { type: 'toggle', id: 'b' }), 'active').map(todo => todo.category), ['health']);
  assert.deepEqual(updateTodos(todos, { type: 'clear-completed' }).map(todo => todo.category), ['work', 'home']);
  assert.deepEqual(updateTodos(todos, { type: 'delete', id: 'a' }).map(todo => todo.category), ['health', 'home']);
});
