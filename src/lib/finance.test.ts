import { describe, expect, it } from 'vitest'
import { addDays, addMonths, daysInMonth, diffDays, formatBR, isValidISO, todayISO } from './dates'
import {
  billStatus, cashNow, clientSummaries, firstShortfall, installmentStatus, monthlyControl,
  projectBills, saleStatus, splitInstallments, summarizeMonth, type FinanceData,
} from './finance'
import { digitsToCents, formatBRL, reaisToCents } from './money'
import type { Bill, Installment, Sale } from './types'

const TODAY = '2026-11-09'

describe('datas', () => {
  it('EDATE: ajusta fim de mes e vira o ano', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29')
    expect(addMonths('2026-01-31', 2)).toBe('2026-03-31')
    expect(addMonths('2026-11-15', 2)).toBe('2027-01-15')
    expect(addMonths('2026-12-31', 12)).toBe('2027-12-31')
  })
  it('utilitarios', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(diffDays('2026-11-09', '2026-11-12')).toBe(3)
    expect(diffDays('2026-11-09', '2026-11-05')).toBe(-4)
    expect(daysInMonth(2026, 2)).toBe(28)
    expect(formatBR('2026-09-05')).toBe('05/09/2026')
    expect(isValidISO('2026-02-30')).toBe(false)
    expect(isValidISO('2026-02-28')).toBe(true)
    expect(todayISO(new Date(2026, 10, 9, 23, 59))).toBe('2026-11-09')
  })
})

describe('dinheiro', () => {
  it('formata e converte centavos', () => {
    expect(formatBRL(123456)).toBe('R$ 1.234,56')
    expect(reaisToCents(249.9)).toBe(24990)
    expect(reaisToCents(1.005)).toBe(101)
    expect(reaisToCents(0.1 + 0.2)).toBe(30)
    expect(digitsToCents('R$ 1.234,56')).toBe(123456)
    expect(digitsToCents('')).toBe(0)
  })
})

describe('splitInstallments', () => {
  it('a vista', () => {
    expect(splitInstallments(18000, 1, '2026-09-20')).toEqual([
      { number: 1, due_date: '2026-09-20', amount_cents: 18000 },
    ])
  })
  it('R$ 150 em 3x = 50 + 50 + 50', () => {
    expect(splitInstallments(15000, 3, '2026-10-10').map((p) => p.amount_cents)).toEqual([5000, 5000, 5000])
  })
  it('R$ 100 em 3x: ultima parcela absorve centavos (33,33 + 33,33 + 33,34)', () => {
    expect(splitInstallments(10000, 3, '2026-11-01').map((p) => p.amount_cents)).toEqual([3333, 3333, 3334])
  })
  it('R$ 100 em 6x: 16,67 x5 + 16,65 (igual a planilha)', () => {
    const p = splitInstallments(10000, 6, '2026-11-01')
    expect(p.map((x) => x.amount_cents)).toEqual([1667, 1667, 1667, 1667, 1667, 1665])
    expect(p.reduce((a, b) => a + b.amount_cents, 0)).toBe(10000)
  })
  it('R$ 249,90 em 3x = 83,30 x3', () => {
    expect(splitInstallments(24990, 3, '2026-10-05').map((p) => p.amount_cents)).toEqual([8330, 8330, 8330])
  })
  it('a soma sempre fecha o total e vencimentos mensais', () => {
    for (let total = 6; total < 3000; total += 7) {
      for (let n = 1; n <= 6; n++) {
        const parts = splitInstallments(total, n, '2026-01-31')
        expect(parts.reduce((a, b) => a + b.amount_cents, 0)).toBe(total)
        expect(parts.every((p) => p.amount_cents > 0)).toBe(true)
      }
    }
    expect(splitInstallments(9000, 3, '2026-01-31').map((p) => p.due_date)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31'])
  })
  it('rejeita entradas invalidas', () => {
    expect(() => splitInstallments(0, 3, '2026-01-01')).toThrow()
    expect(() => splitInstallments(1000, 7, '2026-01-01')).toThrow()
    expect(() => splitInstallments(1000, 0, '2026-01-01')).toThrow()
    expect(() => splitInstallments(10.5, 2, '2026-01-01')).toThrow()
  })
})

describe('status', () => {
  it('parcela', () => {
    expect(installmentStatus({ due_date: '2026-11-08', paid_at: null }, TODAY)).toBe('overdue')
    expect(installmentStatus({ due_date: '2026-11-09', paid_at: null }, TODAY)).toBe('pending')
    expect(installmentStatus({ due_date: '2026-11-01', paid_at: '2026-11-02' }, TODAY)).toBe('paid')
  })
  it('boleto: vencido, vencendo em breve, pendente e pago', () => {
    expect(billStatus({ due_date: '2026-11-05', paid_at: null }, TODAY, 7)).toBe('overdue')
    expect(billStatus({ due_date: '2026-11-16', paid_at: null }, TODAY, 7)).toBe('soon')
    expect(billStatus({ due_date: '2026-11-17', paid_at: null }, TODAY, 7)).toBe('pending')
    expect(billStatus({ due_date: '2026-11-05', paid_at: '2026-11-06' }, TODAY, 7)).toBe('paid')
  })
})

// ---- Cenario da planilha de demonstracao ----
let seq = 0
function mkSale(client: string, sale_date: string, total: number, count: number, first: string, paid: (string | null)[]) {
  const id = `s${++seq}`
  const sale: Sale = { id, client_id: client, description: 'x', sale_date, total_cents: total, installments_count: count, first_due_date: first }
  const insts: Installment[] = splitInstallments(total, count, first).map((d, i) => ({
    id: `${id}-${d.number}`, sale_id: id, number: d.number, due_date: d.due_date, amount_cents: d.amount_cents, paid_at: paid[i] ?? null,
  }))
  return { sale, insts }
}
const raw = [
  mkSale('maria', '2026-08-12', 30000, 3, '2026-09-12', ['2026-09-12', '2026-10-13']),
  mkSale('ana', '2026-08-25', 12000, 2, '2026-09-25', ['2026-09-25', '2026-11-02']),
  mkSale('ana', '2026-09-05', 24990, 3, '2026-10-05', ['2026-10-06']),
  mkSale('carla', '2026-09-20', 18000, 1, '2026-09-20', ['2026-09-20']),
  mkSale('juliana', '2026-10-02', 42000, 4, '2026-10-10', ['2026-10-11']),
  mkSale('maria', '2026-10-15', 8980, 1, '2026-10-15', ['2026-10-15']),
  mkSale('fernanda', '2026-10-28', 36000, 3, '2026-11-05', []),
  mkSale('beatriz', '2026-11-03', 15000, 2, '2026-11-03', ['2026-11-03']),
  mkSale('patricia', '2026-11-07', 21000, 1, '2026-11-15', []),
]
const bill = (n: string, due: string, cents: number, paid: string | null = null): Bill => ({
  id: n, order_number: n, order_date: null, amount_cents: cents, due_date: due, paid_at: paid, notes: null,
})
const demo: FinanceData = {
  settings: { opening_balance_cents: 70000, opening_balance_date: '2026-08-01', alert_days: 7 },
  sales: raw.map((r) => r.sale),
  installments: raw.flatMap((r) => r.insts),
  bills: [
    bill('1021', '2026-09-05', 42000, '2026-09-04'),
    bill('1034', '2026-10-10', 51000, '2026-10-09'),
    bill('1048', '2026-11-05', 48000),
    bill('1055', '2026-11-12', 39050),
    bill('1062', '2026-12-04', 56000),
  ],
}

describe('resumo do mes (confere com a planilha, novembro/2026)', () => {
  const s = summarizeMonth(demo, TODAY, 2026, 11)
  it('vendas e recebimentos', () => {
    expect(s.soldCents).toBe(36000)
    expect(s.receivedCents).toBe(13500)
    expect(s.toReceiveMonthCents).toBe(61830)
    expect(s.totalToReceiveCents).toBe(122660)
    expect(s.overdueReceivableCents).toBe(20330)
  })
  it('boletos', () => {
    expect(s.billsPaidCents).toBe(0)
    expect(s.billsToPayMonthCents).toBe(87050)
    expect(s.billsOverduePrevCents).toBe(0)
  })
  it('caixa: saldo inicial uma unica vez, so dinheiro real', () => {
    expect(s.availableCents).toBe(62310)
    expect(s.openBillsUntilEndCents).toBe(87050)
    expect(s.missingNowCents).toBe(24740)
    expect(cashNow(demo)).toBe(62310)
  })
  it('projecao nao conta parcelas atrasadas', () => {
    // parcelas a vencer de 09/11 a 30/11: Juliana 105 (10/11), Maria 100 (12/11), Patricia 210 (15/11), Beatriz 0 (3/12 fora)
    expect(s.forecastReceiptsCents).toBe(10500 + 10000 + 21000)
    expect(s.projectedCents).toBe(62310 + 41500 - 87050)
  })
  it('mes anterior (outubro) e saldo inicial nao repetido', () => {
    const o = summarizeMonth(demo, TODAY, 2026, 10)
    expect(o.availableCents).toBe(48810)
    expect(o.receivedCents).toBe(37810)
    expect(o.billsPaidCents).toBe(51000)
    // antes da data do saldo inicial: nada
    expect(summarizeMonth(demo, TODAY, 2026, 7).availableCents).toBe(0)
  })
})

describe('projecao de boletos (ordem cronologica, sem usar o mesmo saldo duas vezes)', () => {
  const p = projectBills(demo, TODAY)
  it('uma entrada por boleto em aberto, ordenado', () => {
    expect(p.map((x) => x.bill.order_number)).toEqual(['1048', '1055', '1062'])
  })
  it('parcelas atrasadas nao contam como dinheiro', () => {
    expect(p[0].projected_cents).toBe(14310) // 623,10 - 480 (sem as parcelas atrasadas de 05/11)
  })
  it('valores finais', () => {
    expect(p[1].projected_cents).toBe(-4240)
    expect(p[2].projected_cents).toBe(-31740)
  })
  it('alerta aponta o primeiro boleto sem dinheiro', () => {
    const f = firstShortfall(p)
    expect(f?.bill.order_number).toBe('1055')
    expect(f?.shortfall_cents).toBe(4240)
  })
  it('sem boletos em aberto nao ha alerta', () => {
    expect(firstShortfall(projectBills({ ...demo, bills: [] }, TODAY))).toBeNull()
  })
  it('pagar o boleto atrasado atualiza a projecao', () => {
    const paid = { ...demo, bills: demo.bills.map((b) => (b.order_number === '1048' ? { ...b, paid_at: '2026-11-09' } : b)) }
    expect(cashNow(paid)).toBe(62310 - 48000)
    const p2 = projectBills(paid, TODAY)
    expect(p2.map((x) => x.bill.order_number)).toEqual(['1055', '1062'])
    expect(p2[0].projected_cents).toBe(14310 + 20500 - 39050)
  })
  it('boletos no mesmo dia dividem o mesmo saldo', () => {
    const d: FinanceData = {
      settings: { opening_balance_cents: 10000, opening_balance_date: '2026-01-01', alert_days: 7 },
      sales: [], installments: [],
      bills: [bill('A', '2026-11-20', 6000), bill('B', '2026-11-20', 6000)],
    }
    const r = projectBills(d, TODAY)
    expect(r.map((x) => x.projected_cents)).toEqual([-2000, -2000])
  })
})

describe('controle mensal', () => {
  const rows = monthlyControl(demo, 2026)
  it('12 meses', () => expect(rows).toHaveLength(12))
  it('setembro e outubro (igual a planilha)', () => {
    expect(rows[8]).toMatchObject({ receivedCents: 34000, billsPaidCents: 42000, balanceCents: -8000, cashEndCents: 62000 })
    expect(rows[9]).toMatchObject({ receivedCents: 37810, billsPaidCents: 51000, balanceCents: -13190, cashEndCents: 48810 })
  })
  it('novembro e dezembro', () => {
    expect(rows[10]).toMatchObject({ receivedCents: 13500, toReceiveCents: 61830, billsToPayCents: 87050, projectedCents: -11720, cashEndCents: 62310 })
    expect(rows[11]).toMatchObject({ toReceiveCents: 38330, billsToPayCents: 56000, projectedCents: -17670 })
  })
  it('meses antes do saldo inicial ficam sem caixa; agosto traz o saldo inicial', () => {
    expect(rows[0].cashEndCents).toBeNull()
    expect(rows[6].cashEndCents).toBeNull()
    expect(rows[7].cashEndCents).toBe(70000)
  })
  it('anos diferentes preservam o historico', () => {
    const r27 = monthlyControl(demo, 2027)
    expect(r27[0].toReceiveCents).toBe(10500 + 12000) // Juliana 10/01 + Fernanda 05/01
    expect(r27[0].cashEndCents).toBe(62310)
    expect(monthlyControl(demo, 2026)[8].receivedCents).toBe(34000)
  })
})

describe('clientes e vendas', () => {
  const clients = ['maria', 'ana', 'carla', 'juliana', 'fernanda', 'beatriz', 'patricia'].map((id) => ({ id, name: id, whatsapp: null, notes: null }))
  const m = clientSummaries(clients, demo.sales, demo.installments, TODAY)
  it('totais por cliente', () => {
    expect(m.get('fernanda')).toMatchObject({ totalSoldCents: 36000, paidCents: 0, owedCents: 36000, overdueCount: 1, overdueCents: 12000 })
    expect(m.get('ana')).toMatchObject({ totalSoldCents: 36990, paidCents: 20330, owedCents: 16660, overdueCount: 1 })
    expect(m.get('carla')).toMatchObject({ owedCents: 0, overdueCount: 0 })
  })
  it('status da venda', () => {
    expect(saleStatus(raw[3].insts, TODAY)).toBe('paid')
    expect(saleStatus(raw[6].insts, TODAY)).toBe('overdue')
    expect(saleStatus(raw[8].insts, TODAY)).toBe('pending')
  })
  it('pagamento corrigido (desfeito) volta a ser dinheiro a receber e sai do caixa', () => {
    const undone = { ...demo, installments: demo.installments.map((i) => (i.id === 's4-1' ? { ...i, paid_at: null } : i)) }
    expect(cashNow(undone)).toBe(62310 - 18000)
    expect(summarizeMonth(undone, TODAY, 2026, 11).totalToReceiveCents).toBe(122660 + 18000)
  })
})
