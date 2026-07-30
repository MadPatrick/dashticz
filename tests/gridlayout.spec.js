// @ts-check
import { test, expect } from '@playwright/test';

const dashboardUrl =
  (process.env.DASHTICZ_TEST_URL || 'http://build:8082') +
  '/?cfg=CONFIG.pw.js&folder=tests';

test.describe('optional screen grid layout', () => {
  test('keeps legacy column screens on the Bootstrap path', async ({ page }) => {
    await page.goto(dashboardUrl);

    await expect(page.locator('.screen1 .row .col1')).toBeVisible();
    await expect(page.locator('.screen1 .dt-grid-layout')).toHaveCount(0);
  });

  test('places blocks at explicit coordinates and stacks on mobile', async ({
    page,
  }) => {
    await page.route('**/tests/CONFIG.pw.js*', async (route) => {
      const response = await route.fetch();
      const source = await response.text();
      await route.fulfill({
        response,
        body:
          source +
          `
blocks['tc1'].grid = {x: 1, y: 1, w: 6, h: 3};
blocks['tc2'].grid = {x: 10, y: 1, w: 5, h: 6};
blocks['tc4'].grid = {x: 3, y: 9, w: 8, h: 3};
screens[1] = {
  layout: 'grid',
  gridColumns: 24,
  rowHeight: 40,
  gap: 5,
  mobileLayout: 'stack',
  blocks: ['tc1', 'tc2', 'tc4']
};
`,
      });
    });

    await page.goto(dashboardUrl);

    const grid = page.locator('.screen1 > .dt-grid-layout');
    const first = grid.locator('[data-grid-block="tc1"]');
    const second = grid.locator('[data-grid-block="tc2"]');
    const third = grid.locator('[data-grid-block="tc4"]');

    await expect(grid).toHaveCSS('display', 'grid');
    await expect(first).toHaveCSS('grid-column-start', '1');
    await expect(first).toHaveCSS('grid-row-start', '1');
    await expect(second).toHaveCSS('grid-column-start', '10');
    await expect(second).toHaveCSS('grid-row-end', 'span 6');
    await expect(third).toHaveCSS('grid-column-start', '3');
    await expect(third).toHaveCSS('grid-row-start', '9');

    const desktopBoxes = await Promise.all([
      first.boundingBox(),
      second.boundingBox(),
      third.boundingBox(),
    ]);
    expect(desktopBoxes.every(Boolean)).toBe(true);
    expect(desktopBoxes[0].x).toBeLessThan(desktopBoxes[1].x);
    expect(desktopBoxes[2].y).toBeGreaterThan(
      desktopBoxes[1].y + desktopBoxes[1].height
    );

    await page.setViewportSize({ width: 500, height: 900 });
    await expect(grid).toHaveCSS('display', 'flex');

    const mobileBoxes = await Promise.all([
      first.boundingBox(),
      second.boundingBox(),
      third.boundingBox(),
    ]);
    expect(mobileBoxes.every(Boolean)).toBe(true);
    expect(Math.abs(mobileBoxes[0].width - mobileBoxes[1].width)).toBeLessThan(
      1
    );
    expect(mobileBoxes[0].y).toBeLessThan(mobileBoxes[1].y);
    expect(mobileBoxes[1].y).toBeLessThan(mobileBoxes[2].y);
  });
});
