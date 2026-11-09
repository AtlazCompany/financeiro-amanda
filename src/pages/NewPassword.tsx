import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../data/AuthContext'
import { Button, ErrorBox, Field, Spinner, inputCls, useToast } from '../components/Ui'
import { MIN_PASSWORD, validateNewPassword } from '../lib/password'

/** Tela aberta pelo link enviado ao e-mail: a propria Amanda define a senha. A senha nunca e exibida nem registrada. */
export default function NewPassword() {
  const { session, loading, updatePassword } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (loading) return <Spinner />
  if (!session) return <Navigate to="/login" replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const v = validateNewPassword(password, confirm, session.user.email ?? undefined)
    if (v) return setErr(v)
    setBusy(true)
    setErr(null)
    const msg = await updatePassword(password)
    if (msg) {
      setErr(msg)
      setBusy(false)
      return
    }
    toast('Senha definida! Bem-vinda.')
    navigate('/', { replace: true })
  }

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-brand-100" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div aria-hidden className="pointer-events-none absolute -left-16 -top-20 h-72 w-72 rounded-full bg-brand-300/45 blur-3xl" />
      <div className="relative flex flex-1 flex-col items-center justify-center px-6 pb-8 pt-12 text-center">
        <img src="/icon.svg" alt="" className="h-20 w-20 rounded-[1.5rem] shadow-pop" />
        <h1 className="mt-5 text-[2rem] leading-tight text-brand-800">Crie a sua senha</h1>
        <p className="mt-2 max-w-xs text-brand-800/80">Só você vai saber esta senha. Use no mínimo {MIN_PASSWORD} caracteres.</p>
      </div>
      <form
        onSubmit={submit}
        noValidate
        className="anim-rise relative mx-auto w-full max-w-xl space-y-4 rounded-t-[2rem] bg-paper px-6 pt-8 shadow-[0_-12px_40px_-20px_rgba(113,61,84,0.35)]"
        style={{ paddingBottom: 'calc(1.75rem + env(safe-area-inset-bottom))' }}
      >
        <Field label="Nova senha" htmlFor="np1">
          <input id="np1" name="new-password" type="password" className={inputCls} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field label="Repita a nova senha" htmlFor="np2">
          <input id="np2" name="confirm-password" type="password" className={inputCls} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
        {err && <ErrorBox>{err}</ErrorBox>}
        <Button type="submit" full loading={busy} className="min-h-14 text-lg">Salvar senha</Button>
      </form>
    </div>
  )
}
