import { useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, ErrorBox, Field, MoneyInput, Sheet, Spinner, inputCls, useToast } from '../components/Ui'
import { Page, PageHeader } from '../components/Layout'
import { useData } from '../data/DataContext'
import { addBill, deleteBill, updateBill } from '../data/actions'
import { isValidISO, todayISO } from '../lib/dates'

export default function BillForm() {
  const { id } = useParams()
  const { bills, loading, refresh } = useData()
  const navigate = useNavigate()
  const toast = useToast()
  const editing = id ? bills.find((b) => b.id === id) : undefined
  if (id && loading) return <Spinner />
  return <Inner key={editing?.id ?? 'new'} editing={editing} refresh={refresh} navigate={navigate} toast={toast} />
}

function Inner({ editing, refresh, navigate, toast }: {
  editing: ReturnType<typeof useData>['bills'][number] | undefined
  refresh: () => Promise<void>
  navigate: ReturnType<typeof useNavigate>
  toast: ReturnType<typeof useToast>
}) {
  const today = todayISO()
  const [order, setOrder] = useState(editing?.order_number ?? '')
  const [orderDate, setOrderDate] = useState(editing?.order_date ?? today)
  const [amount, setAmount] = useState(editing?.amount_cents ?? 0)
  const [due, setDue] = useState(editing?.due_date ?? today)
  const [notes, setNotes] = useState(editing?.notes ?? '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [confirmDel, setConfirmDel] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setErr(null)
    if (!order.trim()) return setErr('Digite o número do pedido.')
    if (amount <= 0) return setErr('Digite o valor do boleto.')
    if (!isValidISO(due)) return setErr('Confira o vencimento.')
    if (orderDate && !isValidISO(orderDate)) return setErr('Confira a data do pedido.')
    setBusy(true)
    try {
      const payload = { order_number: order.trim(), order_date: orderDate || null, amount_cents: amount, due_date: due, notes: notes.trim() || null }
      if (editing) await updateBill(editing.id, payload)
      else await addBill(payload)
      await refresh()
      toast(editing ? 'Boleto atualizado' : 'Boleto cadastrado!')
      navigate('/boletos', { replace: true })
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Não foi possível salvar.')
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!editing) return
    setBusy(true)
    try {
      await deleteBill(editing.id)
      await refresh()
      toast('Boleto excluído')
      navigate('/boletos', { replace: true })
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Não foi possível excluir.')
      setBusy(false)
      setConfirmDel(false)
    }
  }

  return (
    <>
      <PageHeader title={editing ? 'Editar boleto' : 'Novo boleto'} back="/boletos" />
      <Page>
        <form onSubmit={submit} noValidate className="space-y-5 pb-8">
          <Field label="Número do pedido" htmlFor="order" hint="Pode repetir o mesmo pedido em vários boletos.">
            <input id="order" className={inputCls} autoComplete="off" enterKeyHint="next" placeholder="Ex.: 1048" value={order} onChange={(e) => setOrder(e.target.value)} />
          </Field>
          <Field label="Data do pedido" htmlFor="odate">
            <input id="odate" type="date" className={inputCls} value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
          </Field>
          <Field label="Valor do boleto" htmlFor="amount">
            <MoneyInput id="amount" value={amount} onChange={setAmount} />
          </Field>
          <Field label="Vencimento" htmlFor="due">
            <input id="due" type="date" className={inputCls} value={due} onChange={(e) => setDue(e.target.value)} />
          </Field>
          <Field label="Observações (opcional)" htmlFor="notes">
            <textarea id="notes" rows={3} className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          {err && <ErrorBox>{err}</ErrorBox>}
          <Button type="submit" full loading={busy} className="min-h-14 text-lg">{editing ? 'Salvar alterações' : 'Salvar boleto'}</Button>
          {editing && !editing.paid_at && (
            <Button full variant="ghost" className="text-red-700" onClick={() => setConfirmDel(true)}>Excluir boleto</Button>
          )}
        </form>
      </Page>
      <Sheet open={confirmDel} onClose={() => setConfirmDel(false)} title="Excluir boleto?">
        <div className="space-y-4">
          <p className="text-stone-700">O boleto {editing?.order_number} será removido. Isso não pode ser desfeito.</p>
          <Button full variant="danger" loading={busy} onClick={remove}>Sim, excluir</Button>
          <Button full variant="ghost" onClick={() => setConfirmDel(false)}>Cancelar</Button>
        </div>
      </Sheet>
    </>
  )
}
