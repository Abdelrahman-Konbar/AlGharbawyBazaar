import { createContext, useContext } from 'react'

export type RouteName = 'dashboard' | 'pos' | 'sales' | 'products' | 'product' | 'inventory' | 'movements' | 'reports' | 'settings'
export interface Route { name: RouteName; id?: string; q?: string }
export interface Nav {
  route: Route
  go: (r: Route) => void
  openProductForm: (id?: string) => void
  openStock: (mode: 'receive' | 'adjust', productId?: string) => void
  openSale: (id: string) => void
}
export const NavCtx = createContext<Nav>(null as any)
export const useNav = () => useContext(NavCtx)
