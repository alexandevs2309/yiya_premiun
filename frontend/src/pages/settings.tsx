import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { adminApi, tables as tablesApi, api, menu, type AuditLogEntry } from '@/services/api'
import { formatCurrency } from '@/lib/utils'
import { useAppStore } from '@/stores/app-store'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users, Utensils, Table2, FileText, History, Plus, Trash2,
  Shield, UserCircle, Loader2, RefreshCw, QrCode, Server, Pencil, X, Check,
} from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { InputField } from '@/components/ui/input-field'
import type { User, Table, MenuItem, MenuCategory, UserRole } from '@/types'

type Tab = 'users' | 'menu' | 'tables' | 'ncf' | 'audit' | 'sistema'

export function SettingsPage() {
  const [tab, setTab] = useState<Tab>('users')
  const currentUser = useAppStore((s) => s.user)
  const isAdmin = currentUser?.role === 'admin'

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'users', label: 'Usuarios', icon: Users },
    { id: 'menu', label: 'Menú', icon: Utensils },
    { id: 'tables', label: 'Mesas', icon: Table2 },
    { id: 'ncf', label: 'NCF', icon: FileText },
    { id: 'audit', label: 'Auditoría', icon: History },
    { id: 'sistema', label: 'Sistema', icon: Server },
  ]

  if (!isAdmin) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <Shield className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Solo administradores</p>
        </div>
      </div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex h-full">
      <div className="w-56 border-r p-2 space-y-1 shrink-0">
        {tabs.map((t) => {
          const Icon = t.icon
          return (
            <Button key={t.id} variant={tab === t.id ? 'secondary' : 'ghost'}
              className="w-full justify-start gap-2 text-sm"
              onClick={() => setTab(t.id)}>
              <Icon className="w-4 h-4" /> {t.label}
            </Button>
          )
        })}
      </div>
      <div className="flex-1 p-6 overflow-auto">
        {tab === 'users' && <UsersTab />}
        {tab === 'menu' && <MenuTab />}
        {tab === 'tables' && <TablesTab />}
        {tab === 'ncf' && <NCFTab />}
        {tab === 'audit' && <AuditTab />}
        {tab === 'sistema' && <SistemaTab />}
      </div>
    </motion.div>
  )
}

function UsersTab() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ username: '', password: '', first_name: '', last_name: '', email: '', role: 'waiter' as string, phone: '', pin: '' })

  const fetch = async () => {
    setLoading(true)
    const data = await adminApi.users.list().catch(() => [])
    setUsers(data)
    setLoading(false)
  }

  useEffect(() => { fetch() }, [])

  const openCreate = () => {
    setForm({ username: '', password: '', first_name: '', last_name: '', email: '', role: 'waiter', phone: '', pin: '' })
    setCreating(true)
  }

  const openEdit = (u: User) => {
    setForm({ username: u.username, password: '', first_name: u.first_name, last_name: u.last_name, email: u.email, role: u.role, phone: u.phone, pin: '' })
    setEditUser(u)
  }

  const save = async () => {
    if (editUser) {
      const payload: any = { first_name: form.first_name, last_name: form.last_name, email: form.email, role: form.role, phone: form.phone }
      if (form.password) payload.password = form.password
      await adminApi.users.update(editUser.id, payload)
    } else {
      await adminApi.users.create({ ...form, role: form.role as UserRole, is_active: true })
    }
    setEditUser(null)
    setCreating(false)
    await fetch()
  }

  const remove = async (u: User) => {
    if (!confirm(`¿Eliminar usuario ${u.username}?`)) return
    await adminApi.users.remove(u.id)
    await fetch()
  }

  const roleColors: Record<string, string> = { admin: 'destructive', cashier: 'default', waiter: 'secondary', cook: 'outline' }

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Usuarios</h3>
        <div className="flex gap-2">
          <Button size="sm" onClick={fetch} variant="outline" className="gap-1"><RefreshCw className="w-3 h-3" /> Recargar</Button>
          <Button size="sm" onClick={openCreate} className="gap-1"><Plus className="w-3 h-3" /> Nuevo</Button>
        </div>
      </div>
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground text-xs">
                <th className="text-left p-3 font-medium">Nombre</th>
                <th className="text-left p-3 font-medium">Usuario</th>
                <th className="text-left p-3 font-medium">Rol</th>
                <th className="text-left p-3 font-medium">Email</th>
                <th className="text-left p-3 font-medium">Estado</th>
                <th className="text-right p-3 font-medium">Acción</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-3">{u.first_name} {u.last_name}</td>
                  <td className="p-3 font-mono text-xs">{u.username}</td>
                  <td className="p-3"><Badge variant={roleColors[u.role] as any} className="text-xs">{u.role}</Badge></td>
                  <td className="p-3 text-muted-foreground">{u.email}</td>
                  <td className="p-3"><Badge variant={u.is_active !== false ? 'default' : 'secondary'} className="text-xs">{u.is_active !== false ? 'Activo' : 'Inactivo'}</Badge></td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => openEdit(u)}><Pencil className="w-3 h-3" /></Button>
                      <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive" onClick={() => remove(u)}><Trash2 className="w-3 h-3" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Modal open={creating || !!editUser} onClose={() => { setCreating(false); setEditUser(null) }}
        title={editUser ? 'Editar Usuario' : 'Nuevo Usuario'}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <InputField label="Nombre" value={form.first_name} onChange={(v) => setForm({ ...form, first_name: v })} />
            <InputField label="Apellido" value={form.last_name} onChange={(v) => setForm({ ...form, last_name: v })} />
          </div>
          <InputField label="Usuario" value={form.username} onChange={(v) => setForm({ ...form, username: v })} />
          <InputField label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
          <InputField label="Teléfono" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Rol</label>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="w-full h-10 rounded-lg bg-secondary/50 border border-border text-sm px-3 focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="admin">Administrador</option>
              <option value="cashier">Cajero</option>
              <option value="waiter">Mesero</option>
              <option value="cook">Cocinero</option>
            </select>
          </div>
          {form.role === 'waiter' && (
            <InputField label="PIN (4-6 dígitos)" value={form.pin} onChange={(v) => setForm({ ...form, pin: v })} />
          )}
          <InputField label={editUser ? 'Nueva contraseña (dejar vacío para mantener)' : 'Contraseña'} type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} />
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => { setCreating(false); setEditUser(null) }}>Cancelar</Button>
            <Button className="flex-1" onClick={save}>{editUser ? 'Guardar' : 'Crear'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function MenuTab() {
  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [editItem, setEditItem] = useState<MenuItem | null>(null)
  const [creatingItem, setCreatingItem] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [itemForm, setItemForm] = useState({ name: '', price: '', itbis_type: 'gravado', is_available: true, preparation_time: '10', category: '', image_file: null as File | null })

  const fetch = async () => {
    setLoading(true)
    const data = await adminApi.menuCategories.list().catch(() => [])
    setCategories(data)
    setLoading(false)
  }

  useEffect(() => { fetch() }, [])

  const addCategory = async () => {
    if (!newCatName.trim()) return
    await adminApi.menuCategories.create({ name: newCatName.trim(), order: categories.length + 1 })
    setNewCatName('')
    await fetch()
  }

  const removeCategory = async (id: number) => {
    if (!confirm('¿Eliminar categoría y todos sus items?')) return
    await adminApi.menuCategories.remove(id)
    await fetch()
  }

  const openCreateItem = (catId: number) => {
    setItemForm({ name: '', price: '', itbis_type: 'gravado', is_available: true, preparation_time: '10', category: String(catId), image_file: null })
    setCreatingItem(true)
  }

  const openEditItem = (item: MenuItem) => {
    setItemForm({
      name: item.name, price: String(item.price), itbis_type: item.itbis_type,
      is_available: item.is_available, preparation_time: String(item.preparation_time), category: String(item.category), image_file: null,
    })
    setEditItem(item)
  }

  const saveItem = async () => {
    const payload = { name: itemForm.name, price: parseFloat(itemForm.price), itbis_type: itemForm.itbis_type as MenuItem['itbis_type'], is_available: itemForm.is_available, preparation_time: parseInt(itemForm.preparation_time), category: parseInt(itemForm.category) }
    let savedItem: MenuItem
    if (editItem) {
      savedItem = await adminApi.menuItems.update(editItem.id, payload)
    } else {
      savedItem = await adminApi.menuItems.create(payload)
    }
    if (itemForm.image_file) {
      await menu.uploadImage(savedItem.id, itemForm.image_file)
    }
    setEditItem(null)
    setCreatingItem(false)
    await fetch()
  }

  const removeItem = async (id: number) => {
    if (!confirm('¿Eliminar item del menú?')) return
    await adminApi.menuItems.remove(id)
    await fetch()
  }

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Menú</h3>
        <Button size="sm" onClick={fetch} variant="outline" className="gap-1"><RefreshCw className="w-3 h-3" /> Recargar</Button>
      </div>

      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <label className="text-xs text-muted-foreground mb-1 block">Nueva categoría</label>
          <input value={newCatName} onChange={(e) => setNewCatName(e.target.value)}
            className="w-full h-10 rounded-lg bg-secondary/50 border border-border text-sm px-3 focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Ej: Entradas, Pescados..." />
        </div>
        <Button size="sm" onClick={addCategory} disabled={!newCatName.trim()} className="gap-1 mb-0">
          <Plus className="w-3 h-3" /> Agregar
        </Button>
      </div>

      <div className="space-y-4">
        {categories.map((cat) => (
          <Card key={cat.id}>
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm">{cat.name}</CardTitle>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" className="gap-1 text-xs h-7" onClick={() => openCreateItem(cat.id)}>
                  <Plus className="w-3 h-3" /> Item
                </Button>
                <Button size="sm" variant="ghost" className="w-7 h-7 text-destructive" onClick={() => removeCategory(cat.id)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground text-xs">
                    <th className="text-left p-2 font-medium">Item</th>
                    <th className="text-left p-2 font-medium">Precio</th>
                    <th className="text-left p-2 font-medium">ITBIS</th>
                    <th className="text-left p-2 font-medium">Disponible</th>
                    <th className="text-right p-2 font-medium">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {cat.items.map((item) => (
                    <tr key={item.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-2">{item.name}</td>
                      <td className="p-2 font-medium">{formatCurrency(item.price)}</td>
                      <td className="p-2"><Badge variant="secondary" className="text-[9px]">{item.itbis_type}</Badge></td>
                      <td className="p-2">
                        <Button variant="ghost" size="sm" onClick={async () => {
                          await adminApi.menuItems.update(item.id, { is_available: !item.is_available })
                          await fetch()
                        }}>
                          <Badge variant={item.is_available ? 'default' : 'secondary'} className="text-xs">{item.is_available ? 'Sí' : 'No'}</Badge>
                        </Button>
                      </td>
                      <td className="p-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => openEditItem(item)}><Pencil className="w-3 h-3" /></Button>
                          <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive" onClick={() => removeItem(item.id)}><Trash2 className="w-3 h-3" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        ))}
      </div>

      <Modal open={creatingItem || !!editItem} onClose={() => { setCreatingItem(false); setEditItem(null) }}
        title={editItem ? 'Editar Item' : 'Nuevo Item'}>
        <div className="space-y-3">
          <InputField label="Nombre" value={itemForm.name} onChange={(v) => setItemForm({ ...itemForm, name: v })} />
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Imagen</label>
            <label className="flex items-center gap-2 cursor-pointer h-10 rounded-lg bg-secondary/50 border border-border px-3 text-sm text-muted-foreground hover:bg-secondary/80 transition-colors">
              <Plus className="w-4 h-4" />
              {itemForm.image_file ? itemForm.image_file.name : (editItem?.image ? 'Cambiar imagen' : 'Subir imagen')}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                const file = e.target.files?.[0] || null
                setItemForm({ ...itemForm, image_file: file })
              }} />
            </label>
            {(itemForm.image_file || editItem?.image) && (
              <div className="mt-2 relative w-20 h-20 rounded-lg overflow-hidden border">
                <img
                  src={itemForm.image_file ? URL.createObjectURL(itemForm.image_file) : editItem?.image}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
              </div>
            )}
          </div>
          <InputField label="Precio (RD$)" type="number" value={itemForm.price} onChange={(v) => setItemForm({ ...itemForm, price: v })} />
          <InputField label="Tiempo preparación (min)" type="number" value={itemForm.preparation_time} onChange={(v) => setItemForm({ ...itemForm, preparation_time: v })} />
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Tipo ITBIS</label>
            <select value={itemForm.itbis_type} onChange={(e) => setItemForm({ ...itemForm, itbis_type: e.target.value })}
              className="w-full h-10 rounded-lg bg-secondary/50 border border-border text-sm px-3 focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="gravado">Gravado 18%</option>
              <option value="exento">Exento</option>
              <option value="reducido">Tasa Reducida</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Categoría</label>
            <select value={itemForm.category} onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}
              className="w-full h-10 rounded-lg bg-secondary/50 border border-border text-sm px-3 focus:outline-none focus:ring-2 focus:ring-ring">
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => { setCreatingItem(false); setEditItem(null) }}>Cancelar</Button>
            <Button className="flex-1" onClick={saveItem}>{editItem ? 'Guardar' : 'Crear'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function TablesTab() {
  const [tables, setTables] = useState<Table[]>([])
  const [loading, setLoading] = useState(true)
  const [qrTable, setQrTable] = useState<number | null>(null)
  const [editTable, setEditTable] = useState<Table | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ number: '', section: 'Interior', capacity: '4' })

  const fetch = async () => {
    setLoading(true)
    const data = await tablesApi.list().catch(() => [])
    setTables(data)
    setLoading(false)
  }

  useEffect(() => { fetch() }, [])

  const openCreate = () => {
    setForm({ number: '', section: 'Interior', capacity: '4' })
    setCreating(true)
  }

  const openEdit = (t: Table) => {
    setForm({ number: t.number, section: t.section, capacity: String(t.capacity) })
    setEditTable(t)
  }

  const save = async () => {
    const payload = { number: form.number, section: form.section, capacity: parseInt(form.capacity) }
    if (editTable) {
      await adminApi.tables.update(editTable.id, payload)
    } else {
      await adminApi.tables.create(payload)
    }
    setEditTable(null)
    setCreating(false)
    await fetch()
  }

  const remove = async (t: Table) => {
    if (!confirm(`¿Eliminar mesa ${t.number}?`)) return
    await adminApi.tables.remove(t.id)
    await fetch()
  }

  const statusColors: Record<string, string> = { available: 'default', occupied: 'destructive', bill: 'secondary', reserved: 'outline' }
  const baseUrl = window.location.origin
  const kioskUrl = (token: string) => `${baseUrl}/kiosk?token=${token}`

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Mesas</h3>
        <div className="flex gap-2">
          <Button size="sm" onClick={fetch} variant="outline" className="gap-1"><RefreshCw className="w-3 h-3" /> Recargar</Button>
          <Button size="sm" onClick={openCreate} className="gap-1"><Plus className="w-3 h-3" /> Nueva</Button>
        </div>
      </div>
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground text-xs">
                <th className="text-left p-3 font-medium">#</th>
                <th className="text-left p-3 font-medium">Sección</th>
                <th className="text-left p-3 font-medium">Capacidad</th>
                <th className="text-left p-3 font-medium">Estado</th>
                <th className="text-left p-3 font-medium">QR</th>
                <th className="text-right p-3 font-medium">Acción</th>
              </tr>
            </thead>
            <tbody>
              {tables.map((t) => (
                <tr key={t.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-3 font-mono">{t.number}</td>
                  <td className="p-3">{t.section}</td>
                  <td className="p-3">{t.capacity} pers.</td>
                  <td className="p-3"><Badge variant={(statusColors[t.status] || 'outline') as any} className="text-xs">{t.status}</Badge></td>
                  <td className="p-3">
                    {t.token && (
                      <Button variant="ghost" size="sm" className="gap-1 text-xs"
                        onClick={() => setQrTable(qrTable === t.id ? null : t.id)}>
                        <QrCode className="w-3 h-3" /> QR
                      </Button>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => openEdit(t)}><Pencil className="w-3 h-3" /></Button>
                      <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive" onClick={() => remove(t)}><Trash2 className="w-3 h-3" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
      {qrTable && tables.find(t => t.id === qrTable)?.token && (
        <Card>
          <CardContent className="p-4 text-center space-y-3">
            <h4 className="text-sm font-semibold">QR — Mesa {tables.find(t => t.id === qrTable)?.number}</h4>
            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(kioskUrl(tables.find(t => t.id === qrTable)!.token!))}`}
              alt="QR Code" className="mx-auto rounded-lg" width={200} height={200} />
            <p className="text-xs text-muted-foreground break-all">{kioskUrl(tables.find(t => t.id === qrTable)!.token!)}</p>
          </CardContent>
        </Card>
      )}

      <Modal open={creating || !!editTable} onClose={() => { setCreating(false); setEditTable(null) }}
        title={editTable ? 'Editar Mesa' : 'Nueva Mesa'}>
        <div className="space-y-3">
          <InputField label="Número" value={form.number} onChange={(v) => setForm({ ...form, number: v })} />
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Sección</label>
            <select value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })}
              className="w-full h-10 rounded-lg bg-secondary/50 border border-border text-sm px-3 focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="Interior">Interior</option>
              <option value="Terraza">Terraza</option>
              <option value="Barra">Barra</option>
              <option value="VIP">VIP</option>
            </select>
          </div>
          <InputField label="Capacidad" type="number" value={form.capacity} onChange={(v) => setForm({ ...form, capacity: v })} />
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => { setCreating(false); setEditTable(null) }}>Cancelar</Button>
            <Button className="flex-1" onClick={save}>{editTable ? 'Guardar' : 'Crear'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function NCFTab() {
  const [sequences, setSequences] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = async () => {
    setLoading(true)
    const data = await api<{ count: number; results: any[] }>('/billing/ncf-sequences/').catch(() => ({ count: 0, results: [] }))
    setSequences(data.results)
    setLoading(false)
  }

  useEffect(() => { fetch() }, [])

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Secuencias NCF</h3>
        <Button size="sm" onClick={fetch} variant="outline" className="gap-1"><RefreshCw className="w-3 h-3" /> Recargar</Button>
      </div>
      <p className="text-sm text-muted-foreground">Las secuencias NCF son gestionadas automáticamente al generar facturas electrónicas.</p>
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground text-xs">
                <th className="text-left p-3 font-medium">Tipo</th>
                <th className="text-left p-3 font-medium">Prefijo</th>
                <th className="text-left p-3 font-medium">Secuencia actual</th>
                <th className="text-left p-3 font-medium">Válido desde</th>
                <th className="text-left p-3 font-medium">Válido hasta</th>
                <th className="text-left p-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {sequences.map((s: any) => (
                <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-3 font-mono text-xs">{s.ncf_type}</td>
                  <td className="p-3">{s.prefix}</td>
                  <td className="p-3 font-mono">{s.current_sequence}</td>
                  <td className="p-3 text-xs">{new Date(s.valid_from).toLocaleDateString('es-DO')}</td>
                  <td className="p-3 text-xs">{new Date(s.valid_to).toLocaleDateString('es-DO')}</td>
                  <td className="p-3"><Badge variant={s.is_active ? 'default' : 'secondary'}>{s.is_active ? 'Activo' : 'Inactivo'}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}

function AuditTab() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = async () => {
    setLoading(true)
    const data = await adminApi.auditLogs().catch(() => [])
    setLogs(data)
    setLoading(false)
  }

  useEffect(() => { fetch() }, [])

  const actionIcons: Record<string, React.ElementType> = { create: Plus, update: RefreshCw, delete: Trash2, login: UserCircle, payment: Loader2 }

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Auditoría</h3>
        <Button size="sm" onClick={fetch} variant="outline" className="gap-1"><RefreshCw className="w-3 h-3" /> Recargar</Button>
      </div>
      <Card>
        <CardContent className="p-0">
          {logs.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground text-sm">Sin registros</div>
          ) : (
            <div className="divide-y">
              {logs.map((log) => {
                const Icon = actionIcons[log.action] || RefreshCw
                return (
                  <div key={log.id} className="flex items-start gap-3 p-3 text-sm hover:bg-muted/30">
                    <Icon className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="truncate">{log.description}</p>
                      <p className="text-xs text-muted-foreground">{log.user_name}</p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {new Date(log.created_at).toLocaleString('es-DO')}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function SistemaTab() {
  const [health, setHealth] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    import('@/services/api').then((m) =>
      m.api<{ status: string; database: string; debug: boolean; time: string }>('/auth/health/')
        .then(setHealth)
        .catch(() => {})
        .finally(() => setLoading(false))
    )
  }, [])

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Sistema</h3>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Estado</span>
            <Badge variant={health?.status === 'ok' ? 'default' : 'destructive'}>{health?.status || 'desconocido'}</Badge>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Base de datos</span>
            <Badge variant={health?.database === 'connected' ? 'default' : 'destructive'}>{health?.database || 'error'}</Badge>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Modo desarrollo</span>
            <Badge variant="secondary">{health?.debug ? 'Sí' : 'No'}</Badge>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Servidor</span>
            <span className="font-mono text-xs">{window.location.hostname}</span>
          </div>
          {health?.time && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Hora del servidor</span>
              <span className="text-xs">{new Date(health.time).toLocaleString('es-DO')}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h4 className="text-sm font-semibold">Respaldo</h4>
          <p className="text-xs text-muted-foreground">
            Usa <code className="bg-secondary/50 px-1 rounded">python manage.py backup</code> para respaldar la base de datos.
            Agrega <code className="bg-secondary/50 px-1 rounded">--s3</code> para subir a S3 (requiere AWS_BACKUP_BUCKET en .env).
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
