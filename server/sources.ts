import { getJson, getText } from './http.ts'
import { parseCsv } from './turnout.ts'
import type { Contest, Source } from './types.ts'

// One adapter per feed format. Each returns every contest in the state's feed;
// matching contests to our races happens in match.ts.

/** North Carolina State Board of Elections: one JSON array of candidate rows. */
export function ncsbe(date: string): Source {
  return {
    state: 'NC',
    label: 'NC State Board of Elections',
    async fetchContests() {
      const rows = await getJson<any[]>(`https://er.ncsbe.gov/enr/${date}/data/results_0.txt`)
      const byName = new Map<string, Contest>()
      for (const r of rows) {
        let c = byName.get(r.cnm)
        if (!c) {
          c = { name: r.cnm, candidates: [], reported: Number(r.prt), total: Number(r.ptl) }
          byName.set(r.cnm, c)
        }
        c.candidates.push({ name: r.bnm, party: r.pty, votes: Number(r.vct) })
      }
      return [...byName.values()]
    },
  }
}

/** Minnesota Secretary of State: semicolon-delimited text files per office group. */
export function mnsos(date: string): Source {
  const files = ['ussenate.txt', 'ushouse.txt']
  return {
    state: 'MN',
    label: 'MN Secretary of State',
    async fetchContests() {
      const byName = new Map<string, Contest>()
      for (const file of files) {
        const text = await getText(`https://electionresultsfiles.sos.mn.gov/${date}/${file}`)
        for (const line of text.split('\n')) {
          const f = line.split(';')
          if (f.length < 16) continue
          const name = f[4]
          let c = byName.get(name)
          if (!c) {
            c = { name, candidates: [], reported: Number(f[11]), total: Number(f[12]) }
            byName.set(name, c)
          }
          c.candidates.push({ name: f[7], party: f[10], votes: Number(f[13]) })
        }
      }
      return [...byName.values()]
    },
  }
}

/**
 * Clarity / SOE Software election night reporting (Iowa, South Carolina, ...).
 * `electionId` is the number in the results URL; null means "not published yet".
 */
export function clarity(state: string, label: string, base: string, electionId: string | null): Source {
  return {
    state,
    label,
    async fetchContests() {
      if (!electionId) throw new Error('election id not set (see server/feeds.ts)')
      const ver = (await getText(`${base}/${electionId}/current_ver.txt`)).trim()
      const summary = await getJson<any[]>(`${base}/${electionId}/${ver}/json/en/summary.json`)
      return summary.map((c) => ({
        name: c.C,
        reported: c.PR,
        total: c.TP,
        candidates: (c.CH as string[]).map((name, i) => ({ name, party: c.P[i] ?? '', votes: Number(c.V[i] ?? 0) })),
      }))
    },
  }
}

/** Nebraska Secretary of State: media CSV exports, one candidate per row. */
export function nebraska(): Source {
  const NAMES: [RegExp, (district: string) => string][] = [
    [/^For United States Senator/i, () => 'U.S. Senator'],
    [/^For Governor/i, () => 'Governor'],
    [/^For Representative in Congress/i, (d) => `U.S. Representative ${d}`],
  ]
  return {
    state: 'NE',
    label: 'Nebraska Secretary of State',
    async fetchContests() {
      const files = await Promise.all(
        [['SW', 'CTY'], ['CG', 'CTY']].map(([type, map]) =>
          getText(`https://electionresults.nebraska.gov/resultsCSV.aspx?text=All&type=${type}&map=${map}`),
        ),
      )
      const contests = new Map<string, Contest>()
      for (const row of files.flatMap(parseCsv)) {
        const nameFor = NAMES.find(([re]) => re.test(row.RaceName))?.[1]
        if (!nameFor) continue
        const name = nameFor(row.AreaNum.trim())
        let c = contests.get(name)
        if (!c) {
          // Reporting comes through as ="12/1322".
          const [, reported, total] = row.PrecinctsReporting.match(/(\d+)\/(\d+)/) ?? []
          c = { name, candidates: [], reported: Number(reported), total: Number(total) }
          contests.set(name, c)
        }
        c.candidates.push({
          name: row.CandidateName.replace(/\s+/g, ' ').trim(),
          party: row.PartyCode === 'PET' ? 'IND' : row.PartyCode, // petition candidates, e.g. Osborn
          votes: Number(row.CandidateVotes.replace(/,/g, '')),
        })
      }
      return [...contests.values()]
    },
  }
}

/** Enhanced Voting results sites (Georgia). Finds the election by date. */
export function enhancedVoting(state: string, label: string, base: string, jurisdiction: string, date: string): Source {
  const en = (texts: { languageId: string; text: string }[] | undefined) =>
    texts?.find((t) => t.languageId === 'en')?.text ?? texts?.[0]?.text ?? ''
  return {
    state,
    label,
    async fetchContests() {
      const j = await getJson<any>(`${base}/api/jurisdictions/${jurisdiction}`)
      const election = (j.elections as any[]).find((e) => e.electionDate === date)
      if (!election) throw new Error(`no election on ${date} published yet`)
      const data = await getJson<any>(`${base}/api/elections/${jurisdiction}/${election.publicElectionId}/data`)
      return (data.ballotItems as any[]).map((b) => ({
        name: en(b.name),
        reported: b.reportingStatus?.reportingUnits,
        total: b.reportingStatus?.totalUnits,
        candidates: (b.summaryResults?.ballotOptions ?? []).map((o: any) => ({
          name: en(o.name),
          party: o.party?.abbreviation ?? '',
          votes: Number(o.voteCount ?? 0),
        })),
      }))
    },
  }
}

/** Ohio Secretary of State live results API. Always serves the current election. */
export function ohio(): Source {
  const contests = ['U.S. Senator', 'Governor and Lieutenant Governor', 'Representative to Congress']
  const api = 'https://liveresults.ohiosos.gov/Api/v1/Contest/GetContestDetailsObject'
  return {
    state: 'OH',
    label: 'Ohio Secretary of State',
    async fetchContests() {
      const out: Contest[] = []
      for (const contestName of contests) {
        const qs = new URLSearchParams({ contestName, resultsLevel: 'Statewide' })
        const d = await getJson<any>(`${api}?${qs}`)
        for (const c of d.contestList ?? []) {
          out.push({
            name: c.name,
            reported: c.reportedPrecincts,
            total: c.totalPrecincts,
            candidates: (c.candidatesRunning ?? []).map((r: any) => ({
              name: r.primaryCandidate,
              party: r.candidateParty ?? '',
              votes: Number(r.vCount ?? 0),
            })),
          })
        }
      }
      return out
    },
  }
}

/**
 * Texas Secretary of State. Looks the election up by name in the site's election list,
 * then reads the per-office summary. Precincts reporting is only published statewide.
 */
export function texas(year: string, namePattern: RegExp): Source {
  const base = 'https://results.texas-election.com/static/data'
  return {
    state: 'TX',
    label: 'Texas Secretary of State',
    async fetchContests() {
      const { ___versionNo: cv } = await getJson<any>(`${base}/Version.json`)
      const constants = await getJson<any>(`${base}/ElectionConstants_${cv}.json`)
      const general = constants.electionInfo?.[year]?.G ?? {}
      const id = Object.keys(general).find((k) => namePattern.test(general[k].N))
      if (!id) throw new Error(`no ${year} general election published yet`)
      const { ___versionNo: v } = await getJson<any>(`${base}/election/${id}/Version.json`)
      // Federal.json and StateWide.json list every candidate (OfficeSummary.json only has the top two).
      const [federal, statewide, home] = await Promise.all([
        getJson<any>(`${base}/election/${id}/${v}/Federal.json`),
        getJson<any>(`${base}/election/${id}/${v}/StateWide.json`),
        getJson<any>(`${base}/election/${id}/${v}/Home.json`),
      ])
      const pr = home.PrecinctsReporting ?? {}
      return [...(federal.Races ?? []), ...(statewide.Races ?? [])].map((r: any) => ({
        name: r.N.trim(),
        reported: pr.PR,
        total: pr.PT,
        candidates: (r.Candidates as any[]).map((c) => ({ name: c.N, party: c.P, votes: Number(c.V ?? 0) })),
      }))
    },
  }
}

/** Florida Division of Elections data extract: tab-delimited, one row per county per candidate. */
export function florida(date: string): Source {
  const NAMES: Record<string, (district: string) => string> = {
    USS: () => 'U.S. Senator',
    GOV: () => 'Governor',
    USR: (d) => `U.S. Representative District ${d}`,
  }
  return {
    state: 'FL',
    label: 'Florida Division of Elections',
    async fetchContests() {
      const body = new URLSearchParams({ ElectionDate: date, OfficialResults: 'N', PartyRaces: 'N', DataMode: '', FormsButton2: 'Download' })
      const text = await getText('https://results.elections.myflorida.com/ResultsExtract.Asp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      })
      const lines = text.split(/\r?\n/)
      const header = lines[0].split('\t')
      if (!header.includes('CanVotes')) throw new Error('results extract not available yet')
      const col = (n: string) => header.indexOf(n)
      const [iParty, iRace, iCounty, iDist, iPrec, iRep, iLast, iFirst, iVotes] = [
        'PartyCode', 'RaceCode', 'CountyCode', 'Juris1num', 'Precincts', 'PrecinctsReporting', 'CanNameLast', 'CanNameFirst', 'CanVotes',
      ].map(col)

      const contests = new Map<string, Contest & { counties: Set<string>; cands: Map<string, { name: string; party: string; votes: number }> }>()
      for (const line of lines.slice(1)) {
        const f = line.split('\t')
        const nameFor = NAMES[f[iRace]]
        if (!nameFor) continue
        const name = nameFor(f[iDist]?.trim())
        let c = contests.get(name)
        if (!c) {
          c = { name, candidates: [], reported: 0, total: 0, counties: new Set(), cands: new Map() }
          contests.set(name, c)
        }
        // Precinct counts repeat on every candidate row; count each county once.
        if (!c.counties.has(f[iCounty])) {
          c.counties.add(f[iCounty])
          c.reported! += Number(f[iRep] || 0)
          c.total! += Number(f[iPrec] || 0)
        }
        const candName = `${f[iFirst]} ${f[iLast]}`.trim()
        const cand = c.cands.get(candName) ?? { name: candName, party: f[iParty], votes: 0 }
        cand.votes += Number(f[iVotes] || 0)
        c.cands.set(candName, cand)
      }
      return [...contests.values()].map(({ name, reported, total, cands }) => ({ name, reported, total, candidates: [...cands.values()] }))
    },
  }
}
