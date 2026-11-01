import { useCallback, useEffect, useState } from 'react'
import type { Result, ResultsFile } from '../data/types'

const POLL_MS = 30_000

// Loads public/results.json and re-polls it, so edits made in any tab (or by hand
// in the file) show up everywhere within ~30s.
export function useResults() {
  const [data, setData] = useState<ResultsFile>({ updated: null, races: {} })
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/results.json?t=${Date.now()}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
      setError(null)
    } catch (err) {
      setError(`Couldn't load results: ${err}`)
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, POLL_MS)
    return () => clearInterval(id)
  }, [load])

  const saveRace = useCallback(
    async (id: string, result: Result | null) => {
      const races = { ...data.races }
      if (result) races[id] = result
      else delete races[id]
      const next: ResultsFile = { updated: new Date().toISOString(), races }
      setData(next)
      const res = await fetch('/api/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      })
      if (!res.ok) {
        setError('Saving only works under `npm run dev`; this change is local to this tab.')
      } else {
        setError(null)
      }
    },
    [data],
  )

  return { results: data.races, updated: data.updated, loaded, error, saveRace, reload: load }
}
