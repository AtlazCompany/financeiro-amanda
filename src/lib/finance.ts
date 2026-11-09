/**
 * Regras financeiras (espelham a planilha "Controle Financeiro - O Boticario").
 * Tudo em centavos inteiros e datas ISO. Funcoes puras, sem acesso a rede.
 *
 * Principios:
 *  - Dinheiro "disponivel" = saldo inicial (uma unica vez) + parcelas PAGAS - boletos PAGOS.
 *  - Parcela so conta como recebida quando tem data de pagamento (paid_at).
 *  - Parcelas vencidas e nao pagas NUNCA entram como dinheiro (nem na projecao).
 *  - Projecao cronologica: cada boleto ve o caixa de hoje + parcelas a vencer ate a data dele
 *    - todos os boletos em aberto ate a data dele (o mesmo dinheiro nunca e usado duas vezes).
 */
import { addMonths, monthStart, nextMonthStart, diffDays } from './dates'
import type {
  Bill, BillStatus, Client, Installment, InstallmentDraft, InstallmentStatus,
  ISODate, Sale, Settings,
} from './types'

export const MAX_INSTALLMENTS = 6

const FAR_FUTURE: ISODate = '9999-12-31'

/** ROUND(total / n) em centavos, meio para cima, so com inteiros. */
function roundDiv(total: number, n: number): number {
  return Math.floor((2 * total + n) / (2 * n))
}

/**
 * Parcelas iguais; a ultima absorve a diferenca de centavos
 * (valor = ROUND(total/n) e ultima = total - (n-1) * valor, como na planilha).
 */
export function splitInstallments(
  totalCents: number,
  count: number,
  firstDue: ISODate,
): InstallmentDraft[] {
  if (!Number.isInteger(totalCents) || totalCents <= 0) throw new Error('Valor total invalido')
  if (!Number.isInteger(count) || count < 1 || count > MAX_INSTALLMENTS) {
    throw new Error(`Parcelas devem ser de 1 a ${MAX_INSTALLMENTS}`)
  }
  if (totalCents < count) throw new Error('Valor total menor que o numero de parcelas')
  let unit = roundDiv(totalCents, count)
  if (totalCents - unit * (count - 1) <= 0) unit = Math.floor(totalCents / count)
  const last = totalCents - unit * (count - 1)
  return Array.from({ length: count }, (_, i) => ({
    number: i + 1,
    due_date: addMonths(firstDue, i),
    amount_cents: i === count - 1 ? last : unit,
  }))
}

export function installmentStatus(i: Pick<Installment, 'due_date' | 'paid_at'>, today: ISODate): InstallmentStatus {
  if (i.paid_at) return 'paid'
  return i.due_date < today ? 'overdue' : 'pending'
}

export function billStatus(
  b: Pick<Bill, 'due_date' | 'paid_at'>,
  today: ISODate,
  alertDays: number,
): BillStatus {
  if (b.paid_at) return 'paid'
  if (b.due_date < today) return 'overdue'
  return diffDays(today, b.due_date) <= alertDays ? 'soon' : 'pending'
}

export function saleStatus(insts: Installment[], today: ISODate): InstallmentStatus {
  if (insts.length > 0 && insts.every((i) => i.paid_at)) return 'paid'
  return insts.some((i) => installmentStatus(i, today) === 'overdue') ? 'overdue' : 'pending'
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

export interface FinanceData {
  settings: Settings
  sales: Sale[]
  installments: Installment[]
  bills: Bill[]
}

/**
 * Dinheiro que efetivamente entrou menos o que efetivamente saiu, ate (excluindo) `before`.
 * O saldo inicial entra uma unica vez, se a data dele for anterior a `before`;
 * movimentos anteriores a data do saldo inicial sao ignorados.
 */
export function cashBefore(
  data: Pick<FinanceData, 'settings' | 'installments' | 'bills'>,
  before: ISODate,
): number {
  const { settings, installments, bills } = data
  const from = settings.opening_balance_date
  const opening = from < before ? settings.opening_balance_cents : 0
  const inRange = (d: ISODate | null): d is ISODate => !!d && d >= from && d < before
  const received = sum(installments.filter((i) => inRange(i.paid_at)).map((i) => i.amount_cents))
  const paid = sum(bills.filter((b) => inRange(b.paid_at)).map((b) => b.amount_cents))
  return opening + received - paid
}

/** Dinheiro em caixa hoje (tudo o que ja foi registrado como pago). */
export function cashNow(data: Pick<FinanceData, 'settings' | 'installments' | 'bills'>): number {
  return cashBefore(data, FAR_FUTURE)
}

export interface BillProjection {
  bill: Bill
  /** Caixa previsto no dia do vencimento (negativo = falta dinheiro). */
  projected_cents: number
  shortfall_cents: number
}

/**
 * Para cada boleto em aberto (em ordem cronologica): caixa de hoje + parcelas ainda a vencer
 * (de hoje ate o vencimento do boleto) - todos os boletos em aberto ate esse vencimento.
 * Parcelas atrasadas nao contam. Boletos do mesmo dia disputam o mesmo saldo.
 */
export function projectBills(
  data: Pick<FinanceData, 'settings' | 'installments' | 'bills'>,
  today: ISODate,
): BillProjection[] {
  const cash = cashNow(data)
  const open = data.bills
    .filter((b) => !b.paid_at)
    .sort((a, b) => (a.due_date === b.due_date ? a.order_number.localeCompare(b.order_number) : a.due_date < b.due_date ? -1 : 1))
  const unpaid = data.installments.filter((i) => !i.paid_at && i.due_date >= today)
  return open.map((bill) => {
    const incoming = sum(unpaid.filter((i) => i.due_date <= bill.due_date).map((i) => i.amount_cents))
    const outgoing = sum(open.filter((b) => b.due_date <= bill.due_date).map((b) => b.amount_cents))
    const projected = cash + incoming - outgoing
    return { bill, projected_cents: projected, shortfall_cents: Math.max(0, -projected) }
  })
}

export function firstShortfall(projections: BillProjection[]): BillProjection | null {
  return projections.find((p) => p.projected_cents < 0) ?? null
}

export interface MonthSummary {
  start: ISODate
  nextStart: ISODate
  soldCents: number
  receivedCents: number
  toReceiveMonthCents: number
  totalToReceiveCents: number
  overdueReceivableCents: number
  billsPaidCents: number
  billsToPayMonthCents: number
  billsOverduePrevCents: number
  /** Dinheiro realmente disponivel ao fim do mes selecionado. */
  availableCents: number
  /** Boletos em aberto com vencimento ate o fim do mes. */
  openBillsUntilEndCents: number
  /** Falta de dinheiro REAL para esses boletos (sem contar recebimentos futuros). */
  missingNowCents: number
  /** Recebimentos previstos (parcelas a vencer de hoje ate o fim do mes). */
  forecastReceiptsCents: number
  /** Saldo projetado ao fim do mes: disponivel + previsao - boletos em aberto. */
  projectedCents: number
}

export function summarizeMonth(data: FinanceData, today: ISODate, year: number, month: number): MonthSummary {
  const start = monthStart(year, month)
  const nextStart = nextMonthStart(year, month)
  const { sales, installments, bills } = data
  const inMonth = (d: ISODate | null | undefined): boolean => !!d && d >= start && d < nextStart
  const unpaidInst = installments.filter((i) => !i.paid_at)
  const unpaidBills = bills.filter((b) => !b.paid_at)

  const availableCents = cashBefore(data, nextStart)
  const openBillsUntilEndCents = sum(unpaidBills.filter((b) => b.due_date < nextStart).map((b) => b.amount_cents))
  const forecastReceiptsCents = sum(
    unpaidInst.filter((i) => i.due_date >= today && i.due_date < nextStart).map((i) => i.amount_cents),
  )

  return {
    start,
    nextStart,
    soldCents: sum(sales.filter((s) => inMonth(s.sale_date)).map((s) => s.total_cents)),
    receivedCents: sum(installments.filter((i) => inMonth(i.paid_at)).map((i) => i.amount_cents)),
    toReceiveMonthCents: sum(unpaidInst.filter((i) => inMonth(i.due_date)).map((i) => i.amount_cents)),
    totalToReceiveCents: sum(unpaidInst.map((i) => i.amount_cents)),
    overdueReceivableCents: sum(unpaidInst.filter((i) => i.due_date < today).map((i) => i.amount_cents)),
    billsPaidCents: sum(bills.filter((b) => inMonth(b.paid_at)).map((b) => b.amount_cents)),
    billsToPayMonthCents: sum(unpaidBills.filter((b) => inMonth(b.due_date)).map((b) => b.amount_cents)),
    billsOverduePrevCents: sum(unpaidBills.filter((b) => b.due_date < start).map((b) => b.amount_cents)),
    availableCents,
    openBillsUntilEndCents,
    missingNowCents: Math.max(0, openBillsUntilEndCents - availableCents),
    forecastReceiptsCents,
    projectedCents: availableCents + forecastReceiptsCents - openBillsUntilEndCents,
  }
}

export interface MonthlyRow {
  month: number
  soldCents: number
  receivedCents: number
  toReceiveCents: number
  billsPaidCents: number
  billsToPayCents: number
  /** recebido - boletos pagos */
  balanceCents: number
  /** (recebido + a receber) - (boletos pagos + a pagar) */
  projectedCents: number
  /** Caixa ao fim do mes; null se o mes termina antes da data do saldo inicial. */
  cashEndCents: number | null
}

export function monthlyControl(data: FinanceData, year: number): MonthlyRow[] {
  return Array.from({ length: 12 }, (_, idx) => {
    const month = idx + 1
    const start = monthStart(year, month)
    const next = nextMonthStart(year, month)
    const inMonth = (d: ISODate | null | undefined): boolean => !!d && d >= start && d < next
    const received = sum(data.installments.filter((i) => inMonth(i.paid_at)).map((i) => i.amount_cents))
    const toReceive = sum(data.installments.filter((i) => !i.paid_at && inMonth(i.due_date)).map((i) => i.amount_cents))
    const billsPaid = sum(data.bills.filter((b) => inMonth(b.paid_at)).map((b) => b.amount_cents))
    const billsToPay = sum(data.bills.filter((b) => !b.paid_at && inMonth(b.due_date)).map((b) => b.amount_cents))
    return {
      month,
      soldCents: sum(data.sales.filter((s) => inMonth(s.sale_date)).map((s) => s.total_cents)),
      receivedCents: received,
      toReceiveCents: toReceive,
      billsPaidCents: billsPaid,
      billsToPayCents: billsToPay,
      balanceCents: received - billsPaid,
      projectedCents: received + toReceive - billsPaid - billsToPay,
      cashEndCents: data.settings.opening_balance_date >= next ? null : cashBefore(data, next),
    }
  })
}

export interface ClientSummary {
  clientId: string
  totalSoldCents: number
  paidCents: number
  owedCents: number
  overdueCount: number
  overdueCents: number
}

export function clientSummaries(
  clients: Client[],
  sales: Sale[],
  installments: Installment[],
  today: ISODate,
): Map<string, ClientSummary> {
  const out = new Map<string, ClientSummary>()
  for (const c of clients) {
    out.set(c.id, { clientId: c.id, totalSoldCents: 0, paidCents: 0, owedCents: 0, overdueCount: 0, overdueCents: 0 })
  }
  const saleClient = new Map(sales.map((s) => [s.id, s.client_id]))
  for (const s of sales) {
    const row = out.get(s.client_id)
    if (row) row.totalSoldCents += s.total_cents
  }
  for (const i of installments) {
    const row = out.get(saleClient.get(i.sale_id) ?? '')
    if (!row) continue
    if (i.paid_at) row.paidCents += i.amount_cents
    else {
      row.owedCents += i.amount_cents
      if (i.due_date < today) {
        row.overdueCount += 1
        row.overdueCents += i.amount_cents
      }
    }
  }
  return out
}
