import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type Group } from '../lib/api'
import { useAuth } from '../lib/auth'
import { CURRENCIES } from '../lib/money'

export default function Groups() {
  const qc = useQueryClient()
  const { logout } = useAuth()
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState('EUR')
  const { data: groups = [] } = useQuery({ queryKey: ['groups'], queryFn: () => api<Group[]>('/groups') })
  const create = useMutation({
    mutationFn: () => api<Group>('/groups', { method: 'POST', json: { name, currency } }),
    onSuccess: () => {
      setName('')
      qc.invalidateQueries({ queryKey: ['groups'] })
    },
  })

  return (
    <div className="stack">
      <header className="row">
        <h1>MoneyPots</h1>
        <button className="link" onClick={logout}>Log out</button>
      </header>
      <ul className="stack">
        {groups.map((g) => (
          <li key={g.id}><Link to={`/pots/${g.id}`}>{g.name}</Link>{!g.is_owner && <small> · shared</small>}</li>
        ))}
      </ul>
      <form className="row" onSubmit={(e) => { e.preventDefault(); create.mutate() }}>
        <input placeholder="New MoneyPot" value={name} onChange={(e) => setName(e.target.value)} required />
        <select aria-label="Currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
          {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <button type="submit">Add</button>
      </form>
    </div>
  )
}
