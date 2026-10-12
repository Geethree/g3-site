import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
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

for (const colorScheme of ['light', 'dark']) {
  test(`theme toggle starts from ${colorScheme}, overrides system changes, and resets on load`, async () => {
    const context = await browser.newContext({ colorScheme });
    const page = await context.newPage();
    const opposite = colorScheme === 'light' ? 'dark' : 'light';
    const assertTheme = async theme => {
      await page.getByRole('button', { name: `Switch to ${theme === 'light' ? 'dark' : 'light'} mode` }).waitFor();
      assert.equal(await page.locator('html').evaluate(element => getComputedStyle(element).colorScheme), theme);
      assert.equal(await page.locator('body').evaluate(element => getComputedStyle(element).backgroundColor), theme === 'light' ? 'rgb(248, 247, 244)' : 'rgb(24, 27, 24)');
      assert.equal(await page.locator(`.theme-${theme === 'light' ? 'moon' : 'sun'}`).isVisible(), true);
    };
    try {
      await page.goto(base + '/');
      await assertTheme(colorScheme);
      await page.emulateMedia({ colorScheme: opposite });
      await assertTheme(opposite);
      await page.locator('.theme-toggle').focus();
      await page.keyboard.press('Enter');
      await assertTheme(colorScheme);
      await page.emulateMedia({ colorScheme });
      await page.emulateMedia({ colorScheme: opposite });
      await assertTheme(colorScheme);
      await page.reload();
      await assertTheme(opposite);
      await page.locator('.theme-toggle').click();
      await assertTheme(colorScheme);
      await page.getByRole('link', { name: 'About', exact: true }).click();
      await assertTheme(opposite);
    } finally { await context.close(); }
  });
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
    const experiments = page.locator('.experiments summary');
    await experiments.focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.getByRole('link', { name: 'Field', exact: true }).getAttribute('href'), '/play/');
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('.experiments').getAttribute('open'), null);
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
    assert.ok(wordmark.x + wordmark.width <= navigation.x || wordmark.y + wordmark.height <= navigation.y, 'name and navigation overlap');
    await page.locator('.experiments summary').hover();
    await assertFitsViewport(page);
    await page.getByRole('link', { name: 'Field', exact: true }).click();
    await page.locator('#field[data-ready="true"]').waitFor();
  } finally { await context.close(); }
});

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`Rust WebGL field, ${viewport.width}px: rendering and controls`, async () => {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      await page.goto(base + '/play/');
      const canvas = page.locator('#field[data-ready="true"]');
      await canvas.waitFor();
      await page.waitForFunction(() => document.querySelector('canvas').width === Math.round(innerWidth * Math.min(devicePixelRatio, 2)));
      await assertFitsViewport(page);
      assert.equal(await page.locator('#status').textContent(), '');
      const wasm = await page.request.get(base + '/play/wasm/field_bg.wasm');
      assert.equal(wasm.status(), 200);
      assert.match(wasm.headers()['content-type'], /application\/wasm/);
      await page.screenshot({ path: path.join(screenshots, `field-${viewport.width}.png`) });
      const pixels = async () => createHash('sha256').update(await page.screenshot({ clip: { x: 0, y: 100, width: viewport.width, height: viewport.height - 220 } })).digest('hex');
      const original = await pixels();
      await page.getByRole('button', { name: 'Color', exact: true }).click();
      await page.waitForTimeout(100);
      assert.notEqual(await pixels(), original, 'Rust palette control must change the rendered pixels');
      await page.getByRole('button', { name: 'Reset', exact: true }).click();
      await page.waitForTimeout(100);
      assert.equal(await pixels(), original, 'Reset must restore the initial scene');
      await canvas.click({ position: { x: viewport.width / 2, y: viewport.height / 2 } });
      await page.waitForTimeout(100);
      assert.notEqual(await pixels(), original, 'Pointer input must change the field');
      await page.getByRole('button', { name: 'Play', exact: true }).click();
      assert.equal(await page.locator('#pause').getAttribute('aria-pressed'), 'false');
      const moving = await pixels();
      await page.waitForTimeout(250);
      assert.notEqual(await pixels(), moving, 'Animation must advance');
      await page.getByRole('button', { name: 'Pause', exact: true }).click();
      const paused = await pixels();
      await page.waitForTimeout(150);
      assert.equal(await pixels(), paused, 'Pause must freeze animation');
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  });
}

test('Experiments dropdown: hover, gap, dismissal, and keyboard focus', async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto(base + '/');
    const menu = page.locator('details.experiments');
    const trigger = menu.locator('summary');
    const isOpen = () => menu.evaluate(element => element.open);
    await trigger.hover();
    assert.equal(await isOpen(), true);
    const box = await menu.locator('.experiments-menu').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y - 4);
    await page.waitForTimeout(200);
    assert.equal(await isOpen(), true, 'crossing the gap must not close the menu');
    await page.getByRole('link', { name: 'Flocking', exact: true }).hover();
    await page.waitForTimeout(200);
    assert.equal(await isOpen(), true);
    await page.mouse.move(1, 200);
    await page.waitForTimeout(220);
    assert.equal(await isOpen(), false, 'leaving closes the menu');
    await trigger.hover();
    await page.mouse.move(1, 200);
    await page.waitForTimeout(50);
    await trigger.hover();
    await page.waitForTimeout(180);
    assert.equal(await isOpen(), true, 'returning cancels dismissal');
    await trigger.click();
    assert.equal(await isOpen(), false, 'click toggles the hovered menu');
    await page.mouse.move(1, 200);
    await trigger.focus();
    await page.keyboard.press('Enter');
    assert.equal(await isOpen(), true);
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Field');
    await page.waitForTimeout(200);
    assert.equal(await isOpen(), true, 'keyboard focus keeps it open');
    await page.keyboard.press('Escape');
    assert.equal(await isOpen(), false);
    assert.equal(await trigger.evaluate(element => element === document.activeElement), true);
    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    assert.equal(await isOpen(), false, 'tabbing outside closes it');
    await trigger.hover();
    await page.mouse.click(1, 200);
    assert.equal(await isOpen(), false, 'outside click closes it immediately');
  } finally { await context.close(); }
});

test('Experiments dropdown: touch toggling and outside tap', async () => {
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  try {
    await page.goto(base + '/');
    const menu = page.locator('details.experiments');
    await menu.locator('summary').tap();
    assert.equal(await menu.evaluate(element => element.open), true);
    await menu.locator('summary').tap();
    assert.equal(await menu.evaluate(element => element.open), false);
    await menu.locator('summary').tap();
    await page.touchscreen.tap(10, 150);
    assert.equal(await menu.evaluate(element => element.open), false);
    await menu.locator('summary').tap();
    await page.getByRole('link', { name: 'Flocking', exact: true }).tap();
    await page.locator('#flock[data-ready="true"]').waitFor();
  } finally { await context.close(); }
});

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`Rust flock, ${viewport.width}px: sliders, input, pause, reset, and resize`, async () => {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      await page.goto(base + '/experiments/flocking/');
      const canvas = page.locator('#flock[data-ready="true"]');
      await canvas.waitFor();
      await page.waitForFunction(() => document.querySelector('#flock').dataset.count === '300');
      await assertFitsViewport(page);
      assert.equal(await page.locator('#status').textContent(), '');
      assert.equal(await page.locator('#pause').getAttribute('aria-pressed'), 'true');
      const panel = page.locator('details.controls');
      assert.equal(await panel.evaluate(element => element.open), viewport.width > 600);
      await page.screenshot({ path: path.join(screenshots, `flocking-${viewport.width}.png`) });
      if (viewport.width <= 600) await panel.locator('summary').click();
      await assertFitsViewport(page);
      const pixels = async () => createHash('sha256').update(await page.screenshot({ clip: { x: 0, y: 100, width: Math.min(120, viewport.width), height: 450 } })).digest('hex');
      const original = await pixels();
      const steps = await canvas.getAttribute('data-steps');
      await page.waitForTimeout(100);
      assert.equal(await canvas.getAttribute('data-steps'), steps, 'reduced motion starts frozen');
      for (const [label, value, output] of [['Count', '800', '800'], ['Speed', '2', '2.0×'], ['Separation', '0', '0.0'], ['Alignment', '3', '3.0'], ['Cohesion', '0.5', '0.5']]) {
        await page.getByLabel(label, { exact: true }).fill(value);
        const id = label.toLowerCase();
        assert.equal(await page.locator(`#${id}-value`).textContent(), output);
      }
      await page.waitForFunction(() => document.querySelector('#flock').dataset.count === '800');
      assert.notEqual(await pixels(), original, 'count changes the drawing');
      await page.getByLabel('Speed', { exact: true }).focus();
      await page.keyboard.press('ArrowLeft');
      assert.equal(await page.locator('#speed-value').textContent(), '1.9×');
      await page.getByRole('button', { name: 'Reset', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('#flock').dataset.count === '300');
      assert.equal(await page.locator('#speed-value').textContent(), '1.0×');
      assert.equal(await page.locator('#separation-value').textContent(), '1.5');
      assert.equal(await pixels(), original, 'reset restores the seeded flock');
      if (viewport.width <= 600) await panel.locator('summary').click();
      await page.mouse.move(80, 150);
      await page.waitForFunction(() => document.querySelector('#flock').dataset.pointer === 'repel');
      await page.mouse.down();
      await page.waitForFunction(() => document.querySelector('#flock').dataset.pointer === 'attract');
      await page.mouse.up();
      await canvas.focus();
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => document.querySelector('#flock').dataset.pointer === 'attract');
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => document.querySelector('#flock').dataset.pointer === 'repel');
      if (viewport.width <= 600) await panel.locator('summary').click();
      await page.getByRole('button', { name: 'Play', exact: true }).click();
      await page.waitForFunction(() => Number(document.querySelector('#flock').dataset.steps) > 5);
      assert.notEqual(await pixels(), original, 'playing moves the birds');
      await page.getByRole('button', { name: 'Pause', exact: true }).click();
      const paused = await pixels();
      await page.waitForTimeout(100);
      assert.equal(await pixels(), paused);
      await page.setViewportSize({ width: viewport.width + 40, height: viewport.height - 40 });
      await page.waitForFunction(() => document.querySelector('#flock').width === Math.round(innerWidth * Math.min(devicePixelRatio, 2)));
      await assertFitsViewport(page);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  });
}

test('flock touch release removes attraction', async () => {
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  try {
    await page.goto(base + '/experiments/flocking/');
    await page.locator('#flock[data-ready="true"]').waitFor();
    // Chromium's touch protocol gives us separate press, drag, and release.
    const session = await context.newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 100, y: 200 }] });
    await page.waitForFunction(() => document.querySelector('#flock').dataset.pointer === 'attract');
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 120, y: 220 }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForFunction(() => document.querySelector('#flock').dataset.pointer === 'inactive');
  } finally { await context.close(); }
});
