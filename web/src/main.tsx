import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './lib/auth'
import App from './App'
import './index.css'

// Share links pasted as plain paths (/join/<token>) are rewritten to the hash route the router understands.
if (window.location.pathname.startsWith('/join/')) {
  window.location.replace(`/#${window.location.pathname}`)
}

const queryClient = new QueryClient()

// HashRouter: works in Capacitor webviews without server-side route fallback.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <HashRouter>
          <App />
        </HashRouter>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
