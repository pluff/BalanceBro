import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useMatch, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError, setToken, type Group, type User } from '../lib/api'
import { useAuth } from '../lib/auth'
import { renderGoogleButton } from '../lib/gsi'

type Invite = { group_id: number; name: string; member: boolean; participants: { id: number; name: string }[] }
type Joined = Group & { token: string | null }

const NEW = 'new'

// Opened from a share link, no sign-in needed: pick who you are in the MoneyPot or type a new name.
export default function Join() {
  // useMatch, not useParams: when signed out App renders this outside <Routes>, so there are no route params.
  const token = useMatch('/join/:token')?.params.token
  const { authed, adoptToken } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [pick, setPick] = useState<string>('') // participant id, or NEW
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const { data: invite, isError } = useQuery({
    queryKey: ['invite', token],
    queryFn: () => api<Invite>(`/join/${token}`),
    retry: false,
  })

  // Already in this pot (owner, or joined earlier): nothing to choose.
  useEffect(() => {
    if (invite?.member) navigate(`/pots/${invite.group_id}`, { replace: true })
  }, [invite, navigate])

  // Who the person says they are: an existing participant, or a new name. null = nothing chosen yet.
  const choice = () => {
    if (pick === NEW) return name.trim() ? { name } : null
    return pick ? { participant_id: Number(pick) } : null
  }

  const fail = (e: unknown) => {
    setBusy(false)
    const taken = e instanceof ApiError && e.status === 422 && JSON.stringify(e.body).includes('already used')
    setError(taken ? 'This name is already in the MoneyPot — pick it from the list' : 'Could not join')
  }

  const finish = (g: Joined, sessionToken: string | null) => {
    if (sessionToken) adoptToken(sessionToken)
    qc.invalidateQueries({ queryKey: ['groups'] })
    navigate(`/pots/${g.id}`, { replace: true })
  }

  // Signed in already -> joins as that account. Signed out -> a guest account is created.
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const c = choice()
    if (!c) return setError('Pick who you are first')
    setError('')
    setBusy(true)
    api<Joined>('/join', { method: 'POST', json: { token, ...c } })
      .then((g) => finish(g, g.token))
      .catch(fail)
  }

  // Google instead of a guest: sign in first (token stored so /join sees a real account), then join.
  // The button's callback is registered once, so it reads the latest choice through a ref.
  const googleJoin = useRef<(idToken: string) => void>(() => {})
  useEffect(() => {
    googleJoin.current = async (idToken) => {
      const c = choice()
      if (!c) return setError('Pick who you are first, then sign in with Google')
      setError('')
      setBusy(true)
      try {
        const login = await api<{ token: string; user: User }>('/auth/google', { method: 'POST', json: { id_token: idToken } })
        setToken(login.token)
        const g = await api<Joined>('/join', { method: 'POST', json: { token, ...c } })
        finish(g, login.token)
      } catch (e) {
        setToken(null)
        fail(e)
      }
    }
  })
  const googleBtn = useRef<HTMLDivElement>(null)
  const showForm = !!invite && !invite.member
  useEffect(() => {
    if (!showForm || authed || !googleBtn.current) return
    renderGoogleButton(googleBtn.current, (t) => googleJoin.current(t)).catch(() => {}) // guest join still works
  }, [showForm, authed])

  if (isError)
    return (
      <div className="stack">
        <p className="error">This link is invalid or was revoked</p>
        {authed && <Link to="/">← MoneyPots</Link>}
      </div>
    )
  if (!invite || invite.member) return <p>Loading…</p>

  return (
    <form className="stack" onSubmit={submit}>
      <h1>{invite.name}</h1>
      <p>You were invited to this MoneyPot. Who are you?</p>
      {invite.participants.map((p) => (
        <label key={p.id}>
          <input type="radio" name="who" checked={pick === String(p.id)} onChange={() => setPick(String(p.id))} /> {p.name}
        </label>
      ))}
      <label>
        <input type="radio" name="who" checked={pick === NEW} onChange={() => setPick(NEW)} /> I’m someone new
      </label>
      {pick === NEW && (
        <input placeholder="Your name" value={name} maxLength={50} onChange={(e) => setName(e.target.value)} required autoFocus />
      )}
      {error && <p className="error">{error}</p>}
      {!authed && (
        <>
          <div ref={googleBtn} />
          <small>or just</small>
        </>
      )}
      <button type="submit" disabled={busy || !pick}>{authed ? 'Join' : 'Join as guest'}</button>
    </form>
  )
}
