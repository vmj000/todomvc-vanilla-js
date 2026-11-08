export const STORAGE_KEY = 'vanilla-todomvc:v1';
export const STORAGE_UNAVAILABLE = 'Your browser could not save your todos. You can keep working, but changes may not survive a reload.';
export const STORAGE_INVALID = 'Saved todos could not be loaded. Starting with an empty list.';

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
