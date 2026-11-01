import { useEffect, useMemo, useState } from 'react'
import { GOVERNORS } from '../data/governors'
import { SENATE } from '../data/senate'
import type { PartySplit, Rating, TurnoutFile, TurnoutRow, TurnoutState } from '../data/types'

const REFRESH_MS = 5 * 60_000

const fmt = (n: number) => n.toLocaleString()
const short = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : `${Math.round(n / 1e3)}K`)
const pct = (n: number, of: number) => (of ? (100 * n) / of : 0)
const when = (iso: string) =>
  new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })

const PARTIES: { key: keyof PartySplit; label: string; className: string }[] = [
  { key: 'D', label: 'Democrats', className: 'D' },
  { key: 'unaffiliated', label: 'Unaffiliated', className: 'U' },
  { key: 'other', label: 'Other parties', className: 'O' },
  { key: 'R', label: 'Republicans', className: 'R' },
]

// "Dems +12.2 pts" style gap between registered Democrats and Republicans who have voted.
function gap(p: PartySplit, total: number) {
  const diff = p.D - p.R
  const lead = diff >= 0 ? 'Dems' : 'GOP'
  return { text: `${lead} +${pct(Math.abs(diff), total).toFixed(1)} pts`, votes: Math.abs(diff), party: diff >= 0 ? 'D' : 'R' }
}

function StateCard({ s }: { s: TurnoutState }) {
  const g = gap(s.parties, s.total)
  const g22 = gap(s.baseline.parties, s.baseline.total)
  const changes = s.history.map((h, i) => ({ ...h, added: i ? h.total - s.history[i - 1].total : null })).reverse()

  return (
    <article className="panel turnout-card">
      <header className="turnout-head">
        <h3>{s.name}</h3>
        <span className="muted">
          As of {when(s.asOf)} ·{' '}
          <a href={s.url} target="_blank" rel="noreferrer">
            {s.source}
          </a>
        </span>
      </header>

      <div className="turnout-big">
        <span className="stat-value">{fmt(s.total)}</span>
        <span className="muted">ballots cast early or by mail</span>
      </div>
      <p className="turnout-compare">
        <b>{pct(s.total, s.baseline.total).toFixed(0)}%</b> of the {s.baseline.label} early and mail total ({short(s.baseline.total)})
        {' · '}
        <b>{pct(s.total, s.baseline.turnout).toFixed(0)}%</b> of every ballot cast in {s.baseline.label} ({short(s.baseline.turnout)})
      </p>

      <div className="turnout-bar" role="img" aria-label="Ballots cast by registered party">
        {PARTIES.map((p) => (
          <span key={p.key} className={`tbar-${p.className}`} style={{ width: `${pct(s.parties[p.key], s.total)}%` }} />
        ))}
      </div>

      <table className="turnout-table">
        <thead>
          <tr>
            <th>Registered as</th>
            <th>Ballots</th>
            <th>Share</th>
            <th>{s.baseline.label} share</th>
          </tr>
        </thead>
        <tbody>
          {PARTIES.map((p) => {
            const share = pct(s.parties[p.key], s.total)
            const was = pct(s.baseline.parties[p.key], s.baseline.total)
            return (
              <tr key={p.key}>
                <td>
                  <i className={`tdot tbar-${p.className}`} /> {p.label}
                </td>
                <td>{fmt(s.parties[p.key])}</td>
                <td>{share.toFixed(1)}%</td>
                <td className="muted">
                  {was.toFixed(1)}%{' '}
                  <span className="turnout-delta">
                    ({share >= was ? '+' : '−'}
                    {Math.abs(share - was).toFixed(1)})
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <p className="turnout-gap">
        Party gap: <b className={`name-${g.party}`}>{g.text}</b> ({fmt(g.votes)} ballots).{' '}
        <span className="muted">
          At the end of {s.baseline.label}: {g22.text}.
        </span>
      </p>

      <p className="muted turnout-methods">{s.methods.map((m) => `${m.label} ${fmt(m.total)}`).join(' · ')}</p>

      {changes.length > 1 && (
        <details className="turnout-history">
          <summary>Daily updates ({changes.length})</summary>
          <table className="turnout-table">
            <tbody>
              {changes.map((h) => (
                <tr key={h.asOf}>
                  <td>{when(h.asOf)}</td>
                  <td>{fmt(h.total)}</td>
                  <td className="muted">{h.added != null ? `+${fmt(h.added)}` : ''}</td>
                  <td>{gap({ D: h.D, R: h.R, unaffiliated: 0, other: 0 }, h.total).text}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </article>
  )
}

// States with a Senate or governor's race rated Lean or closer, for a tag in the table.
const CLOSE: Rating[] = ['LD', 'TD', 'TU', 'TR', 'LR']
const KEY_RACES = new Map<string, string[]>()
for (const [races, tag] of [[SENATE, 'Sen'], [GOVERNORS, 'Gov']] as const) {
  for (const r of races) {
    if (!CLOSE.includes(r.rating)) continue
    const st = r.label.slice(0, 2)
    KEY_RACES.set(st, [...(KEY_RACES.get(st) ?? []), tag])
  }
}

type SortKey = 'share' | 'voted' | 'name' | 'gap'
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'share', label: '% of 2022 turnout' },
  { key: 'voted', label: 'Ballots cast' },
  { key: 'gap', label: 'Party gap' },
  { key: 'name', label: 'State' },
]

const dateLabel = (ymd: string) => new Date(`${ymd}T12:00:00`).toLocaleDateString([], { month: 'short', day: 'numeric' })

function NationalTable({ national }: { national: NonNullable<TurnoutFile['national']> }) {
  const [sort, setSort] = useState<SortKey>('share')
  const [keyOnly, setKeyOnly] = useState(false)

  const rows = useMemo(() => {
    const share = (r: TurnoutRow) => pct(r.voted, r.turnout2022)
    const gapOf = (r: TurnoutRow) => (r.parties ? pct(r.parties.D - r.parties.R, r.voted) : -Infinity)
    const by: Record<SortKey, (a: TurnoutRow, b: TurnoutRow) => number> = {
      share: (a, b) => share(b) - share(a),
      voted: (a, b) => b.voted - a.voted,
      gap: (a, b) => gapOf(b) - gapOf(a),
      name: (a, b) => a.name.localeCompare(b.name),
    }
    return national.rows.filter((r) => !keyOnly || KEY_RACES.has(r.state)).sort(by[sort])
  }, [national, sort, keyOnly])

  const total = national.rows.reduce((n, r) => n + r.voted, 0)

  return (
    <section className="turnout-national">
      <h2 className="section-title">
        Every state <span className="muted">{fmt(total)} ballots cast early or by mail so far</span>
      </h2>
      <div className="filters">
        <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort states">
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>
              Sort: {s.label}
            </option>
          ))}
        </select>
        <label className="turnout-check">
          <input type="checkbox" checked={keyOnly} onChange={(e) => setKeyOnly(e.target.checked)} /> Only states with a close Senate or
          governor's race
        </label>
      </div>
      <div className="table-wrap">
        <table className="turnout-states">
          <thead>
            <tr>
              <th>State</th>
              <th>Ballots cast</th>
              <th>% of 2022 turnout</th>
              <th>In person</th>
              <th>Mail</th>
              <th>Party split (D / R / other)</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const share = pct(r.voted, r.turnout2022)
              const p = r.parties
              const g = p && gap({ D: p.D, R: p.R, unaffiliated: p.none, other: 0 }, r.voted)
              return (
                <tr key={r.state} title={r.notes}>
                  <td>
                    <b>{r.name}</b>
                    {KEY_RACES.get(r.state)?.map((t) => (
                      <span key={t} className="key-tag">
                        {t}
                      </span>
                    ))}
                  </td>
                  <td>{fmt(r.voted)}</td>
                  <td>
                    <span className="share-cell">
                      <span className="share-bar">
                        <span style={{ width: `${Math.min(100, share)}%` }} />
                      </span>
                      {share.toFixed(0)}%
                    </span>
                  </td>
                  <td className="muted">{r.inPerson ? fmt(r.inPerson) : '—'}</td>
                  <td className="muted">{r.mail ? fmt(r.mail) : '—'}</td>
                  <td>
                    {p && g ? (
                      <span className="party-cell">
                        <span className="mini-bar" aria-hidden>
                          <span className="tbar-D" style={{ width: `${pct(p.D, r.voted)}%` }} />
                          <span className="tbar-U" style={{ width: `${pct(p.none, r.voted)}%` }} />
                          <span className="tbar-R" style={{ width: `${pct(p.R, r.voted)}%` }} />
                        </span>
                        <span className={`name-${g.party}`}>{g.text}</span>
                      </span>
                    ) : (
                      <span className="muted">No party registration</span>
                    )}
                  </td>
                  <td className="muted">
                    <a href={r.source} target="_blank" rel="noreferrer">
                      {dateLabel(r.updated)}
                    </a>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="muted hint">
        From the{' '}
        <a href={national.source} target="_blank" rel="noreferrer">
          UF Election Lab
        </a>
        , file updated {when(national.asOf)}. Alabama and New Hampshire don't publish early-vote numbers. "Other" is
        unaffiliated plus minor parties. Hover a row for the Lab's notes on that state; click a date for the state's own
        source.
      </p>
    </section>
  )
}

// Early-vote turnout from states that publish it daily (see server/turnout.ts).
export function Turnout() {
  const [file, setFile] = useState<TurnoutFile | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const res = await fetch(`/turnout.json?t=${Date.now()}`)
        if (!res.ok) throw new Error(`turnout.json ${res.status}`)
        const data = (await res.json()) as TurnoutFile
        if (alive) {
          setFile(data)
          setError(null)
        }
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : String(err))
      }
    }
    load()
    const id = setInterval(load, REFRESH_MS)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [])

  return (
    <section>
      <p className="muted turnout-intro">
        Who has voted so far, by registered party. These are ballots cast, not votes counted: nobody knows how they voted
        until polls close. Democrats tend to vote early and by mail more than Republicans, so a Democratic lead here is
        expected and says little on its own. Compare with 2022 instead. States post once a day. Votes cast on Election Day
        don't show up here; once polls close, follow the counted votes on the Results tab.
      </p>
      {error && <div className="banner">{error}</div>}
      {file && file.states.length === 0 && <p className="muted">No turnout yet. Run <code>npm run fetch -- --turnout</code>.</p>}
      <div className="turnout-grid">
        {file?.states.map((s) => <StateCard key={s.state} s={s} />)}
      </div>
      {file?.national && <NationalTable national={file.national} />}
    </section>
  )
}
