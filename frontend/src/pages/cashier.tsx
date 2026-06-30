import { useEffect, useRef, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { motion } from 'framer-motion'
import { formatCurrency, cn } from '@/lib/utils'
import { useAppStore } from '@/stores/app-store'
import { useNavigationStore } from '@/stores/navigation-store'
import { api, orders as ordersApi, tables, type ReceiptData } from '@/services/api'
import { Receipt } from '@/components/receipt'
import { ArrowLeft, CheckCircle2, CreditCard, DollarSign, Smartphone, Loader2, Calculator, Printer } from 'lucide-react'
import type { Order } from '@/types'

type PaymentMethod = 'cash' | 'cardnet' | 'tpago' | 'mixed' | null

export function CashierPage() {
  const { activeOrderId, setActiveOrder, setActiveTable } = useAppStore()
  const setActiveModule = useNavigationStore((s) => s.setActiveModule)
  const [order, setOrder] = useState<Order | null>(null)
  const [method, setMethod] = useState<PaymentMethod>(null)
  const [processing, setProcessing] = useState(false)
  const [done, setDone] = useState(false)
  const [cashReceived, setCashReceived] = useState('')

  useEffect(() => {
    if (activeOrderId) {
      ordersApi.get(activeOrderId).then(setOrder).catch(() => {})
    }
  }, [activeOrderId])

  const subtotal = order?.items.reduce((s, i) => s + i.price * i.quantity, 0) || 0
  const itbis = subtotal * 0.18
  const propina = subtotal * 0.10
  const total = subtotal + itbis + propina

  const cashReceivedNum = parseFloat(cashReceived) || 0
  const change = cashReceivedNum - total
  const isValidCash = !(method === 'cash' && cashReceivedNum < total)

  const handlePay = async () => {
    if (!activeOrderId || !method || !order) return
    setProcessing(true)
    try {
      await api('/billing/payments/', {
        method: 'POST',
        body: JSON.stringify({
          order: activeOrderId,
          method,
          subtotal,
          itbis,
          propina,
          total,
          cash_received: method === 'cash' ? cashReceivedNum : null,
          change_given: method === 'cash' && change >= 0 ? change : null,
        }),
      })
      await api(`/pos/orders/${activeOrderId}/`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'paid' }),
      })
      if (order.table) {
        await tables.close(order.table)
      }
    } catch {}
    setProcessing(false)
    setDone(true)
  }

  const handleDone = () => {
    setActiveOrder(null)
    setActiveTable(null)
    setActiveModule('floor-plan')
  }

  if (!activeOrderId && !done) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <CreditCard className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
          <h2 className="text-lg font-semibold mb-1">Sin ticket seleccionado</h2>
          <p className="text-sm text-muted-foreground mb-4">Selecciona una mesa con cuenta lista</p>
          <Button onClick={() => setActiveModule('floor-plan')} className="gap-2" size="sm">
            <ArrowLeft className="w-4 h-4" /> Ir al plano
          </Button>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <DoneScreen orderId={activeOrderId} onDone={handleDone} />
    )
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 p-6 space-y-6 max-w-4xl mx-auto">
      <Button variant="ghost" size="sm" onClick={() => setActiveModule('pos')} className="gap-1">
        <ArrowLeft className="w-3 h-3" /> Volver
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h3 className="font-semibold text-sm">Método de pago</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { id: 'cash' as const, label: 'Efectivo', icon: DollarSign, desc: 'RD$ / US$' },
              { id: 'cardnet' as const, label: 'CardNET', icon: CreditCard, desc: 'Débito / Crédito' },
              { id: 'tpago' as const, label: 'tPago', icon: Smartphone, desc: 'Transferencia' },
              { id: 'mixed' as const, label: 'Mixto', icon: CreditCard, desc: 'Efectivo + Tarjeta' },
            ].map((pm) => {
              const Icon = pm.icon
              const isSelected = method === pm.id
              return (
                <Card key={pm.id} className={cn('cursor-pointer transition-all', isSelected && 'ring-2 ring-primary')}
                  onClick={() => setMethod(pm.id)}>
                  <CardContent className="p-4 text-center">
                    <Icon className="w-8 h-8 mx-auto mb-2" />
                    <p className="text-sm font-medium">{pm.label}</p>
                    <p className="text-[10px] text-muted-foreground">{pm.desc}</p>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {method && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
              {method === 'cash' && (
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">Efectivo recibido</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Calculator className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input type="number" inputMode="decimal" step="0.01" min="0"
                        value={cashReceived}
                        onChange={(e) => setCashReceived(e.target.value)}
                        placeholder="0.00"
                        className="w-full h-12 pl-10 pr-3 rounded-lg bg-secondary/50 border border-border text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-ring" />
                    </div>
                    <Button variant="outline" size="sm" className="shrink-0"
                      onClick={() => setCashReceived(total.toFixed(2))}>
                      Exacto
                    </Button>
                  </div>
                  {cashReceivedNum > 0 && (
                    <div className="flex justify-between text-sm px-1">
                      <span className="text-muted-foreground">Vuelto</span>
                      <span className={cn('font-bold', change >= 0 ? 'text-success' : 'text-destructive')}>
                        {formatCurrency(Math.abs(change))}
                        {change < 0 && ' (falta)'}
                      </span>
                    </div>
                  )}
                </div>
              )}
              <Button size="xl" className="w-full text-base gap-2"
                onClick={handlePay} disabled={processing || !isValidCash}>
                {processing ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                {processing ? 'Procesando...' : `Cobrar ${formatCurrency(total)}`}
              </Button>
            </motion.div>
          )}
        </div>

        <Card>
          <CardContent className="p-6 space-y-3">
            <h3 className="font-semibold text-sm">Resumen</h3>
            <div className="space-y-2 max-h-40 overflow-auto">
              {order?.items.map((item) => (
                <div key={item.id} className="flex justify-between text-xs">
                  <span className="text-muted-foreground truncate mr-2">{item.quantity}x {item.name}</span>
                  <span className="shrink-0">{formatCurrency(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>
            <Separator />
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">ITBIS (18%)</span>
              <span>{formatCurrency(itbis)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Propina (10%)</span>
              <span>{formatCurrency(propina)}</span>
            </div>
            <Separator />
            <div className="flex justify-between font-bold text-lg">
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  )
}

function DoneScreen({ orderId, onDone }: { orderId: string | null; onDone: () => void }) {
  const [receipt, setReceipt] = useState<ReceiptData | null>(null)
  const [loadingReceipt, setLoadingReceipt] = useState(true)
  const receiptRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (orderId) {
      ordersApi.printReceipt(orderId).then(setReceipt).catch(() => {}).finally(() => setLoadingReceipt(false))
    }
  }, [orderId])

  const handlePrint = useCallback(() => {
    if (!receipt) return
    const win = window.open('', '_blank', 'width=400,height=600')
    if (!win) return
    win.document.write(`
      <html><head><title>Recibo</title></head><body>
        ${receiptRef.current?.outerHTML || ''}
        <script>window.onload = function() { window.print(); window.close(); }; window.onafterprint = function() { window.close(); }; <\/script>
      </body></html>
    `)
    win.document.close()
  }, [receipt])

  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
      className="flex-1 flex items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardContent className="p-8 text-center space-y-4">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300 }}>
            <CheckCircle2 className="w-16 h-16 text-success mx-auto mb-4" />
          </motion.div>
          <h2 className="text-xl font-bold mb-1">Pago completado</h2>
          <p className="text-sm text-muted-foreground">Gracias por su visita</p>

          <div className="hidden">
            {receipt && <Receipt ref={receiptRef} data={receipt} />}
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <Button onClick={handlePrint} disabled={!receipt || loadingReceipt} className="w-full gap-2">
              <Printer className="w-4 h-4" />
              {loadingReceipt ? 'Cargando...' : 'Imprimir Recibo'}
            </Button>
            <Button onClick={onDone} variant="outline" className="w-full gap-2">
              <ArrowLeft className="w-4 h-4" /> Volver al plano
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
