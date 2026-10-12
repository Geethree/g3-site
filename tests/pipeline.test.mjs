import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm, mkdir, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { json, safeRelative, walk } from '../bazel/tools/lib.mjs';
import { exportSite } from '../bazel/tools/export.mjs';
import { startServer } from '../bazel/tools/serve.mjs';

test('all current pages, image variants, metadata, and links exist', async () => {
  const projects = (await walk('content/works')).filter(file => path.basename(file) === 'index.md').map(file => path.basename(path.dirname(file)));
  assert.equal(projects.length, 11);
  assert.equal((await readFile('site_dist/gerald-spencer.pdf')).subarray(0, 5).toString(), '%PDF-');
  const manifest = await json('site_dist/.site-manifest.json');
  for (const filename of Object.keys(manifest.files)) {
    safeRelative(filename);
    if (!filename.endsWith('.html')) continue;
    const html = await readFile(path.join('site_dist', filename), 'utf8');
    assert.match(html, /<html lang="en"(?:\s[^>]*)?>/);
    assert.match(html, /rel="canonical"/);
    assert.match(html, /<link[^>]+rel="stylesheet"|<style[^>]*>[^<]*--background:/);
    assert.match(html, /class="skip-link"/);
    assert.match(html, /<main id="main"/);
    for (const [, url] of html.matchAll(/(?:href|src)="(\/[^"#]*)"/g)) {
      const target = url.endsWith('/') ? url.slice(1) + 'index.html' : url.slice(1);
      assert.ok(target in manifest.files, `${filename}: missing ${url}`);
    }
    for (const [, url] of html.matchAll(/(\/media\/[^\s",]+\.webp)\s+\d+w/g)) {
      assert.ok(url.slice(1) in manifest.files, `missing responsive image ${url}`);
    }
    for (const [, attributes] of html.matchAll(/<iframe\b([^>]+)>/g)) {
      assert.match(attributes, /title="[^"]+"/);
      assert.match(attributes, /loading="lazy"/);
      assert.match(attributes, /src="https:\/\/(?:www\.youtube\.com\/embed\/|player\.vimeo\.com\/video\/)/);
    }
  }
  const expectedPages = ['index.html', 'about/index.html', 'works/index.html', 'play/index.html', '404.html', ...projects.map(slug => `works/${slug}/index.html`)];
  assert.deepEqual(Object.keys(manifest.files).filter(file => file.endsWith('.html')).sort(), expectedPages.sort());
  const home = await readFile('site_dist/index.html', 'utf8');
  assert.deepEqual([...home.matchAll(/<a href="(\/works\/[^\"]+\/)" class="work-image"/g)].map(match => match[1]), ['/works/paradisium/', '/works/abduction/', '/works/the_folly/']);
  assert.match(home, /fetchpriority="high"/i);
  assert.equal((home.match(/<astro-island\s/g) || []).length, 1);
  assert.doesNotMatch(await readFile('site_dist/about/index.html', 'utf8'), /<astro-island\s/);
  assert.doesNotMatch(await readFile('site_dist/works/index.html', 'utf8'), /<astro-island\s/);
  const sitemap = await readFile('site_dist/sitemap-0.xml', 'utf8');
  for (const slug of projects) assert.ok(sitemap.includes(`/works/${slug}/`));
  assert.ok(!sitemap.includes('/404'));
  assert.equal(await readFile('site_dist/CNAME', 'utf8'), 'www.geraldhspencer.com\n');
});

test('export is repeatable, removes stale output, and preserves unrelated files', async () => {
  const temp = await mkdtemp(path.join(tmpdir(), 'portfolio-export-'));
  try {
    const destination = path.join(temp, 'docs');
    await mkdir(path.join(destination, 'obsolete/nested'), { recursive: true });
    await writeFile(path.join(destination, 'obsolete/nested/page.html'), 'old');
    await writeFile(path.join(destination, 'notes.txt'), 'handwritten');
    const previous = { version: 1, files: { 'obsolete/nested/page.html': createHash('sha256').update('old').digest('hex') } };
    await writeFile(path.join(destination, '.site-manifest.json'), JSON.stringify(previous));
    await exportSite('site_dist', destination);
    assert.equal(await readFile(path.join(destination, 'notes.txt'), 'utf8'), 'handwritten');
    await assert.rejects(stat(path.join(destination, 'obsolete')), { code: 'ENOENT' });
    const before = await readFile(path.join(destination, '.site-manifest.json'), 'utf8');
    await exportSite('site_dist', destination);
    assert.equal(await readFile(path.join(destination, '.site-manifest.json'), 'utf8'), before);
    await writeFile(path.join(destination, 'index.html'), 'user edit');
    await assert.rejects(exportSite('site_dist', destination), /changed outside the generator/);
    assert.equal(await readFile(path.join(destination, 'index.html'), 'utf8'), 'user edit');
  } finally { await rm(temp, { recursive: true, force: true }); }
});

test('export rejects paths escaping its output directory', async () => {
  assert.throws(() => safeRelative('../file.typ'), /Unsafe output path/);
  assert.throws(() => safeRelative('/tmp/file'), /Unsafe output path/);
  assert.throws(() => safeRelative('..\\file'), /Unsafe output path/);
  assert.throws(() => safeRelative('C:/file.typ'), /Unsafe output path/);
});

test('preview serves pages and returns real 404s for missing URLs', async () => {
  const server = startServer('site_dist', { port: 0 });
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal((await fetch(base + '/works/paradisium/')).status, 200);
    assert.match((await fetch(base + '/gerald-spencer.pdf')).headers.get('content-type'), /application\/pdf/);
    for (const url of ['/missing-page/', '/works/missing-project/', '/missing.pdf']) {
      assert.equal((await fetch(base + url)).status, 404, url);
    }
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
