import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AlertTriangle, TrendingUp } from 'lucide-react'
import { Button, Card, ErrorBox, Field, MoneyInput, Segmented, Stepper, inputCls, useToast } from '../components/Ui'
import { Page, PageHeader } from '../components/Layout'
import { useData } from '../data/DataContext'
import { addClient, createSale } from '../data/actions'
import { formatBR, isValidISO, todayISO } from '../lib/dates'
import { MAX_INSTALLMENTS, splitInstallments } from '../lib/finance'
import { formatBRL } from '../lib/money'
import { computeEconomics, formatPct } from '../lib/profit'

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="anim-rise">
      <div className="mb-2 flex items-center gap-2.5 px-1">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">{n}</span>
        <h2 className="text-xl text-brand-800">{title}</h2>
      </div>
      <Card className="space-y-4">{children}</Card>
    </section>
  )
}

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
  const [quantity, setQuantity] = useState(1)
  const [unitCost, setUnitCost] = useState(0)
  const [unitPrice, setUnitPrice] = useState(0)
  const [discount, setDiscount] = useState(0)
  const [saleDate, setSaleDate] = useState(today)
  const [count, setCount] = useState(1)
  const [firstDue, setFirstDue] = useState(today)
  const [dueTouched, setDueTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const eco = useMemo(
    () => computeEconomics({ quantity, unitCostCents: unitCost > 0 ? unitCost : null, unitPriceCents: unitPrice, discountCents: discount }),
    [quantity, unitCost, unitPrice, discount],
  )
  const revenue = eco.revenueCents

  const preview = useMemo(() => {
    if (unitPrice <= 0 || revenue <= 0 || !isValidISO(firstDue)) return null
    try {
      return splitInstallments(revenue, count, firstDue)
    } catch {
      return null
    }
  }, [unitPrice, revenue, count, firstDue])

  const onSaleDate = (v: string) => {
    setSaleDate(v)
    if (!dueTouched) setFirstDue(v)
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setErr(null)
    if (!clientId) return setErr('Escolha a cliente.')
    if (clientId === 'new' && !newName.trim()) return setErr('Digite o nome da nova cliente.')
    if (!description.trim()) return setErr('Digite o produto.')
    if (unitPrice <= 0) return setErr('Digite o preço de venda.')
    if (eco.discountTooHigh || revenue <= 0) return setErr('O desconto não pode ser maior que o valor da venda.')
    if (!isValidISO(saleDate) || !isValidISO(firstDue)) return setErr('Confira as datas.')
    if (!preview) return setErr('Não foi possível calcular as parcelas. Confira os valores.')
    setBusy(true)
    try {
      let cid = clientId
      if (clientId === 'new') {
        const c = await addClient({ name: newName.trim(), whatsapp: newPhone.trim() || null, notes: null })
        cid = c.id
      }
      const id = await createSale({
        client_id: cid, description: description.trim(), sale_date: saleDate,
        quantity, unit_cost_cents: unitCost > 0 ? unitCost : null, unit_price_cents: unitPrice, discount_cents: discount,
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

  const profitColor = eco.profitCents === null ? 'text-stone-600' : eco.isLoss ? 'text-red-700' : 'text-emerald-700'

  return (
    <>
      <PageHeader title="Nova venda" subtitle="Preencha em poucos toques" back="/vendas" />
      <Page>
        <form onSubmit={submit} noValidate className="space-y-5 pb-8">
          <Step n={1} title="Cliente e produto">
            <Field label="Cliente" htmlFor="client">
              <select id="client" className={inputCls} value={clientId} onChange={(e) => setClientId(e.target.value)}>
                <option value="">Escolha a cliente…</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                <option value="new">＋ Nova cliente…</option>
              </select>
            </Field>
            {clientId === 'new' && (
              <div className="space-y-4 rounded-2xl bg-brand-50 p-3">
                <Field label="Nome da nova cliente" htmlFor="newname">
                  <input id="newname" className={inputCls} autoComplete="off" autoCapitalize="words" enterKeyHint="next" value={newName} onChange={(e) => setNewName(e.target.value)} />
                </Field>
                <Field label="WhatsApp (opcional)" htmlFor="newphone">
                  <input id="newphone" className={inputCls} type="tel" inputMode="tel" autoComplete="off" placeholder="(11) 91234-5678" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
                </Field>
              </div>
            )}
            <Field label="Produto" htmlFor="desc">
              <input id="desc" className={inputCls} autoComplete="off" enterKeyHint="next" placeholder="Ex.: Hidratante Nativa SPA" value={description} onChange={(e) => setDescription(e.target.value)} />
            </Field>
          </Step>

          <Step n={2} title="Custo, preço e quantidade">
            <Field label="Quantidade" htmlFor="qty">
              <Stepper id="qty" value={quantity} onChange={setQuantity} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Custo unitário" htmlFor="cost" hint="Quanto você pagou">
                <MoneyInput id="cost" value={unitCost} onChange={setUnitCost} />
              </Field>
              <Field label="Preço de venda" htmlFor="price" hint="Por unidade">
                <MoneyInput id="price" value={unitPrice} onChange={setUnitPrice} />
              </Field>
            </div>
            <Field label="Desconto total (opcional)" htmlFor="disc">
              <MoneyInput id="disc" value={discount} onChange={setDiscount} placeholder="R$ 0,00" />
            </Field>
          </Step>

          <section className="anim-rise" aria-live="polite">
            <div className="mb-2 flex items-center gap-2.5 px-1">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-800 text-white"><TrendingUp className="h-4 w-4" /></span>
              <h2 className="text-xl text-brand-800">Lucro desta venda</h2>
            </div>
            <Card className="bg-brand-100/60">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-brand-800">Lucro bruto</p>
                  <p className={`tabular text-3xl font-bold ${profitColor}`} data-testid="profit">
                    {eco.profitCents === null ? '—' : formatBRL(eco.profitCents)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold text-brand-800">Margem</p>
                  <p className={`tabular text-2xl font-bold ${profitColor}`} data-testid="margin">{formatPct(eco.marginPct)}</p>
                </div>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-brand-200 pt-3 text-sm">
                <div><dt className="text-xs text-stone-600">Total da venda</dt><dd className="tabular font-bold" data-testid="revenue">{formatBRL(Math.max(revenue, 0))}</dd></div>
                <div><dt className="text-xs text-stone-600">Custo total</dt><dd className="tabular font-bold" data-testid="cost">{eco.costCents === null ? 'Custo não informado' : formatBRL(eco.costCents)}</dd></div>
              </dl>
              {eco.costCents === null && unitPrice > 0 && (
                <p className="mt-3 text-xs text-stone-600">Informe o custo unitário para ver o lucro. Sem custo, a venda fica fora do lucro do mês.</p>
              )}
              {eco.isLoss && (
                <div role="status" className="mt-3 flex gap-2 rounded-2xl bg-amber-100 px-3 py-2.5 text-xs font-semibold text-amber-950">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                  Esta venda dá prejuízo de {formatBRL(-(eco.profitCents ?? 0))}. Você ainda pode salvar.
                </div>
              )}
              {eco.discountTooHigh && <div className="mt-3"><ErrorBox>O desconto é maior que o valor dos produtos.</ErrorBox></div>}
            </Card>
          </section>

          <Step n={3} title="Condições de pagamento">
            <Field label="Data da venda" htmlFor="sdate">
              <input id="sdate" type="date" className={inputCls} value={saleDate} onChange={(e) => onSaleDate(e.target.value)} />
            </Field>
            <Field label="Número de parcelas" hint="1x = venda à vista. O parcelamento usa o total já com desconto.">
              <Segmented label="Número de parcelas" options={Array.from({ length: MAX_INSTALLMENTS }, (_, i) => i + 1)} value={count} onChange={setCount} />
            </Field>
            <Field label={count === 1 ? 'Data do pagamento' : 'Vencimento da 1ª parcela'} htmlFor="fdue">
              <input id="fdue" type="date" className={inputCls} value={firstDue} onChange={(e) => { setFirstDue(e.target.value); setDueTouched(true) }} />
            </Field>
            {preview && (
              <div>
                <p className="mb-1 text-sm font-semibold text-brand-800">Parcelas que serão criadas</p>
                <ul className="divide-y divide-brand-100 rounded-2xl bg-brand-50/70 px-3">
                  {preview.map((p) => (
                    <li key={p.number} className="flex items-center justify-between py-2.5 text-sm">
                      <span className="text-stone-600">Parcela {p.number}/{preview.length} · {formatBR(p.due_date)}</span>
                      <span className="tabular font-bold text-ink">{formatBRL(p.amount_cents)}</span>
                    </li>
                  ))}
                </ul>
                {preview.length > 1 && preview[preview.length - 1].amount_cents !== preview[0].amount_cents && (
                  <p className="mt-1.5 text-xs text-stone-600">A última parcela ajusta os centavos.</p>
                )}
              </div>
            )}
          </Step>

          <Step n={4} title="Confirmação">
            <p className="text-sm text-stone-700">
              {description.trim() || 'Produto'} · {quantity} un. ·{' '}
              <b className="tabular">{formatBRL(Math.max(revenue, 0))}</b> em {count}x
              {eco.profitCents !== null && <> · lucro <b className="tabular">{formatBRL(eco.profitCents)}</b></>}
            </p>
            {err && <ErrorBox>{err}</ErrorBox>}
            <Button type="submit" full loading={busy} className="min-h-14 text-lg">Salvar venda</Button>
          </Step>
        </form>
      </Page>
    </>
  )
}
