# 2026 Midterm Tracker

Forecast and election-night results for every 2026 Senate (35), House (435) and governor (36) race.

```bash
npm install
npm run dev   # http://localhost:5173
```

## How it works

- **Forecast** shows Cook Political Report ratings, RealClearPolling averages for key Senate and
  governor races, and the seat math against the majority line.
- **Results** shows called seats, flips, and leaders in uncalled races. The app switches to it
  automatically once any result is entered.
- **Map**: Senate and governor tabs color each state by rating (or result). The House tab shows one
  hexagon per district, grouped by state (real district outlines aren't used because several states
  redrew their maps mid-decade). Click a district to open it, or a state label to list its seats.
- **Calls are manual**: click a race and pick the winner when a network or AP calls it.

## Live results

`npm run dev` also pulls official state results every 2 minutes and writes them to
`public/results.json` (latest numbers) and `public/history.json` (a snapshot each time a race's
vote total changes, which drives the margin-over-time charts). Open tabs re-read both every 30s,
so the page updates without a refresh. Calls and notes you enter are never overwritten.

| State | Feed | Status Nov 1 |
|---|---|---|
| NC | State Board of Elections JSON | Live (zeros) |
| MN | Secretary of State text files | Live (zeros) |
| IA | Clarity ENR | Live (zeros) |
| OH | Secretary of State API | Live (zeros) |
| GA | Enhanced Voting | Picks up the Nov 3 election once posted |
| TX | Secretary of State JSON | Picks up the 2026 general once posted |
| FL | Division of Elections extract | Available after polls close |
| SC | Clarity ENR | Paste the election id into `server/feeds.ts` once posted |

Everything else is manual. MI, WI, NH and ME have no live statewide feed (counties or towns
report separately), and AK, KS, NV, NE, AZ, OR, MS, OK and VT aren't wired up.

```bash
npm run fetch                 # pull once and write results
npm run fetch -- --test-2024  # parse the 2024 general feeds and print, without writing
FETCH=0 npm run dev           # dev server without the background fetcher
```

## Data

| File | Contents | Source |
|---|---|---|
| `src/data/senate.ts` | Ratings, nominees for competitive seats | Cook (Oct 30), nominees via 270toWin |
| `src/data/governors.ts` | Ratings, nominees for competitive seats | Cook (Oct 29), nominees via 270toWin / Inside Elections |
| `src/data/house.ts` | Ratings and incumbent for all 435 seats | Cook (Oct 30) |
| `src/data/polls.ts` | Poll averages (or latest poll) for key races | RealClearPolling (Nov 1) |
| `public/results.json` | Election-night returns and calls | State feeds + you |
| `public/history.json` | Snapshots of each race over the night | State feeds |

Senate control: Democrats need 51 (VP Vance breaks ties), Republicans need 50.
