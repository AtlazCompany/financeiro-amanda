import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface AuthState {
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
  /** Envia o link de recuperacao/definicao de senha. Resposta sempre generica (nao revela se o e-mail existe). */
  requestPasswordReset: (email: string) => Promise<string | null>
  /** Define a nova senha da usuaria logada (via link de recuperacao) e encerra as outras sessoes. */
  updatePassword: (password: string) => Promise<string | null>
}

const Ctx = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (!error) return null
    if (/invalid login/i.test(error.message)) return 'E-mail ou senha incorretos.'
    if (/fetch|network/i.test(error.message)) return 'Sem conexão com a internet.'
    return error.message
  }
  const signOut = async () => {
    await supabase.auth.signOut()
  }
  const requestPasswordReset = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/` })
    if (!error) return null
    if (/rate limit|too many|seconds/i.test(error.message)) return 'Aguarde alguns minutos antes de pedir outro link.'
    if (/fetch|network/i.test(error.message)) return 'Sem conexão com a internet.'
    return null // qualquer outro caso: resposta generica, sem revelar se o e-mail existe
  }
  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      if (/same password|different from the old/i.test(error.message)) return 'Escolha uma senha diferente da anterior.'
      if (/weak|at least/i.test(error.message)) return 'Essa senha é fraca demais. Use mais caracteres.'
      if (/fetch|network/i.test(error.message)) return 'Sem conexão com a internet.'
      return 'Não foi possível salvar a senha. Peça um novo link e tente de novo.'
    }
    await supabase.auth.signOut({ scope: 'others' })
    return null
  }

  return <Ctx.Provider value={{ session, loading, signIn, signOut, requestPasswordReset, updatePassword }}>{children}</Ctx.Provider>
}

export function useAuth(): AuthState {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth fora do AuthProvider')
  return v
}
