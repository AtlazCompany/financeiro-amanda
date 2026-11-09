import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { Badge, Button, Card, EmptyState, ErrorBox, Spinner, inputCls, useToast } from '../components/Ui'
import { Page, PageHeader } from '../components/Layout'
import { PayDialog } from '../components/PayDialog'
import { useData } from '../data/DataContext'
import { useLookups } from '../data/useLookups'
import { setInstallmentPaid } from '../data/actions'
import { formatBR, todayISO } from '../lib/dates'
import { installmentStatus } from '../lib/finance'
import { dueText, installmentBadge } from '../lib/labels'
import { formatBRL } from '../lib/money'
import type { Installment } from '../lib/types'

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Registrar pagamento de cliente: parcelas em aberto, atrasadas primeiro. */
export default function Payments() {
  const { installments, loading, error, refresh } = useData()
  const { saleById, clientById } = useLookups()
  const toast = useToast()
  const today = todayISO()
  const [q, setQ] = useState('')
  const [paying, setPaying] = useState<Installment | null>(null)

  const list = useMemo(() => {
    const term = norm(q.trim())
    return installments
      .filter((i) => !i.paid_at)
      .filter((i) => {
        if (!term) return true
        const sale = saleById.get(i.sale_id)
        const name = sale ? clientById.get(sale.client_id)?.name ?? '' : ''
        return norm(name).includes(term) || norm(sale?.description ?? '').includes(term)
      })
      .sort((a, b) => (a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : 0))
  }, [installments, q, saleById, clientById])

  const payingSale = paying ? saleById.get(paying.sale_id) : undefined
  const payingClient = payingSale ? clientById.get(payingSale.client_id) : undefined

  return (
    <>
      <PageHeader title="Registrar pagamento" subtitle="Escolha a parcela que a cliente pagou" back="/">
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400" />
          <input type="search" className={`${inputCls} pl-11`} placeholder="Buscar cliente" value={q} onChange={(e) => setQ(e.target.value)} enterKeyHint="search" autoCapitalize="none" autoCorrect="off" aria-label="Buscar cliente" />
        </div>
      </PageHeader>
      <Page>
        {error && <ErrorBox>{error}</ErrorBox>}
        {loading ? <Spinner /> : list.length === 0 ? (
          <EmptyState title="Nenhuma parcela em aberto" text={q ? 'Tente outro nome.' : 'Tudo recebido por aqui!'} />
        ) : (
          <div className="space-y-3">
            {list.map((i) => {
              const sale = saleById.get(i.sale_id)
              const client = sale ? clientById.get(sale.client_id) : undefined
              const st = installmentStatus(i, today)
              const b = installmentBadge(st, null)
              return (
                <Card key={i.id} className={st === 'overdue' ? 'border-red-200 bg-red-50/60' : ''}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-base font-bold text-stone-900">{client?.name ?? 'Cliente'}</p>
                      <p className="truncate text-sm text-stone-600">{sale?.description} · Parcela {i.number}/{sale?.installments_count}</p>
                      <p className={`text-xs font-semibold ${st === 'overdue' ? 'text-red-600' : 'text-stone-500'}`}>{formatBR(i.due_date)} · {dueText(i.due_date, today)}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-lg font-extrabold">{formatBRL(i.amount_cents)}</p>
                      <Badge tone={b.tone}>{b.text}</Badge>
                    </div>
                  </div>
                  <Button full className="mt-3" onClick={() => setPaying(i)}>Marcar como pago</Button>
                </Card>
              )
            })}
          </div>
        )}
      </Page>

      <PayDialog
        open={paying !== null}
        onClose={() => setPaying(null)}
        kind="receber"
        title={paying ? `Parcela ${paying.number}/${payingSale?.installments_count ?? ''} · ${payingClient?.name ?? ''}` : ''}
        amountCents={paying?.amount_cents ?? 0}
        currentPaidAt={null}
        onSave={async (date) => {
          if (!paying) return
          await setInstallmentPaid(paying.id, date)
          await refresh()
          toast('Pagamento registrado!')
        }}
      />
    </>
  )
}
