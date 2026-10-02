import { useState, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Calendar, Check, CircleUser, Tag, Trash2, Wallet } from 'lucide-react'
import { api, type Group, type Settlement } from '../lib/api'
import { parseCents } from '../lib/money'
import { Loading, PageHead } from '../components/Layout'

export default function NewSettlement() {
  const { id, sid } = useParams()
  const { data: group } = useQuery({ queryKey: ['group', id], queryFn: () => api<Group>(`/groups/${id}`) })
  // Editing: /pots/:id/settlements/:sid/edit
  const { data: settlements } = useQuery({ queryKey: ['settlements', id], queryFn: () => api<Settlement[]>(`/groups/${id}/settlements`), enabled: !!sid })
  if (!group || (sid && !settlements)) return <Loading />
  const settlement = sid ? settlements!.find((s) => s.id === Number(sid)) : undefined
  if (sid && !settlement) return <p className="empty">Not found.</p>
  return <Form group={group} settlement={settlement} />
}

// Someone pays someone back. Prefilled from a "who pays whom" row via ?from=&to=&amount=(cents).
function Form({ group, settlement }: { group: Group; settlement?: Settlement }) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const people = group.participants ?? []

  const [from, setFrom] = useState(settlement?.from_participant_id ?? (Number(params.get('from')) || people[0]?.id))
  const [to, setTo] = useState(settlement?.to_participant_id ?? (Number(params.get('to')) || people.find((p) => p.id !== from)?.id))
  const [description, setDescription] = useState(settlement?.description ?? '')
  const [amount, setAmount] = useState(() => settlement ? (settlement.amount_cents / 100).toFixed(2) : (params.get('amount') ? (Number(params.get('amount')) / 100).toFixed(2) : ''))
  const [date, setDate] = useState(() => settlement?.settled_on ?? new Date().toISOString().slice(0, 10))
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState('')

  const done = () => {
    for (const key of ['settlements', 'balances', 'expenses']) qc.invalidateQueries({ queryKey: [key, String(group.id)] })
    navigate(`/pots/${group.id}`)
  }
  const add = useMutation({
    mutationFn: (body: unknown) =>
      settlement
        ? api(`/groups/${group.id}/settlements/${settlement.id}`, { method: 'PATCH', json: body })
        : api(`/groups/${group.id}/settlements`, { method: 'POST', json: body }),
    onSuccess: done,
    onError: () => setError('Could not save'),
  })
  const remove = useMutation({
    mutationFn: () => api(`/groups/${group.id}/settlements/${settlement!.id}`, { method: 'DELETE' }),
    onSuccess: done,
    onError: () => setError('Could not delete'),
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setError('')
    const cents = parseCents(amount)
    if (!cents) return setError('Enter a valid amount')
    if (from === to) return setError('Pick two different people')
    add.mutate({ from_participant_id: from, to_participant_id: to, amount_cents: cents, settled_on: date, description })
  }

  const select = (value: number | undefined, set: (n: number) => void) => (
    <select value={value} onChange={(e) => set(Number(e.target.value))}>
      {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
    </select>
  )

  return (
    <form onSubmit={submit} className="stack">
      <PageHead title={settlement ? 'Edit payback' : 'Add payback'} back={`/pots/${group.id}`} />
      <div className="card stack" style={{ maxWidth: 520 }}>
        <label className="field"><span className="row start"><CircleUser size={14} /> Who paid back</span>{select(from, setFrom)}</label>
        <label className="field"><span className="row start"><CircleUser size={14} /> Paid to</span>{select(to, setTo)}</label>
        <label className="field">
          <span className="row start"><Tag size={14} /> What for? (optional)</span>
          <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={255} />
        </label>
        <label className="field">
          <span className="row start"><Wallet size={14} /> Amount ({group.currency})</span>
          <input inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} required autoFocus />
        </label>
        <label className="field">
          <span className="row start"><Calendar size={14} /> Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>
        {error && <p className="error">{error}</p>}
        <div className="row">
          <button type="submit" className="primary grow" disabled={add.isPending}><Check size={18} /> {settlement ? 'Save' : 'Add'}</button>
          {settlement && (confirmDelete
            ? <button type="button" className="danger" disabled={remove.isPending} onClick={() => remove.mutate()}>Really delete?</button>
            : <button type="button" className="icon danger" aria-label="Delete" title="Delete" onClick={() => setConfirmDelete(true)}><Trash2 size={18} /></button>)}
        </div>
      </div>
    </form>
  )
}
