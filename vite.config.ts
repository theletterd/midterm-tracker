import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { checkCalls } from './server/ddhq.ts'
import { FEEDS_2026 } from './server/feeds.ts'
import { fetchOnce, formatReports } from './server/fetcher.ts'
import { update } from './server/store.ts'
import { fetchTurnout } from './server/turnout.ts'
import { applyCall } from './src/lib/calls.ts'

const FETCH_EVERY_MS = 2 * 60_000
const CALLS_EVERY_MS = 60_000
const TURNOUT_EVERY_MS = 30 * 60_000

// Dev-server backend:
// - POST /api/results {id, update} saves one race's call and note.
// - POST /api/calls {uri, action, party?} resolves a DDHQ call waiting for review.
// - Every 2 minutes, pulls official state results into public/results.json and
//   public/history.json; every minute, checks DDHQ's Bluesky for race calls; every
//   30 minutes, pulls early-vote turnout into public/turnout.json. Set FETCH=0 to turn
//   all of them off.
function resultsBackend(): Plugin {
  return {
    name: 'results-backend',
    configureServer(server) {
      server.middlewares.use('/api/results', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end()
          return
        }
        let body = ''
        req.on('data', (chunk) => (body += chunk))
        req.on('end', async () => {
          try {
            const { id, update: call } = JSON.parse(body)
            if (typeof id !== 'string' || typeof call?.called !== 'boolean') throw new Error('expected {id, update}')
            await update(({ results }) => {
              results.races[id] = applyCall(results.races[id], call)
            })
            res.statusCode = 204
            res.end()
          } catch (err) {
            res.statusCode = 400
            res.end(String(err))
          }
        })
      })

      server.middlewares.use('/api/calls', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end()
          return
        }
        let body = ''
        req.on('data', (chunk) => (body += chunk))
        req.on('end', async () => {
          try {
            const { uri, action, party } = JSON.parse(body)
            await update(({ calls, results }) => {
              const entry = calls.entries.find((e) => e.uri === uri)
              if (!entry) throw new Error('unknown call')
              if (action === 'dismiss') {
                entry.status = 'dismissed'
              } else if (action === 'apply' && entry.raceId && ['D', 'R', 'I'].includes(party)) {
                results.races[entry.raceId] = applyCall(results.races[entry.raceId], {
                  winner: party,
                  called: true,
                  note: `DDHQ${entry.calledAt ? `, ${entry.calledAt}` : ''}`,
                })
                entry.party = party
                entry.status = 'resolved'
              } else {
                throw new Error('bad action')
              }
            })
            res.statusCode = 204
            res.end()
          } catch (err) {
            res.statusCode = 400
            res.end(String(err))
          }
        })
      })

      if (process.env.FETCH === '0') return
      const log = server.config.logger
      const tick = async () => {
        try {
          log.info(`[results] ${formatReports(await fetchOnce(FEEDS_2026))}`, { timestamp: true })
        } catch (err) {
          log.error(`[results] fetch failed: ${err}`, { timestamp: true })
        }
      }
      const callTick = async () => {
        try {
          const c = await checkCalls()
          if (c.newCalls) log.info(`[calls] DDHQ: ${c.newCalls} new, ${c.applied} applied, ${c.review} need review`, { timestamp: true })
        } catch (err) {
          log.error(`[calls] check failed: ${err}`, { timestamp: true })
        }
      }
      const turnoutTick = async () => {
        try {
          log.info(`[turnout] ${await fetchTurnout()}`, { timestamp: true })
        } catch (err) {
          log.error(`[turnout] fetch failed: ${err}`, { timestamp: true })
        }
      }
      tick()
      callTick()
      turnoutTick()
      const timers = [setInterval(tick, FETCH_EVERY_MS), setInterval(callTick, CALLS_EVERY_MS), setInterval(turnoutTick, TURNOUT_EVERY_MS)]
      server.httpServer?.on('close', () => timers.forEach(clearInterval))
    },
  }
}

export default defineConfig({
  plugins: [react(), resultsBackend()],
  server: {
    // Results are rewritten at runtime; don't trigger a full reload when they change.
    watch: { ignored: ['**/public/*.json', '**/public/*.tmp'] },
  },
})
