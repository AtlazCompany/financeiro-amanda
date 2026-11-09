/**
 * Backend FALSO em memoria/localStorage, usado SOMENTE por `npm run build:mock` / `npm run preview:mock`
 * para testar a interface localmente, sem tocar no Supabase real. Nao entra no build de producao
 * (o vite.mock.config.ts troca `lib/supabase` por este arquivo).
 */
import { addDays, addMonths, todayISO } from '../lib/dates'

type Row = Record<string, unknown> & { id?: string }
type Res = { data: unknown; error: { message: string } | null }

const KEY = 'mock-financeiro-db-v1'
const uid = () => crypto.randomUUID()

function seed(): Record<string, Row[]> {
  const today = todayISO()
  const d = (n: number) => addDays(today, n)
  const clients = [
    { id: 'c-maria', name: 'Maria Souza', whatsapp: '(11) 91234-5678', notes: null },
    { id: 'c-ana', name: 'Ana Paula Lima', whatsapp: '(21) 98888-7777', notes: 'Prefere pagar no dia 5' },
    { id: 'c-juli', name: 'Juliana Rocha', whatsapp: null, notes: null },
    { id: 'c-fer', name: 'Fernanda Alves', whatsapp: '(31) 97777-1111', notes: null },
  ]
  const mk = (id: string, c: string, desc: string, sd: string, qty: number, cost: number | null, price: number | null, disc: number, total: number, n: number, first: string) => ({
    id, client_id: c, description: desc, sale_date: sd, quantity: qty, unit_cost_cents: cost, unit_price_cents: price,
    discount_cents: disc, total_cents: total, installments_count: n, first_due_date: first,
  })
  const sales = [
    mk('s1', 'c-maria', 'Hidratante Nativa SPA', d(-2), 1, 1600, 3000, 0, 3000, 1, d(-2)),
    mk('s2', 'c-ana', 'Perfume Malbec', d(-5), 2, 9500, 17900, 1000, 34800, 3, d(-5)),
    mk('s3', 'c-juli', 'Kit Lily + Body Splash', d(-9), 1, 22000, 21000, 0, 21000, 2, d(-9)),
    mk('s4', 'c-fer', 'Colônia Cuide-se Bem', d(-20), 3, 4200, 8900, 2000, 24700, 3, d(-20)),
    mk('s5', 'c-maria', 'Shampoo + Condicionador', addMonths(today, -1), 1, null, null, 0, 8980, 1, addMonths(today, -1)),
    mk('s6', 'c-ana', 'Batom Make B.', addMonths(today, -1), 4, 1900, 4290, 0, 17160, 2, addMonths(today, -1)),
  ]
  const installments: Row[] = []
  const split = (s: (typeof sales)[number], paidUpTo: number) => {
    const n = s.installments_count
    const unit = Math.floor((2 * s.total_cents + n) / (2 * n))
    for (let i = 0; i < n; i++) {
      installments.push({
        id: `${s.id}-${i + 1}`, sale_id: s.id, number: i + 1, due_date: addMonths(s.first_due_date, i),
        amount_cents: i === n - 1 ? s.total_cents - unit * (n - 1) : unit,
        paid_at: i < paidUpTo ? addMonths(s.first_due_date, i) : null,
      })
    }
  }
  split(sales[0], 1); split(sales[1], 1); split(sales[2], 0); split(sales[3], 1); split(sales[4], 1); split(sales[5], 2)
  const bills = [
    { id: 'b1', order_number: '1048', order_date: d(-30), amount_cents: 48000, due_date: d(-3), paid_at: null, notes: null },
    { id: 'b2', order_number: '1055', order_date: d(-18), amount_cents: 39050, due_date: d(4), paid_at: null, notes: null },
    { id: 'b3', order_number: '1062', order_date: d(-5), amount_cents: 56000, due_date: d(25), paid_at: null, notes: null },
    { id: 'b0', order_number: '1034', order_date: d(-60), amount_cents: 51000, due_date: d(-28), paid_at: d(-29), notes: null },
  ]
  return {
    clients, sales, installments, supplier_bills: bills,
    financial_settings: [{ user_id: 'mock', opening_balance_cents: 90000, opening_balance_date: addDays(today, -45), alert_days: 7 }],
  }
}

let db: Record<string, Row[]>
try { db = JSON.parse(localStorage.getItem(KEY) ?? '') } catch { db = seed() }
if (!db || !db.clients) db = seed()
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)) } catch { /* ignore */ } }

class Query implements PromiseLike<Res> {
  private op: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select'
  private payload: Row = {}
  private filters: ((r: Row) => boolean)[] = []
  private orderCol: string | null = null
  private from = 0
  private to = Infinity
  private shape: 'many' | 'single' | 'maybe' = 'many'
  private table: string
  constructor(table: string) {
    this.table = table
  }
  select() { return this }
  insert(p: Row) { this.op = 'insert'; this.payload = p; return this }
  update(p: Row) { this.op = 'update'; this.payload = p; return this }
  upsert(p: Row) { this.op = 'upsert'; this.payload = p; return this }
  delete() { this.op = 'delete'; return this }
  eq(c: string, v: unknown) { this.filters.push((r) => r[c] === v); return this }
  is(c: string, v: unknown) { this.filters.push((r) => (r[c] ?? null) === v); return this }
  not(c: string, _op: string, v: unknown) { this.filters.push((r) => (r[c] ?? null) !== v); return this }
  order(c: string) { this.orderCol = c; return this }
  range(a: number, b: number) { this.from = a; this.to = b; return this }
  single() { this.shape = 'single'; return this }
  maybeSingle() { this.shape = 'maybe'; return this }
  then<T1 = Res, T2 = never>(ok?: ((v: Res) => T1 | PromiseLike<T1>) | null, bad?: ((e: unknown) => T2 | PromiseLike<T2>) | null) {
    return Promise.resolve(this.exec()).then(ok, bad)
  }
  private exec(): Res {
    const rows = (db[this.table] ??= [])
    const match = (r: Row) => this.filters.every((f) => f(r))
    let out: Row[] = []
    if (this.op === 'insert') {
      const r: Row = { id: uid(), ...this.payload }
      if (this.table === 'financial_settings') Object.assign(r, { user_id: 'mock', opening_balance_cents: 0, opening_balance_date: todayISO(), alert_days: 7 }, this.payload)
      rows.push(r); out = [r]
    } else if (this.op === 'upsert') {
      const i = rows.findIndex((r) => r.user_id === this.payload.user_id)
      if (i >= 0) rows[i] = { ...rows[i], ...this.payload }
      else rows.push({ ...this.payload })
    } else if (this.op === 'update') {
      for (const r of rows) if (match(r)) Object.assign(r, this.payload)
      out = rows.filter(match)
    } else if (this.op === 'delete') {
      const del = rows.filter(match)
      if (this.table === 'installments' && del.some((r) => r.paid_at)) return { data: null, error: { message: 'Parcela paga nao pode ser excluida. Desfaca o pagamento primeiro.' } }
      db[this.table] = rows.filter((r) => !match(r))
    } else {
      out = rows.filter(match)
      const c = this.orderCol
      if (c) out = [...out].sort((a, b) => (String(a[c] ?? '') < String(b[c] ?? '') ? -1 : String(a[c] ?? '') > String(b[c] ?? '') ? 1 : 0))
      out = out.slice(this.from, this.to + 1)
    }
    save()
    const copy = JSON.parse(JSON.stringify(out)) as Row[]
    if (this.shape === 'single') return { data: copy[0] ?? null, error: copy[0] ? null : { message: 'sem linha' } }
    if (this.shape === 'maybe') return { data: copy[0] ?? null, error: null }
    return { data: this.op === 'select' || copy.length ? copy : null, error: null }
  }
}

type Drafts = { number: number; due_date: string; amount_cents: number; paid_at?: string | null }[]
function addSale(sale: Row, inst: Drafts): Res {
  const id = uid()
  const sum = inst.reduce((a, b) => a + b.amount_cents, 0)
  if (sum !== sale.total_cents) return { data: null, error: { message: 'A soma das parcelas difere do total' } }
  db.sales.push({ id, ...sale, installments_count: inst.length })
  for (const p of inst) db.installments.push({ id: uid(), sale_id: id, number: p.number, due_date: p.due_date, amount_cents: p.amount_cents, paid_at: p.paid_at ?? null })
  save()
  return { data: id, error: null }
}

async function rpc(name: string, p: Record<string, unknown>): Promise<Res> {
  if (name === 'create_sale') {
    return addSale(
      { client_id: p.p_client_id, description: p.p_description, sale_date: p.p_sale_date, total_cents: p.p_total_cents, first_due_date: p.p_first_due_date, quantity: 1, unit_cost_cents: null, unit_price_cents: null, discount_cents: 0 },
      p.p_installments as Drafts,
    )
  }
  if (name === 'create_sale_with_profit') {
    const qty = p.p_quantity as number, price = p.p_unit_price_cents as number, disc = (p.p_discount_cents as number) ?? 0
    const total = qty * price - disc
    if (total <= 0) return { data: null, error: { message: 'O desconto nao pode ser maior que o valor da venda' } }
    return addSale(
      { client_id: p.p_client_id, description: p.p_description, sale_date: p.p_sale_date, total_cents: total, first_due_date: p.p_first_due_date, quantity: qty, unit_cost_cents: p.p_unit_cost_cents, unit_price_cents: price, discount_cents: disc },
      p.p_installments as Drafts,
    )
  }
  return { data: null, error: { message: `rpc desconhecida: ${name}` } }
}

const session = { access_token: 'mock', refresh_token: 'mock', user: { id: 'mock', email: 'amanda@financeiro-amanda.app' } }
export const isConfigured = true
export const supabase = {
  from: (t: string) => new Query(t),
  rpc,
  auth: {
    // localStorage['mock-logout']='1' mostra a tela de login (so para teste visual)
    getSession: async () => ({ data: { session: localStorage.getItem('mock-logout') === '1' ? null : session } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signInWithPassword: async () => ({ error: null }),
    signOut: async () => ({ error: null }),
  },
}
export function resetMock() { db = seed(); save() }
