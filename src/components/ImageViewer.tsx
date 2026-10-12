import { useEffect, useRef, useState } from 'react';

export default function ImageViewer() {
  const [viewer, setViewer] = useState<{ images: { src: string; alt: string }[]; index: number } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLAnchorElement | null>(null);
  useEffect(() => {
    const content = document.querySelector('.project-prose');
    function open(event: Event) {
      if (!(event instanceof MouseEvent) || !(event.target instanceof Element)) return;
      const link = event.target.closest<HTMLAnchorElement>('a[data-image]');
      if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const links = Array.from(content!.querySelectorAll<HTMLAnchorElement>('a[data-image]'));
      event.preventDefault();
      trigger.current = link;
      setViewer({ images: links.map(item => ({ src: item.getAttribute('href')!, alt: item.querySelector('img')?.alt || '' })), index: links.indexOf(link) });
    }
    content?.addEventListener('click', open);
    return () => content?.removeEventListener('click', open);
  }, []);
  useEffect(() => {
    if (viewer && dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [viewer]);
  function navigate(direction: number) {
    setViewer(current => current && ({ ...current, index: (current.index + direction + current.images.length) % current.images.length }));
  }
  return <dialog ref={dialog} className="image-viewer" aria-label="Image viewer" onClose={() => { setViewer(null); trigger.current?.focus(); }} onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }} onKeyDown={event => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      navigate(event.key === 'ArrowRight' ? 1 : -1);
    }
  }}>
    {viewer && <div className="viewer-content">
      <div className="viewer-toolbar"><span>{viewer.index + 1} / {viewer.images.length}</span><button autoFocus onClick={() => dialog.current?.close()} aria-label="Close image viewer">Close <span aria-hidden="true">×</span></button></div>
      <img src={viewer.images[viewer.index].src} alt={viewer.images[viewer.index].alt} />
      {viewer.images.length > 1 && <div className="viewer-navigation"><button onClick={() => navigate(-1)}>← Previous</button><button onClick={() => navigate(1)}>Next →</button></div>}
    </div>}
  </dialog>;
}
