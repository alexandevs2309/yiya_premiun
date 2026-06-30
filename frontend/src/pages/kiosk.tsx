import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { motion, AnimatePresence } from 'framer-motion'
import { formatCurrency } from '@/lib/utils'
import { api } from '@/services/api'
import { Shell, Plus, Minus, ShoppingCart, Send, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'

interface KioskItem {
  id: number
  name: string
  price: number
  itbis_type: string
  preparation_time: number
}

interface KioskCategory {
  id: number
  name: string
  items: KioskItem[]
}

interface KioskTable {
  id: number
  number: string
  section: string
  capacity: number
}

interface CartItem {
  menu_item: number
  name: string
  price: number
  quantity: number
}

export function KioskPage() {
  const [token, setToken] = useState('')
  const [table, setTable] = useState<KioskTable | null>(null)
  const [categories, setCategories] = useState<KioskCategory[]>([])
  const [cat, setCat] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const t = params.get('token')
    if (!t) {
      setError('Token de mesa no encontrado')
      setLoading(false)
      return
    }
    setToken(t)
    Promise.all([
      api<KioskTable>(`/pos/kiosk/table/${t}/`).then(setTable).catch(() => setError('Mesa no encontrada')),
      api<KioskCategory[]>('/pos/kiosk/menu/').then(setCategories).catch(() => {}),
    ]).finally(() => setLoading(false))
  }, [])

  const addToCart = (item: KioskItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.menu_item === item.id)
      if (existing) {
        return prev.map((c) => c.menu_item === item.id ? { ...c, quantity: c.quantity + 1 } : c)
      }
      return [...prev, { menu_item: item.id, name: item.name, price: item.price, quantity: 1 }]
    })
  }

  const updateQty = (menuItem: number, delta: number) => {
    setCart((prev) => {
      const next = prev.map((c) =>
        c.menu_item === menuItem ? { ...c, quantity: Math.max(0, c.quantity + delta) } : c,
      ).filter((c) => c.quantity > 0)
      return next
    })
  }

  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0)
  const itbis = subtotal * 0.18
  const total = subtotal + itbis

  const handleSubmit = async () => {
    if (!token || cart.length === 0) return
    setSubmitting(true)
    try {
      await api('/pos/kiosk/orders/', {
        method: 'POST',
        body: JSON.stringify({
          table_token: token,
          items: cart.map((c) => ({ menu_item: c.menu_item, quantity: c.quantity })),
          guests: 1,
        }),
      })
      setDone(true)
    } catch (e: any) {
      setError(e.message || 'Error al enviar orden')
    }
    setSubmitting(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-sky-50 to-white">
        <Loader2 className="w-8 h-8 animate-spin text-sky-600" />
      </div>
    )
  }

  if (error && !table) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-sky-50 to-white p-4">
        <Card className="w-full max-w-sm">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-400" />
            <h2 className="text-lg font-bold mb-1">Error</h2>
            <p className="text-sm text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-sky-50 to-white p-4">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <Card className="w-full max-w-sm">
            <CardContent className="p-8 text-center">
              <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-emerald-500" />
              <h2 className="text-xl font-bold mb-1">¡Orden enviada!</h2>
              <p className="text-sm text-muted-foreground mb-6">Tu orden está en preparación</p>
              <div className="space-y-1 text-xs text-muted-foreground">
                <p>Mesa {table?.number}</p>
                <p>{cart.length} item(s) · {formatCurrency(total)}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    )
  }

  const filteredCategories = categories.map((c) => ({
    ...c,
    items: c.items.filter((i) => !cat || c.name === cat),
  })).filter((c) => c.items.length > 0)

  const allCats = categories.map((c) => c.name)

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white">
      <div className="max-w-4xl mx-auto p-4 pb-32">
        <div className="text-center py-6">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Shell className="w-5 h-5 text-sky-600" />
            <h1 className="text-xl font-bold">D'Yiya Restaurant</h1>
          </div>
          {table && (
            <p className="text-sm text-muted-foreground">
              Mesa {table.number} · {table.section} · {table.capacity} pers.
            </p>
          )}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-4">
          {allCats.map((c) => (
            <Button key={c} variant={cat === c ? 'default' : 'outline'} size="sm"
              onClick={() => setCat(c)} className="text-xs whitespace-nowrap shrink-0">{c}</Button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <AnimatePresence mode="popLayout">
            {filteredCategories.flatMap((c) =>
              c.items.map((item) => (
                <motion.div key={item.id} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
                  <Card className="cursor-pointer" onClick={() => addToCart(item)}>
                    <CardContent className="p-3">
                      <div className="h-16 rounded-lg bg-sky-100 flex items-center justify-center mb-2 text-xl">
                        🍽️
                      </div>
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-sm font-bold text-sky-700">{formatCurrency(item.price)}</span>
                        <Badge variant="secondary" className="text-[9px]">{item.preparation_time}min</Badge>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-2xl p-4">
        <div className="max-w-4xl mx-auto">
          {cart.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">Selecciona platos del menú</p>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1 max-h-32 overflow-auto">
                {cart.map((item) => (
                  <div key={item.menu_item} className="flex items-center justify-between text-sm">
                    <span className="truncate flex-1">{item.name}</span>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <Button variant="outline" size="icon" className="w-6 h-6"
                        onClick={() => updateQty(item.menu_item, -1)}>
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className="w-6 text-center font-medium">{item.quantity}</span>
                      <Button variant="outline" size="icon" className="w-6 h-6"
                        onClick={() => updateQty(item.menu_item, 1)}>
                        <Plus className="w-3 h-3" />
                      </Button>
                      <span className="w-16 text-right font-medium">{formatCurrency(item.price * item.quantity)}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-sm font-semibold border-t pt-2">
                <span>Total</span>
                <span>{formatCurrency(total)}</span>
              </div>
              <Button className="w-full gap-2" size="lg" onClick={handleSubmit} disabled={submitting}>
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                {submitting ? 'Enviando...' : 'Enviar a cocina'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
