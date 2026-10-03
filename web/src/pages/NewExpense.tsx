import { useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Calendar, Check, CircleUser, Tag, Trash2, Users, Wallet } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type Expense, type Group, type User } from '../lib/api'
import { parseCents } from '../lib/money'
import { KindSwitch, Loading, PageHead } from '../components/Layout'

export default function NewExpense() {
  const { id, eid } = useParams()
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: () => api<User>('/me') })
  const { data: group } = useQuery({ queryKey: ['group', id], queryFn: () => api<Group>(`/groups/${id}`) })
  // Editing: /pots/:id/expenses/:eid/edit
  const { data: expenses } = useQuery({ queryKey: ['expenses', id], queryFn: () => api<Expense[]>(`/groups/${id}/expenses`), enabled: !!eid })
  if (!group || !me || (eid && !expenses)) return <Loading />
  const expense = eid ? expenses!.find((e) => e.id === Number(eid)) : undefined
  if (eid && !expense) return <p className="empty">Not found.</p>
  return <Form group={group} meId={me.id} expense={expense} />
}

function Form({ group, meId, expense }: { group: Group; meId: number; expense?: Expense }) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const people = group.participants ?? []
  const shortcuts = group.participant_groups ?? []
  const owner = people.find((p) => p.user_id === meId) ?? people[0]

  const [description, setDescription] = useState(expense?.description ?? '')
  const [amount, setAmount] = useState(expense ? (expense.amount_cents / 100).toFixed(2) : '')
  const [date, setDate] = useState(() => expense?.spent_on ?? new Date().toISOString().slice(0, 10))
  const [paidBy, setPaidBy] = useState(expense?.paid_by_id ?? owner.id)
  const [splitWith, setSplitWith] = useState<number[]>(expense?.participant_ids ?? []) // individually picked people
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [splitGroups, setSplitGroups] = useState<number[]>(expense?.participant_group_ids ?? []) // picked groups: stored by reference, not expanded
  const [error, setError] = useState('')

  const done = () => {
    qc.invalidateQueries({ queryKey: ['expenses', String(group.id)] })
    qc.invalidateQueries({ queryKey: ['balances', String(group.id)] })
    navigate(`/pots/${group.id}`)
  }
  const add = useMutation({
    mutationFn: (body: unknown) =>
      expense
        ? api(`/groups/${group.id}/expenses/${expense.id}`, { method: 'PATCH', json: body })
        : api(`/groups/${group.id}/expenses`, { method: 'POST', json: body }),
    onSuccess: done,
    onError: () => setError('Could not save'),
  })
  const remove = useMutation({
    mutationFn: () => api(`/groups/${group.id}/expenses/${expense!.id}`, { method: 'DELETE' }),
    onSuccess: done,
    onError: () => setError('Could not delete'),
  })

  const toggle = (pid: number) =>
    setSplitWith((cur) => (cur.includes(pid) ? cur.filter((x) => x !== pid) : [...cur, pid]))

  const toggleGroup = (gid: number) =>
    setSplitGroups((cur) => (cur.includes(gid) ? cur.filter((x) => x !== gid) : [...cur, gid]))
  // People already included through a picked group; shown checked but not individually editable.
  const viaGroup = new Set(shortcuts.filter((g) => splitGroups.includes(g.id)).flatMap((g) => g.participant_ids))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setError('')
    const cents = parseCents(amount)
    if (!cents) return setError('Enter a valid amount')
    // Amounts are computed by the server from who is in the groups at the time, so balances follow group edits.
    add.mutate({
      description,
      amount_cents: cents,
      spent_on: date,
      paid_by_id: paidBy,
      participant_ids: splitWith,
      participant_group_ids: splitGroups,
    })
  }

  return (
    <form onSubmit={submit} className="stack">
      <PageHead title={expense ? 'Edit expense' : 'Add expense'} back={`/pots/${group.id}`}>
        {!expense && <KindSwitch potId={group.id} active="expense" />}
      </PageHead>
      <div className="cols even">
        <div className="card stack">
          <label className="field">
            <span className="row start"><Tag size={14} /> What for?</span>
            <input value={description} onChange={(e) => setDescription(e.target.value)} required autoFocus />
          </label>
          <label className="field">
            <span className="row start"><Wallet size={14} /> Amount ({group.currency})</span>
            <input inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </label>
          <label className="field">
            <span className="row start"><CircleUser size={14} /> Paid by</span>
            <select value={paidBy} onChange={(e) => setPaidBy(Number(e.target.value))}>
              {people.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="row start"><Calendar size={14} /> Date</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </label>
        </div>
        <section className="card" style={{ minWidth: 0 }}>
          <h2><Users size={14} /> Split equally between</h2>
          {splitWith.length === 0 && viaGroup.size === 0 && <p className="muted">Nobody picked: saved as not allocated, left out of the balances.</p>}
          <div className="checks">
            {shortcuts.map((g) => (
              <label key={`g${g.id}`} className="check">
                <input type="checkbox" checked={splitGroups.includes(g.id)} onChange={() => toggleGroup(g.id)} /> <b>{g.name}</b>
              </label>
            ))}
            {people.map((p) => (
              <label key={p.id} className="check">
                <input
                  type="checkbox"
                  checked={viaGroup.has(p.id) || splitWith.includes(p.id)}
                  disabled={viaGroup.has(p.id)}
                  onChange={() => toggle(p.id)}
                />
                {p.name}
              </label>
            ))}
          </div>
        </section>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="row">
        <button type="submit" className="primary grow" disabled={add.isPending}><Check size={18} /> {expense ? 'Save' : 'Add'}</button>
        {expense && (confirmDelete
          ? <button type="button" className="danger" disabled={remove.isPending} onClick={() => remove.mutate()}>Really delete?</button>
          : <button type="button" className="icon danger" aria-label="Delete" title="Delete" onClick={() => setConfirmDelete(true)}><Trash2 size={18} /></button>)}
      </div>
    </form>
  )
}
