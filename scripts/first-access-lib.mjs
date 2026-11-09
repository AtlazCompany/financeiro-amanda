// Logica (testavel) para gerar o LINK DE PRIMEIRO ACESSO pela API oficial do Supabase Auth Admin.
// Nunca imprime nem registra o link: quem chama decide onde entregar (ex.: area de transferencia).

/**
 * @param {object} p
 * @param {{ listUsers: Function, generateLink: Function }} p.admin  supabase.auth.admin
 * @param {string} p.email           e-mail DEFINITIVO da usuaria
 * @param {string} p.expectedUserId  id que deve ser preservado
 * @param {string} p.site            https://financeiro-amanda.onrender.com
 * @param {'oficial'|'anti-previa'} [p.mode]
 *   oficial     -> action_link devolvido pelo Supabase (…/auth/v1/verify?token=…)
 *   anti-previa -> pagina do app que so consome o codigo quando a usuaria TOCA no botao (evita que a previa do
 *                  WhatsApp "gaste" o link de uso unico); usa o token_hash oficial retornado pelo generateLink.
 */
export async function prepareFirstAccessLink({ admin, email, expectedUserId, site, mode = 'oficial' }) {
  const wanted = String(email).trim().toLowerCase()
  const listed = await admin.listUsers({ page: 1, perPage: 1000 })
  if (listed.error) throw new Error('Nao foi possivel consultar as usuarias (confira a chave e a URL do projeto).')
  const users = listed.data?.users ?? []
  const matches = users.filter((u) => (u.email ?? '').toLowerCase() === wanted)
  if (matches.length !== 1) {
    throw new Error('Nenhuma conta com o e-mail definitivo. Rode primeiro a troca de e-mail (supabase/local/change-email.amanda.sql).')
  }
  if (matches[0].id !== expectedUserId) throw new Error('O e-mail pertence a OUTRA conta (id diferente do esperado). Abortado.')
  if (users.length !== 1) throw new Error(`Esperada exatamente 1 usuaria no projeto, encontradas ${users.length}. Abortado.`)

  const { data, error } = await admin.generateLink({ type: 'recovery', email: wanted, options: { redirectTo: `${site}/` } })
  if (error || !data?.properties) throw new Error('O Supabase nao gerou o link (' + (error?.code ?? error?.status ?? 'erro') + ').')
  const p = data.properties
  if (mode === 'anti-previa') {
    if (!p.hashed_token) throw new Error('O Supabase nao devolveu o hashed_token.')
    return { link: `${site}/#/ativar?th=${encodeURIComponent(p.hashed_token)}`, userId: matches[0].id }
  }
  if (!p.action_link) throw new Error('O Supabase nao devolveu o action_link.')
  return { link: p.action_link, userId: matches[0].id }
}

/**
 * Cliente minimo do Supabase Auth Admin por HTTPS direto (sem @supabase/supabase-js e sem Realtime/WebSocket,
 * entao funciona no Node 20). Usa so duas rotas oficiais:
 *   GET  /auth/v1/admin/users           (confere a conta)
 *   POST /auth/v1/admin/generate_link   (gera o link de recuperacao; nao envia e-mail)
 * Os erros trazem apenas o codigo HTTP: nunca a chave, o corpo da resposta ou o link.
 */
export function makeAdminApi({ url, key, fetchImpl = globalThis.fetch, timeoutMs = 20000 }) {
  const base = String(url).replace(/\/+$/, '')
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
  const call = async (path, init) => {
    try {
      const r = await fetchImpl(`${base}${path}`, { ...init, headers, signal: AbortSignal.timeout(timeoutMs) })
      if (!r.ok) return { error: { status: r.status } }
      return { json: await r.json() }
    } catch {
      return { error: { status: 'rede' } }
    }
  }
  return {
    async listUsers() {
      const { json, error } = await call('/auth/v1/admin/users?page=1&per_page=1000', { method: 'GET' })
      return error ? { error } : { data: { users: json?.users ?? [] } }
    },
    async generateLink({ type, email, options }) {
      const body = { type, email, ...(options?.redirectTo ? { redirect_to: options.redirectTo } : {}) }
      const { json, error } = await call('/auth/v1/admin/generate_link', { method: 'POST', body: JSON.stringify(body) })
      if (error) return { error }
      const props = json?.properties ?? json // a API devolve os campos no topo; alguns clientes aninham em "properties"
      return { data: { properties: { action_link: props?.action_link, hashed_token: props?.hashed_token } } }
    },
  }
}
