import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { InputField } from '@/components/ui/input-field'
import { Modal } from '@/components/ui/modal'
import { customers } from '@/services/api'
import { motion } from 'framer-motion'
import { Plus, RefreshCw, Pencil, Trash2, Loader2, Search, Phone, Mail } from 'lucide-react'
import type { Customer } from '@/types'

export function CustomersPage() {
  const [list, setList] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ rnc: '', business_name: '', commercial_name: '', phone: '', email: '', address: '' })

  const fetch = async () => {
    setLoading(true)
    const data = await customers.list().catch(() => [])
    setList(data)
    setLoading(false)
  }

  useEffect(() => { fetch() }, [])

  const filtered = list.filter((c) => {
    const q = search.toLowerCase()
    return c.business_name.toLowerCase().includes(q) || c.rnc.includes(q) || c.phone.includes(q)
  })

  const openCreate = () => {
    setForm({ rnc: '', business_name: '', commercial_name: '', phone: '', email: '', address: '' })
    setCreating(true)
  }

  const openEdit = (c: Customer) => {
    setForm({ rnc: c.rnc, business_name: c.business_name, commercial_name: c.commercial_name, phone: c.phone, email: c.email, address: c.address })
    setEditCustomer(c)
  }

  const save = async () => {
    if (editCustomer) {
      await customers.update(editCustomer.id, form)
    } else {
      await customers.create(form)
    }
    setEditCustomer(null); setCreating(false)
    await fetch()
  }

  const remove = async (c: Customer) => {
    if (!confirm(`¿Eliminar cliente ${c.business_name}?`)) return
    await customers.remove(c.id)
    await fetch()
  }

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 p-6 space-y-6 overflow-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Clientes</h2>
        <div className="flex gap-2">
          <Button size="sm" onClick={fetch} variant="outline" className="gap-1"><RefreshCw className="w-3 h-3" /> Recargar</Button>
          <Button size="sm" onClick={openCreate} className="gap-1"><Plus className="w-3 h-3" /> Nuevo</Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full h-10 rounded-lg bg-secondary/50 border border-border text-sm pl-10 pr-3 focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="Buscar por nombre, RNC o teléfono..." />
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground text-xs">
                <th className="text-left p-3 font-medium">RNC/Cédula</th>
                <th className="text-left p-3 font-medium">Razón Social</th>
                <th className="text-left p-3 font-medium">Nombre Comercial</th>
                <th className="text-left p-3 font-medium">Contacto</th>
                <th className="text-right p-3 font-medium">Acción</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-3 font-mono text-xs">{c.rnc}</td>
                  <td className="p-3 font-medium">{c.business_name}</td>
                  <td className="p-3 text-muted-foreground">{c.commercial_name || '—'}</td>
                  <td className="p-3">
                    <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                      {c.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {c.phone}</span>}
                      {c.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {c.email}</span>}
                    </div>
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => openEdit(c)}><Pencil className="w-3 h-3" /></Button>
                      <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive" onClick={() => remove(c)}><Trash2 className="w-3 h-3" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="text-center p-8 text-muted-foreground text-sm">Sin clientes registrados</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Modal open={creating || !!editCustomer} onClose={() => { setCreating(false); setEditCustomer(null) }}
        title={editCustomer ? 'Editar Cliente' : 'Nuevo Cliente'}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <InputField label="RNC/Cédula" value={form.rnc} onChange={(v) => setForm({ ...form, rnc: v })} />
            <InputField label="Teléfono" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
          </div>
          <InputField label="Razón Social" value={form.business_name} onChange={(v) => setForm({ ...form, business_name: v })} />
          <InputField label="Nombre Comercial" value={form.commercial_name} onChange={(v) => setForm({ ...form, commercial_name: v })} />
          <InputField label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Dirección</label>
            <textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full h-20 rounded-lg bg-secondary/50 border border-border text-sm p-3 focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              placeholder="Dirección fiscal..." />
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => { setCreating(false); setEditCustomer(null) }}>Cancelar</Button>
            <Button className="flex-1" onClick={save}>{editCustomer ? 'Guardar' : 'Crear'}</Button>
          </div>
        </div>
      </Modal>
    </motion.div>
  )
}
