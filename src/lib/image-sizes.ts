import type { ImageAsset } from '../types';

export function cardImageSizes(image: ImageAsset, wide = false) {
  // object-fit crops wide photos. Account for that crop when choosing a source.
  const aspect = image.width / image.height;
  const mobileScale = Math.max(1, aspect / 1.5);
  const desktopScale = Math.max(1, aspect / (wide ? 1.85 : 1.5));
  const desktopWidth = wide ? '(100vw - 96px)' : '((100vw - 128px) / 2)';
  return `(max-width: 700px) calc((100vw - 40px) * ${mobileScale}), (max-width: 1296px) calc(${desktopWidth} * ${desktopScale}), ${Math.ceil((wide ? 1200 : 584) * desktopScale)}px`;
}
