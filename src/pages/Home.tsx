import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Plus, Settings, Wallet } from 'lucide-react'
import { Badge, Button, Card, EmptyState, ErrorBox, SectionTitle, Spinner } from '../components/Ui'
import { Page, PageHeader } from '../components/Layout'
import { useData } from '../data/DataContext'
import { useLookups } from '../data/useLookups'
import { MONTHS, formatBR, parseISO, todayISO } from '../lib/dates'
import { billStatus, firstShortfall, projectBills, summarizeMonth } from '../lib/finance'
import { billBadge, dueText } from '../lib/labels'
import { formatBRL } from '../lib/money'

export default function Home() {
  const { sales, installments, bills, settings, loading, error } = useData()
  const { clientById, saleById } = useLookups()
  const navigate = useNavigate()
  const today = todayISO()
  const t = parseISO(today)
  const [ym, setYm] = useState({ y: t.y, m: t.m })

  const data = useMemo(() => ({ settings, sales, installments, bills }), [settings, sales, installments, bills])
  const s = useMemo(() => summarizeMonth(data, today, ym.y, ym.m), [data, today, ym])
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

  return (
    <>
      <PageHeader
        title="Olá, Amanda!"
        subtitle="Seu financeiro de hoje"
        right={
          <Link to="/ajustes" aria-label="Ajustes" className="flex h-11 w-11 items-center justify-center rounded-full active:bg-white/15">
            <Settings className="h-6 w-6" />
          </Link>
        }
      >
        <div className="mt-3 flex items-center justify-between rounded-2xl bg-white/10 px-1">
          <button type="button" aria-label="Mês anterior" onClick={() => shift(-1)} className="flex h-12 w-12 items-center justify-center rounded-full active:bg-white/15">
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            type="button"
            onClick={() => setYm({ y: t.y, m: t.m })}
            className="flex min-h-12 flex-col items-center justify-center px-3"
            aria-label="Voltar para o mês atual"
          >
            <span className="text-lg font-bold">{MONTHS[ym.m - 1]} {ym.y}</span>
            {!isCurrent && <span className="text-xs text-brand-100">toque para voltar a hoje</span>}
          </button>
          <button type="button" aria-label="Próximo mês" onClick={() => shift(1)} className="flex h-12 w-12 items-center justify-center rounded-full active:bg-white/15">
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
            <Card className="bg-brand-900 text-white">
              <div className="flex items-center gap-2 text-sm font-semibold text-brand-100">
                <Wallet className="h-4 w-4" /> Saldo disponível
              </div>
              <p className="mt-1 text-4xl font-extrabold tracking-tight">{formatBRL(s.availableCents)}</p>
              <p className="mt-1 text-xs text-brand-100/90">Só dinheiro que já entrou (pagamentos com data), até o fim de {MONTHS[ym.m - 1]}.</p>
              <div className="mt-3 flex items-center justify-between rounded-xl bg-white/10 px-3 py-2 text-sm">
                <span className="text-brand-100">Projetado até o fim do mês</span>
                <span className={`font-bold ${s.projectedCents < 0 ? 'text-amber-300' : 'text-white'}`}>{formatBRL(s.projectedCents)}</span>
              </div>
              <p className="mt-1.5 text-[11px] text-brand-100/80">Projeção = saldo + parcelas a vencer − boletos em aberto. Parcelas atrasadas não entram.</p>
            </Card>

            {shortfall ? (
              <div role="alert" className="flex gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900">
                <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-amber-600" />
                <div>
                  <p className="font-bold">Atenção: pode faltar dinheiro</p>
                  <p className="text-sm">
                    O boleto {shortfall.bill.order_number} vence em {formatBR(shortfall.bill.due_date)} e, mesmo contando os recebimentos previstos, faltam{' '}
                    <b>{formatBRL(shortfall.shortfall_cents)}</b>.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-4 text-brand-900">
                <CheckCircle2 className="h-6 w-6 shrink-0 text-brand-700" />
                <p className="text-sm font-semibold">
                  {projections.length === 0 ? 'Nenhum boleto em aberto.' : 'O caixa previsto cobre os próximos boletos.'}
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Card>
                <p className="text-xs font-semibold text-stone-500">Total a receber</p>
                <p className="mt-1 text-xl font-extrabold text-stone-900">{formatBRL(s.totalToReceiveCents)}</p>
                {s.overdueReceivableCents > 0 && <p className="mt-1 text-xs font-semibold text-red-600">{formatBRL(s.overdueReceivableCents)} em atraso</p>}
              </Card>
              <Card className="bg-brand-50">
                <p className="text-xs font-semibold text-brand-800">Recebido no mês</p>
                <p className="mt-1 text-xl font-extrabold text-brand-800">{formatBRL(s.receivedCents)}</p>
                <p className="mt-1 text-xs text-stone-500">Vendido: {formatBRL(s.soldCents)}</p>
              </Card>
              <Card>
                <p className="text-xs font-semibold text-stone-500">Boletos a pagar</p>
                <p className="mt-1 text-xl font-extrabold text-stone-900">{formatBRL(s.openBillsUntilEndCents)}</p>
                <p className="mt-1 text-xs text-stone-500">até o fim do mês</p>
              </Card>
              <Card className={overdueBills.length ? 'border-red-200 bg-red-50' : ''}>
                <p className={`text-xs font-semibold ${overdueBills.length ? 'text-red-700' : 'text-stone-500'}`}>Boletos atrasados</p>
                <p className={`mt-1 text-xl font-extrabold ${overdueBills.length ? 'text-red-700' : 'text-stone-900'}`}>{formatBRL(overdueBillsCents)}</p>
                <p className="mt-1 text-xs text-stone-500">{overdueBills.length} boleto(s)</p>
              </Card>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <Button full onClick={() => navigate('/vendas/nova')}>
                <Plus className="h-5 w-5" /> Nova venda
              </Button>
              <Button full variant="secondary" onClick={() => navigate('/pagamentos')}>Registrar pagamento</Button>
            </div>

            <SectionTitle action={<Link to="/boletos" className="flex min-h-11 items-center text-sm font-semibold text-brand-800">Ver todos</Link>}>
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
                      <Card className="flex items-center justify-between gap-3 active:bg-stone-50">
                        <div className="min-w-0">
                          <p className="truncate font-bold text-stone-900">Boleto {bill.order_number}</p>
                          <p className="text-sm text-stone-500">{formatBR(bill.due_date)} · {dueText(bill.due_date, today)}</p>
                          {projected_cents < 0 && <p className="mt-0.5 text-xs font-semibold text-amber-700">Caixa previsto: {formatBRL(projected_cents)}</p>}
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="font-extrabold text-stone-900">{formatBRL(bill.amount_cents)}</p>
                          <Badge tone={b.tone}>{b.text}</Badge>
                        </div>
                      </Card>
                    </Link>
                  )
                })}
              </div>
            )}

            <SectionTitle action={<Link to="/pagamentos" className="flex min-h-11 items-center text-sm font-semibold text-brand-800">Registrar</Link>}>
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
                      <Card className="flex items-center justify-between gap-3 active:bg-stone-50">
                        <div className="min-w-0">
                          <p className="truncate font-bold text-stone-900">{client?.name ?? 'Cliente'}</p>
                          <p className="truncate text-sm text-stone-500">Parcela {i.number}/{sale?.installments_count} · {sale?.description}</p>
                          <p className={`text-xs font-semibold ${late ? 'text-red-600' : 'text-stone-500'}`}>{formatBR(i.due_date)} · {dueText(i.due_date, today)}</p>
                        </div>
                        <p className="shrink-0 font-extrabold text-brand-800">{formatBRL(i.amount_cents)}</p>
                      </Card>
                    </Link>
                  )
                })}
              </div>
            )}

            <Link to="/controle" className="mt-4 block">
              <Card className="flex items-center gap-3 active:bg-stone-50">
                <CalendarDays className="h-6 w-6 text-brand-800" />
                <div className="flex-1">
                  <p className="font-bold text-stone-900">Controle mensal</p>
                  <p className="text-sm text-stone-500">Os 12 meses do ano, recebido e pago</p>
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
