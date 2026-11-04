import { GOVERNORS } from '../src/data/governors.ts'
import { HOUSE } from '../src/data/house.ts'
import { SENATE } from '../src/data/senate.ts'
import type { Race } from '../src/data/types.ts'
import { applyCall } from '../src/lib/calls.ts'
import { getJson } from './http.ts'
import { normalizeParty } from './match.ts'
import { update, type CallEntry, type HouseTally, type NomineesFile, type State } from './store.ts'

// Decision Desk HQ race calls from its Bluesky account. Every call uses one template:
//   "Decision Desk HQ projects Chris Coons wins the DE US Senate Democratic Primary
//    #DecisionMade: 8:14 PM EDT"
// Following the account by DID (not handle) means a lookalike account can't inject calls.
export const DDHQ_DID = 'did:plc:catipgdd42lzwcqfsfcc6ype'
const FEED = 'https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed'

// Ignore anything posted before election day, e.g. calls in this summer's special elections.
export const CALLS_SINCE = '2026-11-03T06:00:00-05:00'

const RACES = new Map<string, Race>([...SENATE, ...GOVERNORS, ...HOUSE].map((r) => [r.id, r]))

const STATE_NAMES: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA', colorado: 'CO', connecticut: 'CT',
  delaware: 'DE', florida: 'FL', georgia: 'GA', hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA',
  kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD', massachusetts: 'MA', michigan: 'MI',
  minnesota: 'MN', mississippi: 'MS', missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC',
  'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI',
  'south carolina': 'SC', 'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT',
  virginia: 'VA', washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY',
}
const ABBRS = new Set(Object.values(STATE_NAMES))

export interface ParsedCall {
  winnerName: string
  raceId: string // may not exist in our data; checked later
  calledAt: string
  primary: boolean
  primaryParty?: 'D' | 'R' // for primary calls, whose primary it was
}

const CALL = /Decision Desk HQ projects\s+(?:that\s+)?(.+?)\s+wins the\s+(?:\d{4}\s+)?(.+?)\s*(?:\||#DecisionMade|$)/is
const CALLED_AT = /#DecisionMade:\s*([0-9:]+\s*[AP]M(?:\s*[A-Z]{2,4})?)/i

// Turn a post into a race id, or null if it isn't a Senate, governor or US House call.
export function parsePost(text: string): ParsedCall | null {
  const m = text.match(CALL)
  if (!m) return null
  const winnerName = m[1].trim()
  let rest = m[2].trim()
  const primary = /\b(primary|runoff)\b/i.test(rest)
  const primaryParty = !primary ? undefined : /\b(democratic|dfl)\b/i.test(rest) ? 'D' : /\brepublican\b/i.test(rest) ? 'R' : undefined

  let state: string | undefined
  const two = rest.slice(0, 2).toUpperCase()
  if (ABBRS.has(two) && rest[2] === ' ') {
    state = two
    rest = rest.slice(3)
  } else {
    const lower = rest.toLowerCase()
    const name = Object.keys(STATE_NAMES)
      .sort((a, b) => b.length - a.length) // "west virginia" before "virginia"
      .find((n) => lower.startsWith(n + ' '))
    if (name) {
      state = STATE_NAMES[name]
      rest = rest.slice(name.length + 1)
    }
  }
  if (!state) return null

  const calledAt = text.match(CALLED_AT)?.[1] ?? ''
  if (/^US Senate\b/i.test(rest)) return { winnerName, raceId: `senate-${state}`, calledAt, primary, primaryParty }
  if (/^Governor\b/i.test(rest)) return { winnerName, raceId: `gov-${state}`, calledAt, primary, primaryParty }
  const house = rest.match(/^US House\s+(\d+|At[- ]?Large|AL)\b/i)
  if (house) {
    const district = /^\d+$/.test(house[1]) ? house[1].padStart(2, '0') : 'AL'
    return { winnerName, raceId: `house-${state}-${district}`, calledAt, primary, primaryParty }
  }
  return null
}

// DDHQ's running count of every House seat it has called, most of which never get their own
// call post: "DDHQ Balance of Power Update: House (8:53 PM) Democrats: 43 Republicans: 35".
const HOUSE_TALLY = /Balance of Power Update:\s*House\s*\(([^)]+)\)\s*Democrats:\s*(\d+)\s*Republicans:\s*(\d+)/i

// The newest tally among newest-first posts. A later post replaces an earlier one, including
// when DDHQ corrects itself under the same time label.
export function latestHouseTally(posts: Post[]): HouseTally | null {
  for (const post of posts) {
    const m = post.text.match(HOUSE_TALLY)
    if (m) return { D: Number(m[2]), R: Number(m[3]), asOf: m[1].trim(), postedAt: post.createdAt, uri: post.uri }
  }
  return null
}

const SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv'])
const tokens = (name: string) =>
  name
    .split(/\s+(?:and|&)\s+|\//i)[0] // "Zach Lahn and Derek Wulf" -> running mate dropped
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter((t) => t && !SUFFIXES.has(t))

// Party of the named winner: from our candidate list, the state feed's nominees, or the
// incumbent's surname. Returns null when no source matches confidently.
export function partyFor(
  race: Race,
  winnerName: string,
  nominees: NomineesFile,
  primaryWinners: NomineesFile = {},
): { party: 'D' | 'R' | 'I' | null; how: string } {
  const w = tokens(winnerName)
  const surname = w.at(-1)
  if (!surname) return { party: null, how: 'no name' }

  const pick = (cands: { name: string; party: string }[]) => {
    const sameSurname = cands.filter((c) => tokens(c.name).includes(surname))
    const exact = sameSurname.filter((c) => tokens(c.name)[0] === w[0])
    const hit = exact.length === 1 ? exact[0] : sameSurname.length === 1 ? sameSurname[0] : null
    return hit ? normalizeParty(hit.party) : null
  }

  if (race.candidates) {
    const p = pick(race.candidates)
    if (p) return { party: p, how: 'candidate list' }
  }
  if (nominees[race.id]) {
    const p = pick(nominees[race.id])
    if (p) return { party: p, how: 'state feed nominees' }
  }
  if (primaryWinners[race.id]) {
    const p = pick(primaryWinners[race.id])
    if (p) return { party: p, how: 'DDHQ primary call' }
  }
  if (race.incumbent !== 'Open' && tokens(race.incumbent).includes(surname)) {
    return { party: race.held, how: 'incumbent' }
  }
  return { party: null, how: 'unmatched' }
}

interface Post {
  uri: string
  text: string
  createdAt: string
}

// Newest-first posts since `since`, following pages until we reach older or already-seen posts.
export async function fetchPosts(since: string, seen: Set<string>, maxPages = 5): Promise<Post[]> {
  const out: Post[] = []
  let cursor: string | undefined
  for (let page = 0; page < maxPages; page++) {
    const qs = new URLSearchParams({ actor: DDHQ_DID, limit: '100', filter: 'posts_no_replies' })
    if (cursor) qs.set('cursor', cursor)
    const d = await getJson<any>(`${FEED}?${qs}`)
    let done = false
    for (const item of d.feed ?? []) {
      if (item.post.author?.did !== DDHQ_DID || item.reason) continue // skip reposts of others
      const createdAt = item.post.record?.createdAt ?? item.post.indexedAt
      if (createdAt < since) {
        done = true
        break
      }
      if (seen.has(item.post.uri)) {
        done = true
        break
      }
      out.push({ uri: item.post.uri, text: item.post.record?.text ?? '', createdAt })
    }
    cursor = d.cursor
    if (done || !cursor) break
  }
  return out
}

// This year's Democratic and Republican primary winners per race, from DDHQ's own primary
// calls. That gives a nominee and party for most races, including states with no results
// feed. Loaded once per process (about 30 requests back to the March primaries).
let primaryWinners: Promise<NomineesFile> | null = null

export function loadPrimaryWinners(): Promise<NomineesFile> {
  primaryWinners ??= fetchPosts('2026-01-01T00:00:00Z', new Set(), 40).then((posts) => {
    const out: NomineesFile = {}
    // Oldest first, so a runoff winner replaces the first-round leader.
    for (const post of posts.reverse()) {
      const call = parsePost(post.text)
      if (!call?.primary || !call.primaryParty) continue
      const list = (out[call.raceId] ??= []).filter((c) => normalizeParty(c.party) !== call.primaryParty)
      list.push({ name: call.winnerName, party: call.primaryParty })
      out[call.raceId] = list
    }
    return out
  })
  primaryWinners.catch(() => (primaryWinners = null)) // retry next time if it failed
  return primaryWinners
}

// Decide what a call does to the board. Mutates state; returns the log entry.
export function resolveCall(post: Post, call: ParsedCall, state: State, primaries: NomineesFile = {}): CallEntry {
  const base = { uri: post.uri, postedAt: post.createdAt, text: post.text, raceId: call.raceId, winnerName: call.winnerName, calledAt: call.calledAt }
  const race = RACES.get(call.raceId)
  if (!race) return { ...base, raceId: null, party: null, status: 'review', reason: `No race ${call.raceId} in the tracker` }

  const { party, how } = partyFor(race, call.winnerName, state.nominees, primaries)
  if (!party) {
    // A House general is almost always incumbent vs. major-party challenger, so a winner who
    // isn't the incumbent most likely flipped the seat. Flips matter most, so confirm by hand.
    if (race.incumbent !== 'Open' && race.held !== 'I') {
      const suggested = race.held === 'D' ? 'R' : 'D'
      return { ...base, party: null, suggested, status: 'review', reason: `${call.winnerName} isn't incumbent ${race.incumbent}; likely a ${suggested} flip` }
    }
    return { ...base, party: null, status: 'review', reason: `Couldn't tell ${call.winnerName}'s party` }
  }

  const prev = state.results.races[race.id]
  if (prev?.called && prev.winner && prev.winner !== party) {
    return { ...base, party, status: 'conflict', reason: `Already called for ${prev.winner}` }
  }
  if (!prev?.called) {
    state.results.races[race.id] = applyCall(prev, { winner: party, called: true, note: `DDHQ${call.calledAt ? `, ${call.calledAt}` : ''}` })
  }
  return { ...base, party, status: 'applied', reason: prev?.called ? 'Already called the same way' : `Party via ${how}` }
}

// Poll once: fetch new posts, apply confident calls, queue the rest for review.
export async function checkCalls(since = CALLS_SINCE): Promise<{ newCalls: number; applied: number; review: number }> {
  // Read-only pass through the store queue to see which posts are already logged.
  let seen = new Set<string>()
  await update(({ calls }) => {
    seen = new Set(calls.entries.map((e) => e.uri))
    return false
  })
  const posts = await fetchPosts(since, seen)

  // Tally posts aren't logged as calls, so `seen` can't find them: read the latest page instead.
  const tally = latestHouseTally(await fetchPosts(since, new Set(), 1))
  if (tally) {
    await update(({ calls }) => {
      if (calls.houseTally && calls.houseTally.postedAt >= tally.postedAt) return false
      calls.houseTally = tally
    })
  }

  const parsed = posts
    .map((p) => ({ post: p, call: parsePost(p.text) }))
    .filter((x): x is { post: Post; call: ParsedCall } => !!x.call && !x.call.primary)

  let applied = 0
  let review = 0
  if (parsed.length === 0) return { newCalls: 0, applied, review }
  const primaries = await loadPrimaryWinners().catch(() => ({}))
  await update((state) => {
    state.calls.checkedAt = new Date().toISOString()
    // Oldest first, so an earlier call is in place before a later conflicting one.
    for (const { post, call } of parsed.reverse()) {
      if (state.calls.entries.some((e) => e.uri === post.uri)) continue
      const entry = resolveCall(post, call, state, primaries)
      state.calls.entries.unshift(entry)
      if (entry.status === 'applied') applied++
      else review++
    }
  })
  return { newCalls: parsed.length, applied, review }
}
