/** Datas sao sempre strings ISO 'YYYY-MM-DD'. Valores em centavos inteiros. */
export type ISODate = string

export interface Client {
  id: string
  name: string
  whatsapp: string | null
  notes: string | null
}

export interface Sale {
  id: string
  client_id: string
  description: string
  sale_date: ISODate
  total_cents: number
  installments_count: number
  first_due_date: ISODate
}

export interface Installment {
  id: string
  sale_id: string
  number: number
  due_date: ISODate
  amount_cents: number
  paid_at: ISODate | null
}

export interface Bill {
  id: string
  order_number: string
  order_date: ISODate | null
  amount_cents: number
  due_date: ISODate
  paid_at: ISODate | null
  notes: string | null
}

export interface Settings {
  opening_balance_cents: number
  opening_balance_date: ISODate
  alert_days: number
}

export interface InstallmentDraft {
  number: number
  due_date: ISODate
  amount_cents: number
  paid_at?: ISODate | null
}

export type InstallmentStatus = 'paid' | 'overdue' | 'pending'
export type BillStatus = 'paid' | 'overdue' | 'soon' | 'pending'
