import { readFile, mkdir, copyFile, unlink, chmod, rmdir } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { argument, json, safeRelative } from './lib.mjs';

async function hash(filename) {
  try { return createHash('sha256').update(await readFile(filename)).digest('hex'); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

async function copyWritable(source, destination) {
  await chmod(destination, 0o644).catch(error => { if (error.code !== 'ENOENT') throw error; });
  await copyFile(source, destination);
  await chmod(destination, 0o644);
}

async function pruneEmptyParents(filename, destination) {
  const root = path.resolve(destination);
  let directory = path.dirname(path.resolve(destination, filename));
  if (directory !== root && !directory.startsWith(root + path.sep)) throw new Error('Unsafe output path: ' + filename);
  while (directory !== root) {
    try { await rmdir(directory); }
    catch (error) {
      if (error.code === 'ENOTEMPTY' || error.code === 'EEXIST') return;
      if (error.code !== 'ENOENT') throw error;
    }
    directory = path.dirname(directory);
  }
}

export async function exportSite(source, destination) {
  const manifest = await json(path.join(source, '.site-manifest.json'));
  let previous = {};
  try { previous = (await json(path.join(destination, '.site-manifest.json'))).files; }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  for (const filename of new Set([...Object.keys(previous), ...Object.keys(manifest.files)])) {
    safeRelative(filename);
    const existing = await hash(path.join(destination, filename));
    if (existing && existing !== previous[filename] && existing !== manifest.files[filename]) {
      throw new Error(`Export would replace or remove a file changed outside the generator: ${filename}`);
    }
  }
  for (const [filename, expected] of Object.entries(manifest.files)) {
    if (await hash(path.join(source, filename)) !== expected) throw new Error('Invalid source manifest: ' + filename);
  }
  await mkdir(destination, { recursive: true });
  for (const filename of Object.keys(previous)) {
    if (!(filename in manifest.files)) {
      await unlink(path.join(destination, filename)).catch(error => { if (error.code !== 'ENOENT') throw error; });
      await pruneEmptyParents(filename, destination);
    }
  }
  for (const [filename, expected] of Object.entries(manifest.files)) {
    if (await hash(path.join(destination, filename)) === expected) continue;
    const target = path.join(destination, filename);
    await mkdir(path.dirname(target), { recursive: true });
    await copyWritable(path.join(source, filename), target);
  }
  await copyWritable(path.join(source, '.site-manifest.json'), path.join(destination, '.site-manifest.json'));
  return Object.keys(manifest.files).length;
}

if (process.argv[1]?.endsWith('export.mjs')) {
  const workspace = process.env.BUILD_WORKSPACE_DIRECTORY;
  const destination = argument('output', workspace ? path.join(workspace, 'docs') : undefined);
  if (!destination) throw new Error('Use bazel run //:export or pass --output.');
  const count = await exportSite(path.resolve('site_dist'), destination);
  console.log(`Exported ${count} files to ${destination}`);
}
