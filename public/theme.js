// Runs before the stylesheet/React so a saved dark theme never flashes light.
;(() => {
  let saved
  try {
    saved = localStorage.getItem('hamava:theme')
  } catch {
    /* Storage can be disabled. */
  }
  const theme = saved === 'light' || saved === 'dark' ? saved : 'dark'
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'dark' ? '#0b1222' : '#eee9e1')
})()
