import { clarity, enhancedVoting, florida, mnsos, ncsbe, ohio, texas } from './sources.ts'
import type { Source } from './types.ts'

// Official state results feeds for Nov 3, 2026.
//
// Not covered (no live statewide feed, or not yet worked out), so enter these by hand:
//   MI, WI, NH, ME — counties/towns report separately; the state posts totals later.
//   AK (ranked-choice, HTML reports), KS, NV, NE, AZ, OR, MS, OK, VT.
const SC_ELECTION_ID: string | null = '127300'

export const FEEDS_2026: Source[] = [
  ncsbe('20261103'),
  mnsos('20261103'),
  clarity('IA', 'Iowa Secretary of State', 'https://electionresults.iowa.gov/IA', '127077'),
  clarity('SC', 'SC Election Commission', 'https://www.enr-scvotes.org/SC', SC_ELECTION_ID),
  enhancedVoting('GA', 'Georgia Secretary of State', 'https://results.sos.ga.gov/results/public', 'Georgia', '2026-11-03'),
  ohio(),
  texas('2026', /NOVEMBER 3RD GENERAL/i),
  florida('11/3/2026'),
]

// The same feeds pointed at the Nov 5, 2024 general, for testing the parsers against
// real numbers. Ohio's API only serves the current election, so it's tested on 2026 zeros.
export const FEEDS_2024: Source[] = [
  ncsbe('20241105'),
  mnsos('20241105'),
  clarity('IA', 'Iowa Secretary of State', 'https://electionresults.iowa.gov/IA', '122322'),
  enhancedVoting('GA', 'Georgia Secretary of State', 'https://results.sos.ga.gov/results/public', 'Georgia', '2024-11-05'),
  ohio(),
  texas('2024', /NOVEMBER 5TH GENERAL/i),
  florida('11/5/2024'),
]
