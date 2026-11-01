import { geoPath } from 'd3-geo'
import { feature, mesh } from 'topojson-client'
import type { GeometryCollection, Topology } from 'topojson-specification'
import statesTopo from 'us-atlas/states-albers-10m.json'

// FIPS code -> postal abbreviation (us-atlas ids are FIPS).
const FIPS: Record<string, string> = {
  '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA', '08': 'CO', '09': 'CT', '10': 'DE', '11': 'DC',
  '12': 'FL', '13': 'GA', '15': 'HI', '16': 'ID', '17': 'IL', '18': 'IN', '19': 'IA', '20': 'KS', '21': 'KY',
  '22': 'LA', '23': 'ME', '24': 'MD', '25': 'MA', '26': 'MI', '27': 'MN', '28': 'MS', '29': 'MO', '30': 'MT',
  '31': 'NE', '32': 'NV', '33': 'NH', '34': 'NJ', '35': 'NM', '36': 'NY', '37': 'NC', '38': 'ND', '39': 'OH',
  '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI', '45': 'SC', '46': 'SD', '47': 'TN', '48': 'TX', '49': 'UT',
  '50': 'VT', '51': 'VA', '53': 'WA', '54': 'WV', '55': 'WI', '56': 'WY',
}

// The topology is pre-projected to a 975x610 Albers USA frame, so no projection is needed.
export const MAP_W = 975
export const MAP_H = 610

const topo = statesTopo as unknown as Topology<{ states: GeometryCollection<{ name: string }> }>
const path = geoPath()

export const STATES = feature(topo, topo.objects.states).features.map((f) => ({
  abbr: FIPS[String(f.id)],
  name: f.properties.name,
  d: path(f) ?? '',
  centroid: path.centroid(f) as [number, number],
}))

export const BORDERS = path(mesh(topo, topo.objects.states, (a, b) => a !== b)) ?? ''
