import { supabase } from '../lib/supabase'
import type { Bill, Client, InstallmentDraft, ISODate, Settings } from '../lib/types'

function fail(error: { message: string } | null): void {
  if (error) throw new Error(translate(error.message))
}

function translate(msg: string): string {
  if (/Parcela paga nao pode ser excluida/i.test(msg)) return 'Esta venda tem parcelas pagas. Desfaça os pagamentos antes de excluir.'
  if (/foreign key|violates/i.test(msg)) return 'Este registro está em uso e não pode ser excluído.'
  if (/JWT|expired/i.test(msg)) return 'Sua sessão expirou. Entre novamente.'
  if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) return 'Sem conexão com a internet. Tente novamente.'
  return msg
}

export async function addClient(c: { name: string; whatsapp: string | null; notes: string | null }): Promise<Client> {
  const { data, error } = await supabase.from('clients').insert(c).select('id,name,whatsapp,notes').single()
  fail(error)
  return data as Client
}

export async function updateClient(id: string, c: { name: string; whatsapp: string | null; notes: string | null }) {
  const { error } = await supabase.from('clients').update(c).eq('id', id)
  fail(error)
}

export async function deleteClient(id: string) {
  const { error } = await supabase.from('clients').delete().eq('id', id)
  fail(error)
}

export interface NewSale {
  client_id: string
  description: string
  sale_date: ISODate
  total_cents: number
  first_due_date: ISODate
  installments: InstallmentDraft[]
}

export async function createSale(s: NewSale): Promise<string> {
  const { data, error } = await supabase.rpc('create_sale', {
    p_client_id: s.client_id,
    p_description: s.description,
    p_sale_date: s.sale_date,
    p_total_cents: s.total_cents,
    p_first_due_date: s.first_due_date,
    p_installments: s.installments,
  })
  fail(error)
  return data as string
}

export async function deleteSale(id: string) {
  const del = await supabase.from('installments').delete().eq('sale_id', id)
  fail(del.error)
  const { error } = await supabase.from('sales').delete().eq('id', id)
  fail(error)
}

/** Marca (data) ou desfaz (null) o pagamento de UMA parcela. O caixa e derivado desta data: nao ha lancamento duplicado. */
export async function setInstallmentPaid(id: string, paidAt: ISODate | null) {
  const { error } = await supabase.from('installments').update({ paid_at: paidAt }).eq('id', id)
  fail(error)
}

export type BillInput = Pick<Bill, 'order_number' | 'order_date' | 'amount_cents' | 'due_date' | 'notes'>

export async function addBill(b: BillInput & { paid_at?: ISODate | null }) {
  const { error } = await supabase.from('supplier_bills').insert(b)
  fail(error)
}

export async function updateBill(id: string, b: BillInput) {
  const { error } = await supabase.from('supplier_bills').update(b).eq('id', id)
  fail(error)
}

export async function deleteBill(id: string) {
  const { error } = await supabase.from('supplier_bills').delete().eq('id', id).is('paid_at', null)
  fail(error)
}

export async function setBillPaid(id: string, paidAt: ISODate | null) {
  const { error } = await supabase.from('supplier_bills').update({ paid_at: paidAt }).eq('id', id)
  fail(error)
}

export async function saveSettings(s: Settings, userId: string) {
  const { error } = await supabase.from('financial_settings').upsert({ user_id: userId, ...s })
  fail(error)
}

export { translate as translateError }
