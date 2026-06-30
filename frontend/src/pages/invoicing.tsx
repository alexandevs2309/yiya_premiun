import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { api } from '@/services/api'
import { formatCurrency } from '@/lib/utils'
import { motion } from 'framer-motion'
import { FileText, RefreshCw, AlertCircle, CheckCircle2, Clock, XCircle, Send, Loader2 } from 'lucide-react'
import { Modal } from '@/components/ui/modal'

interface ECFDoc {
  id: string
  payment: string
  order_id: string
  table_number: string
  ncf: string
  ncf_type: string
  rnc_cliente: string
  razon_social_cliente: string
  status: string
  attempts: number
  last_error: string
  total: number
  created_at: string
  sent_at: string | null
}

const statusConfig: Record<string, { label: string; icon: React.ElementType; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Pendiente', icon: Clock, variant: 'outline' },
  processing: { label: 'Enviando', icon: Loader2, variant: 'outline' },
  sent: { label: 'Enviado', icon: Send, variant: 'secondary' },
  accepted: { label: 'Aceptado', icon: CheckCircle2, variant: 'default' },
  rejected: { label: 'Rechazado', icon: XCircle, variant: 'destructive' },
  failed: { label: 'Falló', icon: AlertCircle, variant: 'destructive' },
}

export function InvoicingPage() {
  const [documents, setDocuments] = useState<ECFDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [retrying, setRetrying] = useState<string | null>(null)
  
  const [annulModalOpen, setAnnulModalOpen] = useState(false)
  const [selectedDoc, setSelectedDoc] = useState<ECFDoc | null>(null)
  const [annulReason, setAnnulReason] = useState('1')
  const [annulling, setAnnulling] = useState(false)

  const fetchDocs = async () => {
    setLoading(true)
    try {
      const data = await api<{ count: number; results: ECFDoc[] }>('/billing/ecf-documents/?page_size=50')
      setDocuments(data.results)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { fetchDocs() }, [])

  const handleRetry = async (id: string) => {
    setRetrying(id)
    await api(`/billing/ecf-documents/${id}/retry/`, { method: 'POST' })
    await fetchDocs()
    setRetrying(null)
  }

  const handleAnnul = async () => {
    if (!selectedDoc) return
    setAnnulling(true)
    try {
      await api(`/billing/payments/${selectedDoc.payment}/generate_ecf/`, {
        method: 'POST',
        body: JSON.stringify({
          ncf_type: 'B04',
          rnc_cliente: selectedDoc.rnc_cliente,
          razon_social_cliente: selectedDoc.razon_social_cliente,
        }),
      })
      setAnnulModalOpen(false)
      setSelectedDoc(null)
      await fetchDocs()
    } catch (err: any) {
      alert(err.message || 'Error al generar la Nota de Crédito')
    }
    setAnnulling(false)
  }

  const hasCreditNote = (paymentId: string) => {
    return documents.some((d) => d.payment === paymentId && d.ncf_type === 'B04')
  }

  const stats = {
    total: documents.length,
    accepted: documents.filter(d => d.status === 'accepted').length,
    pending: documents.filter(d => d.status === 'pending').length,
    processing: documents.filter(d => d.status === 'processing').length,
    failed: documents.filter(d => d.status === 'failed' || d.status === 'rejected').length,
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Facturación Electrónica</h2>
          <p className="text-sm text-muted-foreground">Documentos e-CF enviados a la DGII</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchDocs} className="gap-2">
          <RefreshCw className="w-3 h-3" /> Actualizar
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{stats.total}</p><p className="text-xs text-muted-foreground">Total</p></CardContent></Card>
        <Card className="border-success/20"><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-success">{stats.accepted}</p><p className="text-xs text-muted-foreground">Aceptados</p></CardContent></Card>
        <Card className="border-warning/20"><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-warning">{stats.pending}</p><p className="text-xs text-muted-foreground">Pendientes</p></CardContent></Card>
        <Card className="border-primary/20"><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-primary">{stats.processing}</p><p className="text-xs text-muted-foreground">Enviando</p></CardContent></Card>
        <Card className="border-destructive/20"><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-destructive">{stats.failed}</p><p className="text-xs text-muted-foreground">Fallidos</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Documentos e-CF</CardTitle></CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : documents.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No hay documentos e-CF aún</p>
              <p className="text-xs">Los documentos se generan automáticamente al procesar un pago</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground text-xs">
                    <th className="text-left p-3 font-medium">NCF</th>
                    <th className="text-left p-3 font-medium">Mesa</th>
                    <th className="text-left p-3 font-medium">RNC</th>
                    <th className="text-left p-3 font-medium">Total</th>
                    <th className="text-left p-3 font-medium">Estado</th>
                    <th className="text-left p-3 font-medium">Intentos</th>
                    <th className="text-left p-3 font-medium">Error</th>
                    <th className="text-right p-3 font-medium">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc) => {
                    const cfg = statusConfig[doc.status] || statusConfig.pending
                    const Icon = cfg.icon
                    return (
                      <tr key={doc.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="p-3 font-mono text-xs">{doc.ncf || '—'}</td>
                        <td className="p-3">{doc.table_number}</td>
                        <td className="p-3 font-mono text-xs">{doc.rnc_cliente || '—'}</td>
                        <td className="p-3 font-semibold">{formatCurrency(doc.total)}</td>
                        <td className="p-3">
                          <Badge variant={cfg.variant} className="gap-1 text-xs">
                            <Icon className="w-3 h-3" /> {cfg.label}
                          </Badge>
                        </td>
                        <td className="p-3 text-muted-foreground">{doc.attempts}</td>
                        <td className="p-3 text-xs text-destructive max-w-[200px] truncate">{doc.last_error || '—'}</td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {(doc.status === 'failed' || doc.status === 'rejected') && (
                              <Button variant="outline" size="sm" className="text-xs"
                                onClick={() => handleRetry(doc.id)}
                                disabled={retrying === doc.id}>
                                {retrying === doc.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                                Reintentar
                              </Button>
                            )}
                            {doc.ncf_type === 'B01' && doc.status === 'accepted' && !hasCreditNote(doc.payment) && (
                              <Button variant="outline" size="sm" className="text-xs text-destructive hover:bg-destructive/10 border-destructive/20"
                                onClick={() => {
                                  setSelectedDoc(doc)
                                  setAnnulModalOpen(true)
                                }}>
                                Anular
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Modal open={annulModalOpen} onClose={() => setAnnulModalOpen(false)} title="Anular Factura (Nota de Crédito)">
        <div className="space-y-4 pt-4">
          <p className="text-sm text-muted-foreground font-sans">
            Se generará una Nota de Crédito Electrónica (B04) asociada al NCF <span className="font-mono font-semibold">{selectedDoc?.ncf}</span>.
            Esta acción anulará la venta en los registros contables y liberará la mesa asociada.
          </p>
          
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground font-sans">Motivo de Anulación</label>
            <select value={annulReason} onChange={(e) => setAnnulReason(e.target.value)}
              className="w-full bg-input border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-sans">
              <option value="1">01 - Anulación de Factura</option>
              <option value="2">02 - Corrección de Errores</option>
              <option value="3">03 - Descuento / Bonificación</option>
              <option value="4">04 - Devolución de Bienes</option>
            </select>
          </div>

          <div className="flex items-center gap-2 justify-end pt-4">
            <Button variant="outline" onClick={() => setAnnulModalOpen(false)} disabled={annulling}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleAnnul} disabled={annulling} className="gap-2">
              {annulling && <Loader2 className="w-4 h-4 animate-spin" />}
              Confirmar Anulación
            </Button>
          </div>
        </div>
      </Modal>
    </motion.div>
  )
}
