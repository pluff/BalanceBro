const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
const GSI_SRC = 'https://accounts.google.com/gsi/client'

function loadGsi() {
  return new Promise<void>((resolve, reject) => {
    if (window.google) return resolve()
    const s = document.createElement('script')
    s.src = GSI_SRC
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('gsi load failed'))
    document.head.appendChild(s)
  })
}

// Renders the Google Identity Services button into `el`; `onCredential` gets the Google ID token.
// Rejects with a user-facing message when Google sign-in is unavailable.
export async function renderGoogleButton(el: HTMLElement, onCredential: (idToken: string) => void) {
  if (!CLIENT_ID) throw new Error('VITE_GOOGLE_CLIENT_ID is not set')
  await loadGsi().catch(() => { throw new Error('Could not load Google sign-in') })
  window.google!.accounts.id.initialize({ client_id: CLIENT_ID, callback: (r) => onCredential(r.credential) })
  window.google!.accounts.id.renderButton(el, { theme: 'outline', size: 'large' })
}
