import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'
import { useAppStore } from '@/stores/app-store'
import { useNavigationStore } from '@/stores/navigation-store'
import { tables as tablesApi } from '@/services/api'
import { cn } from '@/lib/utils'
import { Plus, Users, Clock, User, DollarSign } from 'lucide-react'
import type { Table } from '@/types'

export function FloorPlanPage() {
  const { tables, setTables, setActiveTable, setActiveOrder, user } = useAppStore()
  const setActiveModule = useNavigationStore((s) => s.setActiveModule)
  const [filter, setFilter] = useState('Todas')
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<number | null>(null)
  const [guests, setGuests] = useState(2)

  useEffect(() => {
    tablesApi.list().then(setTables).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const filtered = filter === 'Todas' ? tables : tables.filter((t) => t.section === filter)

  const handleOpen = async (table: Table) => {
    if (table.status === 'available') {
      setOpenId(table.id)
      setGuests(2)
    } else {
      setActiveTable(table.id)
      setActiveModule('pos')
    }
  }

  const confirmOpen = async () => {
    if (!openId) return
    try {
      const order = await tablesApi.open(openId, guests)
      setActiveTable(openId)
      setActiveOrder(order.id)
      setActiveModule('pos')
      const updated = await tablesApi.list()
      setTables(updated)
    } catch {}
    setOpenId(null)
  }

  const sections = ['Todas', 'Interior', 'Terraza', 'Barra', 'VIP']

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex gap-2 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          {sections.map((s) => (
            <Button key={s} variant={filter === s ? 'default' : 'outline'} size="sm"
              onClick={() => setFilter(s)} className="text-xs whitespace-nowrap shrink-0">
              {s}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-success" /> Libre</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-warning" /> Ocupada</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-destructive" /> Cuenta</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((table) => {
          const colors: Record<string, string> = {
            available: 'border-success/40 bg-success/[0.04]',
            occupied: 'border-warning/40 bg-warning/[0.04]',
            bill: 'border-destructive/40 bg-destructive/[0.04]',
            reserved: 'border-primary/40 bg-primary/[0.04]',
          }
          return (
            <motion.div key={table.id} layout initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Card className={cn('cursor-pointer transition-all border-2 hover:shadow-[0_0_20px_hsl(var(--primary)/0.06)]', colors[table.status] || '')}
                onClick={() => handleOpen(table)}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={cn('w-3 h-3 rounded-full',
                        table.status === 'available' && 'bg-success',
                        table.status === 'occupied' && 'bg-warning',
                        table.status === 'bill' && 'bg-destructive',
                      )} />
                      <span className="font-semibold text-base">{table.number}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{table.section}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{table.capacity} pers</span>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>

      {openId && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center"
          onClick={() => setOpenId(null)}>
          <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }}
            className="bg-card border rounded-xl p-6 w-full max-w-sm mx-4"
            onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold mb-4">Abrir mesa</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground">Mesero</label>
                <p className="text-sm font-medium">{user?.first_name || user?.username}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Comensales</label>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setGuests(Math.max(1, guests - 1))}>-</Button>
                  <span className="text-lg font-bold w-8 text-center">{guests}</span>
                  <Button variant="outline" size="sm" onClick={() => setGuests(Math.min(20, guests + 1))}>+</Button>
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <Button variant="outline" className="flex-1" onClick={() => setOpenId(null)}>Cancelar</Button>
              <Button className="flex-1" onClick={confirmOpen}>Abrir mesa</Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </motion.div>
  )
}
