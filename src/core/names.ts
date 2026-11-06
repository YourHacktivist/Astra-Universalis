import { romanNumeral } from '@/lib/format'
import type { Rng } from '@/lib/random'

const SYL_START = [
  'Ae', 'Al', 'Ar', 'As', 'Bel', 'Cael', 'Cor', 'Cy', 'Da', 'Del', 'Dra', 'El', 'Er', 'Eu', 'Fa', 'Gal',
  'Hal', 'Hy', 'Ia', 'Is', 'Ka', 'Kar', 'Kes', 'Kor', 'La', 'Ly', 'Mar', 'Mor', 'Ne', 'Nyx', 'Or', 'Os',
  'Pel', 'Ph', 'Qua', 'Ra', 'Rho', 'Sa', 'Sel', 'Sy', 'Tal', 'Tha', 'Ty', 'Ul', 'Va', 'Ves', 'Xan', 'Ys', 'Za', 'Zeph',
]
const SYL_MID = ['ra', 'ri', 'no', 'the', 'va', 'li', 'do', 'ca', 'me', 'ro', 'ta', 'sy', 'ne', 'lo', 'ga', 'ze', 'phi', 'ki']
const SYL_END = [
  'on', 'ion', 'ara', 'os', 'is', 'ium', 'ex', 'ae', 'ith', 'ar', 'us', 'el', 'or', 'a', 'e', 'yx', 'ant', 'eon',
  'is', 'ora', 'ys', 'ur', 'ane', 'el', 'ix',
]

const CATALOGUES: ((r: Rng) => string)[] = [
  (r) => `HD ${r.int(1000, 299999)}`,
  (r) => `HIP ${r.int(1000, 118000)}`,
  (r) => `Gliese ${r.int(1, 999)}`,
  (r) => `GJ ${r.int(1000, 4380)}`,
  (r) => `LHS ${r.int(1, 5500)}`,
  (r) => `Wolf ${r.int(1, 1500)}`,
  (r) => `Ross ${r.int(1, 999)}`,
  (r) => `KX-${r.int(1000, 9999)}`,
  (r) => `TOI-${r.int(100, 6999)}`,
  (r) => `2MASS J${r.int(1000, 2359)}${r.pick(['+', '−'])}${r.int(1000, 8959)}`,
  (r) => `${r.pick(['NGC', 'IC'])} ${r.int(100, 7800)}-${r.int(1, 99)}`,
  (r) => `${r.pick(['XR', 'MS', 'TK', 'VZ', 'QN'])}-${r.int(10, 99)}${r.pick(['a', 'b', 'c', ''])}`,
]

const WORLD_NAMES = [
  'Thulé', 'Perséphone', 'Achéron', 'Érèbe', 'Vanité', 'Concorde', 'Espérance', 'Miséricorde', 'Purgatoire',
  'Pénitence', 'Dernier Recours', 'Nouvelle Lyon', 'Calvaire', 'Halcyon', 'Tantale', 'Prométhée', 'Ithaque',
  'Nadir', 'Zénith', 'Cendre', 'Ossuaire', 'Charnier', 'Sainte-Brume', 'Lanterne', 'Mirage', 'Patience',
  'Obole', 'Styx', 'Léthé', 'Hespéride', 'Arcadie', 'Héliodore', 'Néréide', 'Fosse', 'Rédemption', 'Ancre',
  'Bastion', 'Clémence', 'Fortune', 'Exil', 'Solitude', 'Silence', 'Votive', 'Réquiem', 'Gorgone', 'Tartare',
  'Orphée', 'Eurydice', 'Cassandre', 'Atlas', 'Pandore', 'Icare', 'Dédale', 'Ménade', 'Sibylle', 'Médée',
]

const MOON_NAMES = [
  'Phébé', 'Aglaé', 'Thalie', 'Clio', 'Euterpe', 'Érato', 'Calliope', 'Uranie', 'Mnémé', 'Aoidé', 'Mélété',
  'Hélice', 'Lysithéa', 'Anankè', 'Carmé', 'Pasiphaé', 'Callisto', 'Léda', 'Himalia', 'Dioné', 'Téthys',
  'Hypérion', 'Ymir', 'Skadi', 'Mundilfari', 'Narvi', 'Kiviuq', 'Tarvos', 'Paaliaq', 'Siarnaq', 'Ijiraq',
  'Nix', 'Hydre', 'Kerbéros', 'Styx', 'Sao', 'Psamathé', 'Néso', 'Halimède', 'Larissa', 'Galatée', 'Despina',
]

export const CORPORATIONS = [
  'Consortium Halberd', 'Morrow Industries', 'Vanteq Extraction', 'Kessler-Ishida', 'Orison Biotech',
  'Galt & Ferro', 'Sodalité Fret', 'Nyborg Industries Lourdes', 'Mutuelle de Cyrène', 'Tessera Holdings',
  'Compagnie des Abysses', 'Ferrowind', 'Lazare Médical', 'Union des Foreurs', 'Hexacore Logistique',
  'Coopérative de Thulé', 'Aurelian Mining', 'Black Meridian', 'Sankt-Ilse Pharma', 'Groupe Vasquez-Nakamura',
]

export const FACTIONS = [
  'Syndicat des Mineurs', 'Flotte de la Bordure', 'Autorité Coloniale', 'Église du Grand Silence',
  'Pirates du Linceul', 'Libres-Marchands', 'Collectif Ouroboros', 'Garde Orbitale', 'Indépendants',
  'Ligue des Ports-Francs', 'Ordre de la Lanterne', 'Directoire Corporatiste',
]

const SHIP_PREFIX = ['ISV', 'MV', 'CSV', 'RSV', 'HMV', 'FTV', 'SV']
const SHIP_NAMES = [
  'Calypso', 'Halcyon', 'Persistance', 'Lanterne', 'Basse Marée', 'Promesse de Cendre', 'Miséricorde',
  'Ceres Drift', 'Long Silence', 'Pèlerin', 'Albatros', 'Ferrugo', 'Dame de Pique', 'Héron Gris', 'Obstinée',
  'Charité', 'Vieille Rouille', 'Bonne Espérance', 'Sentinelle', 'Mère des Eaux', 'Requiem', 'Gaspard',
  'Saint-Elme', 'Kraken', 'Fortuna', 'Vagabonde', 'Ophélie', 'Corbeau', 'Nuit Blanche', 'Écho Lointain',
  'Grand Large', 'Margot', 'Tisiphone', 'Mauvais Présage', 'Petite Ourse', 'Quiétude',
]

const STATION_KINDS = [
  'Station', 'Plateforme', 'Habitat', 'Relais', 'Dock', 'Poste', 'Anneau', 'Avant-poste', 'Forage', 'Comptoir',
]
const STATION_NAMES = [
  'Tarsis', 'Mercier', 'Ostia', 'Kessler', 'Vauban', 'Ishida', 'Valence', 'Morrow', 'Bréhat', 'Sankara',
  'Ferro', 'Delacroix', 'Okonkwo', 'Varga', 'Lindqvist', 'Rasmussen', 'Ibarra', 'Haldane', 'Marlowe', 'Quist',
  'Arkady', 'Novák', 'Abara', 'Torvald', 'Leclerc', 'Szabo', 'Moreau', 'Kaito', 'Adebayo', 'Castel',
]

const GATE_NAMES = ['Portail', 'Porte', 'Arche', 'Seuil', 'Passage', 'Couloir']
const GATE_SUFFIX = ['Ostia', 'Janus', 'Limen', 'Kharon', 'Vigil', 'Absolon', 'Ténèbre', 'Ariane', 'Orion']

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export class NameGen {
  private used = new Set<string>()
  constructor(private rng: Rng) {}

  private unique(make: () => string): string {
    for (let i = 0; i < 40; i++) {
      const n = make()
      if (!this.used.has(n)) {
        this.used.add(n)
        return n
      }
    }
    const n = `${make()} ${this.rng.int(2, 99)}`
    this.used.add(n)
    return n
  }

  systemName(): string {
    const r = this.rng
    return this.unique(() => {
      const parts = [r.pick(SYL_START)]
      if (r.bool(0.45)) parts.push(r.pick(SYL_MID))
      parts.push(r.pick(SYL_END))
      let n = parts.join('')
      n = n.replace(/([aeiouy])\1+/g, '$1')
      if (n.length < 5) n += r.pick(SYL_MID) + r.pick(SYL_END)
      return cap(n.toLowerCase())
    })
  }

  designation(): string {
    return this.unique(() => this.rng.pick(CATALOGUES)(this.rng))
  }

  planetName(host: string, index: number, properChance = 0.3): string {
    if (this.rng.bool(properChance)) return this.unique(() => this.rng.pick(WORLD_NAMES))
    return `${host} ${String.fromCharCode(98 + index)}`
  }

  moonName(planet: string, index: number, properChance = 0.35): string {
    if (this.rng.bool(properChance)) return this.unique(() => this.rng.pick(MOON_NAMES))
    return `${planet} ${romanNumeral(index + 1)}`
  }

  corporation(): string {
    return this.rng.pick(CORPORATIONS)
  }

  faction(): string {
    return this.rng.pick(FACTIONS)
  }

  station(kind?: string): string {
    const r = this.rng
    return this.unique(() => {
      const k = kind ?? r.pick(STATION_KINDS)
      const n = r.pick(STATION_NAMES)
      return r.bool(0.45) ? `${k} ${n}-${r.int(1, 12)}` : `${k} ${n}`
    })
  }

  ship(): string {
    const r = this.rng
    return this.unique(() => `${r.pick(SHIP_PREFIX)} ${r.pick(SHIP_NAMES)}`)
  }

  gate(): string {
    const r = this.rng
    return this.unique(() => `${r.pick(GATE_NAMES)} ${r.pick(GATE_SUFFIX)}`)
  }

  comet(year: number): string {
    const r = this.rng
    return this.unique(() => `C/${year} ${String.fromCharCode(65 + r.int(0, 25))}${r.int(1, 9)}`)
  }

  region(): string {
    const r = this.rng
    return this.unique(() => {
      const a = r.pick(['Marches', 'Bordure', 'Confins', 'Abîme', 'Couronne', 'Rebord', 'Brèche', 'Faille', 'Plateau', 'Gouffre', 'Nébuleuse', 'Archipel'])
      return `${a} ${r.pick(['de ', "d'", 'du '])}${this.systemName()}`.replace("d' ", "d'").replace(/de ([AEIOUYÉ])/u, "d'$1")
    })
  }
}
