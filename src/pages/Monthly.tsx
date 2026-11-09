import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Card, ErrorBox, Spinner } from '../components/Ui'
import { Page, PageHeader } from '../components/Layout'
import { useData } from '../data/DataContext'
import { MONTHS, parseISO, todayISO } from '../lib/dates'
import { monthlyControl } from '../lib/finance'
import { formatBRL } from '../lib/money'
import { formatPct, profitByMonth } from '../lib/profit'

export default function Monthly() {
  const { settings, sales, installments, bills, loading, error } = useData()
  const t = parseISO(todayISO())
  const [year, setYear] = useState(t.y)
  const rows = useMemo(() => monthlyControl({ settings, sales, installments, bills }, year), [settings, sales, installments, bills, year])
  const profits = useMemo(() => profitByMonth(sales, year), [sales, year])
  const total = (k: 'receivedCents' | 'toReceiveCents' | 'billsPaidCents' | 'billsToPayCents' | 'balanceCents') => rows.reduce((a, r) => a + r[k], 0)
  const yearProfit = profits.reduce((a, p) => a + p.grossProfitCents, 0)
  const yearCostedRevenue = profits.reduce((a, p) => a + p.costedRevenueCents, 0)
  const yearMargin = yearCostedRevenue > 0 ? Math.round((yearProfit * 10000) / yearCostedRevenue) / 100 : null

  return (
    <>
      <PageHeader title="Controle mensal" subtitle="Seu ano mês a mês" back="/">
        <div className="mt-3 flex items-center justify-between rounded-2xl bg-white/80 px-1 shadow-card">
          <button type="button" aria-label="Ano anterior" onClick={() => setYear(year - 1)} className="flex h-12 w-12 items-center justify-center rounded-full text-brand-800 active:bg-brand-100"><ChevronLeft className="h-6 w-6" /></button>
          <span className="font-display text-xl text-brand-800">{year}</span>
          <button type="button" aria-label="Próximo ano" onClick={() => setYear(year + 1)} className="flex h-12 w-12 items-center justify-center rounded-full text-brand-800 active:bg-brand-100"><ChevronRight className="h-6 w-6" /></button>
        </div>
      </PageHeader>
      <Page>
        {error && <ErrorBox>{error}</ErrorBox>}
        {loading ? <Spinner /> : (
          <div className="space-y-3">
            <Card className="bg-brand-800 text-white">
              <p className="text-sm font-semibold text-brand-200">Total de {year}</p>
              <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-brand-200">Recebido</p><p className="tabular text-lg font-bold">{formatBRL(total('receivedCents'))}</p></div>
                <div><p className="text-brand-200">A receber</p><p className="tabular text-lg font-bold">{formatBRL(total('toReceiveCents'))}</p></div>
                <div><p className="text-brand-200">Boletos pagos</p><p className="tabular text-lg font-bold">{formatBRL(total('billsPaidCents'))}</p></div>
                <div><p className="text-brand-200">Boletos a pagar</p><p className="tabular text-lg font-bold">{formatBRL(total('billsToPayCents'))}</p></div>
              </div>
              <div className="mt-3 flex items-center justify-between rounded-2xl bg-white/10 px-3 py-2.5 text-sm">
                <span className="text-brand-100">Lucro bruto das vendas</span>
                <span className="tabular font-bold">{yearCostedRevenue > 0 ? `${formatBRL(yearProfit)} · ${formatPct(yearMargin)}` : '—'}</span>
              </div>
            </Card>
            {rows.map((r, idx) => {
              const pr = profits[idx]
              const isNow = year === t.y && r.month === t.m
              return (
                <Card key={r.month} className={`${isNow ? 'ring-2 ring-brand-500' : ''}`}>
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-xl text-brand-800">{MONTHS[r.month - 1]}</h3>
                    <span className={`tabular text-sm font-bold ${r.balanceCents < 0 ? 'text-red-700' : 'text-emerald-700'}`}>Saldo do mês {formatBRL(r.balanceCents)}</span>
                  </div>
                  <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                    <div><dt className="text-xs text-emerald-700">Recebido</dt><dd className="tabular font-bold text-emerald-700">{formatBRL(r.receivedCents)}</dd></div>
                    <div><dt className="text-xs text-stone-600">A receber</dt><dd className="tabular font-bold">{formatBRL(r.toReceiveCents)}</dd></div>
                    <div><dt className="text-xs text-stone-600">Boletos pagos</dt><dd className="tabular font-bold">{formatBRL(r.billsPaidCents)}</dd></div>
                    <div><dt className="text-xs text-stone-600">Boletos a pagar</dt><dd className="tabular font-bold">{formatBRL(r.billsToPayCents)}</dd></div>
                  </dl>
                  <div className="mt-2 flex items-center justify-between rounded-2xl bg-brand-50 px-3 py-2 text-xs">
                    <span className="font-semibold text-brand-800">Lucro bruto das vendas</span>
                    {pr.costedRevenueCents > 0 ? (
                      <span className={`tabular font-bold ${pr.grossProfitCents < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                        {formatBRL(pr.grossProfitCents)} · {formatPct(pr.marginPct)}
                      </span>
                    ) : (
                      <span className="text-stone-600">{pr.salesCount > 0 ? 'Custo não informado' : '—'}</span>
                    )}
                  </div>
                  <p className="mt-2 border-t border-brand-100 pt-2 text-xs text-stone-600">
                    Caixa no fim do mês: <b className="tabular text-ink">{r.cashEndCents === null ? '—' : formatBRL(r.cashEndCents)}</b>
                  </p>
                </Card>
              )
            })}
          </div>
        )}
      </Page>
    </>
  )
}
