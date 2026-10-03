import { BASE } from '../lib/api'
import { PageHead } from '../components/Layout'

// Same-origin builds have an empty API base, so fall back to the page origin.
const mcpUrl = `${BASE || window.location.origin}/mcp`

export default function Faq() {
  return (
    <>
      <PageHead title="FAQ" />
      <section className="card faq stack" style={{ maxWidth: 720 }}>
        <h2>Do you have MCP?</h2>
        <p>
          Yes. BalanceBro has an MCP server, so an AI assistant such as Claude can read your pots and record expenses and
          paybacks for you. It acts as you, with the same access you have in the app.
        </p>
        <p>Server URL: <code>{mcpUrl}</code></p>
        <p><b>How to install</b></p>
        <ol>
          <li>In Claude, open Settings → Connectors and choose Add custom connector.</li>
          <li>Paste the server URL above and save.</li>
          <li>Click Connect, sign in with Google and approve access.</li>
        </ol>
        <p><b>How to use</b></p>
        <p>Just ask in plain words, for example:</p>
        <ul>
          <li>“How much have we spent on the trip?”</li>
          <li>“Who owes whom?”</li>
          <li>“I paid 45 for fuel, split between me, Anna and Bob.”</li>
          <li>“Bob gave me 50 back.”</li>
        </ul>
        <p className="muted">Added expenses and paybacks are visible to everyone in the pot. If something is unclear, the assistant will ask before recording it.</p>
      </section>
    </>
  )
}
