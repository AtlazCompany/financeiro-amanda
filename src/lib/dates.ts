import type { ISODate } from './types'

const pad = (n: number) => String(n).padStart(2, '0')

export const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

export function toISO(y: number, m: number, d: number): ISODate {
  return `${y}-${pad(m)}-${pad(d)}`
}

/** Data de hoje no fuso local do aparelho. */
export function todayISO(now: Date = new Date()): ISODate {
  return toISO(now.getFullYear(), now.getMonth() + 1, now.getDate())
}

export function parseISO(iso: ISODate): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split('-').map(Number)
  return { y, m, d }
}

export function isValidISO(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false
  const { y, m, d } = parseISO(iso)
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m)
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

/** Equivalente ao EDATE da planilha: soma meses e ajusta para o fim do mes se preciso. */
export function addMonths(iso: ISODate, n: number): ISODate {
  const { y, m, d } = parseISO(iso)
  const total = y * 12 + (m - 1) + n
  const ny = Math.floor(total / 12)
  const nm = (total % 12) + 1
  return toISO(ny, nm, Math.min(d, daysInMonth(ny, nm)))
}

export function addDays(iso: ISODate, n: number): ISODate {
  const { y, m, d } = parseISO(iso)
  const dt = new Date(Date.UTC(y, m - 1, d + n))
  return toISO(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate())
}

/** b - a em dias. */
export function diffDays(a: ISODate, b: ISODate): number {
  const pa = parseISO(a)
  const pb = parseISO(b)
  return Math.round((Date.UTC(pb.y, pb.m - 1, pb.d) - Date.UTC(pa.y, pa.m - 1, pa.d)) / 86400000)
}

export function monthStart(y: number, m: number): ISODate {
  return toISO(y, m, 1)
}

export function nextMonthStart(y: number, m: number): ISODate {
  return m === 12 ? toISO(y + 1, 1, 1) : toISO(y, m + 1, 1)
}

export function formatBR(iso: ISODate | null | undefined): string {
  if (!iso) return ''
  const { y, m, d } = parseISO(iso)
  return `${pad(d)}/${pad(m)}/${y}`
}

export function formatShort(iso: ISODate): string {
  const { m, d } = parseISO(iso)
  return `${pad(d)}/${pad(m)}`
}
