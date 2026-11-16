/**
 * Versioned local storage with validation and recoverable failures.
 * @module storage
 */

/**
 * Browser storage key for version 1 payloads.
 * @type {string}
 */
export const STORAGE_KEY = 'vanilla-todomvc:v1';
/**
 * Warning used when browser storage access or saving fails.
 * @type {string}
 */
export const STORAGE_UNAVAILABLE = 'Your browser could not save your todos. You can keep working, but changes may not survive a reload.';
/**
 * Warning used when a stored payload is malformed or unsupported.
 * @type {string}
 */
export const STORAGE_INVALID = 'Saved todos could not be loaded. Starting with an empty list.';

/**
 * @typedef {Object} LoadResult
 * @property {Array<module:model~Todo>} todos Validated todos, or an empty list on failure.
 * @property {string} error Empty on success, otherwise a user-facing warning.
 */

/**
 * @typedef {Object} TodoStorage
 * @property {function(): module:storage~LoadResult} load Validate the whole payload, trim text, and default missing locations without writing storage.
 * @property {function(Array<module:model~Todo>): string} save Write a version 1 payload; return an empty string or a warning, never throw for storage failures.
 */

function validTodos(todos) {
  if (!Array.isArray(todos)) return false;
  const ids = new Set();
  return todos.every(todo => {
    if (!todo || typeof todo.id !== 'string' || !todo.id.trim() || ids.has(todo.id)
      || typeof todo.title !== 'string' || !todo.title.trim()
      || (todo.location !== undefined && typeof todo.location !== 'string')
      || typeof todo.completed !== 'boolean') return false;
    ids.add(todo.id);
    return true;
  });
}

/**
 * Create a storage adapter. Access is deferred until load/save so a browser
 * that blocks even reading localStorage produces a warning instead of crashing.
 * Invalid versions, duplicate IDs, blank IDs/titles, and incorrect field types
 * reject the entire saved list. Save expects valid model todos.
 * @param {function(): Storage} [getStorage] Browser localStorage accessor, or a compatible test double.
 * @returns {module:storage~TodoStorage} Load/save adapter using STORAGE_KEY.
 */
export function createStorage(getStorage = () => window.localStorage) {
  return {
    load() {
      let raw;
      try {
        raw = getStorage().getItem(STORAGE_KEY);
      } catch {
        return { todos: [], error: STORAGE_UNAVAILABLE };
      }
      if (raw === null) return { todos: [], error: '' };
      try {
        const data = JSON.parse(raw);
        if (data?.version !== 1 || !validTodos(data.todos)) throw new Error('Invalid saved todos');
        return {
          todos: data.todos.map(({ id, title, location = '', completed }) => ({ id, title: title.trim(), location: location.trim(), completed })),
          error: '',
        };
      } catch {
        return { todos: [], error: STORAGE_INVALID };
      }
    },
    save(todos) {
      try {
        const normalized = todos.map(({ id, title, location = '', completed }) => ({ id, title, location, completed }));
        getStorage().setItem(STORAGE_KEY, JSON.stringify({ version: 1, todos: normalized }));
        return '';
      } catch {
        return STORAGE_UNAVAILABLE;
      }
    },
  };
}
