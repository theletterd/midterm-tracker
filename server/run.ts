// Standalone fetcher. `npm run fetch` pulls results and race calls once and writes them.
//   --test-2024   print what the 2024 general feeds parse to, without writing
//   --test-calls  parse DDHQ's posts since Sept 1 (primaries included) and show how each
//                 would resolve against the current board, without writing
import { HOUSE } from '../src/data/house.ts'
import { checkCalls, fetchPosts, loadPrimaryWinners, parsePost, resolveCall } from './ddhq.ts'
import { FEEDS_2024, FEEDS_2026 } from './feeds.ts'
import { collect, fetchOnce, formatReports } from './fetcher.ts'
import { update, type State } from './store.ts'

if (process.argv.includes('--test-calls')) {
  const posts = await fetchPosts('2026-09-01T00:00:00Z', new Set(), 30)
  let state!: State
  await update((s) => {
    state = structuredClone(s)
    return false
  })
  let calls = 0
  for (const post of posts.reverse()) {
    const call = parsePost(post.text)
    if (!call) continue
    calls++
    const e = resolveCall(post, call, state)
    console.log(`${e.status.padEnd(8)} ${(call.raceId).padEnd(14)} ${call.primary ? 'primary' : 'general'}  ${e.winnerName} → ${e.party ?? '?'}  (${e.reason})`)
  }
  console.log(`${posts.length} posts, ${calls} Senate/governor/House calls parsed`)

  // How many House races could a general-election call be matched to a party for?
  const primaries = await loadPrimaryWinners()
  const both = HOUSE.filter((r) => primaries[r.id]?.length === 2 || (state.nominees[r.id]?.length ?? 0) >= 2).length
  const some = HOUSE.filter((r) => primaries[r.id] || state.nominees[r.id] || r.incumbent !== 'Open').length
  console.log(`House: both nominees known for ${both}/435 races; at least one name to match for ${some}/435`)
  const competitive = HOUSE.filter((r) => r.rating !== 'SD' && r.rating !== 'SR')
  const missing = competitive.filter((r) => !(primaries[r.id]?.length === 2 || (state.nominees[r.id]?.length ?? 0) >= 2))
  console.log(`Competitive House races without both nominees (${missing.length}/${competitive.length}): ${missing.map((r) => r.label).join(' ')}`)
} else if (process.argv.includes('--test-2024')) {
  const { matched, reports } = await collect(FEEDS_2024)
  console.log(formatReports(reports).split(' · ').join('\n'))
  const show = ['senate-', 'gov-', 'house-NC-01', 'house-IA-02', 'house-OH-09', 'house-TX-15', 'house-FL-13', 'house-MN-02', 'house-GA-02']
  for (const m of matched.filter((m) => show.some((s) => m.id.startsWith(s))).sort((a, b) => a.id.localeCompare(b.id))) {
    const { pct, total, reporting } = m.tally
    console.log(`${m.id.padEnd(14)} D ${pct.D ?? '-'}  R ${pct.R ?? '-'}  total ${total.toLocaleString()}  reporting ${reporting ?? '?'}%`)
  }
} else {
  console.log(formatReports(await fetchOnce(FEEDS_2026)))
  const c = await checkCalls()
  console.log(`DDHQ: ${c.newCalls} new calls, ${c.applied} applied, ${c.review} need review`)
}
