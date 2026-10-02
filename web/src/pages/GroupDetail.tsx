import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api, type Expense, type Group } from '../lib/api'
import { money } from '../lib/money'
import Avatar from '../components/Avatar'

export default function GroupDetail() {
  const { id } = useParams()
  const { data: group } = useQuery({ queryKey: ['group', id], queryFn: () => api<Group>(`/groups/${id}`) })
  const { data: expenses } = useQuery({
    queryKey: ['expenses', id],
    queryFn: () => api<Expense[]>(`/groups/${id}/expenses`),
  })

  if (!group || !expenses) return <p>Loading…</p>
  const people = group.participants ?? []
  const person = (pid: number) => people.find((p) => p.id === pid) ?? { name: `#${pid}`, avatar_url: null }

  return (
    <div className="stack">
      <Link to="/">← MoneyPots</Link>
      <header className="row">
        <h1>{group.name}</h1>
        <span className="row">
          <Link to={`/pots/${id}/balance`}>Balance</Link>
          <Link to={`/pots/${id}/settings`}>Settings</Link>
        </span>
      </header>

      <header className="row">
        <h2>History</h2>
        <Link to={`/pots/${id}/expenses/new`}>+ Add expense</Link>
      </header>
      {expenses.length === 0 && <p>No expenses yet.</p>}
      <ul className="stack">
        {expenses.map((e) => (
          <li key={e.id} className="expense">
            <div className="row">
              <span>{e.description}</span>
              <b>{money(e.amount_cents, group.currency)}</b>
            </div>
            <small className="row" style={{ justifyContent: 'flex-start' }}>
              paid by <Avatar person={person(e.paid_by_id)} size={22} /> · split:
              {e.splits.map((s) => <Avatar key={s.participant_id} person={person(s.participant_id)} size={22} />)}
            </small>
          </li>
        ))}
      </ul>
    </div>
  )
}
