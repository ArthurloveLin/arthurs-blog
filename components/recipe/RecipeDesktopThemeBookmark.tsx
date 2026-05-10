'use client'

import { BookOpen, FoldHorizontal } from 'lucide-react'
import { useRecipeBookTheme } from './recipe-book-theme-context'

function RecipeDesktopThemeBookmarkSlot() {
  const { isMobile, theme, setTheme } = useRecipeBookTheme()

  if (isMobile) {
    return null
  }

  const isPageTurn = theme === 'page-turn'
  const nextTheme = isPageTurn ? 'pixel' : 'page-turn'

  return (
    <div className="bs-control-bookmark-slot">
      <button
        type="button"
        className="bs-control-bookmark"
        data-variant={isPageTurn ? 'active' : 'muted'}
        onClick={() => setTheme(nextTheme)}
        title={isPageTurn ? '切回像素风书壳' : '切换到纸页翻书风格'}
        aria-label={isPageTurn ? '切回像素风书壳' : '切换到纸页翻书风格'}
      >
        {isPageTurn ? <BookOpen /> : <FoldHorizontal />}
        <span>{isPageTurn ? '像素' : '纸页'}</span>
      </button>
    </div>
  )
}

export default RecipeDesktopThemeBookmarkSlot

export function RecipeDesktopThemeBookmarkGroup() {
  const { isMobile } = useRecipeBookTheme()

  if (isMobile) {
    return null
  }

  return (
    <div className="bs-control-bookmarks" aria-label="书籍风格">
      <RecipeDesktopThemeBookmarkSlot />
    </div>
  )
}