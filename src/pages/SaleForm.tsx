import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button, Card, ErrorBox, Field, MoneyInput, Segmented, inputCls, useToast } from '../components/Ui'
import { Page, PageHeader } from '../components/Layout'
import { useData } from '../data/DataContext'
import { addClient, createSale } from '../data/actions'
import { formatBR, isValidISO, todayISO } from '../lib/dates'
import { MAX_INSTALLMENTS, splitInstallments } from '../lib/finance'
import { formatBRL } from '../lib/money'

export default function SaleForm() {
  const { clients, refresh } = useData()
  const navigate = useNavigate()
  const toast = useToast()
  const [params] = useSearchParams()
  const today = todayISO()

  const [clientId, setClientId] = useState(params.get('cliente') ?? '')
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [description, setDescription] = useState('')
  const [saleDate, setSaleDate] = useState(today)
  const [total, setTotal] = useState(0)
  const [count, setCount] = useState(1)
  const [firstDue, setFirstDue] = useState(today)
  const [dueTouched, setDueTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const preview = useMemo(() => {
    if (total <= 0 || !isValidISO(firstDue)) return null
    try {
      return splitInstallments(total, count, firstDue)
    } catch {
      return null
    }
  }, [total, count, firstDue])

  const onSaleDate = (v: string) => {
    setSaleDate(v)
    if (!dueTouched) setFirstDue(v)
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setErr(null)
    if (!clientId) return setErr('Escolha a cliente.')
    if (clientId === 'new' && !newName.trim()) return setErr('Digite o nome da nova cliente.')
    if (!description.trim()) return setErr('Digite o produto ou a descrição.')
    if (!isValidISO(saleDate) || !isValidISO(firstDue)) return setErr('Confira as datas.')
    if (total <= 0) return setErr('Digite o valor total da venda.')
    if (!preview) return setErr('Não foi possível calcular as parcelas. Confira o valor.')
    setBusy(true)
    try {
      let cid = clientId
      if (clientId === 'new') {
        const c = await addClient({ name: newName.trim(), whatsapp: newPhone.trim() || null, notes: null })
        cid = c.id
      }
      const id = await createSale({
        client_id: cid, description: description.trim(), sale_date: saleDate, total_cents: total,
        first_due_date: firstDue, installments: preview,
      })
      await refresh()
      toast('Venda registrada!')
      navigate(`/vendas/${id}`, { replace: true })
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Não foi possível salvar a venda.')
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader title="Nova venda" back="/vendas" />
      <Page>
        <form onSubmit={submit} noValidate className="space-y-5 pb-8">
          <Field label="Cliente" htmlFor="client">
            <select id="client" className={inputCls} value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">Escolha a cliente…</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              <option value="new">＋ Nova cliente…</option>
            </select>
          </Field>
          {clientId === 'new' && (
            <Card className="space-y-4 bg-brand-50">
              <Field label="Nome da nova cliente" htmlFor="newname">
                <input id="newname" className={inputCls} autoComplete="off" autoCapitalize="words" enterKeyHint="next" value={newName} onChange={(e) => setNewName(e.target.value)} />
              </Field>
              <Field label="WhatsApp (opcional)" htmlFor="newphone">
                <input id="newphone" className={inputCls} type="tel" inputMode="tel" autoComplete="off" placeholder="(11) 91234-5678" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
              </Field>
            </Card>
          )}
          <Field label="Produto ou descrição" htmlFor="desc">
            <input id="desc" className={inputCls} autoComplete="off" enterKeyHint="next" placeholder="Ex.: Perfume Malbec" value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <Field label="Data da venda" htmlFor="sdate">
            <input id="sdate" type="date" className={inputCls} value={saleDate} onChange={(e) => onSaleDate(e.target.value)} />
          </Field>
          <Field label="Valor total" htmlFor="total">
            <MoneyInput id="total" value={total} onChange={setTotal} />
          </Field>
          <Field label="Número de parcelas" hint="1x = venda à vista">
            <Segmented label="Número de parcelas" options={Array.from({ length: MAX_INSTALLMENTS }, (_, i) => i + 1)} value={count} onChange={setCount} />
          </Field>
          <Field label={count === 1 ? 'Data do pagamento' : 'Vencimento da 1ª parcela'} htmlFor="fdue">
            <input id="fdue" type="date" className={inputCls} value={firstDue} onChange={(e) => { setFirstDue(e.target.value); setDueTouched(true) }} />
          </Field>

          {preview && (
            <Card>
              <p className="mb-2 text-sm font-bold text-stone-700">Parcelas que serão criadas</p>
              <ul className="divide-y divide-stone-100">
                {preview.map((p) => (
                  <li key={p.number} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-stone-600">Parcela {p.number}/{preview.length} · {formatBR(p.due_date)}</span>
                    <span className="font-bold text-stone-900">{formatBRL(p.amount_cents)}</span>
                  </li>
                ))}
              </ul>
              {preview.length > 1 && preview[preview.length - 1].amount_cents !== preview[0].amount_cents && (
                <p className="mt-2 text-xs text-stone-500">A última parcela ajusta os centavos.</p>
              )}
            </Card>
          )}

          {err && <ErrorBox>{err}</ErrorBox>}
          <Button type="submit" full loading={busy} className="min-h-14 text-lg">Salvar venda</Button>
        </form>
      </Page>
    </>
  )
}
