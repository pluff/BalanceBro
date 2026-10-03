import { useParams } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, HandCoins, Receipt, ShoppingBag } from 'lucide-react'
import { api, type Balances, type Expense, type Group, type Settlement } from '../lib/api'
import { money, plain } from '../lib/money'
import Avatar from '../components/Avatar'
import { Loading } from '../components/Layout'

export default function GroupDetail() {
  const { id } = useParams()
  const { data: group } = useQuery({ queryKey: ['group', id], queryFn: () => api<Group>(`/groups/${id}`) })
  const { data: bal } = useQuery({ queryKey: ['balances', id], queryFn: () => api<Balances>(`/groups/${id}/balances`) })
  const { data: expenses } = useQuery({
    queryKey: ['expenses', id],
    queryFn: () => api<Expense[]>(`/groups/${id}/expenses`),
  })

  const { data: settlements } = useQuery({
    queryKey: ['settlements', id],
    queryFn: () => api<Settlement[]>(`/groups/${id}/settlements`),
  })

  if (!group || !expenses || !bal || !settlements) return <Loading />
  const people = group.participants ?? []
  const person = (pid: number) => people.find((p) => p.id === pid) ?? { name: `#${pid}`, avatar_url: null }
  // What the person consumed: their own share of every expense (same definition as the Balance page).
  const spent = (pid: number) => expenses.reduce((sum, e) => sum + (e.splits.find((x) => x.participant_id === pid)?.amount_cents ?? 0), 0)
  const net = (pid: number) => bal.balances.find((b) => b.participant_id === pid)?.amount_cents ?? 0
  const total = expenses.reduce((s, e) => s + e.amount_cents, 0)
  // Whole "What" cell is the link; any member may edit.
  const cell = (to: string, content: React.ReactNode) => <Link to={to} className="cell">{content}</Link>
  const label = (to: string, text: React.ReactNode) => <Link to={to} className="rowlink">{text}</Link>
  // Expenses and paybacks in one timeline, newest first (sort is stable, so same-day order is kept).
  const items = [
    ...expenses.map((e) => ({ kind: 'e' as const, key: `e${e.id}`, date: e.spent_on, e })),
    ...settlements.map((s) => ({ kind: 's' as const, key: `s${s.id}`, date: s.settled_on, s })),
  ].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <>
      <div className="cols potpage">
        <section className="card">
          <h2><Receipt size={14} /> History</h2>
          {items.length === 0 && <div className="empty"><ShoppingBag size={36} />No expenses yet.</div>}
          {items.length > 0 && (
            <div className="only-desktop tablewrap">
              <table className="ledger">
                <thead>
                  <tr>
                    <th>What</th>
                    <th className="num">Amount</th>
                    <th>Who paid</th>
                    {people.map((p) => (
                      <th key={p.id} className="num"><Link to={`/pots/${id}/people/${p.id}`} className="person" title={p.name}><Avatar person={p} size={18} />{p.short_name}</Link></th>
                    ))}
                  </tr>
                  <tr className="sum">
                    <td>Spent in total</td>
                    <td className="num">{plain(total)}</td>
                    <td />
                    {people.map((p) => (
                      <td key={p.id} className="num">{plain(spent(p.id))}</td>
                    ))}
                  </tr>
                  <tr className="sum">
                    <td>Balance</td>
                    <td />
                    <td />
                    {people.map((p) => {
                      const n = net(p.id)
                      return <td key={p.id} className={`num ${n > 0 ? 'pos' : n < 0 ? 'neg' : ''}`}>{n > 0 ? '+' : ''}{plain(n)}</td>
                    })}
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => {
                    if (it.kind === 's') {
                      const { from_participant_id: from, to_participant_id: to, amount_cents } = it.s
                      return (
                        <tr key={it.key} className="payback">
                          <td className="what">{cell(`/pots/${id}/settlements/${it.s.id}/edit`, <><span className="ellipsis"><HandCoins size={13} style={{ verticalAlign: '-2px' }} /> {it.s.description || 'Payback'} <small>{it.date}</small></span></>)}</td>
                          <td className="num"><b>{plain(amount_cents)}</b></td>
                          <td><span className="row start"><Avatar person={person(from)} size={18} /><span className="ellipsis">{person(from).name}</span></span></td>
                          {people.map((p) => (
                            <td key={p.id} className="num">{p.id === to ? plain(amount_cents) : ''}</td>
                          ))}
                        </tr>
                      )
                    }
                    const e = it.e
                    const share = new Map(e.splits.map((x) => [x.participant_id, x.amount_cents]))
                    const payer = person(e.paid_by_id)
                    return (
                      <tr key={it.key} className={e.unallocated ? 'unallocated' : undefined}>
                        <td className="what">{cell(`/pots/${id}/expenses/${e.id}/edit`, <span className="ellipsis">{e.description} <small>{e.spent_on}</small>{e.unallocated && <small className="badge-warn"> · not allocated</small>}</span>)}</td>
                        <td className="num"><b>{plain(e.amount_cents)}</b></td>
                        <td><span className="row start"><Avatar person={payer} size={18} /><span className="ellipsis">{payer.name}</span></span></td>
                        {people.map((p) => (
                          <td key={p.id} className="num">{share.has(p.id) ? plain(share.get(p.id)!) : ''}</td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          <ul className="list only-mobile">
            {items.map((it) => {
              if (it.kind === 's') {
                const { from_participant_id: from, to_participant_id: to, amount_cents } = it.s
                return (
                  <li key={it.key} className="expense">
                    <span className="when">{it.date}</span>
                    <span className="ellipsis">{label(`/pots/${id}/settlements/${it.s.id}/edit`, <><HandCoins size={14} style={{ verticalAlign: '-2px' }} /> {it.s.description || 'Payback'}</>)}</span>
                    <b className="amount">{money(amount_cents, group.currency)}</b>
                    <span className="meta">
                      <Avatar person={person(from)} size={20} /> {person(from).name}
                      <ArrowRight size={12} />
                      <Avatar person={person(to)} size={20} /> {person(to).name}
                    </span>
                  </li>
                )
              }
              const e = it.e
              return (
                <li key={it.key} className="expense">
                  <span className="when">{e.spent_on}</span>
                  <span className="ellipsis">{label(`/pots/${id}/expenses/${e.id}/edit`, e.description)}</span>
                  <b className="amount">{money(e.amount_cents, group.currency)}</b>
                  <span className="meta">
                    <Avatar person={person(e.paid_by_id)} size={20} /> {person(e.paid_by_id).name}
                    <ArrowRight size={12} />
                    {e.unallocated && <small className="badge-warn">not allocated</small>}
                    <span className="avatars">
                      {e.splits.map((s) => <Avatar key={s.participant_id} person={person(s.participant_id)} size={20} />)}
                    </span>
                    <span className="splitnames ellipsis">{e.splits.map((s) => person(s.participant_id).name).join(', ')}</span>
                  </span>
                </li>
              )
            })}
          </ul>
        </section>

      </div>
    </>
  )
}
