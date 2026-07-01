import { useEffect, useState, useCallback, useRef } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '@/stores/app-store'
import { useNavigationStore } from '@/stores/navigation-store'
import { menu as menuApi, orders as ordersApi, tables } from '@/services/api'
import { formatCurrency, cn } from '@/lib/utils'
import {
  Search, ShoppingCart, Send, CreditCard, Plus,
  Minus, Trash2, ArrowLeft, UtensilsCrossed, X,
} from 'lucide-react'
import type { MenuItem, ModifierGroup, ModifierOption, OrderItem } from '@/types'

const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string; active: string }> = {
  Entradas: { bg: 'bg-[var(--coral)]/10', border: 'border-[var(--coral)]/30', text: 'text-[var(--coral)]', active: 'bg-[var(--coral)] text-white' },
  Pescados: { bg: 'bg-[var(--caribe)]/10', border: 'border-[var(--caribe)]/30', text: 'text-[var(--caribe)]', active: 'bg-[var(--caribe)] text-white' },
  Mariscos: { bg: 'bg-[var(--samana)]/10', border: 'border-[var(--samana)]/30', text: 'text-[var(--samana)]', active: 'bg-[var(--samana)] text-white' },
  Criolla: { bg: 'bg-[var(--sol)]/10', border: 'border-[var(--sol)]/30', text: 'text-[var(--sol)]', active: 'bg-[var(--sol)] text-white' },
  Bebidas: { bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-400', active: 'bg-purple-500 text-white' },
  Postres: { bg: 'bg-pink-500/10', border: 'border-pink-500/30', text: 'text-pink-400', active: 'bg-pink-500 text-white' },
}

const DEFAULT_CAT_COLOR = { bg: 'bg-muted', border: 'border-border', text: 'text-muted-foreground', active: 'bg-foreground text-background' }

function getCatColor(name: string) {
  return CATEGORY_COLORS[name] || DEFAULT_CAT_COLOR
}

function highlightText(text: string, query: string) {
  if (!query) return text
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase()
      ? <mark key={i} className="bg-[var(--caribe)]/20 text-inherit rounded-sm px-0.5">{part}</mark>
      : part,
  )
}

function getTimerDot(elapsed: number) {
  if (elapsed < 45) return 'bg-[var(--samana)]'
  if (elapsed < 90) return 'bg-[var(--sol)]'
  return 'bg-[var(--coral)]'
}

export function POSPage() {
  const { activeTableId, activeOrderId, menuItems, setMenuItems, tables: storeTables } = useAppStore()
  const setActiveModule = useNavigationStore((s) => s.setActiveModule)
  const [cat, setCat] = useState('')
  const [search, setSearch] = useState('')
  const [order, setOrder] = useState<import('@/types').Order | null>(null)
  const [modItem, setModItem] = useState<MenuItem | null>(null)
  const [selections, setSelections] = useState<Record<number, ModifierOption[]>>({})
  const searchRef = useRef<HTMLInputElement>(null)

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

  const cartItemCounts: Record<number, number> = {}
  order?.items.forEach((i) => {
    if (i.menu_item !== null) cartItemCounts[i.menu_item] = (cartItemCounts[i.menu_item] || 0) + i.quantity
  })

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

  const tableInfo = storeTables.find((t) => t.id === activeTableId)

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
          <input ref={searchRef} type="text" placeholder="Buscar plato..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-9 rounded-lg bg-input border border-border text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-[var(--caribe)]/20 focus:border-[var(--caribe)] transition-all" />
          {search && (
            <button onClick={() => { setSearch(''); searchRef.current?.focus() }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex gap-1.5 overflow-x-auto -mx-4 px-4 pb-1 scrollbar-none">
          {categories.map((c) => {
            const cc = getCatColor(c)
            return (
              <button key={c}
                onClick={() => setCat(cat === c ? '' : c)}
                className={cn(
                  'shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-100 whitespace-nowrap',
                  cat === c ? `${cc.active} border-transparent font-semibold` : `${cc.bg} ${cc.border} ${cc.text} hover:brightness-95`,
                )}>
                {c}
              </button>
            )
          })}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map((item) => {
            const price = item.effective_price ? parseFloat(item.effective_price as any) : item.price
            const inCart = cartItemCounts[item.id] || 0

            return (
              <motion.div key={item.id} layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ y: -2 }}
                transition={{ duration: 0.15 }}
                className="relative">
                <div
                  onClick={() => openModifiers(item)}
                  className={cn(
                    'rounded-xl bg-card border cursor-pointer overflow-hidden transition-all duration-150',
                    'hover:shadow-lg',
                    inCart > 0 ? 'border-[var(--caribe)]/60' : 'border-border',
                  )}
                >
                  <div className="h-24 bg-gradient-to-b from-muted/40 to-muted/10 flex items-center justify-center">
                    {item.image ? (
                      <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <UtensilsCrossed className="w-5 h-5 text-muted-foreground/30" />
                    )}
                  </div>

                  <div className="p-3 pt-2.5">
                    <p className="text-[13px] font-semibold truncate leading-tight">
                      {search ? highlightText(item.name, search) : item.name}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">{item.category_name}</p>

                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[15px] font-bold text-[var(--caribe)] tabular-nums leading-none">
                          {formatCurrency(price)}
                        </span>
                        {item.itbis_type === 'gravado' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border leading-none">
                            ITBIS
                          </span>
                        )}
                      </div>

                      {inCart === 0 ? (
                        <motion.button
                          whileHover={{ scale: 1.15 }}
                          whileTap={{ scale: 0.8 }}
                          onClick={(e) => { e.stopPropagation(); openModifiers(item) }}
                          className="w-7 h-7 rounded-full bg-[var(--caribe)] text-white flex items-center justify-center text-lg leading-none shadow-sm hover:shadow-md transition-shadow"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </motion.button>
                      ) : (
                        <motion.span
                          key={inCart}
                          initial={{ scale: 0.5 }}
                          animate={{ scale: 1 }}
                          className="px-1.5 py-0.5 rounded-full bg-[var(--caribe)] text-white text-[11px] font-bold leading-none"
                        >
                          {inCart}
                        </motion.span>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>

      <div className="w-80 border-l bg-card flex flex-col">
        <div className="p-4 border-b border-border space-y-0.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--samana)]" />
              <h3 className="text-base font-bold leading-none">Mesa {order?.table_number || activeTableId}</h3>
            </div>
          </div>
          <p className="text-xs text-muted-foreground pl-4">
            {order?.items.length || 0} items · {order?.guests || 1} comensal(es)
          </p>
        </div>

        <div className="flex-1 overflow-auto p-3 space-y-1">
          <AnimatePresence initial={false}>
            {order?.items.map((item) => (
              <CartItemRow key={item.id} item={item}
                onIncrement={() => updateQty(item.id, 1)}
                onDecrement={() => updateQty(item.id, -1)}
                onRemove={() => removeItem(item.id)} />
            ))}
          </AnimatePresence>

          {(!order?.items || order.items.length === 0) && (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <ShoppingCart className="w-10 h-10 text-muted-foreground/20 mb-4" />
              <p className="text-sm font-medium">Carrito vacío</p>
              <p className="text-xs text-muted-foreground/60 mt-0.5">Selecciona platos del menú</p>
            </div>
          )}
        </div>

        <div className="p-4 pt-3 border-t border-border bg-muted/20 space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Subtotal</span>
            <span className="tabular-nums">{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>ITBIS (18%)</span>
            <span className="tabular-nums">{formatCurrency(itbis)}</span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Propina (10%)</span>
            <span className="tabular-nums">{formatCurrency(propina)}</span>
          </div>
          <div className="h-px bg-border my-1" />
          <div className="flex justify-between text-base font-bold">
            <span>Total</span>
            <span className="text-[var(--caribe)] tabular-nums">{formatCurrency(total)}</span>
          </div>

          <div className="flex flex-col gap-2 pt-3">
            {order && order.items.length > 0 && order.status === 'open' && (
              <Button size="sm" className="flex-1 gap-1.5 text-xs h-9"
                onClick={async () => {
                  if (!activeOrderId) return
                  await ordersApi.sendToKitchen(activeOrderId)
                  setActiveModule('kds')
                }}>
                <Send className="w-3.5 h-3.5" /> Enviar a cocina
              </Button>
            )}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1 gap-1.5 text-xs h-9"
                disabled={!order?.items.length}
                onClick={async () => {
                  if (!activeTableId) return
                  await tables.requestBill(activeTableId)
                  setActiveModule('cashier')
                }}>
                Pedir cuenta
              </Button>
              <Button size="sm" className="flex-1 gap-1.5 text-xs h-10 font-semibold bg-[var(--caribe)] text-white hover:brightness-110"
                disabled={!order?.items.length}
                onClick={() => setActiveModule('cashier')}>
                <CreditCard className="w-3.5 h-3.5" /> Cobrar
              </Button>
            </div>
          </div>
        </div>
      </div>

      {modItem && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setModItem(null)}>
          <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="bg-card border rounded-xl p-6 w-full max-w-md max-h-[80vh] overflow-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold text-lg">{modItem.name}</h3>
              <button onClick={() => setModItem(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
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
                          selected ? 'bg-[var(--caribe)]/10 border border-[var(--caribe)]/20' : 'bg-muted/30 hover:bg-muted/50',
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

            <div className="flex gap-2 mt-4 pt-3 border-t border-border">
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

function CartItemRow({ item, onIncrement, onDecrement, onRemove }: {
  item: OrderItem; onIncrement: () => void; onDecrement: () => void; onRemove: () => void
}) {
  const hasModifiers = item.modifiers_json.length > 0

  return (
    <motion.div layout initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20, height: 0 }} transition={{ duration: 0.15 }}
      className="group flex items-start gap-3 p-2.5 rounded-xl hover:bg-muted/20 transition-colors">
      <div className="w-9 h-9 rounded-lg bg-muted/30 flex items-center justify-center shrink-0 mt-0.5">
        <UtensilsCrossed className="w-4 h-4 text-muted-foreground/30" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <span className="text-xs font-semibold truncate leading-tight">{item.name}</span>
          <span className="text-xs font-semibold tabular-nums shrink-0">{formatCurrency(item.price)}</span>
        </div>
        {hasModifiers && (
          <p className="text-[10px] text-[var(--coral)] truncate mt-0.5 leading-tight">
            {item.modifiers_json.map((m) => m.name).join(', ')}
          </p>
        )}
        <div className="flex items-center gap-2 mt-1.5">
          <div className="flex items-center gap-1">
            <button onClick={onDecrement}
              className="w-5 h-5 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
              <Minus className="w-3 h-3" />
            </button>
            <span className="text-xs font-semibold w-5 text-center tabular-nums">{item.quantity}</span>
            <button onClick={onIncrement}
              className="w-5 h-5 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
              <Plus className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      <button onClick={onRemove}
        className="p-1 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-[var(--coral)]/10 text-[var(--coral)]/60 hover:text-[var(--coral)] transition-all shrink-0 mt-0.5">
        <Trash2 className="w-4 h-4" />
      </button>
    </motion.div>
  )
}
