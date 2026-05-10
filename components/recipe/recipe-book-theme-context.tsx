'use client'

import { createContext, useContext } from 'react'

export type RecipeBookTheme = 'pixel' | 'page-turn'

interface RecipeBookThemeContextValue {
  isMobile: boolean
  theme: RecipeBookTheme
  setTheme: (theme: RecipeBookTheme) => void
}

const RecipeBookThemeContext = createContext<RecipeBookThemeContextValue | null>(null)

export function RecipeBookThemeProvider({
  value,
  children,
}: {
  value: RecipeBookThemeContextValue
  children: React.ReactNode
}) {
  return <RecipeBookThemeContext.Provider value={value}>{children}</RecipeBookThemeContext.Provider>
}

export function useRecipeBookTheme() {
  const value = useContext(RecipeBookThemeContext)

  if (!value) {
    throw new Error('useRecipeBookTheme must be used within RecipeBookThemeProvider')
  }

  return value
}