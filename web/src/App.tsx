import { Navigate, Route, Routes, useMatch } from 'react-router-dom'
import { useAuth } from './lib/auth'
import Login from './pages/Login'
import Groups from './pages/Groups'
import GroupDetail from './pages/GroupDetail'
import PotSettings from './pages/PotSettings'
import NewExpense from './pages/NewExpense'
import PotBalance from './pages/PotBalance'
import PersonHistory from './pages/PersonHistory'
import Join from './pages/Join'

export default function App() {
  const { authed } = useAuth()
  const joinMatch = useMatch('/join/:token')
  if (!authed) return joinMatch ? <Join /> : <Login />
  return (
    <Routes>
      <Route path="/" element={<Groups />} />
      <Route path="/join/:token" element={<Join />} />
      <Route path="/pots/:id" element={<GroupDetail />} />
      <Route path="/pots/:id/expenses/new" element={<NewExpense />} />
      <Route path="/pots/:id/balance" element={<PotBalance />} />
      <Route path="/pots/:id/people/:pid" element={<PersonHistory />} />
      <Route path="/pots/:id/settings" element={<PotSettings />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  )
}
