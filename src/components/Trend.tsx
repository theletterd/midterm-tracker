import type { Party, Snapshot } from '../data/types'

interface Props {
  snapshots: Snapshot[]
  parties: [Party, Party] // margin is first minus second, e.g. ['D', 'R']
  height?: number
  detailed?: boolean
}

const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

// Margin over the night, one point per fetched update. Above the midline favors the
// first party, below the second; the line takes the color of whoever leads at the end.
export function Trend({ snapshots, parties: [a, b], height = 28, detailed = false }: Props) {
  const pts = snapshots
    .filter((s) => s.pct?.[a] != null && s.pct?.[b] != null)
    .map((s) => ({ t: new Date(s.t).getTime(), m: s.pct![a]! - s.pct![b]!, s }))
    .sort((p, q) => p.t - q.t)
  if (pts.length < 2) return detailed ? <p className="muted trend-empty">Trend appears after the second update.</p> : null

  const W = 300
  const H = height
  const t0 = pts[0].t
  const t1 = pts.at(-1)!.t
  const maxAbs = Math.max(2, ...pts.map((p) => Math.abs(p.m)))
  const x = (t: number) => (t1 === t0 ? W : ((t - t0) / (t1 - t0)) * W)
  const y = (m: number) => H / 2 - (m / maxAbs) * (H / 2 - 2)
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.m).toFixed(1)}`).join('')
  const last = pts.at(-1)!
  const leader = last.m === 0 ? null : last.m > 0 ? a : b

  return (
    <div className={`trend ${detailed ? 'detailed' : ''}`}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`Margin trend, ${pts.length} updates`}>
        <line x1="0" x2={W} y1={H / 2} y2={H / 2} className="trend-zero" />
        <path d={d} className={`trend-line trend-${leader ?? 'tie'}`} vectorEffect="non-scaling-stroke" />
      </svg>
      {detailed && (
        <div className="trend-axis muted">
          <span>{fmtTime(pts[0].s.t)}</span>
          <span>
            {a} {pts[0].m >= 0 ? '+' : ''}
            {pts[0].m.toFixed(1)} → {last.m >= 0 ? '+' : ''}
            {last.m.toFixed(1)} over {pts.length} updates
          </span>
          <span>{fmtTime(last.s.t)}</span>
        </div>
      )}
    </div>
  )
}

// Which two parties to chart for a race: D vs R, or I vs R where there's no Democrat.
export function trendParties(snapshots: Snapshot[]): [Party, Party] {
  const has = (p: Party) => snapshots.some((s) => s.pct?.[p] != null)
  return has('D') ? ['D', 'R'] : ['I', 'R']
}
