import { useEffect, useState, useRef, useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { motion, AnimatePresence } from 'framer-motion'
import { orders as ordersApi } from '@/services/api'
import { cn } from '@/lib/utils'
import {
  ChefHat, CheckCircle2, Bell, BellOff,
  Clock, User, ChefHatIcon,
} from 'lucide-react'
import type { Order, OrderItem } from '@/types'

function playBeep() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 440
    osc.type = 'sine'
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.3)
    osc.onended = () => ctx.close()
  } catch {}
}

function getTimerInfo(elapsed: number) {
  if (elapsed < 20) return { badge: 'bg-[var(--samana)]', border: 'border-[var(--samana)]', pulse: false }
  if (elapsed < 40) return { badge: 'bg-[var(--sol)]', border: 'border-[var(--sol)]', pulse: false }
  return { badge: 'bg-[var(--coral)]', border: 'border-[var(--coral)]', pulse: true }
}

function OrderCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card flex flex-col animate-pulse">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <div className="p-4 space-y-2 flex-1">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
      <div className="p-4 pt-0">
        <Skeleton className="h-8 w-full rounded-lg" />
      </div>
    </div>
  )
}

export function KDSPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [station, setStation] = useState('todo')
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window === 'undefined') return true
    return localStorage.getItem('kds-sound') !== 'off'
  })
  const [prevOrderIds, setPrevOrderIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(Date.now())
  const ws = useRef<WebSocket | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => { localStorage.setItem('kds-sound', soundEnabled ? 'on' : 'off') }, [soundEnabled])

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 10000)
    return () => clearInterval(id)
  }, [])

  const speakOrder = useCallback((order: Order) => {
    if (!window.speechSynthesis) return
    const mesaText = `Mesa ${order.table_number}.`
    const platosText = order.items
      .filter((i) => i.status === 'in_kitchen' || i.status === 'pending')
      .map((i) => `${i.quantity} ${i.name}`)
      .join(', ')
    if (!platosText) return
    const utterance = new SpeechSynthesisUtterance(`${mesaText} prepararse: ${platosText}`)
    utterance.lang = 'es-ES'
    window.speechSynthesis.speak(utterance)
  }, [])

  useEffect(() => {
    const currentIds = orders.map((o) => o.id)
    const newOrders = orders.filter((o) => !prevOrderIds.includes(o.id))
    if (prevOrderIds.length > 0 && newOrders.length > 0) {
      if (soundEnabled) {
        playBeep()
        newOrders.forEach((o) => speakOrder(o))
      }
    }
    setPrevOrderIds(currentIds)
  }, [orders, prevOrderIds, soundEnabled, speakOrder])

  useEffect(() => {
    if (orders.length > 0 && prevOrderIds.length === 0) {
      setPrevOrderIds(orders.map((o) => o.id))
    }
  }, [orders])

  const fetchOrders = useCallback(async () => {
    try {
      const data = await ordersApi.list('?status=in_kitchen')
      setOrders(data)
    } catch {}
  }, [])

  useEffect(() => {
    fetchOrders().finally(() => setLoading(false))

    const host = import.meta.env.VITE_WS_URL
    if (host && host !== 'none') {
      try {
        const socket = new WebSocket(`${host}/ws/kds/`)
        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            if (data.type === 'new_order' || data.type === 'order_update') {
              fetchOrders()
            }
          } catch {}
        }
        ws.current = socket
      } catch {}
    }

    pollRef.current = setInterval(fetchOrders, 10000)

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      try { ws.current?.close() } catch {}
    }
  }, [fetchOrders])

  const pending = orders.filter((o) =>
    station === 'todo' ? true
    : station === 'barra' ? o.items.some((i) => i.status !== 'cancelled')
    : station === 'grill' ? o.items.some((i) => i.status !== 'cancelled')
    : station === 'frio' ? o.items.some((i) => i.status !== 'cancelled')
    : true,
  )

  const markItemComplete = async (orderId: string, itemId: string) => {
    try {
      await ordersApi.completeItem(orderId, itemId)
      setOrders((prev) => prev.map((o) =>
        o.id === orderId ? {
          ...o,
          items: o.items.map((i) => i.id === itemId ? { ...i, status: 'ready' } : i),
        } : o,
      ))
    } catch {}
  }

  const markAllComplete = async (order: Order) => {
    const pending = order.items.filter((i) => i.status !== 'ready' && i.status !== 'cancelled')
    for (const item of pending) {
      await markItemComplete(order.id, item.id)
    }
  }

  const activeItemCount = orders.reduce(
    (sum, o) => sum + o.items.filter((i) => i.status !== 'ready' && i.status !== 'cancelled').length, 0,
  )

  const stations = [
    { id: 'todo', label: 'Todo' },
    { id: 'grill', label: 'Grill' },
    { id: 'barra', label: 'Barra' },
    { id: 'frio', label: 'Frío' },
  ]

  return (
    <div className="p-6 space-y-6 h-full flex flex-col">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold tracking-tight">Cocina</h1>
          <Badge variant="caribe" className="font-normal h-6 gap-1.5">
            <ChefHatIcon className="w-3.5 h-3.5" />
            {activeItemCount} comanda{activeItemCount !== 1 ? 's' : ''} activa{activeItemCount !== 1 ? 's' : ''}
          </Badge>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex gap-1 overflow-x-auto">
            {stations.map((s) => (
              <Button key={s.id} variant={station === s.id ? 'default' : 'outline'} size="sm"
                onClick={() => setStation(s.id)} className="text-xs whitespace-nowrap">
                {s.label}
              </Button>
            ))}
          </div>
          <div className="w-px h-6 bg-border" />
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={cn(soundEnabled && 'border-[var(--samana)] text-[var(--samana)]')}
            title={soundEnabled ? 'Desactivar sonido' : 'Activar sonido'}
          >
            {soundEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
          </Button>
        </div>
      </motion.div>

      {loading ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <OrderCardSkeleton key={i} />)}
        </motion.div>
      ) : pending.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="flex-1 flex flex-col items-center justify-center">
          <div className="w-20 h-20 rounded-full bg-muted/30 flex items-center justify-center mb-6">
            <ChefHat className="w-10 h-10 text-muted-foreground/40" />
          </div>
          <p className="text-lg font-medium text-muted-foreground mb-1">Sin comandas activas</p>
          <p className="text-sm text-[var(--samana)]">La cocina está al día ✓</p>
        </motion.div>
      ) : (
        <motion.div layout className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 flex-1">
          <AnimatePresence mode="popLayout">
            {pending.map((order) => {
              const elapsed = Math.floor((now - new Date(order.created_at).getTime()) / 60000)
              const timer = getTimerInfo(elapsed)
              const nonCancelled = order.items.filter((i) => i.status !== 'cancelled')
              const allReady = nonCancelled.length > 0 && nonCancelled.every((i) => i.status === 'ready')

              return (
                <motion.div key={order.id} layout
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 10 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  className={cn(
                    'rounded-xl border-2 bg-card flex flex-col overflow-hidden',
                    'transition-[border-color] duration-300',
                    timer.border,
                  )}
                >
                  <div className="flex items-center justify-between p-4 pb-3 border-b border-border">
                    <div className="flex items-center gap-3">
                      <span className="text-base font-bold leading-none">Mesa {order.table_number}</span>
                      <span className="text-xs text-muted-foreground hidden sm:inline">
                        {order.waiter_name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <motion.div
                        animate={timer.pulse ? { scale: [1, 1.06, 1] } : {}}
                        transition={timer.pulse ? { repeat: Infinity, duration: 2 } : {}}
                      >
                        <span className={cn(
                          'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium text-white leading-none',
                          timer.badge,
                        )}>
                          <Clock className="w-3 h-3" />
                          {elapsed} min
                        </span>
                      </motion.div>
                      <Button variant="ghost" size="icon-sm"
                        onClick={(e) => { e.stopPropagation(); markAllComplete(order) }}
                        disabled={allReady}
                        className="text-muted-foreground hover:text-[var(--samana)]"
                        title="Marcar todo listo">
                        <CheckCircle2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="p-4 pt-3 space-y-1.5 overflow-y-auto" style={{ maxHeight: 320 }}>
                    {nonCancelled.map((item) => (
                      <KDSItemRow key={item.id} item={item} elapsed={elapsed}
                        onComplete={() => markItemComplete(order.id, item.id)} />
                    ))}
                  </div>

                  <div className="p-4 pt-3 mt-auto border-t border-border">
                    <Button variant="outline" size="sm"
                      className="w-full text-xs gap-1.5 text-muted-foreground hover:text-foreground">
                      <User className="w-3.5 h-3.5" />
                      Llamar mesero
                    </Button>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  )
}

function KDSItemRow({ item, elapsed, onComplete }: {
  item: OrderItem; elapsed: number; onComplete: () => void
}) {
  const isReady = item.status === 'ready'
  const isCancelled = item.status === 'cancelled'
  if (isCancelled) return null

  const hasModifiers = item.modifiers_json.length > 0

  return (
    <motion.div layout
      onClick={onComplete}
      className={cn(
        'flex items-start gap-3 p-2.5 rounded-lg cursor-pointer transition-all duration-150',
        isReady
          ? 'opacity-40'
          : 'hover:bg-muted/30 active:scale-[0.98]',
      )}
    >
      <div className={cn(
        'flex items-center justify-center w-8 h-8 rounded-lg text-sm font-bold shrink-0 leading-none transition-colors',
        isReady
          ? 'bg-[var(--samana)]/10 text-[var(--samana)]'
          : 'bg-muted text-foreground',
      )}>
        {isReady ? <CheckCircle2 className="w-4 h-4" /> : item.quantity}
      </div>

      <div className="flex-1 min-w-0 pt-0.5">
        <span className={cn(
          'text-sm block truncate leading-tight',
          isReady && 'line-through',
        )}>
          {item.name}
        </span>
        {hasModifiers && (
          <span className="text-[11px] text-[var(--coral)] block truncate mt-0.5 leading-tight">
            {item.modifiers_json.map((m) => m.name).join(', ')}
          </span>
        )}
      </div>

      {!isReady && elapsed > 40 && (
        <span className="shrink-0 text-[10px] text-[var(--coral)] font-medium animate-pulse mt-0.5">
          Urgente
        </span>
      )}
    </motion.div>
  )
}
