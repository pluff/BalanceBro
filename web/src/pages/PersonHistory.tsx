import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api, type Balances, type Expense, type Group, type Settlement } from '../lib/api'
import { money } from '../lib/money'
import Avatar from '../components/Avatar'

// One row of the person's ledger; `delta` is its effect on their balance (+ = owed to them).
type Entry = { key: string; id: number; date: string; title: string; note: string; delta: number }

export default function PersonHistory() {
  const { id, pid } = useParams()
  const personId = Number(pid)
  const { data: group } = useQuery({ queryKey: ['group', id], queryFn: () => api<Group>(`/groups/${id}`) })
  const { data: bal } = useQuery({ queryKey: ['balances', id], queryFn: () => api<Balances>(`/groups/${id}/balances`) })
  const { data: expenses } = useQuery({ queryKey: ['expenses', id], queryFn: () => api<Expense[]>(`/groups/${id}/expenses`) })
  const { data: settlements } = useQuery({
    queryKey: ['settlements', id],
    queryFn: () => api<Settlement[]>(`/groups/${id}/settlements`),
  })

  if (!group || !bal || !expenses || !settlements) return <p>Loading…</p>
  const person = group.participants?.find((p) => p.id === personId)
  if (!person) return <p>Not found.</p>
  const name = (x: number) => group.participants?.find((p) => p.id === x)?.name ?? `#${x}`
  const cur = group.currency

  let paid = 0
  let share = 0
  let settled = 0
  const entries: Entry[] = []

  for (const e of expenses) {
    const mine = e.splits.find((s) => s.participant_id === personId)?.amount_cents ?? 0
    const iPaid = e.paid_by_id === personId ? e.amount_cents : 0
    if (!mine && !iPaid) continue
    paid += iPaid
    share += mine
    const parts = [
      iPaid ? `paid ${money(iPaid, cur)}` : `paid by ${name(e.paid_by_id)}`,
      mine ? `own share ${money(mine, cur)}` : 'not part of the split',
    ]
    entries.push({
      key: `e${e.id}`,
      id: e.id,
      date: e.spent_on,
      title: `${e.description} (${money(e.amount_cents, cur)})`,
      note: parts.join(' · '),
      delta: iPaid - mine,
    })
  }

  for (const s of settlements) {
    if (s.from_participant_id !== personId && s.to_participant_id !== personId) continue
    const sent = s.from_participant_id === personId
    const delta = sent ? s.amount_cents : -s.amount_cents
    settled += delta
    entries.push({
      key: `s${s.id}`,
      id: s.id,
      date: s.settled_on,
      title: sent ? `Paid back ${name(s.to_participant_id)}` : `Received from ${name(s.from_participant_id)}`,
      note: 'settlement',
      delta,
    })
  }

  entries.sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
  const total = paid - share + settled
  const reported = bal.balances.find((b) => b.participant_id === personId)?.amount_cents ?? 0
  const signed = (n: number) => `${n > 0 ? '+' : ''}${money(n, cur)}`

  return (
    <div className="stack">
      <Link to={`/pots/${id}/balance`}>← Balance</Link>
      <h1 className="row" style={{ justifyContent: 'flex-start' }}><Avatar person={person} size={40} /> {person.name}</h1>

      <ul className="stack">
        <li className="row"><span>Paid in total</span><b>{money(paid, cur)}</b></li>
        <li className="row"><span>Own share of expenses</span><b>{money(share, cur)}</b></li>
        {settled !== 0 && <li className="row"><span>Settlements</span><b>{signed(settled)}</b></li>}
        <li className="row"><span>Balance</span><b>{signed(total)}</b></li>
      </ul>
      {total !== reported && <p className="error">Totals do not match the server balance ({signed(reported)}).</p>}

      <h2>History</h2>
      {entries.length === 0 && <p>Nothing involves {person.name} yet.</p>}
      <ul className="stack">
        {entries.map((e) => (
          <li key={e.key} className="expense">
            <div className="row">
              <span>{e.title}</span>
              <b>{signed(e.delta)}</b>
            </div>
            <small>{e.date} · {e.note}</small>
          </li>
        ))}
      </ul>
    </div>
  )
}
