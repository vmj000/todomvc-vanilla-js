import { test, expect, addTodos, count, notice, titles, todo } from './fixtures.js';

const storageKey = 'vanilla-todomvc:v1';

for (const raw of ['{broken JSON', JSON.stringify({ version: 1, todos: [{ title: 'No id or completion' }] })]) {
  test(`malformed saved ${raw.startsWith('{broken') ? 'JSON' : 'schema'} is ignored and replaced on the next change`, async ({ page }) => {
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
    expect(saved.todos).toEqual([{ id: expect.any(String), title: 'Fresh start', completed: false }]);
    await page.reload();
    await expect(titles(page)).toHaveText(['Fresh start']);
    await expect(notice(page)).toHaveCount(0);
  });
}

test('blocked storage warns but creation, editing, completion, and deletion work in memory', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() { throw new DOMException('Storage denied by test', 'SecurityError'); },
    });
  });
  await page.goto('/');
  await expect(notice(page)).toContainText('Your browser could not save your todos.');
  await addTodos(page, 'In memory', 'Another item');
  await page.getByRole('button', { name: 'Edit “In memory”', exact: true }).click();
  const editor = page.getByRole('textbox', { name: 'Edit todo: In memory', exact: true });
  await editor.fill('Still usable');
  await editor.press('Enter');
  await todo(page, 'Still usable').getByRole('checkbox').check();
  await expect(count(page)).toHaveText('1 item left');
  await page.getByRole('button', { name: 'Delete “Another item”', exact: true }).click();
  await expect(titles(page)).toHaveText(['Still usable']);
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
  await addTodos(page, 'Unsaved at first');
  await expect(titles(page)).toHaveText(['Unsaved at first']);
  await expect(notice(page)).toContainText('Your browser could not save your todos.');
  expect(await page.evaluate(key => localStorage.getItem(key), storageKey)).toBeNull();
  await page.evaluate(() => { window.__failTodoWrites = false; });
  await addTodos(page, 'Saving works again');
  await expect(notice(page)).toHaveCount(0);
  await page.reload();
  await expect(titles(page)).toHaveText(['Unsaved at first', 'Saving works again']);
  await expect(notice(page)).toHaveCount(0);
});
