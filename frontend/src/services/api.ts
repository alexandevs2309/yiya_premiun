const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

let accessToken: string | null = localStorage.getItem('access_token')

export function setTokens(access: string, refresh: string) {
  accessToken = access
  localStorage.setItem('access_token', access)
  localStorage.setItem('refresh_token', refresh)
}

export function clearTokens() {
  accessToken = null
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
}

async function refreshToken(): Promise<boolean> {
  const refresh = localStorage.getItem('refresh_token')
  if (!refresh) return false
  try {
    const res = await fetch(`${API_BASE}/auth/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh }),
    })
    if (!res.ok) return false
    const data = await res.json()
    setTokens(data.access, data.refresh)
    return true
  } catch {
    return false
  }
}

export async function api<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const isFormData = options.body instanceof FormData
  const headers: Record<string, string> = {
    ...(!isFormData && { 'Content-Type': 'application/json' }),
    ...(options.headers as Record<string, string>),
  }
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`
  }

  let res = await fetch(`${API_BASE}${path}`, { ...options, headers })

  if (res.status === 401 && accessToken) {
    const refreshed = await refreshToken()
    if (refreshed) {
      headers['Authorization'] = `Bearer ${accessToken}`
      res = await fetch(`${API_BASE}${path}`, { ...options, headers })
    } else {
      clearTokens()
      window.location.href = '/login'
      throw new Error('Sesión expirada')
    }
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Error desconocido' }))
    throw new Error(error.detail || error.message || 'Error de red')
  }

  return res.json()
}

// Auth
export const auth = {
  login: (username: string, password: string) =>
    api<{ access: string; refresh: string }>('/auth/login/', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  pinLogin: (pin: string) =>
    api<{ access: string; refresh: string; user: import('@/types').User }>('/auth/pin-login/', {
      method: 'POST',
      body: JSON.stringify({ pin }),
    }),
  me: () => api<import('@/types').User>('/auth/users/me/'),
}

async function unwrapPaginated<T>(path: string): Promise<T[]> {
  const data = await api<{ count: number; results: T[] }>(path)
  return data.results
}

// Tables
export const tables = {
  list: () => unwrapPaginated<import('@/types').Table>('/pos/tables/'),
  open: (id: number, guests: number) =>
    api<import('@/types').Order>(`/pos/tables/${id}/open/`, {
      method: 'POST',
      body: JSON.stringify({ guests }),
    }),
  close: (id: number) =>
    api<{ status: string }>(`/pos/tables/${id}/close/`, { method: 'POST' }),
  requestBill: (id: number) =>
    api<{ status: string; table_status: string }>(`/pos/tables/${id}/request_bill/`, { method: 'POST' }),
}

// Menu
export const menu = {
  list: () => unwrapPaginated<import('@/types').MenuItem>('/pos/menu-items/'),
  categories: () => unwrapPaginated<import('@/types').MenuCategory>('/pos/menu-categories/'),
  uploadImage: (id: number, file: File) => {
    const form = new FormData()
    form.append('image', file)
    return api<import('@/types').MenuItem>(`/pos/menu-items/${id}/upload_image/`, {
      method: 'POST',
      body: form,
      headers: {},
    })
  },
}

// Orders
export const orders = {
  list: (query?: string) => unwrapPaginated<import('@/types').Order>(`/pos/orders/${query || ''}`),
  get: (id: string) => api<import('@/types').Order>(`/pos/orders/${id}/`),
  addItem: (orderId: string, item: Partial<import('@/types').OrderItem>) =>
    api<import('@/types').OrderItem>(`/pos/orders/${orderId}/add_item/`, {
      method: 'POST',
      body: JSON.stringify(item),
    }),
  sendToKitchen: (orderId: string) =>
    api<{ status: string; sent: number }>(`/pos/orders/${orderId}/send_to_kitchen/`, {
      method: 'POST',
    }),
  completeItem: (orderId: string, itemId: string) =>
    api<{ status: string; item_status: string }>(`/pos/orders/${orderId}/complete_item/`, {
      method: 'POST',
      body: JSON.stringify({ item_pk: itemId }),
    }),
  updateItem: (orderId: string, itemId: string, data: { quantity?: number; modifiers_json?: { name: string; price_adjustment: number }[] }) =>
    api<import('@/types').OrderItem>(`/pos/orders/${orderId}/update_item/`, {
      method: 'PATCH',
      body: JSON.stringify({ item_pk: itemId, ...data }),
    }),
  removeItem: (orderId: string, itemId: string) =>
    api<{ status: string }>(`/pos/orders/${orderId}/remove_item/${itemId}/`, {
      method: 'DELETE',
    }),
  printReceipt: (orderId: string) => api<ReceiptData>(`/pos/orders/${orderId}/print_receipt/`),
}

export interface ReceiptData {
  restaurant: string
  rnc: string
  direccion: string
  ncf: string
  metodo_pago: string
  mesa: string
  mesero: string
  fecha: string
  items: { cantidad: number; nombre: string; precio: number; total: number; modificadores: string[] }[]
  subtotal: number
  itbis: number
  propina: number
  total: number
  efectivo: number | null
  cambio: number | null
}

// Dashboard
export const dashboardApi = {
  get: () => api<DashboardData>('/pos/dashboard/'),
}

export interface DashboardData {
  ventas_hoy: number
  itbis_hoy: number
  propina_hoy: number
  total_transacciones: number
  ticket_promedio: number
  mesas_ocupadas: number
  mesas_con_cuenta: number
  total_mesas: number
  ordenes_en_cocina: number
  ecf_pendientes: number
  ecf_fallidos: number
  ncf_sequences: { ncf_type: string; current_sequence: number; valid_to: string }[]
  hourly_orders: { hour: number; orders: number }[]
  payment_methods: { efectivo: number; tarjeta: number; transferencia: number; yape: number }
  activity: {
    type: 'order' | 'payment'
    description: string
    table: string
    amount: number | null
    user: string
    time: string
  }[]
}

// Admin
export const adminApi = {
  users: {
    list: () => unwrapPaginated<import('@/types').User>('/auth/users/'),
    create: (data: Partial<import('@/types').User> & { password: string }) =>
      api<import('@/types').User>('/auth/users/', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<import('@/types').User> & { password?: string }) =>
      api<import('@/types').User>(`/auth/users/${id}/`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (id: string) => api<never>(`/auth/users/${id}/`, { method: 'DELETE' }),
  },
  auditLogs: () => unwrapPaginated<AuditLogEntry>('/auth/audit-logs/'),
  menuCategories: {
    list: () => unwrapPaginated<import('@/types').MenuCategory>('/pos/menu-categories/'),
    create: (data: { name: string; order: number }) =>
      api<import('@/types').MenuCategory>('/pos/menu-categories/', { method: 'POST', body: JSON.stringify(data) }),
    remove: (id: number) => api<never>(`/pos/menu-categories/${id}/`, { method: 'DELETE' }),
  },
  menuItems: {
    update: (id: number, data: Partial<import('@/types').MenuItem>) =>
      api<import('@/types').MenuItem>(`/pos/menu-items/${id}/`, { method: 'PATCH', body: JSON.stringify(data) }),
    create: (data: Partial<import('@/types').MenuItem>) =>
      api<import('@/types').MenuItem>('/pos/menu-items/', { method: 'POST', body: JSON.stringify(data) }),
    remove: (id: number) => api<never>(`/pos/menu-items/${id}/`, { method: 'DELETE' }),
  },
  tables: {
    create: (data: { number: string; section: string; capacity: number }) =>
      api<import('@/types').Table>('/pos/tables/', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<import('@/types').Table>) =>
      api<import('@/types').Table>(`/pos/tables/${id}/`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (id: number) => api<never>(`/pos/tables/${id}/`, { method: 'DELETE' }),
  },
}

// Inventory
export const inventory = {
  items: {
    list: (query?: string) => unwrapPaginated<import('@/types').InventoryItem>(`/inventory/items/${query || ''}`),
    create: (data: Partial<import('@/types').InventoryItem>) =>
      api<import('@/types').InventoryItem>('/inventory/items/', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<import('@/types').InventoryItem>) =>
      api<import('@/types').InventoryItem>(`/inventory/items/${id}/`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (id: string) => api<never>(`/inventory/items/${id}/`, { method: 'DELETE' }),
  },
  purchaseOrders: {
    list: (query?: string) => unwrapPaginated<import('@/types').PurchaseOrder>(`/inventory/purchase-orders/${query || ''}`),
    create: (data: Partial<import('@/types').PurchaseOrder>) =>
      api<import('@/types').PurchaseOrder>('/inventory/purchase-orders/', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<import('@/types').PurchaseOrder>) =>
      api<import('@/types').PurchaseOrder>(`/inventory/purchase-orders/${id}/`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (id: string) => api<never>(`/inventory/purchase-orders/${id}/`, { method: 'DELETE' }),
  },
}

// Customers
export const customers = {
  list: (query?: string) => unwrapPaginated<import('@/types').Customer>(`/core/customers/${query || ''}`),
  create: (data: Partial<import('@/types').Customer>) =>
    api<import('@/types').Customer>('/core/customers/', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<import('@/types').Customer>) =>
    api<import('@/types').Customer>(`/core/customers/${id}/`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id: string) => api<never>(`/core/customers/${id}/`, { method: 'DELETE' }),
}

export interface AuditLogEntry {
  id: string
  user: string | null
  user_name: string
  action: 'create' | 'update' | 'delete' | 'login' | 'payment'
  model_name: string
  object_id: string
  description: string
  created_at: string
}
