'use client'

import * as React from 'react'
import { createContext, useContext } from 'react'
import { createLogger } from '@helios/shared/lib/logger'

const logger = createLogger('ui').child({ component: 'ThemeProvider' })

export type Theme = 'light' | 'dark' | 'system'
export type Palette = 'warm' | 'classic'

type ThemeContextValue = {
  theme: Theme
  resolvedTheme: 'light' | 'dark'
  setTheme: (theme: Theme) => void
  palette: Palette
  setPalette: (palette: Palette) => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

const THEME_STORAGE_KEY = 'helios-theme'
const PALETTE_STORAGE_KEY = 'helios-palette'

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system'
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored
    }
  } catch (error) {
    // localStorage may be unavailable in private browsing, iframes, or restricted contexts
    // Theme will default to system preference - this is expected graceful degradation
    if (process.env.NODE_ENV === 'development') {
      logger.warn('localStorage read failed', { err: error })
    }
  }
  return 'system'
}

function getStoredPalette(): Palette {
  if (typeof window === 'undefined') return 'warm'
  try {
    const stored = localStorage.getItem(PALETTE_STORAGE_KEY)
    if (stored === 'warm' || stored === 'classic') {
      return stored
    }
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      logger.warn('localStorage palette read failed', { err: error })
    }
  }
  return 'warm'
}

function applyTheme(resolvedTheme: 'light' | 'dark') {
  const root = document.documentElement
  if (resolvedTheme === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
}

function applyPalette(palette: Palette) {
  document.documentElement.dataset.palette = palette
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<Theme>('system')
  const [resolvedTheme, setResolvedTheme] = React.useState<'light' | 'dark'>('light')
  const [palette, setPaletteState] = React.useState<Palette>('warm')
  const [mounted, setMounted] = React.useState(false)

  // Initialize theme from localStorage on mount
  React.useEffect(() => {
    const stored = getStoredTheme()
    const storedPalette = getStoredPalette()
    setThemeState(stored)
    setPaletteState(storedPalette)
    const resolved = stored === 'system' ? getSystemTheme() : stored
    setResolvedTheme(resolved)
    applyTheme(resolved)
    applyPalette(storedPalette)
    setMounted(true)
  }, [])

  // Listen for system theme changes
  React.useEffect(() => {
    if (typeof window === 'undefined') return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      if (theme === 'system') {
        const newResolved = getSystemTheme()
        setResolvedTheme(newResolved)
        applyTheme(newResolved)
      }
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [theme])

  const setTheme = React.useCallback((newTheme: Theme) => {
    setThemeState(newTheme)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme)
    } catch (error) {
      // localStorage may be unavailable - theme still works for this session, just won't persist
      if (process.env.NODE_ENV === 'development') {
        logger.warn('localStorage write failed', { err: error })
      }
    }
    const resolved = newTheme === 'system' ? getSystemTheme() : newTheme
    setResolvedTheme(resolved)
    applyTheme(resolved)
  }, [])

  const setPalette = React.useCallback((newPalette: Palette) => {
    setPaletteState(newPalette)
    try {
      localStorage.setItem(PALETTE_STORAGE_KEY, newPalette)
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        logger.warn('localStorage palette write failed', { err: error })
      }
    }
    applyPalette(newPalette)
  }, [])

  const value = React.useMemo(
    () => ({ theme, resolvedTheme, setTheme, palette, setPalette }),
    [theme, resolvedTheme, setTheme, palette, setPalette]
  )

  // Prevent flash of wrong theme during hydration
  if (!mounted) {
    return <>{children}</>
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    // Return safe defaults when not in provider (e.g., server render)
    return {
      theme: 'system',
      resolvedTheme: 'light',
      setTheme: () => {},
      palette: 'warm',
      setPalette: () => {},
    }
  }
  return context
}
