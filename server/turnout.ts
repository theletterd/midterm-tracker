// Early and mail ballots already cast, by registered party, from states that publish daily
// files. These are ballots cast, not votes counted: no state releases how anyone voted
// before polls close. NC and FL come straight from the states, with 2022 comparisons;
// every other state comes from the UF Election Lab's national file.
import type { PartySplit, TurnoutFile, TurnoutRow, TurnoutState } from '../src/data/types.ts'
import { request } from './http.ts'
import { readJson, TURNOUT_FILE, writeJson } from './store.ts'

type Current = Omit<TurnoutState, 'history'>

const sum = (p: PartySplit) => p.D + p.R + p.unaffiliated + p.other
const num = (s: string) => Number(s.replace(/,/g, ''))

// 2022 general, final. NC: absentee_counts_state_20221108.csv summed by party.
// FL: the Division of Elections' 2022 general archive (voted early + voted by mail).
// Total ballots cast in 2022 come from each state's certified turnout.
const NC_2022: PartySplit = { D: 840_205, R: 682_377, unaffiliated: 669_831, other: 6_137 }
const FL_2022: PartySplit = { D: 1_870_486, R: 2_168_758, unaffiliated: 947_728, other: 72_441 }

const NC_URL = 'https://s3.amazonaws.com/dl.ncsbe.gov/ENRS/2026_11_03/absentee_counts_state_20261103.csv'

// One row per request type × party × demographic, count in the last column. Rows cover
// accepted ballots: in-person early votes ("EARLY VOTING") and returned mail ballots.
async function northCarolina(): Promise<Current> {
  const res = await request(NC_URL)
  const csv = await res.text()
  const parties: PartySplit = { D: 0, R: 0, unaffiliated: 0, other: 0 }
  let early = 0
  let mail = 0
  for (const line of csv.trim().split('\n').slice(1)) {
    const cols = line.split(',')
    const n = Number(cols[cols.length - 1])
    if (!n) continue
    const party = cols[1]
    if (party === 'DEM') parties.D += n
    else if (party === 'REP') parties.R += n
    else if (party === 'UNA') parties.unaffiliated += n
    else parties.other += n
    if (cols[0] === 'EARLY VOTING') early += n
    else mail += n
  }
  const modified = res.headers.get('last-modified')
  return {
    state: 'NC',
    name: 'North Carolina',
    asOf: modified ? new Date(modified).toISOString() : new Date().toISOString(),
    source: 'NC State Board of Elections',
    url: 'https://www.ncsbe.gov/results-data/absentee-data',
    total: sum(parties),
    parties,
    methods: [
      { label: 'Early in person', total: early },
      { label: 'Mail', total: mail },
    ],
    baseline: { label: '2022', total: sum(NC_2022), parties: NC_2022, turnout: 3_790_202 },
  }
}

const FL_URL = 'https://countyfilesvbm-ev.floridados.gov/VoteByMailEarlyVotingReports/PublicStats'

// Compile times are Eastern; daylight time ends Nov 1, 2026.
function easternIso(date: string, time: string) {
  const [m, d, y] = date.split('/').map(Number)
  const [, hh, min, ap] = time.match(/(\d+):(\d\d)\s*([AP]M)/)!
  const h = (Number(hh) % 12) + (ap === 'PM' ? 12 : 0)
  const offset = m === 11 || m === 12 ? '-05:00' : '-04:00'
  const pad = (n: number) => String(n).padStart(2, '0')
  return new Date(`${y}-${pad(m)}-${pad(d)}T${pad(h)}:${min}:00${offset}`).toISOString()
}

// The statistics page's statewide table: rows of Rep, Dem, Other, NPA, Total and compile
// time. The linked .txt downloads lag the page by a day, so read the page.
async function florida(): Promise<Current> {
  const html = await (await request(FL_URL)).text()
  const start = html.indexOf('id="statewideTotal"')
  const end = html.indexOf('County Totals', start)
  if (start < 0 || end < 0) throw new Error('Florida statewide table not found')
  const text = html.slice(start, end).replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ')
  const row = (label: string) => {
    const m = text.match(new RegExp(`${label} ([\\d,]+) ([\\d,]+) ([\\d,]+) ([\\d,]+) ([\\d,]+) (\\d\\d/\\d\\d/\\d{4}) (\\d+:\\d\\d ?[AP]M)`))
    if (!m) throw new Error(`Florida row "${label}" not found`)
    return { R: num(m[1]), D: num(m[2]), other: num(m[3]), unaffiliated: num(m[4]), total: num(m[5]), asOf: easternIso(m[6], m[7]) }
  }
  const early = row('Voted Early')
  const mail = row('Voted Vote-by-Mail')
  const parties: PartySplit = {
    D: early.D + mail.D,
    R: early.R + mail.R,
    unaffiliated: early.unaffiliated + mail.unaffiliated,
    other: early.other + mail.other,
  }
  return {
    state: 'FL',
    name: 'Florida',
    asOf: early.asOf > mail.asOf ? early.asOf : mail.asOf,
    source: 'Florida Division of Elections',
    url: FL_URL,
    total: early.total + mail.total,
    parties,
    methods: [
      { label: 'Early in person', total: early.total },
      { label: 'Mail', total: mail.total },
    ],
    baseline: { label: '2022', total: sum(FL_2022), parties: FL_2022, turnout: 7_796_916 },
  }
}

const SOURCES = { NC: northCarolina, FL: florida }

const UF_URL = 'https://election.lab.ufl.edu/data-downloads/earlyvote/2026/US.csv'
export const UF_PAGE = 'https://election.lab.ufl.edu/early-vote/2026-early-voting/'

// Minimal CSV parsing: quoted fields may hold commas and doubled quotes.
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') field += text[++i]
      else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') row.push(field), (field = '')
    else if (c === '\n') row.push(field), rows.push(row), (row = []), (field = '')
    else if (c !== '\r') field += c
  }
  if (field || row.length) row.push(field), rows.push(row)
  const [head, ...body] = rows
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])))
}

// One row per state, ballots cast so far split by method and (where states register
// voters by party) by party. Columns are zero where a state doesn't report them.
async function national(): Promise<NonNullable<TurnoutFile['national']>> {
  const res = await request(UF_URL)
  const n = (v: string) => Math.round(Number(v) || 0)
  const rows = parseCsv(await res.text()).map((r): TurnoutRow => {
    const [m, d, y] = r.last_update.split('/')
    const hasParty = n(r.voted_dem) + n(r.voted_rep) > 0
    return {
      state: r.state_abbv,
      name: r.state,
      updated: `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`,
      source: r.data_source,
      notes: r.notes && r.notes !== 'NA' ? r.notes : undefined,
      voted: n(r.voted_all),
      inPerson: n(r.inperson_all),
      mail: n(r.accept_all),
      turnout2022: n(r.turn_2022),
      parties: hasParty ? { D: n(r.voted_dem), R: n(r.voted_rep), none: n(r.voted_none) } : null,
    }
  })
  if (rows.length < 40) throw new Error(`UF file has only ${rows.length} states`)
  const modified = res.headers.get('last-modified')
  return { asOf: modified ? new Date(modified).toISOString() : new Date().toISOString(), source: UF_PAGE, rows }
}

// Fetches every state and writes public/turnout.json, adding a history point whenever a
// state posts a new update. A state that fails keeps its last good numbers.
export async function fetchTurnout(): Promise<string> {
  const file = await readJson<TurnoutFile>(TURNOUT_FILE, { checkedAt: null, states: [], national: null })
  const codes = Object.keys(SOURCES) as (keyof typeof SOURCES)[]
  const [results, [nat]] = await Promise.all([Promise.allSettled(codes.map((c) => SOURCES[c]())), Promise.allSettled([national()])])
  const notes: string[] = []
  file.states = codes.flatMap((code, i): TurnoutState[] => {
    const r = results[i]
    const prev = file.states.find((s) => s.state === code)
    if (r.status === 'rejected') {
      notes.push(`${code} failed: ${r.reason}`)
      return prev ? [prev] : []
    }
    const cur = r.value
    const history = prev?.history ?? []
    if (history.at(-1)?.asOf !== cur.asOf) history.push({ asOf: cur.asOf, total: cur.total, D: cur.parties.D, R: cur.parties.R })
    notes.push(`${code} ${cur.total.toLocaleString()}`)
    return [{ ...cur, history }]
  })
  if (nat.status === 'rejected') notes.push(`UF failed: ${nat.reason}`)
  else {
    file.national = nat.value
    notes.push(`${nat.value.rows.length} states from UF`)
  }
  file.checkedAt = new Date().toISOString()
  await writeJson(TURNOUT_FILE, file)
  return notes.join(' · ')
}
