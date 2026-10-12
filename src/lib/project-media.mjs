import { readFile } from 'node:fs/promises';
import path from 'node:path';

// Absolute public URLs keep these images in the Bazel processing target.
export function projectImagePaths() {
  return (tree, file) => {
    const slug = String(file.path || '').replaceAll('\\', '/').match(/\/works\/([^/]+)\/index\.md$/)?.[1];
    if (!slug) return;
    function visit(node) {
      if ((node.type === 'image' || node.type === 'link') && node.url.startsWith('images/')) node.url = `/works/${slug}/${node.url}`;
      node.children?.forEach(visit);
    }
    visit(tree);
  };
}

// Adapt Markdown media to the separately declared Bazel image outputs.
export default function projectMedia() {
  return async (tree, file) => {
    const filename = String(file.path || '').replaceAll('\\', '/');
    const slug = filename.match(/\/works\/([^/]+)\/index\.md$/)?.[1];
    if (!slug) return;
    const images = JSON.parse(await readFile(path.resolve('processed_images/images.json'), 'utf8'));
    let first = true;
    function visit(node) {
      if (node.type === 'element' && node.tagName === 'iframe') {
        node.properties.title ||= 'Project video';
        node.properties.loading = 'lazy';
      }
      if (!node.children) return;
      node.children = node.children.map(child => {
        if (child.type === 'element' && child.tagName === 'img') {
          const url = child.properties.src.startsWith('images/') ? `/works/${slug}/${child.properties.src}` : child.properties.src;
          const image = images[url];
          if (!image) throw new Error(`Image not declared in build: ${url}`);
          const priority = first;
          first = false;
          const alt = child.properties.alt || file.data.astro?.frontmatter?.title?.split(' - ').slice(1).join(' - ') || slug;
          const element = (tagName, properties, children = []) => ({ type: 'element', tagName, properties, children });
          return element('a', { className: ['gallery-image'], 'data-image': '', href: url }, [
            element('picture', {}, [
              element('source', { type: 'image/webp', srcSet: image.variants.map(variant => `${variant.url} ${variant.width}w`).join(', '), sizes: '(max-width: 700px) calc(100vw - 40px), (max-width: 1296px) calc(100vw - 96px), 1200px' }),
              element('img', { src: url, alt, width: image.width, height: image.height, loading: priority ? 'eager' : 'lazy', ...(priority ? { fetchPriority: 'high' } : {}), decoding: 'async' }),
            ]),
          ]);
        }
        visit(child);
        return child;
      });
    }
    visit(tree);
  };
}
