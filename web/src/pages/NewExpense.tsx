import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type Group, type User } from '../lib/api'
import { parseCents } from '../lib/money'

export default function NewExpense() {
  const { id } = useParams()
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: () => api<User>('/me') })
  const { data: group } = useQuery({ queryKey: ['group', id], queryFn: () => api<Group>(`/groups/${id}`) })
  if (!group || !me) return <p>Loading…</p>
  return <Form group={group} meId={me.id} />
}

function Form({ group, meId }: { group: Group; meId: number }) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const people = group.participants ?? []
  const shortcuts = group.participant_groups ?? []
  const owner = people.find((p) => p.user_id === meId) ?? people[0]

  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [paidBy, setPaidBy] = useState(owner.id)
  const [splitWith, setSplitWith] = useState<number[]>([]) // individually picked people
  const [splitGroups, setSplitGroups] = useState<number[]>([]) // picked groups: stored by reference, not expanded
  const [error, setError] = useState('')

  const add = useMutation({
    mutationFn: (body: unknown) => api(`/groups/${group.id}/expenses`, { method: 'POST', json: body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses', String(group.id)] })
      qc.invalidateQueries({ queryKey: ['balances', String(group.id)] })
      navigate(`/pots/${group.id}`)
    },
    onError: () => setError('Could not save'),
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
    if (splitWith.length === 0 && viaGroup.size === 0) return setError('Pick at least one person or group to split with')
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
      <Link to={`/pots/${group.id}`}>← {group.name}</Link>
      <h1>Add expense</h1>
      <input placeholder="What for?" value={description} onChange={(e) => setDescription(e.target.value)} required autoFocus />
      <input
        inputMode="decimal"
        placeholder={`Amount (${group.currency})`}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        required
      />
      <label className="row">
        Date
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      </label>
      <label className="row">
        Paid by
        <select value={paidBy} onChange={(e) => setPaidBy(Number(e.target.value))}>
          {people.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </label>
      <fieldset className="stack">
        <legend>Split equally between</legend>
        {shortcuts.map((g) => (
          <label key={`g${g.id}`}>
            <input type="checkbox" checked={splitGroups.includes(g.id)} onChange={() => toggleGroup(g.id)} /> <b>{g.name}</b>
          </label>
        ))}
        {people.map((p) => (
          <label key={p.id}>
            <input
              type="checkbox"
              checked={viaGroup.has(p.id) || splitWith.includes(p.id)}
              disabled={viaGroup.has(p.id)}
              onChange={() => toggle(p.id)}
            />{' '}
            {p.name}
          </label>
        ))}
      </fieldset>
      {error && <p className="error">{error}</p>}
      <button type="submit" disabled={add.isPending}>Add</button>
    </form>
  )
}
