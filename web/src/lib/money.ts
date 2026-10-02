// Two-decimal currencies only: amounts are entered and stored as cents.
export const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'PLN', 'CZK', 'SEK', 'NOK', 'DKK', 'CAD', 'AUD', 'UAH', 'BYN']

export const money = (cents: number, currency: string) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(cents / 100)

// "12.50" or "12,5" -> 1250. Returns null for invalid/non-positive input.
export function parseCents(input: string): number | null {
  const n = Number(input.replace(',', '.'))
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.round(n * 100)
}
