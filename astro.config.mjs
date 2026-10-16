import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import { unified } from '@astrojs/markdown-remark';
import rehypeRaw from 'rehype-raw';
import projectMedia, { projectImagePaths } from './src/lib/project-media.mjs';

export default defineConfig({
  site: 'https://www.geraldhspencer.com',
  output: 'static',
  trailingSlash: 'always',
  outDir: './astro_site',
  cacheDir: './astro_cache',
  build: { inlineStylesheets: 'always' },
  integrations: [react(), sitemap({ filter: page => !page.endsWith('/404/') && !page.endsWith('/404.html') })],
  markdown: { processor: unified({ smartypants: false, remarkPlugins: [projectImagePaths], rehypePlugins: [rehypeRaw, projectMedia] }) },
  // Bind native Vite resolution to the declared output-tree TypeScript config.
  vite: {
    tsconfig: './tsconfig.json',
    resolve: { dedupe: ['react', 'react-dom'] },
    // Every route uses the same global stylesheet and font faces.
    build: { cssCodeSplit: false },
  },
});
