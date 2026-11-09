// Verificacao POS-troca (somente chamadas publicas da API de Auth; nunca imprime senhas nem tokens).
//   URL=... KEY=... OLD_EMAIL=amanda@financeiro-amanda.app OLD_PASS=<senha provisoria antiga> node --experimental-websocket scripts/post-swap-verify.mjs
//   Opcional: NEW_EMAIL=<e-mail definitivo> SEND_RECOVERY=1  -> envia O E-MAIL de recuperacao para a Amanda (acao real, so com autorizacao).
// A senha da Amanda NUNCA e usada aqui: ela a define pelo link do e-mail.
const { URL: url, KEY: key, OLD_EMAIL, OLD_PASS, NEW_EMAIL, SEND_RECOVERY } = process.env
// SITE (opcional): endereco publico do app
const H = { apikey: key, 'Content-Type': 'application/json' }
let failures = 0
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  -> ' + extra : ''}`); if (!ok) failures++ }
const post = async (path, body) => { const r = await fetch(`${url}/auth/v1/${path}`, { method: 'POST', headers: H, body: JSON.stringify(body) }); return { status: r.status, body: await r.json().catch(() => ({})) } }

// Configuracao do Auth (sem efeitos colaterais): um token invalido em /verify redireciona para a Site URL
// (ou para o redirect_to, se ele estiver na lista de URLs permitidas).
const SITE = process.env.SITE ?? 'https://financeiro-amanda.onrender.com'
{
  const loc = async (qs) => (await fetch(`${url}/auth/v1/verify?token=invalido&type=recovery${qs}`, { headers: { apikey: key }, redirect: 'manual' })).headers.get('location') ?? ''
  const a = await loc('')
  check(`Site URL do Supabase = ${SITE}`, a.startsWith(SITE), a.split('#')[0] || '(sem redirecionamento)')
  const b = await loc(`&redirect_to=${encodeURIComponent(SITE + '/')}`)
  check('Redirect URLs permite o endereco do site', b.startsWith(SITE), b.split('#')[0])
}

if (OLD_EMAIL && OLD_PASS) {
  const r = await post('token?grant_type=password', { email: OLD_EMAIL, password: OLD_PASS })
  check('e-mail provisorio + senha antiga NAO entram mais', r.status === 400 && !r.body.access_token, `HTTP ${r.status}`)
}
{
  const r = await post('signup', { email: `intruso-${Date.now()}@example.com`, password: 'Senha-Forte-123!x' })
  check('cadastro publico continua bloqueado', r.status >= 400 && !r.body.access_token, r.body.message ?? `HTTP ${r.status}`)
}
{
  const r = await post('recover', { email: `nao-existe-${Date.now()}@example.com` })
  check('recuperacao responde igual para e-mail inexistente (nao revela quem existe)', r.status === 200)
}
if (NEW_EMAIL && SEND_RECOVERY === '1') {
  const r = await post('recover', { email: NEW_EMAIL, redirect_to: `${SITE}/` })
  check('pedido de recuperacao aceito para o e-mail definitivo (verifique a caixa de entrada/spam)', r.status === 200, `HTTP ${r.status}${r.body.msg ? ' ' + r.body.msg : ''}`)
}
console.log(failures === 0 ? '\nVERIFICACAO POS-TROCA OK' : `\n${failures} FALHA(S)`)
process.exit(failures === 0 ? 0 : 1)
