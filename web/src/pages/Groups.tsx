import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronRight, PiggyBank, Plus, Users } from 'lucide-react'
import { api, type Group } from '../lib/api'
import { CURRENCIES } from '../lib/money'
import { Loading, PageHead } from '../components/Layout'

export default function Groups() {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState('EUR')
  const { data: groups } = useQuery({ queryKey: ['groups'], queryFn: () => api<Group[]>('/groups') })
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
    </div>
  )
}
