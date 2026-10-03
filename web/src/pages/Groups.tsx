import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronRight, PiggyBank, Plus, RotateCcw, Trash2, Users } from 'lucide-react'
import { api, type DeletedGroup, type Group } from '../lib/api'
import { CURRENCIES } from '../lib/money'
import { Loading, PageHead } from '../components/Layout'

export default function Groups() {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState('EUR')
  const [confirmId, setConfirmId] = useState<number | null>(null)
  const { data: groups } = useQuery({ queryKey: ['groups'], queryFn: () => api<Group[]>('/groups') })
  const { data: deleted } = useQuery({ queryKey: ['groups', 'deleted'], queryFn: () => api<DeletedGroup[]>('/groups/deleted') })
  const refreshAll = () => qc.invalidateQueries({ queryKey: ['groups'] }) // also covers ['groups', 'deleted']
  const restore = useMutation({
    mutationFn: (gid: number) => api(`/groups/${gid}/restore`, { method: 'POST' }),
    onSuccess: refreshAll,
  })
  const purge = useMutation({
    mutationFn: (gid: number) => api(`/groups/${gid}/purge`, { method: 'DELETE' }),
    onSuccess: () => { setConfirmId(null); refreshAll() },
    onError: () => setConfirmId(null),
  })
  const create = useMutation({
    mutationFn: () => api<Group>('/groups', { method: 'POST', json: { name, currency } }),
    onSuccess: () => {
      setName('')
      qc.invalidateQueries({ queryKey: ['groups'] })
    },
  })

  if (!groups) return <Loading />
  return (
    <div className="stack">
      <PageHead title="MoneyPots" />
      <form className="card row" onSubmit={(e) => { e.preventDefault(); create.mutate() }}>
        <input placeholder="New MoneyPot" value={name} onChange={(e) => setName(e.target.value)} required />
        <select aria-label="Currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
          {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <button type="submit" className="primary" aria-label="Add MoneyPot" disabled={create.isPending}><Plus size={18} /><span className="hide-sm"> Add</span></button>
      </form>
      {groups.length === 0 && <div className="empty"><PiggyBank size={40} />No MoneyPots yet. Create the first one.</div>}
      <ul className="pots stack" style={{ display: 'grid' }}>
        {groups.map((g) => (
          <li key={g.id}>
            <Link to={`/pots/${g.id}`} className="card pot">
              <span className="pot-ico"><PiggyBank size={22} /></span>
              <span className="grow">
                <b className="ellipsis" style={{ display: 'block' }}>{g.name}</b>
                <small>{g.currency}</small>
              </span>
              {!g.is_owner && <span className="badge"><Users size={12} /> shared</span>}
              <ChevronRight size={18} className="muted" />
            </Link>
          </li>
        ))}
      </ul>
      {deleted && deleted.length > 0 && (
        <section className="card stack">
          <h2><Trash2 size={14} /> Deleted</h2>
          <small>Restore a MoneyPot, or delete it forever with all its people, expenses, paybacks and audit logs.</small>
          <ul className="list">
            {deleted.map((g) => (
              <li key={g.id} className="row">
                <span className="grow">
                  <b className="ellipsis" style={{ display: 'block' }}>{g.name}</b>
                  <small>{g.currency} · deleted {new Date(g.deleted_at).toLocaleDateString()}</small>
                </span>
                <button type="button" className="link icon" aria-label="Restore" title="Restore" disabled={restore.isPending} onClick={() => restore.mutate(g.id)}><RotateCcw size={18} /></button>
                {confirmId === g.id ? (
                  <button type="button" className="danger" disabled={purge.isPending} onClick={() => purge.mutate(g.id)}>Delete forever?</button>
                ) : (
                  <button type="button" className="link icon danger" aria-label="Delete forever" title="Delete forever" onClick={() => setConfirmId(g.id)}><Trash2 size={18} /></button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
