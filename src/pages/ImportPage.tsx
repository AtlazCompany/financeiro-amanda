import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Upload } from 'lucide-react'
import { Button, Card, ErrorBox, useToast } from '../components/Ui'
import { Page, PageHeader } from '../components/Layout'
import { useData } from '../data/DataContext'
import { addBill, addClient, createSaleTotalOnly } from '../data/actions'
import { installmentsFor, parseWorkbookFile, planImport, type ParsedWorkbook } from '../lib/importer'

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

export default function ImportPage() {
  const { clients, sales, bills, installments, refresh } = useData()
  const navigate = useNavigate()
  const toast = useToast()
  const [parsed, setParsed] = useState<ParsedWorkbook | null>(null)
  const [fileName, setFileName] = useState('')
  const [real, setReal] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [progress, setProgress] = useState('')

  const plan = useMemo(() => (parsed ? planImport(parsed, { clients, sales, bills, installments }) : null), [parsed, clients, sales, bills, installments])

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setErr(null)
    setParsed(null)
    setReal(false)
    try {
      setFileName(file.name)
      setParsed(await parseWorkbookFile(file))
    } catch {
      setErr('Não foi possível ler o arquivo. Use o .xlsx do Controle Financeiro.')
    }
  }

  const run = async () => {
    if (!plan) return
    setBusy(true)
    setErr(null)
    try {
      const ids = new Map(clients.map((c) => [norm(c.name), c.id]))
      for (const name of plan.newClients) {
        setProgress(`Cadastrando cliente ${name}…`)
        const c = await addClient({ name, whatsapp: null, notes: null })
        ids.set(norm(name), c.id)
      }
      let n = 0
      for (const s of plan.salesToAdd) {
        setProgress(`Importando vendas ${++n}/${plan.salesToAdd.length}…`)
        await createSaleTotalOnly({
          client_id: ids.get(norm(s.clientName))!, description: s.description, sale_date: s.sale_date,
          total_cents: s.total_cents, first_due_date: s.first_due_date, installments: installmentsFor(s),
        })
      }
      n = 0
      for (const b of plan.billsToAdd) {
        setProgress(`Importando boletos ${++n}/${plan.billsToAdd.length}…`)
        await addBill({ order_number: b.order_number, order_date: b.order_date, amount_cents: b.amount_cents, due_date: b.due_date, notes: null, paid_at: b.paid_at })
      }
      await refresh()
      toast('Importação concluída!')
      navigate('/', { replace: true })
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Falha na importação. Nada foi duplicado: tente novamente.')
      setBusy(false)
    }
  }

  const nothing = plan && plan.salesToAdd.length === 0 && plan.billsToAdd.length === 0
  return (
    <>
      <PageHeader title="Importar planilha" subtitle="Opcional · só dados reais" back="/ajustes" />
      <Page>
        <Card className="flex gap-3 border-amber-300 bg-amber-50 text-amber-900">
          <AlertTriangle className="h-6 w-6 shrink-0 text-amber-600" />
          <p className="text-sm">A planilha de demonstração tem dados <b>fictícios</b>. Não importe esses registros para o sistema definitivo. Você pode começar com o banco vazio.</p>
        </Card>

        <label className="mt-4 flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand-700/40 bg-white px-4 py-5 text-base font-semibold text-brand-800 active:bg-brand-50">
          <Upload className="h-5 w-5" /> {fileName || 'Escolher arquivo .xlsx'}
          <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" onChange={(e) => void onFile(e.target.files?.[0])} />
        </label>

        {err && <div className="mt-4"><ErrorBox>{err}</ErrorBox></div>}

        {plan && parsed && (
          <div className="mt-4 space-y-3">
            <Card>
              <h2 className="font-bold text-stone-900">Resumo antes de importar</h2>
              <ul className="mt-2 space-y-1 text-sm text-stone-700">
                <li>Clientes novas: <b>{plan.newClients.length}</b></li>
                <li>Vendas a importar: <b>{plan.salesToAdd.length}</b> ({plan.installments} parcelas, {plan.paidInstallments} já pagas)</li>
                <li>Vendas já existentes (puladas): <b>{plan.salesDuplicate}</b></li>
                <li>Boletos a importar: <b>{plan.billsToAdd.length}</b> · já existentes (pulados): <b>{plan.billsDuplicate}</b></li>
              </ul>
              {parsed.warnings.length > 0 && (
                <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-amber-800">
                  {parsed.warnings.slice(0, 8).map((w) => <li key={w}>{w}</li>)}
                </ul>
              )}
            </Card>
            {nothing ? (
              <ErrorBox>Nada novo para importar.</ErrorBox>
            ) : (
              <>
                <label className="flex min-h-12 items-start gap-3 rounded-xl bg-white p-3 text-sm text-stone-700">
                  <input type="checkbox" className="mt-0.5 h-6 w-6 shrink-0 accent-brand-800" checked={real} onChange={(e) => setReal(e.target.checked)} style={{ appearance: 'auto', WebkitAppearance: 'checkbox' }} />
                  Confirmo que estes são dados reais da Amanda (não de teste).
                </label>
                <Button full disabled={!real} loading={busy} onClick={run}>Importar agora</Button>
                {busy && <p className="text-center text-sm text-stone-600">{progress}</p>}
              </>
            )}
          </div>
        )}
      </Page>
    </>
  )
}
