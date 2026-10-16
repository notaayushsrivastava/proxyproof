(function () {
  const themeToggleBtn = document.getElementById('themeToggle');
  const themeIcon = document.getElementById('themeIcon');
  const htmlEl = document.documentElement;
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const validThemes = new Set(['dark', 'light', 'auto']);

  if (!themeToggleBtn || !themeIcon) return;

  function getStoredTheme() {
    const storedTheme = localStorage.getItem('proxyproof_theme');
    return validThemes.has(storedTheme) ? storedTheme : 'auto';
  }

  function getEffectiveTheme(theme) {
    return theme === 'auto' ? (mediaQuery.matches ? 'dark' : 'light') : theme;
  }

  function setThemeIcon(effectiveTheme) {
    if (effectiveTheme === 'dark') {
      themeIcon.innerHTML =
        '<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.79" y2="19.79"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.79" y2="4.22"></line>';
    } else {
      themeIcon.innerHTML =
        '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>';
    }
  }

  function applyTheme(theme) {
    const selectedTheme = validThemes.has(theme) ? theme : 'auto';
    htmlEl.setAttribute('data-theme', selectedTheme);
    const effectiveTheme = getEffectiveTheme(selectedTheme);
    setThemeIcon(effectiveTheme);
    themeToggleBtn.setAttribute(
      'aria-label',
      `Theme: ${selectedTheme}. Switch to ${
        selectedTheme === 'dark' ? 'light' : selectedTheme === 'light' ? 'system' : 'dark'
      } theme`
    );
    themeToggleBtn.setAttribute('title', `Theme: ${selectedTheme}`);
  }

  function cycleTheme() {
    const currentTheme = getStoredTheme();
    const nextTheme =
      currentTheme === 'dark' ? 'light' : currentTheme === 'light' ? 'auto' : 'dark';
    localStorage.setItem('proxyproof_theme', nextTheme);
    applyTheme(nextTheme);
  }

  applyTheme(getStoredTheme());
  themeToggleBtn.addEventListener('click', cycleTheme);

  const handleSystemThemeChange = () => {
    if (getStoredTheme() === 'auto') applyTheme('auto');
  };

  if (typeof mediaQuery.addEventListener === 'function') {
    mediaQuery.addEventListener('change', handleSystemThemeChange);
  } else {
    mediaQuery.addListener(handleSystemThemeChange);
  }
})();
