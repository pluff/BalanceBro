# BalanceBro

Split expenses and settle debts between people.

- `api/` Rails 8 API (Postgres), token auth
- `web/` Vite + React + TS SPA, wrapped by Capacitor for iOS/Android

## Dev

```bash
# api (needs Ruby 3.4 + Postgres)
cd api && bin/rails db:setup && bin/rails s        # :3000

# web
cd web && cp .env.example .env.development && npm run dev   # :5173
```

## Mobile

```bash
cd web
npm run build && npx cap add ios && npx cap add android   # once
npm run build && npx cap sync && npx cap open ios         # or android
```

Set `VITE_API_URL` to a reachable API (not localhost) for device builds.
Money is stored as integer cents. `GroupBalances` computes net balances and the minimal transfer list.

## MCP

Same Rails process serves an MCP server at `POST /mcp` (Streamable HTTP, stateless) with OAuth 2.1 (dynamic client
registration, authorization code + PKCE, Google sign-in on the consent page). Add `https://<host>/mcp` as a custom
connector in an MCP client. Tools: `list_pots`, `get_pot`, `add_expense`, `add_payback`.
Uses `GOOGLE_CLIENT_IDS` (first entry, or `GOOGLE_WEB_CLIENT_ID`) for the consent page; its origin must be an authorized JS origin.
