// Standalone fetcher. `npm run fetch` pulls once and writes results;
// `npm run fetch -- --test-2024` prints what the 2024 feeds parse to, without writing.
import { FEEDS_2024, FEEDS_2026 } from './feeds.ts'
import { collect, fetchOnce, formatReports } from './fetcher.ts'

const test = process.argv.includes('--test-2024')

if (test) {
  const { matched, reports } = await collect(FEEDS_2024)
  console.log(formatReports(reports).split(' · ').join('\n'))
  const show = ['senate-', 'gov-', 'house-NC-01', 'house-IA-02', 'house-OH-09', 'house-TX-15', 'house-FL-13', 'house-MN-02', 'house-GA-02']
  for (const m of matched.filter((m) => show.some((s) => m.id.startsWith(s))).sort((a, b) => a.id.localeCompare(b.id))) {
    const { pct, total, reporting } = m.tally
    console.log(`${m.id.padEnd(14)} D ${pct.D ?? '-'}  R ${pct.R ?? '-'}  total ${total.toLocaleString()}  reporting ${reporting ?? '?'}%`)
  }
} else {
  console.log(formatReports(await fetchOnce(FEEDS_2026)))
}
