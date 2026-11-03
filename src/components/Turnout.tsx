import { useEffect, useMemo, useState } from 'react'
import { GOVERNORS } from '../data/governors'
import { HOUSE } from '../data/house'
import { SENATE } from '../data/senate'
import type { PartySplit, Rating, Result, TurnoutFile, TurnoutRow, TurnoutState } from '../data/types'

const REFRESH_MS = 5 * 60_000
// First polls close at 6pm Eastern (parts of IN and KY).
const FIRST_CLOSE = Date.parse('2026-11-03T18:00:00-05:00')

const fmt = (n: number) => n.toLocaleString()
const short = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 1 : 2)}M` : `${Math.round(n / 1e3)}K`)
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

// Votes counted so far in a state, from the live results feeds. A statewide race (Senate or
// governor) counts every voter once; without one, add up the state's House districts.
interface Counted {
  votes: number
  reporting?: number
  race: string
}

function countedByState(results: Record<string, Result>): Map<string, Counted> {
  const out = new Map<string, Counted>()
  for (const r of [...SENATE, ...GOVERNORS]) {
    const res = results[r.id]
    if (!res?.totalVotes) continue
    const st = r.label.slice(0, 2)
    if ((out.get(st)?.votes ?? 0) < res.totalVotes) out.set(st, { votes: res.totalVotes, reporting: res.reporting, race: r.label })
  }
  const house = new Map<string, number>()
  for (const r of HOUSE) {
    const v = results[r.id]?.totalVotes
    if (v) house.set(r.label.slice(0, 2), (house.get(r.label.slice(0, 2)) ?? 0) + v)
  }
  for (const [st, votes] of house) if (!out.has(st)) out.set(st, { votes, race: 'House districts added up' })
  return out
}

// Two bars on one track, both against every ballot cast in 2022: striped for ballots cast
// before Election Day, solid for votes counted. Counted votes include early ballots once
// they're tallied, so the two overlap rather than add up.
function DualBar({ early, counted, of }: { early: number; counted?: number; of: number }) {
  return (
    <span className="dual-bar" aria-hidden>
      <span className="dual-early" style={{ width: `${Math.min(100, pct(early, of))}%` }} />
      {counted ? <span className="dual-counted" style={{ width: `${Math.min(100, pct(counted, of))}%` }} /> : null}
    </span>
  )
}

function Legend() {
  return (
    <span className="turnout-legend">
      <span>
        <i className="swatch swatch-early" /> Cast before Election Day
      </span>
      <span>
        <i className="swatch swatch-counted" /> Votes counted
      </span>
      <span className="muted">Bars: share of every ballot cast in 2022</span>
    </span>
  )
}

function countingNote() {
  return Date.now() < FIRST_CLOSE ? 'Counting starts as polls close, from 6pm ET Tuesday' : 'No votes from a state feed yet'
}

function StateCard({ s, counted }: { s: TurnoutState; counted?: Counted }) {
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

      <div className="turnout-pair">
        <div className="turnout-figure">
          <span className="figure-label">
            <i className="swatch swatch-early" /> Cast before Election Day
          </span>
          <span className="figure-value">{fmt(s.total)}</span>
          <span className="muted figure-sub">{pct(s.total, s.baseline.turnout).toFixed(0)}% of 2022 turnout</span>
        </div>
        <div className="turnout-figure">
          <span className="figure-label">
            <i className="swatch swatch-counted" /> Votes counted
          </span>
          <span className={`figure-value ${counted ? '' : 'muted'}`}>{counted ? fmt(counted.votes) : '—'}</span>
          <span className="muted figure-sub">
            {counted
              ? `${pct(counted.votes, s.baseline.turnout).toFixed(0)}% of 2022 turnout${counted.reporting != null ? ` · ${counted.reporting}% of precincts` : ''}`
              : countingNote()}
          </span>
        </div>
      </div>
      <DualBar early={s.total} counted={counted?.votes} of={s.baseline.turnout} />
      <p className="turnout-compare muted">
        Early and mail ballots are {pct(s.total, s.baseline.total).toFixed(0)}% of the {s.baseline.label} early and mail total (
        {short(s.baseline.total)}). 2022 turnout: {short(s.baseline.turnout)}.
      </p>

      <h4 className="turnout-sub">Early and mail ballots by registered party</h4>
      <div className="turnout-bar" role="img" aria-label="Early and mail ballots by registered party">
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

// Nationwide: ballots cast early everywhere, next to votes counted in the states with live feeds.
// The two cover different sets of states, so each says which states it covers.
function Nationwide({ national, counted }: { national: NonNullable<TurnoutFile['national']>; counted: Map<string, Counted> }) {
  const early = national.rows.reduce((n, r) => n + r.voted, 0)
  const turnout2022 = national.rows.reduce((n, r) => n + r.turnout2022, 0)
  const live = national.rows.filter((r) => counted.has(r.state))
  const votes = live.reduce((n, r) => n + counted.get(r.state)!.votes, 0)
  const liveEarly = live.reduce((n, r) => n + r.voted, 0)
  const live2022 = live.reduce((n, r) => n + r.turnout2022, 0)

  return (
    <section className="panel turnout-nation">
      <div className="turnout-pair">
        <div className="turnout-figure">
          <span className="figure-label">
            <i className="swatch swatch-early" /> Cast before Election Day
          </span>
          <span className="figure-value big">{short(early)}</span>
          <span className="muted figure-sub">
            {fmt(early)} ballots in {national.rows.length} states · {pct(early, turnout2022).toFixed(0)}% of 2022 turnout there
          </span>
        </div>
        <div className="turnout-figure">
          <span className="figure-label">
            <i className="swatch swatch-counted" /> Votes counted
          </span>
          <span className={`figure-value big ${votes ? '' : 'muted'}`}>{votes ? short(votes) : '—'}</span>
          <span className="muted figure-sub">
            {votes
              ? `${fmt(votes)} votes in the ${live.length} states with live feeds (${live.map((r) => r.state).join(', ')})`
              : countingNote()}
          </span>
        </div>
      </div>
      <NationalBreakdown rows={national.rows} />
      {votes > 0 && (
        <div className="nation-compare">
          <span className="muted">In those {live.length} states</span>
          <DualBar early={liveEarly} counted={votes} of={live2022} />
          <span className="muted">
            {short(liveEarly)} cast early · {short(votes)} counted · {short(live2022)} voted in 2022
          </span>
        </div>
      )}
      <p className="muted turnout-explain">
        Early and mail ballots are cast, not counted: nobody knows how they voted until polls close. Once polls close,
        states count them alongside Election Day votes (many report them first), so votes counted grows past the early
        total as the night goes on. States without a live feed here are still counted on the night; follow their calls on
        the Results tab.
      </p>
    </section>
  )
}

// Early ballots across the country: in person vs mail everywhere, and the party split
// across the states that register voters by party. Shares use only ballots with a party on
// file, since a few states (CA, ID) break down fewer ballots than their total.
function NationalBreakdown({ rows }: { rows: TurnoutRow[] }) {
  const inPerson = rows.reduce((n, r) => n + r.inPerson, 0)
  const mail = rows.reduce((n, r) => n + r.mail, 0)
  const withParty = rows.filter((r) => r.parties)
  const D = withParty.reduce((n, r) => n + r.parties!.D, 0)
  const R = withParty.reduce((n, r) => n + r.parties!.R, 0)
  const none = withParty.reduce((n, r) => n + r.parties!.none, 0)
  const known = D + R + none
  const g = gap({ D, R, unaffiliated: none, other: 0 }, known)
  const missing = rows.filter((r) => !r.parties).sort((a, b) => b.voted - a.voted)
  const missingVotes = missing.reduce((n, r) => n + r.voted, 0)

  return (
    <div className="nation-breakdown">
      <div className="breakdown-row">
        <h4>How early ballots were cast</h4>
        <div className="turnout-bar" role="img" aria-label="Early ballots in person and by mail">
          <span className="tbar-inperson" style={{ width: `${pct(inPerson, inPerson + mail)}%` }} />
          <span className="tbar-mail" style={{ width: `${pct(mail, inPerson + mail)}%` }} />
        </div>
        <div className="breakdown-legend">
          <span>
            <i className="tdot tbar-inperson" /> In person <b>{short(inPerson)}</b> <span className="muted">{pct(inPerson, inPerson + mail).toFixed(0)}%</span>
          </span>
          <span>
            <i className="tdot tbar-mail" /> Mail <b>{short(mail)}</b> <span className="muted">{pct(mail, inPerson + mail).toFixed(0)}%</span>
          </span>
        </div>
      </div>
      <div className="breakdown-row">
        <h4>
          By registered party <span className="muted">in the {withParty.length} states with party data · {short(known)} ballots</span>
        </h4>
        <div className="turnout-bar" role="img" aria-label="Early ballots by registered party">
          <span className="tbar-D" style={{ width: `${pct(D, known)}%` }} />
          <span className="tbar-U" style={{ width: `${pct(none, known)}%` }} />
          <span className="tbar-R" style={{ width: `${pct(R, known)}%` }} />
        </div>
        <div className="breakdown-legend">
          <span>
            <i className="tdot tbar-D" /> Democrats <b>{short(D)}</b> <span className="muted">{pct(D, known).toFixed(1)}%</span>
          </span>
          <span>
            <i className="tdot tbar-U" /> Unaffiliated and other <b>{short(none)}</b> <span className="muted">{pct(none, known).toFixed(1)}%</span>
          </span>
          <span>
            <i className="tdot tbar-R" /> Republicans <b>{short(R)}</b> <span className="muted">{pct(R, known).toFixed(1)}%</span>
          </span>
          <span>
            Gap: <b className={`name-${g.party}`}>{g.text}</b>
          </span>
        </div>
        <p className="muted breakdown-note">
          Leaves out {missing.length} states without party data ({short(missingVotes)} ballots), including{' '}
          {missing
            .slice(0, 5)
            .map((r) => r.name)
            .join(', ')}
          . Texas and Georgia alone are {short(missing.slice(0, 2).reduce((n, r) => n + r.voted, 0))} ballots.
          A Democratic edge is normal for early voting; there's no national 2022 baseline to compare against here.
        </p>
      </div>
    </div>
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

type SortKey = 'share' | 'voted' | 'counted' | 'name' | 'gap'
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'share', label: 'Cast early, % of 2022' },
  { key: 'voted', label: 'Ballots cast early' },
  { key: 'counted', label: 'Votes counted' },
  { key: 'gap', label: 'Party gap' },
  { key: 'name', label: 'State' },
]

const dateLabel = (ymd: string) => new Date(`${ymd}T12:00:00`).toLocaleDateString([], { month: 'short', day: 'numeric' })

function NationalTable({ national, counted }: { national: NonNullable<TurnoutFile['national']>; counted: Map<string, Counted> }) {
  const [sort, setSort] = useState<SortKey>('share')
  const [keyOnly, setKeyOnly] = useState(false)

  const rows = useMemo(() => {
    const share = (r: TurnoutRow) => pct(r.voted, r.turnout2022)
    const gapOf = (r: TurnoutRow) => (r.parties ? pct(r.parties.D - r.parties.R, r.voted) : -Infinity)
    const countedOf = (r: TurnoutRow) => counted.get(r.state)?.votes ?? -1
    const by: Record<SortKey, (a: TurnoutRow, b: TurnoutRow) => number> = {
      share: (a, b) => share(b) - share(a),
      voted: (a, b) => b.voted - a.voted,
      counted: (a, b) => countedOf(b) - countedOf(a) || b.voted - a.voted,
      gap: (a, b) => gapOf(b) - gapOf(a),
      name: (a, b) => a.name.localeCompare(b.name),
    }
    return national.rows.filter((r) => !keyOnly || KEY_RACES.has(r.state)).sort(by[sort])
  }, [national, counted, sort, keyOnly])

  return (
    <section className="turnout-national">
      <h2 className="section-title">Every state</h2>
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
        <Legend />
      </div>
      <div className="table-wrap">
        <table className="turnout-states">
          <thead>
            <tr className="group-row">
              <th rowSpan={2}>State</th>
              <th rowSpan={2}>vs 2022 turnout</th>
              <th colSpan={4} className="group-early">
                <i className="swatch swatch-early" /> Cast before Election Day
              </th>
              <th colSpan={2} className="group-counted">
                <i className="swatch swatch-counted" /> Votes counted
              </th>
            </tr>
            <tr>
              <th className="group-early">Ballots</th>
              <th className="group-early">In person / mail</th>
              <th className="group-early">Party split</th>
              <th className="group-early">Updated</th>
              <th className="group-counted">Votes</th>
              <th className="group-counted">Reporting</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const p = r.parties
              const g = p && gap({ D: p.D, R: p.R, unaffiliated: p.none, other: 0 }, r.voted)
              const c = counted.get(r.state)
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
                  <td>
                    <span className="share-cell">
                      <DualBar early={r.voted} counted={c?.votes} of={r.turnout2022} />
                      <span className="share-nums">
                        <span className="early-text">{pct(r.voted, r.turnout2022).toFixed(0)}%</span>
                        {c && <b> {pct(c.votes, r.turnout2022).toFixed(0)}%</b>}
                      </span>
                    </span>
                  </td>
                  <td className="group-early">{fmt(r.voted)}</td>
                  <td className="group-early muted">
                    {r.inPerson ? short(r.inPerson) : '—'} / {r.mail ? short(r.mail) : '—'}
                  </td>
                  <td className="group-early">
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
                      <span className="muted">No party data</span>
                    )}
                  </td>
                  <td className="group-early muted">
                    <a href={r.source} target="_blank" rel="noreferrer">
                      {dateLabel(r.updated)}
                    </a>
                  </td>
                  <td className="group-counted" title={c?.race}>
                    {c ? <b>{fmt(c.votes)}</b> : <span className="muted">—</span>}
                  </td>
                  <td className="group-counted muted">{c?.reporting != null ? `${c.reporting}%` : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="muted hint">
        Early and mail ballots from the{' '}
        <a href={national.source} target="_blank" rel="noreferrer">
          UF Election Lab
        </a>
        , file updated {when(national.asOf)}; Alabama and New Hampshire don't publish them. Votes counted come from the live
        state feeds, so only states with a feed show them. Party split is D / unaffiliated and other / R. Hover a row for the
        Lab's notes on that state; click a date for the state's own source.
      </p>
    </section>
  )
}

// Early-vote turnout from states that publish it daily (see server/turnout.ts), next to
// votes counted from the live results feeds.
export function Turnout({ results }: { results: Record<string, Result> }) {
  const [file, setFile] = useState<TurnoutFile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const counted = useMemo(() => countedByState(results), [results])

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
      {error && <div className="banner">{error}</div>}
      {file && file.states.length === 0 && <p className="muted">No turnout yet. Run <code>npm run fetch -- --turnout</code>.</p>}
      {file?.national && <Nationwide national={file.national} counted={counted} />}
      <p className="muted turnout-intro">
        Who voted early, by registered party. Democrats tend to vote early and by mail more than Republicans, so a
        Democratic lead in early ballots is expected and says little on its own; compare with 2022 instead. States post
        early-vote numbers once a day.
      </p>
      <div className="turnout-grid">
        {file?.states.map((s) => <StateCard key={s.state} s={s} counted={counted.get(s.state)} />)}
      </div>
      {file?.national && <NationalTable national={file.national} counted={counted} />}
    </section>
  )
}
