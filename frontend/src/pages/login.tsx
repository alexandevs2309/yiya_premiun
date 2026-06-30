import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Shell, Eye, EyeOff, User, Lock, Fingerprint } from 'lucide-react'
import { auth, setTokens } from '@/services/api'
import { useAppStore } from '@/stores/app-store'
import { useNavigationStore } from '@/stores/navigation-store'

type Mode = 'credentials' | 'pin'

export function LoginPage() {
  const [mode, setMode] = useState<Mode>('credentials')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [pin, setPin] = useState(['', '', '', '', '', ''])
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const setUser = useAppStore((s) => s.setUser)
  const setActiveModule = useNavigationStore((s) => s.setActiveModule)

  const pinStr = pin.join('').replace(/\D/g, '')

  const handleFullLogin = async (access: string, refresh: string) => {
    setTokens(access, refresh)
    const user = await auth.me()
    setUser(user)
    const defaults: Record<string, string> = {
      admin: 'dashboard', waiter: 'floor-plan', cook: 'kds', cashier: 'cashier',
    }
    setActiveModule((defaults[user.role] || 'floor-plan') as any)
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username || !password) { setError('Completa ambos campos'); return }
    setLoading(true); setError('')
    try {
      const tokens = await auth.login(username, password)
      await handleFullLogin(tokens.access, tokens.refresh)
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión')
    } finally { setLoading(false) }
  }

  const handlePinDigit = (i: number, val: string) => {
    if (val && !/^\d$/.test(val)) return
    const next = [...pin]
    next[i] = val
    setPin(next)
    setError('')

    if (val && i < 5 && !next[i + 1]) {
      const nextInput = document.getElementById(`pin-${i + 1}`)
      nextInput?.focus()
    }
  }

  const handlePinKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !pin[i] && i > 0) {
      const next = [...pin]
      next[i - 1] = ''
      setPin(next)
      document.getElementById(`pin-${i - 1}`)?.focus()
    }
    if (e.key === 'Enter' && pinStr.length >= 4) {
      handlePinSubmit()
    }
  }

  const handlePinSubmit = async () => {
    if (pinStr.length < 4) { setError('Ingresa el PIN completo'); return }
    setLoading(true); setError('')
    try {
      const data = await auth.pinLogin(pinStr)
      setTokens(data.access, data.refresh)
      setUser(data.user)
      const defaults: Record<string, string> = {
        admin: 'dashboard', waiter: 'floor-plan', cook: 'kds', cashier: 'cashier',
      }
      setActiveModule((defaults[data.user.role] || 'floor-plan') as any)
    } catch (err: any) {
      setError(err.message || 'PIN incorrecto')
      setPin(['', '', '', '', '', ''])
      document.getElementById('pin-0')?.focus()
    } finally { setLoading(false) }
  }

  const switchMode = () => {
    setMode(mode === 'credentials' ? 'pin' : 'credentials')
    setError('')
    setPin(['', '', '', '', '', ''])
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm relative"
      >
        <Card className="border-primary/10 shadow-xl shadow-primary/5">
          <CardContent className="p-8">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-dorado-champan-500 shadow-lg shadow-primary/20 mb-4">
                <Shell className="w-8 h-8 text-primary-foreground" />
              </div>
              <h1 className="text-2xl font-bold">D'Yiya POS</h1>
              <p className="text-sm text-muted-foreground mt-1">Samaná · Sistema de Gestión</p>
            </div>

            <AnimatePresence mode="wait">
              {mode === 'credentials' ? (
                <motion.form key="creds" onSubmit={handleLogin} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Usuario</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input type="text" value={username} onChange={(e) => setUsername(e.target.value)}
                        className="w-full h-10 pl-10 pr-3 rounded-lg bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all placeholder:text-muted-foreground/50"
                        placeholder="usuario" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Contraseña</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
                        className="w-full h-10 pl-10 pr-10 rounded-lg bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all placeholder:text-muted-foreground/50"
                        placeholder="contraseña" />
                      <Button type="button" variant="ghost" size="icon" onClick={() => setShowPw(!showPw)} className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground">
                        {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                  {error && (
                    <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-xs text-destructive bg-destructive/5 px-3 py-2 rounded-lg">
                      {error}
                    </motion.p>
                  )}
                  <Button type="submit" className="w-full shadow-lg shadow-primary/20" disabled={loading} size="lg">
                    {loading ? 'Entrando...' : 'Entrar'}
                  </Button>
                  <Button type="button" variant="link" size="sm" onClick={switchMode} className="w-full text-xs">
                    <Fingerprint className="w-3 h-3" /> Acceso con PIN para meseros
                  </Button>
                </motion.form>
              ) : (
                <motion.div key="pin" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
                  <div className="text-center">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-3">
                      <Fingerprint className="w-6 h-6 text-primary" />
                    </div>
                    <p className="text-sm text-muted-foreground">Ingresa tu PIN de mesero</p>
                  </div>
                  <div className="flex justify-center gap-2.5">
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <input key={i} id={`pin-${i}`} type="password" inputMode="numeric" maxLength={1}
                        value={pin[i]} onChange={(e) => handlePinDigit(i, e.target.value)} onKeyDown={(e) => handlePinKeyDown(i, e)}
                        className="w-11 h-14 text-center text-lg font-mono rounded-xl bg-input border border-border focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
                        autoFocus={i === 0} />
                    ))}
                  </div>
                  {error && (
                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-destructive text-center bg-destructive/5 px-3 py-2 rounded-lg">
                      {error}
                    </motion.p>
                  )}
                  <div className="flex gap-3 pt-1">
                    <Button variant="outline" className="flex-1" onClick={switchMode}>Cancelar</Button>
                    <Button className="flex-1" onClick={handlePinSubmit} disabled={loading || pinStr.length < 4}>
                      {loading ? 'Verificando...' : 'Acceder'}
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
        <p className="text-[10px] text-muted-foreground text-center mt-4">D'Yiya Restaurant POS v1.0</p>
      </motion.div>
    </div>
  )
}
