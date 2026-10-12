import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { argument, walk, write } from './lib.mjs';

const source = argument('source', 'assembled_site');
const files = {};
for (const filename of await walk(source)) {
  const relative = path.relative(source, filename).split(path.sep).join('/');
  files[relative] = createHash('sha256').update(await readFile(filename)).digest('hex');
}
await write(argument('output', '.site-manifest.json'), JSON.stringify({ version: 1, files }, null, 2) + '\n');
