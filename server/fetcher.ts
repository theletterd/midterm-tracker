import { raceIdFor, tally, type Tally } from './match.ts'
import { update } from './store.ts'
import type { Source } from './types.ts'

export interface FeedReport {
  state: string
  ok: boolean
  races: number // contests matched to a race id
  withVotes: number
  error?: string
}

export interface Matched {
  id: string
  source: string
  tally: Tally
  candidates: { name: string; party: string }[]
}

// Fetch every source in parallel; one failing state doesn't stop the others.
export async function collect(sources: Source[]): Promise<{ matched: Matched[]; reports: FeedReport[] }> {
  const matched: Matched[] = []
  const reports = await Promise.all(
    sources.map(async (src): Promise<FeedReport> => {
      try {
        const contests = await src.fetchContests()
        let races = 0
        let withVotes = 0
        for (const c of contests) {
          const id = raceIdFor(src.state, c.name)
          if (!id) continue
          const t = tally(c)
          races++
          if (t.total > 0) withVotes++
          matched.push({ id, source: src.label, tally: t, candidates: c.candidates.map(({ name, party }) => ({ name, party })) })
        }
        return { state: src.state, ok: true, races, withVotes }
      } catch (err) {
        return { state: src.state, ok: false, races: 0, withVotes: 0, error: err instanceof Error ? err.message : String(err) }
      }
    }),
  )
  return { matched, reports }
}

// Merge fetched numbers into results.json without touching calls or notes, append
// a history snapshot whenever a race's vote total moves, and remember each race's
// nominees (published before any votes) for matching call posts.
export async function fetchOnce(sources: Source[]): Promise<FeedReport[]> {
  const { matched, reports } = await collect(sources)
  const now = new Date().toISOString()
  await update(({ results, history, nominees }) => {
    let changed = false
    for (const { id, source, tally: t, candidates } of matched) {
      if (candidates.length && JSON.stringify(nominees[id]) !== JSON.stringify(candidates)) {
        nominees[id] = candidates
        changed = true
      }
      // Before polls close feeds publish zeros; skip them so the board stays clean.
      if (t.total === 0) continue
      const prev = results.races[id] ?? {}
      if (prev.totalVotes === t.total && prev.reporting === t.reporting) continue
      changed = true
      results.races[id] = {
        ...prev,
        pct: t.pct,
        votes: t.votes,
        totalVotes: t.total,
        reporting: t.reporting,
        reportingKind: t.reporting != null ? 'precincts' : prev.reportingKind,
        source,
        fetchedAt: now,
      }
      const snaps = (history[id] ??= [])
      if (snaps.at(-1)?.total !== t.total) snaps.push({ t: now, pct: t.pct, reporting: t.reporting, total: t.total })
    }
    return changed
  })
  return reports
}

export function formatReports(reports: FeedReport[]): string {
  return reports
    .map((r) => (r.ok ? `${r.state}: ${r.races} races (${r.withVotes} with votes)` : `${r.state}: FAILED – ${r.error}`))
    .join(' · ')
}
