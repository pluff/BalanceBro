import { Navigate, Route, Routes, useMatch } from 'react-router-dom'
import { useAuth } from './lib/auth'
import Login from './pages/Login'
import Groups from './pages/Groups'
import GroupDetail from './pages/GroupDetail'
import PotSettings from './pages/PotSettings'
import NewExpense from './pages/NewExpense'
import PotBalance from './pages/PotBalance'
import PersonHistory from './pages/PersonHistory'
import NewSettlement from './pages/NewSettlement'
import Join from './pages/Join'
import { Layout, PotLayout } from './components/Layout'

export default function App() {
  const { authed } = useAuth()
  const joinMatch = useMatch('/join/:token')
  if (!authed) return joinMatch ? <Join /> : <Login />
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Groups />} />
        <Route path="/join/:token" element={<Join />} />
        <Route path="/pots/:id" element={<PotLayout />}>
          <Route index element={<GroupDetail />} />
          <Route path="expenses/new" element={<NewExpense />} />
          <Route path="expenses/:eid/edit" element={<NewExpense />} />
          <Route path="settlements/new" element={<NewSettlement />} />
          <Route path="settlements/:sid/edit" element={<NewSettlement />} />
          <Route path="balance" element={<PotBalance />} />
          <Route path="people/:pid" element={<PersonHistory />} />
          <Route path="settings" element={<PotSettings />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  )
}
