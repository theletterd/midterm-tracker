import { useMemo, useState } from 'react'
import { RATING_LABEL, type Race, type Result } from '../data/types'
import { BORDERS, MAP_H, MAP_W, STATES } from '../lib/geo'
import { HEX_CELLS, STATE_EDGES, STATE_LABELS, hexPoints } from '../lib/hexLayout'
import { leader, type ChamberInfo } from '../lib/tally'
import type { Mode } from './ChamberBar'

interface Props {
  info: ChamberInfo
  mode: Mode
  results: Record<string, Result>
  selectedState: string | null
  onSelectRace: (race: Race) => void
  onSelectState: (abbr: string | null) => void
}

interface Shade {
  fill: string
  tip: string
}

const RATING_FILL: Record<string, string> = {
  SD: 'var(--d-solid)', LD: 'var(--d-likely)', TD: 'var(--d-lean)', TU: 'var(--tossup)',
  TR: 'var(--r-lean)', LR: 'var(--r-likely)', SR: 'var(--r-solid)',
}
const WIN_FILL = { D: 'var(--d-solid)', R: 'var(--r-solid)', I: 'var(--ind)' }
const LEAD_FILL = { D: 'var(--d-lean)', R: 'var(--r-lean)', I: 'var(--ind)' }

// Same coloring for a statewide race or a single House district.
function raceShade(label: string, race: Race, mode: Mode, results: Record<string, Result>): Shade {
  const base = `${label}: ${RATING_LABEL[race.rating]}`
  if (mode === 'forecast') return { fill: RATING_FILL[race.rating], tip: base }
  const res = results[race.id]
  if (res?.called && res.winner) return { fill: WIN_FILL[res.winner], tip: `${label}: ${res.winner} win${res.winner !== race.held ? ' (flip)' : ''}` }
  const lead = leader(res)
  if (lead) return { fill: LEAD_FILL[lead.party], tip: `${label}: ${lead.party} +${lead.margin.toFixed(1)}, not called` }
  return { fill: 'var(--uncalled)', tip: `${base}, no results yet` }
}

export function UsMap(props: Props) {
  return props.info.chamber === 'house' ? <HouseHexMap {...props} /> : <StateMap {...props} />
}

function StateMap({ info, mode, results, onSelectRace }: Props) {
  const [hover, setHover] = useState<string | null>(null)
  const byState = useMemo(() => new Map(info.races.map((r) => [r.label, r])), [info.races])

  const shade = (abbr: string, name: string): Shade => {
    const race = byState.get(abbr)
    return race ? raceShade(name, race, mode, results) : { fill: 'var(--map-empty)', tip: `${name}: no ${info.title.toLowerCase()} race` }
  }
  const hovered = hover ? STATES.find((s) => s.abbr === hover) : null

  return (
    <div className="map">
      <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} role="img" aria-label={`${info.title} map`}>
        {STATES.map((s) => {
          const { fill, tip } = shade(s.abbr, s.name)
          const race = byState.get(s.abbr)
          return (
            <path
              key={s.abbr}
              d={s.d}
              fill={fill}
              className={`state ${race ? 'has-race' : ''}`}
              onMouseEnter={() => setHover(s.abbr)}
              onMouseLeave={() => setHover(null)}
              onClick={() => race && onSelectRace(race)}
            >
              <title>{tip}</title>
            </path>
          )
        })}
        <path d={BORDERS} className="borders" />
      </svg>
      <div className="map-caption muted">{hovered ? shade(hovered.abbr, hovered.name).tip : 'Click a state to open its race.'}</div>
      <MapLegend mode={mode} withEmpty />
    </div>
  )
}

function HouseHexMap({ info, mode, results, selectedState, onSelectRace, onSelectState }: Props) {
  const [hover, setHover] = useState<string | null>(null)
  const byId = useMemo(() => new Map(info.races.map((r) => [r.id, r])), [info.races])
  const hoveredRace = hover ? byId.get(hover) : null

  return (
    <div className="map">
      <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} role="img" aria-label="House districts map, one hexagon per seat">
        {HEX_CELLS.map((c) => {
          const race = byId.get(c.raceId)
          if (!race) return null
          const { fill, tip } = raceShade(race.label, race, mode, results)
          return (
            <polygon
              key={c.raceId}
              points={hexPoints(c.x, c.y)}
              fill={fill}
              className={`hex ${selectedState && selectedState !== c.state ? 'dim' : ''}`}
              onMouseEnter={() => setHover(c.raceId)}
              onMouseLeave={() => setHover(null)}
              onClick={() => onSelectRace(race)}
            >
              <title>{`${tip} · ${race.incumbent === 'Open' ? (race.note ?? 'Open seat') : race.incumbent}`}</title>
            </polygon>
          )
        })}
        <path d={STATE_EDGES} className="hex-edges" />
        {STATE_LABELS.map((l) => (
          <text
            key={l.state}
            x={l.x}
            y={l.y}
            className={`hex-label ${l.n === 1 ? 'small' : ''} ${selectedState === l.state ? 'selected' : ''}`}
            onClick={() => onSelectState(selectedState === l.state ? null : l.state)}
          >
            {l.state}
          </text>
        ))}
      </svg>
      <div className="map-caption muted">
        {hoveredRace
          ? `${raceShade(hoveredRace.label, hoveredRace, mode, results).tip} · ${hoveredRace.incumbent === 'Open' ? (hoveredRace.note ?? 'Open seat') : hoveredRace.incumbent}`
          : 'One hexagon per district, grouped by state. Click a district to open it, or a state label to list its seats.'}
      </div>
      <MapLegend mode={mode} />
    </div>
  )
}

function MapLegend({ mode, withEmpty = false }: { mode: Mode; withEmpty?: boolean }) {
  if (mode === 'forecast') {
    return (
      <div className="legend">
        {Object.entries(RATING_LABEL).map(([k, label]) => (
          <span key={k} className="legend-item">
            <i className={`swatch seg-${k}`} /> {label}
          </span>
        ))}
        {withEmpty && (
          <span className="legend-item">
            <i className="swatch map-empty" /> No race
          </span>
        )}
      </div>
    )
  }
  return (
    <div className="legend">
      <span className="legend-item"><i className="swatch seg-SD" /> Dem win</span>
      <span className="legend-item"><i className="swatch seg-TD" /> Dem leads</span>
      <span className="legend-item"><i className="swatch seg-uncalled" /> No results</span>
      <span className="legend-item"><i className="swatch seg-TR" /> GOP leads</span>
      <span className="legend-item"><i className="swatch seg-SR" /> GOP win</span>
    </div>
  )
}
