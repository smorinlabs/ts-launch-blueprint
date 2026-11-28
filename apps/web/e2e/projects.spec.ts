import { expect, test } from '@playwright/test';

test.describe('projects web E2E', () => {
  test('loads initial 4 projects table from live API', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible();
    await expect(page.getByText('4 projects')).toBeVisible();

    const table = page.getByRole('table', { name: 'Projects' });
    await expect(table).toBeVisible();
    await expect(table.getByRole('columnheader')).toHaveText(['Project', 'Workspace']);

    for (const name of ['API Platform', 'Mobile App', 'Website Redesign', 'Launch Campaign']) {
      await expect(table.getByRole('cell', { name })).toBeVisible();
    }
  });

  test('filters by workspace and preserves filter across page.reload()', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('4 projects')).toBeVisible();

    const input = page.getByLabel('Workspace');
    await input.fill('engineering');
    await input.press('Enter');

    await expect(page.getByText('2 projects')).toBeVisible();
    await expect(page).toHaveURL(/\?workspace=engineering$/);

    const table = page.getByRole('table', { name: 'Projects' });
    await expect(table.getByRole('cell', { name: 'API Platform' })).toBeVisible();
    await expect(table.getByRole('cell', { name: 'Mobile App' })).toBeVisible();
    await expect(table.getByRole('cell', { name: 'Website Redesign' })).toBeHidden();

    await page.reload();

    await expect(page.getByText('2 projects')).toBeVisible();
    await expect(page.getByLabel('Workspace')).toHaveValue('engineering');
    await expect(table.getByRole('cell', { name: 'API Platform' })).toBeVisible();
    await expect(table.getByRole('cell', { name: 'Mobile App' })).toBeVisible();
  });

  test('shows 404 alert for unknown workspace and resets on Clear filter', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('4 projects')).toBeVisible();

    const input = page.getByLabel('Workspace');
    await input.fill('nope');
    await input.press('Enter');

    const alert = page.getByRole('alert');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText('Workspace not found: nope');
    await expect(alert.getByRole('button', { name: 'Try again' })).toBeHidden();

    await alert.getByRole('button', { name: 'Clear filter' }).click();

    await expect(page.getByText('4 projects')).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByLabel('Workspace')).toHaveValue('');
  });

  test('supports keyboard-only navigation and filtering', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('4 projects')).toBeVisible();

    const input = page.getByLabel('Workspace');
    await page.keyboard.press('Tab');
    await expect(input).toBeFocused();

    await page.keyboard.type('marketing');
    await page.keyboard.press('Enter');

    await expect(page.getByText('2 projects')).toBeVisible();
    const table = page.getByRole('table', { name: 'Projects' });
    await expect(table.getByRole('cell', { name: 'Website Redesign' })).toBeVisible();
    await expect(table.getByRole('cell', { name: 'Launch Campaign' })).toBeVisible();
    await expect(input).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Apply' })).toBeFocused();
  });
});
