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
- **Map**: Senate and governor tabs color each state by rating (or result). The House tab shades
  states by number of competitive seats; click a state to list all its seats.
- Click any race to enter vote share, % reporting, and make a call. Saves go to
  `public/results.json` (dev server only) and every open tab re-polls that file every 30s.
  You can also edit the file by hand.

## Data

| File | Contents | Source |
|---|---|---|
| `src/data/senate.ts` | Ratings, nominees for competitive seats | Cook (Oct 30), nominees via 270toWin |
| `src/data/governors.ts` | Ratings, nominees for competitive seats | Cook (Oct 29), nominees via 270toWin / Inside Elections |
| `src/data/house.ts` | Ratings and incumbent for all 435 seats | Cook (Oct 30) |
| `src/data/polls.ts` | Poll averages (or latest poll) for key races | RealClearPolling (Nov 1) |
| `public/results.json` | Election-night returns and calls | You |

Senate control: Democrats need 51 (VP Vance breaks ties), Republicans need 50.
