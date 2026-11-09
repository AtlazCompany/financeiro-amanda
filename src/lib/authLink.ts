/**
 * Link de recuperacao do Supabase (fluxo "implicit"): chega como
 *   https://site/#access_token=...&refresh_token=...&type=recovery
 * ou, se expirou/ja foi usado,
 *   https://site/#error=access_denied&error_code=otp_expired&error_description=...
 * Como o app usa HashRouter, o fragmento precisa ser lido ANTES de o roteador subir.
 * O fluxo implicit (e nao PKCE) e proposital: funciona mesmo quando o e-mail abre em outro
 * navegador (no iPhone, o Mail abre o Safari, que nao compartilha dados com o app da tela de inicio).
 */
export type AuthLink =
  | { kind: 'recovery'; accessToken: string; refreshToken: string }
  | { kind: 'error'; code: string }
  | null

export function parseAuthHash(hash: string): AuthLink {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash
  // rotas normais do app ("/vendas", "/login?x=1") nao sao links de autenticacao
  if (!raw || raw.startsWith('/')) return null
  const p = new URLSearchParams(raw)
  const err = p.get('error_code') ?? p.get('error')
  if (err) return { kind: 'error', code: err }
  const access = p.get('access_token')
  const refresh = p.get('refresh_token')
  if (access && refresh && p.get('type') === 'recovery') return { kind: 'recovery', accessToken: access, refreshToken: refresh }
  return null
}

export function authErrorMessage(code: string): string {
  if (code === 'otp_expired' || code === 'access_denied') return 'Este link expirou ou já foi usado. Peça um novo em “Esqueci minha senha”.'
  return 'Não foi possível validar o link. Peça um novo em “Esqueci minha senha”.'
}
