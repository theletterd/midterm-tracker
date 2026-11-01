import type { Party } from './types.ts'

// Source: RealClearPolling race pages, pulled Nov 1, 2026.
// "avg" is the RCP Average; where RCP has no average, "poll" is the most recent single poll.
// https://www.realclearpolling.com/latest-polls/senate
// https://www.realclearpolling.com/latest-polls/governor
export const POLLS_AS_OF = '2026-11-01'

export interface Poll {
  kind: 'avg' | 'poll'
  source: string // "RCP Average" or pollster name
  dates: string
  pct: Partial<Record<Party, number>>
}

const avg = (dates: string, pct: Poll['pct']): Poll => ({ kind: 'avg', source: 'RCP Average', dates, pct })
const poll = (source: string, dates: string, pct: Poll['pct']): Poll => ({ kind: 'poll', source, dates, pct })

export const POLLS: Record<string, Poll> = {
  // Senate
  'senate-AK': avg('10/8–10/29', { D: 49.4, R: 48.2 }),
  'senate-FL': avg('10/2–10/30', { D: 43.4, R: 49.7 }),
  'senate-GA': avg('9/21–10/17', { D: 51.2, R: 43.0 }),
  'senate-IA': avg('9/29–10/28', { D: 45.5, R: 46.0 }),
  'senate-KS': avg('9/22–10/28', { D: 48.3, R: 45.7 }),
  'senate-ME': avg('10/5–10/26', { D: 48.7, R: 47.0 }),
  'senate-MI': avg('9/28–10/29', { D: 49.1, R: 45.6 }),
  'senate-MN': avg('10/2–10/28', { D: 48.3, R: 42.5 }),
  'senate-NC': avg('9/27–10/25', { D: 51.1, R: 40.4 }),
  'senate-NE': poll('NY Times/Siena', '10/31', { I: 43, R: 49 }),
  'senate-NH': avg('9/15–10/23', { D: 49.4, R: 42.7 }),
  'senate-OH': avg('10/5–10/26', { D: 47.9, R: 45.3 }),
  'senate-SC': avg('9/28–10/26', { D: 45.0, R: 47.7 }),
  'senate-TX': avg('10/15–10/28', { D: 48.2, R: 46.8 }),

  // Governors
  'gov-AK': avg('9/8–10/25', { D: 53.3, R: 46.8 }),
  'gov-FL': avg('10/2–10/30', { D: 44.0, R: 48.6 }),
  'gov-GA': avg('9/21–10/17', { D: 47.3, R: 48.3 }),
  'gov-IA': avg('10/5–10/28', { D: 50.8, R: 44.4 }),
  'gov-KS': avg('9/8–10/28', { D: 45.5, R: 48.7 }),
  'gov-MI': avg('9/24–10/29', { D: 51.1, R: 43.3 }),
  'gov-NE': poll('NY Times/Siena', '10/23–10/29', { D: 40, R: 53 }),
  'gov-NH': avg('9/15–10/23', { D: 41.4, R: 50.2 }),
  'gov-NV': poll('Noble Predictive Insights', '10/26–10/28', { D: 47, R: 47 }),
  'gov-OH': avg('9/29–10/26', { D: 48.6, R: 44.3 }),
  'gov-TX': avg('10/8–10/28', { D: 46.6, R: 50.3 }),
  'gov-WI': avg('8/12–10/23', { D: 48.5, R: 44.0 }),
}
