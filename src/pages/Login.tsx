import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../data/AuthContext'
import { Button, ErrorBox, Field, inputCls } from '../components/Ui'
import { isConfigured } from '../lib/supabase'

type Mode = 'login' | 'reset' | 'sent'

export default function Login() {
  const { session, signIn, requestPasswordReset } = useAuth()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState<string | null>(() => {
    const m = sessionStorage.getItem('auth-msg') // erro de link de recuperacao expirado
    if (m) sessionStorage.removeItem('auth-msg')
    return m
  })
  const [busy, setBusy] = useState(false)

  if (session) return <Navigate to="/" replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    if (mode === 'reset') {
      const msg = await requestPasswordReset(email)
      if (msg) setErr(msg)
      else setMode('sent')
    } else {
      const msg = await signIn(email, password)
      if (msg) setErr(msg)
    }
    setBusy(false)
  }

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-brand-100" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      {/* decoracao rosa suave (apenas CSS, sem imagens) */}
      <div aria-hidden className="pointer-events-none absolute -left-16 -top-20 h-72 w-72 rounded-full bg-brand-300/45 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -right-20 top-40 h-64 w-64 rounded-full bg-brand-200/80 blur-3xl" />
      <div className="relative flex flex-1 flex-col items-center justify-center px-6 pb-8 pt-12 text-center">
        <img src="/icon.svg" alt="" className="h-24 w-24 rounded-[1.7rem] shadow-pop" />
        <h1 className="mt-6 text-[2.4rem] leading-tight text-brand-800">Financeiro Amanda</h1>
        <p className="mt-2 max-w-xs text-brand-800/80">Vendas, lucro, parcelas e boletos com a elegância que o seu negócio merece.</p>
      </div>
      <form
        onSubmit={submit}
        className="anim-rise relative mx-auto w-full max-w-xl space-y-4 rounded-t-[2rem] bg-paper px-6 pt-8 shadow-[0_-12px_40px_-20px_rgba(113,61,84,0.35)]"
        style={{ paddingBottom: 'calc(1.75rem + env(safe-area-inset-bottom))' }}
      >
        {!isConfigured && <ErrorBox>Configuração do banco ausente (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).</ErrorBox>}

        {mode === 'sent' ? (
          <>
            <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
              Se este e-mail estiver autorizado, você receberá um link em instantes para criar ou trocar a senha. Confira também a caixa de spam. O link vale por pouco tempo.
            </div>
            <Button full variant="secondary" onClick={() => { setMode('login'); setErr(null) }}>Voltar ao login</Button>
          </>
        ) : (
          <>
            <Field label="E-mail" htmlFor="email">
              <input
                id="email" name="email" type="email" className={inputCls} autoComplete="username" inputMode="email"
                autoCapitalize="none" autoCorrect="off" spellCheck={false} required
                value={email} onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            {mode === 'login' && (
              <Field label="Senha" htmlFor="password">
                <input
                  id="password" name="password" type="password" className={inputCls} autoComplete="current-password"
                  required value={password} onChange={(e) => setPassword(e.target.value)}
                />
              </Field>
            )}
            {mode === 'reset' && <p className="text-sm text-stone-600">Digite o e-mail cadastrado. Enviaremos um link para você criar a sua senha.</p>}
            {err && <ErrorBox>{err}</ErrorBox>}
            <Button type="submit" full loading={busy} className="min-h-14 text-lg">{mode === 'login' ? 'Entrar' : 'Enviar link'}</Button>
            <Button full variant="ghost" onClick={() => { setMode(mode === 'login' ? 'reset' : 'login'); setErr(null) }}>
              {mode === 'login' ? 'Esqueci minha senha / primeiro acesso' : 'Voltar ao login'}
            </Button>
          </>
        )}
      </form>
    </div>
  )
}
