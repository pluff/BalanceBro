import { createContext, useContext, useState, type ReactNode } from 'react'
import { api, getToken, setToken, type User } from './api'

type AuthCtx = {
  authed: boolean
  loginWithGoogle: (idToken: string) => Promise<void>
  adoptToken: (token: string) => void
  logout: () => Promise<void>
}

const Ctx = createContext<AuthCtx>(null!)
export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authed, setAuthed] = useState(!!getToken())

  const value: AuthCtx = {
    authed,
    loginWithGoogle: async (idToken) => {
      const r = await api<{ token: string; user: User }>('/auth/google', {
        method: 'POST',
        json: { id_token: idToken },
      })
      setToken(r.token)
      setAuthed(true)
    },
    adoptToken: (token) => {
      setToken(token)
      setAuthed(true)
    },
    logout: async () => {
      await api('/session', { method: 'DELETE' }).catch(() => {})
      setToken(null)
      setAuthed(false)
    },
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
