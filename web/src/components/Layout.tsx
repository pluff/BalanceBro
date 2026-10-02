import { Link, NavLink, Outlet, useParams } from 'react-router-dom'
import { ArrowLeft, Scale, LogOut, Receipt, Settings, Wallet } from 'lucide-react'
import type { ReactNode } from 'react'
import { useAuth } from '../lib/auth'

export function Layout() {
  const { logout } = useAuth()
  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-in">
          <Link to="/" className="brand"><Wallet size={22} /> BalanceBro</Link>
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
  const tab = (to: string, label: string, icon: ReactNode, end = false) => (
    <NavLink to={to} end={end} className={({ isActive }) => `tab${isActive ? ' on' : ''}`}>{icon}{label}</NavLink>
  )
  return (
    <>
      <nav className="tabs" aria-label="MoneyPot">
        {tab(`/pots/${id}`, 'History', <Receipt size={20} />, true)}
        {tab(`/pots/${id}/balance`, 'Balance', <Scale size={20} />)}
        {tab(`/pots/${id}/settings`, 'Settings', <Settings size={20} />)}
      </nav>
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

export const Loading = () => <p className="empty">Loading…</p>
