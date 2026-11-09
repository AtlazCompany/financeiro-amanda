import { useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, ErrorBox, Field, Spinner, inputCls, useToast } from '../components/Ui'
import { Page, PageHeader } from '../components/Layout'
import { useData } from '../data/DataContext'
import { addClient, updateClient } from '../data/actions'
import type { Client } from '../lib/types'

export default function ClientForm() {
  const { id } = useParams()
  const { clients, loading, refresh } = useData()
  const editing = id ? clients.find((c) => c.id === id) : undefined
  if (id && loading) return <Spinner />
  return <Inner key={editing?.id ?? 'new'} editing={editing} refresh={refresh} />
}

function Inner({ editing, refresh }: { editing: Client | undefined; refresh: () => Promise<void> }) {
  const navigate = useNavigate()
  const toast = useToast()
  const [name, setName] = useState(editing?.name ?? '')
  const [phone, setPhone] = useState(editing?.whatsapp ?? '')
  const [notes, setNotes] = useState(editing?.notes ?? '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setErr(null)
    if (!name.trim()) return setErr('Digite o nome da cliente.')
    setBusy(true)
    try {
      const payload = { name: name.trim(), whatsapp: phone.trim() || null, notes: notes.trim() || null }
      if (editing) {
        await updateClient(editing.id, payload)
        await refresh()
        toast('Cliente atualizada')
        navigate(`/clientes/${editing.id}`, { replace: true })
      } else {
        const c = await addClient(payload)
        await refresh()
        toast('Cliente cadastrada!')
        navigate(`/clientes/${c.id}`, { replace: true })
      }
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Não foi possível salvar.')
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader title={editing ? 'Editar cliente' : 'Nova cliente'} back={editing ? `/clientes/${editing.id}` : '/clientes'} />
      <Page>
        <form onSubmit={submit} noValidate className="space-y-5 pb-8">
          <Field label="Nome" htmlFor="name">
            <input id="name" className={inputCls} autoComplete="off" autoCapitalize="words" enterKeyHint="next" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="WhatsApp (opcional)" htmlFor="phone" hint="Com DDD. Ex.: (11) 91234-5678">
            <input id="phone" type="tel" inputMode="tel" className={inputCls} autoComplete="off" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <Field label="Observações (opcional)" htmlFor="notes">
            <textarea id="notes" rows={3} className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          {err && <ErrorBox>{err}</ErrorBox>}
          <Button type="submit" full loading={busy} className="min-h-14 text-lg">Salvar</Button>
        </form>
      </Page>
    </>
  )
}
