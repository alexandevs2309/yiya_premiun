import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '@/stores/app-store'
import { useNavigationStore } from '@/stores/navigation-store'
import { menu as menuApi, orders as ordersApi, tables } from '@/services/api'
import { formatCurrency, cn } from '@/lib/utils'
import { Search, ShoppingCart, Send, CreditCard, Plus, Minus, Trash2, ArrowLeft, ChevronDown, UtensilsCrossed } from 'lucide-react'
import type { MenuItem, ModifierGroup, ModifierOption } from '@/types'

export function POSPage() {
  const { activeTableId, activeOrderId, menuItems, setMenuItems } = useAppStore()
  const setActiveModule = useNavigationStore((s) => s.setActiveModule)
  const [cat, setCat] = useState('')
  const [search, setSearch] = useState('')
  const [order, setOrder] = useState<import('@/types').Order | null>(null)
  const [modItem, setModItem] = useState<MenuItem | null>(null)
  const [selections, setSelections] = useState<Record<number, ModifierOption[]>>({})

  const fetchOrder = useCallback(async () => {
    if (!activeOrderId) return
    try {
      const data = await ordersApi.get(activeOrderId)
      setOrder(data)
    } catch {}
  }, [activeOrderId])

  useEffect(() => {
    menuApi.list().then(setMenuItems).catch(() => {})
  }, [])

  useEffect(() => {
    if (activeOrderId) fetchOrder()
  }, [activeOrderId, fetchOrder])

  const categories = [...new Set(menuItems.map((i) => i.category_name))]
  const filtered = menuItems.filter(
    (i) => i.is_available && (!cat || i.category_name === cat) &&
      (!search || i.name.toLowerCase().includes(search.toLowerCase())),
  )

  const openModifiers = (item: MenuItem) => {
    if (!item.has_modifiers || !item.modifier_groups?.length) {
      addItem(item)
      return
    }
    setModItem(item)
    const initial: Record<number, ModifierOption[]> = {}
    item.modifier_groups.forEach((g) => { initial[g.id] = [] })
    setSelections(initial)
  }

  const toggleModOption = (groupId: number, opt: ModifierOption) => {
    setSelections((prev) => {
      const group = modItem?.modifier_groups.find((g) => g.id === groupId)
      const current = [...(prev[groupId] || [])]
      const idx = current.findIndex((o) => o.id === opt.id)
      if (idx >= 0) {
        current.splice(idx, 1)
      } else {
        if (group && group.max_selections > 0 && current.length >= group.max_selections) {
          current.shift()
        }
        current.push(opt)
      }
      return { ...prev, [groupId]: current }
    })
  }

  const confirmModifiers = async () => {
    if (!modItem || !activeOrderId) return
    const modifiers_json = Object.values(selections).flat().map((o) => ({
      name: o.name,
      price_adjustment: o.price_adjustment,
    }))
    const extraPrice = modifiers_json.reduce((s, m) => s + m.price_adjustment, 0)
    const basePrice = modItem.effective_price ? parseFloat(modItem.effective_price as any) : modItem.price
    const price = basePrice + extraPrice
    try {
      await ordersApi.addItem(activeOrderId, {
        menu_item: modItem.id,
        name: modItem.name,
        price,
        quantity: 1,
        seat: 1,
        status: 'pending',
        modifiers_json,
      })
      await fetchOrder()
    } catch {}
    setModItem(null)
  }

  const addItem = async (item: MenuItem) => {
    if (!activeOrderId) return
    try {
      await ordersApi.addItem(activeOrderId, {
        menu_item: item.id,
        name: item.name,
        price: item.effective_price ? parseFloat(item.effective_price as any) : item.price,
        quantity: 1,
        seat: 1,
        status: 'pending',
        modifiers_json: [],
      })
      await fetchOrder()
    } catch {}
  }

  const updateQty = async (itemId: string, delta: number) => {
    if (!activeOrderId || !order) return
    const item = order.items.find((i) => i.id === itemId)
    if (!item) return
    const newQty = item.quantity + delta
    if (newQty < 1) return
    try {
      await ordersApi.updateItem(activeOrderId, itemId, { quantity: newQty })
      await fetchOrder()
    } catch {}
  }

  const removeItem = async (itemId: string) => {
    if (!activeOrderId) return
    try {
      await ordersApi.removeItem(activeOrderId, itemId)
      await fetchOrder()
    } catch {}
  }

  const subtotal = order?.items.reduce((s, i) => s + i.price * i.quantity, 0) || 0
  const itbis = subtotal * 0.18
  const propina = subtotal * 0.10
  const total = subtotal + itbis + propina

  if (!activeTableId || !activeOrderId) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-muted flex items-center justify-center">
            <ShoppingCart className="w-8 h-8 text-muted-foreground/50" />
          </div>
          <h2 className="text-lg font-semibold mb-1">Sin mesa seleccionada</h2>
          <p className="text-sm text-muted-foreground mb-4">Selecciona o abre una mesa desde el plano</p>
          <Button onClick={() => setActiveModule('floor-plan')} className="gap-2" size="sm">
            <ArrowLeft className="w-4 h-4" /> Ir al plano
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      <div className="flex-1 p-4 space-y-4 overflow-auto">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" placeholder="Buscar plato..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-3 rounded-lg bg-input border border-border text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all" />
        </div>

        <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1">
          {categories.map((c) => (
            <Button key={c} variant={cat === c ? 'default' : 'outline'} size="sm"
              onClick={() => setCat(c)} className="text-xs whitespace-nowrap shrink-0 rounded-full">{c}</Button>
          ))}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map((item) => (
            <motion.div key={item.id} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Card className="cursor-pointer hover:border-primary/30 transition-colors" onClick={() => openModifiers(item)}>
                <CardContent className="p-3">
                  <div className="h-20 rounded-lg bg-gradient-to-br from-secondary/50 to-secondary/20 flex items-center justify-center mb-2">
                    {item.image ? (
                      <img src={item.image} alt={item.name} className="w-full h-full object-cover rounded-lg" />
                    ) : (
                      <span className="text-2xl opacity-40">🍽️</span>
                    )}
                  </div>
                  <p className="text-sm font-medium truncate">{item.name}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-sm font-bold text-primary">
                      {formatCurrency(item.effective_price ? parseFloat(item.effective_price as any) : item.price)}
                    </span>
                    <div className="flex items-center gap-1">
                      {item.itbis_type === 'gravado' && (
                        <Badge variant="secondary" className="text-[9px] px-1">ITBIS</Badge>
                      )}
                      {item.has_modifiers && (
                        <Badge variant="outline" className="text-[9px] px-1">+</Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="w-80 border-l bg-card flex flex-col">
        <div className="p-4 border-b space-y-1 bg-muted/20">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">
              Mesa {order?.table_number || activeTableId}
            </h3>
            {order?.status === 'open' && (
              <Badge variant="secondary" className="text-[9px]">Abierta</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {order?.items.length || 0} item(s) · {order?.guests || 1} comensal(es)
          </p>
        </div>

        <div className="flex-1 overflow-auto p-3 space-y-1.5">
          <AnimatePresence initial={false}>
            {order?.items.map((item) => (
              <motion.div key={item.id} layout initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                className="flex items-center gap-2 p-2 rounded-lg bg-secondary/10 hover:bg-secondary/20 transition-colors group">
                <div className="flex flex-col items-center gap-0.5">
                  <button onClick={() => updateQty(item.id, 1)}
                    className="w-5 h-5 flex items-center justify-center rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors">
                    <Plus className="w-3 h-3" />
                  </button>
                  <span className="text-xs font-semibold w-5 text-center">{item.quantity}</span>
                  <button onClick={() => updateQty(item.id, -1)}
                    className="w-5 h-5 flex items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                    <Minus className="w-3 h-3" />
                  </button>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{item.name}</p>
                  <span className="text-[11px] text-muted-foreground">{formatCurrency(item.price)}</span>
                  {item.modifiers_json.length > 0 && (
                    <p className="text-[10px] text-muted-foreground truncate">
                      {item.modifiers_json.map((m) => m.name).join(', ')}
                    </p>
                  )}
                </div>
                <button onClick={() => removeItem(item.id)}
                  className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
          {(!order?.items || order.items.length === 0) && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-3">
                <UtensilsCrossed className="w-6 h-6 opacity-40" />
              </div>
              <p className="text-sm font-medium">Carrito vacío</p>
              <p className="text-xs text-muted-foreground/60">Selecciona platos del menú</p>
            </div>
          )}
        </div>

        <div className="p-4 border-t space-y-2 bg-muted/10">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>ITBIS (18%)</span>
            <span>{formatCurrency(itbis)}</span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Propina (10%)</span>
            <span>{formatCurrency(propina)}</span>
          </div>
          <div className="flex justify-between font-bold text-base pt-2 border-t">
            <span>Total</span>
            <span className="text-primary">{formatCurrency(total)}</span>
          </div>

          <div className="flex gap-2 pt-2">
            {order && order.items.length > 0 && order.status === 'open' && (
              <Button size="sm" className="flex-1 gap-1 text-xs"
                onClick={async () => {
                  if (!activeOrderId) return
                  await ordersApi.sendToKitchen(activeOrderId)
                  setActiveModule('kds')
                }}>
                <Send className="w-3 h-3" /> Enviar a cocina
              </Button>
            )}
            <Button size="sm" variant="secondary" className="flex-1 gap-1 text-xs"
              onClick={async () => {
                if (!activeTableId) return
                await tables.requestBill(activeTableId)
                setActiveModule('cashier')
              }}>
              Pedir cuenta
            </Button>
            <Button size="sm" variant="default" className="flex-1 gap-1 text-xs bg-success hover:brightness-110 text-primary-foreground"
              onClick={() => setActiveModule('cashier')}>
              <CreditCard className="w-3 h-3" /> Cobrar
            </Button>
          </div>
        </div>
      </div>

      {modItem && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center"
          onClick={() => setModItem(null)}>
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }}
            className="bg-card border rounded-xl p-6 w-full max-w-md mx-4 max-h-[80vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-lg mb-1">{modItem.name}</h3>
            <p className="text-sm text-muted-foreground mb-4">{formatCurrency(modItem.price)}</p>

            {modItem.modifier_groups?.map((group) => (
              <div key={group.id} className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium">{group.name}</span>
                  {group.is_required && (
                    <Badge variant="secondary" className="text-[9px]">Requerido</Badge>
                  )}
                  {group.max_selections > 0 && (
                    <span className="text-[10px] text-muted-foreground">
                      (máx. {group.max_selections})
                    </span>
                  )}
                </div>
                <div className="space-y-1">
                  {group.options.map((opt) => {
                    const selected = (selections[group.id] || []).some((o) => o.id === opt.id)
                    return (
                      <div key={opt.id}
                        onClick={() => toggleModOption(group.id, opt)}
                        className={cn(
                          'flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-all',
                          selected ? 'bg-primary/10 border border-primary/20' : 'bg-secondary/20 hover:bg-secondary/30',
                        )}>
                        <span className="text-sm">{opt.name}</span>
                        {opt.price_adjustment > 0 && (
                          <span className="text-xs font-medium">+{formatCurrency(opt.price_adjustment)}</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}

            <div className="flex gap-2 mt-4">
              <Button variant="outline" className="flex-1" onClick={() => setModItem(null)}>Cancelar</Button>
              <Button className="flex-1" onClick={confirmModifiers}>
                Agregar ({formatCurrency(modItem.price + Object.values(selections).flat().reduce((s, o) => s + o.price_adjustment, 0))})
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  )
}
