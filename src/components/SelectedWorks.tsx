import { useLayoutEffect, useState } from 'react';
import type { Project } from '../types';
import WorkCard from './WorkCard';

export default function SelectedWorks({ projects, featured }: { projects: Project[]; featured: Project[] }) {
  const [selected, setSelected] = useState<Project[] | null>(null);
  useLayoutEffect(() => {
    const candidates = projects.filter(project => project.cover);
    let previous: string | null = null;
    try { previous = sessionStorage.getItem('selected-work-leading'); } catch {}
    for (let index = candidates.length - 1; index > 0; index--) {
      const other = Math.floor(Math.random() * (index + 1));
      [candidates[index], candidates[other]] = [candidates[other], candidates[index]];
    }
    if (candidates.length > 1 && candidates[0].slug === previous) {
      const other = 1 + Math.floor(Math.random() * (candidates.length - 1));
      [candidates[0], candidates[other]] = [candidates[other], candidates[0]];
    }
    const selection = candidates.slice(0, 3);
    setSelected(selection);
    try { sessionStorage.setItem('selected-work-leading', selection[0]?.slug || ''); } catch {}
  }, [projects]);
  return <div className="featured-grid" data-rotated={selected ? true : undefined}>
    {(selected || featured).map((project, index) => <WorkCard project={project} priority={index === 0} wide={index === 0} key={project.slug} />)}
  </div>;
}
