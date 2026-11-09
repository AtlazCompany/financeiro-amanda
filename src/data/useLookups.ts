import { useMemo } from 'react'
import type { Client, Installment, Sale } from '../lib/types'
import { useData } from './DataContext'

export function useLookups() {
  const { clients, sales, installments } = useData()
  return useMemo(() => {
    const clientById = new Map<string, Client>(clients.map((c) => [c.id, c]))
    const saleById = new Map<string, Sale>(sales.map((s) => [s.id, s]))
    const instBySale = new Map<string, Installment[]>()
    for (const i of installments) {
      const arr = instBySale.get(i.sale_id)
      if (arr) arr.push(i)
      else instBySale.set(i.sale_id, [i])
    }
    for (const arr of instBySale.values()) arr.sort((a, b) => a.number - b.number)
    return { clientById, saleById, instBySale }
  }, [clients, sales, installments])
}
