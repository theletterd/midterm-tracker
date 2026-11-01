import { useCallback, useEffect, useState } from 'react'
import type { CallEntry, CallUpdate, Party, ResultsFile, Snapshot } from '../data/types'
import { applyCall } from './calls'

const POLL_MS = 30_000

// Loads public/results.json and public/history.json and re-polls them. The dev server's
// fetcher updates both from state feeds every 2 minutes, and manual edits from any tab
// (calls) land in the same file, so every open tab stays current without a refresh.
export function useResults() {
  const [data, setData] = useState<ResultsFile>({ updated: null, races: {} })
  const [history, setHistory] = useState<Record<string, Snapshot[]>>({})
  const [calls, setCalls] = useState<CallEntry[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const t = Date.now()
      const [res, hist, callsRes] = await Promise.all([
        fetch(`/results.json?t=${t}`),
        fetch(`/history.json?t=${t}`),
        fetch(`/calls.json?t=${t}`),
      ])
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
      if (hist.ok) setHistory(await hist.json())
      if (callsRes.ok) setCalls((await callsRes.json()).entries ?? [])
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

  // Saves a call. Feed numbers on the same race are left alone.
  const saveCall = useCallback(async (id: string, update: CallUpdate) => {
    setData((prev) => ({ ...prev, races: { ...prev.races, [id]: applyCall(prev.races[id], update) } }))
    const res = await fetch('/api/results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, update }),
    }).catch(() => null)
    setError(res?.ok ? null : 'Saving only works under `npm run dev`; this change is local to this tab.')
  }, [])

  // Confirm (with a party) or dismiss a DDHQ call that's waiting for review.
  const resolveCall = useCallback(
    async (uri: string, action: 'apply' | 'dismiss', party?: Party) => {
      const res = await fetch('/api/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uri, action, party }),
      }).catch(() => null)
      setError(res?.ok ? null : 'Resolving calls only works under `npm run dev`.')
      await load()
    },
    [load],
  )

  return { results: data.races, history, calls, updated: data.updated, loaded, error, saveCall, resolveCall, reload: load }
}
