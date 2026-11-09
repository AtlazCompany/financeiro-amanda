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
  /** Quantidade vendida (vendas antigas: 1). */
  quantity: number
  /** Custo unitario de compra; null = "custo nao informado" (nunca assumir zero). */
  unit_cost_cents: number | null
  /** Preco unitario de venda; null em vendas antigas (so o total foi registrado). */
  unit_price_cents: number | null
  /** Desconto total da venda, em centavos. */
  discount_cents: number
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
