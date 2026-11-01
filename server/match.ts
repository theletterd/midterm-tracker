import type { Contest } from './types.ts'

type Party = 'D' | 'R' | 'I'

// Feed contest names vary by state ("US SENATE (VOTE FOR 1)", "United States Senator",
// "U. S. REPRESENTATIVE DISTRICT 15", "Representative to Congress - District 07", …).
const SENATE = /^(u\.?\s*s\.?|united states)\s+senat/i
const HOUSE = /^((u\.?\s*s\.?|united states)\s+(house of\s+)?representatives?|representative to congress)\b.*?district\s*0*(\d+)/i
const GOVERNOR = /^governor\b/i

export function raceIdFor(state: string, contestName: string): string | null {
  const name = contestName.trim()
  if (SENATE.test(name)) return `senate-${state}`
  if (GOVERNOR.test(name)) return `gov-${state}`
  const m = name.match(HOUSE)
  if (m) return `house-${state}-${m[4].padStart(2, '0')}`
  return null
}

export function normalizeParty(code: string): Party | null {
  const c = code.trim().toUpperCase()
  if (c === 'D' || c === 'DEM' || c === 'DFL' || c === 'DEMOCRATIC') return 'D'
  if (c === 'R' || c === 'REP' || c === 'REPUBLICAN') return 'R'
  if (c === 'I' || c === 'IND' || c === 'NPA') return 'I'
  return null
}

export interface Tally {
  pct: Partial<Record<Party, number>> // share of all votes cast in the contest
  votes: Partial<Record<Party, number>>
  total: number
  reporting?: number // % of precincts reporting
}

// Collapse a contest to the top candidate per party. Shares are of the total vote,
// including minor candidates, which is how results are usually reported.
export function tally(contest: Contest): Tally {
  const total = contest.candidates.reduce((s, c) => s + c.votes, 0)
  const votes: Tally['votes'] = {}
  for (const c of contest.candidates) {
    const p = normalizeParty(c.party)
    if (p && c.votes >= (votes[p] ?? 0)) votes[p] = c.votes
  }
  const pct: Tally['pct'] = {}
  for (const [p, v] of Object.entries(votes) as [Party, number][]) {
    pct[p] = total ? Math.round((v / total) * 1000) / 10 : 0
  }
  const reporting =
    contest.total && contest.reported != null ? Math.round((contest.reported / contest.total) * 1000) / 10 : undefined
  return { pct, votes, total, reporting }
}
