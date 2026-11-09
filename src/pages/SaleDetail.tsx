import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Pencil, Trash2, TrendingUp } from 'lucide-react'
import { Badge, Button, Card, EmptyState, ErrorBox, Field, MoneyInput, Sheet, Spinner, Stepper, useToast } from '../components/Ui'
import { Page, PageHeader } from '../components/Layout'
import { PayDialog } from '../components/PayDialog'
import { useData } from '../data/DataContext'
import { useLookups } from '../data/useLookups'
import { deleteSale, setInstallmentPaid, updateSaleCost } from '../data/actions'
import { formatBR, todayISO } from '../lib/dates'
import { installmentStatus } from '../lib/finance'
import { dueText, installmentBadge } from '../lib/labels'
import { formatBRL } from '../lib/money'
import { formatPct, saleProfit } from '../lib/profit'
import type { Installment, Sale } from '../lib/types'

export default function SaleDetail() {
  const { id } = useParams()
  const { loading, refresh } = useData()
  const { saleById, clientById, instBySale } = useLookups()
  const navigate = useNavigate()
  const toast = useToast()
  const today = todayISO()
  const [paying, setPaying] = useState<Installment | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editCost, setEditCost] = useState(false)
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
  const prof = saleProfit(sale)
  const tone = prof.profitCents === null ? 'text-stone-600' : prof.isLoss ? 'text-red-700' : 'text-emerald-700'

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
            <div><p className="text-xs text-stone-600">Total</p><p className="tabular font-bold text-ink">{formatBRL(sale.total_cents)}</p></div>
            <div><p className="text-xs text-emerald-700">Recebido</p><p className="tabular font-bold text-emerald-700">{formatBRL(received)}</p></div>
            <div><p className="text-xs text-stone-600">Falta</p><p className="tabular font-bold text-ink">{formatBRL(sale.total_cents - received)}</p></div>
          </div>
          <p className="mt-3 text-center text-xs text-stone-600">Venda de {formatBR(sale.sale_date)}</p>
          {client && <div className="mt-2 flex justify-center"><Link to={`/clientes/${client.id}`} className="flex min-h-11 items-center text-sm font-semibold text-brand-600">Ver cliente</Link></div>}
        </Card>

        <h2 className="mb-2 mt-6 flex items-center gap-2 px-1 text-xl text-brand-800"><TrendingUp className="h-5 w-5" /> Lucro da venda</h2>
        <Card className="bg-brand-100/60">
          {prof.costKnown ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-brand-800">Lucro bruto</p>
                  <p className={`tabular text-3xl font-bold ${tone}`}>{formatBRL(prof.profitCents ?? 0)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold text-brand-800">Margem</p>
                  <p className={`tabular text-2xl font-bold ${tone}`}>{formatPct(prof.marginPct)}</p>
                </div>
              </div>
              {prof.isLoss && <p className="mt-2 rounded-2xl bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-950">Esta venda deu prejuízo.</p>}
            </>
          ) : (
            <div>
              <Badge tone="gray">Custo não informado</Badge>
              <p className="mt-2 text-sm text-stone-700">Sem o custo, não dá para calcular o lucro desta venda. Ela fica fora do lucro do mês.</p>
            </div>
          )}
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-brand-200 pt-3 text-sm">
            <div><dt className="text-xs text-stone-600">Quantidade</dt><dd className="tabular font-bold">{sale.quantity}</dd></div>
            <div><dt className="text-xs text-stone-600">Preço unitário</dt><dd className="tabular font-bold">{sale.unit_price_cents === null ? 'Não registrado' : formatBRL(sale.unit_price_cents)}</dd></div>
            {sale.discount_cents > 0 && <div><dt className="text-xs text-stone-600">Desconto</dt><dd className="tabular font-bold">{formatBRL(sale.discount_cents)}</dd></div>}
            <div><dt className="text-xs text-stone-600">Total da venda</dt><dd className="tabular font-bold">{formatBRL(sale.total_cents)}</dd></div>
            <div><dt className="text-xs text-stone-600">Custo unitário</dt><dd className="tabular font-bold">{sale.unit_cost_cents === null ? 'Custo não informado' : formatBRL(sale.unit_cost_cents)}</dd></div>
            <div><dt className="text-xs text-stone-600">Custo total</dt><dd className="tabular font-bold">{prof.costCents === null ? '—' : formatBRL(prof.costCents)}</dd></div>
          </dl>
          <Button full variant="secondary" className="mt-3" onClick={() => setEditCost(true)}>
            <Pencil className="h-4 w-4" /> {prof.costKnown ? 'Editar custo' : 'Informar custo'}
          </Button>
        </Card>

        <h2 className="mb-2 mt-7 px-1 text-xl text-brand-800">Parcelas</h2>
        <div className="space-y-3">
          {insts.map((i) => {
            const st = installmentStatus(i, today)
            const b = installmentBadge(st, i.paid_at)
            return (
              <Card key={i.id} className={st === 'overdue' ? 'border-red-200 bg-red-50/60' : st === 'paid' ? 'border-emerald-200 bg-emerald-50/50' : ''}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-ink">Parcela {i.number}/{sale.installments_count}</p>
                    <p className="text-sm text-stone-600">Vence em {formatBR(i.due_date)}</p>
                    {!i.paid_at && <p className={`text-xs font-semibold ${st === 'overdue' ? 'text-red-700' : 'text-stone-600'}`}>{dueText(i.due_date, today)}</p>}
                  </div>
                  <div className="text-right">
                    <p className="tabular text-lg font-bold text-ink">{formatBRL(i.amount_cents)}</p>
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
          <Button full variant="ghost" className="text-red-700" onClick={() => { setDelErr(null); setConfirmDelete(true) }}>
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

      <CostSheet key={`${sale.unit_cost_cents}-${sale.quantity}`} open={editCost} onClose={() => setEditCost(false)} sale={sale} onSaved={async () => { await refresh(); toast('Custo atualizado') }} />

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

/** Corrige o custo de uma venda (principalmente das antigas, sem custo). O total e as parcelas nao mudam. */
function CostSheet({ open, onClose, sale, onSaved }: { open: boolean; onClose: () => void; sale: Sale; onSaved: () => Promise<void> }) {
  const [cost, setCost] = useState(sale.unit_cost_cents ?? 0)
  const [qty, setQty] = useState(sale.quantity)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const canEditQty = sale.unit_price_cents === null // venda com preco unitario tem total = qtd x preco: nao muda a quantidade
  const preview = saleProfit({ quantity: qty, unit_cost_cents: cost > 0 ? cost : null, total_cents: sale.total_cents })

  const save = async (clear: boolean) => {
    setBusy(true)
    setErr(null)
    try {
      await updateSaleCost(sale.id, { unit_cost_cents: clear || cost <= 0 ? null : cost, ...(canEditQty ? { quantity: qty } : {}) })
      await onSaved()
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Não foi possível salvar.')
    }
    setBusy(false)
  }

  return (
    <Sheet open={open} onClose={onClose} title={sale.unit_cost_cents === null ? 'Informar custo' : 'Editar custo'}>
      <div className="space-y-4">
        <p className="text-sm text-stone-700">Total da venda: <b className="tabular">{formatBRL(sale.total_cents)}</b>. O total e as parcelas não mudam.</p>
        {canEditQty && (
          <Field label="Quantidade" htmlFor="cq"><Stepper id="cq" value={qty} onChange={setQty} /></Field>
        )}
        <Field label="Custo unitário" htmlFor="cc" hint="Quanto você pagou por unidade">
          <MoneyInput id="cc" value={cost} onChange={setCost} />
        </Field>
        <div className="rounded-2xl bg-brand-100/60 p-3 text-sm">
          {preview.costKnown ? (
            <p>Lucro bruto: <b className={`tabular ${preview.isLoss ? 'text-red-700' : 'text-emerald-700'}`}>{formatBRL(preview.profitCents ?? 0)}</b> · margem <b className="tabular">{formatPct(preview.marginPct)}</b></p>
          ) : (
            <p className="text-stone-600">Sem custo informado, o lucro não é calculado.</p>
          )}
        </div>
        {err && <ErrorBox>{err}</ErrorBox>}
        <Button full loading={busy} onClick={() => save(false)}>Salvar custo</Button>
        {sale.unit_cost_cents !== null && <Button full variant="ghost" onClick={() => save(true)}>Remover custo (não informado)</Button>}
        <Button full variant="ghost" onClick={onClose}>Cancelar</Button>
      </div>
    </Sheet>
  )
}
