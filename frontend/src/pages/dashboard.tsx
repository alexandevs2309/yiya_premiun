import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { dashboardApi, type DashboardData } from '@/services/api'
import { formatCurrency } from '@/lib/utils'
import { useAppStore } from '@/stores/app-store'
import { motion } from 'framer-motion'
import {
  DollarSign, Users, ChefHat, Receipt, FileText,
  TrendingUp, Clock, AlertTriangle, RefreshCw,
} from 'lucide-react'
import { BarChart } from '@/components/charts'
import { CardSkeleton } from '@/components/ui/skeleton'

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
}

const itemAnim = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25 } },
}

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const fetch = async () => {
    setLoading(true)
    setError(false)
    try {
      const d = await dashboardApi.get()
      setData(d)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetch() }, [])

  const user = useAppStore((s) => s.user)
  const hora = new Date().getHours()
  const saludo = hora < 12 ? 'Buenos días' : hora < 18 ? 'Buenas tardes' : 'Buenas noches'

  const ocupacion = data ? Math.round((data.mesas_ocupadas / data.total_mesas) * 100) : 0

  const metrics = [
    { label: 'Ventas Hoy', value: formatCurrency(data?.ventas_hoy || 0), icon: DollarSign },
    { label: 'ITBIS (18%)', value: formatCurrency(data?.itbis_hoy || 0), icon: Receipt },
    { label: 'Propina (10%)', value: formatCurrency(data?.propina_hoy || 0), icon: TrendingUp },
    { label: 'Ticket Promedio', value: formatCurrency(data?.ticket_promedio || 0), icon: Clock },
    { label: 'Mesas Ocupadas', value: `${data?.mesas_ocupadas ?? 0}/${data?.total_mesas ?? 0}`, icon: Users, badge: `${ocupacion}%` },
    { label: 'En Cocina', value: String(data?.ordenes_en_cocina ?? 0), icon: ChefHat },
    { label: 'Transacciones Hoy', value: String(data?.total_transacciones ?? 0), icon: FileText },
    { label: 'e-CF Pendientes', value: String(data?.ecf_pendientes ?? 0), icon: AlertTriangle },
  ]

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="w-7 h-7 text-destructive" />
          </div>
          <h2 className="text-lg font-semibold mb-1">Error al cargar</h2>
          <p className="text-sm text-muted-foreground mb-4">No se pudieron obtener los datos del dashboard</p>
          <Button onClick={fetch} className="gap-2" size="sm">
            <RefreshCw className="w-4 h-4" /> Reintentar
          </Button>
        </div>
      </div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 p-6 space-y-6 overflow-auto">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          {saludo}, {user?.first_name || 'Usuario'}
        </h2>
        <p className="text-sm text-muted-foreground">Resumen del día — {new Date().toLocaleDateString('es-DO', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <CardSkeleton key={i} className="h-28" />
          ))}
        </div>
      ) : (
        <motion.div variants={container} initial="hidden" animate="show"
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {metrics.map((m) => {
            const Icon = m.icon
            return (
              <motion.div key={m.label} variants={itemAnim}>
                <Card className="relative overflow-hidden transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">{m.label}</p>
                        <p className="text-2xl font-bold text-foreground tabular-nums">{m.value}</p>
                      </div>
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Icon className="w-5 h-5 text-primary" />
                      </div>
                    </div>
                    {m.badge && (
                      <Badge variant="secondary" className="mt-2 text-xs">{m.badge} ocupación</Badge>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </motion.div>
      )}

      {loading ? (
        <CardSkeleton className="h-64" />
      ) : (data?.hourly_orders && data.hourly_orders.length > 0) && (
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-4">Órdenes por Hora</h3>
            <BarChart
              data={data.hourly_orders}
              labelKey="hour"
              series={[{ key: 'orders', name: 'Órdenes' }]}
              height={200}
              labelFormatter={(h) => `${h}:00`}
              tooltipFormatter={(v) => [`${v ?? 0} órdenes`, 'Cantidad']}
              showLegend={false}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold mb-3">Actividad Reciente</h3>
          <div className="space-y-2">
            {(data?.activity.length ?? 0) === 0 && (
              <div className="flex flex-col items-center py-8 text-muted-foreground">
                <Clock className="w-8 h-8 text-muted-foreground/20 mb-2" />
                <p className="text-sm font-medium">Sin actividad hoy</p>
                <p className="text-xs text-muted-foreground/60 mt-0.5">Las acciones del día aparecerán aquí</p>
              </div>
            )}
            {data?.activity.map((a, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/20 text-sm transition-colors">
                {a.type === 'order' ? (
                  <ChefHat className="w-4 h-4 text-warning shrink-0" />
                ) : (
                  <DollarSign className="w-4 h-4 text-success shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="truncate">{a.description}</p>
                  <p className="text-xs text-muted-foreground">{a.user}</p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                  {new Date(a.time).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>

      {data && data.ecf_fallidos > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-destructive/20 bg-destructive/5">
            <CardContent className="p-4 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">{data.ecf_fallidos} documento(s) e-CF requieren atención</p>
                <p className="text-xs text-muted-foreground">Revisa la sección de Facturación para reintentarlos</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.div>
  )
}
