const toggle = document.querySelector<HTMLButtonElement>('.theme-toggle');

if (toggle) {
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  let followsSystem = true;

  const applyTheme = (dark: boolean) => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    const label = `Switch to ${dark ? 'light' : 'dark'} mode`;
    toggle.setAttribute('aria-label', label);
    toggle.title = label;
  };

  applyTheme(system.matches);
  toggle.hidden = false;

  toggle.addEventListener('click', () => {
    followsSystem = false;
    applyTheme(document.documentElement.dataset.theme !== 'dark');
  });

  system.addEventListener('change', () => {
    if (followsSystem) applyTheme(system.matches);
  });

  // A page restored by Back/Forward should also start from the system theme.
  window.addEventListener('pageshow', event => {
    if (event.persisted) {
      followsSystem = true;
      applyTheme(system.matches);
    }
  });
}
