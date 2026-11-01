// Several state sites sit behind bot protection that rejects non-browser user agents.
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'

export async function getText(url: string, init: RequestInit = {}): Promise<string> {
  const res = await fetch(url, {
    ...init,
    headers: { 'User-Agent': UA, ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`)
  return res.text()
}

export async function getJson<T = any>(url: string, init?: RequestInit): Promise<T> {
  const text = await getText(url, init)
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error(`Non-JSON response from ${url}: ${text.slice(0, 80)}`)
  }
}
