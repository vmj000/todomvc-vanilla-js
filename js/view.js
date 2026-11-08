import { remainingCount, visibleTodos } from './model.js';

export function createView(document) {
  const list = document.querySelector('#todo-list');
  const template = document.querySelector('#todo-template');
  const newTodo = document.querySelector('#new-todo');
  const search = document.querySelector('#todo-search');
  const rows = new Map();
  let previousEditingId = null;
  const findRow = id => rows.get(id);

  function render({ todos, filter, query, editing, storageError }) {
    const focused = document.activeElement;
    const focusedRow = focused?.closest('.todo');
    const focusedId = focusedRow?.dataset.id;
    const focusedAction = focused?.dataset.action;
    const focusedIndex = focusedRow ? [...list.children].indexOf(focusedRow) : -1;
    const visible = visibleTodos(todos, filter, query);
    const visibleIds = new Set(visible.map(todo => todo.id));
    const active = remainingCount(todos);
    const completed = todos.length - active;
    const hasTodos = todos.length > 0;

    document.querySelector('#main').hidden = !hasTodos;
    document.querySelector('#footer').hidden = !hasTodos;
    document.querySelector('#toggle-all-wrap').hidden = !hasTodos;
    const toggleAll = document.querySelector('#toggle-all');
    toggleAll.checked = hasTodos && active === 0;
    toggleAll.indeterminate = active > 0 && completed > 0;
    toggleAll.setAttribute('aria-label', active ? 'Mark all todos as complete' : 'Mark all todos as active');
    document.querySelector('#todo-count').textContent = `${active} ${active === 1 ? 'item' : 'items'} left`;
    document.querySelector('#clear-completed').hidden = completed === 0;
    if (search.value !== query) search.value = query;
    const empty = document.querySelector('#filter-empty');
    empty.textContent = query.trim() ? 'No todos match your search.' : 'No todos here. A little breathing room.';
    empty.hidden = visible.length > 0 || (!hasTodos && !query.trim());
    for (const link of document.querySelectorAll('[data-filter]')) {
      if (link.dataset.filter === filter) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
    const notice = document.querySelector('#storage-notice');
    notice.textContent = storageError;
    notice.hidden = !storageError;

    for (const [id, row] of rows) {
      if (!visibleIds.has(id)) {
        rows.delete(id);
        row.remove();
      }
    }
    let cursor = list.firstElementChild;
    for (const todo of visible) {
      let row = rows.get(todo.id);
      if (!row) {
        row = template.content.firstElementChild.cloneNode(true);
        row.dataset.id = todo.id;
        rows.set(todo.id, row);
      }
      const isEditing = editing?.id === todo.id;
      row.classList.toggle('completed', todo.completed);
      row.classList.toggle('editing', isEditing);
      const title = row.querySelector('.todo-title');
      title.textContent = todo.title;
      title.hidden = isEditing;
      const location = row.querySelector('.todo-location');
      location.textContent = todo.location || '—';
      location.hidden = isEditing;
      location.classList.toggle('empty-location', !todo.location);
      if (todo.location) location.removeAttribute('aria-label');
      else location.setAttribute('aria-label', 'No location');
      const toggle = row.querySelector('.toggle');
      toggle.checked = todo.completed;
      toggle.disabled = isEditing;
      toggle.setAttribute('aria-label', `Mark “${todo.title}” as ${todo.completed ? 'active' : 'complete'}`);
      row.querySelector('.edit-button').setAttribute('aria-label', `Edit “${todo.title}”`);
      row.querySelector('.destroy').setAttribute('aria-label', `Delete “${todo.title}”`);
      row.querySelector('.save-edit').setAttribute('aria-label', `Save “${todo.title}”`);
      row.querySelector('.cancel-edit').setAttribute('aria-label', `Cancel editing “${todo.title}”`);
      for (const button of row.querySelectorAll('[data-action="edit"], [data-action="delete"]')) button.hidden = isEditing;
      for (const button of row.querySelectorAll('[data-action="save"], [data-action="cancel"]')) button.hidden = !isEditing;
      const editor = row.querySelector('.edit-input');
      editor.hidden = !isEditing;
      editor.setAttribute('aria-label', `Edit todo: ${todo.title}`);
      if (isEditing && editor.value !== editing.draft) editor.value = editing.draft;
      const locationEditor = row.querySelector('.edit-location');
      locationEditor.hidden = !isEditing;
      locationEditor.setAttribute('aria-label', `Edit location: ${todo.title}`);
      if (isEditing && locationEditor.value !== editing.locationDraft) locationEditor.value = editing.locationDraft;
      if (row !== cursor) list.insertBefore(row, cursor);
      cursor = row.nextElementSibling;
    }

    if (editing && previousEditingId !== editing.id) {
      const editor = findRow(editing.id)?.querySelector('.edit-input');
      editor?.focus();
      editor?.select();
    } else if (focusedId && (!visibleIds.has(focusedId) || (['editor', 'save', 'cancel'].includes(focusedAction) && !editing))) {
      const row = findRow(focusedId) ?? list.children[Math.min(focusedIndex, list.children.length - 1)];
      const action = ['editor', 'save', 'cancel'].includes(focusedAction) ? 'edit' : focusedAction;
      (row?.querySelector(`[data-action="${action}"]`) ?? newTodo).focus();
    } else if (focused?.id === 'clear-completed' && completed === 0) {
      (hasTodos ? document.querySelector('[aria-current="page"]') : search).focus();
    } else if (focused?.id === 'toggle-all' && !hasTodos) {
      newTodo.focus();
    }
    previousEditingId = editing?.id ?? null;
  }

  return { render };
}
