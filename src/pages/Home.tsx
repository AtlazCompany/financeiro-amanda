import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Plus, Settings, TrendingUp, Wallet } from 'lucide-react'
import { Badge, Button, Card, EmptyState, ErrorBox, SectionTitle, Spinner } from '../components/Ui'
import { Page, PageHeader } from '../components/Layout'
import { useData } from '../data/DataContext'
import { useLookups } from '../data/useLookups'
import { MONTHS, formatBR, parseISO, todayISO } from '../lib/dates'
import { billStatus, firstShortfall, projectBills, summarizeMonth } from '../lib/finance'
import { billBadge, dueText } from '../lib/labels'
import { formatBRL } from '../lib/money'
import { formatPct, profitSummary } from '../lib/profit'

export default function Home() {
  const { sales, installments, bills, settings, loading, error } = useData()
  const { clientById, saleById } = useLookups()
  const navigate = useNavigate()
  const today = todayISO()
  const t = parseISO(today)
  const [ym, setYm] = useState({ y: t.y, m: t.m })

  const data = useMemo(() => ({ settings, sales, installments, bills }), [settings, sales, installments, bills])
  const s = useMemo(() => summarizeMonth(data, today, ym.y, ym.m), [data, today, ym])
  const p = useMemo(() => profitSummary(sales, ym.y, ym.m), [sales, ym])
  const projections = useMemo(() => projectBills(data, today), [data, today])
  const shortfall = firstShortfall(projections)

  const overdueBills = bills.filter((b) => !b.paid_at && b.due_date < today)
  const overdueBillsCents = overdueBills.reduce((a, b) => a + b.amount_cents, 0)
  const upcomingInst = installments
    .filter((i) => !i.paid_at)
    .sort((a, b) => (a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : 0))
    .slice(0, 5)

  const shift = (d: number) => {
    const idx = ym.y * 12 + (ym.m - 1) + d
    setYm({ y: Math.floor(idx / 12), m: (idx % 12) + 1 })
  }
  const isCurrent = ym.y === t.y && ym.m === t.m
  const profitTone = p.grossProfitCents < 0 ? 'text-red-700' : 'text-emerald-700'

  return (
    <>
      <PageHeader
        large
        title="Olá, Amanda!"
        subtitle="Seu financeiro de hoje"
        right={
          <Link to="/ajustes" aria-label="Ajustes" className="flex h-11 w-11 items-center justify-center rounded-full text-brand-800 active:bg-white/70">
            <Settings className="h-6 w-6" strokeWidth={1.7} />
          </Link>
        }
      >
        <div className="mt-3 flex items-center justify-between rounded-2xl bg-white/80 px-1 shadow-card">
          <button type="button" aria-label="Mês anterior" onClick={() => shift(-1)} className="flex h-12 w-12 items-center justify-center rounded-full text-brand-800 active:bg-brand-100">
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button type="button" onClick={() => setYm({ y: t.y, m: t.m })} className="flex min-h-12 flex-col items-center justify-center px-3" aria-label="Voltar para o mês atual">
            <span className="font-display text-xl text-brand-800">{MONTHS[ym.m - 1]} {ym.y}</span>
            {!isCurrent && <span className="text-xs text-brand-600">toque para voltar a hoje</span>}
          </button>
          <button type="button" aria-label="Próximo mês" onClick={() => shift(1)} className="flex h-12 w-12 items-center justify-center rounded-full text-brand-800 active:bg-brand-100">
            <ChevronRight className="h-6 w-6" />
          </button>
        </div>
      </PageHeader>

      <Page>
        {error && <ErrorBox>{error}</ErrorBox>}
        {loading ? (
          <Spinner />
        ) : (
          <div className="space-y-3">
            {/* DINHEIRO DISPONIVEL (caixa) */}
            <Card className="relative overflow-hidden border-0 bg-brand-800 text-white">
              <div aria-hidden className="absolute -right-8 -top-10 h-36 w-36 rounded-full bg-brand-500/25" />
              <div aria-hidden className="absolute -bottom-12 right-10 h-28 w-28 rounded-full bg-brand-300/15" />
              <div className="relative">
                <div className="flex items-center gap-2 text-sm font-semibold text-brand-200">
                  <Wallet className="h-4 w-4" /> Dinheiro disponível
                </div>
                <p className="tabular mt-1 text-4xl font-bold tracking-tight">{formatBRL(s.availableCents)}</p>
                <p className="mt-1 text-xs text-brand-200">Só o que já entrou (recebimentos com data) menos o que já foi pago, até o fim de {MONTHS[ym.m - 1]}.</p>
                <div className="mt-3 flex items-center justify-between rounded-2xl bg-white/10 px-3 py-2.5 text-sm">
                  <span className="text-brand-100">Projetado até o fim do mês</span>
                  <span className={`tabular font-bold ${s.projectedCents < 0 ? 'text-amber-300' : 'text-white'}`}>{formatBRL(s.projectedCents)}</span>
                </div>
                <p className="mt-1.5 text-[11px] text-brand-200">Projeção = saldo + parcelas a vencer − boletos em aberto. Parcelas atrasadas não entram.</p>
              </div>
            </Card>

            {shortfall ? (
              <div role="alert" className="flex gap-3 rounded-3xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
                <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-amber-700" />
                <div>
                  <p className="font-bold">Atenção: pode faltar dinheiro</p>
                  <p className="text-sm">
                    O boleto {shortfall.bill.order_number} vence em {formatBR(shortfall.bill.due_date)} e, mesmo contando os recebimentos previstos, faltam{' '}
                    <b>{formatBRL(shortfall.shortfall_cents)}</b>.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
                <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-700" />
                <p className="text-sm font-semibold">{projections.length === 0 ? 'Nenhum boleto em aberto.' : 'O caixa previsto cobre os próximos boletos.'}</p>
              </div>
            )}

            {/* LUCRO DAS VENDAS (resultado comercial, nao e caixa) */}
            <SectionTitle>Lucro das vendas</SectionTitle>
            <Card>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-brand-800">
                    <TrendingUp className="h-4 w-4" /> Lucro bruto do mês
                  </div>
                  <p className={`tabular mt-1 text-3xl font-bold tracking-tight ${p.costedRevenueCents > 0 ? profitTone : 'text-stone-400'}`}>
                    {p.costedRevenueCents > 0 ? formatBRL(p.grossProfitCents) : '—'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold text-stone-600">Margem bruta</p>
                  <p className={`tabular text-xl font-bold ${p.marginPct !== null && p.marginPct < 0 ? 'text-red-700' : 'text-brand-800'}`}>{formatPct(p.marginPct)}</p>
                </div>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-brand-100 pt-3 text-sm">
                <div>
                  <dt className="text-xs font-semibold text-stone-600">Total vendido</dt>
                  <dd className="tabular text-lg font-bold">{formatBRL(p.soldCents)}</dd>
                  <dd className="text-xs text-stone-600">{p.salesCount} venda(s)</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-stone-600">Custo dos produtos vendidos</dt>
                  <dd className="tabular text-lg font-bold">{formatBRL(p.costCents)}</dd>
                </div>
              </dl>
              <p className="mt-3 text-[11px] leading-snug text-stone-600">
                Resultado comercial (preço − custo) das vendas feitas no mês, recebidas ou não. É lucro <b>bruto</b>, antes de outras despesas, e não é o dinheiro em caixa.
                {p.missingCostCount > 0 && <> {p.missingCostCount} venda(s) sem custo informado ficam fora desta conta.</>}
              </p>
            </Card>

            {/* RECEBER / PAGAR */}
            <SectionTitle>Receber e pagar</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <Card>
                <p className="text-xs font-semibold text-stone-600">Valores a receber</p>
                <p className="tabular mt-1 text-xl font-bold text-ink">{formatBRL(s.totalToReceiveCents)}</p>
                {s.overdueReceivableCents > 0 && <p className="mt-1 text-xs font-semibold text-red-700">{formatBRL(s.overdueReceivableCents)} em atraso</p>}
              </Card>
              <Card className="border-emerald-200 bg-emerald-50/70">
                <p className="text-xs font-semibold text-emerald-800">Recebido no mês</p>
                <p className="tabular mt-1 text-xl font-bold text-emerald-800">{formatBRL(s.receivedCents)}</p>
              </Card>
              <Card>
                <p className="text-xs font-semibold text-stone-600">Boletos a pagar</p>
                <p className="tabular mt-1 text-xl font-bold text-ink">{formatBRL(s.openBillsUntilEndCents)}</p>
                <p className="mt-1 text-xs text-stone-600">até o fim do mês</p>
              </Card>
              <Card className={overdueBills.length ? 'border-red-200 bg-red-50' : ''}>
                <p className={`text-xs font-semibold ${overdueBills.length ? 'text-red-800' : 'text-stone-600'}`}>Boletos atrasados</p>
                <p className={`tabular mt-1 text-xl font-bold ${overdueBills.length ? 'text-red-800' : 'text-ink'}`}>{formatBRL(overdueBillsCents)}</p>
                <p className="mt-1 text-xs text-stone-600">{overdueBills.length} boleto(s)</p>
              </Card>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <Button full onClick={() => navigate('/vendas/nova')}>
                <Plus className="h-5 w-5" /> Nova venda
              </Button>
              <Button full variant="secondary" onClick={() => navigate('/pagamentos')}>Registrar pagamento</Button>
            </div>

            <SectionTitle action={<Link to="/boletos" className="flex min-h-11 items-center text-sm font-semibold text-brand-600">Ver todos</Link>}>
              Próximos vencimentos
            </SectionTitle>
            {projections.length === 0 ? (
              <EmptyState title="Sem boletos em aberto" text="Cadastre os boletos do Boticário na aba Boletos." />
            ) : (
              <div className="space-y-2">
                {projections.slice(0, 5).map(({ bill, projected_cents }) => {
                  const b = billBadge(billStatus(bill, today, settings.alert_days), bill.paid_at)
                  return (
                    <Link key={bill.id} to="/boletos" className="block">
                      <Card className="flex items-center justify-between gap-3 transition active:bg-brand-50">
                        <div className="min-w-0">
                          <p className="truncate font-bold text-ink">Boleto {bill.order_number}</p>
                          <p className="text-sm text-stone-600">{formatBR(bill.due_date)} · {dueText(bill.due_date, today)}</p>
                          {projected_cents < 0 && <p className="mt-0.5 text-xs font-semibold text-amber-800">Caixa previsto: {formatBRL(projected_cents)}</p>}
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="tabular font-bold text-ink">{formatBRL(bill.amount_cents)}</p>
                          <Badge tone={b.tone}>{b.text}</Badge>
                        </div>
                      </Card>
                    </Link>
                  )
                })}
              </div>
            )}

            <SectionTitle action={<Link to="/pagamentos" className="flex min-h-11 items-center text-sm font-semibold text-brand-600">Registrar</Link>}>
              A receber em breve
            </SectionTitle>
            {upcomingInst.length === 0 ? (
              <EmptyState title="Nada a receber" text="Registre uma venda para acompanhar as parcelas." />
            ) : (
              <div className="space-y-2">
                {upcomingInst.map((i) => {
                  const sale = saleById.get(i.sale_id)
                  const client = sale ? clientById.get(sale.client_id) : undefined
                  const late = i.due_date < today
                  return (
                    <Link key={i.id} to={`/vendas/${i.sale_id}`} className="block">
                      <Card className="flex items-center justify-between gap-3 transition active:bg-brand-50">
                        <div className="min-w-0">
                          <p className="truncate font-bold text-ink">{client?.name ?? 'Cliente'}</p>
                          <p className="truncate text-sm text-stone-600">Parcela {i.number}/{sale?.installments_count} · {sale?.description}</p>
                          <p className={`text-xs font-semibold ${late ? 'text-red-700' : 'text-stone-600'}`}>{late ? 'Em atraso · ' : ''}{formatBR(i.due_date)} · {dueText(i.due_date, today)}</p>
                        </div>
                        <p className="tabular shrink-0 font-bold text-brand-800">{formatBRL(i.amount_cents)}</p>
                      </Card>
                    </Link>
                  )
                })}
              </div>
            )}

            <Link to="/controle" className="mt-4 block">
              <Card className="flex items-center gap-3 transition active:bg-brand-50">
                <CalendarDays className="h-6 w-6 text-brand-600" strokeWidth={1.7} />
                <div className="flex-1">
                  <p className="font-bold text-ink">Controle mensal</p>
                  <p className="text-sm text-stone-600">Recebido, pago e lucro mês a mês</p>
                </div>
                <ChevronRight className="h-5 w-5 text-stone-400" />
              </Card>
            </Link>
          </div>
        )}
      </Page>
    </>
  )
}
