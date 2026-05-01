import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

const server = spawn('python3', ['-m', 'http.server', '4173', '--directory', 'docs'], { stdio: 'ignore' });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let browser;
try {
  await wait(500);

  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:4173/index.html');

  assert.equal(await page.locator('#scenePanel').isVisible(), true, 'scene panel should be visible on load');
  assert.equal(await page.getAttribute('[data-tab="cafe"]', 'aria-selected'), 'true', 'cafe tab should be selected');


  await page.locator('[data-tab="cafe"]').focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.getAttribute('[data-tab="recipes"]', 'aria-selected'), 'true', 'arrow navigation should activate next tab');


  await page.keyboard.press('End');
  assert.equal(await page.getAttribute('[data-tab="journal"]', 'aria-selected'), 'true', 'End should jump to final tab');

  await page.keyboard.press('Home');
  assert.equal(await page.getAttribute('[data-tab="cafe"]', 'aria-selected'), 'true', 'Home should jump to first tab');

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
  if (server.exitCode === null) {
    server.kill('SIGTERM');
  }
}
