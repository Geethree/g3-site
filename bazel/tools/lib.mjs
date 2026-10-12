import { readdir, mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';

export async function walk(directory) {
  const result = [];
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
    const filename = path.join(directory, entry.name);
    if (entry.name === '.DS_Store') continue;
    const type = entry.isSymbolicLink() ? await stat(filename) : entry;
    if (type.isDirectory()) result.push(...await walk(filename));
    else if (type.isFile()) result.push(filename);
  }
  return result;
}

export function argument(name, fallback) {
  const index = process.argv.indexOf('--' + name);
  return index < 0 ? fallback : process.argv[index + 1];
}

export async function write(filename, value) {
  await mkdir(path.dirname(filename), { recursive: true });
  await writeFile(filename, value);
}

export async function json(filename) {
  return JSON.parse(await readFile(filename, 'utf8'));
}

export function escape(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

export function safeRelative(filename) {
  if (!filename || filename.includes('\\') || path.posix.isAbsolute(filename) || path.win32.isAbsolute(filename) || filename.split('/').includes('..')) {
    throw new Error('Unsafe output path: ' + filename);
  }
  return filename;
}
