import { getCollection } from 'astro:content';
import images from '../../processed_images/images.json';
import type { ImageAsset, Project } from '../types';

const assets: Record<string, ImageAsset> = images;

export async function getProjects() {
  const entries = await getCollection('works', entry => !entry.data.draft);
  entries.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf() || a.id.localeCompare(b.id));
  return entries.map(entry => {
    const [event, ...parts] = entry.data.title.split(' - ');
    const name = parts.join(' - ') || entry.data.title;
    const prefix = `/works/${entry.id}/`;
    const cover = entry.data.cover ? assets[prefix + entry.data.cover] : Object.values(assets).find(image => image.src.startsWith(prefix));
    if (entry.data.cover && !cover) throw new Error(`Missing cover for ${entry.id}: ${entry.data.cover}`);
    const project: Project = {
      slug: entry.id, name, event: event.replace(/^\d{4}\s+/, ''),
      year: entry.data.date.getUTCFullYear(), url: prefix,
      cover, coverAlt: entry.data.coverAlt || name,
    };
    return { entry, project };
  });
}

export async function getFeaturedProjects() {
  const projects = await getProjects();
  return projects.filter(({ entry }) => entry.data.featured)
    .sort((a, b) => (a.entry.data.featuredOrder ?? Infinity) - (b.entry.data.featuredOrder ?? Infinity))
    .map(({ project }) => project).slice(0, 3);
}
