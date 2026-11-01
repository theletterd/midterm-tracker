export type Party = 'D' | 'R' | 'I'
export type Chamber = 'senate' | 'house' | 'gov'

// Cook Political Report categories, Dem-safest to GOP-safest.
export const RATINGS = ['SD', 'LD', 'TD', 'TU', 'TR', 'LR', 'SR'] as const
export type Rating = (typeof RATINGS)[number]

export const RATING_LABEL: Record<Rating, string> = {
  SD: 'Solid D',
  LD: 'Likely D',
  TD: 'Lean D',
  TU: 'Toss Up',
  TR: 'Lean R',
  LR: 'Likely R',
  SR: 'Solid R',
}

export interface Candidate {
  name: string
  party: Party
  incumbent?: boolean
}

export interface Race {
  id: string // e.g. "senate-TX", "house-CA-22", "gov-GA"
  chamber: Chamber
  label: string // "TX" or "CA-22"
  incumbent: string // surname, or "Open"
  held: Party // party currently holding the seat
  rating: Rating
  candidates?: Candidate[]
  note?: string
}

export interface Result {
  winner?: Party
  called?: boolean
  reporting?: number // % of precincts reporting, per the state feed
  reportingKind?: 'precincts'
  pct?: Partial<Record<Party, number>> // vote share
  votes?: Partial<Record<Party, number>>
  totalVotes?: number
  source?: string // state feed the numbers came from
  fetchedAt?: string
  note?: string
}

// The hand-entered part of a result. null clears a field.
export interface CallUpdate {
  winner: Party | null
  called: boolean
  note: string | null
}

// One point in a race's count over the night, appended by the fetcher.
export interface Snapshot {
  t: string
  pct?: Partial<Record<Party, number>>
  reporting?: number
  total: number
}

export interface ResultsFile {
  updated: string | null
  races: Record<string, Result>
}
