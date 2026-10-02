import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../lib/auth'
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
    <div className="stack">
      <h1>BalanceBro</h1>
      <div ref={btn} />
      {error && <p className="error">{error}</p>}
    </div>
  )
}
