import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { dashboardApi, type DashboardData } from '@/services/api'
import { formatCurrency } from '@/lib/utils'
import { useAppStore } from '@/stores/app-store'
import { motion } from 'framer-motion'
import {
  DollarSign, Users, ChefHat, Receipt, FileText,
  TrendingUp, Clock, AlertTriangle, CheckCircle2, Loader2,
} from 'lucide-react'
import { BarChart } from '@/components/charts'

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    dashboardApi.get().then(setData).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const user = useAppStore((s) => s.user)
  const hora = new Date().getHours()
  const saludo = hora < 12 ? 'Buenos días' : hora < 18 ? 'Buenas tardes' : 'Buenas noches'

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

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

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 p-6 space-y-6 overflow-auto">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          {saludo}, {user?.first_name || 'Usuario'}
        </h2>
        <p className="text-sm text-muted-foreground">Resumen del día — {new Date().toLocaleDateString('es-DO', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {metrics.map((m) => {
          const Icon = m.icon
          return (
            <Card key={m.label} className="relative overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">{m.label}</p>
                    <p className="text-2xl font-bold text-foreground">{m.value}</p>
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
          )
        })}
      </div>

      {(data?.hourly_orders && data.hourly_orders.length > 0) && (
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
              <p className="text-sm text-muted-foreground text-center py-4">Sin actividad hoy</p>
            )}
            {data?.activity.map((a, i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/20 text-sm">
                {a.type === 'order' ? (
                  <ChefHat className="w-4 h-4 text-warning shrink-0" />
                ) : (
                  <DollarSign className="w-4 h-4 text-success shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="truncate">{a.description}</p>
                  <p className="text-xs text-muted-foreground">{a.user}</p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {new Date(a.time).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {data && data.ecf_fallidos > 0 && (
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium">{data.ecf_fallidos} documento(s) e-CF requieren atención</p>
              <p className="text-xs text-muted-foreground">Revisa la sección de Facturación para reintentarlos</p>
            </div>
          </CardContent>
        </Card>
      )}
    </motion.div>
  )
}
