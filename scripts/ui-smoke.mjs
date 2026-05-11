import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const docsRoot = join(process.cwd(), 'docs');
const contentTypes = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

const server = createServer(async (request, response) => {
  try {
    const requestedPath = new URL(request.url, 'http://127.0.0.1').pathname;
    const safePath = normalize(requestedPath).replace(/^\.\.(?:\/|$)/, '');
    const filePath = join(docsRoot, safePath === '/' ? 'index.html' : safePath);
    response.setHeader('Content-Type', contentTypes[extname(filePath)] || 'application/octet-stream');
    response.end(await readFile(filePath));
  } catch (error) {
    response.statusCode = 404;
    response.end('Not found');
  }
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();

let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${port}/index.html`);

  assert.equal(await page.locator('#scenePanel').isVisible(), true, 'scene panel should be visible on load');
  assert.equal(await page.getAttribute('[data-tab="cafe"]', 'aria-selected'), 'true', 'cafe tab should be selected');

  await page.locator('[data-tab="cafe"]').focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.getAttribute('[data-tab="recipes"]', 'aria-selected'), 'true', 'arrow navigation should activate next tab');

  await page.keyboard.press('End');
  assert.equal(await page.getAttribute('[data-tab="journal"]', 'aria-selected'), 'true', 'End should jump to final tab');

  await page.keyboard.press('Home');
  assert.equal(await page.getAttribute('[data-tab="cafe"]', 'aria-selected'), 'true', 'Home should jump to first tab');

  await page.locator('[data-tab="recipes"]').click();
  assert.equal(await page.locator('#recipePanel .recipe-card').count(), 1, 'recipe tab should render recipe cards');

  await page.locator('[data-tab="journal"]').click();
  assert.equal(await page.locator('#journalPanel .journal-stat').count(), 4, 'journal tab should render state cards');

  await page.locator('[data-tab="worlds"]').click();
  assert.equal(await page.locator('#worldHud').isVisible(), true, 'world hud should be visible on worlds tab');
  assert.equal(await page.locator('#scenePanel').isVisible(), false, 'scene panel should be hidden on worlds tab');
  assert.equal(await page.getAttribute('[data-tab="worlds"]', 'tabindex'), '0', 'active tab should be keyboard-focusable');

  await page.reload();
  assert.equal(await page.getAttribute('[data-tab="worlds"]', 'aria-selected'), 'true', 'selected tab should persist after reload');

  await page.locator('#themeToggle').click();
  assert.equal(await page.getAttribute('#themeToggle', 'aria-pressed'), 'true', 'theme toggle should expose pressed state');

  console.log('UI smoke checks passed');
} finally {
  if (browser) {
    await browser.close();
  }
  await new Promise((resolve) => server.close(resolve));
}
