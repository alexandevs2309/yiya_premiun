import { useNavigationStore } from '@/stores/navigation-store'
import { useAppStore } from '@/stores/app-store'
import { useThemeStore, applyTheme } from '@/stores/theme-store'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useEffect, useState, useRef, useCallback } from 'react'
import { Sun, Moon, Bell, LogOut, ChevronDown, Wifi, WifiOff, Glasses } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { clearTokens, getOfflineQueue } from '@/services/api'

function ClockDisplay() {
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  const hours = time.getHours()
  const greeting = hours < 12 ? 'Buenos días' : hours < 18 ? 'Buenas tardes' : 'Buenas noches'
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span suppressHydrationWarning>
        {time.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' })}
      </span>
      <span className="hidden lg:inline text-muted-foreground/60">· {greeting}</span>
    </div>
  )
}

function NetworkStatus() {
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [queueCount, setQueueCount] = useState(0);

  const updateQueueCount = useCallback(async () => {
    const queue = await getOfflineQueue();
    setQueueCount(queue.length);
  }, []);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    const handleQueueChange = () => {
      updateQueueCount();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('offline-queue-changed', handleQueueChange);

    updateQueueCount();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('offline-queue-changed', handleQueueChange);
    };
  }, [updateQueueCount]);

  if (online && queueCount === 0) {
    return (
      <Badge variant="secondary" className="bg-success/15 text-success hover:bg-success/20 border-success/30 flex items-center gap-1 text-[10px] h-5">
        <Wifi className="w-3 h-3" /> Online
      </Badge>
    );
  }

  return (
    <Badge variant="destructive" className={cn(
      "flex items-center gap-1 text-[10px] h-5 font-normal",
      !online && "animate-pulse"
    )}>
      <WifiOff className="w-3 h-3" />
      {!online ? 'Offline' : 'Sincronizando'}
      {queueCount > 0 && ` (${queueCount})`}
    </Badge>
  );
}

export function Header() {
  const { activeModule } = useNavigationStore()
  const { user, setUser, solMode, toggleSolMode } = useAppStore()
  const { theme, toggleTheme } = useThemeStore()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleLogout = () => {
    clearTokens()
    setUser(null)
  }

  const moduleNames: Record<string, string> = {
    dashboard: 'Dashboard',
    'floor-plan': 'Plano de Mesas',
    pos: 'Punto de Venta',
    kds: 'Cocina (KDS)',
    cashier: 'Caja',
    invoicing: 'Facturación Electrónica',
    inventory: 'Inventario',
    customers: 'Clientes',
    reports: 'Reportes',
    settings: 'Configuración',
  }

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="flex items-center justify-between h-14 px-4 sm:px-6 border-b bg-background/80 backdrop-blur-md sticky top-0 z-40"
    >
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <motion.h1
          key={activeModule}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="text-base sm:text-lg font-semibold tracking-tight truncate"
        >
          {moduleNames[activeModule] || activeModule}
        </motion.h1>
        <Badge variant="secondary" className="text-[10px] font-normal hidden sm:inline-flex h-5">
          Samaná
        </Badge>
        {user && (
          <Badge variant="outline" className="text-[10px] capitalize hidden sm:inline-flex h-5">
            {user.role}
          </Badge>
        )}
        <NetworkStatus />
      </div>

      <div className="flex items-center gap-1">
        <div className="hidden sm:flex items-center">
          <ClockDisplay />
        </div>

        <Button variant="ghost" size="icon" onClick={toggleTheme} title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
          className="text-muted-foreground hover:text-foreground">
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </Button>

        <Button variant="ghost" size="icon" onClick={toggleSolMode} title={solMode ? 'Desactivar Modo Sol (Exterior)' : 'Activar Modo Sol (Exterior)'}
          className={cn(
            "text-muted-foreground hover:text-foreground",
            solMode && "text-warning hover:text-warning"
          )}>
          <Glasses className="w-4 h-4" />
        </Button>

        <Button variant="ghost" size="icon" className="relative hidden sm:flex text-muted-foreground hover:text-foreground" title="Notificaciones">
          <Bell className="w-4 h-4" />
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-destructive rounded-full ring-2 ring-background" />
        </Button>

        {user && (
          <div className="relative ml-1" ref={dropdownRef}>
            <Button variant="ghost" onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 pl-2 sm:pl-3 border-l border-border h-auto py-1.5 rounded-lg"
            >
              <Avatar className="w-8 h-8 ring-2 ring-primary/20">
                <AvatarFallback className="text-xs font-semibold bg-gradient-to-br from-primary to-dorado-champan-400 text-primary-foreground">
                  {user.first_name?.[0] || user.username[0]}
                </AvatarFallback>
              </Avatar>
              <div className="hidden md:block text-left">
                <p className="text-xs font-medium leading-tight">{user.first_name || user.username}</p>
                <p className="text-[10px] text-muted-foreground capitalize">{user.role}</p>
              </div>
              <ChevronDown className={cn('w-3 h-3 text-muted-foreground transition-transform hidden md:block', dropdownOpen && 'rotate-180')} />
            </Button>

            <AnimatePresence>
              {dropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.96 }}
                  transition={{ duration: 0.12 }}
                  className="absolute right-0 top-full mt-1.5 w-52 rounded-xl border bg-popover p-1.5 shadow-lg z-50"
                >
                  <div className="px-3 py-2.5 border-b border-border mb-1">
                    <p className="text-sm font-medium text-foreground truncate">{user.first_name} {user.last_name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
                  </div>
                  <Button variant="ghost" onClick={handleLogout}
                    className="flex items-center gap-2.5 w-full justify-start text-sm rounded-lg text-muted-foreground hover:text-destructive"
                  >
                    <LogOut className="w-4 h-4" />
                    Cerrar sesión
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.header>
  )
}
