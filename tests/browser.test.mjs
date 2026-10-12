import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { startServer } from '../bazel/tools/serve.mjs';

let browser, server, base;
async function assertFitsViewport(page) {
  const overflow = await page.evaluate(() => {
    if (document.documentElement.scrollWidth <= innerWidth) return null;
    return { viewport: innerWidth, scroll: document.documentElement.scrollWidth, elements: Array.from(document.querySelectorAll('body *')).map(element => ({
      tag: element.tagName, class: element.className, right: Math.round(element.getBoundingClientRect().right),
    })).filter(element => element.right > innerWidth + 1).slice(0, 12) };
  });
  assert.equal(overflow, null, JSON.stringify(overflow));
}
async function capturePage(page, filename) {
  // Load off-screen photos before taking a full-page layout reference.
  for (const image of await page.locator('main img').all()) {
    await image.scrollIntoViewIfNeeded();
    await image.evaluate(element => element.decode());
  }
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: path.join(screenshots, filename), fullPage: true });
}
const screenshots = path.resolve(process.env.G3_SCREENSHOT_DIR || path.join(process.env.BUILD_WORKSPACE_DIRECTORY || process.cwd(), 'test-results'));
before(async () => {
  await mkdir(screenshots, { recursive: true });
  server = startServer('site_dist', { port: 0 });
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
  server?.closeAllConnections();
  if (server) await new Promise(resolve => server.close(resolve));
});

for (const colorScheme of ['light', 'dark']) {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    test(`${colorScheme}, ${viewport.width}px: hydration, navigation, and image viewer`, async () => {
      const context = await browser.newContext({ colorScheme, reducedMotion: 'reduce', viewport });
      const page = await context.newPage();
      page.setDefaultTimeout(8000);
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      try {
        await page.goto(base + '/');
        await page.locator('.featured-grid[data-rotated="true"]').waitFor();
        await page.getByRole('heading', { name: 'Gerald Spencer', exact: true }).waitFor();
        assert.equal(await page.locator('main .work-card').count(), 3);
        await page.waitForFunction(() => { const image = document.querySelector('main .work-card img'); return image.complete && image.naturalWidth > 0; });
        await page.evaluate(() => document.fonts.ready);
        await assertFitsViewport(page);
        assert.equal(await page.getByRole('link', { name: 'Resume', exact: true }).getAttribute('href'), '/gerald-spencer.pdf');
        const resume = await page.request.get(base + '/gerald-spencer.pdf');
        assert.equal(resume.status(), 200);
        assert.match(resume.headers()['content-type'], /application\/pdf/);
        assert.equal(await page.locator('.work-image img').first().evaluate(image => getComputedStyle(image).transitionDuration), '0s');
        await capturePage(page, `home-${colorScheme}-${viewport.width}.png`);
        for (const title of ['About', 'Works']) {
          await page.getByRole('link', { name: title, exact: true }).first().click();
          await page.getByRole('heading', { name: title, exact: true }).waitFor();
          await assertFitsViewport(page);
          await capturePage(page, `${title.toLowerCase()}-${colorScheme}-${viewport.width}.png`);
        }
        await page.getByRole('link', { name: 'Paradisium', exact: true }).first().click();
        await page.getByRole('heading', { name: 'Paradisium', exact: true }).waitFor();
        assert.deepEqual(errors, []);
        await capturePage(page, `project-${colorScheme}-${viewport.width}.png`);
        await page.locator('a[data-image]').first().focus();
        await page.keyboard.press('Enter');
        await page.locator('dialog[open]').waitFor();
        await page.waitForFunction(() => document.querySelector('dialog').contains(document.activeElement));
        await page.keyboard.press('Tab');
        assert.ok(await page.evaluate(() => document.querySelector('dialog').contains(document.activeElement)));
        await page.keyboard.press('ArrowRight');
        await page.waitForFunction(() => document.querySelector('.viewer-toolbar span')?.textContent === '2 / 3');
        await page.keyboard.press('Escape');
        await page.locator('dialog[open]').waitFor({ state: 'hidden' });
        await page.waitForFunction(() => document.activeElement === document.querySelector('a[data-image]'));
        assert.deepEqual(errors, []);
      } finally { await context.close(); }
    });
  }
}

test('navigation, photos, and content work without JavaScript', async () => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  try {
    await page.goto(base + '/');
    await page.getByRole('heading', { name: 'Gerald Spencer', exact: true }).waitFor();
    assert.deepEqual(await page.locator('.featured-grid .work-image').evaluateAll(links => links.map(link => link.getAttribute('href'))), ['/works/paradisium/', '/works/abduction/', '/works/the_folly/']);
    await page.getByRole('link', { name: 'Works', exact: true }).first().click();
    assert.equal(await page.locator('.work-card').count(), 11);
    await page.getByRole('link', { name: 'Paradisium', exact: true }).first().click();
    await page.getByRole('heading', { name: 'Paradisium', exact: true }).waitFor();
    assert.match(await page.locator('a[data-image]').first().getAttribute('href'), /^\/works\/paradisium\/images\//);
  } finally { await context.close(); }
});

test('homepage rotates three unique projects on reload without hydration errors', async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  try {
    await page.goto(base + '/works/');
    const eligible = await page.locator('.works-grid .work-image').evaluateAll(links => links.map(link => link.getAttribute('href')));
    let previous;
    for (let visit = 0; visit < 4; visit++) {
      if (visit === 0) await page.goto(base + '/');
      else await page.reload();
      await page.locator('.featured-grid[data-rotated="true"]').waitFor();
      const selected = await page.locator('.featured-grid .work-image').evaluateAll(links => links.map(link => link.getAttribute('href')));
      assert.equal(selected.length, 3);
      assert.equal(new Set(selected).size, 3);
      assert.ok(selected.every(url => eligible.includes(url)));
      assert.notEqual(selected[0], previous);
      previous = selected[0];
      assert.equal(await page.locator('.featured-grid img').first().getAttribute('fetchpriority'), 'high');
    }
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('homepage selection works when browser storage is unavailable', async () => {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    Storage.prototype.getItem = Storage.prototype.setItem = () => { throw new DOMException('Storage unavailable', 'SecurityError'); };
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(base + '/');
    await page.locator('.featured-grid[data-rotated="true"]').waitFor();
    assert.equal(await page.locator('.featured-grid .work-card').count(), 3);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('navigation fits a narrow mobile screen', async () => {
  const context = await browser.newContext({ viewport: { width: 320, height: 640 } });
  const page = await context.newPage();
  try {
    await page.goto(base + '/');
    await assertFitsViewport(page);
    await page.getByRole('link', { name: 'About', exact: true }).first().click();
    await assertFitsViewport(page);
    const wordmark = await page.locator('.wordmark').boundingBox();
    const navigation = await page.locator('nav').boundingBox();
    assert.ok(wordmark.x + wordmark.width < navigation.x, 'name and navigation overlap');
  } finally { await context.close(); }
});
