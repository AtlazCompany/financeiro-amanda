// Testa a geracao do link de primeiro acesso SEM tocar no Supabase real: respostas simuladas, servidor falso local
// e o script verdadeiro rodando no Node atual (sem WebSocket).
import { readFileSync } from 'node:fs'
import http from 'node:http'
import { spawn, spawnSync } from 'node:child_process'
import { makeAdminApi, prepareFirstAccessLink } from './first-access-lib.mjs'

let failures = 0
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  -> ' + extra : ''}`); if (!ok) failures++ }
const rejects = async (name, fn, re) => { try { await fn(); check(name, false, 'nao falhou') } catch (e) { check(name, re.test(e.message), e.message.slice(0, 70)) } }

const ID = 'f0c31479-52ed-4e6c-b9a6-6e789a71e54e'
const SITE = 'https://financeiro-amanda.onrender.com'
const NEW = 'amanda.real@exemplo.com'

// ---------- 1) logica com um Admin falso ----------
const calls = []
const mkAdmin = (users, gen) => ({
  listUsers: async () => ({ data: { users }, error: null }),
  generateLink: async (arg) => { calls.push(arg); return gen ? gen(arg) : { data: { properties: { action_link: 'https://proj.supabase.co/auth/v1/verify?token=SEGREDO&type=recovery', hashed_token: 'HASH123' } }, error: null } },
})
let r = await prepareFirstAccessLink({ admin: mkAdmin([{ id: ID, email: NEW }]), email: '  AMANDA.real@Exemplo.com ', expectedUserId: ID, site: SITE })
check('modo oficial devolve o action_link do Supabase', r.link.includes('/auth/v1/verify?token=SEGREDO') && r.userId === ID)
check('chama generateLink com type=recovery e redirectTo do site', calls[0].type === 'recovery' && calls[0].email === NEW && calls[0].options.redirectTo === `${SITE}/`)
r = await prepareFirstAccessLink({ admin: mkAdmin([{ id: ID, email: NEW }]), email: NEW, expectedUserId: ID, site: SITE, mode: 'anti-previa' })
check('modo anti-previa usa o hashed_token oficial numa pagina do app', r.link === `${SITE}/#/ativar?th=HASH123`)
await rejects('aborta se a troca de e-mail ainda nao foi feita', () => prepareFirstAccessLink({ admin: mkAdmin([{ id: ID, email: 'amanda@financeiro-amanda.app' }]), email: NEW, expectedUserId: ID, site: SITE }), /troca de e-mail/i)
await rejects('aborta se o e-mail pertence a outro id', () => prepareFirstAccessLink({ admin: mkAdmin([{ id: 'outro', email: NEW }]), email: NEW, expectedUserId: ID, site: SITE }), /OUTRA conta/i)
await rejects('aborta se houver mais de uma usuaria no projeto', () => prepareFirstAccessLink({ admin: mkAdmin([{ id: ID, email: NEW }, { id: 'x', email: 'x@y.z' }]), email: NEW, expectedUserId: ID, site: SITE }), /exatamente 1/i)
await rejects('erro do Supabase nao vaza detalhes', () => prepareFirstAccessLink({ admin: mkAdmin([{ id: ID, email: NEW }], async () => ({ data: null, error: { code: 'x', message: 'detalhe interno com SEGREDO' } })), email: NEW, expectedUserId: ID, site: SITE }), /nao gerou o link/i)
await rejects('falha ao listar usuarias aborta', () => prepareFirstAccessLink({ admin: { listUsers: async () => ({ error: { message: 'x' } }) }, email: NEW, expectedUserId: ID, site: SITE }), /consultar/i)

// ---------- 2) API Admin por HTTPS direto (respostas simuladas) ----------
{
  const KEY = 'CHAVE-SECRETA-FALSA-123'
  const seen = []
  const fakeFetch = async (url, init) => {
    seen.push({ url, method: init.method, headers: init.headers, body: init.body })
    if (url.includes('/admin/users')) return new Response(JSON.stringify({ users: [{ id: ID, email: NEW }] }), { status: 200 })
    if (url.includes('/admin/generate_link')) return new Response(JSON.stringify({ action_link: 'https://p.supabase.co/auth/v1/verify?token=T&type=recovery', hashed_token: 'HASH999', email_otp: '123456' }), { status: 200 })
    return new Response('{}', { status: 404 })
  }
  const api = makeAdminApi({ url: 'https://p.supabase.co/', key: KEY, fetchImpl: fakeFetch })
  const out = await prepareFirstAccessLink({ admin: api, email: NEW, expectedUserId: ID, site: SITE, mode: 'anti-previa' })
  check('HTTPS direto: link anti-previa montado com o hashed_token oficial', out.link === `${SITE}/#/ativar?th=HASH999`)
  const gen = seen.find((x) => x.url.endsWith('/auth/v1/admin/generate_link'))
  const body = JSON.parse(gen.body)
  check('POST /auth/v1/admin/generate_link com type=recovery e redirect_to do site', gen.method === 'POST' && body.type === 'recovery' && body.redirect_to === `${SITE}/` && body.email === NEW)
  check('chave vai so nos cabecalhos (nunca na URL nem no corpo)', seen.every((x) => !x.url.includes(KEY) && !(x.body ?? '').includes(KEY) && x.headers.Authorization === `Bearer ${KEY}` && x.headers.apikey === KEY))
  check('conferiu a conta antes (GET /auth/v1/admin/users)', seen[0].method === 'GET' && seen[0].url.includes('/auth/v1/admin/users'))
  const failWith = async (impl) => {
    try { await prepareFirstAccessLink({ admin: makeAdminApi({ url: 'https://p.supabase.co', key: KEY, fetchImpl: impl }), email: NEW, expectedUserId: ID, site: SITE }); return 'nao falhou' } catch (e) { return e.message }
  }
  const m401 = await failWith(async () => new Response('corpo com ' + KEY, { status: 401 }))
  const m500 = await failWith(async () => new Response('x', { status: 500 }))
  const net = await failWith(async () => { throw new Error('ECONNRESET ' + KEY) })
  check('erros HTTP e de rede sao sanitizados (sem chave nem corpo)', [m401, m500, net].every((m) => !m.includes(KEY)) && /consultar/i.test(m401))
}

// ---------- 3) o script verdadeiro, ponta a ponta, contra um servidor FALSO local ----------
{
  const KEY = 'CHAVE-SECRETA-FALSA-E2E'
  const HASH = 'HASH-E2E-ABC'
  const srv = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json')
    if (req.headers.authorization !== `Bearer ${KEY}` || req.headers.apikey !== KEY) { res.statusCode = 401; return res.end('{}') }
    if (req.url.startsWith('/auth/v1/admin/users')) return res.end(JSON.stringify({ users: [{ id: ID, email: NEW }] }))
    if (req.url === '/auth/v1/admin/generate_link' && req.method === 'POST') return res.end(JSON.stringify({ action_link: 'https://x/verify?token=SECRET', hashed_token: HASH }))
    res.statusCode = 404; res.end('{}')
  })
  await new Promise((resolve) => srv.listen(0, '127.0.0.1', resolve))
  const port = srv.address().port
  const run = (key, args = []) => new Promise((resolve) => {
    const p = spawn(process.execPath, ['scripts/first-access-link.mjs', ...args], { env: { ...process.env, SUPABASE_URL: `http://127.0.0.1:${port}`, SUPABASE_SERVICE_ROLE_KEY: key, FIRST_ACCESS_EMAIL: NEW, SITE_URL: SITE } })
    let o = ''
    p.stdout.on('data', (d) => (o += d)); p.stderr.on('data', (d) => (o += d)); p.on('close', (code) => resolve({ code, out: o }))
  })
  const ok = await run(KEY, ['--anti-previa'])
  check(`script roda no Node ${process.versions.node} (sem WebSocket) e termina com sucesso`, ok.code === 0, `exit ${ok.code}`)
  check('mensagem final correta', ok.out.includes('Link gerado e copiado. Pode enviar para Amanda pelo WhatsApp.'))
  check('terminal NAO mostra chave, hash nem link', !ok.out.includes(KEY) && !ok.out.includes(HASH) && !ok.out.includes('SECRET') && !ok.out.includes('#/ativar'))
  if (process.platform === 'win32') {
    const getClip = () => spawnSync('powershell.exe', ['-NoProfile', '-Command', 'Get-Clipboard -Raw']).stdout.toString().trim()
    check('area de transferencia recebeu o link anti-previa', getClip() === `${SITE}/#/ativar?th=${HASH}`)
    spawnSync('powershell.exe', ['-NoProfile', '-Command', 'Set-Clipboard -Value $null']) // limpa o link falso
    check('area de transferencia limpa apos o teste', !getClip().includes('ativar'))
  }
  const bad = await run('CHAVE-ERRADA-XYZ')
  check('chave invalida: falha sanitizada (sem a chave) e saida 1', bad.code === 1 && !bad.out.includes('CHAVE-ERRADA-XYZ') && /FALHA/.test(bad.out))
  srv.close()
}

// ---------- 4) o link leva a /#/ativar e o botao usa a verificacao oficial ----------
{
  const activate = readFileSync('src/pages/Activate.tsx', 'utf8')
  const auth = readFileSync('src/data/AuthContext.tsx', 'utf8')
  const app = readFileSync('src/App.tsx', 'utf8')
  const main = readFileSync('scripts/first-access-link.mjs', 'utf8')
  const lib = readFileSync('scripts/first-access-lib.mjs', 'utf8')
  const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
  check('script principal nao usa supabase-js nem WebSocket', !/supabase-js|WebSocket/.test(code(main)) && !/supabase-js|WebSocket/.test(code(lib)))
  check('script principal nao imprime o link e nao grava arquivos', !/console\.\w+\(\s*link\b|\$\{link\}/.test(main) && !/writeFile|appendFile/.test(main))
  check('chave service_role so vem de variavel de ambiente e e mascarada nos erros', /process\.env\.SUPABASE_SERVICE_ROLE_KEY/.test(main) && !/eyJ[A-Za-z0-9_-]{20,}|sb_secret_[A-Za-z0-9]/.test(main) && /replace\(key, '\*\*\*'\)/.test(main))
  check('rota /ativar existe e e publica (fora do bloco protegido)', /path="\/ativar"/.test(app) && app.indexOf('path="/ativar"') < app.indexOf('<Protected>'))
  check('pagina le o parametro "th" (o mesmo que o link usa)', /params\.get\('th'\)/.test(activate))
  check('abrir a pagina NAO consome o codigo (so o clique chama a verificacao)', !/useEffect/.test(activate) && /onClick=\{go\}/.test(activate))
  check('o botao usa supabase.auth.verifyOtp({ token_hash, type: "recovery" }) (API oficial)', /verifyOtp\(\{ token_hash: tokenHash, type: 'recovery' \}\)/.test(auth))
  check('depois de verificar, vai para /nova-senha (a propria usuaria cria a senha)', /navigate\('\/nova-senha'/.test(activate))
  check('o codigo sai da barra de enderecos apos a leitura', /replaceState\(null, '', '\/#\/ativar'\)/.test(activate))
}

console.log(failures === 0 ? '\nTODOS OS TESTES DO LINK DE PRIMEIRO ACESSO PASSARAM' : `\n${failures} FALHA(S)`)
process.exit(failures === 0 ? 0 : 1)
