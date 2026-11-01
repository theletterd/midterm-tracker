import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CallFeed } from './components/CallFeed'
import { ChamberBar, type Mode } from './components/ChamberBar'
import { RaceCard, pollSummary } from './components/RaceCard'
import { POLLS_AS_OF } from './data/polls'
import { RaceEditor } from './components/RaceEditor'
import { SocialFeeds } from './components/SocialFeeds'
import { Turnout } from './components/Turnout'
import { UsMap } from './components/UsMap'
import { RATINGS, RATING_LABEL, type Chamber, type Race, type Rating, type Result, type Snapshot } from './data/types'
import { CHAMBERS, favoredParty, isCompetitive, isFlip, leader, ratingCounts, reportingText, resultTally, type ChamberInfo } from './lib/tally'
import { useResults } from './lib/useResults'

const ELECTION_DAY = new Date('2026-11-03T00:00:00')
const TABS: Chamber[] = ['senate', 'house', 'gov']
type Tab = Chamber | 'turnout' | 'bluesky'

const fmtDate = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString([], { month: 'short', day: 'numeric' })

// Results only exist from election night on, so a results timestamp later than the
// clock (as in a replay or simulation) wins.
function daysUntilElection(resultsUpdated: string | null) {
  const now = new Date(Math.max(Date.now(), resultsUpdated ? Date.parse(resultsUpdated) : 0))
  const ms = ELECTION_DAY.getTime() - new Date(now.toDateString()).getTime()
  return Math.round(ms / 86_400_000)
}

export default function App() {
  const { results, history, calls, updated, loaded, error, saveCall, resolveCall } = useResults()
  const [tab, setTab] = useState<Tab>('senate')
  const [mode, setMode] = useState<Mode>('forecast')
  const [modeTouched, setModeTouched] = useState(false)
  const [editing, setEditing] = useState<Race | null>(null)
  const [stateFilter, setStateFilter] = useState<string | null>(null)

  // Switch to results automatically once any returns have been entered.
  useEffect(() => {
    if (loaded && !modeTouched && Object.keys(results).length > 0) setMode('results')
  }, [loaded, modeTouched, results])

  // Count Curated posts that arrive while the Bluesky tab isn't open, for a badge on the tab.
  const [unseenPosts, setUnseenPosts] = useState(0)
  const tabRef = useRef(tab)
  tabRef.current = tab
  const onNewPosts = useCallback((n: number) => {
    if (tabRef.current !== 'bluesky') setUnseenPosts((u) => u + n)
  }, [])

  const info = tab === 'bluesky' || tab === 'turnout' ? null : CHAMBERS[tab]
  const days = daysUntilElection(updated)

  return (
    <div className="app">
      <header className="top">
        <div>
          <h1>2026 Midterms</h1>
          <p className="muted">
            {days > 0 ? `Election Day is in ${days} day${days === 1 ? '' : 's'} · Tue, Nov 3` : days === 0 ? 'Election Day' : 'Election Day was Tue, Nov 3'}
            {updated && <> · Results updated {new Date(updated).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</>}
          </p>
        </div>
        <div className={`seg-control ${info ? '' : 'hidden'}`} role="tablist" aria-label="View mode">
          {(['forecast', 'results'] as Mode[]).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              className={mode === m ? 'active' : ''}
              onClick={() => {
                setMode(m)
                setModeTouched(true)
              }}
            >
              {m === 'forecast' ? 'Forecast' : 'Results'}
            </button>
          ))}
        </div>
      </header>

      {error && <div className="banner">{error}</div>}

      <nav className="tabs" role="tablist" aria-label="View">
        {TABS.map((c) => (
          <button key={c} role="tab" aria-selected={tab === c} className={tab === c ? 'active' : ''} onClick={() => {
            setTab(c)
            setStateFilter(null)
          }}>
            {CHAMBERS[c].title}
            <small>{CHAMBERS[c].races.length}</small>
          </button>
        ))}
        <button role="tab" aria-selected={tab === 'turnout'} className={`tab-turnout ${tab === 'turnout' ? 'active' : ''}`} onClick={() => setTab('turnout')}>
          Turnout
        </button>
        <button
          role="tab"
          aria-selected={tab === 'bluesky'}
          className={`tab-bluesky ${tab === 'bluesky' ? 'active' : ''}`}
          onClick={() => {
            setTab('bluesky')
            setUnseenPosts(0)
          }}
        >
          Bluesky
          {unseenPosts > 0 && <span className="badge" aria-label={`${unseenPosts} new posts`}>{unseenPosts > 99 ? '99+' : unseenPosts}</span>}
        </button>
      </nav>

      {tab === 'turnout' && <Turnout results={results} />}

      {/* Stays mounted on every tab so polling and new-post tracking keep running. */}
      <div hidden={tab !== 'bluesky'}>
        <SocialFeeds onNewPosts={onNewPosts} />
      </div>

      {info && (
        <>
      <section className="panel">
        <Summary info={info} mode={mode} results={results} />
        <ChamberBar info={info} mode={mode} results={results} />
        <p className="source muted">
          Ratings: Cook Political Report, as of {fmtDate(info.asOf)}.
          {info.chamber !== 'house' && <> Polls: RealClearPolling, pulled {fmtDate(POLLS_AS_OF)}.</>}
          {info.need && <> The line marks {info.need.D} seats for a Democratic majority{info.chamber === 'senate' && ' (VP Vance breaks 50–50 ties for the GOP)'}.</>}
        </p>
      </section>

      {mode === 'results' && <CallFeed calls={calls} onResolve={resolveCall} onOpenRace={setEditing} />}

      <section>
        <h2 className="section-title">Map</h2>
        <UsMap
          info={info}
          mode={mode}
          results={results}
          selectedState={stateFilter}
          onSelectRace={setEditing}
          onSelectState={(abbr) => {
            setStateFilter(abbr)
            if (abbr) document.getElementById('race-table')?.scrollIntoView({ behavior: 'smooth' })
          }}
        />
      </section>

      <KeyRaces info={info} mode={mode} results={results} history={history} onSelect={setEditing} />
      <RaceTable
        key={tab}
        info={info}
        mode={mode}
        results={results}
        onSelect={setEditing}
        stateFilter={stateFilter}
        onClearState={() => setStateFilter(null)}
      />
        </>
      )}

      {editing && (
        <RaceEditor
          key={editing.id}
          race={editing}
          result={results[editing.id]}
          history={history[editing.id]}
          onSave={(u) => saveCall(editing.id, u)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

interface ViewProps {
  info: ChamberInfo
  mode: Mode
  results: Record<string, Result>
}

function Summary({ info, mode, results }: ViewProps) {
  const { notUp, need, races } = info

  if (mode === 'forecast') {
    const c = ratingCounts(races)
    const dBase = notUp.D + c.SD + c.LD + c.TD
    const rBase = notUp.R + c.SR + c.LR + c.TR
    return (
      <div className="stats">
        <Stat label="Dem favored" value={dBase} party="D" sub={need ? marginText(dBase, need.D) : 'incl. seats not up'} />
        <Stat label="Toss ups" value={c.TU} sub={!need ? 'either party could win' : need.D > dBase ? `Dems need ${need.D - dBase} of ${c.TU}` : need.R > rBase ? `GOP needs ${need.R - rBase} of ${c.TU}` : 'either party could win'} />
        <Stat label="GOP favored" value={rBase} party="R" sub={need ? marginText(rBase, need.R) : 'incl. seats not up'} />
      </div>
    )
  }

  const t = resultTally(races, results)
  const d = notUp.D + t.called.D
  const r = notUp.R + t.called.R
  const dGain = t.flips.filter((x) => results[x.id]?.winner === 'D').length
  const rGain = t.flips.filter((x) => results[x.id]?.winner === 'R').length
  return (
    <div className="stats">
      <Stat
        label="Democrats"
        value={d}
        party="D"
        sub={need ? (d >= need.D ? 'Majority clinched' : `Need ${need.D - d} more`) : `${dGain} pickup${dGain === 1 ? '' : 's'}`}
      />
      <Stat
        label="Not yet called"
        value={t.uncalled}
        sub={`${t.flips.length} flip${t.flips.length === 1 ? '' : 's'} so far${t.called.I ? ` · ${t.called.I} Ind.` : ''}`}
      />
      <Stat
        label="Republicans"
        value={r}
        party="R"
        sub={need ? (r >= need.R ? 'Majority clinched' : `Need ${need.R - r} more`) : `${rGain} pickup${rGain === 1 ? '' : 's'}`}
      />
    </div>
  )
}

const marginText = (seats: number, need: number) =>
  seats >= need ? `${seats - need} above majority` : `${need - seats} short of majority`

function Stat({ label, value, sub, party }: { label: string; value: number; sub: string; party?: 'D' | 'R' }) {
  return (
    <div className={`stat ${party ? `stat-${party}` : ''}`}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      <span className="stat-sub muted">{sub}</span>
    </div>
  )
}

function KeyRaces({ info, mode, results, history, onSelect }: ViewProps & { history: Record<string, Snapshot[]>; onSelect: (r: Race) => void }) {
  // Senate/governors: everything Lean or closer. House: toss ups only, or there'd be 50+ cards.
  const keyRatings: Rating[] = info.chamber === 'house' ? ['TU'] : ['TD', 'TU', 'TR']
  const races = info.races.filter((r) => keyRatings.includes(r.rating))
  const order = (r: Race) => RATINGS.indexOf(r.rating)
  const sorted = [...races].sort((a, b) => order(a) - order(b) || a.label.localeCompare(b.label))

  return (
    <section>
      <h2 className="section-title">
        Key races <span className="muted">{info.chamber === 'house' ? 'Toss ups' : 'Lean and Toss Up'}</span>
      </h2>
      <div className="card-grid">
        {sorted.map((race) => (
          <RaceCard
            key={race.id}
            race={race}
            result={mode === 'results' ? results[race.id] : undefined}
            history={mode === 'results' ? history[race.id] : undefined}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  )
}

function PollCell({ race }: { race: Race }) {
  const poll = pollSummary(race)
  return <td title={poll?.title}>{poll ? <span className={poll.party ? `name-${poll.party}` : ''}>{poll.text}</span> : <span className="muted">—</span>}</td>
}

type StatusFilter = 'all' | 'uncalled' | 'called' | 'flips'

interface TableProps extends ViewProps {
  onSelect: (r: Race) => void
  stateFilter: string | null
  onClearState: () => void
}

function RaceTable({ info, mode, results, onSelect, stateFilter, onClearState }: TableProps) {
  const [query, setQuery] = useState('')
  const [ratings, setRatings] = useState<Set<Rating>>(
    () => new Set(info.chamber === 'house' ? RATINGS.filter(isCompetitive) : RATINGS),
  )
  const [status, setStatus] = useState<StatusFilter>('all')

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return info.races.filter((race) => {
      if (stateFilter) {
        if (race.label.slice(0, 2) !== stateFilter) return false
      } else if (!ratings.has(race.rating)) return false
      if (q && !`${race.label} ${race.incumbent} ${race.candidates?.map((c) => c.name).join(' ') ?? ''}`.toLowerCase().includes(q)) return false
      if (mode === 'results' && status !== 'all') {
        const res = results[race.id]
        if (status === 'called' && !res?.called) return false
        if (status === 'uncalled' && res?.called) return false
        if (status === 'flips' && !isFlip(race, res)) return false
      }
      return true
    })
  }, [info.races, ratings, query, status, mode, results, stateFilter])

  const hasPolls = info.chamber !== 'house'

  const toggle = (r: Rating) => {
    const next = new Set(ratings)
    if (next.has(r)) next.delete(r)
    else next.add(r)
    setRatings(next)
  }

  return (
    <section id="race-table">
      <h2 className="section-title">
        All {info.title.toLowerCase()} races <span className="muted">{rows.length} shown</span>
      </h2>
      <div className="filters">
        <input type="search" placeholder="Search state, district, name…" value={query} onChange={(e) => setQuery(e.target.value)} />
        {stateFilter && (
          <button className="chip on state-chip" onClick={onClearState} aria-label={`Clear ${stateFilter} filter`}>
            {stateFilter}, all seats ×
          </button>
        )}
        <div className="chips">
          {RATINGS.map((r) => (
            <button key={r} className={`chip rating-${r} ${ratings.has(r) ? 'on' : ''}`} onClick={() => toggle(r)} aria-pressed={ratings.has(r)}>
              {RATING_LABEL[r]}
            </button>
          ))}
        </div>
        {mode === 'results' && (
          <select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} aria-label="Status filter">
            <option value="all">All statuses</option>
            <option value="uncalled">Not called</option>
            <option value="called">Called</option>
            <option value="flips">Flips</option>
          </select>
        )}
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Race</th>
              <th>Rating</th>
              <th>Held</th>
              <th>{info.races.some((r) => r.candidates) ? 'Candidates / incumbent' : 'Incumbent'}</th>
              {hasPolls && <th>Polls</th>}
              {mode === 'results' && <th>Status</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((race) => {
              const res = results[race.id]
              const lead = leader(res)
              return (
                <tr key={race.id} onClick={() => onSelect(race)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onSelect(race)}>
                  <td className="race-label">{race.label}</td>
                  <td>
                    <span className={`rating-pill rating-${race.rating}`}>{RATING_LABEL[race.rating]}</span>
                  </td>
                  <td>
                    <i className={`dot dot-${race.held}`} /> {race.held}
                  </td>
                  <td>
                    {race.candidates
                      ? race.candidates.map((c, idx) => (
                          <span key={c.name}>
                            {idx > 0 && ' vs. '}
                            <span className={`name-${c.party}`}>{c.name}</span>
                          </span>
                        ))
                      : race.incumbent === 'Open'
                        ? <span className="muted">{race.note ?? 'Open'}</span>
                        : race.incumbent}
                  </td>
                  {hasPolls && <PollCell race={race} />}
                  {mode === 'results' && (
                    <td>
                      {res?.called ? (
                        <span className={`status status-${res.winner}`}>
                          ✓ {res.winner} win{isFlip(race, res) && <b className="flip"> · FLIP</b>}
                        </span>
                      ) : lead ? (
                        <span>
                          {lead.party} +{lead.margin.toFixed(1)}
                          {res?.reporting != null && <span className="muted"> · {reportingText(res)}</span>}
                        </span>
                      ) : (
                        <span className="muted">{favoredParty(race.rating) ? '—' : 'Watch'}</span>
                      )}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="muted hint">Click any race to see its returns or call it.</p>
    </section>
  )
}
