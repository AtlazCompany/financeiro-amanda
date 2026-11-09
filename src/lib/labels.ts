import { diffDays, formatBR } from './dates'
import type { BillStatus, InstallmentStatus, ISODate } from './types'
import type { Tone } from '../components/Ui'

/** "vence hoje", "vence em 3 dias", "venceu há 4 dias" */
export function dueText(due: ISODate, today: ISODate): string {
  const d = diffDays(today, due)
  if (d === 0) return 'vence hoje'
  if (d === 1) return 'vence amanhã'
  if (d > 1) return `vence em ${d} dias`
  if (d === -1) return 'venceu ontem'
  return `venceu há ${-d} dias`
}

export function installmentBadge(s: InstallmentStatus, paidAt: ISODate | null): { tone: Tone; text: string } {
  if (s === 'paid') return { tone: 'green', text: paidAt ? `Pago em ${formatBR(paidAt).slice(0, 5)}` : 'Pago' }
  if (s === 'overdue') return { tone: 'red', text: 'Atrasada' }
  return { tone: 'gray', text: 'Pendente' }
}

export function billBadge(s: BillStatus, paidAt: ISODate | null): { tone: Tone; text: string } {
  if (s === 'paid') return { tone: 'green', text: paidAt ? `Pago em ${formatBR(paidAt).slice(0, 5)}` : 'Pago' }
  if (s === 'overdue') return { tone: 'red', text: 'Atrasado' }
  if (s === 'soon') return { tone: 'yellow', text: 'Vence em breve' }
  return { tone: 'gray', text: 'Pendente' }
}

/** Telefone para wa.me: so digitos; assume Brasil (55) quando vier sem DDI. */
export function whatsappDigits(raw: string | null | undefined): string | null {
  const d = (raw ?? '').replace(/\D/g, '')
  if (d.length < 10) return null
  if (d.length <= 11) return `55${d}`
  return d
}
