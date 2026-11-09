import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import { Badge, Button, Card, EmptyState, ErrorBox, Sheet, Spinner, useToast } from '../components/Ui'
import { Page, PageHeader } from '../components/Layout'
import { PayDialog } from '../components/PayDialog'
import { useData } from '../data/DataContext'
import { useLookups } from '../data/useLookups'
import { deleteSale, setInstallmentPaid } from '../data/actions'
import { formatBR, todayISO } from '../lib/dates'
import { installmentStatus } from '../lib/finance'
import { dueText, installmentBadge } from '../lib/labels'
import { formatBRL } from '../lib/money'
import type { Installment } from '../lib/types'

export default function SaleDetail() {
  const { id } = useParams()
  const { loading, refresh } = useData()
  const { saleById, clientById, instBySale } = useLookups()
  const navigate = useNavigate()
  const toast = useToast()
  const today = todayISO()
  const [paying, setPaying] = useState<Installment | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [delErr, setDelErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const sale = id ? saleById.get(id) : undefined
  if (loading) return <Spinner />
  if (!sale) {
    return (
      <>
        <PageHeader title="Venda" back="/vendas" />
        <Page><EmptyState title="Venda não encontrada" /></Page>
      </>
    )
  }
  const client = clientById.get(sale.client_id)
  const insts = instBySale.get(sale.id) ?? []
  const received = insts.filter((i) => i.paid_at).reduce((a, i) => a + i.amount_cents, 0)
  const anyPaid = insts.some((i) => i.paid_at)

  const onDelete = async () => {
    setBusy(true)
    setDelErr(null)
    try {
      await deleteSale(sale.id)
      await refresh()
      toast('Venda excluída')
      navigate('/vendas', { replace: true })
    } catch (e) {
      setDelErr(e instanceof Error ? e.message : 'Não foi possível excluir.')
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader title={client?.name ?? 'Venda'} subtitle={sale.description} back="/vendas" />
      <Page>
        <Card>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div><p className="text-xs text-stone-500">Total</p><p className="font-extrabold text-stone-900">{formatBRL(sale.total_cents)}</p></div>
            <div><p className="text-xs text-brand-700">Recebido</p><p className="font-extrabold text-brand-700">{formatBRL(received)}</p></div>
            <div><p className="text-xs text-stone-500">Falta</p><p className="font-extrabold text-stone-900">{formatBRL(sale.total_cents - received)}</p></div>
          </div>
          <p className="mt-3 text-center text-xs text-stone-500">Venda de {formatBR(sale.sale_date)}</p>
          {client && <div className="mt-3 flex justify-center"><Link to={`/clientes/${client.id}`} className="flex min-h-11 items-center text-sm font-semibold text-brand-800">Ver cliente</Link></div>}
        </Card>

        <h2 className="mb-2 mt-6 px-1 text-sm font-bold uppercase tracking-wide text-stone-500">Parcelas</h2>
        <div className="space-y-3">
          {insts.map((i) => {
            const st = installmentStatus(i, today)
            const b = installmentBadge(st, i.paid_at)
            return (
              <Card key={i.id} className={st === 'overdue' ? 'border-red-200 bg-red-50/60' : st === 'paid' ? 'bg-brand-50/60' : ''}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-stone-900">Parcela {i.number}/{sale.installments_count}</p>
                    <p className="text-sm text-stone-600">Vence em {formatBR(i.due_date)}</p>
                    {!i.paid_at && <p className={`text-xs font-semibold ${st === 'overdue' ? 'text-red-600' : 'text-stone-500'}`}>{dueText(i.due_date, today)}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-extrabold text-stone-900">{formatBRL(i.amount_cents)}</p>
                    <Badge tone={b.tone}>{b.text}</Badge>
                  </div>
                </div>
                <div className="mt-3">
                  {i.paid_at ? (
                    <Button full variant="secondary" onClick={() => setPaying(i)}>Corrigir pagamento</Button>
                  ) : (
                    <Button full onClick={() => setPaying(i)}>Marcar como pago</Button>
                  )}
                </div>
              </Card>
            )
          })}
        </div>

        <div className="mt-8">
          <Button full variant="ghost" className="text-red-600" onClick={() => { setDelErr(null); setConfirmDelete(true) }}>
            <Trash2 className="h-5 w-5" /> Excluir esta venda
          </Button>
        </div>
      </Page>

      <PayDialog
        open={paying !== null}
        onClose={() => setPaying(null)}
        kind="receber"
        title={paying ? `Parcela ${paying.number}/${sale.installments_count} · ${client?.name ?? ''}` : ''}
        amountCents={paying?.amount_cents ?? 0}
        currentPaidAt={paying?.paid_at ?? null}
        onSave={async (date) => {
          if (!paying) return
          await setInstallmentPaid(paying.id, date)
          await refresh()
          toast(date ? 'Pagamento registrado!' : 'Pagamento desfeito')
        }}
      />

      <Sheet open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Excluir venda?">
        <div className="space-y-4">
          {anyPaid ? (
            <ErrorBox>Esta venda tem parcelas pagas. Desfaça os pagamentos (Corrigir pagamento) antes de excluir.</ErrorBox>
          ) : (
            <p className="text-stone-700">A venda e suas parcelas serão removidas. Isso não pode ser desfeito.</p>
          )}
          {delErr && <ErrorBox>{delErr}</ErrorBox>}
          {!anyPaid && <Button full variant="danger" loading={busy} onClick={onDelete}>Sim, excluir venda</Button>}
          <Button full variant="ghost" onClick={() => setConfirmDelete(false)}>Cancelar</Button>
        </div>
      </Sheet>
    </>
  )
}
