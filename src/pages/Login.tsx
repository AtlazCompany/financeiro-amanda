import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../data/AuthContext'
import { Button, ErrorBox, Field, inputCls } from '../components/Ui'
import { isConfigured } from '../lib/supabase'

export default function Login() {
  const { session, signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (session) return <Navigate to="/" replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    const msg = await signIn(email, password)
    if (msg) setErr(msg)
    setBusy(false)
  }

  return (
    <div className="flex min-h-dvh flex-col bg-brand-900" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="flex flex-1 flex-col items-center justify-center px-6 pb-6 pt-10 text-white">
        <img src="/icon.svg" alt="" className="h-24 w-24 rounded-[1.4rem] shadow-xl" />
        <h1 className="mt-5 text-3xl font-extrabold">Financeiro Amanda</h1>
        <p className="mt-1 text-brand-100">Vendas, parcelas e boletos em um só lugar</p>
      </div>
      <form
        onSubmit={submit}
        className="mx-auto w-full max-w-xl space-y-4 rounded-t-3xl bg-white px-6 pt-7"
        style={{ paddingBottom: 'calc(1.75rem + env(safe-area-inset-bottom))' }}
      >
        {!isConfigured && <ErrorBox>Configuração do banco ausente (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).</ErrorBox>}
        <Field label="E-mail" htmlFor="email">
          <input
            id="email" name="email" type="email" className={inputCls} autoComplete="username" inputMode="email"
            autoCapitalize="none" autoCorrect="off" spellCheck={false} required
            value={email} onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label="Senha" htmlFor="password">
          <input
            id="password" name="password" type="password" className={inputCls} autoComplete="current-password"
            required value={password} onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        {err && <ErrorBox>{err}</ErrorBox>}
        <Button type="submit" full loading={busy}>Entrar</Button>
      </form>
    </div>
  )
}
