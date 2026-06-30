import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { dashboardApi, type DashboardData } from '@/services/api'
import { formatCurrency } from '@/lib/utils'
import { motion } from 'framer-motion'
import { BarChart, PieChart } from '@/components/charts'
import { DollarSign, ChefHat, AlertTriangle, Loader2, Download, RefreshCw } from 'lucide-react'

export function ReportsPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetch = () => {
    setLoading(true)
    dashboardApi.get().then(setData).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { fetch() }, [])

  const handleExport = () => {
    if (!data) return
    const lines = [
      `Reporte D'Yiya Restaurant - ${new Date().toLocaleDateString('es-DO')}`,
      '',
      'Métrica,Valor',
      `Ventas Hoy,${data.ventas_hoy}`,
      `ITBIS (18%),${data.itbis_hoy}`,
      `Propina (10%),${data.propina_hoy}`,
      `Ticket Promedio,${data.ticket_promedio}`,
      `Transacciones,${data.total_transacciones}`,
      `Mesas Ocupadas,${data.mesas_ocupadas}/${data.total_mesas}`,
      `Órdenes en Cocina,${data.ordenes_en_cocina}`,
      `e-CF Pendientes,${data.ecf_pendientes}`,
      `e-CF Fallidos,${data.ecf_fallidos}`,
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `reporte-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <div className="flex-1 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>

  const ocupacion = data ? Math.round((data.mesas_ocupadas / data.total_mesas) * 100) : 0
  const eficiencia = data ? Math.round((data.total_transacciones / (data.hourly_orders?.length || 1)) * 10) : 0

  // Datos reales de métodos de pago desde la API
  const paymentMethods = data?.payment_methods
    ? [
        { name: 'Efectivo', value: data.payment_methods.efectivo },
        { name: 'Tarjeta', value: data.payment_methods.tarjeta },
        { name: 'Transferencia', value: data.payment_methods.transferencia },
        { name: 'Yape', value: data.payment_methods.yape },
      ]
    : [
        { name: 'Efectivo', value: 0 },
        { name: 'Tarjeta', value: 0 },
        { name: 'Transferencia', value: 0 },
        { name: 'Yape', value: 0 },
      ]

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 p-6 space-y-6 overflow-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Reportes</h2>
          <p className="text-sm text-muted-foreground">{new Date().toLocaleDateString('es-DO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={fetch} variant="outline" className="gap-1"><RefreshCw className="w-3 h-3" /> Actualizar</Button>
          <Button size="sm" onClick={handleExport} variant="outline" className="gap-1"><Download className="w-3 h-3" /> Exportar CSV</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Ventas Hoy</p><p className="text-2xl font-bold text-foreground">{formatCurrency(data?.ventas_hoy || 0)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">ITBIS</p><p className="text-2xl font-bold text-foreground">{formatCurrency(data?.itbis_hoy || 0)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Propina</p><p className="text-2xl font-bold text-foreground">{formatCurrency(data?.propina_hoy || 0)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Ticket Promedio</p><p className="text-2xl font-bold text-foreground">{formatCurrency(data?.ticket_promedio || 0)}</p></CardContent></Card>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Transacciones</p><p className="text-2xl font-bold text-foreground">{data?.total_transacciones || 0}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Ocupación</p><p className="text-2xl font-bold text-foreground">{ocupacion}%</p><p className="text-xs text-muted-foreground">{data?.mesas_ocupadas || 0}/{data?.total_mesas || 0} mesas</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">En Cocina</p><p className="text-2xl font-bold text-foreground">{data?.ordenes_en_cocina || 0}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">e-CF Pendientes</p><p className="text-2xl font-bold text-foreground">{data?.ecf_pendientes || 0}</p></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-4">Órdenes por Hora</h3>
            <BarChart
              data={data?.hourly_orders || []}
              labelKey="hour"
              series={[{ key: 'orders', name: 'Órdenes' }]}
              height={250}
              labelFormatter={(h) => `${h}:00`}
              tooltipFormatter={(v) => [`${v ?? 0} órdenes`, 'Cantidad']}
              showLegend={false}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-4">Métodos de Pago</h3>
            <PieChart
              data={paymentMethods}
              nameKey="name"
              valueKey="value"
              innerRadius={60}
              outerRadius={90}
              height={250}
              tooltipFormatter={(v) => [`${v}%`, 'Distribución']}
              showLegend={true}
              legendLayout="vertical"
              animationDuration={800}
            />
          </CardContent>
        </Card>
      </div>

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
        <Card className="border-destructive/30 bg-destructive/5">
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
