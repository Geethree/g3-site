import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { startServer } from '../bazel/tools/serve.mjs';

if (!process.env.PLAYWRIGHT_BROWSERS_PATH && existsSync('/ms-playwright')) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = '/ms-playwright';
}
const { chromium, webkit, devices } = await import('playwright');
// Analytics is external to the site behavior under test.
async function testContext(options, engine = browser) {
  const context = await engine.newContext(options);
  context.setDefaultTimeout(8000);
  context.on('page', page => page.on('console', message => {
    if (message.type() === 'warning' && message.text().startsWith('WebGPU device lost:')) console.log(message.text());
  }));
  await context.addInitScript(() => {
    if (!globalThis.GPUAdapter) return;
    const requestDevice = GPUAdapter.prototype.requestDevice;
    GPUAdapter.prototype.requestDevice = async function (...args) {
      const device = await requestDevice.apply(this, args);
      device.lost.then(info => console.warn('WebGPU device lost:', info.reason, info.message));
      return device;
    };
  });
  await context.route('https://static.cloudflareinsights.com/**', route => route.fulfill({ body: '', contentType: 'application/javascript' }));
  return context;
}

let browser, webkitBrowser, server, base, display;
async function startDisplay() {
  if (process.platform !== 'linux' || process.env.DISPLAY) return;
  // WebGPU canvas presentation needs an X display and Vulkan compositing in CI.
  display = spawn('Xvfb', ['-displayfd', '1', '-screen', '0', '1920x1080x24', '-nolisten', 'tcp'], { stdio: ['ignore', 'pipe', 'pipe'] });
  const number = await new Promise((resolve, reject) => {
    let output = '';
    display.stdout.on('data', data => {
      output += data;
      if (output.includes('\n')) resolve(output.trim());
    });
    display.once('error', reject);
    display.once('exit', code => reject(new Error(`Xvfb exited with code ${code}`)));
    display.stderr.on('data', data => process.stderr.write(data));
  });
  process.env.DISPLAY = `:${number}`;
}
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
const screenshots = path.resolve(process.env.G3_SCREENSHOT_DIR || path.join(process.env.TEST_UNDECLARED_OUTPUTS_DIR || process.env.BUILD_WORKSPACE_DIRECTORY || process.cwd(), 'test-results'));
before(async () => {
  await mkdir(screenshots, { recursive: true });
  server = startServer('site_dist', { port: 0 });
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
  await startDisplay();
  browser = await chromium.launch({ channel: 'chromium', args: process.platform === 'linux'
    ? ['--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-webgpu-adapter=swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
    : ['--enable-unsafe-webgpu', '--enable-gpu'] });
  webkitBrowser = await webkit.launch();
});
after(async () => {
  await browser?.close();
  await webkitBrowser?.close();
  if (display && display.exitCode === null) {
    const stopped = once(display, 'exit');
    display.kill();
    await stopped;
  }
  server?.closeAllConnections();
  if (server) await new Promise(resolve => server.close(resolve));
});

for (const colorScheme of ['light', 'dark']) {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    test(`${colorScheme}, ${viewport.width}px: rendering, navigation, and image viewer`, async () => {
      const context = await testContext({ colorScheme, reducedMotion: 'reduce', viewport });
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
    const context = await testContext({ colorScheme });
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
  const context = await testContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  try {
    await page.goto(base + '/');
    await page.getByRole('heading', { name: 'Gerald Spencer', exact: true }).waitFor();
    assert.deepEqual(await page.locator('.featured-grid .work-image').evaluateAll(links => links.map(link => link.getAttribute('href'))), ['/works/paradisium/', '/works/abduction/', '/works/the_folly/']);
    const fallbackRatios = await page.locator('.featured-grid picture').evaluateAll(pictures => pictures.map(picture => {
      const { width, height } = picture.getBoundingClientRect();
      return width / height;
    }));
    assert.ok(Math.abs(fallbackRatios[0] - 1.85) < 0.01);
    assert.ok(fallbackRatios.slice(1).every(ratio => Math.abs(ratio - 1.5) < 0.01));
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

test('homepage rotates three unique projects on reload without errors', async () => {
  const context = await testContext();
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
  const context = await testContext();
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

test('mobile homepage keeps cards stable and loads only selected photos without React', async () => {
  const context = await testContext({ viewport: { width: 412, height: 823 }, deviceScaleFactor: 1.75 });
  await context.addInitScript(() => {
    window.layoutShiftScore = 0;
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) window.layoutShiftScore += entry.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
  const page = await context.newPage();
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  try {
    await page.goto(base + '/');
    await page.locator('.featured-grid[data-rotated="true"]').waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.locator('.featured-grid img').first().evaluate(image => image.decode());
    await page.waitForTimeout(300);
    assert.ok(await page.evaluate(() => window.layoutShiftScore < 0.05), 'loading must not shift the project cards');
    assert.equal(await page.locator('astro-island').count(), 0);
    assert.ok(!requests.some(url => /\/(?:client|react|jsx-runtime)\.[^/]+\.js/.test(url)), 'homepage must not load React');
    const selected = await page.locator('.featured-grid .work-image').evaluateAll(links => links.map(link => link.pathname));
    const photos = requests.filter(url => url.includes('/media/works/'));
    assert.ok(photos.length > 0);
    assert.ok(photos.every(url => selected.some(project => url.includes('/media' + project))), 'unselected photos must stay unloaded');
    const firstImage = await page.locator('.featured-grid img').first().evaluate(image => ({ width: image.getBoundingClientRect().width, height: image.getBoundingClientRect().height, src: image.currentSrc, intrinsicWidth: Number(image.getAttribute('width')), intrinsicHeight: Number(image.getAttribute('height')) }));
    assert.ok(Math.abs(firstImage.width / firstImage.height - 1.5) < 0.01);
    const cropScale = Math.max(1, firstImage.intrinsicWidth / firstImage.intrinsicHeight / 1.5);
    const requiredWidth = Math.min(1920, firstImage.intrinsicWidth, firstImage.width * 1.75 * cropScale);
    const sourceWidth = Number(firstImage.src.match(/-(\d+)\.webp$/)[1]);
    assert.ok(sourceWidth >= requiredWidth, 'the photo must have enough detail after cropping');
    if (cropScale < 1.01) assert.ok(sourceWidth <= 768, 'mobile should choose the closest image size');
  } finally { await context.close(); }
});

test('navigation fits a narrow mobile screen', async () => {
  const context = await testContext({ viewport: { width: 320, height: 640 } });
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
  test(`Rust WebGPU field, ${viewport.width}px: rendering and controls`, async () => {
    const context = await testContext({ viewport, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      await page.goto(base + '/play/');
      const canvas = page.locator('#field[data-ready="true"]');
      await canvas.waitFor();
      assert.equal(await canvas.evaluate(element => element.getContext('webgpu') instanceof GPUCanvasContext), true, 'experiment uses WebGPU');
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
  const context = await testContext();
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
  const context = await testContext({ hasTouch: true, viewport: { width: 390, height: 844 } });
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

// Navigation must work even when the destination browser has no WebGPU adapter.
for (const [engine, device] of [['webkit', 'iPhone 13'], ['chromium', 'Pixel 5']]) {
  for (const [label, route, canvas] of [['Field', '/play/', 'field'], ['Flocking', '/experiments/flocking/', 'flock']]) {
    test(`${engine} touch: ${label} link navigates from the dropdown`, async () => {
      const context = await testContext(devices[device], engine === 'webkit' ? webkitBrowser : browser);
      const page = await context.newPage();
      try {
        for (const source of ['/', '/about/']) {
          await page.goto(base + source);
          const menu = page.locator('details.experiments');
          await menu.locator('summary').tap();
          assert.equal(await menu.evaluate(element => element.open), true);
          await page.getByRole('link', { name: label, exact: true }).tap();
          await page.waitForURL(base + route);
          assert.equal(await page.locator('canvas').getAttribute('id'), canvas);
        }
      } finally { await context.close(); }
    });
  }
}

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`Rust flock, ${viewport.width}px: sliders, input, pause, reset, and resize`, async () => {
    const context = await testContext({ viewport, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      await page.goto(base + '/experiments/flocking/');
      const canvas = page.locator('#flock[data-ready="true"]');
      await canvas.waitFor();
      assert.equal(await canvas.evaluate(element => element.getContext('webgpu') instanceof GPUCanvasContext), true, 'experiment uses WebGPU');
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
  const context = await testContext({ hasTouch: true, viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
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

for (const route of ['/play/', '/experiments/flocking/']) {
  test(`${route}: unavailable WebGPU reports an initialization error`, async () => {
    const context = await testContext();
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'gpu', { value: undefined });
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      await page.goto(base + route);
      await page.waitForFunction(() => document.querySelector('#status').textContent.startsWith('Unable to start:'));
      assert.match(await page.locator('#status').textContent(), /WebGPU/i);
      assert.equal(await page.locator('canvas').getAttribute('data-ready'), null);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  });
}

for (const route of ['/play/', '/experiments/flocking/']) {
  test(`${route}: WebGPU resize and device loss`, async () => {
    const context = await testContext({ viewport: { width: 900, height: 700 } });
    await context.addInitScript(() => {
      const requestDevice = GPUAdapter.prototype.requestDevice;
      GPUAdapter.prototype.requestDevice = async function (...args) {
        const device = await requestDevice.apply(this, args);
        window.experimentDevice = device;
        return device;
      };
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      await page.goto(base + route);
      await page.locator('canvas[data-ready="true"]').waitFor();
      await page.setViewportSize({ width: 640, height: 480 });
      await page.waitForFunction(() => {
        const canvas = document.querySelector('canvas');
        return canvas.width === Math.round(innerWidth * Math.min(devicePixelRatio, 2))
          && canvas.height === Math.round(innerHeight * Math.min(devicePixelRatio, 2));
      });
      await page.evaluate(() => window.experimentDevice.destroy());
      await page.waitForFunction(() => document.querySelector('#status').textContent.includes('Graphics device lost'));
      if (route.includes('flocking')) {
        const steps = await page.locator('canvas').getAttribute('data-steps');
        await page.waitForTimeout(150);
        assert.equal(await page.locator('canvas').getAttribute('data-steps'), steps, 'device loss stops simulation');
      }
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  });
}
