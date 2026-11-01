import { useMemo, useState } from 'react'
import { geoPath } from 'd3-geo'
import { feature, mesh } from 'topojson-client'
import type { GeometryCollection, Topology } from 'topojson-specification'
import statesTopo from 'us-atlas/states-albers-10m.json'
import { RATING_LABEL, type Race, type Result } from '../data/types'
import { isCompetitive, leader, type ChamberInfo } from '../lib/tally'
import type { Mode } from './ChamberBar'

// FIPS code -> postal abbreviation (us-atlas ids are FIPS).
const FIPS: Record<string, string> = {
  '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA', '08': 'CO', '09': 'CT', '10': 'DE', '11': 'DC',
  '12': 'FL', '13': 'GA', '15': 'HI', '16': 'ID', '17': 'IL', '18': 'IN', '19': 'IA', '20': 'KS', '21': 'KY',
  '22': 'LA', '23': 'ME', '24': 'MD', '25': 'MA', '26': 'MI', '27': 'MN', '28': 'MS', '29': 'MO', '30': 'MT',
  '31': 'NE', '32': 'NV', '33': 'NH', '34': 'NJ', '35': 'NM', '36': 'NY', '37': 'NC', '38': 'ND', '39': 'OH',
  '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI', '45': 'SC', '46': 'SD', '47': 'TN', '48': 'TX', '49': 'UT',
  '50': 'VT', '51': 'VA', '53': 'WA', '54': 'WV', '55': 'WI', '56': 'WY',
}

// The topology is pre-projected to a 975x610 Albers USA frame, so no projection is needed.
const topo = statesTopo as unknown as Topology<{ states: GeometryCollection<{ name: string }> }>
const path = geoPath()
const STATES = feature(topo, topo.objects.states).features.map((f) => ({
  abbr: FIPS[String(f.id)],
  name: f.properties.name,
  d: path(f) ?? '',
}))
const BORDERS = path(mesh(topo, topo.objects.states, (a, b) => a !== b)) ?? ''

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

export function UsMap({ info, mode, results, selectedState, onSelectRace, onSelectState }: Props) {
  const [hover, setHover] = useState<string | null>(null)
  const isHouse = info.chamber === 'house'

  const byState = useMemo(() => {
    const m = new Map<string, Race[]>()
    for (const race of info.races) {
      const abbr = race.label.slice(0, 2)
      m.set(abbr, [...(m.get(abbr) ?? []), race])
    }
    return m
  }, [info.races])

  const shade = (abbr: string, name: string): Shade => {
    const races = byState.get(abbr) ?? []
    if (races.length === 0) return { fill: 'var(--map-empty)', tip: `${name}: no ${info.title.toLowerCase()} race` }
    return isHouse ? houseShade(name, races, mode, results) : statewideShade(name, races[0], mode, results)
  }

  const hovered = hover ? STATES.find((s) => s.abbr === hover) : null

  return (
    <div className="map">
      <svg viewBox="0 0 975 610" role="img" aria-label={`${info.title} map`}>
        {STATES.map((s) => {
          const { fill, tip } = shade(s.abbr, s.name)
          const races = byState.get(s.abbr)
          return (
            <path
              key={s.abbr}
              d={s.d}
              fill={fill}
              className={`state ${races ? 'has-race' : ''} ${selectedState === s.abbr ? 'selected' : ''}`}
              onMouseEnter={() => setHover(s.abbr)}
              onMouseLeave={() => setHover(null)}
              onClick={() => {
                if (!races) return
                if (isHouse) onSelectState(selectedState === s.abbr ? null : s.abbr)
                else onSelectRace(races[0])
              }}
            >
              <title>{tip}</title>
            </path>
          )
        })}
        <path d={BORDERS} className="borders" />
      </svg>
      <div className="map-caption muted">
        {hovered ? shade(hovered.abbr, hovered.name).tip : isHouse ? 'Click a state to filter the race list.' : 'Click a state to open its race.'}
      </div>
      <MapLegend isHouse={isHouse} mode={mode} />
    </div>
  )
}

const RATING_FILL: Record<string, string> = {
  SD: 'var(--d-solid)', LD: 'var(--d-likely)', TD: 'var(--d-lean)', TU: 'var(--tossup)',
  TR: 'var(--r-lean)', LR: 'var(--r-likely)', SR: 'var(--r-solid)',
}
const WIN_FILL = { D: 'var(--d-solid)', R: 'var(--r-solid)', I: 'var(--ind)' }
const LEAD_FILL = { D: 'var(--d-lean)', R: 'var(--r-lean)', I: 'var(--ind)' }

function statewideShade(name: string, race: Race, mode: Mode, results: Record<string, Result>): Shade {
  const base = `${name}: ${RATING_LABEL[race.rating]}`
  if (mode === 'forecast') return { fill: RATING_FILL[race.rating], tip: base }
  const res = results[race.id]
  if (res?.called && res.winner) return { fill: WIN_FILL[res.winner], tip: `${name}: ${res.winner} win${res.winner !== race.held ? ' (flip)' : ''}` }
  const lead = leader(res)
  if (lead) return { fill: LEAD_FILL[lead.party], tip: `${name}: ${lead.party} +${lead.margin.toFixed(1)}, not called` }
  return { fill: 'var(--uncalled)', tip: `${base}, no results yet` }
}

function houseShade(name: string, races: Race[], mode: Mode, results: Record<string, Result>): Shade {
  const seats = `${races.length} seat${races.length === 1 ? '' : 's'}`
  if (mode === 'forecast') {
    const competitive = races.filter((r) => isCompetitive(r.rating)).length
    // Sequential scale on the toss-up hue: 0 competitive seats is near-empty, 8+ is full.
    const t = Math.min(competitive / 8, 1)
    return {
      fill: competitive ? `color-mix(in srgb, var(--tossup) ${25 + t * 75}%, var(--map-empty))` : 'var(--map-empty)',
      tip: `${name}: ${competitive} competitive of ${seats}`,
    }
  }
  let d = 0
  let r = 0
  for (const race of races) {
    const res = results[race.id]
    if (res?.called && res.winner === 'D') d++
    if (res?.called && res.winner === 'R') r++
  }
  if (d + r === 0) return { fill: 'var(--uncalled)', tip: `${name}: none of ${seats} called` }
  const dShare = (d / (d + r)) * 100
  return {
    fill: `color-mix(in srgb, var(--d-solid) ${dShare}%, var(--r-solid))`,
    tip: `${name}: D ${d}, R ${r}, ${races.length - d - r} uncalled`,
  }
}

function MapLegend({ isHouse, mode }: { isHouse: boolean; mode: Mode }) {
  if (isHouse) {
    return (
      <div className="legend">
        {mode === 'forecast' ? (
          <span className="legend-item">
            <i className="swatch gradient-tossup" /> More competitive seats
          </span>
        ) : (
          <span className="legend-item">
            <i className="swatch gradient-dr" /> Share of called seats, D to R
          </span>
        )}
      </div>
    )
  }
  if (mode === 'forecast') {
    return (
      <div className="legend">
        {Object.entries(RATING_LABEL).map(([k, label]) => (
          <span key={k} className="legend-item">
            <i className={`swatch seg-${k}`} /> {label}
          </span>
        ))}
        <span className="legend-item">
          <i className="swatch map-empty" /> No race
        </span>
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
