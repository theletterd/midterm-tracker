import type { Candidate, Party, Race, Rating } from './types.ts'

// Source: Cook Political Report Senate ratings, Oct 30, 2026
// https://www.cookpolitical.com/ratings/senate-race-ratings
// Nominees for competitive races via 270toWin (Oct 20, 2026) and RealClearPolling; verify before relying on them.
export const SENATE_AS_OF = '2026-10-30'

// Seats not on the ballot this year (Cook). Sanders and King are counted with Democrats.
export const SENATE_NOT_UP = { D: 34, R: 31 }

const d = (name: string, incumbent = false): Candidate => ({ name, party: 'D', incumbent })
const r = (name: string, incumbent = false): Candidate => ({ name, party: 'R', incumbent })
const i = (name: string): Candidate => ({ name, party: 'I' })

const seat = (
  label: string,
  rating: Rating,
  held: Party,
  incumbent: string,
  candidates?: Candidate[],
  note?: string,
): Race => ({ id: `senate-${label}`, chamber: 'senate', label, rating, held, incumbent, candidates, note })

export const SENATE: Race[] = [
  // Solid D
  seat('CO', 'SD', 'D', 'Hickenlooper'),
  seat('DE', 'SD', 'D', 'Coons'),
  seat('IL', 'SD', 'D', 'Open', [d('Juliana Stratton'), r('Don Tracy')], 'Durbin retiring'),
  seat('MA', 'SD', 'D', 'Markey'),
  seat('NJ', 'SD', 'D', 'Booker'),
  seat('NM', 'SD', 'D', 'Luján'),
  seat('OR', 'SD', 'D', 'Merkley'),
  seat('RI', 'SD', 'D', 'Reed'),
  seat('VA', 'SD', 'D', 'Warner', [d('Mark Warner', true), r('Bert Mizusawa')]),
  // Likely D
  seat('GA', 'LD', 'D', 'Ossoff', [d('Jon Ossoff', true), r('Mike Collins')]),
  seat('NC', 'LD', 'R', 'Open', [d('Roy Cooper'), r('Michael Whatley')], 'Tillis retiring'),
  // Lean D
  seat('MN', 'TD', 'D', 'Open', [d('Peggy Flanagan'), r('Michele Tafoya')], 'Smith retiring'),
  seat('NH', 'TD', 'D', 'Open', [d('Chris Pappas'), r('John Sununu')], 'Shaheen retiring'),
  // Toss Up
  seat('AK', 'TU', 'R', 'Sullivan', [d('Mary Peltola'), r('Dan Sullivan', true)]),
  seat('IA', 'TU', 'R', 'Open', [d('Josh Turek'), r('Ashley Hinson')], 'Ernst retiring'),
  seat('KS', 'TU', 'R', 'Marshall', [d('Adam Hamilton'), r('Roger Marshall', true)]),
  seat('ME', 'TU', 'R', 'Collins', [d('Troy Jackson'), r('Susan Collins', true)]),
  seat('MI', 'TU', 'D', 'Open', [d('Abdul El-Sayed'), r('Mike Rogers')], 'Peters retiring'),
  seat('OH', 'TU', 'R', 'Husted', [d('Sherrod Brown'), r('Jon Husted', true)], 'Special election (Vance seat)'),
  seat('TX', 'TU', 'R', 'Open', [d('James Talarico'), r('Ken Paxton')], 'Cornyn lost primary'),
  // Lean R
  seat('NE', 'TR', 'R', 'Ricketts', [i('Dan Osborn'), r('Pete Ricketts', true)], 'No Democratic nominee; Osborn is independent'),
  seat('SC', 'TR', 'R', 'Graham', [d('Annie Andrews'), r('Darline Graham Nordone')], 'RCP and 270toWin list Graham Nordone as GOP nominee; verify'),
  // Likely R
  seat('FL', 'LR', 'R', 'Moody', [d('Angie Nixon'), r('Ashley Moody', true)], 'Special election (Rubio seat)'),
  seat('MS', 'LR', 'R', 'Hyde-Smith', [d('Scott Colom'), r('Cindy Hyde-Smith', true)]),
  // Solid R
  seat('AL', 'SR', 'R', 'Open', undefined, 'Tuberville running for governor'),
  seat('AR', 'SR', 'R', 'Cotton'),
  seat('ID', 'SR', 'R', 'Risch'),
  seat('KY', 'SR', 'R', 'Open', [d('Charles Booker'), r('Andy Barr')], 'McConnell retiring'),
  seat('LA', 'SR', 'R', 'Open', [d('Jamie Davis'), r('Julia Letlow')], 'Cassidy lost primary'),
  seat('MT', 'SR', 'R', 'Open', undefined, 'Daines retiring'),
  seat('OK', 'SR', 'R', 'Open', undefined, 'Mullin seat; appointee not running'),
  seat('SD', 'SR', 'R', 'Rounds'),
  seat('TN', 'SR', 'R', 'Hagerty'),
  seat('WV', 'SR', 'R', 'Capito'),
  seat('WY', 'SR', 'R', 'Open', [d('James Byrd'), r('Harriet Hageman')], 'Lummis retiring'),
]
