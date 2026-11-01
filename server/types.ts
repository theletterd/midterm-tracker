// A contest as reported by a state feed, before matching to our race ids.
export interface Contest {
  name: string
  candidates: { name: string; party: string; votes: number }[]
  reported?: number // precincts (or counting units) reporting
  total?: number
}

export interface Source {
  state: string // postal code, used to build race ids
  label: string // shown in the UI, e.g. "NC State Board of Elections"
  fetchContests(): Promise<Contest[]>
}
