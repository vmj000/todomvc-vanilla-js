import { readFile } from 'node:fs/promises';
import {
  test, expect, addTodos, category, filter, location, newCategory, newLocation,
  newTodo, notice, titles, todo, todoRows,
} from './fixtures.js';

const storageKey = 'vanilla-todomvc:v1';
const editor = (page, title) => page.getByRole('combobox', { name: `Edit category: ${title}`, exact: true });
const savedTodos = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)).todos, storageKey);

test('the legacy DOM fixture still completes every assertion and reloads category data', async ({ page }) => {
  await page.goto('/');
  const source = await readFile(new URL('../browser-checks.js', import.meta.url), 'utf8');
  const result = await page.evaluate(source);
  expect(result.passed).toBe(source.match(/^\s*assert\(/gm).length);
  expect(result.checks).toContain('persistent payload includes default categories');
  await page.reload();
  await expect(titles(page)).toHaveText(result.saved.todos.map(todo => todo.title));
  await expect(todoRows(page).locator('.todo-category')).toHaveText(result.saved.todos.map(todo => todo.category));
});

test('creation defaults to work, offers exactly three lowercase categories, and persists each choice', async ({ page }) => {
  await page.goto('/');
  await expect(newCategory(page)).toHaveValue('work');
  await expect(newCategory(page).locator('option')).toHaveText(['work', 'health', 'home']);
  expect(await newCategory(page).locator('option').evaluateAll(options => options.map(option => option.value))).toEqual(['work', 'health', 'home']);
  await newCategory(page).selectOption('home');
  await newTodo(page).fill(' ');
  await page.getByRole('button', { name: 'Add todo', exact: true }).click();
  await expect(titles(page)).toHaveCount(0);
  await expect(newCategory(page)).toHaveValue('home');
  await newCategory(page).selectOption('work');
  await newTodo(page).fill('  Default task  ');
  await newLocation(page).fill('  Office  ');
  await page.getByRole('button', { name: 'Add todo', exact: true }).click();
  await addTodos(page, { title: 'Walk', category: 'health' }, { title: 'Clean', category: 'home' });
  await expect(todoRows(page).locator('.todo-category')).toHaveText(['work', 'health', 'home']);
  await expect(location(page, 'Default task')).toHaveText('Office');
  await expect(newCategory(page)).toHaveValue('work');
  await expect(newTodo(page)).toBeFocused();
  await page.reload();
  await expect(todoRows(page).locator('.todo-category')).toHaveText(['work', 'health', 'home']);
});

test('select focus and changes retain all drafts until Save or Enter commits them together', async ({ page }) => {
  await page.goto('/');
  await addTodos(page, { title: 'Original', location: 'Office', category: 'work' });
  const original = (await savedTodos(page))[0];
  await page.getByRole('button', { name: 'Edit “Original”', exact: true }).click();
  const titleEditor = page.getByRole('textbox', { name: 'Edit todo: Original', exact: true });
  const locationEditor = page.getByRole('textbox', { name: 'Edit location: Original', exact: true });
  const categoryEditor = editor(page, 'Original');
  await expect(categoryEditor.locator('option')).toHaveText(['work', 'health', 'home']);
  expect(await categoryEditor.locator('option').evaluateAll(options => options.map(option => option.value))).toEqual(['work', 'health', 'home']);
  await titleEditor.fill('  Saved title  ');
  await locationEditor.fill('  Saved place  ');
  await categoryEditor.focus();
  await categoryEditor.selectOption('health');
  await titleEditor.focus();
  await expect(titleEditor).toHaveValue('  Saved title  ');
  await expect(locationEditor).toHaveValue('  Saved place  ');
  await expect(categoryEditor).toHaveValue('health');
  await page.getByRole('button', { name: 'Save “Original”', exact: true }).focus();
  expect(await savedTodos(page)).toEqual([original]);
  await page.getByRole('button', { name: 'Save “Original”', exact: true }).click();
  await expect(category(page, 'Saved title')).toHaveText('health');
  await expect(location(page, 'Saved title')).toHaveText('Saved place');
  await expect(page.getByRole('button', { name: 'Edit “Saved title”', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Edit “Saved title”', exact: true }).click();
  await editor(page, 'Saved title').selectOption('home');
  await editor(page, 'Saved title').press('Enter');
  await expect(category(page, 'Saved title')).toHaveText('home');
  expect(await savedTodos(page)).toEqual([{ ...original, title: 'Saved title', location: 'Saved place', category: 'home' }]);
  await page.reload();
  await expect(category(page, 'Saved title')).toHaveText('home');
  await expect(location(page, 'Saved title')).toHaveText('Saved place');
});

for (const cancel of ['Escape', 'Cancel']) {
  test(`${cancel} cancels category and both text drafts, including a blank task and subsequent blur`, async ({ page }) => {
    await page.goto('/');
    await addTodos(page, { title: 'Keep', location: 'Home', category: 'home' });
    const before = await savedTodos(page);
    await page.getByRole('button', { name: 'Edit “Keep”', exact: true }).click();
    await page.getByRole('textbox', { name: 'Edit todo: Keep', exact: true }).fill('');
    await page.getByRole('textbox', { name: 'Edit location: Keep', exact: true }).fill('Discard place');
    await editor(page, 'Keep').selectOption('health');
    if (cancel === 'Escape') await editor(page, 'Keep').press('Escape');
    else await page.getByRole('button', { name: 'Cancel editing “Keep”', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Edit “Keep”', exact: true })).toBeFocused();
    await newTodo(page).focus();
    await expect(category(page, 'Keep')).toHaveText('home');
    await expect(location(page, 'Keep')).toHaveText('Home');
    expect(await savedTodos(page)).toEqual(before);
    await page.reload();
    await expect(category(page, 'Keep')).toHaveText('home');
  });
}

test('leaving a changed select commits the row while another row action still receives its click', async ({ page }) => {
  await page.goto('/');
  await addTodos(page, { title: 'First', location: 'Office', category: 'work' }, 'Second');
  const first = (await savedTodos(page))[0];
  await page.getByRole('button', { name: 'Edit “First”', exact: true }).click();
  await page.getByRole('textbox', { name: 'Edit todo: First', exact: true }).fill('Changed first');
  await page.getByRole('textbox', { name: 'Edit location: First', exact: true }).fill(' Park ');
  await editor(page, 'First').focus();
  await editor(page, 'First').selectOption('health');
  await page.getByRole('button', { name: 'Delete “Second”', exact: true }).click();
  await expect(titles(page)).toHaveText(['Changed first']);
  expect(await savedTodos(page)).toEqual([{ ...first, title: 'Changed first', location: 'Park', category: 'health' }]);
  await page.reload();
  await expect(category(page, 'Changed first')).toHaveText('health');
});

test('filtered bulk actions, title-only edits and clearing preserve categories of surviving rows', async ({ page }) => {
  await page.goto('/');
  await addTodos(page,
    { title: 'First', category: 'work' },
    { title: 'Second', category: 'health' },
    { title: 'Third', category: 'home' });
  await todo(page, 'First').getByRole('checkbox').check();
  await filter(page, 'Completed');
  await page.getByRole('checkbox', { name: 'Mark all todos as complete', exact: true }).check();
  await expect(todoRows(page).locator('.todo-category')).toHaveText(['work', 'health', 'home']);
  await filter(page, 'Active');
  await expect(todoRows(page)).toHaveCount(0);
  await page.getByRole('checkbox', { name: 'Mark all todos as active', exact: true }).uncheck();
  await page.getByRole('button', { name: 'Edit “Second”', exact: true }).click();
  const titleEditor = page.getByRole('textbox', { name: 'Edit todo: Second', exact: true });
  await titleEditor.fill('Renamed second');
  await titleEditor.press('Enter');
  await expect(category(page, 'Renamed second')).toHaveText('health');
  await todo(page, 'First').getByRole('checkbox').click();
  await page.getByRole('button', { name: 'Clear completed', exact: true }).click();
  await filter(page, 'All');
  await expect(titles(page)).toHaveText(['Renamed second', 'Third']);
  await expect(todoRows(page).locator('.todo-category')).toHaveText(['health', 'home']);
  await page.reload();
  await expect(todoRows(page).locator('.todo-category')).toHaveText(['health', 'home']);
});

test('legacy and categorized saved records preserve data, default only missing categories and migrate on mutation', async ({ page }) => {
  const todos = [
    { id: 'old', title: 'Old', location: 'Office', completed: true },
    { id: 'older', title: 'Older', completed: false },
    { id: 'current', title: '<img src=x onerror="window.__categoryXss=true">', location: '<svg>literal</svg>', category: 'home', completed: false },
  ];
  const raw = JSON.stringify({ version: 1, todos });
  await page.addInitScript(({ key, raw }) => {
    if (localStorage.getItem(key) === null) localStorage.setItem(key, raw);
  }, { key: storageKey, raw });
  await page.goto('/');
  await expect(todoRows(page).locator('.todo-category')).toHaveText(['work', 'work', 'home']);
  await expect(titles(page)).toHaveText(todos.map(todo => todo.title));
  await expect(todo(page, 'Old').getByRole('checkbox')).toBeChecked();
  await expect(notice(page)).toHaveCount(0);
  expect(await page.evaluate(key => localStorage.getItem(key), storageKey)).toBe(raw);
  await expect(page.locator('.todo-title img, .todo-location svg')).toHaveCount(0);
  expect(await page.evaluate(() => window.__categoryXss)).toBeUndefined();
  await page.getByRole('button', { name: 'Edit “Old”', exact: true }).click();
  await expect(editor(page, 'Old')).toHaveValue('work');
  await editor(page, 'Old').selectOption('health');
  await editor(page, 'Old').press('Enter');
  expect(await savedTodos(page)).toEqual([
    { ...todos[0], category: 'health' }, { ...todos[1], location: '', category: 'work' }, todos[2],
  ]);
  await page.reload();
  await expect(todoRows(page).locator('.todo-category')).toHaveText(['health', 'work', 'home']);
  await expect(todo(page, 'Old').getByRole('checkbox')).toBeChecked();
});
