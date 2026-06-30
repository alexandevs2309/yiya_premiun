import { type ModuleId, useNavigationStore } from '@/stores/navigation-store'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  LayoutDashboard, Grid3X3, ShoppingCart, ChefHat, DollarSign,
  FileText, Package, Users, BarChart3, Settings, ChevronLeft, ChevronRight, Shell,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'

interface NavItem {
  id: ModuleId
  label: string
  icon: React.ElementType
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'floor-plan', label: 'Plano de Mesas', icon: Grid3X3 },
  { id: 'pos', label: 'POS', icon: ShoppingCart },
  { id: 'kds', label: 'Cocina (KDS)', icon: ChefHat },
  { id: 'cashier', label: 'Caja', icon: DollarSign },
  { id: 'invoicing', label: 'Facturación', icon: FileText },
  { id: 'inventory', label: 'Inventario', icon: Package },
  { id: 'customers', label: 'Clientes', icon: Users },
  { id: 'reports', label: 'Reportes', icon: BarChart3 },
  { id: 'settings', label: 'Configuración', icon: Settings },
]

export function Sidebar() {
  const { activeModule, setActiveModule } = useNavigationStore()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <motion.aside
      layout
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className={cn(
        'flex flex-col border-r bg-sidebar h-screen sticky top-0',
        collapsed ? 'w-[68px]' : 'w-[240px]',
      )}
    >
      <div className="flex items-center gap-2 px-4 h-14 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground shadow-sm">
            <Shell className="w-4 h-4" />
          </div>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="font-semibold text-sm tracking-tight text-sidebar-foreground"
            >
              D'Yiya POS
            </motion.span>
          )}
        </div>
      </div>

      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = activeModule === item.id
          return (
            <Button
              key={item.id}
              variant="ghost"
              size={collapsed ? 'icon' : 'default'}
              className={cn(
                'w-full justify-start gap-3 text-sm font-medium transition-all rounded-lg',
                collapsed && 'justify-center px-0',
                isActive
                  ? 'bg-primary/10 text-foreground border-l-[3px] border-primary rounded-l-none'
                  : 'text-sidebar-foreground hover:text-foreground hover:bg-accent/50',
              )}
              onClick={() => setActiveModule(item.id)}
            >
              <Icon className={cn('w-4 h-4 shrink-0', isActive ? 'text-primary' : '')} />
              {!collapsed && (
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  {item.label}
                </motion.span>
              )}
            </Button>
          )
        })}
      </nav>

      <div className="p-2 border-t border-border">
        <Button
          variant="ghost"
          size={collapsed ? 'icon' : 'sm'}
          className="w-full justify-center text-sidebar-foreground hover:text-foreground"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </Button>
      </div>
    </motion.aside>
  )
}
