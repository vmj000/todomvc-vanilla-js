export const FILTERS = ['all', 'active', 'completed'];
export const CATEGORIES = Object.freeze(['work', 'health', 'home']);
export const DEFAULT_CATEGORY = 'work';

export function filterFromHash(hash) {
  return ({ '#/active': 'active', '#/completed': 'completed' })[hash] ?? 'all';
}

export function visibleTodos(todos, filter) {
  if (filter === 'active') return todos.filter(todo => !todo.completed);
  if (filter === 'completed') return todos.filter(todo => todo.completed);
  return todos;
}

export function remainingCount(todos) {
  return todos.filter(todo => !todo.completed).length;
}

export function updateTodos(todos, action) {
  switch (action.type) {
    case 'add': {
      const title = action.title.trim();
      const category = action.category === undefined ? DEFAULT_CATEGORY : action.category;
      if (!title || !CATEGORIES.includes(category) || todos.some(todo => todo.id === action.id)) return todos;
      return [...todos, { id: action.id, title, location: (action.location ?? '').trim(), category, completed: false }];
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
      if (action.category !== undefined && !CATEGORIES.includes(action.category)) return todos;
      const title = action.title.trim();
      if (!title) return updateTodos(todos, { type: 'delete', id: action.id });
      const location = action.location === undefined ? undefined : action.location.trim();
      return todos.some(todo => todo.id === action.id
        && (todo.title !== title || (location !== undefined && (todo.location ?? '') !== location)
          || (action.category !== undefined && (todo.category ?? DEFAULT_CATEGORY) !== action.category)))
        ? todos.map(todo => todo.id === action.id ? {
          ...todo, title, ...(location === undefined ? {} : { location }),
          ...(action.category === undefined ? {} : { category: action.category }),
        } : todo)
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
