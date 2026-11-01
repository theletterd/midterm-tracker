import type { CallUpdate, Result } from '../data/types'

// Apply a hand-entered call to a race, leaving the feed's numbers untouched.
// Shared by the browser (optimistic update) and the dev server (persisted write).
export function applyCall(prev: Result | undefined, update: CallUpdate): Result {
  const next: Result = { ...prev, called: update.called }
  if (update.winner) next.winner = update.winner
  else delete next.winner
  if (update.note) next.note = update.note
  else delete next.note
  return next
}
