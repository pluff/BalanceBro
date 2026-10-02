import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../lib/auth'
import { Wallet } from 'lucide-react'
import { renderGoogleButton } from '../lib/gsi'

// Web: Google Identity Services button. Native (Capacitor) will need a native
// Google sign-in plugin that yields the same ID token; see README.
export default function Login() {
  const { loginWithGoogle } = useAuth()
  const btn = useRef<HTMLDivElement>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    renderGoogleButton(btn.current!, (t) => loginWithGoogle(t).catch(() => setError('Sign-in failed'))).catch((e: Error) =>
      setError(e.message),
    )
  }, [loginWithGoogle])

  return (
    <div className="login">
      <div className="card stack">
        <span className="logo"><Wallet size={30} /></span>
        <h1>BalanceBro</h1>
        <p className="muted">Split expenses, settle up.</p>
        <div ref={btn} style={{ display: 'flex', justifyContent: 'center' }} />
        {error && <p className="error">{error}</p>}
      </div>
    </div>
  )
}
