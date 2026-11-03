import type { Party } from './types.ts'

// Source: RealClearPolling race pages, pulled Nov 2, 2026.
// "avg" is the RCP Average; where RCP has no average, "poll" is the most recent single poll.
// https://www.realclearpolling.com/latest-polls/senate
// https://www.realclearpolling.com/latest-polls/governor
export const POLLS_AS_OF = '2026-11-02'

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
  'senate-AK': avg('10/8–11/1', { D: 49.2, R: 48.2 }),
  'senate-FL': avg('10/2–10/30', { D: 43.4, R: 49.7 }),
  'senate-GA': avg('9/21–10/17', { D: 51.2, R: 43.0 }),
  'senate-IA': avg('10/13–11/1', { D: 47.0, R: 47.1 }),
  'senate-KS': avg('10/13–11/1', { D: 50.1, R: 46.0 }),
  'senate-ME': avg('10/8–11/1', { D: 49.8, R: 47.0 }),
  'senate-MI': avg('10/15–11/1', { D: 50.3, R: 45.0 }),
  'senate-MN': avg('10/5–11/1', { D: 48.9, R: 43.7 }),
  'senate-NC': avg('10/1–11/1', { D: 52.8, R: 41.8 }),
  'senate-NE': avg('9/28–10/29', { I: 45.0, R: 48.7 }),
  'senate-NH': avg('9/28–10/31', { D: 50.6, R: 42.6 }),
  'senate-OH': avg('10/15–11/1', { D: 48.5, R: 45.7 }),
  'senate-SC': avg('10/14–11/1', { D: 45.4, R: 48.0 }),
  'senate-TX': avg('10/15–11/1', { D: 49.1, R: 46.5 }),

  // Governors
  'gov-AK': avg('9/8–10/30', { D: 53.8, R: 46.3 }),
  'gov-AZ': avg('7/26–10/28', { D: 50.2, R: 41.0 }),
  'gov-FL': avg('10/12–10/30', { D: 44.3, R: 48.3 }),
  'gov-GA': avg('9/21–10/17', { D: 47.3, R: 48.3 }),
  'gov-IA': avg('10/8–11/1', { D: 51.9, R: 44.4 }),
  'gov-KS': avg('10/20–11/1', { D: 48.2, R: 48.0 }),
  'gov-MI': avg('10/19–11/1', { D: 51.3, R: 43.3 }),
  'gov-NE': poll('YouGov', '10/26–10/29', { D: 47, R: 50 }),
  'gov-NH': avg('10/2–10/31', { D: 43.5, R: 49.5 }),
  'gov-NV': poll('Noble Predictive Insights', '10/26–10/28', { D: 47, R: 47 }),
  'gov-OH': avg('10/9–11/1', { D: 49.6, R: 45.1 }),
  'gov-TX': avg('10/15–11/1', { D: 47.4, R: 49.7 }),
  'gov-WI': avg('8/12–10/23', { D: 48.5, R: 44.0 }),
}
