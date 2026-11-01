import type { Candidate, Party, Race, Rating } from './types'

// Source: Cook Political Report governor ratings, Oct 29, 2026
// https://www.cookpolitical.com/ratings/governor-race-ratings
// Nominees via 270toWin and Roll Call/Inside Elections (Oct 31, 2026); verify before relying on them.
export const GOV_AS_OF = '2026-10-29'

// Governorships not on the ballot this year.
// D: VA, NJ, KY, NC, WA, DE. R: IN, MO, ND, UT, WV, MT, LA, MS.
export const GOV_NOT_UP = { D: 6, R: 8 }

const d = (name: string, incumbent = false): Candidate => ({ name, party: 'D', incumbent })
const r = (name: string, incumbent = false): Candidate => ({ name, party: 'R', incumbent })

const gov = (
  label: string,
  rating: Rating,
  held: Party,
  incumbent: string,
  candidates?: Candidate[],
  note?: string,
): Race => ({ id: `gov-${label}`, chamber: 'gov', label, rating, held, incumbent, candidates, note })

export const GOVERNORS: Race[] = [
  // Solid D
  gov('CA', 'SD', 'D', 'Open'),
  gov('CO', 'SD', 'D', 'Open'),
  gov('CT', 'SD', 'D', 'Lamont'),
  gov('HI', 'SD', 'D', 'Green'),
  gov('IL', 'SD', 'D', 'Pritzker'),
  gov('MA', 'SD', 'D', 'Healey'),
  gov('MD', 'SD', 'D', 'Moore'),
  gov('ME', 'SD', 'D', 'Open'),
  gov('MN', 'SD', 'D', 'Open'),
  gov('NM', 'SD', 'D', 'Open'),
  gov('NY', 'SD', 'D', 'Hochul'),
  gov('PA', 'SD', 'D', 'Shapiro'),
  gov('RI', 'SD', 'D', 'Open'),
  // Likely D
  gov('AZ', 'LD', 'D', 'Hobbs', [d('Katie Hobbs', true), r('Andy Biggs')]),
  // Lean D
  gov('AK', 'TD', 'R', 'Open', [d('Jonathan Kreiss-Tomkins'), r('Wilson')]),
  gov('IA', 'TD', 'R', 'Open', [d('Rob Sand'), r('Zach Lahn')]),
  gov('MI', 'TD', 'D', 'Open', [d('Jocelyn Benson'), r('John James')]),
  gov('OH', 'TD', 'R', 'Open', [d('Amy Acton'), r('Vivek Ramaswamy')]),
  gov('OR', 'TD', 'D', 'Kotek', [d('Tina Kotek', true), r('Christine Drazan')]),
  gov('WI', 'TD', 'D', 'Open', [d('David Crowley'), r('Tom Tiffany')]),
  // Toss Up
  gov('GA', 'TU', 'R', 'Open', [d('Keisha Lance Bottoms'), r('Rick Jackson')]),
  gov('KS', 'TU', 'D', 'Open', [d('Cindy Holscher'), r('Ty Masterson')]),
  gov('NV', 'TU', 'R', 'Lombardo', [d('Aaron Ford'), r('Joe Lombardo', true)]),
  // Lean R
  gov('FL', 'TR', 'R', 'Open', [d('David Jolly'), r('Byron Donalds')]),
  gov('NE', 'TR', 'R', 'Pillen', [d('Lynne Walz'), r('Jim Pillen', true)]),
  gov('TX', 'TR', 'R', 'Abbott', [d('Gina Hinojosa'), r('Greg Abbott', true)]),
  // Likely R
  gov('NH', 'LR', 'R', 'Ayotte', [d('Cinde Warmington'), r('Kelly Ayotte', true)]),
  gov('OK', 'LR', 'R', 'Open', [d('Cyndi Munson'), r('Mike Mazzei')]),
  gov('VT', 'LR', 'R', 'Scott', [d('Amanda Janoo'), r('Phil Scott', true)]),
  // Solid R
  gov('AL', 'SR', 'R', 'Open'),
  gov('AR', 'SR', 'R', 'Sanders'),
  gov('ID', 'SR', 'R', 'Little'),
  gov('SC', 'SR', 'R', 'Open'),
  gov('SD', 'SR', 'R', 'Rhoden'),
  gov('TN', 'SR', 'R', 'Open'),
  gov('WY', 'SR', 'R', 'Open'),
]
