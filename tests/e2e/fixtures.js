import { test as base, expect } from '@playwright/test';

export const test = base.extend({
  browserErrors: [async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', error => errors.push(`Uncaught: ${error.message}`));
    page.on('console', message => {
      if (message.type() === 'error') errors.push(`Console: ${message.text()}`);
    });
    page.on('requestfailed', request => {
      errors.push(`Request: ${request.method()} ${request.url()} ${request.failure()?.errorText}`);
    });
    page.on('response', response => {
      if (response.status() >= 400) errors.push(`HTTP ${response.status()}: ${response.url()}`);
    });
    page.on('dialog', async dialog => {
      errors.push(`Unexpected ${dialog.type()}: ${dialog.message()}`);
      await dialog.dismiss();
    });
    await use(errors);
    expect(errors, 'No browser errors, failed requests, or unexpected dialogs').toEqual([]);
  }, { auto: true }],
});

export { expect };
export const newTodo = page => page.getByRole('textbox', { name: 'What needs to be done?', exact: true });
export const newLocation = page => page.getByRole('textbox', { name: 'Location (optional)', exact: true });
export const search = page => page.getByRole('searchbox', { name: 'Search todos', exact: true });
export const todoTable = page => page.getByRole('table', { name: 'Todo list', exact: true });
export const todoRows = page => todoTable(page).getByRole('row').filter({
  has: page.locator('.todo-title'),
});
export const titles = page => todoRows(page).locator('.todo-title');
export const todo = (page, title) => todoRows(page).filter({
  has: page.locator('.todo-title').and(page.getByText(title, { exact: true })),
});
export const location = (page, title) => todo(page, title).locator('.todo-location');
export const count = page => page.getByRole('status').filter({ hasText: /^\d+ items? left$/ });
export const notice = page => page.getByRole('status').filter({ hasText: /could not|may not survive/ });

export async function addTodos(page, ...values) {
  for (const value of values) {
    const { title, location = '' } = typeof value === 'string' ? { title: value } : value;
    await newTodo(page).fill(title);
    await newLocation(page).fill(location);
    await newTodo(page).press('Enter');
  }
}

export async function filter(page, name) {
  const link = page.getByRole('link', { name, exact: true });
  await link.click();
  await expect(link).toHaveAttribute('aria-current', 'page');
}
