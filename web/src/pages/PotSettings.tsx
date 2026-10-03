import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowDown, ArrowUp, Check, Copy, Link2, Link2Off, Pencil, Plus, Trash2, UserPlus, Users, Wallet, X } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CURRENCIES } from '../lib/money'
import Avatar from '../components/Avatar'
import { Loading, PageHead } from '../components/Layout'
import { api, ApiError, type Group, type Participant, type ParticipantGroup } from '../lib/api'

const errMessage = (e: unknown, inUse = 'Could not save') => {
  if (e instanceof ApiError && e.status === 422) {
    const body = e.body as { details?: { name?: string[] } | string[] } | null
    if (body && !Array.isArray(body.details) && body.details?.name) return 'This name is already in the MoneyPot'
    return inUse
  }
  return 'Something went wrong'
}

export default function PotSettings() {
  const { id } = useParams()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [confirmPot, setConfirmPot] = useState(false)
  const [newName, setNewName] = useState('')
  const [newShort, setNewShort] = useState('')
  const [editing, setEditing] = useState<{ id: number; name: string; short_name: string } | null>(null)
  const [confirmId, setConfirmId] = useState<number | null>(null)
  const [error, setError] = useState('')
  // `id: null` = creating a new group of people.
  const [draft, setDraft] = useState<{ id: number | null; name: string; ids: number[] } | null>(null)
  const [confirmGroupId, setConfirmGroupId] = useState<number | null>(null)

  const { data: group } = useQuery({ queryKey: ['group', id], queryFn: () => api<Group>(`/groups/${id}`) })

  const [potName, setPotName] = useState<string | null>(null) // null = not editing
  const [copied, setCopied] = useState(false)

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['group', id] })
    qc.invalidateQueries({ queryKey: ['balances', id] })
    qc.invalidateQueries({ queryKey: ['expenses', id] }) // group edits change every split that uses the group
  }
  const refreshPot = () => {
    qc.invalidateQueries({ queryKey: ['group', id] })
    qc.invalidateQueries({ queryKey: ['groups'] })
  }
  const updatePot = useMutation({
    mutationFn: (changes: { name?: string; currency?: string }) => api(`/groups/${id}`, { method: 'PATCH', json: changes }),
    onSuccess: () => { setPotName(null); setError(''); refreshPot() },
    onError: () => setError('Could not save'),
  })
  const deletePot = useMutation({
    mutationFn: () => api(`/groups/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['groups'] })
      qc.invalidateQueries({ queryKey: ['groups', 'deleted'] })
      navigate('/')
    },
    onError: () => { setConfirmPot(false); setError('Could not delete the MoneyPot') },
  })
  const enableShare = useMutation({
    mutationFn: () => api(`/groups/${id}/share`, { method: 'POST' }),
    onSuccess: refreshPot,
    onError: () => setError('Could not create the link'),
  })
  const disableShare = useMutation({
    mutationFn: () => api(`/groups/${id}/share`, { method: 'DELETE' }),
    onSuccess: refreshPot,
    onError: () => setError('Could not revoke the link'),
  })
  const fail = (inUse?: string) => (e: unknown) => setError(errMessage(e, inUse))
  const base = `/groups/${id}/participants`

  const add = useMutation({
    mutationFn: () => api(base, { method: 'POST', json: { name: newName, ...(newShort && { short_name: newShort }) } }),
    onSuccess: () => { setNewName(''); setNewShort(''); setError(''); refresh() },
    onError: fail(),
  })
  const rename = useMutation({
    mutationFn: (p: { id: number; name: string; short_name: string }) =>
      api(`${base}/${p.id}`, { method: 'PATCH', json: { name: p.name, short_name: p.short_name } }),
    onSuccess: () => { setEditing(null); setError(''); refresh() },
    onError: fail(),
  })
  const remove = useMutation({
    mutationFn: (pid: number) => api(`${base}/${pid}`, { method: 'DELETE' }),
    onSuccess: () => { setConfirmId(null); setError(''); refresh() },
    onError: (e) => { setConfirmId(null); fail('Used in expenses or settlements, so it can’t be deleted')(e) },
  })
  const reorder = useMutation({
    mutationFn: (ids: number[]) => api(`${base}/order`, { method: 'PUT', json: { ids } }),
    onSuccess: refresh,
    onError: fail(),
  })

  const saveGroup = useMutation({
    mutationFn: (d: { id: number | null; name: string; ids: number[] }) =>
      api(d.id === null ? `/groups/${id}/participant_groups` : `/groups/${id}/participant_groups/${d.id}`, {
        method: d.id === null ? 'POST' : 'PATCH',
        json: { name: d.name, participant_ids: d.ids },
      }),
    onSuccess: () => { setDraft(null); setError(''); refresh() },
    onError: fail(),
  })
  const removeGroup = useMutation({
    mutationFn: (gid: number) => api(`/groups/${id}/participant_groups/${gid}`, { method: 'DELETE' }),
    onSuccess: () => { setConfirmGroupId(null); setError(''); refresh() },
    onError: (e) => { setConfirmGroupId(null); fail('Used in expenses, so it can’t be deleted')(e) },
  })

  if (!group) return <Loading />
  const people = group.participants ?? []

  const move = (index: number, delta: -1 | 1) => {
    const ids = people.map((p) => p.id)
    const j = index + delta
    ;[ids[index], ids[j]] = [ids[j], ids[index]]
    reorder.mutate(ids)
  }

  const groups: ParticipantGroup[] = group.participant_groups ?? []
  const toggleMember = (pid: number) =>
    setDraft((d) => d && { ...d, ids: d.ids.includes(pid) ? d.ids.filter((x) => x !== pid) : [...d.ids, pid] })

  const isOwner = (p: Participant) => p.user_id === group.owner_id
  const canManage = group.is_owner // members can read, add/edit expenses and paybacks and create groups; the rest is the owner's
  const shareUrl = group.share_token ? `${import.meta.env.VITE_APP_URL || window.location.origin}/#/join/${group.share_token}` : ''
  const copyLink = () =>
    navigator.clipboard.writeText(shareUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) }).catch(() => {})

  return (
    <>
      <PageHead title="Settings" back={`/pots/${id}`} />
      {error && <p className="error" style={{ marginBottom: 12 }}>{error}</p>}
      <div className="cols three">
        <div className="stack">
          {canManage && (
            <section className="card stack">
              <h2><Wallet size={14} /> MoneyPot</h2>
              <div className="row">
                {potName === null ? (
                  <span className="row start grow">
                    <b className="ellipsis">{group.name}</b>
                    <button type="button" className="link icon" aria-label="Rename" title="Rename" onClick={() => setPotName(group.name)}><Pencil size={18} /></button>
                  </span>
                ) : (
                  <form className="row grow" onSubmit={(e) => { e.preventDefault(); updatePot.mutate({ name: potName }) }}>
                    <input autoFocus value={potName} onChange={(e) => setPotName(e.target.value)} required />
                    <button type="submit" className="primary icon" aria-label="Save" disabled={updatePot.isPending}><Check size={18} /></button>
                    <button type="button" className="icon" aria-label="Cancel" onClick={() => setPotName(null)}><X size={18} /></button>
                  </form>
                )}
                <select aria-label="Currency" value={group.currency} disabled={updatePot.isPending} onChange={(e) => updatePot.mutate({ currency: e.target.value })}>
                  {(CURRENCIES.includes(group.currency) ? CURRENCIES : [group.currency, ...CURRENCIES]).map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <small>Changing the currency only relabels existing amounts, it does not convert them.</small>
              {confirmPot ? (
                <span className="row">
                  <button type="button" className="danger" disabled={deletePot.isPending} onClick={() => deletePot.mutate()}>Really delete?</button>
                  <button type="button" onClick={() => setConfirmPot(false)}>Cancel</button>
                </span>
              ) : (
                <button type="button" className="danger" onClick={() => setConfirmPot(true)}><Trash2 size={16} /> Delete MoneyPot</button>
              )}
              <small>Deleted MoneyPots move to “Deleted” on the MoneyPots page, where you can restore or erase them for good.</small>
            </section>
          )}

          {canManage && (
            <section className="card stack">
              <h2><Link2 size={14} /> Sharing</h2>
              <small>Anyone with the link can view this MoneyPot, add expenses and create groups of people. Only you can rename or delete things.</small>
              {shareUrl ? (
                <div className="row">
                  <input readOnly value={shareUrl} onFocus={(e) => e.target.select()} />
                  <button type="button" className="primary icon" aria-label={copied ? 'Copied' : 'Copy link'} title={copied ? 'Copied' : 'Copy link'} onClick={copyLink}>{copied ? <Check size={18} /> : <Copy size={18} />}</button>
                  <button type="button" className="icon danger" aria-label="Stop sharing" title="Stop sharing" onClick={() => disableShare.mutate()}><Link2Off size={18} /></button>
                </div>
              ) : (
                <button type="button" className="primary" onClick={() => enableShare.mutate()} disabled={enableShare.isPending}><Link2 size={16} /> Create share link</button>
              )}
            </section>
          )}
        </div>

        <section className="card stack">
          <h2><UserPlus size={14} /> People</h2>
          <ul className="list">
            {people.map((p, i) => (
              <li key={p.id} className="row">
                {editing?.id === p.id ? (
                  <form className="row grow" onSubmit={(e) => { e.preventDefault(); rename.mutate(editing) }}>
                    <input autoFocus maxLength={20} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} required />
                    <input className="short" aria-label="Short name" placeholder="ABC" maxLength={3} value={editing.short_name} onChange={(e) => setEditing({ ...editing, short_name: e.target.value.toUpperCase() })} required />
                    <button type="submit" className="primary icon" aria-label="Save"><Check size={18} /></button>
                    <button type="button" className="icon" aria-label="Cancel" onClick={() => setEditing(null)}><X size={18} /></button>
                  </form>
                ) : (
                  <>
                    <Avatar person={p} size={32} />
                    <span className="grow ellipsis">{p.name}{isOwner(p) && <span className="badge" style={{ marginLeft: 6 }}>owner</span>}</span>
                    {canManage && (
                      <>
                        <button type="button" className="link icon" aria-label="Move up" disabled={i === 0 || reorder.isPending} onClick={() => move(i, -1)}><ArrowUp size={16} /></button>
                        <button type="button" className="link icon" aria-label="Move down" disabled={i === people.length - 1 || reorder.isPending} onClick={() => move(i, 1)}><ArrowDown size={16} /></button>
                        <button type="button" className="link icon" aria-label="Rename" title="Rename" onClick={() => { setEditing({ id: p.id, name: p.name, short_name: p.short_name }); setConfirmId(null) }}><Pencil size={16} /></button>
                      </>
                    )}
                    {canManage && !isOwner(p) &&
                      (confirmId === p.id ? (
                        <button type="button" className="danger" onClick={() => remove.mutate(p.id)}>Really delete?</button>
                      ) : (
                        <button type="button" className="link icon danger" aria-label="Delete" title="Delete" onClick={() => setConfirmId(p.id)}><Trash2 size={16} /></button>
                      ))}
                  </>
                )}
              </li>
            ))}
          </ul>
          {canManage && (
            <form className="row" onSubmit={(e) => { e.preventDefault(); add.mutate() }}>
              <input maxLength={20} placeholder="Add person by name" value={newName} onChange={(e) => setNewName(e.target.value)} required />
              <input className="short" aria-label="Short name" placeholder="ABC" maxLength={3} value={newShort} onChange={(e) => setNewShort(e.target.value.toUpperCase())} />
              <button type="submit" className="primary icon" aria-label="Add person"><Plus size={18} /></button>
            </form>
          )}
        </section>

        <section className="card stack">
          <h2><Users size={14} /> Groups of people</h2>
          <small>Shortcuts for the “Split equally between” list when adding an expense.</small>
          {groups.length === 0 && !draft && <p className="muted">No groups yet.</p>}
          <ul className="list">
            {groups.map((g) => (
              <li key={g.id} className="row">
                <span className="grow">
                  <b>{g.name}</b>
                  <br />
                  <small>{g.participant_ids.map((x) => people.find((p) => p.id === x)?.name).filter(Boolean).join(', ')}</small>
                </span>
                {canManage && (
                  <>
                    <button type="button" className="link icon" aria-label="Edit" title="Edit" onClick={() => { setDraft({ id: g.id, name: g.name, ids: g.participant_ids }); setConfirmGroupId(null) }}><Pencil size={18} /></button>
                    {confirmGroupId === g.id ? (
                      <button type="button" className="danger" onClick={() => removeGroup.mutate(g.id)}>Really delete?</button>
                    ) : (
                      <button type="button" className="link icon danger" aria-label="Delete" title="Delete" onClick={() => setConfirmGroupId(g.id)}><Trash2 size={18} /></button>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>

          {draft ? (
            <form className="stack" onSubmit={(e) => { e.preventDefault(); saveGroup.mutate(draft) }}>
              <input autoFocus placeholder="Group name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required />
              <div className="checks">
                {people.map((p) => (
                  <label key={p.id} className="check">
                    <input type="checkbox" checked={draft.ids.includes(p.id)} onChange={() => toggleMember(p.id)} /> {p.name}
                  </label>
                ))}
              </div>
              <span className="row">
                <button type="submit" className="primary" disabled={draft.ids.length === 0 || saveGroup.isPending}><Check size={16} /> Save group</button>
                <button type="button" onClick={() => setDraft(null)}>Cancel</button>
              </span>
            </form>
          ) : (
            <button type="button" onClick={() => setDraft({ id: null, name: '', ids: [] })}><Plus size={16} /> New group</button>
          )}
        </section>
      </div>
    </>
  )
}
