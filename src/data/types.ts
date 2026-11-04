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

// A race call read from Decision Desk HQ's Bluesky posts (see server/ddhq.ts).
export interface CallEntry {
  uri: string
  postedAt: string
  text: string
  raceId: string | null
  winnerName: string
  party: Party | null
  suggested?: 'D' | 'R'
  calledAt: string
  status: 'applied' | 'review' | 'conflict' | 'dismissed' | 'resolved'
  reason?: string
}

export interface HouseTally {
  D: number
  R: number
  asOf: string
  postedAt: string
  uri: string
}

export interface ResultsFile {
  updated: string | null
  races: Record<string, Result>
}

// Ballots already cast before Election Day, by registered party. Written by server/turnout.ts.
export interface PartySplit {
  D: number
  R: number
  unaffiliated: number
  other: number
}

export interface TurnoutState {
  state: string
  name: string
  asOf: string // when the state compiled the numbers
  source: string
  url: string
  total: number
  parties: PartySplit
  methods: { label: string; total: number }[]
  baseline: { label: string; total: number; parties: PartySplit; turnout: number } // 2022
  history: { asOf: string; total: number; D: number; R: number }[] // one point per state update
}

// One row per state from the UF Election Lab's national early-vote file.
export interface TurnoutRow {
  state: string
  name: string
  updated: string // YYYY-MM-DD, the day the state's numbers were last updated
  source: string
  notes?: string
  voted: number
  inPerson: number
  mail: number
  turnout2022: number // every ballot cast in 2022
  parties: { D: number; R: number; none: number } | null // only where the state registers by party
}

export interface TurnoutFile {
  checkedAt: string | null
  states: TurnoutState[]
  national: { asOf: string; source: string; rows: TurnoutRow[] } | null
}
