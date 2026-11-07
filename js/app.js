import { createController } from './controller.js';
import { filterFromHash } from './model.js';
import { createStorage } from './storage.js';
import { createView } from './view.js';

const storage = createStorage();
const initial = storage.load();
const view = createView(document);
const controller = createController({
  initialTodos: initial.todos,
  initialError: initial.error,
  filter: filterFromHash(location.hash),
  save: storage.save,
  render: view.render,
});
const newTodo = document.querySelector('#new-todo');
const list = document.querySelector('#todo-list');

document.querySelector('#new-todo-form').addEventListener('submit', event => {
  event.preventDefault();
  if (controller.add(newTodo.value)) newTodo.value = '';
  newTodo.focus();
});

document.querySelector('#toggle-all').addEventListener('change', () => {
  controller.dispatch({ type: 'toggle-all' });
});
document.querySelector('#clear-completed').addEventListener('click', () => {
  controller.dispatch({ type: 'clear-completed' });
});
window.addEventListener('hashchange', () => controller.setFilter(filterFromHash(location.hash)));

list.addEventListener('change', event => {
  if (event.target.dataset.action === 'toggle') {
    controller.dispatch({ type: 'toggle', id: event.target.closest('.todo').dataset.id });
  }
});
list.addEventListener('click', event => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const id = button.closest('.todo').dataset.id;
  if (button.dataset.action === 'delete') controller.dispatch({ type: 'delete', id });
  if (button.dataset.action === 'edit') controller.startEdit(id);
});
list.addEventListener('dblclick', event => {
  if (event.target.classList.contains('todo-title')) controller.startEdit(event.target.closest('.todo').dataset.id);
});
list.addEventListener('input', event => {
  if (event.target.dataset.action === 'editor') {
    controller.setDraft(event.target.closest('.todo').dataset.id, event.target.value);
  }
});
list.addEventListener('keydown', event => {
  if (event.target.dataset.action !== 'editor' || event.isComposing) return;
  const id = event.target.closest('.todo').dataset.id;
  if (event.key === 'Enter' || event.key === 'Escape') {
    event.preventDefault();
    controller.finishEdit(id, event.key === 'Escape');
  }
});
list.addEventListener('focusout', event => {
  if (event.target.dataset.action === 'editor') {
    controller.finishEdit(event.target.closest('.todo').dataset.id);
  }
});

controller.render();
