import type { CallEntry, Party, Race } from '../data/types'
import { CHAMBERS } from '../lib/tally'

const RACES = new Map(Object.values(CHAMBERS).flatMap((c) => c.races.map((r) => [r.id, r] as const)))
const CHAMBER_NAME = { senate: 'Senate', house: 'House', gov: 'Governor' }
const PARTY_NAME: Record<Party, string> = { D: 'Dem', R: 'GOP', I: 'Ind' }

interface Props {
  calls: CallEntry[]
  onResolve: (uri: string, action: 'apply' | 'dismiss', party?: Party) => void
  onOpenRace: (race: Race) => void
}

const label = (e: CallEntry) => {
  const race = e.raceId ? RACES.get(e.raceId) : undefined
  return race ? `${race.label} ${CHAMBER_NAME[race.chamber]}` : (e.raceId ?? 'Unknown race')
}

// Race calls read from Decision Desk HQ's Bluesky. Confident matches are applied to the
// board automatically; anything uncertain (unknown party, likely flip, or disagreeing with
// an existing call) waits here for one click.
export function CallFeed({ calls, onResolve, onOpenRace }: Props) {
  const pending = calls.filter((e) => e.status === 'review' || e.status === 'conflict')
  const recent = calls.filter((e) => e.status === 'applied' || e.status === 'resolved').slice(0, 8)
  if (calls.length === 0) {
    return (
      <section className="call-feed">
        <h2 className="section-title">
          Race calls <span className="muted">from Decision Desk HQ on Bluesky · checked every minute</span>
        </h2>
        <p className="muted hint">No calls yet. They'll appear here and on the board as DDHQ posts them.</p>
      </section>
    )
  }

  return (
    <section className="call-feed">
      <h2 className="section-title">
        Race calls <span className="muted">from Decision Desk HQ on Bluesky · checked every minute</span>
      </h2>

      {pending.length > 0 && (
        <div className="review-list">
          <h3>Needs your OK ({pending.length})</h3>
          {pending.map((e) => {
            const race = e.raceId ? RACES.get(e.raceId) : undefined
            const parties: Party[] = race?.candidates ? [...new Set(race.candidates.map((c) => c.party))] : ['D', 'R']
            const first = e.suggested ?? e.party
            const ordered = first ? [first, ...parties.filter((p) => p !== first)] : parties
            return (
              <div key={e.uri} className={`review-item ${e.status}`}>
                <div className="review-text">
                  <b>{label(e)}</b>: {e.winnerName} wins
                  {e.calledAt && <span className="muted"> · {e.calledAt}</span>}
                  <div className="muted review-reason">{e.reason}</div>
                </div>
                <div className="review-actions">
                  {race &&
                    ordered.map((p, i) => (
                      <button key={p} className={i === 0 && first ? 'primary' : 'ghost'} onClick={() => onResolve(e.uri, 'apply', p)}>
                        {e.status === 'conflict' ? 'Switch to' : 'Call for'} {PARTY_NAME[p]}
                      </button>
                    ))}
                  <button className="ghost" onClick={() => onResolve(e.uri, 'dismiss')}>
                    {e.status === 'conflict' ? 'Keep current' : 'Dismiss'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {recent.length > 0 && (
        <ul className="call-log">
          {recent.map((e) => {
            const race = e.raceId ? RACES.get(e.raceId) : undefined
            const flip = race && e.party && e.party !== race.held
            return (
              <li key={e.uri}>
                <button className="link" onClick={() => race && onOpenRace(race)}>
                  <span className={`status status-${e.party}`}>✓</span> <b>{label(e)}</b>: {e.winnerName}{' '}
                  {e.party && <span className={`name-${e.party}`}>({e.party})</span>}
                  {flip && <b className="flip">FLIP</b>}
                  <span className="muted"> · {e.calledAt}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
