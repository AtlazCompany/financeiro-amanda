/**
 * Importador da planilha "Controle Financeiro - O Boticario.xlsx".
 * Le apenas as colunas DIGITADAS (nao depende de formulas calculadas):
 *  Vendas: A data, B cliente, C produto, D valor, E parcelas, F 1o vencimento, M/O/Q/S/U/W datas de pagamento.
 *  Boletos: A pedido, B data pedido, C valor, D vencimento, E data pagamento.
 */
import { addDays, isValidISO, toISO } from './dates'
import { splitInstallments } from './finance'
import { reaisToCents } from './money'
import type { Bill, Client, ISODate, Installment, Sale } from './types'

export interface ParsedSale {
  clientName: string
  description: string
  sale_date: ISODate
  total_cents: number
  first_due_date: ISODate
  count: number
  paid: (ISODate | null)[]
}
export interface ParsedBill {
  order_number: string
  order_date: ISODate | null
  amount_cents: number
  due_date: ISODate
  paid_at: ISODate | null
}
export interface ParsedWorkbook {
  sales: ParsedSale[]
  bills: ParsedBill[]
  warnings: string[]
}

const PAID_COLS = [12, 14, 16, 18, 20, 22]
type Cell = string | number | boolean | Date | null | undefined

export function cellToISO(v: Cell): ISODate | null {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number' && Number.isFinite(v)) {
    // serial do Excel (base 1899-12-30)
    return addDays('1899-12-30', Math.floor(v))
  }
  if (v instanceof Date) return toISO(v.getUTCFullYear(), v.getUTCMonth() + 1, v.getUTCDate())
  if (typeof v === 'string') {
    const s = v.trim()
    const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s)
    if (br) {
      const iso = toISO(Number(br[3]), Number(br[2]), Number(br[1]))
      return isValidISO(iso) ? iso : null
    }
    return isValidISO(s) ? s : null
  }
  return null
}

function cellToText(v: Cell): string {
  return v === null || v === undefined ? '' : String(v).trim()
}

function cellToCents(v: Cell): number | null {
  if (typeof v === 'number') return reaisToCents(v)
  if (typeof v === 'string') {
    const n = Number(v.replace(/[R$\s.]/g, '').replace(',', '.'))
    return Number.isFinite(n) && v.trim() !== '' ? reaisToCents(n) : null
  }
  return null
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

export function parseRows(salesRows: Cell[][], billRows: Cell[][]): ParsedWorkbook {
  const warnings: string[] = []
  const sales: ParsedSale[] = []
  const bills: ParsedBill[] = []

  const startOf = (rows: Cell[][], marker: string) => {
    const idx = rows.findIndex((r) => norm(cellToText(r[0])).startsWith(marker))
    return idx < 0 ? -1 : idx + 1
  }
  const sStart = startOf(salesRows, 'data da venda')
  if (sStart < 0) warnings.push('Aba "Vendas e Clientes" não encontrada ou sem cabeçalho.')
  else {
    for (let r = sStart; r < salesRows.length; r++) {
      const row = salesRows[r]
      const client = cellToText(row[1])
      const total = cellToCents(row[3])
      if (!client && total === null) continue
      const label = `Vendas, linha ${r + 1}`
      const saleDate = cellToISO(row[0])
      const count = Number(row[4])
      if (!client || !saleDate || total === null || total <= 0 || !Number.isInteger(count) || count < 1 || count > 6) {
        warnings.push(`${label}: dados incompletos ou inválidos — ignorada.`)
        continue
      }
      const first = cellToISO(row[5]) ?? saleDate
      const paid = PAID_COLS.slice(0, count).map((c) => cellToISO(row[c]))
      sales.push({ clientName: client, description: cellToText(row[2]) || 'Venda importada', sale_date: saleDate, total_cents: total, first_due_date: first, count, paid })
    }
  }

  const bStart = startOf(billRows, 'pedido')
  if (bStart < 0) warnings.push('Aba "Boletos O Boticário" não encontrada ou sem cabeçalho.')
  else {
    for (let r = bStart; r < billRows.length; r++) {
      const row = billRows[r]
      const order = cellToText(row[0])
      const amount = cellToCents(row[2])
      if (!order && amount === null) continue
      const due = cellToISO(row[3])
      if (!order || amount === null || amount <= 0 || !due) {
        warnings.push(`Boletos, linha ${r + 1}: dados incompletos ou inválidos — ignorado.`)
        continue
      }
      bills.push({ order_number: order, order_date: cellToISO(row[1]), amount_cents: amount, due_date: due, paid_at: cellToISO(row[4]) })
    }
  }
  return { sales, bills, warnings }
}

export async function parseWorkbookFile(file: File): Promise<ParsedWorkbook> {
  const XLSX = await import('xlsx')
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' })
  const find = (part: string) => wb.SheetNames.find((n) => norm(n).startsWith(part))
  const rowsOf = (name: string | undefined): Cell[][] =>
    name ? (XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: null }) as Cell[][]) : []
  return parseRows(rowsOf(find('vendas')), rowsOf(find('boletos')))
}

/* ---------- Deteccao de duplicidades ---------- */
export const saleKey = (clientName: string, description: string, date: ISODate, total: number) =>
  `${norm(clientName)}|${norm(description)}|${date}|${total}`
export const billKey = (order: string, due: ISODate, amount: number) => `${norm(order)}|${due}|${amount}`

export interface ImportPlan {
  newClients: string[]
  salesToAdd: ParsedSale[]
  salesDuplicate: number
  billsToAdd: ParsedBill[]
  billsDuplicate: number
  installments: number
  paidInstallments: number
}

export function planImport(
  parsed: ParsedWorkbook,
  existing: { clients: Client[]; sales: Sale[]; bills: Bill[]; installments: Installment[] },
): ImportPlan {
  const clientNames = new Map(existing.clients.map((c) => [norm(c.name), c.id]))
  const clientById = new Map(existing.clients.map((c) => [c.id, c.name]))
  const existingSales = new Set(existing.sales.map((s) => saleKey(clientById.get(s.client_id) ?? '', s.description, s.sale_date, s.total_cents)))
  const existingBills = new Set(existing.bills.map((b) => billKey(b.order_number, b.due_date, b.amount_cents)))

  const seenSales = new Set<string>()
  const salesToAdd: ParsedSale[] = []
  let salesDuplicate = 0
  for (const s of parsed.sales) {
    const k = saleKey(s.clientName, s.description, s.sale_date, s.total_cents)
    if (existingSales.has(k) || seenSales.has(k)) { salesDuplicate++; continue }
    seenSales.add(k)
    salesToAdd.push(s)
  }
  const seenBills = new Set<string>()
  const billsToAdd: ParsedBill[] = []
  let billsDuplicate = 0
  for (const b of parsed.bills) {
    const k = billKey(b.order_number, b.due_date, b.amount_cents)
    if (existingBills.has(k) || seenBills.has(k)) { billsDuplicate++; continue }
    seenBills.add(k)
    billsToAdd.push(b)
  }
  const newClientMap = new Map<string, string>()
  for (const s of salesToAdd) {
    const k = norm(s.clientName)
    if (!clientNames.has(k) && !newClientMap.has(k)) newClientMap.set(k, s.clientName)
  }
  return {
    newClients: [...newClientMap.values()],
    salesToAdd, salesDuplicate, billsToAdd, billsDuplicate,
    installments: salesToAdd.reduce((a, s) => a + s.count, 0),
    paidInstallments: salesToAdd.reduce((a, s) => a + s.paid.filter(Boolean).length, 0),
  }
}

export function installmentsFor(s: ParsedSale) {
  return splitInstallments(s.total_cents, s.count, s.first_due_date).map((d, i) => ({ ...d, paid_at: s.paid[i] ?? null }))
}
