import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, HandCoins, ChevronRight, PartyPopper, Scale } from 'lucide-react'
import { api, type Balances, type Expense, type Group } from '../lib/api'
import { money } from '../lib/money'
import Avatar from '../components/Avatar'
import Transfers from '../components/Transfers'
import { Loading, PageHead } from '../components/Layout'

export default function PotBalance() {
  const { id } = useParams()
  const { data: group } = useQuery({ queryKey: ['group', id], queryFn: () => api<Group>(`/groups/${id}`) })
  const { data: bal } = useQuery({ queryKey: ['balances', id], queryFn: () => api<Balances>(`/groups/${id}/balances`) })

  const { data: expenses } = useQuery({
    queryKey: ['expenses', id],
    queryFn: () => api<Expense[]>(`/groups/${id}/expenses`),
  })

  if (!group || !bal || !expenses) return <Loading />
  const people = group.participants ?? []
  const find = (pid: number) => people.find((p) => p.id === pid) ?? { name: `#${pid}`, avatar_url: null }
  // What the person consumed: their own share of every expense (not what they paid out of pocket).
  const spent = (pid: number) => expenses.reduce((sum, e) => sum + (e.splits.find((s) => s.participant_id === pid)?.amount_cents ?? 0), 0)
  const net = (pid: number) => bal.balances.find((b) => b.participant_id === pid)?.amount_cents ?? 0

  return (
    <>
      <PageHead title="Balance" back={`/pots/${id}`}>
        {group.is_owner && <Link to={`/pots/${id}/settlements/new`} className="btn"><HandCoins size={18} /><span className="hide-sm">Add payback</span></Link>}
      </PageHead>
      <div className="cols even">
        <section className="card">
          <h2><Scale size={14} /> Per person</h2>
          <ul className="list">
            {people.map((p) => {
              const n = net(p.id)
              return (
                <li key={p.id}>
                  <Link to={`/pots/${id}/people/${p.id}`} className="person">
                    <Avatar person={p} size={34} />
                    <span className="grow">
                      <b className="ellipsis" style={{ display: 'block' }}>{p.name}</b>
                      <small>Spent {money(spent(p.id), group.currency)}</small>
                    </span>
                    <b className={`amount ${n > 0 ? 'pos' : n < 0 ? 'neg' : ''}`}>{n > 0 ? '+' : ''}{money(n, group.currency)}</b>
                    <ChevronRight size={16} className="muted" />
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>

        <section className="card">
          <h2><ArrowRight size={14} /> Who pays whom</h2>
          {bal.transfers.length === 0 && <div className="empty"><PartyPopper size={36} />All settled up.</div>}
          <Transfers transfers={bal.transfers} person={find} currency={group.currency} settleBase={group.is_owner ? `/pots/${id}/settlements/new` : undefined} />
        </section>
      </div>
    </>
  )
}
