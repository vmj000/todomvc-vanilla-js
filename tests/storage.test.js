import test from 'node:test';
import assert from 'node:assert/strict';
import { createStorage, STORAGE_INVALID, STORAGE_KEY, STORAGE_UNAVAILABLE } from '../js/storage.js';

const todos = [
  { id: 'a', title: 'Read', completed: false },
  { id: 'b', title: '<img src=x onerror=alert(1)>', completed: true },
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
  const raw = JSON.stringify({ version: 1, todos: [{ ...todos[0], title: '  Read  ', extra: 'ignored' }] });
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
