import type { Participant } from '../lib/api'

// Google profile picture when the person signed in with Google, otherwise their initial.
export default function Avatar({ person, size = 28 }: { person: Pick<Participant, 'name' | 'avatar_url'>; size?: number }) {
  const style = { width: size, height: size, borderRadius: '50%', flex: 'none' as const }
  if (person.avatar_url)
    return <img src={person.avatar_url} alt={person.name} title={person.name} referrerPolicy="no-referrer" style={{ ...style, objectFit: 'cover' }} />
  return (
    <span title={person.name} aria-label={person.name} style={{ ...style, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#8884', fontSize: size * 0.5 }}>
      {person.name.trim().charAt(0).toUpperCase()}
    </span>
  )
}
