import { useEffect } from 'react'
import { useAppStore } from '@/stores/app-store'
import { useNavigationStore } from '@/stores/navigation-store'
import { useThemeStore, applyTheme } from '@/stores/theme-store'
import { LoginPage } from '@/pages/login'
import { FloorPlanPage } from '@/pages/floor-plan'
import { POSPage } from '@/pages/pos'
import { KDSPage } from '@/pages/kds'
import { CashierPage } from '@/pages/cashier'
import { InvoicingPage } from '@/pages/invoicing'
import { DashboardPage } from '@/pages/dashboard'
import { SettingsPage } from '@/pages/settings'
import { InventoryPage } from '@/pages/inventory'
import { CustomersPage } from '@/pages/customers'
import { ReportsPage } from '@/pages/reports'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

const pages: Record<string, React.ReactNode> = {
  dashboard: <DashboardPage />,
  'floor-plan': <FloorPlanPage />,
  pos: <POSPage />,
  kds: <KDSPage />,
  cashier: <CashierPage />,
  invoicing: <InvoicingPage />,
  settings: <SettingsPage />,
  inventory: <InventoryPage />,
  customers: <CustomersPage />,
  reports: <ReportsPage />,
}

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex-1 flex items-center justify-center text-muted-foreground">
      <p className="text-lg">{title} — Próximamente</p>
    </div>
  )
}

function POSLayout() {
  const { solMode } = useAppStore()
  const { activeModule } = useNavigationStore()
  const theme = useThemeStore((s) => s.theme)

  useEffect(() => { applyTheme(theme) }, [theme])

  useEffect(() => {
    const path = activeModule === 'dashboard' ? '/' : `/${activeModule}`
    window.history.replaceState(null, '', path)
  }, [activeModule])

  return (
    <div className={cn('flex h-screen overflow-hidden', solMode && 'sol-mode')}>
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 overflow-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeModule}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.15 }}
              className="h-full"
            >
              {pages[activeModule] || <PlaceholderPage title={activeModule} />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}

export default function App() {
  const user = useAppStore((s) => s.user)

  if (!user) return <LoginPage />

  return <POSLayout />
}
