import { GOVERNORS, GOV_AS_OF, GOV_NOT_UP } from '../data/governors'
import { HOUSE, HOUSE_AS_OF } from '../data/house'
import { SENATE, SENATE_AS_OF, SENATE_NOT_UP } from '../data/senate'
import { RATINGS, type Chamber, type Party, type Race, type Rating, type Result } from '../data/types'

export interface ChamberInfo {
  chamber: Chamber
  title: string
  races: Race[]
  notUp: { D: number; R: number }
  total: number
  // Seats each party needs for control. Senate: Vance (R) breaks ties, so Dems need 51.
  need: { D: number; R: number } | null
  asOf: string
}

export const CHAMBERS: Record<Chamber, ChamberInfo> = {
  senate: {
    chamber: 'senate',
    title: 'Senate',
    races: SENATE,
    notUp: SENATE_NOT_UP,
    total: 100,
    need: { D: 51, R: 50 },
    asOf: SENATE_AS_OF,
  },
  house: {
    chamber: 'house',
    title: 'House',
    races: HOUSE,
    notUp: { D: 0, R: 0 },
    total: 435,
    need: { D: 218, R: 218 },
    asOf: HOUSE_AS_OF,
  },
  gov: {
    chamber: 'gov',
    title: 'Governors',
    races: GOVERNORS,
    notUp: GOV_NOT_UP,
    total: 50,
    need: null,
    asOf: GOV_AS_OF,
  },
}

export const favoredParty = (rating: Rating): Party | null =>
  rating === 'TU' ? null : rating.endsWith('D') ? 'D' : 'R'

export const isCompetitive = (rating: Rating) => rating !== 'SD' && rating !== 'SR'

export function ratingCounts(races: Race[]): Record<Rating, number> {
  const counts = Object.fromEntries(RATINGS.map((r) => [r, 0])) as Record<Rating, number>
  for (const race of races) counts[race.rating]++
  return counts
}

export interface ResultTally {
  called: Record<Party, number>
  uncalled: number
  flips: Race[]
}

export function resultTally(races: Race[], results: Record<string, Result>): ResultTally {
  const called: Record<Party, number> = { D: 0, R: 0, I: 0 }
  const flips: Race[] = []
  let uncalled = 0
  for (const race of races) {
    const res = results[race.id]
    if (res?.called && res.winner) {
      called[res.winner]++
      if (res.winner !== race.held) flips.push(race)
    } else {
      uncalled++
    }
  }
  return { called, uncalled, flips }
}

export function reportingText(res?: Result): string | null {
  if (res?.reporting == null) return null
  return res.reportingKind === 'precincts' ? `${res.reporting}% of precincts` : `${res.reporting}% in`
}

export function isFlip(race: Race, res?: Result) {
  return !!(res?.called && res.winner && res.winner !== race.held)
}

// Leader by vote share, and margin in points, from partial returns or a poll.
export function leader(res?: Pick<Result, 'pct'>): { party: Party; margin: number } | null {
  if (!res?.pct) return null
  const sorted = (Object.entries(res.pct) as [Party, number][])
    .filter(([, v]) => typeof v === 'number')
    .sort((a, b) => b[1] - a[1])
  if (sorted.length === 0) return null
  return { party: sorted[0][0], margin: sorted[0][1] - (sorted[1]?.[1] ?? 0) }
}
