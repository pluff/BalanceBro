import { Link, NavLink, Outlet, useLocation, useMatch, useParams } from 'react-router-dom'
import { ArrowLeft, Plus, Scale, LogOut, Receipt, ScrollText, Settings, Wallet } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useAuth } from '../lib/auth'
import { api, type Group } from '../lib/api'

export function Layout() {
  const { logout } = useAuth()
  const potId = useMatch('/pots/:id/*')?.params.id
  const { data: pot } = useQuery({ queryKey: ['group', potId], queryFn: () => api<Group>(`/groups/${potId}`), enabled: !!potId })
  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-in">
          <Link to="/" className="brand"><Wallet size={22} /> BalanceBro</Link>
          {potId && (
            <nav className="crumbs" aria-label="Breadcrumb">
              <span aria-hidden="true">/</span>
              <Link to={`/pots/${potId}`} className="ellipsis" aria-current="page">{pot?.name ?? '…'}</Link>
            </nav>
          )}
          <span className="spacer" />
          <button className="link icon" onClick={logout} aria-label="Log out" title="Log out"><LogOut size={20} /></button>
        </div>
      </header>
      <main className="page"><Outlet /></main>
    </div>
  )
}

// Tabs shared by every screen inside one MoneyPot.
export function PotLayout() {
  const { id } = useParams()
  const { data: group } = useQuery({ queryKey: ['group', id], queryFn: () => api<Group>(`/groups/${id}`) })
  const tab = (to: string, label: string, icon: ReactNode, end = false) => (
    <NavLink to={to} end={end} className={({ isActive }) => `tab${isActive ? ' on' : ''}`}>{icon}{label}</NavLink>
  )
  const { pathname } = useLocation()
  const showAdd = !/\/(expenses|settlements|people)\//.test(pathname)
  return (
    <>
      <div className="tabrow">
      <nav className="tabs" aria-label="MoneyPot">
        {tab(`/pots/${id}`, 'History', <Receipt size={20} />, true)}
        {tab(`/pots/${id}/balance`, 'Balance', <Scale size={20} />)}
        {tab(`/pots/${id}/settings`, 'Settings', <Settings size={20} />)}
        {group?.is_owner && tab(`/pots/${id}/audit-logs`, 'Audit', <ScrollText size={20} />)}
      </nav>
      {showAdd && (
        <Link to={`/pots/${id}/expenses/new`} className="fab" aria-label="Add expense or payback" title="Add expense or payback">
          <Plus size={20} />Add
        </Link>
      )}
      </div>
      <Outlet />
    </>
  )
}

export function PageHead({ title, back, children }: { title: ReactNode; back?: string; children?: ReactNode }) {
  return (
    <div className="pagehead">
      {back && <Link to={back} className="back" aria-label="Back"><ArrowLeft size={20} /></Link>}
      <h1>{title}</h1>
      {children}
    </div>
  )
}

// Create-mode switch between the two ways to record money: an expense (default) or a payback.
export function KindSwitch({ potId, active }: { potId: number | string; active: 'expense' | 'payback' }) {
  const { search } = useLocation()
  return (
    <div className="kind" role="tablist" aria-label="Type">
      <Link to={`/pots/${potId}/expenses/new`} role="tab" aria-selected={active === 'expense'} className={active === 'expense' ? 'on' : ''}>Expense</Link>
      <Link to={`/pots/${potId}/settlements/new${search}`} role="tab" aria-selected={active === 'payback'} className={active === 'payback' ? 'on' : ''}>Payback</Link>
    </div>
  )
}

export const Loading = () => <p className="empty">Loading…</p>
