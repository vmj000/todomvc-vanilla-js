import { FILTERS, updateTodos } from './model.js';

export function createController({
  initialTodos = [], initialError = '', filter = 'all',
  save = () => '', render = () => {}, createId = () => crypto.randomUUID(),
} = {}) {
  let todos = initialTodos;
  let editing = null;
  let storageError = initialError;
  let currentFilter = FILTERS.includes(filter) ? filter : 'all';
  let query = '';
  const snapshot = () => ({ todos, editing, filter: currentFilter, query, storageError });
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
    add(title, location = '') {
      if (!title.trim()) return false;
      mutate({ type: 'add', id: createId(), title, location });
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
    setQuery(value) {
      if (editing) controller.finishEdit(editing.id);
      query = value;
      emit();
    },
    startEdit(id) {
      if (editing?.id === id) return;
      if (editing) controller.finishEdit(editing.id);
      const todo = todos.find(todo => todo.id === id);
      if (!todo) return;
      editing = { id, draft: todo.title, locationDraft: todo.location ?? '' };
      emit();
    },
    setDraft(id, draft) {
      if (editing?.id === id) editing = { ...editing, draft };
    },
    setLocationDraft(id, locationDraft) {
      if (editing?.id === id) editing = { ...editing, locationDraft };
    },
    finishEditOnFocusOut(id, sourceAction, staysInRow) {
      if (staysInRow || !['editor', 'save', 'cancel'].includes(sourceAction)) return;
      controller.finishEdit(id);
    },
    finishEdit(id, cancel = false) {
      if (editing?.id !== id) return;
      const { draft, locationDraft } = editing;
      editing = null;
      if (!cancel) mutate({ type: 'edit', id, title: draft, location: locationDraft });
      emit();
    },
  };
  return controller;
}
