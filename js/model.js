/**
 * Pure todo transitions and selectors, with no DOM or storage access.
 * @module model
 */

/**
 * @typedef {Object} Todo
 * @property {string} id Unique, stable identifier.
 * @property {string} title Task text, trimmed on addition and editing.
 * @property {string} [location] Optional free-text location; new todos use an empty string when omitted.
 * @property {boolean} completed Whether the task is complete.
 */

/** @typedef {('all'|'active'|'completed')} Filter */

/**
 * @typedef {Object} Action
 * @property {('add'|'toggle'|'toggle-all'|'edit'|'delete'|'clear-completed')} type Operation to apply.
 * @property {string} [id] Required for add, toggle, edit, and delete.
 * @property {string} [title] Required for add and edit. A blank edit deletes the todo.
 * @property {string} [location] For add/edit. Omit on edit to preserve the location; blank clears it.
 */

/**
 * Supported filter names.
 * @type {Array<module:model~Filter>}
 */
export const FILTERS = ['all', 'active', 'completed'];

/**
 * Map hash routes to filters, defaulting to all for empty or unknown hashes.
 * @param {string} hash Browser location hash.
 * @returns {module:model~Filter} Selected filter.
 */
export function filterFromHash(hash) {
  return ({ '#/active': 'active', '#/completed': 'completed' })[hash] ?? 'all';
}

/**
 * Select matching todos in their original order.
 * @param {Array<module:model~Todo>} todos Full collection; never mutated.
 * @param {module:model~Filter} filter Unknown filters also return all todos.
 * @returns {Array<module:model~Todo>} Matching items; all returns the original array.
 */
export function visibleTodos(todos, filter) {
  if (filter === 'active') return todos.filter(todo => !todo.completed);
  if (filter === 'completed') return todos.filter(todo => todo.completed);
  return todos;
}

/**
 * Count incomplete tasks independently of the current filter.
 * @param {Array<module:model~Todo>} todos Full collection.
 * @returns {number} Incomplete task count.
 */
export function remainingCount(todos) {
  return todos.filter(todo => !todo.completed).length;
}

/**
 * Apply an immutable transition to the full collection, including hidden todos.
 * Text inputs are trimmed. Blank additions, duplicate IDs, missing targets,
 * unchanged edits, and unknown actions are no-ops. Toggle-all completes a mixed
 * collection and reactivates a fully completed one.
 * @param {Array<module:model~Todo>} todos Current collection; never mutated.
 * @param {module:model~Action} action Operation and its required fields.
 * @returns {Array<module:model~Todo>} Next collection, or the original array for a no-op.
 * @example
 * const todos = updateTodos([], { type: 'add', id: '1', title: 'Read', location: 'Home' });
 * const done = updateTodos(todos, { type: 'toggle', id: '1' });
 */
export function updateTodos(todos, action) {
  switch (action.type) {
    case 'add': {
      const title = action.title.trim();
      if (!title || todos.some(todo => todo.id === action.id)) return todos;
      return [...todos, { id: action.id, title, location: (action.location ?? '').trim(), completed: false }];
    }
    case 'toggle':
      return todos.some(todo => todo.id === action.id)
        ? todos.map(todo => todo.id === action.id ? { ...todo, completed: !todo.completed } : todo)
        : todos;
    case 'toggle-all': {
      if (!todos.length) return todos;
      const completed = todos.some(todo => !todo.completed);
      return todos.map(todo => todo.completed === completed ? todo : { ...todo, completed });
    }
    case 'edit': {
      const title = action.title.trim();
      if (!title) return updateTodos(todos, { type: 'delete', id: action.id });
      const location = action.location === undefined ? undefined : action.location.trim();
      return todos.some(todo => todo.id === action.id
        && (todo.title !== title || (location !== undefined && (todo.location ?? '') !== location)))
        ? todos.map(todo => todo.id === action.id ? { ...todo, title, ...(location === undefined ? {} : { location }) } : todo)
        : todos;
    }
    case 'delete':
      return todos.some(todo => todo.id === action.id) ? todos.filter(todo => todo.id !== action.id) : todos;
    case 'clear-completed':
      return todos.some(todo => todo.completed) ? todos.filter(todo => !todo.completed) : todos;
    default:
      return todos;
  }
}
