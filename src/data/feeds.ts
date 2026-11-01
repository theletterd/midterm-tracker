// Bluesky feeds shown on the page. Edit freely; the page picks up changes on reload.

export interface FeedAccount {
  handle: string
  // Big outlets post plenty that isn't about the election; keep only posts matching ELECTION_TERMS.
  electionOnly?: boolean
}

// Checked Nov 1, 2026: each handle exists and posts regularly.
export const CURATED: FeedAccount[] = [
  { handle: 'decisiondeskhq.bsky.social' },
  { handle: 'cookpolitical.com' },
  { handle: 'kkondik.bsky.social' }, // Kyle Kondik, Sabato's Crystal Ball
  { handle: 'gelliottmorris.com' },
  { handle: 'taniel.bsky.social' }, // Bolts editor; deep on down-ballot and state races
  { handle: 'boltsmag.org' },
  { handle: 'daveweigel.bsky.social' },
  { handle: 'apnews.com', electionOnly: true },
  { handle: 'politico.com', electionOnly: true },
  { handle: 'npr.org', electionOnly: true },
  { handle: 'nytimes.com', electionOnly: true },
  { handle: 'washingtonpost.com', electionOnly: true },
]

// "Everything": the latest English posts with any of these tags. Unfiltered.
export const HASHTAGS = ['#Election2026', '#Midterms2026', '#Midterms', '#ElectionNight']

export const ELECTION_TERMS =
  /\b(elections?|midterms?|vot(e|es|ed|ers?|ing)|ballots?|polls?|senate|house|governor|gubernatorial|races?|results|projects?|projected|wins|called|turnout|precincts?|recount|GOP|Democrats?|Republicans?|congress(ional)?)\b/i
