import { HOUSE } from '../data/house'
import { MAP_H, MAP_W, STATES } from './geo'

// Equal-area district map: one pointy-top hexagon per House seat, grown outward from
// each state's real centroid. Generated once at load, so it adapts if the data changes.

export const HEX_R = 15
const HEX_W = Math.sqrt(3) * HEX_R
const ROW_H = 1.5 * HEX_R

export interface HexCell {
  q: number // column (offset coords, odd rows shifted right)
  r: number // row
  x: number
  y: number
  state: string
  raceId: string
}

const key = (q: number, r: number) => `${q},${r}`
const center = (q: number, r: number) => ({ x: q * HEX_W + (r & 1 ? HEX_W / 2 : 0), y: r * ROW_H })

export function neighbors(q: number, r: number): [number, number][] {
  const odd = r & 1
  return [
    [q + 1, r], [q - 1, r],
    [q + (odd ? 0 : -1), r - 1], [q + (odd ? 1 : 0), r - 1],
    [q + (odd ? 0 : -1), r + 1], [q + (odd ? 1 : 0), r + 1],
  ]
}

function nearestCell(x: number, y: number) {
  const r = Math.round(y / ROW_H)
  return { q: Math.round((x - (r & 1 ? HEX_W / 2 : 0)) / HEX_W), r }
}

function buildLayout(): { cells: HexCell[]; scale: number } {
  const seats = new Map<string, string[]>()
  for (const race of HOUSE) {
    const st = race.label.slice(0, 2)
    seats.set(st, [...(seats.get(st) ?? []), race.id])
  }

  const taken = new Map<string, string>() // cell key -> state
  const cells: HexCell[] = []
  const dist2 = (q: number, r: number, cx: number, cy: number) => {
    const c = center(q, r)
    return (c.x - cx) ** 2 + (c.y - cy) ** 2
  }

  // Largest delegations first, so the big states keep their natural shape and small
  // neighbors get pushed outward rather than the other way round.
  const order = STATES.filter((s) => seats.has(s.abbr)).sort((a, b) => seats.get(b.abbr)!.length - seats.get(a.abbr)!.length)

  for (const st of order) {
    const ids = seats.get(st.abbr)!
    const [cx, cy] = st.centroid
    const mine: { q: number; r: number }[] = []

    // Nearest free cell to the centroid anywhere on the grid, searching outward ring by ring.
    const nearestFree = () => {
      const start = nearestCell(cx, cy)
      for (let ring = 0; ring < 80; ring++) {
        let best: { q: number; r: number; d: number } | null = null
        for (let dq = -ring; dq <= ring; dq++)
          for (let dr = -ring; dr <= ring; dr++) {
            if (Math.max(Math.abs(dq), Math.abs(dr)) !== ring) continue
            const q = start.q + dq
            const r = start.r + dr
            if (taken.has(key(q, r))) continue
            const d = dist2(q, r, cx, cy)
            if (!best || d < best.d) best = { q, r, d }
          }
        if (best) return best
      }
      throw new Error(`hex layout: no room for ${st.abbr}`)
    }

    // Seed at the centroid, then repeatedly claim the free neighboring cell closest to it.
    // If neighbors box the state in, continue from the nearest open cell instead.
    while (mine.length < ids.length) {
      let best: { q: number; r: number; d: number } | null = null
      for (const c of mine)
        for (const [q, r] of neighbors(c.q, c.r)) {
          if (taken.has(key(q, r))) continue
          const d = dist2(q, r, cx, cy)
          if (!best || d < best.d) best = { q, r, d }
        }
      const cell = best ?? nearestFree()
      mine.push(cell)
      taken.set(key(cell.q, cell.r), st.abbr)
    }

    // Number districts in reading order (top-left to bottom-right).
    mine.sort((a, b) => a.r - b.r || a.q - b.q)
    mine.forEach((c, i) => cells.push({ ...c, ...center(c.q, c.r), state: st.abbr, raceId: ids[i] }))
  }

  // Fit the result into the same frame as the geographic map.
  const xs = cells.map((c) => c.x)
  const ys = cells.map((c) => c.y)
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  const pad = HEX_R * 1.2
  const scale = Math.min((MAP_W - 2 * pad) / (maxX - minX), (MAP_H - 2 * pad) / (maxY - minY), 1)
  for (const c of cells) {
    c.x = pad + (c.x - minX) * scale + ((MAP_W - 2 * pad) - (maxX - minX) * scale) / 2
    c.y = pad + (c.y - minY) * scale
  }
  return { cells, scale }
}

const layout = buildLayout()
export const HEX_CELLS = layout.cells
export const HEX_SIZE = HEX_R * layout.scale

// Corner indexes (0 = top, clockwise) bounding the edge shared with each neighbor,
// in the same order neighbors() returns them: E, W, NW, NE, SW, SE.
const EDGE_CORNERS: [number, number][] = [[1, 2], [4, 5], [5, 0], [0, 1], [3, 4], [2, 3]]

function corner(x: number, y: number, i: number, r = HEX_SIZE) {
  const a = (Math.PI / 3) * i - Math.PI / 2
  return [x + r * Math.cos(a), y + r * Math.sin(a)]
}

// Path tracing every hex edge that borders a different state (or open space).
export const STATE_EDGES = (() => {
  const byKey = new Map(HEX_CELLS.map((c) => [key(c.q, c.r), c]))
  let d = ''
  for (const c of HEX_CELLS) {
    neighbors(c.q, c.r).forEach(([q, r], i) => {
      if (byKey.get(key(q, r))?.state === c.state) return
      const [a, b] = EDGE_CORNERS[i]
      const [x1, y1] = corner(c.x, c.y, a)
      const [x2, y2] = corner(c.x, c.y, b)
      d += `M${x1.toFixed(1)},${y1.toFixed(1)}L${x2.toFixed(1)},${y2.toFixed(1)}`
    })
  }
  return d
})()

// Label position per state: the mean of its cells.
export const STATE_LABELS = (() => {
  const acc = new Map<string, { x: number; y: number; n: number }>()
  for (const c of HEX_CELLS) {
    const a = acc.get(c.state) ?? { x: 0, y: 0, n: 0 }
    acc.set(c.state, { x: a.x + c.x, y: a.y + c.y, n: a.n + 1 })
  }
  return [...acc].map(([state, a]) => ({ state, x: a.x / a.n, y: a.y / a.n, n: a.n }))
})()

export function hexPoints(x: number, y: number, r = HEX_SIZE) {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 2
    return `${(x + r * Math.cos(a)).toFixed(1)},${(y + r * Math.sin(a)).toFixed(1)}`
  }).join(' ')
}
