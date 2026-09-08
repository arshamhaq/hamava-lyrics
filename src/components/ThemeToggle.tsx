import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

export function ThemeToggle() {
  const [theme, setTheme] = useState(
    document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
  )
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)')
    const sync = () => {
      let saved
      try {
        saved = localStorage.getItem('hamava:theme')
      } catch {
        /* Use device preference. */
      }
      setTheme(saved === 'light' || saved === 'dark' ? saved : media.matches ? 'dark' : 'light')
    }
    media.addEventListener('change', sync)
    window.addEventListener('storage', sync)
    return () => {
      media.removeEventListener('change', sync)
      window.removeEventListener('storage', sync)
    }
  }, [])
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#11101b' : '#f7f5f2')
  }, [theme])
  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    try {
      localStorage.setItem('hamava:theme', next)
    } catch {
      /* Still usable for this visit. */
    }
    setTheme(next)
  }
  return (
    <button
      className="theme-toggle icon-button"
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
      onClick={toggle}
    >
      {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  )
}
