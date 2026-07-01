import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User, Table, Order, MenuItem } from '@/types'

interface AppStore {
  user: User | null
  tables: Table[]
  activeTableId: number | null
  activeOrderId: string | null
  menuItems: MenuItem[]
  setUser: (user: User | null) => void
  setTables: (tables: Table[]) => void
  updateTable: (id: number, data: Partial<Table>) => void
  setActiveTable: (id: number | null) => void
  setActiveOrder: (id: string | null) => void
  setMenuItems: (items: MenuItem[]) => void
}

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      user: null,
      tables: [],
      activeTableId: null,
      activeOrderId: null,
      menuItems: [],

      setUser: (user) => set({ user }),
      setTables: (tables) => set({ tables }),
      updateTable: (id, data) =>
        set((state) => ({
          tables: state.tables.map((t) => (t.id === id ? { ...t, ...data } : t)),
        })),
      setActiveTable: (id) => set({ activeTableId: id }),
      setActiveOrder: (id) => set({ activeOrderId: id }),
      setMenuItems: (items) => set({ menuItems: items }),
    }),
    { name: 'dyiya-app' },
  ),
)
