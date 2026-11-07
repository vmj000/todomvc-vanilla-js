import { test, expect, addTodos, newTodo, titles, todo } from './fixtures.js';

for (const width of [320, 1280]) {
  test(`${width}px layout wraps long titles and keeps controls and editor in bounds`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const longTitle = `Long todo ${'unbroken'.repeat(40)} and a few more words`;
    await addTodos(page, longTitle, 'Short title');
    const row = todo(page, longTitle);
    if (width > 560) await row.hover();
    const edit = row.getByRole('button', { name: `Edit “${longTitle}”`, exact: true });
    const remove = row.getByRole('button', { name: `Delete “${longTitle}”`, exact: true });
    await expect(edit).toBeVisible();
    await expect(remove).toBeVisible();
    await expect(row.locator('.row-actions')).toHaveCSS('opacity', '1');
    for (const control of [row.getByRole('checkbox'), edit, remove]) {
      const box = await control.boundingBox();
      expect(box).not.toBeNull();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const titleBox = await row.locator('.todo-title').boundingBox();
    expect(titleBox.height).toBeGreaterThan(60);
    await edit.click();
    const editor = page.getByRole('textbox', { name: `Edit todo: ${longTitle}`, exact: true });
    await expect(editor).toBeFocused();
    const editorBox = await editor.boundingBox();
    expect(editorBox.x + editorBox.width).toBeLessThanOrEqual(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await editor.fill('Updated on a small screen');
    await editor.press('Enter');
    await expect(titles(page)).toHaveText(['Updated on a small screen', 'Short title']);
    await page.getByRole('button', { name: 'Delete “Updated on a small screen”', exact: true }).click();
    await expect(titles(page)).toHaveText(['Short title']);
    await expect(newTodo(page)).toBeVisible();
  });
}
