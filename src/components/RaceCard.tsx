import { POLLS } from '../data/polls'
import { RATING_LABEL, type Party, type Race, type Result } from '../data/types'
import { isFlip, leader } from '../lib/tally'

export const PARTY_NAME: Record<Party, string> = { D: 'Dem', R: 'GOP', I: 'Ind' }

// "Talarico +1.4" style poll summary, using the leading candidate's surname.
export function pollSummary(race: Race): { text: string; party: Party | null; title: string } | null {
  const poll = POLLS[race.id]
  if (!poll) return null
  const lead = leader(poll)
  if (!lead) return null
  const title = `${poll.source}, ${poll.dates}`
  if (lead.margin === 0) return { text: 'Tied', party: null, title }
  const name = race.candidates?.find((c) => c.party === lead.party)?.name.split(' ').pop() ?? PARTY_NAME[lead.party]
  return { text: `${name} +${lead.margin.toFixed(1)}`, party: lead.party, title }
}

interface Props {
  race: Race
  result?: Result
  onSelect: (race: Race) => void
}

export function RaceCard({ race, result, onSelect }: Props) {
  const lead = leader(result)
  const flip = isFlip(race, result)
  const poll = pollSummary(race)

  return (
    <button className={`race-card ${result?.called ? `called called-${result.winner}` : ''}`} onClick={() => onSelect(race)}>
      <div className="race-card-head">
        <span className="race-label">{race.label}</span>
        <span className={`rating-pill rating-${race.rating}`}>{RATING_LABEL[race.rating]}</span>
      </div>
      {race.candidates ? (
        <ul className="cands">
          {race.candidates.map((c) => (
            <li key={c.name} className={result?.called && result.winner === c.party ? 'winner' : ''}>
              <i className={`dot dot-${c.party}`} />
              <span className="cand-name">
                {c.name}
                {c.incumbent && <em> (inc.)</em>}
              </span>
              {result?.pct?.[c.party] != null && <span className="cand-pct">{result.pct[c.party]!.toFixed(1)}%</span>}
            </li>
          ))}
        </ul>
      ) : (
        <div className="cands-inline muted">
          <i className={`dot dot-${race.held}`} /> {race.incumbent === 'Open' ? (race.note ?? 'Open seat') : race.incumbent}
        </div>
      )}
      <div className="race-card-foot">
        {result?.called ? (
          <span className={`status status-${result.winner}`}>
            ✓ {PARTY_NAME[result.winner!]} win{flip && <b className="flip"> · FLIP</b>}
          </span>
        ) : lead ? (
          <span className="status">
            {PARTY_NAME[lead.party]} +{lead.margin.toFixed(1)}
            {result?.reporting != null && <span className="muted"> · {result.reporting}% in</span>}
          </span>
        ) : (
          <span className="muted">Held by {PARTY_NAME[race.held]}</span>
        )}
        {!result?.called && poll && (
          <span className="poll" title={poll.title}>
            {POLLS[race.id].kind === 'avg' ? 'Poll avg' : 'Latest poll'}: <b className={poll.party ? `name-${poll.party}` : ''}>{poll.text}</b>
          </span>
        )}
      </div>
    </button>
  )
}
