import {
  test, expect, addTodos, count, filter, location, newLocation, newTodo,
  titles, todo, todoRows, todoTable,
} from './fixtures.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('semantic table has four columns; creation accepts optional trimmed locations', async ({ page }) => {
  await newLocation(page).fill('Office');
  await newTodo(page).fill('   ');
  await page.getByRole('button', { name: 'Add todo', exact: true }).click();
  await expect(todoRows(page)).toHaveCount(0);
  await newTodo(page).fill('  Write notes  ');
  await newLocation(page).fill('  Office  ');
  await page.getByRole('button', { name: 'Add todo', exact: true }).click();
  await expect(todoTable(page)).toBeVisible();
  await expect(todoTable(page).getByRole('columnheader')).toHaveText(['Completion', 'Task', 'Location', 'Actions']);
  const row = todo(page, 'Write notes');
  await expect(row.getByRole('cell')).toHaveCount(4);
  await expect(row.getByRole('cell').nth(1)).toHaveText('Write notes');
  await expect(row.getByRole('cell').nth(2)).toHaveText('Office');
  await expect(newTodo(page)).toHaveValue('');
  await expect(newLocation(page)).toHaveValue('');
  await expect(newTodo(page)).toBeFocused();
  await newTodo(page).fill('Office');
  await newLocation(page).fill('Write notes');
  await newLocation(page).press('Enter');
  await addTodos(page, 'No location');
  await expect(titles(page)).toHaveText(['Write notes', 'Office', 'No location']);
  await expect(location(page, 'Write notes')).toHaveText('Office');
  await expect(location(page, 'Office')).toHaveText('Write notes');
  await expect(location(page, 'No location')).toHaveText('—');
  await expect(location(page, 'No location')).toHaveAttribute('aria-label', 'No location');
  await expect(count(page)).toHaveText('3 items left');
});

test('Enter from the location editor saves both trimmed fields without committing between controls', async ({ page }) => {
  await addTodos(page, { title: 'Write notes', location: 'Office' });
  await page.getByRole('button', { name: 'Edit “Write notes”', exact: true }).click();
  const titleEditor = page.getByRole('textbox', { name: 'Edit todo: Write notes', exact: true });
  const locationEditor = page.getByRole('textbox', { name: 'Edit location: Write notes', exact: true });
  await expect(titleEditor).toBeFocused();
  await titleEditor.fill('  Write a report  ');
  await titleEditor.press('Tab');
  await expect(locationEditor).toBeFocused();
  await expect(titleEditor).toHaveValue('  Write a report  ');
  await expect(todo(page, 'Write notes').getByRole('checkbox')).toBeDisabled();
  await locationEditor.fill('  Home office  ');
  await page.getByRole('button', { name: 'Save “Write notes”', exact: true }).focus();
  await expect(titleEditor).toBeVisible();
  await expect(locationEditor).toHaveValue('  Home office  ');
  const beforeSave = await page.evaluate(() => JSON.parse(localStorage.getItem('vanilla-todomvc:v1')).todos);
  expect(beforeSave[0]).toMatchObject({ title: 'Write notes', location: 'Office', completed: false });
  await locationEditor.press('Enter');
  await expect(titles(page)).toHaveText(['Write a report']);
  await expect(location(page, 'Write a report')).toHaveText('Home office');
  await expect(page.getByRole('button', { name: 'Edit “Write a report”', exact: true })).toBeFocused();
  await page.reload();
  await expect(location(page, 'Write a report')).toHaveText('Home office');
});

test('Escape from the location editor cancels both drafts, including a blank title', async ({ page }) => {
  await addTodos(page, { title: 'Keep title', location: 'Keep place' });
  await page.getByRole('button', { name: 'Edit “Keep title”', exact: true }).click();
  await page.getByRole('textbox', { name: 'Edit todo: Keep title', exact: true }).fill('');
  const locationEditor = page.getByRole('textbox', { name: 'Edit location: Keep title', exact: true });
  await locationEditor.fill('Discard this place');
  await locationEditor.press('Escape');
  await expect(page.getByRole('button', { name: 'Edit “Keep title”', exact: true })).toBeFocused();
  await newTodo(page).click();
  await expect(titles(page)).toHaveText(['Keep title']);
  await expect(location(page, 'Keep title')).toHaveText('Keep place');
  await page.reload();
  await expect(location(page, 'Keep title')).toHaveText('Keep place');
});

test('leaving the edited row saves both fields and a different row action still works', async ({ page }) => {
  await addTodos(page,
    { title: 'First', location: 'Office' },
    { title: 'Second', location: 'Park' });
  await page.getByRole('button', { name: 'Edit “First”', exact: true }).click();
  await page.getByRole('textbox', { name: 'Edit todo: First', exact: true }).fill('Updated first');
  await page.getByRole('textbox', { name: 'Edit location: First', exact: true }).fill('  Library  ');
  await page.getByRole('button', { name: 'Delete “Second”', exact: true }).click();
  await expect(titles(page)).toHaveText(['Updated first']);
  await expect(location(page, 'Updated first')).toHaveText('Library');
  await page.reload();
  await expect(location(page, 'Updated first')).toHaveText('Library');
});

test('explicit Save and Cancel buttons respect the combined editing transaction', async ({ page }) => {
  await addTodos(page, { title: 'Original', location: 'Office' });
  await page.getByRole('button', { name: 'Edit “Original”', exact: true }).click();
  await page.getByRole('textbox', { name: 'Edit todo: Original', exact: true }).fill('Saved title');
  await page.getByRole('textbox', { name: 'Edit location: Original', exact: true }).fill('Saved place');
  await page.getByRole('button', { name: 'Save “Original”', exact: true }).click();
  await expect(titles(page)).toHaveText(['Saved title']);
  await expect(location(page, 'Saved title')).toHaveText('Saved place');
  await page.getByRole('button', { name: 'Edit “Saved title”', exact: true }).click();
  await page.getByRole('textbox', { name: 'Edit todo: Saved title', exact: true }).fill('Unsaved title');
  await page.getByRole('textbox', { name: 'Edit location: Saved title', exact: true }).fill('Unsaved place');
  await page.getByRole('button', { name: 'Cancel editing “Saved title”', exact: true }).click();
  await expect(titles(page)).toHaveText(['Saved title']);
  await expect(location(page, 'Saved title')).toHaveText('Saved place');
  await page.reload();
  await expect(location(page, 'Saved title')).toHaveText('Saved place');
});

test('blank location clears only location; blank task still deletes its row', async ({ page }) => {
  await addTodos(page, { title: 'Keep task', location: 'Office' }, { title: 'Other task', location: 'Park' });
  await page.getByRole('button', { name: 'Edit “Keep task”', exact: true }).click();
  const locationEditor = page.getByRole('textbox', { name: 'Edit location: Keep task', exact: true });
  await locationEditor.fill('   ');
  await locationEditor.press('Enter');
  await expect(titles(page)).toHaveText(['Keep task', 'Other task']);
  await expect(location(page, 'Keep task')).toHaveText('—');
  await expect(location(page, 'Keep task')).toHaveAttribute('aria-label', 'No location');
  await page.reload();
  await expect(location(page, 'Keep task')).toHaveText('—');
  await page.getByRole('button', { name: 'Edit “Other task”', exact: true }).click();
  await page.getByRole('textbox', { name: 'Edit todo: Other task', exact: true }).fill('   ');
  await page.getByRole('textbox', { name: 'Edit location: Other task', exact: true }).press('Enter');
  await expect(titles(page)).toHaveText(['Keep task']);
  await expect(count(page)).toHaveText('1 item left');
});

test('filters, hidden bulk actions, clearing, and title-only edits preserve each location', async ({ page }) => {
  await addTodos(page,
    { title: 'First', location: 'Office' },
    { title: 'Second', location: 'Park' },
    { title: 'Third', location: 'Home' });
  await todo(page, 'First').getByRole('checkbox').check();
  await filter(page, 'Completed');
  await expect(location(page, 'First')).toHaveText('Office');
  await page.getByRole('checkbox', { name: 'Mark all todos as complete', exact: true }).check();
  await expect(titles(page)).toHaveText(['First', 'Second', 'Third']);
  await expect(todoRows(page).locator('.todo-location')).toHaveText(['Office', 'Park', 'Home']);
  await filter(page, 'Active');
  await expect(todoRows(page)).toHaveCount(0);
  await page.getByRole('checkbox', { name: 'Mark all todos as active', exact: true }).uncheck();
  await expect(todoRows(page).locator('.todo-location')).toHaveText(['Office', 'Park', 'Home']);
  await page.getByRole('button', { name: 'Edit “Second”', exact: true }).click();
  const titleEditor = page.getByRole('textbox', { name: 'Edit todo: Second', exact: true });
  await titleEditor.fill('Renamed second');
  await titleEditor.press('Enter');
  await expect(location(page, 'Renamed second')).toHaveText('Park');
  await todo(page, 'First').getByRole('checkbox').click();
  await page.getByRole('button', { name: 'Clear completed', exact: true }).click();
  await filter(page, 'All');
  await expect(titles(page)).toHaveText(['Renamed second', 'Third']);
  await expect(todoRows(page).locator('.todo-location')).toHaveText(['Park', 'Home']);
  await page.reload();
  await expect(todoRows(page).locator('.todo-location')).toHaveText(['Park', 'Home']);
});

test('HTML-like locations remain literal on create, edit, and reload', async ({ page }) => {
  const literal = '<img src=x onerror="window.__locationXss=true">';
  const edited = '<svg onload="window.__locationXss=true"> & "quoted"';
  await addTodos(page, { title: 'Safe task', location: literal });
  await expect(location(page, 'Safe task')).toHaveText(literal);
  await expect(todoTable(page).locator('.todo-location img, .todo-location svg')).toHaveCount(0);
  await page.getByRole('button', { name: 'Edit “Safe task”', exact: true }).click();
  const locationEditor = page.getByRole('textbox', { name: 'Edit location: Safe task', exact: true });
  await locationEditor.fill(edited);
  await locationEditor.press('Enter');
  await page.reload();
  await expect(location(page, 'Safe task')).toHaveText(edited);
  await expect(todoTable(page).locator('.todo-location img, .todo-location svg')).toHaveCount(0);
  expect(await page.evaluate(() => window.__locationXss)).toBeUndefined();
});
