import { useEffect, useState } from 'react'
import { RATING_LABEL, type CallUpdate, type Party, type Race, type Result, type Snapshot } from '../data/types'
import { reportingText } from '../lib/tally'
import { Trend, trendParties } from './Trend'

interface Props {
  race: Race
  result?: Result
  history?: Snapshot[]
  onSave: (update: CallUpdate) => void
  onClose: () => void
}

const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

// Side panel for a race: live numbers from the state feed (read-only) and the call,
// which is the one thing entered by hand.
export function RaceEditor({ race, result, history, onSave, onClose }: Props) {
  const parties: Party[] = race.candidates ? race.candidates.map((c) => c.party) : ['D', 'R']
  const [winner, setWinner] = useState<Party | null>(result?.called ? (result.winner ?? null) : null)
  const [note, setNote] = useState(result?.note ?? '')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const save = (update: CallUpdate) => {
    onSave(update)
    onClose()
  }

  const nameFor = (p: Party) => race.candidates?.find((c) => c.party === p)?.name ?? { D: 'Democrat', R: 'Republican', I: 'Independent' }[p]

  return (
    <div className="editor-backdrop" onClick={onClose}>
      <aside className="editor" onClick={(e) => e.stopPropagation()} aria-label={`${race.label} race`}>
        <header>
          <h2>
            {race.label} <small>{race.chamber === 'gov' ? 'Governor' : race.chamber === 'senate' ? 'Senate' : 'House'}</small>
          </h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <p className="muted">
          Cook: {RATING_LABEL[race.rating]} · Held by {race.held} · {race.incumbent === 'Open' ? 'Open seat' : `Inc. ${race.incumbent}`}
          {race.note && <> · {race.note}</>}
        </p>

        <fieldset>
          <legend>Returns</legend>
          {result?.source ? (
            <>
              {parties.map((p) => (
                <div key={p} className="row">
                  <span>
                    <i className={`dot dot-${p}`} /> {nameFor(p)}
                  </span>
                  <span className="returns-num">
                    {result.pct?.[p] != null ? `${result.pct[p]!.toFixed(1)}%` : '—'}
                    {result.votes?.[p] != null && <small className="muted"> {result.votes[p]!.toLocaleString()}</small>}
                  </span>
                </div>
              ))}
              <p className="muted returns-meta">
                {reportingText(result)} · {result.totalVotes?.toLocaleString()} votes · {result.source}
                {result.fetchedAt && <>, {fmtTime(result.fetchedAt)}</>}
              </p>
            </>
          ) : (
            <p className="muted returns-meta">
              No live numbers. Either this state has no statewide results feed, or it hasn't reported yet.
            </p>
          )}
        </fieldset>

        {history && history.length > 0 && (
          <fieldset>
            <legend>Margin over the night</legend>
            <Trend snapshots={history} parties={trendParties(history)} height={90} detailed />
          </fieldset>
        )}

        <fieldset>
          <legend>Call</legend>
          <div className="seg-control">
            {([null, ...parties] as (Party | null)[]).map((p) => (
              <button key={p ?? 'none'} className={winner === p ? 'active' : ''} onClick={() => setWinner(p)}>
                {p ? nameFor(p) : 'Not called'}
              </button>
            ))}
          </div>
          <label className="col">
            <span>Note (e.g. who called it)</span>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="AP, 10:42pm" />
          </label>
        </fieldset>

        <footer>
          <button className="ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="primary"
            onClick={() => save({ winner, called: winner !== null, note: note.trim() || null })}
          >
            Save
          </button>
        </footer>
      </aside>
    </div>
  )
}
