import { useEffect, useState, useRef, useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'
import { orders as ordersApi } from '@/services/api'
import { cn } from '@/lib/utils'
import { ChefHat, CheckCircle2, Volume2, VolumeX } from 'lucide-react'
import type { Order } from '@/types'

export function KDSPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [station, setStation] = useState('todas')
  const [audioEnabled, setAudioEnabled] = useState(false)
  const [prevOrderIds, setPrevOrderIds] = useState<string[]>([])
  const ws = useRef<WebSocket | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

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
    if (!audioEnabled) return
    
    const currentIds = orders.map((o) => o.id)
    const newOrders = orders.filter((o) => !prevOrderIds.includes(o.id))
    
    if (prevOrderIds.length > 0 && newOrders.length > 0) {
      newOrders.forEach((o) => {
        speakOrder(o)
      })
    }
    
    setPrevOrderIds(currentIds)
  }, [orders, prevOrderIds, audioEnabled, speakOrder])

  // Inicializar IDs de órdenes al cargar por primera vez
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
    fetchOrders()

    // WebSocket para actualizaciones en tiempo real (requiere Daphne + ASGI).
    // En desarrollo con runserver estándar no hay soporte WebSocket.
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
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

    // Polling como fallback (siempre activo)
    pollRef.current = setInterval(fetchOrders, 10000)

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      try { ws.current?.close() } catch {}
    }
  }, [fetchOrders])

  const pending = orders.filter((o) =>
    station === 'todas' ? true :
    station === 'cocina' ? o.items.some((i) => i.status !== 'cancelled') : true
  )

  const completeItem = async (orderId: string, itemId: string) => {
    try {
      await ordersApi.completeItem(orderId, itemId)
      setOrders((prev) => prev.map((o) =>
        o.id === orderId ? {
          ...o,
          items: o.items.map((i) => i.id === itemId ? { ...i, status: 'ready' } : i),
        } : o
      ))
    } catch {}
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex gap-2 overflow-x-auto">
          {['todas', 'cocina', 'barra'].map((s) => (
            <Button key={s} variant={station === s ? 'default' : 'outline'} size="sm"
              onClick={() => setStation(s)} className="text-xs whitespace-nowrap">
              {s === 'todas' ? 'Todas' : s === 'cocina' ? 'Cocina' : 'Barra'}
              <Badge variant="secondary" className="text-[10px] ml-1">{s === 'todas' ? orders.length : orders.filter(o => o.items.length).length}</Badge>
            </Button>
          ))}
        </div>

        <Button variant={audioEnabled ? 'default' : 'outline'} size="sm"
          onClick={() => setAudioEnabled(!audioEnabled)} className="flex items-center gap-1.5 text-xs w-fit">
          {audioEnabled ? (
            <>
              <Volume2 className="w-4 h-4 text-success shrink-0" />
              <span>Voz Activa</span>
            </>
          ) : (
            <>
              <VolumeX className="w-4 h-4 text-muted-foreground shrink-0" />
              <span>Activar Alertas de Voz</span>
            </>
          )}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
        {pending.map((order) => (
          <motion.div key={order.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="rounded-xl border-2 border-border bg-card p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-base">Mesa {order.table_number}</h3>
                <p className="text-xs text-muted-foreground">{order.waiter_name} · {order.guests} pers</p>
              </div>
              <Badge variant="outline" className="text-[10px]">Hace {Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000)} min</Badge>
            </div>

            <div className="space-y-1">
              {order.items.filter((i) => i.status !== 'cancelled').map((item) => (
                <div key={item.id}
                  onClick={() => completeItem(order.id, item.id)}
                  className={cn(
                    'flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-all',
                    item.status === 'ready' ? 'bg-success/10 line-through text-muted-foreground' : 'bg-secondary/30 hover:bg-secondary/50',
                  )}>
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {item.status === 'ready' ? (
                      <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <span className="text-sm font-medium truncate block">{item.name}</span>
                      {item.modifiers_json.length > 0 && (
                        <p className="text-[11px] text-muted-foreground truncate">
                          {item.modifiers_json.map((m) => m.name).join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-[10px] shrink-0 ml-2">x{item.quantity}</Badge>
                </div>
              ))}
            </div>

            {order.notes && (
              <div className="mt-3 p-2.5 rounded-lg bg-warning/5 border border-warning/10 text-xs text-warning">
                {order.notes}
              </div>
            )}
          </motion.div>
        ))}

        {pending.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-20 text-muted-foreground">
            <ChefHat className="w-16 h-16 mb-4 opacity-30" />
            <p className="text-lg font-medium">Todo al día</p>
            <p className="text-sm">No hay órdenes pendientes</p>
          </div>
        )}
      </div>
    </motion.div>
  )
}
