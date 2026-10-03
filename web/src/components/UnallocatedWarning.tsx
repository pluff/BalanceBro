import { TriangleAlert } from 'lucide-react'

// Shown wherever balances are: expenses nobody shares are not part of them.
export default function UnallocatedWarning({ count }: { count: number }) {
  if (!count) return null
  return (
    <p className="warning" role="alert">
      <TriangleAlert size={16} />
      <span>{count === 1 ? '1 expense is' : `${count} expenses are`} not allocated to anyone and left out of the balances.</span>
    </p>
  )
}
