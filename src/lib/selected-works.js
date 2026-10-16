{
  const grid = document.querySelector('.featured-grid');
  const candidates = Array.from(document.querySelectorAll('template[data-work]'));
  let previous = null;
  try { previous = sessionStorage.getItem('selected-work-leading'); } catch {}
  for (let index = candidates.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1));
    [candidates[index], candidates[other]] = [candidates[other], candidates[index]];
  }
  if (candidates.length > 1 && candidates[0].dataset.work === previous) {
    const other = 1 + Math.floor(Math.random() * (candidates.length - 1));
    [candidates[0], candidates[other]] = [candidates[other], candidates[0]];
  }
  const selection = candidates.slice(0, 3);
  const cards = selection.map((template, index) => {
    const card = template.content.cloneNode(true);
    if (index === 0) {
      card.querySelector('source').sizes = template.dataset.wideSizes;
      const image = card.querySelector('img');
      image.loading = 'eager';
      image.fetchPriority = 'high';
    }
    return card;
  });
  grid.replaceChildren(...cards);
  grid.dataset.rotated = 'true';
  try { sessionStorage.setItem('selected-work-leading', selection[0]?.dataset.work || ''); } catch {}
}
