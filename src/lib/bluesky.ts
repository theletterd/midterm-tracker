import { CURATED, ELECTION_TERMS, HASHTAGS } from '../data/feeds'

// Bluesky's public API needs no login. Author feeds come from the public AppView;
// search only answers browsers on api.bsky.app.
const PUBLIC = 'https://public.api.bsky.app/xrpc'
const SEARCH = 'https://api.bsky.app/xrpc'
const MAX_POSTS = 60

export interface FeedPost {
  uri: string
  url: string // bsky.app link
  handle: string
  name: string
  avatar?: string
  text: string
  createdAt: string
}

function toPost(p: any): FeedPost {
  const rkey = String(p.uri).split('/').pop()
  return {
    uri: p.uri,
    url: `https://bsky.app/profile/${p.author.handle}/post/${rkey}`,
    handle: p.author.handle,
    name: p.author.displayName || p.author.handle,
    avatar: p.author.avatar,
    text: p.record?.text ?? '',
    createdAt: p.record?.createdAt ?? p.indexedAt,
  }
}

const newestFirst = (posts: FeedPost[]) => {
  const seen = new Set<string>()
  return posts
    .filter((p) => !seen.has(p.uri) && seen.add(p.uri))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, MAX_POSTS)
}

async function get(url: string) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Bluesky ${res.status}`)
  return res.json()
}

// Latest original posts (no replies or reposts) from every curated account.
export async function fetchCurated(): Promise<FeedPost[]> {
  const batches = await Promise.allSettled(
    CURATED.map(async (acct) => {
      const qs = new URLSearchParams({ actor: acct.handle, limit: '20', filter: 'posts_no_replies' })
      const d = await get(`${PUBLIC}/app.bsky.feed.getAuthorFeed?${qs}`)
      return (d.feed as any[])
        .filter((item) => !item.reason) // reposts
        .map((item) => toPost(item.post))
        .filter((p) => !acct.electionOnly || ELECTION_TERMS.test(p.text))
    }),
  )
  const ok = batches.flatMap((b) => (b.status === 'fulfilled' ? b.value : []))
  if (ok.length === 0 && batches.some((b) => b.status === 'rejected')) throw new Error('Couldn’t reach Bluesky')
  return newestFirst(ok)
}

// Latest English posts carrying any of the hashtags. Posts Bluesky has labeled
// (spam, adult content and so on) are dropped; everything else comes through.
export async function fetchEverything(): Promise<FeedPost[]> {
  const batches = await Promise.allSettled(
    HASHTAGS.map(async (tag) => {
      const qs = new URLSearchParams({ q: tag, sort: 'latest', lang: 'en', limit: '30' })
      const d = await get(`${SEARCH}/app.bsky.feed.searchPosts?${qs}`)
      return (d.posts as any[]).filter((p) => !p.labels?.length && !p.author?.labels?.length).map(toPost)
    }),
  )
  const ok = batches.flatMap((b) => (b.status === 'fulfilled' ? b.value : []))
  if (ok.length === 0 && batches.some((b) => b.status === 'rejected')) throw new Error('Couldn’t reach Bluesky')
  return newestFirst(ok)
}
