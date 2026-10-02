import { useParams } from 'react-router-dom'
import { HandCoins, History } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { api, type Balances, type Expense, type Group, type Settlement } from '../lib/api'
import { money } from '../lib/money'
import Avatar from '../components/Avatar'
import { Loading, PageHead } from '../components/Layout'

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

  if (!group || !bal || !expenses || !settlements) return <Loading />
  const person = group.participants?.find((p) => p.id === personId)
  if (!person) return <p className="empty">Not found.</p>
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
      note: s.description || 'settlement',
      delta,
    })
  }

  entries.sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
  const total = paid - share + settled
  const reported = bal.balances.find((b) => b.participant_id === personId)?.amount_cents ?? 0
  const signed = (n: number) => `${n > 0 ? '+' : ''}${money(n, cur)}`

  const tone = (n: number) => (n > 0 ? 'pos' : n < 0 ? 'neg' : '')

  return (
    <>
      <PageHead title={<span className="row start"><Avatar person={person} size={36} /> <span className="ellipsis">{person.name}</span></span>} back={`/pots/${id}/balance`} />

      <div className="stack">
        <div className="stats">
          <div className="stat"><small>Paid in total</small><b>{money(paid, cur)}</b></div>
          <div className="stat"><small>Own share</small><b>{money(share, cur)}</b></div>
          {settled !== 0 && <div className="stat"><small>Settlements</small><b className={tone(settled)}>{signed(settled)}</b></div>}
          <div className="stat"><small>Balance</small><b className={tone(total)}>{signed(total)}</b></div>
        </div>
        {total !== reported && <p className="error">Totals do not match the server balance ({signed(reported)}).</p>}

        <section className="card">
          <h2><History size={14} /> History</h2>
          {entries.length === 0 && <p className="muted">Nothing involves {person.name} yet.</p>}
          <ul className="list">
            {entries.map((e) => (
              <li key={e.key} className="expense">
                <span className="when">{e.date}</span>
                <span className="ellipsis">{e.key.startsWith('s') && <HandCoins size={14} style={{ verticalAlign: '-2px', marginRight: 4 }} />}{e.title}</span>
                <b className={`amount ${tone(e.delta)}`}>{signed(e.delta)}</b>
                <span className="meta"><span className="splitnames-mobile">{e.date} · </span>{e.note}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  )
}
