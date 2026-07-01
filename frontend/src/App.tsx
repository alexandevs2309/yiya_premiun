import { useEffect, lazy, Suspense } from 'react'
import { useAppStore } from '@/stores/app-store'
import { useNavigationStore } from '@/stores/navigation-store'
import { useThemeStore, applyTheme } from '@/stores/theme-store'
import { LoginPage } from '@/pages/login'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { motion, AnimatePresence } from 'framer-motion'
import { ToastContainer } from '@/components/ui/toast'

const FloorPlanPage = lazy(() => import('@/pages/floor-plan').then(m => ({ default: m.FloorPlanPage })))
const POSPage = lazy(() => import('@/pages/pos').then(m => ({ default: m.POSPage })))
const KDSPage = lazy(() => import('@/pages/kds').then(m => ({ default: m.KDSPage })))
const CashierPage = lazy(() => import('@/pages/cashier').then(m => ({ default: m.CashierPage })))
const InvoicingPage = lazy(() => import('@/pages/invoicing').then(m => ({ default: m.InvoicingPage })))
const DashboardPage = lazy(() => import('@/pages/dashboard').then(m => ({ default: m.DashboardPage })))
const SettingsPage = lazy(() => import('@/pages/settings').then(m => ({ default: m.SettingsPage })))
const InventoryPage = lazy(() => import('@/pages/inventory').then(m => ({ default: m.InventoryPage })))
const CustomersPage = lazy(() => import('@/pages/customers').then(m => ({ default: m.CustomersPage })))
const ReportsPage = lazy(() => import('@/pages/reports').then(m => ({ default: m.ReportsPage })))

const pages: Record<string, React.LazyExoticComponent<React.ComponentType>> = {
  dashboard: DashboardPage,
  'floor-plan': FloorPlanPage,
  pos: POSPage,
  kds: KDSPage,
  cashier: CashierPage,
  invoicing: InvoicingPage,
  settings: SettingsPage,
  inventory: InventoryPage,
  customers: CustomersPage,
  reports: ReportsPage,
}

function PageLoader() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function POSLayout() {
  const { activeModule } = useNavigationStore()
  const { theme } = useThemeStore()
  const Page = pages[activeModule]

  useEffect(() => { applyTheme(theme) }, [theme])

  useEffect(() => {
    const path = activeModule === 'dashboard' ? '/' : `/${activeModule}`
    window.history.replaceState(null, '', path)
  }, [activeModule])

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <ToastContainer />
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
              <Suspense fallback={<PageLoader />}>
                {Page ? <Page /> : (
                  <div className="flex-1 flex items-center justify-center text-muted-foreground">
                    <p className="text-lg">{activeModule} — Próximamente</p>
                  </div>
                )}
              </Suspense>
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
