import { readFile, rename, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
export const RESULTS_FILE = resolve(ROOT, 'public/results.json')
export const HISTORY_FILE = resolve(ROOT, 'public/history.json')

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

// The fetcher and the UI's save endpoint both write results.json; run updates one at a time.
// `fn` returns false to skip the write (nothing changed), so `updated` reflects real changes.
let queue: Promise<unknown> = Promise.resolve()

export function update(fn: (results: ResultsFile, history: HistoryFile) => void | boolean | Promise<void | boolean>): Promise<void> {
  const run = queue.then(async () => {
    const results = await readJson<ResultsFile>(RESULTS_FILE, { updated: null, races: {} })
    const history = await readJson<HistoryFile>(HISTORY_FILE, {})
    if ((await fn(results, history)) === false) return
    results.updated = new Date().toISOString()
    await writeJson(RESULTS_FILE, results)
    await writeJson(HISTORY_FILE, history)
  })
  queue = run.catch(() => {})
  return run
}
