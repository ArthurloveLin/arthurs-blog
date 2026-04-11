'use client'

import { createContext, use, useCallback, useMemo, useState, type ReactNode } from 'react'

export type DrawerType = 'author' | 'categories' | 'tags' | 'recent' | 'archive' | 'tools' | null

interface NavbarUiStateValue {
  activeDrawer: DrawerType
  isMobileMenuOpen: boolean
  closeMobileMenu: () => void
  closeDrawer: () => void
  setActiveDrawer: (drawer: DrawerType) => void
  setIsMobileMenuOpen: (isOpen: boolean) => void
  toggleDrawer: (drawer: Exclude<DrawerType, null>) => void
}

const NavbarUiStateContext = createContext<NavbarUiStateValue | null>(null)

export function NavbarUiStateProvider({ children }: { children: ReactNode }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [activeDrawer, setActiveDrawer] = useState<DrawerType>(null)

  const closeMobileMenu = useCallback(() => {
    setIsMobileMenuOpen(false)
  }, [])

  const closeDrawer = useCallback(() => {
    setActiveDrawer(null)
  }, [])

  const toggleDrawer = useCallback((drawer: Exclude<DrawerType, null>) => {
    setActiveDrawer((current) => current === drawer ? null : drawer)
  }, [])

  const value = useMemo(() => ({
    activeDrawer,
    isMobileMenuOpen,
    closeMobileMenu,
    closeDrawer,
    setActiveDrawer,
    setIsMobileMenuOpen,
    toggleDrawer,
  }), [activeDrawer, closeDrawer, closeMobileMenu, isMobileMenuOpen, toggleDrawer])

  return (
    <NavbarUiStateContext.Provider value={value}>
      {children}
    </NavbarUiStateContext.Provider>
  )
}

export function useNavbarUiState() {
  const context = use(NavbarUiStateContext)
  if (!context) {
    throw new Error('useNavbarUiState must be used within a NavbarUiStateProvider')
  }
  return context
}