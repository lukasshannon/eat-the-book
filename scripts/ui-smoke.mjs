import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const docsRoot = join(process.cwd(), 'docs');
const artifactRoot = join(process.cwd(), 'tmp', 'ui-smoke');
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


function rectsOverlap(first, second) {
  return !(
    first.right <= second.left ||
    first.left >= second.right ||
    first.bottom <= second.top ||
    first.top >= second.bottom
  );
}

function intersectionArea(first, second) {
  const width = Math.max(0, Math.min(first.right, second.right) - Math.max(first.left, second.left));
  const height = Math.max(0, Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top));
  return width * height;
}

async function getRect(page, selector) {
  return page.locator(selector).evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    };
  });
}

async function captureFailureArtifacts(page, name, error) {
  await mkdir(artifactRoot, { recursive: true });
  const safeName = name.replace(/[^a-z0-9-]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'ui-smoke';
  const screenshotPath = join(artifactRoot, `${safeName}.png`);
  const jsonPath = join(artifactRoot, `${safeName}.json`);
  const selectors = [
    '#app',
    '#notebookShell',
    '#bookPages',
    '#tabBar',
    '.top-status',
    '.scene-visual',
    '#scenePanel',
    '#recipePanel',
    '#worldHud',
    '.mobile-intro summary',
    '.dialogue-return',
    '.scene-debug',
    '.choices',
  ];
  const diagnostics = await page.evaluate((diagnosticSelectors) => {
    const rects = Object.fromEntries(
      diagnosticSelectors.map((selector) => {
        const element = document.querySelector(selector);
        if (!element) return [selector, null];
        const rect = element.getBoundingClientRect();
        return [selector, {
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          left: rect.left,
          width: rect.width,
          height: rect.height,
          visible: window.getComputedStyle(element).visibility !== 'hidden',
        }];
      }),
    );

    return {
      error: String(window.__uiSmokeFailureMessage || ''),
      viewport: { width: window.innerWidth, height: window.innerHeight },
      overflow: {
        documentClientWidth: document.documentElement.clientWidth,
        documentScrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
      },
      rects,
    };
  }, selectors);
  diagnostics.error = error?.stack || error?.message || String(error);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await writeFile(jsonPath, `${JSON.stringify(diagnostics, null, 2)}\n`);
  console.error(`Saved UI smoke failure artifacts: ${screenshotPath} and ${jsonPath}`);
}

async function withFailureArtifacts(page, name, task) {
  try {
    await task();
  } catch (error) {
    await page.evaluate((message) => { window.__uiSmokeFailureMessage = message; }, error?.message || String(error)).catch(() => {});
    await captureFailureArtifacts(page, name, error).catch((artifactError) => {
      console.error(`Unable to save UI smoke failure artifacts: ${artifactError.message}`);
    });
    throw error;
  }
}

async function assertNoHorizontalOverflow(page, message) {
  const overflow = await page.evaluate(() => ({
    documentClientWidth: document.documentElement.clientWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  assert.ok(
    overflow.documentScrollWidth <= overflow.documentClientWidth,
    `${message}: document should not overflow horizontally (${JSON.stringify(overflow)})`,
  );
  assert.ok(
    overflow.bodyScrollWidth <= overflow.viewportWidth,
    `${message}: body should not overflow horizontally (${JSON.stringify(overflow)})`,
  );
}

async function assertElementContainedIn(page, childSelector, parentSelector, message, tolerance = 2) {
  const child = await getRect(page, childSelector);
  const parent = await getRect(page, parentSelector);
  assert.ok(child.width > 0 && child.height > 0, `${message}: child should have area`);
  assert.ok(parent.width > 0 && parent.height > 0, `${message}: parent should have area`);
  assert.ok(child.left >= parent.left - tolerance, `${message}: child left should stay inside parent`);
  assert.ok(child.top >= parent.top - tolerance, `${message}: child top should stay inside parent`);
  assert.ok(child.right <= parent.right + tolerance, `${message}: child right should stay inside parent`);
  assert.ok(child.bottom <= parent.bottom + tolerance, `${message}: child bottom should stay inside parent`);
}

async function assertElementDoesNotOverflowSelf(page, selector, message) {
  const overflow = await page.locator(selector).evaluate((element) => ({
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight,
  }));
  assert.ok(overflow.scrollWidth <= overflow.clientWidth + 1, `${message}: should not overflow horizontally (${JSON.stringify(overflow)})`);
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


async function assertMajorLayoutAlignment(page, viewport) {
  const viewportName = describeViewport(viewport);
  await assertElementFullyVisibleInViewport(page, '#notebookShell', `${viewportName}: notebook shell should stay fully in viewport`);
  await assertElementFullyVisibleInViewport(page, '#tabBar', `${viewportName}: right-side tabs should stay fully in viewport`);
  await assertElementContainedIn(page, '#bookPages', '#notebookShell', `${viewportName}: book pages should stay inside notebook shell`, 8);
  await assertElementContainedIn(page, '.top-status', '#notebookShell', `${viewportName}: top status should stay inside notebook shell`, 8);

  const tabBar = await getRect(page, '#tabBar');
  const bookPages = await getRect(page, '#bookPages');
  const tabOverlapArea = intersectionArea(tabBar, bookPages);
  const tabArea = tabBar.width * tabBar.height;
  assert.ok(tabOverlapArea < tabArea * 0.55, `${viewportName}: side tabs should not cover the readable page area`);

  await page.locator('[data-tab="cafe"]').click();
  await assertElementContainedIn(page, '#scenePanel', '#notebookShell', `${viewportName}: dialogue panel should stay inside notebook shell`, 10);
  await assertElementContainedIn(page, '.scene-visual', '#notebookShell', `${viewportName}: scene visual should stay inside notebook shell`, 10);
  await assertElementDoesNotOverflowSelf(page, '#scenePanel', `${viewportName}: dialogue panel`);

  await page.locator('[data-tab="recipes"]').click();
  await page.locator('#recipePanel .recipe-card:first-child').scrollIntoViewIfNeeded();
  await assertElementContainedIn(page, '#recipePanel', '#notebookShell', `${viewportName}: recipes panel should stay inside notebook shell`, 12);
  await assertElementContainedIn(page, '#recipePanel .recipe-card:first-child', '#recipePanel', `${viewportName}: recipe card should stay inside recipe panel`, 3);
  assert.equal(
    rectsOverlap(await getRect(page, '#recipePanel .recipe-card:first-child'), await getRect(page, '#tabBar')),
    false,
    `${viewportName}: recipe card should not overlap right-side tabs`,
  );

  await page.locator('[data-tab="worlds"]').click();
  await page.locator('#worldList .world-entry:first-child').scrollIntoViewIfNeeded();
  await assertElementContainedIn(page, '#worldHud', '#notebookShell', `${viewportName}: worlds panel should stay inside notebook shell`, 12);
  await assertElementContainedIn(page, '#worldList .world-entry:first-child', '#worldHud', `${viewportName}: world entry should stay inside worlds panel`, 3);
  assert.equal(
    rectsOverlap(await getRect(page, '#worldList .world-entry:first-child'), await getRect(page, '#tabBar')),
    false,
    `${viewportName}: world entry should not overlap right-side tabs`,
  );

  if (viewport.width <= 620) {
    await assertElementsDoNotOverlap(
      page,
      '.mobile-intro summary',
      '#tabBar',
      `${viewportName}: mobile intro control should not overlap right-side tabs`,
    );
    await assertElementsDoNotOverlap(
      page,
      '.mobile-intro summary',
      '#scenePanel',
      `${viewportName}: mobile intro control should not overlap dialogue`,
    );
  }
}

async function assertDialogueControlsFit(page, viewport) {
  const viewportName = describeViewport(viewport);
  await page.locator('[data-tab="cafe"]').click();
  const branchLabels = ['Ask how recipes open portals', 'Ask about branching routes'];

  for (const branchLabel of branchLabels) {
    await page.locator('.choice', { hasText: branchLabel }).click();
    await page.locator('[data-dialogue-return]').waitFor();
    await assertElementContainedIn(page, '[data-dialogue-return]', '#scenePanel', `${viewportName}: dialogue return should stay inside scene panel`);
    await assertElementContainedIn(page, '.scene-debug', '#scenePanel', `${viewportName}: scene details should stay inside scene panel`);
    await assertElementDoesNotOverflowSelf(page, '#scenePanel', `${viewportName}: scene panel after ${branchLabel}`);

    await page.locator('.scene-debug summary').click();
    await assertElementContainedIn(page, '.scene-debug', '#scenePanel', `${viewportName}: expanded scene details should stay inside scene panel`, 4);
    await assertElementContainedIn(page, '.dialogue-text', '#scenePanel', `${viewportName}: dialogue text should stay inside scene panel`, 4);
    await assertElementContainedIn(page, '.choices', '#scenePanel', `${viewportName}: choices should stay inside scene panel`, 4);
    await assertElementDoesNotOverflowSelf(page, '.scene-debug', `${viewportName}: expanded scene details`);
    await assertNoHorizontalOverflow(page, `${viewportName}: expanded dialogue details`);

    await page.locator('[data-dialogue-return]').click();
    await page.locator('.choice', { hasText: 'Ask how recipes open portals' }).waitFor();
  }
}

async function assertLongRecipeTitleLayout(page, viewportName) {
  await page.locator('[data-tab="recipes"]').click();
  await page.locator('#recipePanel .recipe-card:first-child h4').evaluate((title) => {
    title.dataset.originalText = title.textContent;
    title.textContent = 'orchard-threshold-tart-with-a-very-long-name';
  });
  await assertElementContainedIn(
    page,
    '#recipePanel .recipe-card:first-child h4',
    '#recipePanel .recipe-card:first-child',
    `${viewportName}: long recipe title should stay inside its card`,
    3,
  );
  await assertElementDoesNotOverflowSelf(page, '#recipePanel .recipe-card:first-child h4', `${viewportName}: long recipe title`);
  assert.equal(
    rectsOverlap(await getRect(page, '#recipePanel .recipe-card:first-child'), await getRect(page, '#tabBar')),
    false,
    `${viewportName}: long-title recipe card should not overlap right-side tabs`,
  );
  await assertNoHorizontalOverflow(page, `${viewportName}: long recipe title`);
  await page.locator('#recipePanel .recipe-card:first-child h4').evaluate((title) => {
    title.textContent = title.dataset.originalText;
    delete title.dataset.originalText;
  });
}

async function assertReducedMotionTabNavigation(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', isMobile: true });
  const page = await context.newPage();
  await withFailureArtifacts(page, 'mobile-reduced-motion', async () => {
    await page.goto(`http://127.0.0.1:${port}/index.html`);
    await page.evaluate((key) => localStorage.removeItem(key), storageKey);
    await page.reload();
    await page.locator('#startBtn').click();
    await page.waitForTimeout(120);

    for (const tabName of Object.keys(tabPanelSelectors)) {
      await page.locator(`[data-tab="${tabName}"]`).click();
      await page.waitForTimeout(40);
      assert.equal(await page.getAttribute(`[data-tab="${tabName}"]`, 'aria-selected'), 'true', `reduced motion: ${tabName} tab should activate`);
      assert.equal(await page.locator(tabPanelSelectors[tabName]).isVisible(), true, `reduced motion: ${tabName} panel should be visible`);
      const classes = await page.locator('#bookPages').getAttribute('class');
      assert.ok(!/page-turning-(left|right)/.test(classes || ''), 'reduced motion: page-turn classes should not be applied');
    }

    await assertNoHorizontalOverflow(page, 'reduced motion mobile');
    await assertMajorLayoutAlignment(page, { name: 'mobile-reduced-motion', width: 390, height: 844 });
  });
  await context.close();
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

  await assertNoHorizontalOverflow(page, viewportName);

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

  await assertMajorLayoutAlignment(page, viewport);
  if (['mobile', 'small-responsive-edge', 'laptop'].includes(viewport.name)) {
    await assertDialogueControlsFit(page, viewport);
    await assertLongRecipeTitleLayout(page, viewportName);
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
  const systemChromium = '/snap/bin/chromium';
  const isSystemChromium = await import('node:fs').then((fs) => fs.promises.access(systemChromium).then(() => true).catch(() => false));
  const launchOptions = isSystemChromium
    ? { executablePath: systemChromium, headless: true, args: ['--no-sandbox', '--disable-gpu'] }
    : { headless: true };
  browser = await chromium.launch(launchOptions);

  for (const viewport of viewportSizes) {
    const viewportPage = await browser.newPage();
    try {
      await withFailureArtifacts(viewportPage, viewport.name, () => assertFullscreenLayout(viewportPage, viewport));
    } finally {
      await viewportPage.close();
    }
  }

  await assertReducedMotionTabNavigation(browser);

  const malformedSaveCases = [
    {
      name: 'null save root',
      persistedValue: 'null',
      expectedState: { current: 'cafe_intro', activeTab: 'cafe', inventory: [], recipeBook: ['orchard-porridge'] },
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
    /\/static\/img\/assets\/characters\/healer\/warm\.png$/,
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
    /A warm recipe used to enter the ruined orchard/,
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
  await page.evaluate(() => customElements.whenDefined('turn-book'));
  await page.locator('turn-book').waitFor();
  assert.deepEqual(await page.locator('turn-book').evaluate((book) => book.view()), [1], 'turn-book should initialize on the cover page');

  await page.locator('turn-book').evaluate((book) => book.next());
  assert.deepEqual(await page.locator('turn-book').evaluate((book) => book.view()), [2, 3], 'turn-book should advance from cover to the first interior spread');
  await page.waitForTimeout(900);

  await page.locator('turn-book').evaluate((book) => book.next());
  assert.deepEqual(await page.locator('turn-book').evaluate((book) => book.view()), [4, 5], 'turn-book should advance by spreads in double display');
  await page.waitForTimeout(900);

  await page.locator('turn-book').evaluate((book) => book.page(6));
  assert.deepEqual(await page.locator('turn-book').evaluate((book) => book.view()), [6], 'turn-book should show the back cover alone');
  await page.waitForTimeout(900);

  await page.locator('turn-book').evaluate((book) => book.display('single'));
  assert.deepEqual(await page.locator('turn-book').evaluate((book) => book.view()), [6], 'turn-book should switch to single-page display');

  await page.locator('turn-book').evaluate((book) => {
    const newPage = document.createElement('section');
    newPage.innerHTML = '<h2>Inserted Page</h2><p>This page was added dynamically.</p>';
    book.addPage(newPage, 3);
  });
  assert.equal(await page.locator('turn-book').evaluate((book) => book.pages()), 7, 'turn-book should support addPage');
  assert.equal(await page.locator('turn-book').evaluate((book) => book.removePage(3)), true, 'turn-book should support removePage');

  await page.locator('[data-demo-command="double"]').click();
  assert.match(await page.locator('#eventLog').textContent(), /display double/i, 'book demo should expose public API controls');

  // Test isAnimating() method
  assert.equal(await page.locator('turn-book').evaluate((book) => book.isAnimating()), false, 'turn-book isAnimating should return false when idle');

  // Test turn() convenience method
  assert.equal(await page.locator('turn-book').evaluate((book) => book.turn('pages')), 6, 'turn-book turn("pages") should return page count');
  assert.deepEqual(await page.locator('turn-book').evaluate((book) => book.turn('display')), 'double', 'turn-book turn("display") should return current display mode');
  assert.deepEqual(await page.locator('turn-book').evaluate((book) => book.turn('page')), 6, 'turn-book turn("page") should return current page');
  assert.deepEqual(await page.locator('turn-book').evaluate((book) => book.turn('is')), 'ready', 'turn-book turn("is") should return ready status');

  // Test turn-book events: pagechange, first, last
  const turnBookEvents = await page.locator('turn-book').evaluate((book) => {
    const events = [];
    const record = (event) => events.push({ type: event.type, page: event.detail.page, previousPage: event.detail.previousPage });
    book.addEventListener('pagechange', record);
    book.addEventListener('first', record);
    book.addEventListener('last', record);
    book.page(1);
    return new Promise((resolve) => {
      setTimeout(() => {
        book.removeEventListener('pagechange', record);
        book.removeEventListener('first', record);
        book.removeEventListener('last', record);
        resolve(events.map((e) => ({ type: e.type, page: e.page })));
      }, 1200);
    });
  });
  assert.ok(turnBookEvents.some((e) => e.type === 'pagechange'), 'turn-book should fire pagechange event');
  assert.ok(turnBookEvents.some((e) => e.type === 'first'), 'turn-book should fire first event when on page 1');

  // Test Home/End keyboard navigation on turn-book
  await page.locator('turn-book').evaluate((book) => book.page(3));
  await page.waitForTimeout(1000);
  await page.locator('turn-book').evaluate((book) => {
    book.shadowRoot.querySelector('.book').dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
  });
  await page.waitForTimeout(1000);
  assert.deepEqual(await page.locator('turn-book').evaluate((book) => book.view()), [6], 'turn-book End key should jump to last page');

  await page.locator('turn-book').evaluate((book) => {
    book.shadowRoot.querySelector('.book').dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
  });
  await page.waitForTimeout(1000);
  assert.deepEqual(await page.locator('turn-book').evaluate((book) => book.view()), [1], 'turn-book Home key should jump to first page');

  console.log('UI smoke checks passed');
} finally {
  if (browser) {
    await browser.close();
  }
  await new Promise((resolve) => server.close(resolve));
}
