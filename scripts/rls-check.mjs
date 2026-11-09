// Verificacao de seguranca (RLS). Uso:
//   VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... A_EMAIL=... A_PASS=... B_EMAIL=... B_PASS=... node scripts/rls-check.mjs
// A e B sao duas contas autorizadas (allowed_emails). Nunca use service_role aqui.
import { createClient } from '@supabase/supabase-js'

const { VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: key, A_EMAIL, A_PASS, B_EMAIL, B_PASS } = process.env
const mk = () => createClient(url, key, { auth: { persistSession: false } })
let failures = 0
const check = (name, ok, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  -> ' + extra : ''}`)
  if (!ok) failures++
}

const anon = mk()
{
  const r = await anon.from('clients').select('id')
  check('anonimo nao le clients', !!r.error || (r.data ?? []).length === 0, r.error?.message ?? `${r.data?.length} linhas`)
  const w = await anon.from('clients').insert({ name: 'invasor' })
  check('anonimo nao grava clients', !!w.error, w.error?.message)
  const rpc = await anon.rpc('create_sale', { p_client_id: '00000000-0000-0000-0000-000000000000', p_description: 'x', p_sale_date: '2026-01-01', p_total_cents: 100, p_first_due_date: '2026-01-01', p_installments: [{ number: 1, due_date: '2026-01-01', amount_cents: 100 }] })
  check('anonimo nao executa create_sale', !!rpc.error, rpc.error?.message)
  const su = await anon.auth.signUp({ email: `intruso${Date.now()}@example.com`, password: 'Senha-Forte-123!' })
  check('cadastro publico bloqueado', !!su.error, su.error?.message)
}

const A = mk(); const B = mk()
const la = await A.auth.signInWithPassword({ email: A_EMAIL, password: A_PASS })
const lb = await B.auth.signInWithPassword({ email: B_EMAIL, password: B_PASS })
check('login A', !la.error, la.error?.message)
check('login B', !lb.error, lb.error?.message)

const ca = await A.from('clients').insert({ name: 'Cliente da A' }).select('id').single()
check('A cria cliente', !ca.error, ca.error?.message)
const cb = await B.from('clients').insert({ name: 'Cliente da B' }).select('id').single()
check('B cria cliente', !cb.error, cb.error?.message)

const seeB = await B.from('clients').select('id,name')
check('B nao enxerga cliente da A', (seeB.data ?? []).every((c) => c.id !== ca.data?.id), `B ve ${seeB.data?.length} cliente(s)`)
const seeA = await A.from('clients').select('id,name')
check('A nao enxerga cliente da B', (seeA.data ?? []).every((c) => c.id !== cb.data?.id), `A ve ${seeA.data?.length} cliente(s)`)

const upd = await B.from('clients').update({ name: 'hackeado' }).eq('id', ca.data?.id).select()
check('B nao altera cliente da A', !upd.error && (upd.data ?? []).length === 0)
const del = await B.from('clients').delete().eq('id', ca.data?.id).select()
check('B nao exclui cliente da A', !del.error && (del.data ?? []).length === 0)
const still = await A.from('clients').select('name').eq('id', ca.data?.id).single()
check('cliente da A intacto', still.data?.name === 'Cliente da A', still.data?.name)

const steal = await B.rpc('create_sale', { p_client_id: ca.data?.id, p_description: 'x', p_sale_date: '2026-01-01', p_total_cents: 100, p_first_due_date: '2026-01-01', p_installments: [{ number: 1, due_date: '2026-01-01', amount_cents: 100 }] })
check('B nao cria venda usando cliente da A', !!steal.error, steal.error?.message)

const forged = await B.from('clients').insert({ name: 'forjado', user_id: la.data.user?.id })
check('B nao grava em nome da A (user_id forjado)', !!forged.error, forged.error?.message)

const badSum = await B.rpc('create_sale', { p_client_id: cb.data?.id, p_description: 'x', p_sale_date: '2026-01-01', p_total_cents: 100, p_first_due_date: '2026-01-01', p_installments: [{ number: 1, due_date: '2026-01-01', amount_cents: 99 }] })
check('create_sale rejeita soma de parcelas errada', !!badSum.error, badSum.error?.message)

// limpeza (cada usuaria remove o proprio registro de teste)
await A.from('clients').delete().eq('id', ca.data?.id)
await B.from('clients').delete().eq('id', cb.data?.id)
console.log(failures === 0 ? '\nTODOS OS TESTES DE SEGURANCA PASSARAM' : `\n${failures} FALHA(S)`)
process.exit(failures === 0 ? 0 : 1)
