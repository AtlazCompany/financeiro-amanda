import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { MessageCircle, Pencil, Plus, Trash2 } from 'lucide-react'
import { Badge, Button, Card, EmptyState, ErrorBox, Sheet, Spinner, useToast } from '../components/Ui'
import { Page, PageHeader } from '../components/Layout'
import { useData } from '../data/DataContext'
import { useLookups } from '../data/useLookups'
import { deleteClient } from '../data/actions'
import { formatBR, todayISO } from '../lib/dates'
import { clientSummaries, installmentStatus, saleStatus } from '../lib/finance'
import { whatsappDigits } from '../lib/labels'
import { formatBRL } from '../lib/money'

export default function ClientDetail() {
  const { id } = useParams()
  const { clients, sales, installments, loading, refresh } = useData()
  const { instBySale } = useLookups()
  const navigate = useNavigate()
  const toast = useToast()
  const today = todayISO()
  const [confirmDel, setConfirmDel] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const client = clients.find((c) => c.id === id)
  const mySales = useMemo(
    () => sales.filter((s) => s.client_id === id).sort((a, b) => (a.sale_date < b.sale_date ? 1 : -1)),
    [sales, id],
  )
  const sums = useMemo(() => (client ? clientSummaries([client], sales, installments, today).get(client.id) : undefined), [client, sales, installments, today])

  if (loading) return <Spinner />
  if (!client) {
    return (
      <>
        <PageHeader title="Cliente" back="/clientes" />
        <Page><EmptyState title="Cliente não encontrada" /></Page>
      </>
    )
  }
  const wa = whatsappDigits(client.whatsapp)

  const remove = async () => {
    setBusy(true)
    setErr(null)
    try {
      await deleteClient(client.id)
      await refresh()
      toast('Cliente excluída')
      navigate('/clientes', { replace: true })
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Não foi possível excluir.')
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader title={client.name} subtitle={client.whatsapp ?? 'Sem WhatsApp'} back="/clientes"
        right={<Link to={`/clientes/${client.id}/editar`} aria-label="Editar cliente" className="flex h-11 w-11 items-center justify-center rounded-full active:bg-white/15"><Pencil className="h-5 w-5" /></Link>} />
      <Page>
        <Card>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div><p className="text-xs text-stone-500">Comprou</p><p className="font-extrabold">{formatBRL(sums?.totalSoldCents ?? 0)}</p></div>
            <div><p className="text-xs text-brand-700">Pagou</p><p className="font-extrabold text-brand-700">{formatBRL(sums?.paidCents ?? 0)}</p></div>
            <div><p className="text-xs text-stone-500">Deve</p><p className={`font-extrabold ${(sums?.overdueCents ?? 0) > 0 ? 'text-red-600' : ''}`}>{formatBRL(sums?.owedCents ?? 0)}</p></div>
          </div>
          {(sums?.overdueCount ?? 0) > 0 && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-center text-sm font-semibold text-red-700">
              {sums?.overdueCount} parcela(s) atrasada(s): {formatBRL(sums?.overdueCents ?? 0)}
            </p>
          )}
          {client.notes && <p className="mt-3 text-sm text-stone-600">{client.notes}</p>}
        </Card>

        <div className="mt-3 grid grid-cols-2 gap-3">
          {wa ? (
            <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-4 font-semibold text-white active:opacity-80">
              <MessageCircle className="h-5 w-5" /> WhatsApp
            </a>
          ) : (
            <Button variant="secondary" disabled><MessageCircle className="h-5 w-5" /> Sem WhatsApp</Button>
          )}
          <Button onClick={() => navigate(`/vendas/nova?cliente=${client.id}`)}><Plus className="h-5 w-5" /> Nova venda</Button>
        </div>

        <h2 className="mb-2 mt-6 px-1 text-sm font-bold uppercase tracking-wide text-stone-500">Histórico de vendas</h2>
        {mySales.length === 0 ? (
          <EmptyState title="Nenhuma venda para esta cliente" />
        ) : (
          <div className="space-y-3">
            {mySales.map((s) => {
              const insts = instBySale.get(s.id) ?? []
              const st = saleStatus(insts, today)
              return (
                <Link key={s.id} to={`/vendas/${s.id}`} className="block">
                  <Card className="active:bg-stone-50">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-bold text-stone-900">{s.description}</p>
                        <p className="text-xs text-stone-500">{formatBR(s.sale_date)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-extrabold">{formatBRL(s.total_cents)}</p>
                        <Badge tone={st === 'paid' ? 'green' : st === 'overdue' ? 'red' : 'gray'}>{st === 'paid' ? 'Quitada' : st === 'overdue' ? 'Em atraso' : 'Em andamento'}</Badge>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {insts.map((i) => {
                        const is = installmentStatus(i, today)
                        return (
                          <span key={i.id} className={`rounded-lg px-2 py-1 text-xs font-semibold ${is === 'paid' ? 'bg-brand-100 text-brand-800' : is === 'overdue' ? 'bg-red-100 text-red-700' : 'bg-stone-200 text-stone-700'}`}>
                            {i.number}/{s.installments_count} · {formatBRL(i.amount_cents)}
                          </span>
                        )
                      })}
                    </div>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}

        <div className="mt-8">
          <Button full variant="ghost" className="text-red-600" onClick={() => { setErr(null); setConfirmDel(true) }}>
            <Trash2 className="h-5 w-5" /> Excluir cliente
          </Button>
        </div>
      </Page>

      <Sheet open={confirmDel} onClose={() => setConfirmDel(false)} title="Excluir cliente?">
        <div className="space-y-4">
          {mySales.length > 0 ? (
            <ErrorBox>Esta cliente tem vendas registradas e não pode ser excluída.</ErrorBox>
          ) : (
            <p className="text-stone-700">{client.name} será removida. Isso não pode ser desfeito.</p>
          )}
          {err && <ErrorBox>{err}</ErrorBox>}
          {mySales.length === 0 && <Button full variant="danger" loading={busy} onClick={remove}>Sim, excluir</Button>}
          <Button full variant="ghost" onClick={() => setConfirmDel(false)}>Cancelar</Button>
        </div>
      </Sheet>
    </>
  )
}
