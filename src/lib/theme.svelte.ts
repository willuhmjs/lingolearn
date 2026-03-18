/**
 * Shared theme state. Import this in +layout.svelte and any page that
 * needs to read or toggle the current theme (e.g. the profile page).
 *
 * Call `initTheme()` once inside `onMount` in the root layout.
 * Call `cycleTheme()` from any toggle button.
 */

let _theme = $state('light');

export const theme = {
  get current() {
    return _theme;
  },
  init() {
    const saved = localStorage.getItem('app-theme');
    if (saved) {
      _theme = saved;
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      _theme = 'dark';
    }
    document.documentElement.setAttribute('data-theme', _theme);
  },
  cycle() {
    _theme = _theme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', _theme);
    localStorage.setItem('app-theme', _theme);
  }
};
