import { describe, expect, it } from 'vitest'
import { computeEconomics, formatPct, profitByMonth, profitSummary, saleProfit } from './profit'
import { cashNow, projectBills, splitInstallments, summarizeMonth, type FinanceData } from './finance'
import type { Bill, Installment, Sale } from './types'

const sale = (o: Partial<Sale> & Pick<Sale, 'id' | 'sale_date' | 'total_cents'>): Sale => ({
  client_id: 'c', description: 'x', installments_count: 1, first_due_date: o.sale_date,
  quantity: 1, unit_cost_cents: null, unit_price_cents: null, discount_cents: 0, ...o,
})

describe('formulas de lucro', () => {
  it('exemplo do enunciado: hidratante R$ 16 -> R$ 30 = lucro R$ 14 e 46,67%', () => {
    const e = computeEconomics({ quantity: 1, unitCostCents: 1600, unitPriceCents: 3000, discountCents: 0 })
    expect(e).toMatchObject({ grossCents: 3000, revenueCents: 3000, costCents: 1600, profitCents: 1400, marginPct: 46.67, isLoss: false })
    expect(formatPct(e.marginPct)).toBe('46,67%')
  })
  it('quantidade maior que um', () => {
    const e = computeEconomics({ quantity: 3, unitCostCents: 1600, unitPriceCents: 3000, discountCents: 0 })
    expect(e).toMatchObject({ revenueCents: 9000, costCents: 4800, profitCents: 4200, marginPct: 46.67 })
  })
  it('desconto reduz a receita e o lucro (nao o custo)', () => {
    const e = computeEconomics({ quantity: 2, unitCostCents: 1600, unitPriceCents: 3000, discountCents: 1000 })
    expect(e).toMatchObject({ grossCents: 6000, revenueCents: 5000, costCents: 3200, profitCents: 1800, marginPct: 36 })
  })
  it('venda com prejuizo: lucro negativo e aviso', () => {
    const e = computeEconomics({ quantity: 1, unitCostCents: 3000, unitPriceCents: 2500, discountCents: 0 })
    expect(e).toMatchObject({ profitCents: -500, isLoss: true, marginPct: -20 })
  })
  it('prejuizo tambem quando o desconto leva o lucro abaixo de zero', () => {
    const e = computeEconomics({ quantity: 1, unitCostCents: 1600, unitPriceCents: 3000, discountCents: 1500 })
    expect(e.profitCents).toBe(-100)
    expect(e.isLoss).toBe(true)
  })
  it('lucro zero nao e prejuizo', () => {
    const e = computeEconomics({ quantity: 1, unitCostCents: 3000, unitPriceCents: 3000, discountCents: 0 })
    expect(e).toMatchObject({ profitCents: 0, isLoss: false, marginPct: 0 })
  })
  it('margem so com receita positiva; desconto alto e sinalizado', () => {
    const e = computeEconomics({ quantity: 1, unitCostCents: 1000, unitPriceCents: 3000, discountCents: 3000 })
    expect(e.marginPct).toBeNull()
    const f = computeEconomics({ quantity: 1, unitCostCents: 1000, unitPriceCents: 3000, discountCents: 3500 })
    expect(f.discountTooHigh).toBe(true)
    expect(f.marginPct).toBeNull()
  })
  it('custo nao informado: sem lucro e sem margem (nunca custo zero)', () => {
    const e = computeEconomics({ quantity: 1, unitCostCents: null, unitPriceCents: 3000, discountCents: 0 })
    expect(e).toMatchObject({ costCents: null, profitCents: null, marginPct: null, isLoss: false })
  })
  it('centavos: 1/3 de margem arredonda em 2 casas', () => {
    expect(computeEconomics({ quantity: 1, unitCostCents: 2000, unitPriceCents: 3000, discountCents: 0 }).marginPct).toBe(33.33)
    expect(computeEconomics({ quantity: 1, unitCostCents: 1000, unitPriceCents: 3000, discountCents: 0 }).marginPct).toBe(66.67)
  })
})

describe('parcelamento sobre o valor final (apos desconto)', () => {
  it('3 x R$ 30 com R$ 10 de desconto = R$ 80 em 3x: 26,67 + 26,67 + 26,66', () => {
    const e = computeEconomics({ quantity: 3, unitCostCents: 1600, unitPriceCents: 3000, discountCents: 1000 })
    expect(e.revenueCents).toBe(8000)
    const parts = splitInstallments(e.revenueCents, 3, '2026-11-09').map((p) => p.amount_cents)
    expect(parts).toEqual([2667, 2667, 2666])
    expect(parts.reduce((a, b) => a + b, 0)).toBe(e.revenueCents)
  })
})

describe('saleProfit (venda salva)', () => {
  it('com custo informado', () => {
    const p = saleProfit(sale({ id: '1', sale_date: '2026-11-03', total_cents: 6000, quantity: 2, unit_cost_cents: 1600 }))
    expect(p).toMatchObject({ costKnown: true, costCents: 3200, profitCents: 2800, marginPct: 46.67, isLoss: false })
  })
  it('venda antiga (custo null) nao gera lucro ficticio', () => {
    const p = saleProfit(sale({ id: '2', sale_date: '2026-10-03', total_cents: 15000 }))
    expect(p).toMatchObject({ costKnown: false, costCents: null, profitCents: null, marginPct: null })
  })
  it('custo zero informado e diferente de nao informado', () => {
    const p = saleProfit(sale({ id: '3', sale_date: '2026-10-03', total_cents: 1000, unit_cost_cents: 0 }))
    expect(p).toMatchObject({ costKnown: true, profitCents: 1000, marginPct: 100 })
  })
})

describe('indicadores mensais', () => {
  const sales = [
    sale({ id: 'a', sale_date: '2026-11-03', total_cents: 3000, unit_cost_cents: 1600 }),                  // lucro 1400
    sale({ id: 'b', sale_date: '2026-11-10', total_cents: 9000, quantity: 3, unit_cost_cents: 2000 }),     // custo 6000, lucro 3000
    sale({ id: 'c', sale_date: '2026-11-20', total_cents: 5000 }),                                         // antiga: sem custo
    sale({ id: 'd', sale_date: '2026-11-25', total_cents: 2000, unit_cost_cents: 2500 }),                  // prejuizo -500
    sale({ id: 'e', sale_date: '2026-10-31', total_cents: 7000, unit_cost_cents: 1000 }),                  // outro mes
    sale({ id: 'f', sale_date: '2026-12-01', total_cents: 4000, unit_cost_cents: 1000 }),                  // outro mes
  ]
  it('novembro: lucro das vendas feitas no mes, com ou sem recebimento', () => {
    const s = profitSummary(sales, 2026, 11)
    expect(s.soldCents).toBe(19000)
    expect(s.costCents).toBe(1600 + 6000 + 2500)
    expect(s.grossProfitCents).toBe(1400 + 3000 - 500)
    expect(s.costedRevenueCents).toBe(14000)
    expect(s.marginPct).toBe(Math.round((3900 * 10000) / 14000) / 100)
    expect(s.salesCount).toBe(4)
    expect(s.missingCostCount).toBe(1)
  })
  it('mes sem vendas', () => {
    const s = profitSummary(sales, 2026, 9)
    expect(s).toMatchObject({ soldCents: 0, grossProfitCents: 0, marginPct: null, salesCount: 0 })
  })
  it('evolucao mensal do ano', () => {
    const rows = profitByMonth(sales, 2026)
    expect(rows).toHaveLength(12)
    expect(rows[9]).toMatchObject({ month: 10, grossProfitCents: 6000, marginPct: 85.71 })
    expect(rows[11]).toMatchObject({ month: 12, grossProfitCents: 3000, marginPct: 75 })
    expect(rows[0].soldCents).toBe(0)
  })
  it('venda de mes anterior so com custo desconhecido: lucro 0 e margem nula, sem inventar', () => {
    const only = [sale({ id: 'z', sale_date: '2026-11-02', total_cents: 8000 })]
    const s = profitSummary(only, 2026, 11)
    expect(s).toMatchObject({ soldCents: 8000, grossProfitCents: 0, costCents: 0, marginPct: null, missingCostCount: 1 })
  })
})

describe('boletos e caixa nao mexem no lucro (sem dupla contagem do custo)', () => {
  const sales = [sale({ id: 'a', sale_date: '2026-11-03', total_cents: 3000, unit_cost_cents: 1600 })]
  const insts: Installment[] = [{ id: 'i', sale_id: 'a', number: 1, due_date: '2026-11-03', amount_cents: 3000, paid_at: '2026-11-03' }]
  const bills: Bill[] = [{ id: 'b', order_number: '1', order_date: null, amount_cents: 50000, due_date: '2026-11-05', paid_at: '2026-11-04', notes: null }]
  const data: FinanceData = { settings: { opening_balance_cents: 0, opening_balance_date: '2026-11-01', alert_days: 7 }, sales, installments: insts, bills }
  it('lucro continua o mesmo com ou sem boletos', () => {
    const withBills = profitSummary(sales, 2026, 11).grossProfitCents
    expect(withBills).toBe(1400)
    expect(profitSummary(sales, 2026, 11).costCents).toBe(1600)
  })
  it('o caixa so conta o que entrou e saiu: boleto de R$ 500 e saida, nao altera o lucro', () => {
    expect(cashNow(data)).toBe(3000 - 50000)
    expect(summarizeMonth(data, '2026-11-09', 2026, 11).availableCents).toBe(-47000)
  })
  it('regressao: projecao de boletos continua ignorando parcelas atrasadas', () => {
    const open: FinanceData = { ...data, bills: [{ ...bills[0], paid_at: null }], installments: [{ ...insts[0], paid_at: null }] }
    const p = projectBills(open, '2026-11-09')
    expect(p[0].projected_cents).toBe(0 - 50000)
  })
})
