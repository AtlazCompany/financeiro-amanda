import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import { Badge, Button, Card, EmptyState, ErrorBox, Spinner, inputCls } from '../components/Ui'
import { Page, PageHeader } from '../components/Layout'
import { useData } from '../data/DataContext'
import { todayISO } from '../lib/dates'
import { clientSummaries } from '../lib/finance'
import { formatBRL } from '../lib/money'

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export default function Clients() {
  const { clients, sales, installments, loading, error } = useData()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const today = todayISO()
  const sums = useMemo(() => clientSummaries(clients, sales, installments, today), [clients, sales, installments, today])
  const list = useMemo(() => {
    const term = norm(q.trim())
    return clients
      .filter((c) => !term || norm(c.name).includes(term))
      .sort((a, b) => {
        const oa = sums.get(a.id)?.overdueCents ?? 0
        const ob = sums.get(b.id)?.overdueCents ?? 0
        if (oa !== ob) return ob - oa
        return a.name.localeCompare(b.name, 'pt-BR')
      })
  }, [clients, q, sums])

  return (
    <>
      <PageHeader title="Clientes" subtitle={`${clients.length} cadastrada(s)`}
        right={<Button variant="soft" className="min-h-11 px-4" onClick={() => navigate('/clientes/novo')}><Plus className="h-5 w-5" /> Nova</Button>}>
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400" />
          <input type="search" className={`${inputCls} pl-11`} placeholder="Buscar cliente" value={q} onChange={(e) => setQ(e.target.value)} enterKeyHint="search" autoCapitalize="none" autoCorrect="off" aria-label="Buscar cliente" />
        </div>
      </PageHeader>
      <Page>
        {error && <ErrorBox>{error}</ErrorBox>}
        {loading ? <Spinner /> : list.length === 0 ? (
          <EmptyState
            title={clients.length === 0 ? 'Nenhuma cliente ainda' : 'Nada encontrado'}
            text={clients.length === 0 ? 'Cadastre suas clientes ou crie ao registrar uma venda.' : undefined}
            action={clients.length === 0 ? <Button onClick={() => navigate('/clientes/novo')}>Cadastrar cliente</Button> : undefined}
          />
        ) : (
          <div className="space-y-2">
            {list.map((c) => {
              const s = sums.get(c.id)
              return (
                <Link key={c.id} to={`/clientes/${c.id}`} className="block">
                  <Card className="active:bg-stone-50">
                    <div className="flex items-start justify-between gap-3">
                      <p className="truncate text-base font-bold text-stone-900">{c.name}</p>
                      {s && s.overdueCount > 0 && <Badge tone="red">{s.overdueCount} atrasada(s)</Badge>}
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                      <div><p className="text-xs text-stone-500">Comprou</p><p className="font-bold">{formatBRL(s?.totalSoldCents ?? 0)}</p></div>
                      <div><p className="text-xs text-brand-700">Pagou</p><p className="font-bold text-brand-700">{formatBRL(s?.paidCents ?? 0)}</p></div>
                      <div><p className="text-xs text-stone-500">Deve</p><p className={`font-bold ${(s?.overdueCents ?? 0) > 0 ? 'text-red-600' : ''}`}>{formatBRL(s?.owedCents ?? 0)}</p></div>
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
