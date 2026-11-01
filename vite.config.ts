import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

// Dev-only endpoint: POST /api/results writes the body to public/results.json,
// so race calls entered in the UI persist and every open tab picks them up.
function resultsWriter(): Plugin {
  const file = resolve(__dirname, 'public/results.json')
  return {
    name: 'results-writer',
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
            const parsed = JSON.parse(body)
            if (typeof parsed !== 'object' || !parsed.races) throw new Error('missing races')
            await writeFile(file, JSON.stringify(parsed, null, 2) + '\n')
            res.statusCode = 204
            res.end()
          } catch (err) {
            res.statusCode = 400
            res.end(String(err))
          }
        })
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), resultsWriter()],
  server: {
    // Results are edited at runtime; don't trigger a full reload when they change.
    watch: { ignored: ['**/public/results.json'] },
  },
})
