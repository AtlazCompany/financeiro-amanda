import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { todayISO } from '../lib/dates'
import type { Bill, Client, Installment, Sale, Settings } from '../lib/types'
import { useAuth } from './AuthContext'
import { translateError } from './actions'

interface DataState {
  clients: Client[]
  sales: Sale[]
  installments: Installment[]
  bills: Bill[]
  settings: Settings
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

const defaultSettings: Settings = { opening_balance_cents: 0, opening_balance_date: todayISO(), alert_days: 7 }
const Ctx = createContext<DataState | null>(null)

const PAGE = 1000
async function fetchAll<T>(table: string, columns: string, order: string): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from(table).select(columns).order(order).range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    const rows = (data ?? []) as T[]
    out.push(...rows)
    if (rows.length < PAGE) break
  }
  return out
}

export function DataProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const userId = session?.user.id
  const [state, setState] = useState({
    clients: [] as Client[], sales: [] as Sale[], installments: [] as Installment[], bills: [] as Bill[],
    settings: defaultSettings,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!userId) return
    try {
      const [clients, sales, installments, bills, st] = await Promise.all([
        fetchAll<Client>('clients', 'id,name,whatsapp,notes', 'name'),
        fetchAll<Sale>('sales', 'id,client_id,description,sale_date,total_cents,installments_count,first_due_date', 'sale_date'),
        fetchAll<Installment>('installments', 'id,sale_id,number,due_date,amount_cents,paid_at', 'due_date'),
        fetchAll<Bill>('supplier_bills', 'id,order_number,order_date,amount_cents,due_date,paid_at,notes', 'due_date'),
        supabase.from('financial_settings').select('opening_balance_cents,opening_balance_date,alert_days').maybeSingle(),
      ])
      if (st.error) throw new Error(st.error.message)
      let settings = st.data as Settings | null
      if (!settings) {
        const ins = await supabase.from('financial_settings').insert({}).select('opening_balance_cents,opening_balance_date,alert_days').single()
        if (ins.error) throw new Error(ins.error.message)
        settings = ins.data as Settings
      }
      setState({ clients, sales, installments, bills, settings })
      setError(null)
    } catch (e) {
      setError(translateError(e instanceof Error ? e.message : 'Erro ao carregar'))
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    if (!userId) {
      setState({ clients: [], sales: [], installments: [], bills: [], settings: defaultSettings })
      setLoading(false)
      return
    }
    setLoading(true)
    void refresh()
  }, [userId, refresh])

  // Atualiza ao voltar para o app (iPhone: ao reabrir o atalho)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refresh])

  const value = useMemo(() => ({ ...state, loading, error, refresh }), [state, loading, error, refresh])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useData(): DataState {
  const v = useContext(Ctx)
  if (!v) throw new Error('useData fora do DataProvider')
  return v
}
