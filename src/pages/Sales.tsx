import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import { Badge, Button, Card, EmptyState, ErrorBox, Spinner, inputCls } from '../components/Ui'
import { Page, PageHeader } from '../components/Layout'
import { useData } from '../data/DataContext'
import { useLookups } from '../data/useLookups'
import { formatBR, todayISO } from '../lib/dates'
import { saleStatus } from '../lib/finance'
import { formatBRL } from '../lib/money'

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export default function Sales() {
  const { sales, loading, error } = useData()
  const { clientById, instBySale } = useLookups()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const today = todayISO()

  const list = useMemo(() => {
    const term = norm(q.trim())
    return [...sales]
      .sort((a, b) => (a.sale_date < b.sale_date ? 1 : a.sale_date > b.sale_date ? -1 : 0))
      .filter((s) => {
        if (!term) return true
        const name = clientById.get(s.client_id)?.name ?? ''
        return norm(name).includes(term) || norm(s.description).includes(term)
      })
  }, [sales, q, clientById])

  return (
    <>
      <PageHeader title="Vendas" subtitle={`${sales.length} venda(s)`}
        right={<Button variant="soft" className="min-h-11 px-4" onClick={() => navigate('/vendas/nova')}><Plus className="h-5 w-5" /> Nova</Button>}>
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400" />
          <input
            type="search" className={`${inputCls} pl-11`} placeholder="Buscar por cliente ou produto"
            value={q} onChange={(e) => setQ(e.target.value)} enterKeyHint="search" autoCapitalize="none" autoCorrect="off"
            aria-label="Buscar venda"
          />
        </div>
      </PageHeader>
      <Page>
        {error && <ErrorBox>{error}</ErrorBox>}
        {loading ? <Spinner /> : list.length === 0 ? (
          <EmptyState
            title={sales.length === 0 ? 'Nenhuma venda ainda' : 'Nada encontrado'}
            text={sales.length === 0 ? 'Toque no botão + para registrar a primeira venda.' : 'Tente buscar outro nome.'}
            action={sales.length === 0 ? <Button onClick={() => navigate('/vendas/nova')}>Registrar venda</Button> : undefined}
          />
        ) : (
          <div className="space-y-2">
            {list.map((s) => {
              const insts = instBySale.get(s.id) ?? []
              const paid = insts.filter((i) => i.paid_at).length
              const st = saleStatus(insts, today)
              return (
                <Link key={s.id} to={`/vendas/${s.id}`} className="block">
                  <Card className="active:bg-stone-50">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-base font-bold text-stone-900">{clientById.get(s.client_id)?.name ?? 'Cliente'}</p>
                        <p className="truncate text-sm text-stone-600">{s.description}</p>
                        <p className="mt-1 text-xs text-stone-500">{formatBR(s.sale_date)} · {paid}/{s.installments_count} parcela(s) paga(s)</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-base font-extrabold text-stone-900">{formatBRL(s.total_cents)}</p>
                        <Badge tone={st === 'paid' ? 'green' : st === 'overdue' ? 'red' : 'gray'}>
                          {st === 'paid' ? 'Quitada' : st === 'overdue' ? 'Em atraso' : 'Em andamento'}
                        </Badge>
                      </div>
                    </div>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}
      </Page>
    </>
  )
}
