import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { FEEDS_2026 } from './server/feeds.ts'
import { fetchOnce, formatReports } from './server/fetcher.ts'
import { update } from './server/store.ts'

const FETCH_EVERY_MS = 2 * 60_000

// Dev-server backend:
// - POST /api/results {id, result} saves one race's manual edits (null clears it).
// - Every 2 minutes, pulls official state results into public/results.json and
//   public/history.json. Set FETCH=0 to turn that off.
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
            const { id, result } = JSON.parse(body)
            if (typeof id !== 'string') throw new Error('missing id')
            await update((results) => {
              if (result) results.races[id] = { ...results.races[id], ...result }
              else delete results.races[id]
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
      tick()
      const timer = setInterval(tick, FETCH_EVERY_MS)
      server.httpServer?.on('close', () => clearInterval(timer))
    },
  }
}

export default defineConfig({
  plugins: [react(), resultsBackend()],
  server: {
    // Results are rewritten at runtime; don't trigger a full reload when they change.
    watch: { ignored: ['**/public/results.json', '**/public/history.json', '**/public/*.tmp'] },
  },
})
