import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

const works = defineCollection({
  loader: glob({
    pattern: '*/index.md',
    base: './content/works',
    generateId: ({ entry }) => entry.replace(/\/index\.md$/, ''),
  }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    draft: z.boolean().default(false),
    cover: z.string().optional(),
    coverAlt: z.string().optional(),
    featured: z.boolean().default(false),
    featuredOrder: z.number().int().positive().optional(),
  }),
});

const pages = defineCollection({
  loader: glob({ pattern: 'about.md', base: './content' }),
  schema: z.object({ title: z.string() }),
});

export const collections = { works, pages };
