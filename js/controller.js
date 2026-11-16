/**
 * State ownership, edit lifecycle, and save/render coordination.
 * @module controller
 */
import { FILTERS, updateTodos } from './model.js';

/**
 * @typedef {Object} State
 * @property {Array<module:model~Todo>} todos Full collection, including filtered-out items.
 * @property {module:model~Filter} filter Current normalized filter.
 * @property {?{id: string, draft: string, locationDraft: string}} editing Current drafts, or null.
 * @property {string} storageError Warning from load/save, or an empty string.
 */

/**
 * @typedef {Object} Controller
 * @property {function(): module:controller~State} snapshot Read current state; returned references must not be mutated.
 * @property {function(): void} render Send the current state to the render callback.
 * @property {function(string, string=): boolean} add Add a trimmed task and optional location. Returns false for blank titles without saving/rendering.
 * @property {function(module:model~Action): void} dispatch Apply an action to all todos, close a deleted editor, and render.
 * @property {function(string): void} setFilter Commit any edit, normalize the filter, and render.
 * @property {function(string): void} startEdit Open the given todo's drafts, committing any different current edit first.
 * @property {function(string, string): void} setDraft Update the matching editor's task draft without saving or rendering.
 * @property {function(string, string): void} setLocationDraft Update the matching location draft without saving or rendering.
 * @property {function(string, string, boolean): void} finishEditOnFocusOut Commit only when an editor/save/cancel control loses focus outside its row.
 * @property {function(string, boolean=): void} finishEdit Commit both drafts atomically, or cancel when the second argument is true. Stale/repeated calls are ignored.
 */

/**
 * Create a controller without rendering or saving. Mutations save only when the
 * model returns a changed collection. Save warnings do not roll back memory.
 * @param {Object} [options={}] Injected state and side effects.
 * @param {Array<module:model~Todo>} [options.initialTodos=[]] Initial collection.
 * @param {string} [options.initialError=''] Warning from storage load.
 * @param {string} [options.filter='all'] Unknown filters normalize to all.
 * @param {function(Array<module:model~Todo>): string} [options.save] Return an empty string on success or a warning on failure.
 * @param {function(module:controller~State): void} [options.render] Consume snapshots as read-only state.
 * @param {function(): string} [options.createId] ID generator; defaults to crypto.randomUUID.
 * @returns {module:controller~Controller} State and editing operations.
 */
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
