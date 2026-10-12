import path from 'node:path';
import { mkdir, copyFile } from 'node:fs/promises';
import sharp from 'sharp';
import { argument, walk, write } from './lib.mjs';

const images = (await walk('content')).filter(filename => /\.(jpg|png|jpeg)$/i.test(filename)).map(source => ({ source, url: '/' + path.relative('content', source).split(path.sep).join('/') }));
const output = argument('output', 'processed_images');
const manifest = {};
for (const image of images) {
  const original = path.join(output, image.url.slice(1));
  await mkdir(path.dirname(original), { recursive: true });
  await copyFile(image.source, original);
  const metadata = await sharp(image.source).metadata();
  const width = metadata.autoOrient?.width || metadata.width;
  const height = metadata.autoOrient?.height || metadata.height;
  const variants = [];
  for (const size of [...new Set([640, 960, 1440, 1920].map(size => Math.min(size, width)))]) {
    const url = `/media/${image.url.slice(1).replace(/\.[^.]+$/, '')}-${size}.webp`;
    const destination = path.join(output, url.slice(1));
    await mkdir(path.dirname(destination), { recursive: true });
    await sharp(image.source).rotate().resize({ width: size, withoutEnlargement: true }).webp({ quality: 82 }).toFile(destination);
    variants.push({ url, width: size });
  }
  manifest[image.url] = { src: image.url, width, height, variants };
}
await write(path.join(output, 'images.json'), JSON.stringify(manifest, null, 2) + '\n');
