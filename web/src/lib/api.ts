const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
const TOKEN_KEY = 'bb_token'

export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (t: string | null) =>
  t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY)

export class ApiError extends Error {
  status: number
  body: unknown
  constructor(status: number, body: unknown) {
    super(`API ${status}`)
    this.status = status
    this.body = body
  }
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const token = getToken()
  const res = await fetch(`${BASE}/api/v1${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
  })
  if (res.status === 204) return undefined as T
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(res.status, body)
  return body as T
}

export type User = { id: number; email: string; name: string }
export type Participant = { id: number; name: string; short_name: string; user_id: number | null; avatar_url?: string | null }
export type ParticipantGroup = { id: number; name: string; participant_ids: number[] }
export type Group = {
  id: number
  name: string
  currency: string
  owner_id: number
  is_owner: boolean
  share_token?: string // only present for the owner
  participants?: Participant[]
  participant_groups?: ParticipantGroup[]
}
export type DeletedGroup = { id: number; name: string; currency: string; deleted_at: string }
export type Balances = {
  balances: { participant_id: number; amount_cents: number }[]
  transfers: { from_participant_id: number; to_participant_id: number; amount_cents: number }[]
  unallocated_count: number // expenses nobody shares yet; left out of balances and transfers
}

export type Expense = {
  id: number
  description: string
  amount_cents: number
  spent_on: string
  paid_by_id: number
  // What is stored: who the expense is split between. `splits` is derived live from it (groups resolve to their current members).
  participant_ids: number[]
  participant_group_ids: number[]
  splits: { participant_id: number; amount_cents: number }[]
  unallocated: boolean // nobody shares it yet
}

export type AuditLog = {
  id: number
  actor_id: number | null
  actor_name: string | null
  action: string
  subject_type: string | null
  subject_id: number | null
  details: Record<string, unknown>
  ip: string | null
  created_at: string
}

export type Settlement = {
  id: number
  from_participant_id: number
  to_participant_id: number
  amount_cents: number
  settled_on: string
  description: string | null
}
