import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { FileSpreadsheet, LogOut, Share, SquarePlus } from 'lucide-react'
import { Button, Card, ErrorBox, Field, MoneyInput, SectionTitle, inputCls, useToast } from '../components/Ui'
import { Page, PageHeader } from '../components/Layout'
import { useAuth } from '../data/AuthContext'
import { useData } from '../data/DataContext'
import { saveSettings } from '../data/actions'
import { isValidISO } from '../lib/dates'

export default function SettingsPage() {
  const { settings, refresh } = useData()
  const { session, signOut } = useAuth()
  const toast = useToast()
  const [balance, setBalance] = useState(settings.opening_balance_cents)
  const [date, setDate] = useState(settings.opening_balance_date)
  const [alertDays, setAlertDays] = useState(String(settings.alert_days))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setErr(null)
    const days = Number(alertDays)
    if (!isValidISO(date)) return setErr('Confira a data do saldo inicial.')
    if (!Number.isInteger(days) || days < 0 || days > 60) return setErr('Os dias de aviso devem estar entre 0 e 60.')
    if (!session) return
    setBusy(true)
    try {
      await saveSettings({ opening_balance_cents: balance, opening_balance_date: date, alert_days: days }, session.user.id)
      await refresh()
      toast('Ajustes salvos')
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Não foi possível salvar.')
    }
    setBusy(false)
  }

  return (
    <>
      <PageHeader title="Ajustes" subtitle={session?.user.email ?? ''} back="/" />
      <Page>
        <form onSubmit={submit} noValidate className="space-y-5">
          <Card className="space-y-4">
            <h2 className="font-bold text-stone-900">Saldo inicial do caixa</h2>
            <Field label="Quanto você tinha em caixa" htmlFor="bal" hint="Entra uma única vez nas contas, a partir da data abaixo. Pagamentos anteriores a essa data não contam.">
              <MoneyInput id="bal" value={balance} onChange={setBalance} />
            </Field>
            <Field label="Válido a partir de" htmlFor="bdate">
              <input id="bdate" type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Avisar boletos que vencem em até (dias)" htmlFor="alert">
              <input id="alert" className={inputCls} inputMode="numeric" pattern="[0-9]*" value={alertDays} onChange={(e) => setAlertDays(e.target.value.replace(/\D/g, '').slice(0, 2))} />
            </Field>
            {err && <ErrorBox>{err}</ErrorBox>}
            <Button type="submit" full loading={busy}>Salvar ajustes</Button>
          </Card>
        </form>

        <SectionTitle>Instalar no iPhone</SectionTitle>
        <Card>
          <ol className="space-y-3 text-sm text-stone-700">
            <li className="flex items-start gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-800">1</span><span>Abra este site no <b>Safari</b>.</span></li>
            <li className="flex items-start gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-800">2</span><span>Toque em <b>Compartilhar</b> <Share className="inline h-4 w-4" /> (barra de baixo).</span></li>
            <li className="flex items-start gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-800">3</span><span>Escolha <b>Adicionar à Tela de Início</b> <SquarePlus className="inline h-4 w-4" />.</span></li>
            <li className="flex items-start gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-800">4</span><span>Confirme em <b>Adicionar</b>. Pronto: abra pelo ícone “Financeiro Amanda”.</span></li>
          </ol>
          <p className="mt-3 text-xs text-stone-600">Na primeira vez que abrir pelo ícone, entre de novo com e-mail e senha — depois a sessão fica salva.</p>
        </Card>

        <SectionTitle>Dados</SectionTitle>
        <Link to="/ajustes/importar" className="block">
          <Card className="flex items-center gap-3 active:bg-brand-50">
            <FileSpreadsheet className="h-6 w-6 text-brand-800" />
            <div>
              <p className="font-bold text-stone-900">Importar da planilha</p>
              <p className="text-sm text-stone-600">Traz vendas e boletos do Excel (opcional)</p>
            </div>
          </Card>
        </Link>

        <div className="mt-8">
          <Button full variant="secondary" onClick={() => void signOut()}><LogOut className="h-5 w-5" /> Sair</Button>
        </div>
      </Page>
    </>
  )
}
