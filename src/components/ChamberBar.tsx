import { RATING_LABEL, type Rating, type Result } from '../data/types'
import { ratingCounts, resultTally, type ChamberInfo } from '../lib/tally'

export type Mode = 'forecast' | 'results'

interface Segment {
  key: string
  count: number
  className: string
  label: string
}

interface Props {
  info: ChamberInfo
  mode: Mode
  results: Record<string, Result>
}

// Horizontal seat bar: Dem seats grow from the left, GOP from the right, with
// a marker at the majority threshold.
export function ChamberBar({ info, mode, results }: Props) {
  const { notUp, total, need, races } = info
  let segments: Segment[]

  if (mode === 'forecast') {
    const counts = ratingCounts(races)
    const order: Rating[] = ['SD', 'LD', 'TD', 'TU', 'TR', 'LR', 'SR']
    segments = [
      { key: 'nuD', count: notUp.D, className: 'seg-nu-d', label: 'Dem, not up' },
      ...order.map((r) => ({ key: r, count: counts[r], className: `seg-${r}`, label: RATING_LABEL[r] })),
      { key: 'nuR', count: notUp.R, className: 'seg-nu-r', label: 'GOP, not up' },
    ]
  } else {
    const t = resultTally(races, results)
    segments = [
      { key: 'nuD', count: notUp.D, className: 'seg-nu-d', label: 'Dem, not up' },
      { key: 'D', count: t.called.D, className: 'seg-SD', label: 'Dem won' },
      { key: 'I', count: t.called.I, className: 'seg-I', label: 'Independent won' },
      { key: 'U', count: t.uncalled, className: 'seg-uncalled', label: 'Not yet called' },
      { key: 'R', count: t.called.R, className: 'seg-SR', label: 'GOP won' },
      { key: 'nuR', count: notUp.R, className: 'seg-nu-r', label: 'GOP, not up' },
    ]
  }

  const majorityAt = need ? (need.D / total) * 100 : 50

  return (
    <div className="chamber-bar">
      <div className="bar" role="img" aria-label={segments.map((s) => `${s.label}: ${s.count}`).join(', ')}>
        {segments
          .filter((s) => s.count > 0)
          .map((s) => (
            <div
              key={s.key}
              className={`seg ${s.className}`}
              style={{ flexGrow: s.count }}
              title={`${s.label}: ${s.count}`}
            >
              {(s.count / total) * 100 > 4 && <span>{s.count}</span>}
            </div>
          ))}
        <div className="majority-line" style={{ left: `${majorityAt}%` }} />
      </div>
      <div className="legend">
        {segments
          .filter((s) => s.count > 0)
          .map((s) => (
            <span key={s.key} className="legend-item">
              <i className={`swatch ${s.className}`} />
              {s.label} <b>{s.count}</b>
            </span>
          ))}
      </div>
    </div>
  )
}
