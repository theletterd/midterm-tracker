import { readFile, rename, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
export const RESULTS_FILE = resolve(ROOT, 'public/results.json')
export const HISTORY_FILE = resolve(ROOT, 'public/history.json')
export const CALLS_FILE = resolve(ROOT, 'public/calls.json')
export const NOMINEES_FILE = resolve(ROOT, 'public/nominees.json')

export interface StoredResult {
  winner?: 'D' | 'R' | 'I'
  called?: boolean
  reporting?: number
  reportingKind?: 'precincts'
  pct?: Partial<Record<'D' | 'R' | 'I', number>>
  votes?: Partial<Record<'D' | 'R' | 'I', number>>
  totalVotes?: number
  source?: string
  fetchedAt?: string
  note?: string
}

export interface ResultsFile {
  updated: string | null
  races: Record<string, StoredResult>
}

export interface Snapshot {
  t: string
  pct: StoredResult['pct']
  reporting?: number
  total: number
}

export type HistoryFile = Record<string, Snapshot[]>

// Candidate names and parties per race, as listed by state feeds (used to match call posts).
export type NomineesFile = Record<string, { name: string; party: string }[]>

export type CallStatus = 'applied' | 'review' | 'conflict' | 'dismissed' | 'resolved'

export interface CallEntry {
  uri: string // Bluesky post URI, unique per call
  postedAt: string
  text: string
  raceId: string | null
  winnerName: string
  party: 'D' | 'R' | 'I' | null
  suggested?: 'D' | 'R' // best guess when party is unknown, for one-click confirmation
  calledAt: string // as written in the post, e.g. "10:42 PM EST"
  status: CallStatus
  reason?: string // why it needs review
}

export interface CallsFile {
  checkedAt: string | null
  entries: CallEntry[] // newest first
}

export interface State {
  results: ResultsFile
  history: HistoryFile
  calls: CallsFile
  nominees: NomineesFile
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as T
  } catch {
    return fallback
  }
}

// Write to a temp file and rename, so the browser never reads a half-written file.
async function writeJson(file: string, data: unknown) {
  const tmp = `${file}.tmp`
  await writeFile(tmp, JSON.stringify(data, null, 2) + '\n')
  await rename(tmp, file)
}

// The fetcher, the call tracker and the UI's endpoints all write these files; run updates
// one at a time. `fn` returns false to skip the write (nothing changed), so `updated`
// reflects real changes.
let queue: Promise<unknown> = Promise.resolve()

export function update(fn: (state: State) => void | boolean | Promise<void | boolean>): Promise<void> {
  const run = queue.then(async () => {
    const state: State = {
      results: await readJson<ResultsFile>(RESULTS_FILE, { updated: null, races: {} }),
      history: await readJson<HistoryFile>(HISTORY_FILE, {}),
      calls: await readJson<CallsFile>(CALLS_FILE, { checkedAt: null, entries: [] }),
      nominees: await readJson<NomineesFile>(NOMINEES_FILE, {}),
    }
    if ((await fn(state)) === false) return
    state.results.updated = new Date().toISOString()
    await writeJson(RESULTS_FILE, state.results)
    await writeJson(HISTORY_FILE, state.history)
    await writeJson(CALLS_FILE, state.calls)
    await writeJson(NOMINEES_FILE, state.nominees)
  })
  queue = run.catch(() => {})
  return run
}
