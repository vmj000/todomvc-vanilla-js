import test from 'node:test';
import assert from 'node:assert/strict';
import { createStorage, STORAGE_INVALID, STORAGE_KEY, STORAGE_UNAVAILABLE } from '../js/storage.js';

const todos = [
  { id: 'a', title: 'Read', location: '', category: 'work', completed: false },
  { id: 'b', title: '<img src=x onerror=alert(1)>', location: '<svg onload=alert(1)>', category: 'health', completed: true },
];
function memoryStorage(raw) {
  const data = new Map([['unrelated', 'keep me']]);
  if (raw !== undefined) data.set(STORAGE_KEY, raw);
  return { data, getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
}

test('missing storage starts with an empty list', () => {
  assert.deepEqual(createStorage(() => memoryStorage()).load(), { todos: [], error: '' });
});

test('versioned persistence round-trips IDs, order, completion, and literal titles', () => {
  const memory = memoryStorage();
  const storage = createStorage(() => memory);
  assert.equal(storage.save(todos), '');
  assert.deepEqual(JSON.parse(memory.data.get(STORAGE_KEY)), { version: 1, todos });
  assert.deepEqual(storage.load(), { todos, error: '' });
  assert.equal(memory.data.get('unrelated'), 'keep me');
  assert.equal(memory.data.size, 2);
});

test('loading normalizes title whitespace and drops unrelated item properties', () => {
  const raw = JSON.stringify({ version: 1, todos: [{ ...todos[0], title: '  Read  ', location: ' \t', extra: 'ignored' }] });
  assert.deepEqual(createStorage(() => memoryStorage(raw)).load().todos, [todos[0]]);
});

for (const [name, raw] of [
  ['broken JSON', '{'],
  ['null payload', 'null'],
  ['unsupported version', JSON.stringify({ version: 2, todos })],
  ['missing version', JSON.stringify({ todos })],
  ['non-array items', JSON.stringify({ version: 1, todos: {} })],
  ['duplicate IDs', JSON.stringify({ version: 1, todos: [todos[0], todos[0]] })],
  ['blank ID', JSON.stringify({ version: 1, todos: [{ ...todos[0], id: ' ' }] })],
  ['numeric ID', JSON.stringify({ version: 1, todos: [{ ...todos[0], id: 1 }] })],
  ['blank title', JSON.stringify({ version: 1, todos: [{ ...todos[0], title: '  ' }] })],
  ['non-string title', JSON.stringify({ version: 1, todos: [{ ...todos[0], title: {} }] })],
  ['non-boolean completion', JSON.stringify({ version: 1, todos: [{ ...todos[0], completed: 'false' }] })],
  ['null item', JSON.stringify({ version: 1, todos: [null] })],
  ['null location', JSON.stringify({ version: 1, todos: [{ ...todos[0], location: null }] })],
  ['numeric location', JSON.stringify({ version: 1, todos: [{ ...todos[0], location: 42 }] })],
  ['object location', JSON.stringify({ version: 1, todos: [{ ...todos[0], location: {} }] })],
  ['array location', JSON.stringify({ version: 1, todos: [{ ...todos[0], location: [] }] })],
  ['boolean location', JSON.stringify({ version: 1, todos: [{ ...todos[0], location: false }] })],
  ...[null, '', 'other', 'Work', ' work ', 42, {}, [], false, '<svg onload=alert(1)>'].map(category =>
    [`category ${JSON.stringify(category)}`, JSON.stringify({ version: 1, todos: [{ ...todos[0], category }] })]),
]) {
  test(`invalid storage recovers without overwriting the original: ${name}`, () => {
    const memory = memoryStorage(raw);
    assert.deepEqual(createStorage(() => memory).load(), { todos: [], error: STORAGE_INVALID });
    assert.equal(memory.data.get(STORAGE_KEY), raw);
    assert.equal(memory.data.get('unrelated'), 'keep me');
  });
}

test('a throwing localStorage getter is contained during reads and writes', () => {
  const storage = createStorage(() => { throw new Error('SecurityError'); });
  assert.deepEqual(storage.load(), { todos: [], error: STORAGE_UNAVAILABLE });
  assert.equal(storage.save(todos), STORAGE_UNAVAILABLE);
});

test('read failures and quota-exceeded writes are contained', () => {
  const storage = createStorage(() => ({
    getItem() { throw new Error('Blocked'); },
    setItem() { throw new Error('QuotaExceededError'); },
  }));
  assert.equal(storage.load().error, STORAGE_UNAVAILABLE);
  assert.equal(storage.save(todos), STORAGE_UNAVAILABLE);
});

test('legacy version1 records load with blank locations without rewriting or losing data', () => {
  const legacy = [
    { id: 'first', title: 'Read', completed: true },
    { id: 'second', title: '<script>literal</script>', completed: false },
  ];
  const raw = JSON.stringify({ version: 1, todos: legacy });
  const memory = memoryStorage(raw);
  const storage = createStorage(() => memory);
  const loaded = storage.load();
  assert.deepEqual(loaded, { todos: legacy.map(todo => ({ ...todo, location: '', category: 'work' })), error: '' });
  assert.equal(memory.data.get(STORAGE_KEY), raw);
  assert.equal(memory.data.get('unrelated'), 'keep me');
  assert.equal(storage.save(loaded.todos), '');
  assert.deepEqual(storage.load(), loaded);
});

test('mixed legacy and located records preserve locations, order, IDs, and completion', () => {
  const mixed = [{ id: 'legacy', title: 'Old todo', completed: true }, { id: 'new', title: 'New todo', location: ' Office ', completed: false }];
  const storage = createStorage(() => memoryStorage(JSON.stringify({ version: 1, todos: mixed })));
  assert.deepEqual(storage.load(), { todos: [
    { id: 'legacy', title: 'Old todo', location: '', category: 'work', completed: true },
    { id: 'new', title: 'New todo', location: 'Office', category: 'work', completed: false },
  ], error: '' });
});

test('saving legacy records writes explicit blank locations under the same key and version', () => {
  const memory = memoryStorage();
  const storage = createStorage(() => memory);
  storage.save([{ id: 'legacy', title: 'Old todo', completed: false }]);
  assert.deepEqual(JSON.parse(memory.data.get(STORAGE_KEY)), { version: 1, todos: [{ id: 'legacy', title: 'Old todo', location: '', category: 'work', completed: false }] });
});

test('mixed legacy and categorized records default only missing category without rewriting on load', () => {
  const mixed = [
    { id: 'legacy', title: ' Old ', location: ' Office ', completed: true },
    ...['work', 'health', 'home'].map(category => ({ id: category, title: category, location: 'Place', category, completed: false })),
  ];
  const raw = JSON.stringify({ version: 1, todos: mixed });
  const memory = memoryStorage(raw);
  const storage = createStorage(() => memory);
  const loaded = storage.load();
  assert.deepEqual(loaded.todos[0], { id: 'legacy', title: 'Old', location: 'Office', category: 'work', completed: true });
  assert.deepEqual(loaded.todos.slice(1), mixed.slice(1));
  assert.equal(memory.data.get(STORAGE_KEY), raw);
  assert.equal(storage.save(loaded.todos), '');
  assert.deepEqual(storage.load(), loaded);
});

test('saving invalid categories fails safely without replacing existing data', () => {
  const original = JSON.stringify({ version: 1, todos });
  const memory = memoryStorage(original);
  const storage = createStorage(() => memory);
  for (const category of [null, '', 'other', 'Work', ' work ', 42, {}, [], false, '<img src=x>']) {
    assert.equal(storage.save([{ ...todos[0], category }]), STORAGE_INVALID);
    assert.equal(memory.data.get(STORAGE_KEY), original);
  }
});
