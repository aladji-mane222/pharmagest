'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

type Theme = 'light' | 'dark'

interface ThemeContextValue {
  theme: Theme
  toggleTheme: () => void
  setTheme: (t: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const CLE_STOCKAGE = 'pharmagest-theme'

// Applique/retire la classe "dark" sur <html> — coherent avec le script
// anti-flash pose dans layout.tsx (voir plus bas) qui fait la meme chose
// AVANT l'hydratation React, pour eviter un flash du mauvais theme au
// chargement.
function appliquerTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Valeur initiale = ce que le script anti-flash a deja mis en place
  // (lit directement le DOM plutot que de re-decider, pour rester
  // coherent avec ce qui est deja affiche a l'ecran).
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'light'
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  })

  const setTheme = (t: Theme) => {
    setThemeState(t)
    localStorage.setItem(CLE_STOCKAGE, t)
    appliquerTheme(t)
  }

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark')

  // Si l'utilisateur n'a jamais choisi manuellement (rien en
  // localStorage) et change la preference de son systeme d'exploitation
  // en cours de session, on suit — sans ecraser un choix manuel deja fait.
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem(CLE_STOCKAGE)) {
        setTheme(e.matches ? 'dark' : 'light')
      }
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme doit etre utilise a l\'interieur de <ThemeProvider>')
  return ctx
}