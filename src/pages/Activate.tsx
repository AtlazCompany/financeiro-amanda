import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../data/AuthContext'
import { Button, ErrorBox } from '../components/Ui'

/**
 * Pagina de PRIMEIRO ACESSO (link enviado pelo WhatsApp).
 * O codigo de uso unico so e consumido quando a usuaria TOCA no botao: assim a pre-visualizacao do link
 * (WhatsApp, Safari, antivirus) nao "gasta" o link antes dela abrir.
 */
export default function Activate() {
  const [params] = useSearchParams()
  // guarda o codigo em memoria e tira da barra de enderecos/historico
  const [token] = useState(() => {
    const t = params.get('th')
    if (t) window.history.replaceState(null, '', '/#/ativar')
    return t
  })
  const { verifyAccessCode } = useAuth()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const go = async () => {
    if (!token) return
    setBusy(true)
    setErr(null)
    const msg = await verifyAccessCode(token)
    if (msg) {
      setErr(msg)
      setBusy(false)
      return
    }
    navigate('/nova-senha', { replace: true })
  }

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-brand-100" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div aria-hidden className="pointer-events-none absolute -left-16 -top-20 h-72 w-72 rounded-full bg-brand-300/45 blur-3xl" />
      <div className="relative flex flex-1 flex-col items-center justify-center px-6 pb-8 pt-12 text-center">
        <img src="/icon.svg" alt="" className="h-24 w-24 rounded-[1.7rem] shadow-pop" />
        <h1 className="mt-6 text-[2.2rem] leading-tight text-brand-800">Bem-vinda, Amanda!</h1>
        <p className="mt-2 max-w-xs text-brand-800/80">Toque no botão para ativar o seu acesso e criar a sua senha.</p>
      </div>
      <div
        className="anim-rise relative mx-auto w-full max-w-xl space-y-4 rounded-t-[2rem] bg-paper px-6 pt-8 shadow-[0_-12px_40px_-20px_rgba(113,61,84,0.35)]"
        style={{ paddingBottom: 'calc(1.75rem + env(safe-area-inset-bottom))' }}
      >
        {!token && <ErrorBox>Link incompleto. Peça um novo link de acesso.</ErrorBox>}
        {err && <ErrorBox>{err}</ErrorBox>}
        <Button full loading={busy} disabled={!token} onClick={go} className="min-h-14 text-lg">Ativar meu acesso</Button>
      </div>
    </div>
  )
}
