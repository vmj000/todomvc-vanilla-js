import { FILTERS, updateTodos } from './model.js';

export function createController({
  initialTodos = [], initialError = '', filter = 'all',
  save = () => '', render = () => {}, createId = () => crypto.randomUUID(),
} = {}) {
  let todos = initialTodos;
  let editing = null;
  let storageError = initialError;
  let currentFilter = FILTERS.includes(filter) ? filter : 'all';
  const snapshot = () => ({ todos, editing, filter: currentFilter, storageError });
  const emit = () => render(snapshot());

  function mutate(action) {
    const next = updateTodos(todos, action);
    if (next !== todos) {
      todos = next;
      storageError = save(todos);
    }
  }

  const controller = {
    snapshot,
    render: emit,
    add(title) {
      if (!title.trim()) return false;
      mutate({ type: 'add', id: createId(), title });
      emit();
      return true;
    },
    dispatch(action) {
      mutate(action);
      if (editing && !todos.some(todo => todo.id === editing.id)) editing = null;
      emit();
    },
    setFilter(filter) {
      if (editing) controller.finishEdit(editing.id);
      currentFilter = FILTERS.includes(filter) ? filter : 'all';
      emit();
    },
    startEdit(id) {
      if (editing?.id === id) return;
      if (editing) controller.finishEdit(editing.id);
      const todo = todos.find(todo => todo.id === id);
      if (!todo) return;
      editing = { id, draft: todo.title };
      emit();
    },
    setDraft(id, draft) {
      if (editing?.id === id) editing = { id, draft };
    },
    finishEdit(id, cancel = false) {
      if (editing?.id !== id) return;
      const { draft } = editing;
      editing = null;
      if (!cancel) mutate({ type: 'edit', id, title: draft });
      emit();
    },
  };
  return controller;
}
