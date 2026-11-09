import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { authErrorMessage, parseAuthHash } from './lib/authLink.ts'
import { supabase } from './lib/supabase.ts'

/** Link de recuperacao de senha (vem no fragmento da URL): precisa ser tratado antes do HashRouter subir. */
async function consumeAuthLink() {
  const link = parseAuthHash(window.location.hash)
  if (!link) return
  if (link.kind === 'recovery') {
    const { error } = await supabase.auth.setSession({ access_token: link.accessToken, refresh_token: link.refreshToken })
    if (error) sessionStorage.setItem('auth-msg', authErrorMessage('otp_expired'))
    window.history.replaceState(null, '', error ? '/#/login' : '/#/nova-senha')
  } else {
    sessionStorage.setItem('auth-msg', authErrorMessage(link.code))
    window.history.replaceState(null, '', '/#/login')
  }
}

consumeAuthLink()
  .catch(() => window.history.replaceState(null, '', '/#/login'))
  .finally(() => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
