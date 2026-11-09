// Gera o link de primeiro acesso e COPIA para a area de transferencia, sem exibi-lo.
// Rode na SUA maquina (PowerShell), de preferencia via scripts/primeiro-acesso.ps1, que pede a chave de forma oculta.
//   Variaveis: SUPABASE_SERVICE_ROLE_KEY (secreta, so em memoria), FIRST_ACCESS_EMAIL
//   Opcionais: SUPABASE_URL, SITE_URL; argumento --anti-previa
// Usa HTTPS direto na API Admin (sem @supabase/supabase-js: nao precisa de WebSocket, roda no Node 20).
// A chave service_role NUNCA deve ser colada em chat, arquivo ou commit.
import { spawnSync } from 'node:child_process'
import { makeAdminApi, prepareFirstAccessLink } from './first-access-lib.mjs'

const URL = process.env.SUPABASE_URL ?? 'https://cxomheudimvujwooslfu.supabase.co'
const SITE = process.env.SITE_URL ?? 'https://financeiro-amanda.onrender.com'
const EXPECTED_ID = 'f0c31479-52ed-4e6c-b9a6-6e789a71e54e'
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const email = process.env.FIRST_ACCESS_EMAIL
const mode = process.argv.includes('--anti-previa') ? 'anti-previa' : 'oficial'

function copy(text) {
  const r = process.platform === 'win32' ? spawnSync('clip', { input: text })
    : process.platform === 'darwin' ? spawnSync('pbcopy', { input: text })
    : spawnSync('xclip', ['-selection', 'clipboard'], { input: text })
  return r.status === 0
}

if (!key || !email) {
  console.error('Defina SUPABASE_SERVICE_ROLE_KEY e FIRST_ACCESS_EMAIL (use scripts/primeiro-acesso.ps1).')
  process.exit(2)
}
try {
  const admin = makeAdminApi({ url: URL, key })
  const { link } = await prepareFirstAccessLink({ admin, email, expectedUserId: EXPECTED_ID, site: SITE, mode })
  if (!copy(link)) throw new Error('Nao foi possivel copiar para a area de transferencia.')
  console.log('Link gerado e copiado. Pode enviar para Amanda pelo WhatsApp.')
  console.log(`(Modo ${mode}; o link nao foi exibido. Uso unico, vale ~1 hora. Depois de colar no WhatsApp, limpe a area de transferencia.)`)
} catch (e) {
  console.error('FALHA:', String(e.message).replace(key, '***'))
  process.exit(1)
}
