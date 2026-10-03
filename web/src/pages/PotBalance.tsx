import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, HandCoins, PartyPopper, Scale } from 'lucide-react'
import { api, type Balances, type Expense, type Group } from '../lib/api'
import { plain } from '../lib/money'
import { packCircles } from '../lib/pack'
import Transfers from '../components/Transfers'
import UnallocatedWarning from '../components/UnallocatedWarning'
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

  const maxAbs = Math.max(0, ...people.map((p) => Math.abs(net(p.id))))
  // Radius grows with the amount (~ ratio^0.35), between 0.5 and 1 so small balances stay readable
  // and the biggest circle doesn't dwarf the rest.
  const radius = (pid: number) => 0.5 + 0.5 * (maxAbs ? Math.pow(Math.abs(net(pid)) / maxAbs, 0.35) : 0)
  const cloud = packCircles(people.map((p) => radius(p.id)), 0.04)

  return (
    <>
      <PageHead title="Balance" back={`/pots/${id}`}>
        <Link to={`/pots/${id}/settlements/new`} className="btn"><HandCoins size={18} /><span className="hide-sm">Add payback</span></Link>
      </PageHead>
      <UnallocatedWarning count={bal.unallocated_count} />
      <div className="cols even">
        <section className="card">
          <h2><Scale size={14} /> Debt map</h2>
          <div className="cloudwrap">
            <div className="cloud" style={{ aspectRatio: `${cloud.width} / ${cloud.height}`, maxWidth: cloud.width * 115 }}>
              {people.map((p, i) => {
                const n = net(p.id)
                const c = cloud.circles[i]
                return (
                  <Link
                    key={p.id}
                    to={`/pots/${id}/people/${p.id}`}
                    className={`bubble ${n > 0 ? 'owed' : n < 0 ? 'owes' : 'even'}`}
                    style={{
                      left: `${((c.x - c.r) / cloud.width) * 100}%`,
                      top: `${((c.y - c.r) / cloud.height) * 100}%`,
                      width: `${((2 * c.r) / cloud.width) * 100}%`,
                    }}
                    title={`${p.name}: ${n > 0 ? 'is owed' : n < 0 ? 'owes' : 'settled'}`}
                  >
                    <span className="bin">
                      {p.avatar_url && <img className="bav" src={p.avatar_url} alt="" referrerPolicy="no-referrer" />}
                      <b className="bname">{p.name}</b>
                      <b className="bbal">{n > 0 ? '+' : ''}{plain(n)}</b>
                      <small>Spent {plain(spent(p.id))}</small>
                    </span>
                  </Link>
                )
              })}
            </div>
          </div>
        </section>

        <section className="card">
          <h2><ArrowRight size={14} /> Who pays whom</h2>
          {bal.transfers.length === 0 && <div className="empty"><PartyPopper size={36} />All settled up.</div>}
          <Transfers transfers={bal.transfers} person={find} currency={group.currency} settleBase={`/pots/${id}/settlements/new`} />
        </section>
      </div>
    </>
  )
}
