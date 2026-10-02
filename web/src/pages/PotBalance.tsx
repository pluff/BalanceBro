import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api, type Balances, type Expense, type Group } from '../lib/api'
import { money } from '../lib/money'
import Avatar from '../components/Avatar'

export default function PotBalance() {
  const { id } = useParams()
  const { data: group } = useQuery({ queryKey: ['group', id], queryFn: () => api<Group>(`/groups/${id}`) })
  const { data: bal } = useQuery({ queryKey: ['balances', id], queryFn: () => api<Balances>(`/groups/${id}/balances`) })

  const { data: expenses } = useQuery({
    queryKey: ['expenses', id],
    queryFn: () => api<Expense[]>(`/groups/${id}/expenses`),
  })

  if (!group || !bal || !expenses) return <p>Loading…</p>
  const people = group.participants ?? []
  const name = (pid: number) => people.find((p) => p.id === pid)?.name ?? `#${pid}`
  // What the person consumed: their own share of every expense (not what they paid out of pocket).
  const spent = (pid: number) => expenses.reduce((sum, e) => sum + (e.splits.find((s) => s.participant_id === pid)?.amount_cents ?? 0), 0)
  const net = (pid: number) => bal.balances.find((b) => b.participant_id === pid)?.amount_cents ?? 0

  return (
    <div className="stack">
      <Link to={`/pots/${id}`}>← {group.name}</Link>
      <h1>Balance</h1>

      <h2>Per person</h2>
      <ul className="stack">
        {people.map((p) => {
          const n = net(p.id)
          return (
            <li key={p.id}>
              <Link to={`/pots/${id}/people/${p.id}`} className="row person">
                <Avatar person={p} />
                <span className="grow">
                  {p.name}
                  <br />
                  <small>Spent {money(spent(p.id), group.currency)} · Balance {n > 0 ? '+' : ''}{money(n, group.currency)}</small>
                </span>
                <b>›</b>
              </Link>
            </li>
          )
        })}
      </ul>

      <h2>Who pays whom</h2>
      {bal.transfers.length === 0 && <p>All settled up.</p>}
      <ul className="stack">
        {bal.transfers.map((t, i) => (
          <li key={i}>
            {name(t.from_participant_id)} → {name(t.to_participant_id)}: <b>{money(t.amount_cents, group.currency)}</b>
          </li>
        ))}
      </ul>
    </div>
  )
}
