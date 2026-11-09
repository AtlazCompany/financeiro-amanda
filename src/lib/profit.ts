/**
 * Lucro das vendas (resultado COMERCIAL), separado do caixa.
 *
 *  receita   = quantidade x preco unitario - desconto          (= total da venda; e o que se parcela)
 *  custo     = quantidade x custo unitario
 *  lucro bruto = receita - custo
 *  margem    = lucro bruto / receita x 100  (so com receita positiva)
 *
 * Regras:
 *  - Lucro e margem consideram as vendas FEITAS no periodo, recebidas ou nao.
 *  - Venda sem custo informado (null) fica FORA do lucro e da margem: nunca vira custo zero.
 *  - Boletos nao entram aqui (sao saidas de caixa; um pedido pode ter produtos ainda nao vendidos),
 *    entao o custo dos produtos nunca e descontado duas vezes.
 *  - E lucro BRUTO: nao desconta outras despesas.
 * Tudo em centavos inteiros.
 */
import { monthStart, nextMonthStart } from './dates'
import type { Sale } from './types'

export interface Economics {
  /** quantidade x preco (antes do desconto) */
  grossCents: number
  /** receita da venda, apos o desconto */
  revenueCents: number
  costCents: number | null
  profitCents: number | null
  /** em %, com 2 casas (46,67); null se sem custo ou sem receita positiva */
  marginPct: number | null
  /** true quando a venda da prejuizo (lucro < 0) */
  isLoss: boolean
  /** true quando o desconto passa do valor dos produtos */
  discountTooHigh: boolean
}

function margin(profit: number, revenue: number): number | null {
  if (revenue <= 0) return null
  return Math.round((profit * 10000) / revenue) / 100
}

export function computeEconomics(i: {
  quantity: number
  unitCostCents: number | null
  unitPriceCents: number
  discountCents: number
}): Economics {
  const gross = i.quantity * i.unitPriceCents
  const revenue = gross - i.discountCents
  const cost = i.unitCostCents === null ? null : i.quantity * i.unitCostCents
  const profit = cost === null ? null : revenue - cost
  return {
    grossCents: gross,
    revenueCents: revenue,
    costCents: cost,
    profitCents: profit,
    marginPct: profit === null ? null : margin(profit, revenue),
    isLoss: profit !== null && profit < 0,
    discountTooHigh: i.discountCents > gross,
  }
}

export interface SaleProfit {
  revenueCents: number
  costCents: number | null
  profitCents: number | null
  marginPct: number | null
  isLoss: boolean
  costKnown: boolean
}

/** Lucro de uma venda ja salva (o total_cents e a receita final). */
export function saleProfit(s: Pick<Sale, 'quantity' | 'unit_cost_cents' | 'total_cents'>): SaleProfit {
  const costKnown = s.unit_cost_cents !== null && s.unit_cost_cents !== undefined
  const cost = costKnown ? s.quantity * (s.unit_cost_cents as number) : null
  const profit = cost === null ? null : s.total_cents - cost
  return {
    revenueCents: s.total_cents,
    costCents: cost,
    profitCents: profit,
    marginPct: profit === null ? null : margin(profit, s.total_cents),
    isLoss: profit !== null && profit < 0,
    costKnown,
  }
}

export interface ProfitSummary {
  /** Total vendido no periodo (todas as vendas, com ou sem custo). */
  soldCents: number
  /** Custo dos produtos vendidos (so vendas com custo informado). */
  costCents: number
  /** Lucro bruto (so vendas com custo informado). */
  grossProfitCents: number
  /** Margem bruta sobre a receita das vendas com custo informado. */
  marginPct: number | null
  /** Receita das vendas com custo informado (base da margem). */
  costedRevenueCents: number
  salesCount: number
  missingCostCount: number
}

export function profitSummary(sales: Sale[], year: number, month: number): ProfitSummary {
  const start = monthStart(year, month)
  const next = nextMonthStart(year, month)
  let sold = 0, cost = 0, profit = 0, costedRevenue = 0, count = 0, missing = 0
  for (const s of sales) {
    if (s.sale_date < start || s.sale_date >= next) continue
    count += 1
    sold += s.total_cents
    const p = saleProfit(s)
    if (!p.costKnown) { missing += 1; continue }
    cost += p.costCents as number
    profit += p.profitCents as number
    costedRevenue += s.total_cents
  }
  return {
    soldCents: sold, costCents: cost, grossProfitCents: profit,
    marginPct: costedRevenue > 0 ? margin(profit, costedRevenue) : null,
    costedRevenueCents: costedRevenue, salesCount: count, missingCostCount: missing,
  }
}

export interface ProfitMonth extends ProfitSummary {
  month: number
}

/** Evolucao mensal do lucro bruto no ano. */
export function profitByMonth(sales: Sale[], year: number): ProfitMonth[] {
  return Array.from({ length: 12 }, (_, i) => ({ month: i + 1, ...profitSummary(sales, year, i + 1) }))
}

/** "46,67%" */
export function formatPct(p: number | null): string {
  if (p === null) return '—'
  return `${p.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
}
