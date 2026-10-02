export type Placed = { x: number; y: number; r: number }

// Greedy circle packing: biggest circle first, each next one touches two placed circles (or one, for the second)
// at the free spot closest to the cloud's centre. Returns positions in input order plus the bounding box.
export function packCircles(radii: number[], gap = 0): { circles: Placed[]; width: number; height: number } {
  const order = radii.map((_, i) => i).sort((a, b) => radii[b] - radii[a])
  const placed: (Placed & { i: number })[] = []

  for (const i of order) {
    const r = radii[i] + gap / 2
    let best: { x: number; y: number } | null = null

    if (placed.length === 0) best = { x: 0, y: 0 }
    else if (placed.length === 1) best = { x: placed[0].r + r, y: 0 }
    else {
      const total = placed.reduce((s, c) => s + c.r * c.r, 0)
      const cx = placed.reduce((s, c) => s + c.x * c.r * c.r, 0) / total
      const cy = placed.reduce((s, c) => s + c.y * c.r * c.r, 0) / total
      let bestDist = Infinity
      for (let a = 0; a < placed.length; a++) {
        for (let b = a + 1; b < placed.length; b++) {
          for (const p of tangents(placed[a], placed[b], r)) {
            if (placed.some((c) => Math.hypot(c.x - p.x, c.y - p.y) < c.r + r - 1e-6)) continue
            const d = Math.hypot(p.x - cx, p.y - cy)
            if (d < bestDist) { bestDist = d; best = p }
          }
        }
      }
    }
    // Fallback (cannot happen with >= 2 circles in practice): put it beside the cloud.
    if (!best) best = { x: Math.max(...placed.map((c) => c.x + c.r)) + r, y: 0 }
    placed.push({ i, x: best.x, y: best.y, r })
  }

  const minX = Math.min(...placed.map((c) => c.x - c.r))
  const maxX = Math.max(...placed.map((c) => c.x + c.r))
  const minY = Math.min(...placed.map((c) => c.y - c.r))
  const maxY = Math.max(...placed.map((c) => c.y + c.r))
  const circles: Placed[] = []
  for (const c of placed) circles[c.i] = { x: c.x - minX, y: c.y - minY, r: c.r - gap / 2 }
  // `r` above includes half the gap for spacing; the drawn circle keeps its real radius, centred on the same point.
  return { circles, width: maxX - minX, height: maxY - minY }
}

// Centres of circles of radius r touching both a and b.
function tangents(a: Placed, b: Placed, r: number): { x: number; y: number }[] {
  const da = a.r + r
  const db = b.r + r
  const dx = b.x - a.x
  const dy = b.y - a.y
  const d = Math.hypot(dx, dy)
  if (d === 0 || d > da + db || d < Math.abs(da - db)) return []
  const l = (da * da - db * db + d * d) / (2 * d)
  const h = Math.sqrt(Math.max(0, da * da - l * l))
  const mx = a.x + (l * dx) / d
  const my = a.y + (l * dy) / d
  return [
    { x: mx + (h * dy) / d, y: my - (h * dx) / d },
    { x: mx - (h * dy) / d, y: my + (h * dx) / d },
  ]
}
