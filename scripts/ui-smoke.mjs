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

const viewportSizes = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'laptop', width: 1366, height: 768 },
  { name: 'desktop', width: 1920, height: 1080 },
];

const primaryControlSelectors = [
  '#themeToggle',
  '#startBtn',
  '#continueBtn',
  '#resetBtn',
  '[data-tab="cafe"]',
  '[data-tab="recipes"]',
  '[data-tab="worlds"]',
  '[data-tab="journal"]',
];

const tabPanelSelectors = {
  cafe: '#scenePanel',
  recipes: '#recipePanel',
  worlds: '#worldHud',
  journal: '#journalPanel',
};

function describeViewport(viewport) {
  return `${viewport.name} ${viewport.width}x${viewport.height}`;
}

async function assertElementFullyVisibleInViewport(page, selector, message) {
  const box = await page.locator(selector).boundingBox();
  assert.ok(box, message);
  const viewport = page.viewportSize();
  assert.ok(viewport, 'viewport should be configured');
  assert.ok(box.width > 0, `${message}: expected a positive width`);
  assert.ok(box.height > 0, `${message}: expected a positive height`);
  assert.ok(box.x >= 0, `${message}: expected left edge in viewport`);
  assert.ok(box.y >= 0, `${message}: expected top edge in viewport`);
  assert.ok(box.x + box.width <= viewport.width, `${message}: expected right edge in viewport`);
  assert.ok(box.y + box.height <= viewport.height, `${message}: expected bottom edge in viewport`);
}

async function assertActivePanelUsable(page, tabName, viewportName) {
  const tabSelector = `[data-tab="${tabName}"]`;
  const panelSelector = tabPanelSelectors[tabName];

  await page.locator(tabSelector).click();
  assert.equal(
    await page.getAttribute(tabSelector, 'aria-selected'),
    'true',
    `${viewportName}: ${tabName} tab should become active`,
  );
  assert.equal(await page.locator(panelSelector).isVisible(), true, `${viewportName}: ${tabName} panel should be visible`);
  await page.locator(panelSelector).scrollIntoViewIfNeeded();

  const panelUsability = await page.locator(panelSelector).evaluate((panel) => {
    const rect = panel.getBoundingClientRect();
    const styles = window.getComputedStyle(panel);

    return {
      allowsInteraction: styles.pointerEvents !== 'none' && styles.visibility !== 'hidden',
      hasUsableArea: rect.width >= 1 && rect.height >= 1,
      isReachable: rect.bottom > 0 && rect.right > 0 && rect.top < window.innerHeight && rect.left < window.innerWidth,
    };
  });

  assert.equal(panelUsability.allowsInteraction, true, `${viewportName}: ${tabName} panel should allow interaction`);
  assert.equal(panelUsability.hasUsableArea, true, `${viewportName}: ${tabName} panel should have usable area`);
  assert.equal(panelUsability.isReachable, true, `${viewportName}: ${tabName} panel should be reachable in the viewport`);
}

async function assertFullscreenLayout(page, viewport) {
  const viewportName = describeViewport(viewport);

  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.goto(`http://127.0.0.1:${port}/index.html`);
  await page.locator('#app').waitFor();

  const appBox = await page.locator('#app').boundingBox();
  assert.ok(appBox, `${viewportName}: #app should have a bounding box`);
  assert.equal(Math.round(appBox.width), viewport.width, `${viewportName}: #app width should equal viewport width`);
  assert.equal(Math.round(appBox.height), viewport.height, `${viewportName}: #app height should equal viewport height`);

  const overflow = await page.evaluate(() => ({
    documentClientWidth: document.documentElement.clientWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  assert.ok(
    overflow.documentScrollWidth <= overflow.documentClientWidth,
    `${viewportName}: document should not overflow horizontally`,
  );
  assert.ok(
    overflow.bodyScrollWidth <= overflow.viewportWidth,
    `${viewportName}: body should not overflow horizontally`,
  );

  for (const selector of primaryControlSelectors) {
    await assertElementFullyVisibleInViewport(page, selector, `${viewportName}: ${selector} should remain visible`);
  }

  for (const tabName of Object.keys(tabPanelSelectors)) {
    await assertActivePanelUsable(page, tabName, viewportName);
  }
}

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

  for (const viewport of viewportSizes) {
    const viewportPage = await browser.newPage();
    try {
      await assertFullscreenLayout(viewportPage, viewport);
    } finally {
      await viewportPage.close();
    }
  }

  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  await page.goto(`http://127.0.0.1:${port}/index.html`);

  assert.equal(await page.locator('#scenePanel').isVisible(), true, 'scene panel should be visible on load');
  assert.equal(await page.getAttribute('[data-tab="cafe"]', 'aria-selected'), 'true', 'cafe tab should be selected');
  assert.match(
    await page.getAttribute('#sceneCharacterAsset', 'src'),
    /\/static\/img\/assets\/characters\/cleric\/warm\.png$/,
    'keeper portrait should use the configured character asset folder',
  );

  await page.locator('.choice', { hasText: 'Begin shift' }).click();
  assert.match(
    await page.getAttribute('#sceneCharacterAsset', 'src'),
    /\/static\/img\/assets\/characters\/trader\/determined\.png$/,
    'player portrait should use the configured character asset folder after scene changes',
  );

  await page.locator('[data-tab="cafe"]').focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.getAttribute('[data-tab="recipes"]', 'aria-selected'), 'true', 'arrow navigation should activate next tab');

  await page.keyboard.press('End');
  assert.equal(await page.getAttribute('[data-tab="journal"]', 'aria-selected'), 'true', 'End should jump to final tab');

  await page.keyboard.press('Home');
  assert.equal(await page.getAttribute('[data-tab="cafe"]', 'aria-selected'), 'true', 'Home should jump to first tab');

  await page.locator('[data-tab="recipes"]').click();
  assert.equal(await page.locator('#recipePanel .recipe-card').count(), 2, 'recipe tab should render recipe cards');

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
