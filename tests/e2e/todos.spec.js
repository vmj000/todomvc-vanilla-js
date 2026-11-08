import { test, expect, addTodos, count, filter, newLocation, newTodo, search, titles, todo } from './fixtures.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('empty state, blank rejection, trimmed creation, ordering, and input focus', async ({ page }) => {
  await expect(page.getByRole('region', { name: 'Your todos' })).toBeHidden();
  await expect(page.getByRole('navigation', { name: 'Filter todos' })).toBeHidden();
  await expect(newTodo(page)).toBeFocused();
  await addTodos(page, '   ');
  await expect(titles(page)).toHaveCount(0);
  await addTodos(page, '  Read a book  ', 'Take a walk', 'Make tea');
  await expect(titles(page)).toHaveText(['Read a book', 'Take a walk', 'Make tea']);
  await expect(count(page)).toHaveText('3 items left');
  await expect(newTodo(page)).toHaveValue('');
  await expect(newTodo(page)).toBeFocused();
  await expect(page.getByRole('button', { name: 'Clear completed' })).toBeHidden();
});

test('double-click editing selects the title and Enter saves once, trimmed', async ({ page }) => {
  await addTodos(page, 'Read a book', 'Take a walk');
  await todo(page, 'Read a book').getByText('Read a book', { exact: true }).dblclick();
  const editor = page.getByRole('textbox', { name: 'Edit todo: Read a book', exact: true });
  await expect(editor).toBeFocused();
  await expect(editor).toHaveValue('Read a book');
  expect(await editor.evaluate(input => [input.selectionStart, input.selectionEnd])).toEqual([0, 11]);
  await editor.fill('  Read two books  ');
  await editor.press('Enter');
  await expect(page.getByRole('button', { name: 'Edit “Read two books”', exact: true })).toBeFocused();
  await newTodo(page).click();
  await expect(titles(page)).toHaveText(['Read two books', 'Take a walk']);
});

test('blur saves while a different row action still receives its click', async ({ page }) => {
  await addTodos(page, 'Read a book', 'Take a walk', 'Make tea');
  await page.getByRole('button', { name: 'Edit “Read a book”', exact: true }).click();
  await page.getByRole('textbox', { name: 'Edit todo: Read a book', exact: true }).fill('  Read outside  ');
  await page.getByRole('button', { name: 'Delete “Take a walk”', exact: true }).click();
  await expect(titles(page)).toHaveText(['Read outside', 'Make tea']);
  await page.reload();
  await expect(titles(page)).toHaveText(['Read outside', 'Make tea']);
});

for (const draft of ['', 'An unsaved change']) {
  test(`Escape cancels ${draft ? 'a changed' : 'a blank'} draft, including subsequent blur`, async ({ page }) => {
    await addTodos(page, 'Keep this title');
    await page.getByRole('button', { name: 'Edit “Keep this title”', exact: true }).click();
    const editor = page.getByRole('textbox', { name: 'Edit todo: Keep this title', exact: true });
    await editor.fill(draft);
    await editor.press('Escape');
    await expect(page.getByRole('button', { name: 'Edit “Keep this title”', exact: true })).toBeFocused();
    await newTodo(page).click();
    await expect(titles(page)).toHaveText(['Keep this title']);
    await page.reload();
    await expect(titles(page)).toHaveText(['Keep this title']);
  });
}

for (const commit of ['Enter', 'blur']) {
  test(`a whitespace edit deletes only that todo on ${commit}`, async ({ page }) => {
    await addTodos(page, 'Delete this', 'Keep this');
    await page.getByRole('button', { name: 'Edit “Delete this”', exact: true }).click();
    const editor = page.getByRole('textbox', { name: 'Edit todo: Delete this', exact: true });
    await editor.fill('   ');
    if (commit === 'Enter') await editor.press('Enter');
    else await newTodo(page).click();
    await expect(titles(page)).toHaveText(['Keep this']);
    await expect(count(page)).toHaveText('1 item left');
    await page.reload();
    await expect(titles(page)).toHaveText(['Keep this']);
  });
}

test('completion, global counts, mixed bulk state, and all filters', async ({ page }) => {
  await addTodos(page, 'Read a book', 'Take a walk', 'Make tea');
  await todo(page, 'Read a book').getByRole('checkbox').check();
  await expect(count(page)).toHaveText('2 items left');
  await expect(page.getByRole('checkbox', { name: 'Mark all todos as complete', exact: true })).toHaveJSProperty('indeterminate', true);
  await filter(page, 'Active');
  await expect(page).toHaveURL(/#\/active$/);
  await expect(titles(page)).toHaveText(['Take a walk', 'Make tea']);
  await expect(count(page)).toHaveText('2 items left');
  await filter(page, 'Completed');
  await expect(titles(page)).toHaveText(['Read a book']);
  await expect(count(page)).toHaveText('2 items left');
  // This row disappears from Completed immediately; assert the result instead
  // of uncheck() waiting to inspect a checkbox that is no longer attached.
  await todo(page, 'Read a book').getByRole('checkbox').click();
  await expect(titles(page)).toHaveCount(0);
  await expect(page.getByText('No todos here. A little breathing room.', { exact: true })).toBeVisible();
  await expect(count(page)).toHaveText('3 items left');
  await filter(page, 'All');
  await expect(titles(page)).toHaveText(['Read a book', 'Take a walk', 'Make tea']);
});

test('bulk actions include hidden todos and remain usable in empty filtered views', async ({ page }) => {
  await addTodos(page, 'Read a book', 'Take a walk', 'Make tea');
  await todo(page, 'Read a book').getByRole('checkbox').check();
  await filter(page, 'Completed');
  await page.getByRole('checkbox', { name: 'Mark all todos as complete', exact: true }).check();
  await expect(titles(page)).toHaveText(['Read a book', 'Take a walk', 'Make tea']);
  await expect(count(page)).toHaveText('0 items left');
  await filter(page, 'Active');
  await expect(titles(page)).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Your todos' })).toBeVisible();
  await page.getByRole('checkbox', { name: 'Mark all todos as active', exact: true }).uncheck();
  await expect(titles(page)).toHaveText(['Read a book', 'Take a walk', 'Make tea']);
  await expect(count(page)).toHaveText('3 items left');
  await page.getByRole('checkbox', { name: 'Mark all todos as complete', exact: true }).check();
  await expect(titles(page)).toHaveCount(0);
  await filter(page, 'Completed');
  await page.getByRole('checkbox', { name: 'Mark all todos as active', exact: true }).uncheck();
  await expect(titles(page)).toHaveCount(0);
  await filter(page, 'All');
  await expect(todo(page, 'Read a book').getByRole('checkbox')).not.toBeChecked();
  await expect(todo(page, 'Take a walk').getByRole('checkbox')).not.toBeChecked();
  await expect(todo(page, 'Make tea').getByRole('checkbox')).not.toBeChecked();
});

test('clear completed removes hidden items, recovers focus, and final deletion restores empty state', async ({ page }) => {
  await addTodos(page, 'Completed item', 'Keep me');
  await todo(page, 'Completed item').getByRole('checkbox').check();
  await filter(page, 'Active');
  await page.getByRole('button', { name: 'Clear completed', exact: true }).press('Enter');
  await expect(page.getByRole('link', { name: 'Active', exact: true })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Clear completed', exact: true })).toBeHidden();
  await filter(page, 'All');
  await expect(titles(page)).toHaveText(['Keep me']);
  await page.getByRole('button', { name: 'Delete “Keep me”', exact: true }).press('Enter');
  await expect(titles(page)).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Your todos' })).toBeHidden();
  await expect(page.getByRole('navigation', { name: 'Filter todos' })).toBeHidden();
  await expect(newTodo(page)).toBeFocused();
  await page.reload();
  await expect(titles(page)).toHaveCount(0);
});

test('reload preserves ordered titles, completion, and route; hash Back/Forward restores filters', async ({ page }) => {
  await addTodos(page, 'First', 'Second', 'Third');
  await todo(page, 'Second').getByRole('checkbox').check();
  await filter(page, 'All');
  await filter(page, 'Active');
  await filter(page, 'Completed');
  await page.reload();
  await expect(page).toHaveURL(/#\/completed$/);
  await expect(titles(page)).toHaveText(['Second']);
  await expect(page.getByRole('link', { name: 'Completed', exact: true })).toHaveAttribute('aria-current', 'page');
  await page.goBack();
  await expect(page).toHaveURL(/#\/active$/);
  await expect(page.getByRole('link', { name: 'Active', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(titles(page)).toHaveText(['First', 'Third']);
  await page.goForward();
  await expect(page).toHaveURL(/#\/completed$/);
  await expect(titles(page)).toHaveText(['Second']);
  await filter(page, 'All');
  await expect(titles(page)).toHaveText(['First', 'Second', 'Third']);
  await expect(todo(page, 'Second').getByRole('checkbox')).toBeChecked();
  await page.goto('/#/unknown');
  await expect(titles(page)).toHaveText(['First', 'Second', 'Third']);
  await expect(page.getByRole('link', { name: 'All', exact: true })).toHaveAttribute('aria-current', 'page');
});

test('HTML-like titles stay literal when created, edited, and restored', async ({ page }) => {
  const literal = '<img src=x onerror="window.__todoXss=true">';
  const edited = '<svg onload="window.__todoXss=true"> & "quoted"';
  await addTodos(page, literal);
  await expect(titles(page)).toHaveText([literal]);
  await expect(page.getByRole('table').locator('img, .todo-title svg')).toHaveCount(0);
  await page.getByRole('button', { name: `Edit “${literal}”`, exact: true }).click();
  const editor = page.getByRole('textbox', { name: `Edit todo: ${literal}`, exact: true });
  await editor.fill(edited);
  await editor.press('Enter');
  await page.reload();
  await expect(titles(page)).toHaveText([edited]);
  await expect(page.getByRole('table').locator('img, .todo-title svg')).toHaveCount(0);
  expect(await page.evaluate(() => window.__todoXss)).toBeUndefined();
});

test('native keyboard navigation can complete, edit, and delete with predictable focus', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit' && process.platform === 'darwin',
    'macOS WebKit tab order depends on host Full Keyboard Access settings; covered on Linux CI.');
  await addTodos(page, 'First', 'Second');
  await newTodo(page).press('Tab');
  await expect(newLocation(page)).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Add todo', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(search(page)).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('region', { name: 'Todo table, scroll horizontally to see all columns', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(todo(page, 'First').getByRole('checkbox')).toBeFocused();
  await page.keyboard.press('Space');
  await expect(todo(page, 'First').getByRole('checkbox')).toBeChecked();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Edit “First”', exact: true })).toBeFocused();
  await page.keyboard.press('Space');
  await expect(page.getByRole('textbox', { name: 'Edit todo: First', exact: true })).toBeFocused();
  await page.keyboard.type('Renamed');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Edit “Renamed”', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Delete “Renamed”', exact: true })).toBeFocused();
  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: 'Delete “Second”', exact: true })).toBeFocused();
  await page.keyboard.press('Space');
  await expect(newTodo(page)).toBeFocused();
  await expect(titles(page)).toHaveCount(0);
});
