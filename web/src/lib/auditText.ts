import type { AuditLog, Group } from './api'
import { money } from './money'

type D = Record<string, unknown>
export type AuditText = { verb: string; notes: string[] }

const s = (v: unknown) => (typeof v === 'string' ? v : '')
const n = (v: unknown) => (typeof v === 'number' ? v : 0)
const arr = (v: unknown): number[] => (Array.isArray(v) ? v.filter((x): x is number => typeof x === 'number') : [])
const pair = (v: unknown): [string, string] | null =>
  Array.isArray(v) && v.length === 2 ? [String(v[0] ?? ''), String(v[1] ?? '')] : null
const q = (t: string) => `“${t}”`
const day = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}
const list = (items: string[]) =>
  items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`

// Turns one audit row into a sentence ("added the expense “Dinner”") plus extra lines with the specifics.
// Names of people are looked up by id: current participants first, then whatever the logs themselves remember
// (so people deleted later still show up by name).
export function describeLog(log: AuditLog, group: Group, all: AuditLog[]): AuditText {
  const names = new Map<number, string>()
  for (const l of all) {
    if (l.subject_type !== 'Participant' || !l.subject_id) continue
    const d = l.details as D
    const nm = s(d.name) || s(d.participant_name) || pair(d.name)?.[1]
    if (nm) names.set(l.subject_id, nm)
  }
  for (const p of group.participants ?? []) names.set(p.id, p.name)
  const who = (id: unknown) => names.get(n(id)) ?? 'someone who has since been removed'
  const cur = (c: number) => money(c, group.currency)
  const d = log.details as D
  const notes: string[] = []

  const expenseLines = (e: D) => {
    const ids = arr(e.participant_ids)
    const groups = arr(e.participant_group_ids).length
    const splits = Array.isArray(e.splits) ? (e.splits as D[]) : []
    const people = splits.map((x) => who(x.participant_id))
    return { ids, groups, people, splits }
  }
  const describeExpense = (e: D) => {
    const { people, splits } = expenseLines(e)
    const out = [`${cur(n(e.amount_cents))} paid by ${who(e.paid_by_id)} on ${day(s(e.spent_on))}`]
    if (people.length) {
      const each = splits.map((x) => n(x.amount_cents))
      const even = each.every((c) => Math.abs(c - each[0]) <= 1)
      out.push(`Split between ${list(people)}${even ? ` (about ${cur(each[0])} each)` : ''}`)
    }
    return out
  }
  const diffExpense = (b: D, a: D) => {
    const out: string[] = []
    if (b.description !== a.description) out.push(`Description: ${q(s(b.description))} → ${q(s(a.description))}`)
    if (b.amount_cents !== a.amount_cents) out.push(`Amount: ${cur(n(b.amount_cents))} → ${cur(n(a.amount_cents))}`)
    if (b.spent_on !== a.spent_on) out.push(`Date: ${day(s(b.spent_on))} → ${day(s(a.spent_on))}`)
    if (b.paid_by_id !== a.paid_by_id) out.push(`Paid by: ${who(b.paid_by_id)} → ${who(a.paid_by_id)}`)
    const bs = expenseLines(b), as = expenseLines(a)
    if (JSON.stringify([bs.ids, bs.groups, bs.people]) !== JSON.stringify([as.ids, as.groups, as.people]))
      out.push(`Split between: ${list(bs.people) || 'nobody'} → ${list(as.people) || 'nobody'}`)
    return out
  }
  const settlementLine = (x: D) => {
    const out = [`${who(x.from_participant_id)} → ${who(x.to_participant_id)}, ${cur(n(x.amount_cents))} on ${day(s(x.settled_on))}`]
    if (s(x.description)) out.push(`Note: ${q(s(x.description))}`)
    return out
  }
  const members = (ids: unknown) => list(arr(ids).map(who)) || 'nobody'

  switch (log.action) {
    case 'group.create':
      notes.push(`Currency: ${s(d.currency)}`)
      return { verb: `created the MoneyPot ${q(s(d.name))}`, notes }
    case 'group.rename': {
      const p = pair(d.name)
      return { verb: p ? `renamed the MoneyPot from ${q(p[0])} to ${q(p[1])}` : 'renamed the MoneyPot', notes }
    }
    case 'group.currency': {
      const p = pair(d.currency)
      notes.push('Existing amounts were only relabelled, not converted')
      return { verb: p ? `changed the currency from ${p[0]} to ${p[1]}` : 'changed the currency', notes }
    }
    case 'share.enable':
      return { verb: d.already_enabled ? 'viewed the existing share link' : 'created a share link', notes }
    case 'share.disable':
      return { verb: 'stopped sharing the MoneyPot — the link no longer works for new people', notes }
    case 'share.join': {
      const name = s(d.participant_name)
      if (d.claimed_existing) notes.push('Took over an existing person in the MoneyPot')
      if (d.guest_account_created) notes.push('Joined as a guest without signing in with Google')
      else if (d.google_account) notes.push('Joined with a Google account')
      return { verb: `joined the MoneyPot via the share link as ${q(name)}`, notes }
    }
    case 'participant.create':
      return { verb: `added person ${q(s(d.name))}`, notes }
    case 'participant.rename': {
      const p = pair(d.name)
      return { verb: p ? `renamed person ${q(p[0])} to ${q(p[1])}` : 'renamed a person', notes }
    }
    case 'participant.delete':
      return { verb: `removed person ${q(s(d.name))}`, notes }
    case 'participant.reorder':
      notes.push(`New order: ${list(arr(d.to).map(who))}`)
      return { verb: 'changed the order of people', notes }
    case 'participant_group.create':
      notes.push(`Members: ${members(d.participant_ids)}`)
      return { verb: `created the group of people ${q(s(d.name))}`, notes }
    case 'participant_group.update': {
      const f = (d.from ?? {}) as D, t = (d.to ?? {}) as D
      if (f.name !== t.name) notes.push(`Name: ${q(s(f.name))} → ${q(s(t.name))}`)
      notes.push(`Members: ${members(f.participant_ids)} → ${members(t.participant_ids)}`)
      return { verb: `edited the group of people ${q(s(t.name))}`, notes }
    }
    case 'participant_group.delete':
      notes.push(`Members were: ${members(d.participant_ids)}`)
      return { verb: `deleted the group of people ${q(s(d.name))}`, notes }
    case 'expense.create':
      return { verb: `added the expense ${q(s(d.description))}`, notes: describeExpense(d) }
    case 'expense.update': {
      const b = (d.before ?? {}) as D, a = (d.after ?? {}) as D
      const changes = diffExpense(b, a)
      return { verb: `edited the expense ${q(s(a.description))}`, notes: changes.length ? changes : ['Saved without changing anything'] }
    }
    case 'expense.delete':
      return { verb: `deleted the expense ${q(s(d.description))}`, notes: describeExpense(d) }
    case 'settlement.create':
      return { verb: `recorded a payback: ${who(d.from_participant_id)} paid ${who(d.to_participant_id)} ${cur(n(d.amount_cents))}`, notes: s(d.description) ? [`Note: ${q(s(d.description))}`] : [] }
    case 'settlement.update': {
      const b = (d.before ?? {}) as D, a = (d.after ?? {}) as D
      const out: string[] = []
      if (b.amount_cents !== a.amount_cents) out.push(`Amount: ${cur(n(b.amount_cents))} → ${cur(n(a.amount_cents))}`)
      if (b.from_participant_id !== a.from_participant_id) out.push(`Paid by: ${who(b.from_participant_id)} → ${who(a.from_participant_id)}`)
      if (b.to_participant_id !== a.to_participant_id) out.push(`Paid to: ${who(b.to_participant_id)} → ${who(a.to_participant_id)}`)
      if (b.settled_on !== a.settled_on) out.push(`Date: ${day(s(b.settled_on))} → ${day(s(a.settled_on))}`)
      if (b.description !== a.description) out.push(`Note: ${q(s(b.description))} → ${q(s(a.description))}`)
      return { verb: `edited a payback from ${who(a.from_participant_id)} to ${who(a.to_participant_id)}`, notes: out }
    }
    case 'settlement.delete':
      return { verb: 'deleted a payback', notes: settlementLine(d) }
    default:
      return { verb: `did ${log.action}${log.subject_type ? ` on ${log.subject_type}` : ''}`, notes: [] }
  }
}

