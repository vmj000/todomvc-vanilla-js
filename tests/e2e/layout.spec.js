import { test, expect, addTodos, location, newLocation, newTodo, titles, todo, todoTable } from './fixtures.js';

async function expectReachable(page, control, width) {
  await control.scrollIntoViewIfNeeded();
  await expect(control).toBeVisible();
  const box = await control.boundingBox();
  expect(box).not.toBeNull();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(width);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
}

for (const width of [320, 1280]) {
  test(`${width}px table contains long text and keeps scrolled controls and editors reachable`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const longTitle = `Long todo ${'unbroken'.repeat(40)} and a few more words`;
    const longLocation = `Long place ${'location'.repeat(40)} and a few more words`;
    await addTodos(page, { title: longTitle, location: longLocation }, 'Short title');
    const scrollRegion = page.locator('.table-scroll');
    await expect(todoTable(page)).toBeVisible();
    await expect(scrollRegion).toHaveAttribute('tabindex', '0');
    const dimensions = await scrollRegion.evaluate(element => ({
      width: element.clientWidth,
      scrollWidth: element.scrollWidth,
      overflowX: getComputedStyle(element).overflowX,
    }));
    expect(['auto', 'scroll']).toContain(dimensions.overflowX);
    if (width === 320) expect(dimensions.scrollWidth).toBeGreaterThan(dimensions.width);
    await expectReachable(page, newLocation(page), width);
    const row = todo(page, longTitle);
    if (width > 560) await row.hover();
    const edit = row.getByRole('button', { name: `Edit “${longTitle}”`, exact: true });
    const remove = row.getByRole('button', { name: `Delete “${longTitle}”`, exact: true });
    await expect(edit).toBeVisible();
    await expect(remove).toBeVisible();
    await expect(row.locator('.row-actions')).toHaveCSS('opacity', '1');
    for (const control of [row.getByRole('checkbox'), edit, remove]) {
      await expectReachable(page, control, width);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const titleBox = await row.locator('.todo-title').boundingBox();
    expect(titleBox.height).toBeGreaterThan(60);
    const locationBox = await location(page, longTitle).boundingBox();
    expect(locationBox.height).toBeGreaterThan(60);
    await edit.click();
    const editor = page.getByRole('textbox', { name: `Edit todo: ${longTitle}`, exact: true });
    await expect(editor).toBeFocused();
    const locationEditor = page.getByRole('textbox', { name: `Edit location: ${longTitle}`, exact: true });
    for (const control of [
      editor, locationEditor,
      page.getByRole('button', { name: `Save “${longTitle}”`, exact: true }),
      page.getByRole('button', { name: `Cancel editing “${longTitle}”`, exact: true }),
    ]) await expectReachable(page, control, width);
    await editor.fill('Updated on a small screen');
    await locationEditor.fill('Updated location');
    await editor.press('Enter');
    await expect(titles(page)).toHaveText(['Updated on a small screen', 'Short title']);
    await expect(location(page, 'Updated on a small screen')).toHaveText('Updated location');
    await page.getByRole('button', { name: 'Delete “Updated on a small screen”', exact: true }).click();
    await expect(titles(page)).toHaveText(['Short title']);
    await expect(newTodo(page)).toBeVisible();
  });
}
