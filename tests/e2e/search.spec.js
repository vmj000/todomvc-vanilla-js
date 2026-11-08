import {
  test, expect, addTodos, count, filter, location, newTodo, search, titles, todo,
} from './fixtures.js';

const storageKey = 'vanilla-todomvc:v1';
const noResults = page => page.getByRole('status').filter({ hasText: /^No todos match your search\.$/ });
const demoTodos = [
  { title: 'Buy milk', location: 'Corner shop' },
  { title: 'Prepare demo', location: 'Office' },
  { title: 'Read docs', location: 'Home' },
];

async function createDemo(page) {
  await page.goto('/');
  await addTodos(page, ...demoTodos);
  await todo(page, 'Prepare demo').getByRole('checkbox').check();
}

test('instant title/location search intersects filters and clearing restores ordered results', async ({ page }) => {
  await createDemo(page);
  await filter(page, 'All');
  const url = page.url();
  await search(page).fill(' OFFICE');
  await expect(titles(page)).toHaveText(['Prepare demo']);
  await expect(search(page)).toBeFocused();
  await expect(count(page)).toHaveText('2 items left');
  expect(page.url()).toBe(url);
  await filter(page, 'Completed');
  await expect(search(page)).toHaveValue(' OFFICE');
  await expect(titles(page)).toHaveText(['Prepare demo']);
  await filter(page, 'Active');
  await expect(titles(page)).toHaveCount(0);
  await expect(noResults(page)).toBeVisible();
  await expect(count(page)).toHaveText('2 items left');
  await search(page).fill('read');
  await expect(titles(page)).toHaveText(['Read docs']);
  await expect(noResults(page)).toBeHidden();
  await search(page).fill('   ');
  await expect(titles(page)).toHaveText(['Buy milk', 'Read docs']);
  await search(page).fill('read');
  await search(page).press('ControlOrMeta+A');
  await search(page).press('Backspace');
  await expect(search(page)).toHaveValue('');
  await expect(search(page)).toBeFocused();
  await expect(titles(page)).toHaveText(['Buy milk', 'Read docs']);
  await filter(page, 'All');
  await search(page).fill('NER SH');
  await expect(titles(page)).toHaveText(['Buy milk']);
  await search(page).fill('no matching todo');
  await expect(titles(page)).toHaveCount(0);
  await expect(noResults(page)).toBeVisible();
  await search(page).fill('');
  await expect(titles(page)).toHaveText(demoTodos.map(todo => todo.title));
});

test('toggle-all and Clear completed include search-hidden todos even with no visible matches', async ({ page }) => {
  await createDemo(page);
  await search(page).fill('milk');
  await expect(titles(page)).toHaveText(['Buy milk']);
  await expect(count(page)).toHaveText('2 items left');
  const toggleAll = page.getByRole('checkbox', { name: 'Mark all todos as complete', exact: true });
  await expect(toggleAll).toHaveJSProperty('indeterminate', true);
  await toggleAll.check();
  await expect(titles(page)).toHaveText(['Buy milk']);
  await expect(count(page)).toHaveText('0 items left');
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
  expect(saved.todos.map(todo => todo.completed)).toEqual([true, true, true]);
  await filter(page, 'Active');
  await expect(titles(page)).toHaveCount(0);
  await expect(noResults(page)).toBeVisible();
  await page.getByRole('checkbox', { name: 'Mark all todos as active', exact: true }).uncheck();
  await expect(titles(page)).toHaveText(['Buy milk']);
  await expect(count(page)).toHaveText('3 items left');
  await page.getByRole('checkbox', { name: 'Mark all todos as complete', exact: true }).check();
  await expect(titles(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Clear completed', exact: true }).press('Enter');
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).todos, storageKey)).toEqual([]);
  await expect(search(page)).toBeVisible();
  await expect(search(page)).toBeFocused();
  await expect(search(page)).toHaveValue('milk');
  await search(page).fill('');
  await expect(search(page)).toBeFocused();
  await expect(noResults(page)).toBeHidden();
});

test('legacy locations search safely; query never writes storage or routes and reload clears it', async ({ page }) => {
  const todos = [
    ...demoTodos.map((todo, index) => ({ ...todo, id: `demo-${index}`, completed: index === 1 })),
    { id: 'legacy', title: 'Legacy notes', completed: false },
  ];
  const raw = JSON.stringify({ version: 1, todos });
  await page.addInitScript(({ key, raw }) => {
    if (localStorage.getItem(key) === null) localStorage.setItem(key, raw);
    window.__searchStorageWrites = 0;
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (...args) {
      window.__searchStorageWrites++;
      return setItem.apply(this, args);
    };
  }, { key: storageKey, raw });
  await page.goto('/#/active');
  const url = page.url();
  await search(page).fill(' NOTES ');
  await expect(titles(page)).toHaveText(['Legacy notes']);
  await expect(location(page, 'Legacy notes')).toHaveAttribute('aria-label', 'No location');
  await search(page).fill('undefined');
  await expect(noResults(page)).toBeVisible();
  await search(page).fill('office');
  await expect(titles(page)).toHaveCount(0);
  expect(page.url()).toBe(url);
  await filter(page, 'Completed');
  await expect(titles(page)).toHaveText(['Prepare demo']);
  await expect(search(page)).toHaveValue('office');
  await page.goBack();
  await expect(page).toHaveURL(/#\/active$/);
  await expect(noResults(page)).toBeVisible();
  await page.goForward();
  await expect(titles(page)).toHaveText(['Prepare demo']);
  await page.goBack();
  await expect(noResults(page)).toBeVisible();
  expect(await page.evaluate(() => window.__searchStorageWrites)).toBe(0);
  expect(await page.evaluate(() => ({ ...localStorage }))).toEqual({ [storageKey]: raw });
  await page.reload();
  await expect(search(page)).toHaveValue('');
  await expect(page).toHaveURL(/#\/active$/);
  await expect(page.getByRole('link', { name: 'Active', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(titles(page)).toHaveText(['Buy milk', 'Read docs', 'Legacy notes']);
  expect(await page.evaluate(() => ({ ...localStorage }))).toEqual({ [storageKey]: raw });
});

test('search is labeled, keyboard-accessible, and usable before any todos exist', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit' && process.platform === 'darwin',
    'macOS WebKit tab order depends on host Full Keyboard Access settings; covered on Linux CI.');
  await page.goto('/');
  await expect(search(page)).toBeVisible();
  await expect(search(page)).toHaveAccessibleName('Search todos');
  await page.getByRole('button', { name: 'Add todo', exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(search(page)).toBeFocused();
  await page.keyboard.type('office');
  await expect(noResults(page)).toBeVisible();
  await expect(search(page)).toBeFocused();
  await addTodos(page, { title: 'Read docs', location: 'Home' });
  await expect(titles(page)).toHaveCount(0);
  await expect(noResults(page)).toBeVisible();
  await addTodos(page, { title: 'Prepare demo', location: 'Office' });
  await expect(titles(page)).toHaveText(['Prepare demo']);
  await expect(count(page)).toHaveText('2 items left');
  await expect(search(page)).toHaveValue('office');
  await expect(newTodo(page)).toBeFocused();
});

test('search preserves editing transactions and focus when an edit stops matching', async ({ page }) => {
  await createDemo(page);
  await search(page).fill('office');
  await page.getByRole('button', { name: 'Edit “Prepare demo”', exact: true }).click();
  await page.getByRole('textbox', { name: 'Edit todo: Prepare demo', exact: true }).fill('Prepare launch');
  await page.getByRole('textbox', { name: 'Edit location: Prepare demo', exact: true }).fill('Library');
  // Leaving the edited row saves both fields even when that removes its search match.
  await search(page).click();
  await expect(search(page)).toBeFocused();
  await expect(noResults(page)).toBeVisible();
  await search(page).fill('library');
  await expect(titles(page)).toHaveText(['Prepare launch']);
  await expect(location(page, 'Prepare launch')).toHaveText('Library');
  await page.getByRole('button', { name: 'Edit “Prepare launch”', exact: true }).click();
  await page.getByRole('textbox', { name: 'Edit todo: Prepare launch', exact: true }).fill('');
  const locationEditor = page.getByRole('textbox', { name: 'Edit location: Prepare launch', exact: true });
  await locationEditor.fill('Unsaved place');
  await locationEditor.press('Escape');
  await expect(page.getByRole('button', { name: 'Edit “Prepare launch”', exact: true })).toBeFocused();
  await expect(location(page, 'Prepare launch')).toHaveText('Library');
  await page.getByRole('button', { name: 'Edit “Prepare launch”', exact: true }).click();
  const editor = page.getByRole('textbox', { name: 'Edit location: Prepare launch', exact: true });
  await editor.fill('Remote');
  await editor.press('Enter');
  await expect(noResults(page)).toBeVisible();
  await expect(newTodo(page)).toBeFocused();
  await search(page).fill('');
  await expect(titles(page)).toHaveText(['Buy milk', 'Prepare launch', 'Read docs']);
  await expect(location(page, 'Prepare launch')).toHaveText('Remote');
});

test('HTML-like query, titles, and locations remain literal through search and reload', async ({ page }) => {
  await page.goto('/');
  const literal = '<img src=x onerror="window.__searchXss=true">';
  await addTodos(page, { title: literal, location: 'Home' }, { title: 'Safe title', location: literal });
  await search(page).fill(literal.toUpperCase());
  await expect(titles(page)).toHaveText([literal, 'Safe title']);
  await search(page).fill('<svg onload="window.__searchXss=true">');
  await expect(noResults(page)).toHaveText('No todos match your search.');
  await expect(page.locator('.todoapp img, .todo-title svg, .todo-location svg, #filter-empty svg')).toHaveCount(0);
  expect(await page.evaluate(() => window.__searchXss)).toBeUndefined();
  await page.reload();
  await expect(search(page)).toHaveValue('');
  await expect(titles(page)).toHaveText([literal, 'Safe title']);
  expect(await page.evaluate(() => window.__searchXss)).toBeUndefined();
});
