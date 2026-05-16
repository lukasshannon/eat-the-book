import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const docsRoot = join(process.cwd(), 'docs');
const storageKey = 'eat-the-book-vertical-slice-v1';
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
  { name: 'small-responsive-edge', width: 621, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'wide-responsive-edge', width: 980, height: 900 },
  { name: 'laptop', width: 1366, height: 768 },
  { name: 'desktop', width: 1920, height: 1080 },
];

const coverControlSelectors = ['#startBtn', '#continueBtn', '#coverSettingsBtn'];

const primaryTabSelectors = [
  '[data-tab="cafe"]',
  '[data-tab="recipes"]',
  '[data-tab="worlds"]',
  '[data-tab="characters"]',
  '[data-tab="journal"]',
  '[data-tab="settings"]',
];

const tabPanelSelectors = {
  cafe: '#scenePanel',
  recipes: '#recipePanel',
  worlds: '#worldHud',
  characters: '#charactersPanel',
  journal: '#journalPanel',
  settings: '#settingsPanel',
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

async function waitForNextPageTurn(page, trigger) {
  await page.evaluate(() => {
    window.__nextPageTurn = new Promise((resolve) => {
      const bookPages = document.querySelector('#bookPages');
      if (!bookPages) {
        resolve(false);
        return;
      }

      const timeout = window.setTimeout(() => {
        observer.disconnect();
        resolve(false);
      }, 1000);
      const observer = new MutationObserver(() => {
        if (bookPages.classList.contains('page-turning')) {
          window.clearTimeout(timeout);
          observer.disconnect();
          resolve(true);
        }
      });
      observer.observe(bookPages, { attributes: true, attributeFilter: ['class'] });
    });
  });

  await trigger();
  assert.equal(await page.evaluate(() => window.__nextPageTurn), true, 'tab change should start a page-turn animation');
}

async function assertTabLabelsStayOnOneLine(page, viewportName) {
  const wrappedLabels = await page.locator('.side-tabs .tab-btn').evaluateAll((buttons) =>
    buttons
      .filter((button) => button.scrollWidth > button.clientWidth || button.scrollHeight > button.clientHeight)
      .map((button) => button.textContent.trim()),
  );

  assert.deepEqual(wrappedLabels, [], `${viewportName}: tab labels should fit without wrapping or clipping`);
}

async function assertElementsDoNotOverlap(page, firstSelector, secondSelector, message) {
  const overlap = await page.evaluate(
    ([first, second]) => {
      const firstRect = document.querySelector(first)?.getBoundingClientRect();
      const secondRect = document.querySelector(second)?.getBoundingClientRect();
      if (!firstRect || !secondRect) return true;

      return !(
        firstRect.right <= secondRect.left ||
        firstRect.left >= secondRect.right ||
        firstRect.bottom <= secondRect.top ||
        firstRect.top >= secondRect.bottom
      );
    },
    [firstSelector, secondSelector],
  );

  assert.equal(overlap, false, message);
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

async function assertMalformedSaveFallsBack(browser, persistedValue, expectedState, message, directExpectedState = expectedState) {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  try {
    await page.addInitScript(
      ({ key, value }) => {
        localStorage.setItem(key, value);
      },
      { key: storageKey, value: persistedValue },
    );
    await page.goto(`http://127.0.0.1:${port}/index.html`);
    await page.locator('#app').waitFor();

    const state = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), storageKey);
    for (const [key, value] of Object.entries(expectedState)) {
      assert.deepEqual(state[key], value, `${message}: ${key} should fall back to a safe value`);
    }

    const directLoad = await page.evaluate(
      async ({ key, value }) => {
        localStorage.setItem(key, value);
        const { loadState } = await import('/static/js/game-state.js');
        let corruptCalls = 0;
        const loadedState = loadState({ onCorrupt: () => { corruptCalls += 1; } });
        return { corruptCalls, loadedState };
      },
      { key: storageKey, value: persistedValue },
    );
    assert.equal(directLoad.corruptCalls, 1, `${message}: onCorrupt should run when a field falls back`);
    for (const [key, value] of Object.entries(directExpectedState)) {
      assert.deepEqual(directLoad.loadedState[key], value, `${message}: direct load ${key} should fall back safely`);
    }
  } finally {
    await page.close();
  }
}

async function assertFullscreenLayout(page, viewport) {
  const viewportName = describeViewport(viewport);

  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.goto(`http://127.0.0.1:${port}/index.html`);
  await page.locator('#app').waitFor();
  await page.evaluate((key) => localStorage.removeItem(key), storageKey);
  await page.reload();
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

  for (const selector of coverControlSelectors) {
    await assertElementFullyVisibleInViewport(page, selector, `${viewportName}: cover control ${selector} should remain visible`);
  }

  assert.equal(await page.locator('#bookCover').isVisible(), true, `${viewportName}: book cover should be the first page`);
  await page.locator('#startBtn').click();
  await page.waitForTimeout(380);

  for (const selector of primaryTabSelectors) {
    await assertElementFullyVisibleInViewport(page, selector, `${viewportName}: tab ${selector} should remain visible`);
  }

  await assertTabLabelsStayOnOneLine(page, viewportName);

  if (viewport.width <= 620) {
    await assertElementFullyVisibleInViewport(page, '.mobile-intro summary', `${viewportName}: mobile intro control should remain visible`);
    await assertElementsDoNotOverlap(
      page,
      '.mobile-intro summary',
      '.top-status',
      `${viewportName}: mobile intro control should not cover the top status bar`,
    );
    assert.equal(await page.locator('.desk-intro').isVisible(), false, `${viewportName}: full intro banner should collapse on mobile`);
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

  const malformedSaveCases = [
    {
      name: 'null save root',
      persistedValue: 'null',
      expectedState: { current: 'cafe_intro', activeTab: 'cafe', inventory: [], recipeBook: ['orchard-threshold-tart'] },
    },
    {
      name: 'null visited map',
      persistedValue: '{"visited":null}',
      expectedState: { visited: { cafe_intro: true } },
      directExpectedState: { visited: {} },
    },
    {
      name: 'string inventory',
      persistedValue: '{"inventory":"bad"}',
      expectedState: { inventory: [] },
    },
    {
      name: 'unknown active tab',
      persistedValue: '{"activeTab":"bad"}',
      expectedState: { activeTab: 'cafe' },
    },
  ];

  for (const saveCase of malformedSaveCases) {
    await assertMalformedSaveFallsBack(
      browser,
      saveCase.persistedValue,
      saveCase.expectedState,
      saveCase.name,
      saveCase.directExpectedState,
    );
  }

  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  await page.goto(`http://127.0.0.1:${port}/index.html`);
  await page.evaluate((key) => localStorage.removeItem(key), storageKey);
  await page.reload();
  assert.equal(await page.locator('#bookCover').isVisible(), true, 'book cover should be visible on first load');
  await page.locator('#startBtn').click();
  await page.waitForTimeout(380);

  assert.equal(await page.locator('#scenePanel').isVisible(), true, 'scene panel should be visible after starting');
  assert.equal(await page.getAttribute('[data-tab="cafe"]', 'aria-selected'), 'true', 'cafe tab should be selected');
  assert.match(
    await page.locator('#scenePanel').textContent(),
    /The café is outside time/,
    'cafe tab should render the JSON dialogue sample',
  );
  assert.match(
    await page.getAttribute('#sceneCharacterAsset', 'src'),
    /\/static\/img\/assets\/characters\/healer\/vulnerable\.png$/,
    'orchard ghost child portrait should use the configured character asset folder',
  );

  await page.locator('.choice', { hasText: 'Ask how recipes open portals' }).click();
  assert.match(
    await page.getAttribute('#sceneCharacterAsset', 'src'),
    /\/static\/img\/assets\/characters\/cleric\/determined\.png$/,
    'recipe sample should use the configured character asset folder after a JSON branch',
  );

  await page.locator('[data-tab="cafe"]').focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.getAttribute('[data-tab="recipes"]', 'aria-selected'), 'true', 'arrow navigation should activate next tab');

  await page.keyboard.press('End');
  assert.equal(await page.getAttribute('[data-tab="settings"]', 'aria-selected'), 'true', 'End should jump to final tab');

  await page.keyboard.press('Home');
  assert.equal(await page.getAttribute('[data-tab="cafe"]', 'aria-selected'), 'true', 'Home should jump to first tab');

  await waitForNextPageTurn(page, () => page.locator('[data-tab="recipes"]').click());
  assert.ok(await page.locator('#recipePanel .recipe-card').count() >= 1, 'recipe tab should render recipe cards');
  assert.match(
    await page.locator('#recipePanel').textContent(),
    /A discovered Recipe Book card/,
    'recipe tab should render recipe metadata from JSON',
  );

  await page.locator('[data-tab="characters"]').click();
  assert.ok(await page.locator('#charactersPanel .journal-stat').count() >= 1, 'characters tab should render character cards');
  assert.match(
    await page.locator('#charactersPanel').textContent(),
    /Keeps the café outside time/,
    'characters tab should render character sample data from JSON',
  );

  await page.locator('[data-tab="journal"]').click();
  assert.equal(await page.locator('#journalPanel .journal-stat').count(), 4, 'journal tab should render state cards');

  await page.locator('[data-tab="worlds"]').click();
  assert.equal(await page.locator('#worldHud').isVisible(), true, 'world hud should be visible on worlds tab');
  assert.equal(await page.locator('#scenePanel').isVisible(), false, 'scene panel should be hidden on worlds tab');
  assert.equal(await page.getAttribute('[data-tab="worlds"]', 'tabindex'), '0', 'active tab should be keyboard-focusable');

  await page.reload();
  assert.equal(await page.getAttribute('[data-tab="worlds"]', 'aria-selected'), 'true', 'selected tab should persist after reload');

  await page.locator('[data-tab="settings"]').click();
  await page.locator('#themeToggle').click();
  assert.equal(await page.getAttribute('#themeToggle', 'aria-pressed'), 'true', 'theme toggle should expose pressed state');

  await page.goto(`http://127.0.0.1:${port}/book.html`);
  await page.evaluate(() => customElements.whenDefined('page-turn-book'));
  await page.locator('page-turn-book').waitFor();
  assert.equal(await page.locator('page-turn-book .status').textContent(), 'Cover closed', 'book demo should initialize the custom element');
  await page.locator('page-turn-book .next').click();
  assert.equal(await page.locator('page-turn-book .status').textContent(), 'Page 1 of 4', 'book demo should turn to the first page');
  await page.locator('page-turn-book .book').focus();
  await page.keyboard.press('End');
  assert.equal(await page.locator('page-turn-book .status').textContent(), 'Page 4 of 4', 'book demo should support keyboard navigation');

  console.log('UI smoke checks passed');
} finally {
  if (browser) {
    await browser.close();
  }
  await new Promise((resolve) => server.close(resolve));
}
