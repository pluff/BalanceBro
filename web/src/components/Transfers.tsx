import { Link } from 'react-router-dom'
import { ArrowRight, HandCoins } from 'lucide-react'
import type { Balances, Participant } from '../lib/api'
import { money } from '../lib/money'
import Avatar from './Avatar'

type Person = Pick<Participant, 'name' | 'avatar_url'> & { short_name?: string }

// "Who pays whom" rows, shared by the pot page and the Balance page.
export default function Transfers({ transfers, person, currency, settleBase }: { transfers: Balances['transfers']; person: (id: number) => Person; currency: string; settleBase?: string }) {
  return (
    <ul className="list">
      {transfers.map((t, i) => (
        <li key={i} className="transfer">
          <Avatar person={person(t.from_participant_id)} size={26} />
          <span className="ellipsis">{person(t.from_participant_id).name}</span>
          <ArrowRight size={14} className="muted" />
          <Avatar person={person(t.to_participant_id)} size={26} />
          <span className="grow ellipsis">{person(t.to_participant_id).name}</span>
          <b className="amount">{money(t.amount_cents, currency)}</b>
          {settleBase && (
            <Link to={`${settleBase}?from=${t.from_participant_id}&to=${t.to_participant_id}&amount=${t.amount_cents}`} className="btn icon" aria-label="Record payback" title="Record payback"><HandCoins size={18} /></Link>
          )}
        </li>
      ))}
    </ul>
  )
}
