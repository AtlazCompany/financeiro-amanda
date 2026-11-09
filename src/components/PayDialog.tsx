import { useEffect, useState } from 'react'
import { Button, ErrorBox, Field, Sheet, inputCls } from './Ui'
import { formatBR, isValidISO, todayISO } from '../lib/dates'
import { formatBRL } from '../lib/money'
import type { ISODate } from '../lib/types'

interface Props {
  open: boolean
  onClose: () => void
  /** "Parcela 2/3 de Maria" */
  title: string
  amountCents: number
  /** Data atual do pagamento (modo correcao) ou null (novo pagamento). */
  currentPaidAt: ISODate | null
  kind: 'receber' | 'pagar'
  /** date = marcar/alterar; null = desfazer */
  onSave: (date: ISODate | null) => Promise<void>
}

/** Marcar como pago (data editavel, confirmacao) ou corrigir/desfazer um pagamento. */
export function PayDialog({ open, onClose, title, amountCents, currentPaidAt, kind, onSave }: Props) {
  const today = todayISO()
  const editing = currentPaidAt !== null
  const [date, setDate] = useState<ISODate>(currentPaidAt ?? today)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [confirmUndo, setConfirmUndo] = useState(false)

  useEffect(() => {
    if (open) {
      setDate(currentPaidAt ?? todayISO())
      setErr(null)
      setBusy(false)
      setConfirmUndo(false)
    }
  }, [open, currentPaidAt])

  const valid = isValidISO(date) && date <= today
  const run = async (value: ISODate | null) => {
    setBusy(true)
    setErr(null)
    try {
      await onSave(value)
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Não foi possível salvar.')
      setBusy(false)
    }
  }

  const verbo = kind === 'receber' ? 'recebimento' : 'pagamento'
  return (
    <Sheet open={open} onClose={onClose} title={editing ? `Corrigir ${verbo}` : kind === 'receber' ? 'Marcar como pago' : 'Marcar boleto como pago'}>
      <div className="space-y-4">
        <div className="rounded-2xl bg-brand-50 p-4">
          <p className="text-sm font-semibold text-stone-700">{title}</p>
          <p className="mt-1 text-3xl font-extrabold text-brand-900">{formatBRL(amountCents)}</p>
        </div>

        {!confirmUndo ? (
          <>
            <Field label={kind === 'receber' ? 'Data em que a cliente pagou' : 'Data em que você pagou'} htmlFor="pay-date">
              <input id="pay-date" type="date" className={inputCls} value={date} max={today} onChange={(e) => setDate(e.target.value)} />
            </Field>
            {!valid && <ErrorBox>Escolha uma data válida (hoje ou antes).</ErrorBox>}
            {err && <ErrorBox>{err}</ErrorBox>}
            <p className="text-sm text-stone-600">
              {kind === 'receber'
                ? `Confirmar que ${formatBRL(amountCents)} foram recebidos em ${valid ? formatBR(date) : '—'}?`
                : `Confirmar que o boleto de ${formatBRL(amountCents)} foi pago em ${valid ? formatBR(date) : '—'}?`}
            </p>
            <Button full disabled={!valid} loading={busy} onClick={() => run(date)}>
              {editing ? 'Salvar nova data' : 'Confirmar pagamento'}
            </Button>
            {editing && (
              <Button full variant="ghost" className="text-red-600" onClick={() => setConfirmUndo(true)}>
                Foi engano — desfazer pagamento
              </Button>
            )}
            <Button full variant="ghost" onClick={onClose}>Cancelar</Button>
          </>
        ) : (
          <>
            <ErrorBox>
              Desfazer o {verbo}? O valor volta a ficar {kind === 'receber' ? 'pendente (e sai do seu caixa)' : 'em aberto (e volta para o seu caixa)'}.
            </ErrorBox>
            {err && <ErrorBox>{err}</ErrorBox>}
            <Button full variant="danger" loading={busy} onClick={() => run(null)}>Sim, desfazer</Button>
            <Button full variant="ghost" onClick={() => setConfirmUndo(false)}>Voltar</Button>
          </>
        )}
      </div>
    </Sheet>
  )
}
