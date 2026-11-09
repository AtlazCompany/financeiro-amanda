// Testa as migracoes em um Postgres ISOLADO (PGlite, em memoria): nada toca o Supabase real.
//   node scripts/migration-check.mjs
import { PGlite } from '@electric-sql/pglite'
import { readFileSync, readdirSync } from 'node:fs'

let failures = 0
const check = (name, ok, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  -> ' + extra : ''}`)
  if (!ok) failures++
}
const expectError = async (name, fn, pattern) => {
  try { await fn(); check(name, false, 'nao lancou erro') } catch (e) { check(name, pattern.test(String(e.message)), String(e.message).slice(0, 90)) }
}

const db = new PGlite()
// Dublê minimo do Supabase (schema auth, funcoes e papeis)
await db.exec(`
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create role anon; create role authenticated;
  grant usage on schema public, auth to anon, authenticated;
  alter default privileges in schema public grant all on tables to authenticated;
  alter default privileges in schema public grant execute on functions to authenticated;
`)
const dir = 'supabase/migrations/'
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
const base = files.filter((f) => !f.includes('_profit_fields'))
const profit = files.find((f) => f.includes('_profit_fields'))
for (const f of base) await db.exec(readFileSync(dir + f, 'utf8'))
check(`migracoes anteriores aplicadas (${base.length})`, true)

// Dados "de producao" ANTES da migracao de lucro
const A = '11111111-1111-1111-1111-111111111111', B = '22222222-2222-2222-2222-222222222222'
await db.exec(`
  insert into public.allowed_emails values ('a@x.com'), ('b@x.com');
  insert into auth.users values ('${A}','a@x.com'), ('${B}','b@x.com');
  insert into public.clients (id, user_id, name) values ('c1111111-1111-1111-1111-111111111111','${A}','Maria');
`)
const asUser = async (uid, sql, params) => {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);`)
  try { return await db.query(sql, params) } finally { await db.exec('reset role;') }
}
await asUser(A, `select public.create_sale('c1111111-1111-1111-1111-111111111111','Venda antiga',date '2026-10-01',30000,date '2026-10-05',
  '[{"number":1,"due_date":"2026-10-05","amount_cents":10000},{"number":2,"due_date":"2026-11-05","amount_cents":10000},{"number":3,"due_date":"2026-12-05","amount_cents":10000}]'::jsonb)`)
const before = (await db.query(`select id, total_cents, installments_count from public.sales`)).rows
const instBefore = (await db.query(`select count(*)::int n, sum(amount_cents)::int s from public.installments`)).rows[0]

// ---- aplica a migracao de lucro
await db.exec(readFileSync(dir + profit, 'utf8'))
const after = (await db.query(`select id, total_cents, installments_count, quantity, unit_cost_cents, unit_price_cents, discount_cents from public.sales`)).rows
check('dados existentes preservados (mesmo id/total/parcelas)', after.length === before.length && after[0].id === before[0].id && Number(after[0].total_cents) === 30000 && after[0].installments_count === 3)
check('venda antiga: quantidade 1, custo NULL, preco NULL, desconto 0', after[0].quantity === 1 && after[0].unit_cost_cents === null && after[0].unit_price_cents === null && Number(after[0].discount_cents) === 0)
const instAfter = (await db.query(`select count(*)::int n, sum(amount_cents)::int s from public.installments`)).rows[0]
check('parcelas antigas intactas', instAfter.n === instBefore.n && instAfter.s === instBefore.s)

// ---- funcao antiga continua funcionando (app em producao)
await asUser(A, `select public.create_sale('c1111111-1111-1111-1111-111111111111','Via funcao antiga',date '2026-11-01',5000,date '2026-11-01','[{"number":1,"due_date":"2026-11-01","amount_cents":5000}]'::jsonb)`)
check('create_sale (antiga) segue funcionando', true)

// ---- nova funcao: 3 x R$ 30 com R$ 10 de desconto = R$ 80 em 3x; custo R$ 16
const inst3 = '[{"number":1,"due_date":"2026-11-09","amount_cents":2667},{"number":2,"due_date":"2026-12-09","amount_cents":2667},{"number":3,"due_date":"2027-01-09","amount_cents":2666}]'
const r = await asUser(A, `select public.create_sale_with_profit('c1111111-1111-1111-1111-111111111111','Hidratante',date '2026-11-09',3,1600,3000,1000,date '2026-11-09',$1::jsonb) id`, [inst3])
const nid = r.rows[0].id
const nv = (await db.query(`select total_cents, quantity, unit_cost_cents, unit_price_cents, discount_cents, installments_count from public.sales where id = $1`, [nid])).rows[0]
check('create_sale_with_profit grava total = qtd x preco - desconto', Number(nv.total_cents) === 8000 && nv.quantity === 3 && Number(nv.unit_cost_cents) === 1600 && Number(nv.unit_price_cents) === 3000 && Number(nv.discount_cents) === 1000)
const ins = (await db.query(`select amount_cents from public.installments where sale_id = $1 order by number`, [nid])).rows.map((x) => Number(x.amount_cents))
check('parcelas com centavos (26,67 + 26,67 + 26,66)', JSON.stringify(ins) === '[2667,2667,2666]')

await expectError('rejeita soma de parcelas diferente do total', () => asUser(A, `select public.create_sale_with_profit('c1111111-1111-1111-1111-111111111111','x',date '2026-11-09',1,100,3000,0,date '2026-11-09','[{"number":1,"due_date":"2026-11-09","amount_cents":2999}]'::jsonb)`), /soma das parcelas/i)
await expectError('rejeita desconto maior que a venda', () => asUser(A, `select public.create_sale_with_profit('c1111111-1111-1111-1111-111111111111','x',date '2026-11-09',1,100,3000,3000,date '2026-11-09','[{"number":1,"due_date":"2026-11-09","amount_cents":1}]'::jsonb)`), /desconto/i)
await expectError('rejeita quantidade zero', () => asUser(A, `select public.create_sale_with_profit('c1111111-1111-1111-1111-111111111111','x',date '2026-11-09',0,100,3000,0,date '2026-11-09','[{"number":1,"due_date":"2026-11-09","amount_cents":3000}]'::jsonb)`), /quantidade/i)
await expectError('rejeita custo negativo (constraint)', () => asUser(A, `update public.sales set unit_cost_cents = -1 where id = $1`, [nid]), /check/i)
await expectError('total nao pode divergir do preco x quantidade (constraint)', () => asUser(A, `update public.sales set quantity = 5 where id = $1`, [nid]), /sales_total_matches_price/)

// ---- editar custo de venda antiga (permitido) e limpar (volta a "nao informado")
const old = after.find((x) => Number(x.total_cents) === 30000).id
await asUser(A, `update public.sales set unit_cost_cents = 18000, quantity = 2 where id = $1`, [old])
const upd = (await db.query(`select unit_cost_cents, quantity, total_cents from public.sales where id = $1`, [old])).rows[0]
check('custo/quantidade de venda antiga editaveis; total nao muda', Number(upd.unit_cost_cents) === 18000 && upd.quantity === 2 && Number(upd.total_cents) === 30000)
await asUser(A, `update public.sales set unit_cost_cents = null where id = $1`, [old])
check('custo pode voltar a "nao informado"', (await db.query(`select unit_cost_cents from public.sales where id = $1`, [old])).rows[0].unit_cost_cents === null)

// ---- RLS continua isolando
const seeB = await asUser(B, `select id from public.sales`)
check('RLS: outra usuaria nao ve as vendas', seeB.rows.length === 0)
await expectError('RLS: outra usuaria nao cria venda com cliente alheio', () => asUser(B, `select public.create_sale_with_profit('c1111111-1111-1111-1111-111111111111','x',date '2026-11-09',1,100,3000,0,date '2026-11-09','[{"number":1,"due_date":"2026-11-09","amount_cents":3000}]'::jsonb)`), /foreign key|violates/i)
await expectError('anonimo nao executa a funcao nova', async () => { await db.exec('set role anon;'); try { await db.query(`select public.create_sale_with_profit('c1111111-1111-1111-1111-111111111111','x',date '2026-11-09',1,100,3000,0,date '2026-11-09','[]'::jsonb)`) } finally { await db.exec('reset role;') } }, /permission denied/i)

// ---- reversao
const salesBeforeRollback = (await db.query(`select id, total_cents from public.sales order by created_at, id`)).rows.length
await db.exec(readFileSync('supabase/rollbacks/20261110000004_profit_fields.down.sql', 'utf8'))
const cols = (await db.query(`select column_name from information_schema.columns where table_schema='public' and table_name='sales'`)).rows.map((x) => x.column_name)
check('rollback remove as colunas novas', !['quantity', 'unit_cost_cents', 'unit_price_cents', 'discount_cents'].some((c) => cols.includes(c)))
const salesAfterRollback = (await db.query(`select id, total_cents from public.sales`)).rows
check('rollback preserva vendas e totais', salesAfterRollback.length === salesBeforeRollback)
const fn = (await db.query(`select count(*)::int n from pg_proc where proname = 'create_sale_with_profit'`)).rows[0].n
check('rollback remove a funcao nova e mantem a antiga', fn === 0 && (await db.query(`select count(*)::int n from pg_proc where proname = 'create_sale'`)).rows[0].n === 1)
await db.exec(readFileSync(dir + profit, 'utf8'))
check('migracao reaplicavel apos rollback', true)

console.log(failures === 0 ? '\nTODOS OS TESTES DE MIGRACAO PASSARAM' : `\n${failures} FALHA(S)`)
process.exit(failures === 0 ? 0 : 1)
