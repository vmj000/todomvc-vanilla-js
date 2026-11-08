import { test, expect, addTodos, count, location, notice, titles, todo, todoRows } from './fixtures.js';

const storageKey = 'vanilla-todomvc:v1';

for (const [label, raw] of [
  ['JSON', '{broken JSON'],
  ['schema', JSON.stringify({ version: 1, todos: [{ title: 'No id or completion' }] })],
  ['location type', JSON.stringify({ version: 1, todos: [{ id: 'bad-location', title: 'Invalid', completed: false, location: 42 }] })],
]) {
  test(`malformed saved ${label} is ignored and replaced on the next change`, async ({ page }) => {
    await page.addInitScript(({ key, raw }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, raw);
    }, { key: storageKey, raw });
    await page.goto('/');
    await expect(titles(page)).toHaveCount(0);
    await expect(notice(page)).toHaveText('Saved todos could not be loaded. Starting with an empty list.');
    await addTodos(page, 'Fresh start');
    await expect(notice(page)).toHaveCount(0);
    const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
    expect(saved.version).toBe(1);
    expect(saved.todos).toEqual([{ id: expect.any(String), title: 'Fresh start', location: '', completed: false }]);
    await page.reload();
    await expect(titles(page)).toHaveText(['Fresh start']);
    await expect(notice(page)).toHaveCount(0);
  });
}

test('legacy stored todos retain IDs, order, and completion while gaining blank locations', async ({ page }) => {
  const legacy = [
    { id: 'legacy-first', title: 'Legacy completed', completed: true },
    { id: 'legacy-second', title: 'Legacy active', completed: false },
  ];
  await page.addInitScript(({ key, todos }) => {
    if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify({ version: 1, todos }));
  }, { key: storageKey, todos: legacy });
  await page.goto('/');
  await expect(titles(page)).toHaveText(['Legacy completed', 'Legacy active']);
  await expect(todoRows(page).locator('.todo-location')).toHaveText(['—', '—']);
  await expect(location(page, 'Legacy completed')).toHaveAttribute('aria-label', 'No location');
  await expect(location(page, 'Legacy active')).toHaveAttribute('aria-label', 'No location');
  await expect(todo(page, 'Legacy completed').getByRole('checkbox')).toBeChecked();
  await expect(todo(page, 'Legacy active').getByRole('checkbox')).not.toBeChecked();
  await expect(count(page)).toHaveText('1 item left');
  await expect(notice(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Edit “Legacy active”', exact: true }).click();
  const locationEditor = page.getByRole('textbox', { name: 'Edit location: Legacy active', exact: true });
  await expect(locationEditor).toHaveValue('');
  await locationEditor.fill('  Library  ');
  await locationEditor.press('Enter');
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
  expect(saved).toEqual({
    version: 1,
    todos: [{ ...legacy[0], location: '' }, { ...legacy[1], location: 'Library' }],
  });
  await page.reload();
  await expect(titles(page)).toHaveText(['Legacy completed', 'Legacy active']);
  await expect(todoRows(page).locator('.todo-location')).toHaveText(['—', 'Library']);
  await expect(todo(page, 'Legacy completed').getByRole('checkbox')).toBeChecked();
  await expect(notice(page)).toHaveCount(0);
});

test('blocked storage warns but creation, editing, completion, and deletion work in memory', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() { throw new DOMException('Storage denied by test', 'SecurityError'); },
    });
  });
  await page.goto('/');
  await expect(notice(page)).toContainText('Your browser could not save your todos.');
  await addTodos(page, { title: 'In memory', location: 'Office' }, 'Another item');
  await page.getByRole('button', { name: 'Edit “In memory”', exact: true }).click();
  const editor = page.getByRole('textbox', { name: 'Edit todo: In memory', exact: true });
  await editor.fill('Still usable');
  await page.getByRole('textbox', { name: 'Edit location: In memory', exact: true }).fill('Home');
  await editor.press('Enter');
  await todo(page, 'Still usable').getByRole('checkbox').check();
  await expect(count(page)).toHaveText('1 item left');
  await page.getByRole('button', { name: 'Delete “Another item”', exact: true }).click();
  await expect(titles(page)).toHaveText(['Still usable']);
  await expect(location(page, 'Still usable')).toHaveText('Home');
  await expect(notice(page)).toContainText('changes may not survive a reload');
  await page.reload();
  await expect(titles(page)).toHaveCount(0);
  await expect(notice(page)).toBeVisible();
});

test('quota failure keeps in-memory work and clears the warning after a successful save', async ({ page }) => {
  await page.addInitScript(key => {
    const setItem = Storage.prototype.setItem;
    window.__failTodoWrites = true;
    Storage.prototype.setItem = function (name, value) {
      if (name === key && window.__failTodoWrites) throw new DOMException('Quota exceeded by test', 'QuotaExceededError');
      return setItem.call(this, name, value);
    };
  }, storageKey);
  await page.goto('/');
  await expect(notice(page)).toHaveCount(0);
  await addTodos(page, { title: 'Unsaved at first', location: 'Office' });
  await expect(titles(page)).toHaveText(['Unsaved at first']);
  await expect(notice(page)).toContainText('Your browser could not save your todos.');
  expect(await page.evaluate(key => localStorage.getItem(key), storageKey)).toBeNull();
  await page.evaluate(() => { window.__failTodoWrites = false; });
  await addTodos(page, { title: 'Saving works again', location: 'Home' });
  await expect(notice(page)).toHaveCount(0);
  await page.reload();
  await expect(titles(page)).toHaveText(['Unsaved at first', 'Saving works again']);
  await expect(todoRows(page).locator('.todo-location')).toHaveText(['Office', 'Home']);
  await expect(notice(page)).toHaveCount(0);
});
