import { useEffect, useState } from 'react'
import { RATING_LABEL, type Party, type Race, type Result } from '../data/types'

interface Props {
  race: Race
  result?: Result
  onSave: (result: Result | null) => void
  onClose: () => void
}

const numOrUndef = (s: string) => (s.trim() === '' ? undefined : Number(s))

// Side panel for entering returns and calling a race on election night.
export function RaceEditor({ race, result, onSave, onClose }: Props) {
  const parties: Party[] = race.candidates ? race.candidates.map((c) => c.party) : ['D', 'R']
  const [winner, setWinner] = useState<Party | ''>(result?.winner ?? '')
  const [called, setCalled] = useState(!!result?.called)
  const [reporting, setReporting] = useState(result?.reporting?.toString() ?? '')
  const [pct, setPct] = useState<Record<string, string>>(
    Object.fromEntries(parties.map((p) => [p, result?.pct?.[p]?.toString() ?? ''])),
  )
  const [note, setNote] = useState(result?.note ?? '')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const save = () => {
    const pctOut: Partial<Record<Party, number>> = {}
    for (const p of parties) {
      const v = numOrUndef(pct[p])
      if (v !== undefined && !Number.isNaN(v)) pctOut[p] = v
    }
    const next: Result = {
      winner: winner || undefined,
      called: called && !!winner,
      reporting: numOrUndef(reporting),
      pct: Object.keys(pctOut).length ? pctOut : undefined,
      note: note.trim() || undefined,
    }
    onSave(next)
    onClose()
  }

  const nameFor = (p: Party) => race.candidates?.find((c) => c.party === p)?.name ?? { D: 'Democrat', R: 'Republican', I: 'Independent' }[p]

  return (
    <div className="editor-backdrop" onClick={onClose}>
      <aside className="editor" onClick={(e) => e.stopPropagation()} aria-label={`Edit ${race.label}`}>
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
          <legend>Vote share (%)</legend>
          {parties.map((p) => (
            <label key={p} className="row">
              <span>
                <i className={`dot dot-${p}`} /> {nameFor(p)}
              </span>
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={pct[p]}
                onChange={(e) => setPct({ ...pct, [p]: e.target.value })}
              />
            </label>
          ))}
          <label className="row">
            <span>Expected vote in</span>
            <input type="number" min="0" max="100" value={reporting} onChange={(e) => setReporting(e.target.value)} />
          </label>
        </fieldset>

        <fieldset>
          <legend>Call</legend>
          <div className="seg-control">
            {(['', ...parties] as (Party | '')[]).map((p) => (
              <button key={p || 'none'} className={winner === p ? 'active' : ''} onClick={() => setWinner(p)}>
                {p ? nameFor(p) : 'None'}
              </button>
            ))}
          </div>
          <label className="row checkbox">
            <input type="checkbox" checked={called} disabled={!winner} onChange={(e) => setCalled(e.target.checked)} />
            <span>Race called</span>
          </label>
          <label className="col">
            <span>Note (e.g. who called it)</span>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="AP, 10:42pm" />
          </label>
        </fieldset>

        <footer>
          <button
            className="ghost"
            onClick={() => {
              onSave(null)
              onClose()
            }}
          >
            Clear
          </button>
          <button className="primary" onClick={save}>
            Save
          </button>
        </footer>
      </aside>
    </div>
  )
}
