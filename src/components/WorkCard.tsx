import type { Project } from '../types';
import { cardImageSizes } from '../lib/image-sizes';

export default function WorkCard({ project, priority = false, wide = false }: { project: Project; priority?: boolean; wide?: boolean }) {
  return <article className="work-card">
    <a href={project.url} className="work-image" aria-label={project.name}>
      {project.cover && <picture>
        <source type="image/webp" srcSet={project.cover.variants.map(variant => `${variant.url} ${variant.width}w`).join(', ')} sizes={cardImageSizes(project.cover, wide)} />
        <img src={project.cover.src} alt={project.coverAlt} width={project.cover.width} height={project.cover.height} loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : 'auto'} decoding="async" />
      </picture>}
    </a>
    <div className="work-caption">
      <h3><a href={project.url}>{project.name}</a></h3>
      <span>{project.year}<span className="event"> · {project.event}</span></span>
    </div>
  </article>;
}
