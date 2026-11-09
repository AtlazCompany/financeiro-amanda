// Valida supabase/change-email.sql (e o rollback) em um Postgres ISOLADO (PGlite): nada toca o Supabase real.
//   node scripts/email-swap-check.mjs
// Se existir supabase/local/change-email.amanda.sql (arquivo local, fora do Git, com o e-mail real), ele tambem e
// executado SEM alteracoes num banco isolado novo, para provar que o arquivo final e exatamente o que foi testado.
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'

let failures = 0
const check = (name, ok, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  -> ' + extra : ''}`)
  if (!ok) failures++
}
const rejects = async (name, fn, re) => {
  try { await fn(); check(name, false, 'nao falhou') } catch (e) { check(name, re.test(String(e.message)), String(e.message).slice(0, 80)) }
}

const U = 'f0c31479-52ed-4e6c-b9a6-6e789a71e54e'
const OTHER = '99999999-9999-9999-9999-999999999999'
const OLD = 'amanda@financeiro-amanda.app'

async function freshDb() {
  const db = new PGlite({ extensions: { pgcrypto } })
  await db.exec(`
    create schema extensions; create extension pgcrypto with schema extensions;
    create schema auth;
    create table auth.users (id uuid primary key, email text unique, encrypted_password text, email_confirmed_at timestamptz,
      confirmation_token text, recovery_token text, email_change text, email_change_token_new text, email_change_token_current text, updated_at timestamptz);
    create table auth.identities (id uuid primary key, user_id uuid references auth.users(id) on delete cascade, provider text, provider_id text, identity_data jsonb, updated_at timestamptz);
    create table auth.sessions (id uuid primary key, user_id uuid references auth.users(id) on delete cascade);
    create table auth.refresh_tokens (id bigserial primary key, session_id uuid references auth.sessions(id) on delete cascade, user_id text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create role anon; create role authenticated;
    grant usage on schema public, auth to anon, authenticated;
    alter default privileges in schema public grant all on tables to authenticated;
    alter default privileges in schema public grant execute on functions to authenticated;
  `)
  const dir = 'supabase/migrations/'
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) await db.exec(readFileSync(dir + f, 'utf8'))
  // estado equivalente ao de producao + dados financeiros
  await db.exec(`
    insert into public.allowed_emails values ('${OLD}');
    insert into auth.users (id, email, encrypted_password, email_confirmed_at, confirmation_token, recovery_token, email_change, email_change_token_new, email_change_token_current)
      values ('${U}', '${OLD}', extensions.crypt('senha-provisoria-de-teste', extensions.gen_salt('bf')), now(), '', '', '', '', '');
    insert into auth.identities values (gen_random_uuid(), '${U}', 'email', '${U}', '{"sub":"${U}","email":"${OLD}","email_verified":true}', now());
    insert into auth.sessions values ('aaaaaaaa-0000-0000-0000-000000000001', '${U}'), ('aaaaaaaa-0000-0000-0000-000000000002', '${U}');
    insert into auth.refresh_tokens (session_id, user_id) values ('aaaaaaaa-0000-0000-0000-000000000001', '${U}');
    insert into public.profiles values ('${U}', 'Amanda');
    insert into public.financial_settings (user_id, opening_balance_cents, opening_balance_date) values ('${U}', 12345, '2026-08-01');
    insert into public.clients (id, user_id, name) values ('c0000000-0000-0000-0000-000000000001', '${U}', 'Maria');
    insert into public.sales (id, user_id, client_id, description, sale_date, total_cents, installments_count, first_due_date, quantity, unit_cost_cents, unit_price_cents, discount_cents)
      values ('50000000-0000-0000-0000-000000000001', '${U}', 'c0000000-0000-0000-0000-000000000001', 'Hidratante', '2026-11-09', 3000, 1, '2026-11-09', 1, 1600, 3000, 0);
    insert into public.installments (user_id, sale_id, number, due_date, amount_cents, paid_at) values ('${U}', '50000000-0000-0000-0000-000000000001', 1, '2026-11-09', 3000, '2026-11-09');
    insert into public.supplier_bills (user_id, order_number, amount_cents, due_date) values ('${U}', '1048', 48000, '2026-11-15');
  `)
  return db
}
const snap = async (db) => (await db.query(`select
  (select count(*)::int from public.clients where user_id = '${U}') c, (select count(*)::int from public.sales where user_id = '${U}') s,
  (select count(*)::int from public.installments where user_id = '${U}') i, (select count(*)::int from public.supplier_bills where user_id = '${U}') b,
  (select opening_balance_cents::int from public.financial_settings where user_id = '${U}') ob,
  (select sum(amount_cents)::int from public.installments) isum`)).rows[0]
const asUser = async (db, uid, sql) => {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);`)
  try { return await db.query(sql) } finally { await db.exec('reset role;') }
}

/** Executa um cenario completo da troca e confere todas as garantias. */
async function scenario(label, sql, newEmail) {
  console.log(`\n== ${label} ==`)
  const db = await freshDb()
  const before = await snap(db)
  const pwBefore = (await db.query(`select encrypted_password p from auth.users where id = '${U}'`)).rows[0].p

  await db.exec(sql)
  const u = (await db.query(`select id, email, email_confirmed_at is not null conf, encrypted_password p from auth.users`)).rows
  check('continua 1 unica usuaria', u.length === 1)
  check('MESMO id de usuaria preservado', u[0].id === U)
  check('e-mail definitivo gravado (minusculas)', u[0].email === newEmail.toLowerCase(), u[0].email.replace(/^(.).*(@.*)$/, '$1***$2'))
  check('e-mail confirmado', u[0].conf === true)
  check('senha provisoria invalidada (hash diferente)', u[0].p !== pwBefore)
  check('a senha provisoria nao confere mais', (await db.query(`select (encrypted_password = extensions.crypt('senha-provisoria-de-teste', encrypted_password)) as ok from auth.users where id = '${U}'`)).rows[0].ok === false)
  const idn = (await db.query(`select identity_data->>'email' e, provider_id from auth.identities where user_id = '${U}'`)).rows
  check('identidade de e-mail atualizada (provider_id intacto)', idn.length === 1 && idn[0].e === newEmail.toLowerCase() && idn[0].provider_id === U)
  check('sessoes e refresh tokens encerrados', (await db.query(`select (select count(*)::int from auth.sessions) s, (select count(*)::int from auth.refresh_tokens) r`)).rows[0].s === 0)
  const al = (await db.query('select email from public.allowed_emails')).rows.map((r) => r.email)
  check('allowed_emails: so o e-mail definitivo', al.length === 1 && al[0] === newEmail.toLowerCase())
  check('dados financeiros intactos e vinculados ao mesmo id', JSON.stringify(await snap(db)) === JSON.stringify(before))
  check('perfil continua vinculado', (await db.query(`select count(*)::int n from public.profiles where id = '${U}'`)).rows[0].n === 1)

  // isolamento de dados depois da troca (RLS)
  const mine = await asUser(db, U, 'select (select count(*)::int from public.clients) c, (select count(*)::int from public.sales) s, (select count(*)::int from public.installments) i, (select count(*)::int from public.supplier_bills) b')
  check('a usuaria (mesmo id) continua enxergando todos os seus dados', JSON.stringify(mine.rows[0]) === JSON.stringify({ c: 1, s: 1, i: 1, b: 1 }))
  const other = await asUser(db, OTHER, 'select (select count(*)::int from public.clients) c, (select count(*)::int from public.sales) s, (select count(*)::int from public.installments) i, (select count(*)::int from public.supplier_bills) b, (select count(*)::int from public.financial_settings) f')
  check('outra usuaria nao enxerga nada', Object.values(other.rows[0]).every((n) => n === 0))
  const upd = await asUser(db, OTHER, `update public.clients set name = 'x' where id = 'c0000000-0000-0000-0000-000000000001' returning id`)
  check('outra usuaria nao consegue alterar dados', upd.rows.length === 0)

  // autorizacao de cadastro
  await rejects('e-mail provisorio NAO pode mais ser cadastrado', () => db.exec(`insert into auth.users (id, email) values (gen_random_uuid(), '${OLD}')`), /nao permitido/i)
  await rejects('e-mail qualquer continua bloqueado', () => db.exec(`insert into auth.users (id, email) values (gen_random_uuid(), 'intruso@exemplo.com')`), /nao permitido/i)
  await rejects('segunda execucao falha (conta provisoria ja nao existe)', () => db.exec(sql), /nao encontrada/i)

  // rollback
  await db.exec(readFileSync('supabase/rollbacks/change-email.down.sql', 'utf8').replaceAll('EMAIL-REAL-AQUI', newEmail))
  const back = (await db.query(`select id, email from auth.users`)).rows[0]
  check('rollback devolve o e-mail provisorio com o mesmo id', back.id === U && back.email === OLD)
  check('rollback ajusta allowed_emails', JSON.stringify((await db.query('select email from public.allowed_emails')).rows) === JSON.stringify([{ email: OLD }]))
  check('rollback preserva dados financeiros', JSON.stringify(await snap(db)) === JSON.stringify(before))
}

const template = readFileSync('supabase/change-email.sql', 'utf8')

// negativos no modelo
{
  console.log('\n== entradas invalidas (nada pode mudar) ==')
  const db = await freshDb()
  await rejects('rejeita e-mail invalido', () => db.exec(template.replaceAll('NOVO-EMAIL-AQUI', 'isso-nao-e-email')), /invalido/i)
  await rejects('rejeita o proprio e-mail provisorio', () => db.exec(template.replaceAll('NOVO-EMAIL-AQUI', OLD)), /invalido|igual/i)
  await rejects('placeholder nao substituido e rejeitado', () => db.exec(template), /invalido/i)
  await db.exec(`insert into auth.users (id, email) values ('${OTHER}', 'ja.existe@exemplo.com')`).catch(() => {})
  const stillOld = (await db.query(`select email from auth.users where id = '${U}'`)).rows[0].email
  check('apos falhas, a conta continua intacta', stillOld === OLD && (await db.query('select count(*)::int n from public.allowed_emails')).rows[0].n === 1)
}

await scenario('modelo com e-mail de exemplo', template.replaceAll('NOVO-EMAIL-AQUI', '  Amanda.Real@Exemplo.com  '), 'amanda.real@exemplo.com')

const local = 'supabase/local/change-email.amanda.sql'
if (existsSync(local)) {
  const sql = readFileSync(local, 'utf8')
  const email = /lower\(btrim\('([^']+)'\)\)/.exec(sql)?.[1]
  check('arquivo local contem um e-mail definitivo valido', !!email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) && !sql.includes('NOVO-EMAIL-AQUI'))
  if (email) await scenario('ARQUIVO FINAL LOCAL (exatamente o que sera executado)', sql, email)
} else {
  console.log('\n(arquivo local supabase/local/change-email.amanda.sql nao encontrado: so o modelo foi testado)')
}

console.log(failures === 0 ? '\nTODOS OS TESTES DA TROCA DE E-MAIL PASSARAM' : `\n${failures} FALHA(S)`)
process.exit(failures === 0 ? 0 : 1)
