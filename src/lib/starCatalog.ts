export interface Star {
  id: string;
  name: string;
  ra: number; // in hours (0 to 24)
  dec: number; // in degrees
  magnitude: number;
  constellationId?: string;
}

export interface Constellation {
  id: string;
  name: string;
  abbreviation: string;
  brightestStar: string;
  description: string;
  color: string;
  connections: [string, string][]; // Pairs of star IDs
}

export interface StarCatalog {
  stars: Star[];
  constellations: Constellation[];
}

export const DEFAULT_STAR_CATALOG: StarCatalog = {
  stars: [
    // Ursa Major stars
    { id: "dubhe", name: "Dubhe", ra: 11.06, dec: 61.75, magnitude: 1.8, constellationId: "urmajor" },
    { id: "merak", name: "Merak", ra: 11.03, dec: 56.38, magnitude: 2.3, constellationId: "urmajor" },
    { id: "phecda", name: "Phecda", ra: 11.89, dec: 53.69, magnitude: 2.4, constellationId: "urmajor" },
    { id: "megrez", name: "Megrez", ra: 12.25, dec: 57.03, magnitude: 3.3, constellationId: "urmajor" },
    { id: "alioth", name: "Alioth", ra: 12.9, dec: 55.96, magnitude: 1.8, constellationId: "urmajor" },
    { id: "mizar", name: "Mizar", ra: 13.4, dec: 54.92, magnitude: 2.2, constellationId: "urmajor" },
    { id: "alkaid", name: "Alkaid", ra: 13.79, dec: 49.32, magnitude: 1.9, constellationId: "urmajor" },

    // Orion stars
    { id: "betelgeuse", name: "Betelgeuse", ra: 5.92, dec: 7.41, magnitude: 0.4, constellationId: "orion" },
    { id: "rigel", name: "Rigel", ra: 5.25, dec: -8.2, magnitude: 0.1, constellationId: "orion" },
    { id: "bellatrix", name: "Bellatrix", ra: 5.42, dec: 6.35, magnitude: 1.6, constellationId: "orion" },
    { id: "saiph", name: "Saiph", ra: 5.79, dec: -9.67, magnitude: 2.1, constellationId: "orion" },
    { id: "alnitak", name: "Alnitak", ra: 5.68, dec: -1.94, magnitude: 1.7, constellationId: "orion" },
    { id: "alnilam", name: "Alnilam", ra: 5.6, dec: -1.2, magnitude: 1.7, constellationId: "orion" },
    { id: "mintaka", name: "Mintaka", ra: 5.53, dec: -0.3, constellationId: "orion", magnitude: 2.2 },

    // Cassiopeia stars
    { id: "segin", name: "Segin", ra: 1.9, dec: 63.67, magnitude: 3.3, constellationId: "cassiopeia" },
    { id: "ruchbah", name: "Ruchbah", ra: 1.43, dec: 60.23, magnitude: 2.7, constellationId: "cassiopeia" },
    { id: "gammacas", name: "Gamma Cas", ra: 0.95, dec: 60.72, magnitude: 2.2, constellationId: "cassiopeia" },
    { id: "schedar", name: "Schedar", ra: 0.67, dec: 56.54, magnitude: 2.2, constellationId: "cassiopeia" },
    { id: "caph", name: "Caph", ra: 0.15, dec: 59.15, magnitude: 2.3, constellationId: "cassiopeia" },

    // Cygnus stars
    { id: "deneb", name: "Deneb", ra: 20.69, dec: 45.28, magnitude: 1.25, constellationId: "cygnus" },
    { id: "sadr", name: "Sadr", ra: 20.37, dec: 40.26, magnitude: 2.2, constellationId: "cygnus" },
    { id: "albireo", name: "Albireo", ra: 19.51, dec: 27.96, magnitude: 3.1, constellationId: "cygnus" },
    { id: "gienah", name: "Gienah", ra: 20.77, dec: 33.97, magnitude: 2.5, constellationId: "cygnus" },
    { id: "deltacyg", name: "Delta Cyg", ra: 19.61, dec: 45.13, magnitude: 2.9, constellationId: "cygnus" },

    // Leo stars
    { id: "regulus", name: "Regulus", ra: 10.14, dec: 11.97, magnitude: 1.35, constellationId: "leo" },
    { id: "denebola", name: "Denebola", ra: 11.82, dec: 14.57, magnitude: 2.14, constellationId: "leo" },
    { id: "algieba", name: "Algieba", ra: 10.33, dec: 19.84, magnitude: 2.0, constellationId: "leo" },
    { id: "zosma", name: "Zosma", ra: 11.23, dec: 20.52, magnitude: 2.56, constellationId: "leo" },
    { id: "chertan", name: "Chertan", ra: 11.23, dec: 15.43, magnitude: 3.3, constellationId: "leo" },

    // Ursa Minor stars
    { id: "polaris", name: "Polaris (North Star)", ra: 2.53, dec: 89.26, magnitude: 1.97, constellationId: "urminor" },
    { id: "kochab", name: "Kochab", ra: 14.85, dec: 74.15, magnitude: 2.07, constellationId: "urminor" },
    { id: "pherkad", name: "Pherkad", ra: 15.35, dec: 71.83, magnitude: 3.0, constellationId: "urminor" },
    { id: "yildun", name: "Yildun", ra: 17.53, dec: 86.58, magnitude: 4.35, constellationId: "urminor" },

    // Pegasus stars
    { id: "markab", name: "Markab", ra: 23.08, dec: 15.2, magnitude: 2.49, constellationId: "pegasus" },
    { id: "scheat", name: "Scheat", ra: 23.06, dec: 28.08, magnitude: 2.42, constellationId: "pegasus" },
    { id: "algenib", name: "Algenib", ra: 0.22, dec: 15.18, magnitude: 2.83, constellationId: "pegasus" },
    { id: "enif", name: "Enif", ra: 21.73, dec: 9.87, magnitude: 2.38, constellationId: "pegasus" },

    // Taurus stars
    { id: "aldebaran", name: "Aldebaran", ra: 4.6, dec: 16.5, magnitude: 0.85, constellationId: "taurus" },
    { id: "elnath", name: "Elnath", ra: 5.43, dec: 28.6, magnitude: 1.65, constellationId: "taurus" },
    { id: "alcyone", name: "Alcyone (Pleiades)", ra: 3.78, dec: 24.1, magnitude: 2.85, constellationId: "taurus" }
  ],
  constellations: [
    {
      id: "urmajor",
      name: "Ursa Major",
      abbreviation: "UMa",
      brightestStar: "Alioth",
      description: "The Great Bear, dominant northern constellation containing the Big Dipper asterism. Used as an atmospheric calibration key.",
      color: "#22d3ee",
      connections: [
        ["dubhe", "merak"],
        ["merak", "phecda"],
        ["phecda", "megrez"],
        ["megrez", "dubhe"],
        ["megrez", "alioth"],
        ["alioth", "mizar"],
        ["mizar", "alkaid"]
      ]
    },
    {
      id: "orion",
      name: "Orion",
      abbreviation: "Ori",
      brightestStar: "Rigel",
      description: "The celestial hunter, prominent visible beacon on the equatorial strip with distinctive three-star planetary transit alignment.",
      color: "#38bdf8",
      connections: [
        ["betelgeuse", "bellatrix"],
        ["bellatrix", "mintaka"],
        ["mintaka", "alnilam"],
        ["alnilam", "alnitak"],
        ["alnitak", "saiph"],
        ["saiph", "rigel"],
        ["rigel", "mintaka"],
        ["betelgeuse", "alnitak"]
      ]
    },
    {
      id: "cassiopeia",
      name: "Cassiopeia",
      abbreviation: "Cas",
      brightestStar: "Schedar",
      description: "The vanity Queen of the polar circle, outlining an astronomical 'W' segment of cosmic dust and rich nebulae bands.",
      color: "#818cf8",
      connections: [
        ["segin", "ruchbah"],
        ["ruchbah", "gammacas"],
        ["gammacas", "schedar"],
        ["schedar", "caph"]
      ]
    },
    {
      id: "cygnus",
      name: "Cygnus",
      abbreviation: "Cyg",
      brightestStar: "Deneb",
      description: "The celestial Swan flying down the galactic plane, charting a high-magnitude Northern Cross framework.",
      color: "#22c55e",
      connections: [
        ["deneb", "sadr"],
        ["sadr", "albireo"],
        ["sadr", "gienah"],
        ["sadr", "deltacyg"]
      ]
    },
    {
      id: "leo",
      name: "Leo",
      abbreviation: "Leo",
      brightestStar: "Regulus",
      description: "The majestic celestial Lion celestial house, anchoring the spring sky with its distinct sickle-patterned head alignment.",
      color: "#a855f7",
      connections: [
        ["regulus", "algieba"],
        ["algieba", "zosma"],
        ["zosma", "denebola"],
        ["denebola", "chertan"],
        ["chertan", "regulus"]
      ]
    },
    {
      id: "urminor",
      name: "Ursa Minor",
      abbreviation: "UMi",
      brightestStar: "Polaris",
      description: "The Little Bear constellation, anchoring the northern celestial axis with the crucial navigation anchor, Polaris (the North Star).",
      color: "#fb7185",
      connections: [
        ["polaris", "yildun"],
        ["yildun", "kochab"],
        ["kochab", "pherkad"]
      ]
    },
    {
      id: "pegasus",
      name: "Pegasus",
      abbreviation: "Peg",
      brightestStar: "Enif",
      description: "The winged horse of Greek myth, representing a grand celestial square overhead which connects major stellar highways.",
      color: "#f59e0b",
      connections: [
        ["markab", "scheat"],
        ["scheat", "algenib"],
        ["algenib", "enif"],
        ["enif", "markab"]
      ]
    },
    {
      id: "taurus",
      name: "Taurus",
      abbreviation: "Tau",
      brightestStar: "Aldebaran",
      description: "The Bull, a striking winter constellation housing the fiery orange giant Aldebaran and the famous Pleiades star cluster.",
      color: "#10b981",
      connections: [
        ["aldebaran", "elnath"],
        ["elnath", "alcyone"]
      ]
    }
  ]
};
