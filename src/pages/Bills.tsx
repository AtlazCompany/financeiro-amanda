import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Pencil, Plus } from 'lucide-react'
import { Badge, Button, Card, EmptyState, ErrorBox, Spinner, useToast } from '../components/Ui'
import { Page, PageHeader } from '../components/Layout'
import { PayDialog } from '../components/PayDialog'
import { useData } from '../data/DataContext'
import { setBillPaid } from '../data/actions'
import { formatBR, todayISO } from '../lib/dates'
import { billStatus, projectBills } from '../lib/finance'
import { billBadge, dueText } from '../lib/labels'
import { formatBRL } from '../lib/money'
import type { Bill, BillStatus } from '../lib/types'

type Filter = 'all' | BillStatus

const accent: Record<BillStatus, string> = {
  paid: 'border-l-brand-500',
  overdue: 'border-l-red-500 bg-red-50/60',
  soon: 'border-l-amber-400 bg-amber-50/70',
  pending: 'border-l-stone-300',
}

export default function Bills() {
  const { bills, settings, installments, loading, error, refresh } = useData()
  const navigate = useNavigate()
  const toast = useToast()
  const today = todayISO()
  const [filter, setFilter] = useState<Filter>('all')
  const [paying, setPaying] = useState<Bill | null>(null)

  const projections = useMemo(
    () => new Map(projectBills({ settings, installments, bills }, today).map((p) => [p.bill.id, p.projected_cents])),
    [settings, installments, bills, today],
  )
  const withStatus = useMemo(
    () => bills.map((b) => ({ b, st: billStatus(b, today, settings.alert_days) })),
    [bills, today, settings.alert_days],
  )
  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: withStatus.length, paid: 0, overdue: 0, soon: 0, pending: 0 }
    for (const { st } of withStatus) c[st] += 1
    return c
  }, [withStatus])

  const list = useMemo(() => {
    const rows = withStatus.filter((x) => filter === 'all' || x.st === filter)
    // em aberto primeiro (por vencimento); pagos por ultimo, mais recentes antes
    return rows.sort((a, b) => {
      const ap = a.b.paid_at ? 1 : 0
      const bp = b.b.paid_at ? 1 : 0
      if (ap !== bp) return ap - bp
      if (ap === 0) return a.b.due_date < b.b.due_date ? -1 : 1
      return a.b.due_date < b.b.due_date ? 1 : -1
    })
  }, [withStatus, filter])

  const chips: { key: Filter; label: string }[] = [
    { key: 'all', label: 'Todos' }, { key: 'overdue', label: 'Atrasados' }, { key: 'soon', label: 'Vencendo' },
    { key: 'pending', label: 'Pendentes' }, { key: 'paid', label: 'Pagos' },
  ]

  return (
    <>
      <PageHeader title="Boletos" subtitle="Pedidos O Boticário"
        right={<Button variant="soft" className="min-h-11 px-4" onClick={() => navigate('/boletos/novo')}><Plus className="h-5 w-5" /> Novo</Button>}>
        <div className="mt-3 flex flex-wrap gap-2" role="tablist" aria-label="Filtrar boletos">
          {chips.map((c) => (
            <button
              key={c.key} type="button" role="tab" aria-selected={filter === c.key} onClick={() => setFilter(c.key)}
              className={`min-h-11 shrink-0 rounded-full px-3.5 text-sm font-bold ${filter === c.key ? 'bg-white text-brand-900' : 'bg-white/15 text-white'}`}
            >
              {c.label} {counts[c.key] > 0 && <span className="opacity-70">({counts[c.key]})</span>}
            </button>
          ))}
        </div>
      </PageHeader>
      <Page>
        {error && <ErrorBox>{error}</ErrorBox>}
        {loading ? <Spinner /> : list.length === 0 ? (
          <EmptyState
            title={bills.length === 0 ? 'Nenhum boleto cadastrado' : 'Nenhum boleto nesta lista'}
            text={bills.length === 0 ? 'Cadastre o boleto de cada pedido para acompanhar vencimentos.' : undefined}
            action={bills.length === 0 ? <Button onClick={() => navigate('/boletos/novo')}>Cadastrar boleto</Button> : undefined}
          />
        ) : (
          <div className="space-y-3">
            {list.map(({ b, st }) => {
              const badge = billBadge(st, b.paid_at)
              const proj = projections.get(b.id)
              return (
                <Card key={b.id} className={`border-l-4 ${accent[st]}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-base font-bold text-stone-900">Pedido {b.order_number}</p>
                      <p className="text-sm text-stone-600">Vence em {formatBR(b.due_date)}</p>
                      {!b.paid_at && <p className={`text-xs font-semibold ${st === 'overdue' ? 'text-red-600' : 'text-stone-500'}`}>{dueText(b.due_date, today)}</p>}
                      {b.order_date && <p className="text-xs text-stone-400">Pedido de {formatBR(b.order_date)}</p>}
                      {b.notes && <p className="mt-1 text-xs italic text-stone-500">{b.notes}</p>}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-lg font-extrabold text-stone-900">{formatBRL(b.amount_cents)}</p>
                      <Badge tone={badge.tone}>{badge.text}</Badge>
                    </div>
                  </div>
                  {proj !== undefined && proj < 0 && (
                    <p className="mt-2 rounded-lg bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-900">
                      Caixa previsto neste vencimento: {formatBRL(proj)} — pode faltar dinheiro.
                    </p>
                  )}
                  <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                    {b.paid_at ? (
                      <Button variant="secondary" onClick={() => setPaying(b)}>Corrigir pagamento</Button>
                    ) : (
                      <Button onClick={() => setPaying(b)}>Marcar boleto como pago</Button>
                    )}
                    <Link to={`/boletos/${b.id}/editar`} aria-label="Editar boleto" className="flex h-12 w-12 items-center justify-center rounded-2xl border border-stone-300 bg-white text-stone-700 active:bg-stone-100">
                      <Pencil className="h-5 w-5" />
                    </Link>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </Page>

      <PayDialog
        open={paying !== null}
        onClose={() => setPaying(null)}
        kind="pagar"
        title={paying ? `Boleto do pedido ${paying.order_number}` : ''}
        amountCents={paying?.amount_cents ?? 0}
        currentPaidAt={paying?.paid_at ?? null}
        onSave={async (date) => {
          if (!paying) return
          await setBillPaid(paying.id, date)
          await refresh()
          toast(date ? 'Boleto pago registrado!' : 'Pagamento do boleto desfeito')
        }}
      />
    </>
  )
}
