// Testa a logica do link de primeiro acesso com um Admin FALSO (nenhuma chamada ao Supabase).
import { readFileSync } from 'node:fs'
import { prepareFirstAccessLink } from './first-access-lib.mjs'

let failures = 0
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  -> ' + extra : ''}`); if (!ok) failures++ }
const rejects = async (name, fn, re) => { try { await fn(); check(name, false, 'nao falhou') } catch (e) { check(name, re.test(e.message), e.message.slice(0, 70)) } }

const ID = 'f0c31479-52ed-4e6c-b9a6-6e789a71e54e'
const SITE = 'https://financeiro-amanda.onrender.com'
const NEW = 'amanda.real@exemplo.com'
const calls = []
const mkAdmin = (users, gen) => ({
  listUsers: async () => ({ data: { users }, error: null }),
  generateLink: async (arg) => { calls.push(arg); return gen ? gen(arg) : { data: { properties: { action_link: 'https://proj.supabase.co/auth/v1/verify?token=SEGREDO&type=recovery', hashed_token: 'HASH123' } }, error: null } },
})

// caminho feliz
let r = await prepareFirstAccessLink({ admin: mkAdmin([{ id: ID, email: NEW }]), email: '  AMANDA.real@Exemplo.com ', expectedUserId: ID, site: SITE })
check('modo oficial devolve o action_link do Supabase', r.link.includes('/auth/v1/verify?token=SEGREDO') && r.userId === ID)
check('chama generateLink com type=recovery e redirectTo do site', calls[0].type === 'recovery' && calls[0].email === NEW && calls[0].options.redirectTo === `${SITE}/`)
r = await prepareFirstAccessLink({ admin: mkAdmin([{ id: ID, email: NEW }]), email: NEW, expectedUserId: ID, site: SITE, mode: 'anti-previa' })
check('modo anti-previa usa o hashed_token oficial numa pagina do app', r.link === `${SITE}/#/ativar?th=HASH123`)

// protecoes
await rejects('aborta se a troca de e-mail ainda nao foi feita', () => prepareFirstAccessLink({ admin: mkAdmin([{ id: ID, email: 'amanda@financeiro-amanda.app' }]), email: NEW, expectedUserId: ID, site: SITE }), /troca de e-mail/i)
await rejects('aborta se o e-mail pertence a outro id', () => prepareFirstAccessLink({ admin: mkAdmin([{ id: 'outro', email: NEW }]), email: NEW, expectedUserId: ID, site: SITE }), /OUTRA conta/i)
await rejects('aborta se houver mais de uma usuaria no projeto', () => prepareFirstAccessLink({ admin: mkAdmin([{ id: ID, email: NEW }, { id: 'x', email: 'x@y.z' }]), email: NEW, expectedUserId: ID, site: SITE }), /exatamente 1/i)
await rejects('erro do Supabase nao vaza detalhes', () => prepareFirstAccessLink({ admin: mkAdmin([{ id: ID, email: NEW }], async () => ({ data: null, error: { code: 'x', message: 'detalhe interno com SEGREDO' } })), email: NEW, expectedUserId: ID, site: SITE }), /nao gerou o link/i)
await rejects('falha ao listar usuarias aborta', () => prepareFirstAccessLink({ admin: { listUsers: async () => ({ error: { message: 'x' } }) }, email: NEW, expectedUserId: ID, site: SITE }), /consultar/i)

// o link nunca e impresso nem gravado
const main = readFileSync('scripts/first-access-link.mjs', 'utf8')
check('script principal nao imprime o link (so copia)', !/console\.\w+\(\s*link\b|\$\{link\}/.test(main) && !/writeFile|appendFile/.test(main))
check('chave service_role so vem de variavel de ambiente', !/eyJ[A-Za-z0-9_-]{20,}|sb_secret_[A-Za-z0-9]/.test(main) && /process\.env\.SUPABASE_SERVICE_ROLE_KEY/.test(main))
check('erros mascaram a chave', /replace\(key, '\*\*\*'\)/.test(main))

console.log(failures === 0 ? '\nTODOS OS TESTES DO LINK DE PRIMEIRO ACESSO PASSARAM' : `\n${failures} FALHA(S)`)
process.exit(failures === 0 ? 0 : 1)
