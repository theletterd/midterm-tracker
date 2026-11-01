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
  reporting?: number // % of expected vote counted
  pct?: Partial<Record<Party, number>> // vote share
  note?: string
}

export interface ResultsFile {
  updated: string | null
  races: Record<string, Result>
}
