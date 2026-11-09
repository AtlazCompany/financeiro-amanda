import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Card, ErrorBox, Spinner } from '../components/Ui'
import { Page, PageHeader } from '../components/Layout'
import { useData } from '../data/DataContext'
import { MONTHS, parseISO, todayISO } from '../lib/dates'
import { monthlyControl } from '../lib/finance'
import { formatBRL } from '../lib/money'

export default function Monthly() {
  const { settings, sales, installments, bills, loading, error } = useData()
  const t = parseISO(todayISO())
  const [year, setYear] = useState(t.y)
  const rows = useMemo(() => monthlyControl({ settings, sales, installments, bills }, year), [settings, sales, installments, bills, year])
  const total = (k: 'receivedCents' | 'toReceiveCents' | 'billsPaidCents' | 'billsToPayCents' | 'balanceCents') => rows.reduce((a, r) => a + r[k], 0)

  return (
    <>
      <PageHeader title="Controle mensal" subtitle="Seu ano mês a mês" back="/">
        <div className="mt-3 flex items-center justify-between rounded-2xl bg-white/10 px-1">
          <button type="button" aria-label="Ano anterior" onClick={() => setYear(year - 1)} className="flex h-12 w-12 items-center justify-center rounded-full active:bg-white/15"><ChevronLeft className="h-6 w-6" /></button>
          <span className="text-lg font-bold">{year}</span>
          <button type="button" aria-label="Próximo ano" onClick={() => setYear(year + 1)} className="flex h-12 w-12 items-center justify-center rounded-full active:bg-white/15"><ChevronRight className="h-6 w-6" /></button>
        </div>
      </PageHeader>
      <Page>
        {error && <ErrorBox>{error}</ErrorBox>}
        {loading ? <Spinner /> : (
          <div className="space-y-3">
            <Card className="bg-brand-900 text-white">
              <p className="text-sm font-semibold text-brand-100">Total de {year}</p>
              <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-brand-100">Recebido</p><p className="text-lg font-extrabold">{formatBRL(total('receivedCents'))}</p></div>
                <div><p className="text-brand-100">A receber</p><p className="text-lg font-extrabold">{formatBRL(total('toReceiveCents'))}</p></div>
                <div><p className="text-brand-100">Boletos pagos</p><p className="text-lg font-extrabold">{formatBRL(total('billsPaidCents'))}</p></div>
                <div><p className="text-brand-100">Boletos a pagar</p><p className="text-lg font-extrabold">{formatBRL(total('billsToPayCents'))}</p></div>
              </div>
            </Card>
            {rows.map((r) => {
              const isNow = year === t.y && r.month === t.m
              const empty = !r.receivedCents && !r.toReceiveCents && !r.billsPaidCents && !r.billsToPayCents
              return (
                <Card key={r.month} className={`${isNow ? 'ring-2 ring-brand-700' : ''} ${empty ? 'opacity-60' : ''}`}>
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-extrabold text-stone-900">{MONTHS[r.month - 1]}</h3>
                    <span className={`text-sm font-bold ${r.balanceCents < 0 ? 'text-red-600' : 'text-brand-700'}`}>Saldo do mês {formatBRL(r.balanceCents)}</span>
                  </div>
                  <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                    <div><dt className="text-xs text-brand-700">Recebido</dt><dd className="font-bold text-brand-700">{formatBRL(r.receivedCents)}</dd></div>
                    <div><dt className="text-xs text-stone-500">A receber</dt><dd className="font-bold">{formatBRL(r.toReceiveCents)}</dd></div>
                    <div><dt className="text-xs text-stone-500">Boletos pagos</dt><dd className="font-bold">{formatBRL(r.billsPaidCents)}</dd></div>
                    <div><dt className="text-xs text-stone-500">Boletos a pagar</dt><dd className="font-bold">{formatBRL(r.billsToPayCents)}</dd></div>
                  </dl>
                  <p className="mt-2 border-t border-stone-100 pt-2 text-xs text-stone-500">
                    Caixa no fim do mês: <b className="text-stone-800">{r.cashEndCents === null ? '—' : formatBRL(r.cashEndCents)}</b>
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
