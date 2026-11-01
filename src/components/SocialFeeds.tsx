import { useEffect, useRef, useState } from 'react'
import { HASHTAGS } from '../data/feeds'
import { fetchCurated, fetchEverything, type FeedPost } from '../lib/bluesky'

const REFRESH_MS = 90_000

function ago(iso: string) {
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000)
  if (s < 60) return 'now'
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' })
}

// Polls a feed, remembering which posts were already on screen so new ones can be marked.
function useFeed(load: () => Promise<FeedPost[]>, onNewPosts?: (n: number) => void) {
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [error, setError] = useState<string | null>(null)
  const [updated, setUpdated] = useState<Date | null>(null)
  const seen = useRef<Set<string> | null>(null)
  const [fresh, setFresh] = useState<Set<string>>(new Set())

  useEffect(() => {
    let alive = true
    const run = async () => {
      try {
        const next = await load()
        if (!alive) return
        // First load marks nothing; after that, anything not seen before is new.
        const isNew = seen.current ? next.filter((p) => !seen.current!.has(p.uri)).map((p) => p.uri) : []
        setFresh(new Set(isNew))
        if (isNew.length) onNewPosts?.(isNew.length)
        seen.current = new Set([...(seen.current ?? []), ...next.map((p) => p.uri)])
        setPosts(next)
        setUpdated(new Date())
        setError(null)
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : String(err))
      }
    }
    run()
    const id = setInterval(run, REFRESH_MS)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [load, onNewPosts])

  return { posts, error, updated, fresh }
}

interface ColumnProps {
  title: string
  subtitle: string
  warning?: string
  load: () => Promise<FeedPost[]>
  onNewPosts?: (n: number) => void
}

function FeedColumn({ title, subtitle, warning, load, onNewPosts }: ColumnProps) {
  const { posts, error, updated, fresh } = useFeed(load, onNewPosts)
  return (
    <div className="feed-col">
      <header className="feed-head">
        <div>
          <h3>{title}</h3>
          <span className="muted">{subtitle}</span>
        </div>
        <span className="muted feed-updated">
          {updated ? `Updated ${updated.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'Loading…'}
        </span>
      </header>
      {warning && <p className="feed-warning">{warning}</p>}
      {error && <p className="feed-warning">{error}; retrying.</p>}
      <ol className="feed-list">
        {posts.map((p) => (
          <li key={p.uri} className={fresh.has(p.uri) ? 'fresh' : ''}>
            <a href={p.url} target="_blank" rel="noreferrer" className="feed-post">
              {p.avatar ? <img src={p.avatar} alt="" className="feed-avatar" loading="lazy" /> : <span className="feed-avatar" />}
              <div className="feed-body">
                <div className="feed-meta">
                  <b>{p.name}</b> <span className="muted">@{p.handle} · {ago(p.createdAt)}</span>
                </div>
                <p className="feed-text">{p.text}</p>
              </div>
            </a>
          </li>
        ))}
        {updated && posts.length === 0 && <li className="muted feed-empty">Nothing yet.</li>}
      </ol>
    </div>
  )
}

// Two Bluesky columns: hand-picked election accounts, and everything under the
// election hashtags. Text only, no images or embeds; click a post to open it on Bluesky.
// onNewPosts reports new Curated posts only; the hashtag column moves too fast to badge.
export function SocialFeeds({ onNewPosts }: { onNewPosts?: (n: number) => void }) {
  return (
    <section>
      <p className="muted feeds-intro">From Bluesky, refreshed every 90 seconds. New posts get a yellow edge.</p>
      <div className="feeds">
        <FeedColumn
          title="Curated"
          subtitle="Election analysts, desks and outlets · edit in src/data/feeds.ts"
          load={fetchCurated}
          onNewPosts={onNewPosts}
        />
        <FeedColumn
          title="Everything"
          subtitle={HASHTAGS.join(' ')}
          warning="Unfiltered: expect spam, partisan noise and unverified claims."
          load={fetchEverything}
        />
      </div>
    </section>
  )
}
