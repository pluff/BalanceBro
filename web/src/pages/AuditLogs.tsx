import { Navigate, useParams } from 'react-router-dom'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { Loading, PageHead } from '../components/Layout'
import { api, type AuditLog, type Group } from '../lib/api'
import { describeLog } from '../lib/auditText'

type Page = { logs: AuditLog[]; next_before: number | null }

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })

export default function AuditLogs() {
  const { id } = useParams()
  const { data: group } = useQuery({ queryKey: ['group', id], queryFn: () => api<Group>(`/groups/${id}`) })
  const isOwner = group?.is_owner === true
  const { data, isPending, isError, hasNextPage, fetchNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['audit_logs', id],
    enabled: isOwner,
    initialPageParam: null as number | null,
    queryFn: ({ pageParam }) => api<Page>(`/groups/${id}/audit_logs${pageParam ? `?before=${pageParam}` : ''}`),
    getNextPageParam: (last) => last.next_before,
  })

  if (!group) return <Loading />
  if (!isOwner) return <Navigate to={`/pots/${id}`} replace />

  const logs = data?.pages.flatMap((p) => p.logs) ?? []

  return (
    <>
      <PageHead title="Audit Logs" />
      <section className="card stack">
        {isPending && <Loading />}
        {isError && <p className="error">Could not load logs</p>}
        {!isPending && !isError && logs.length === 0 && <p className="muted">No activity yet.</p>}
        <ul className="list">
          {logs.map((l) => {
            const { verb, notes } = describeLog(l, group, logs)
            return (
              <li key={l.id} className="stack">
                <div className="row">
                  <span className="grow">
                    <b>{l.actor_name ?? 'Someone'}</b> {verb}
                  </span>
                  <small className="muted" title={new Date(l.created_at).toLocaleString()}>{when(l.created_at)}</small>
                </div>
                {notes.length > 0 && (
                  <ul className="muted" style={{ margin: 0, paddingLeft: 18, fontSize: '.85rem' }}>
                    {notes.map((x, i) => <li key={i}>{x}</li>)}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
        {hasNextPage && (
          <button type="button" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
            {isFetchingNextPage ? 'Loading…' : 'Load more'}
          </button>
        )}
      </section>
    </>
  )
}
