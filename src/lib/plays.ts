import type { BoardPlay } from "./court3d";

// Meia quadra: x de 0 (linha de fundo) a 14 (meio), z de -7,5 a 7,5.
// A cesta fica em x = 1,6.
export type PlayPreset = {
  id: string;
  name: string;
  hook: string;
  subtitle: string;
  play: BoardPlay;
};

const DURATION = 12;
const RIM = { x: 1.6, z: 0 };

type Key = [number, number, number];

const attack = (num: number, keys: Key[]) => ({
  num,
  team: "off" as const,
  keys: keys.map(([t, x, z]) => ({ t, x, z })),
});

/** Defensor entre o atacante e a cesta, a `dist` metros do atacante. */
const guard = (num: number, keys: Key[], dist = 1.75) => ({
  num,
  team: "def" as const,
  keys: keys.map(([t, x, z]) => {
    const dx = RIM.x - x;
    const dz = RIM.z - z;
    const len = Math.hypot(dx, dz) || 1;
    return { t, x: x + (dx / len) * dist, z: z + (dz / len) * dist };
  }),
});

const manual = (num: number, keys: Key[]) => ({
  num,
  team: "def" as const,
  keys: keys.map(([t, x, z]) => ({ t, x, z })),
});

const TRIANGLE_OFF: { num: number; keys: Key[] }[] = [
  {
    num: 1,
    keys: [
      [0, 11.6, 1.6],
      [3, 11.2, 0.4],
      [6, 10.4, -1.4],
      [12, 10.4, -1.4],
    ],
  },
  {
    num: 2,
    keys: [
      [0, 8.0, 6.3],
      [3, 8.0, 6.3],
      [6, 8.6, 5.2],
      [12, 8.6, 5.2],
    ],
  },
  {
    num: 3,
    keys: [
      [0, 1.4, 6.5],
      [6, 1.4, 6.5],
      [8, 1.9, 4.2],
      [9.6, 2.3, 1.2],
      [12, 2.3, 1.2],
    ],
  },
  {
    num: 4,
    keys: [
      [0, 4.6, -3.4],
      [4, 4.8, -2.0],
      [8, 5.2, -0.6],
      [12, 5.2, -0.6],
    ],
  },
  {
    num: 5,
    keys: [
      [0, 7.6, -5.4],
      [5, 7.6, -5.4],
      [7, 6.2, -3.6],
      [12, 6.2, -3.6],
    ],
  },
];

const TRIANGLE: PlayPreset = {
  id: "triangle",
  name: "Triângulo ofensivo",
  hook: "Jogada ensaiada é um sistema",
  subtitle: "O triângulo de Bulls e Lakers em 12 segundos",
  play: {
    id: "triangle",
    name: "Triângulo ofensivo",
    duration: DURATION,
    players: [
      ...TRIANGLE_OFF.map((item) => attack(item.num, item.keys)),
      ...TRIANGLE_OFF.map((item) => guard(item.num, item.keys)),
    ],
    arrows: [
      { t0: 2.6, t1: 3.8, from: { x: 11.4, z: 0.9 }, to: { x: 8.2, z: 6.0 } },
      { t0: 5.6, t1: 6.8, from: { x: 8.4, z: 5.6 }, to: { x: 4.9, z: -1.6 } },
      { t0: 8.0, t1: 9.4, from: { x: 1.9, z: 4.6 }, to: { x: 2.4, z: 1.0 } },
    ],
    ball: [
      { t: 0, x: 11.6, z: 1.6, y: 0.4 },
      { t: 2.6, x: 11.4, z: 0.9, y: 0.4 },
      { t: 3.4, x: 9.4, z: 4.2, y: 1.9 },
      { t: 3.8, x: 8.2, z: 6.0, y: 0.9 },
      { t: 5.6, x: 8.4, z: 5.6, y: 0.5 },
      { t: 6.4, x: 6.2, z: 2.0, y: 1.9 },
      { t: 6.8, x: 4.9, z: -1.6, y: 0.9 },
      { t: 7.8, x: 4.4, z: -1.0, y: 0.5 },
      { t: 8.8, x: 2.6, z: 3.2, y: 1.9 },
      { t: 9.4, x: 2.4, z: 1.0, y: 1.2 },
      { t: 10.4, x: 2.1, z: 0.3, y: 2.9 },
      { t: 12, x: 2.1, z: 0.3, y: 0.3 },
    ],
  },
};

const PNR_OFF: { num: number; keys: Key[] }[] = [
  {
    num: 1,
    keys: [
      [0, 11.6, 0.6],
      [3, 11.2, 2.4],
      [5, 10.4, -1.6],
      [8, 7.4, -2.6],
      [12, 7.4, -2.6],
    ],
  },
  {
    num: 5,
    keys: [
      [0, 9.6, 2.6],
      [3, 9.6, 2.6],
      [5, 8.4, 0.6],
      [7, 5.6, 0.2],
      [9, 3.4, 0.4],
      [12, 3.4, 0.4],
    ],
  },
  {
    num: 2,
    keys: [
      [0, 1.4, 6.5],
      [8, 1.4, 6.5],
      [12, 1.4, 6.5],
    ],
  },
  {
    num: 3,
    keys: [
      [0, 7.4, -6.4],
      [8, 7.0, -6.2],
      [12, 7.0, -6.2],
    ],
  },
  {
    num: 4,
    keys: [
      [0, 1.6, -6.4],
      [8, 1.6, -6.4],
      [12, 1.6, -6.4],
    ],
  },
];

const PICK_AND_ROLL: PlayPreset = {
  id: "pick-and-roll",
  name: "Pick and roll",
  hook: "Pick and roll não é bloqueio",
  subtitle: "O roll cria a vantagem, não o contato",
  play: {
    id: "pick-and-roll",
    name: "Pick and roll",
    duration: DURATION,
    players: [
      ...PNR_OFF.map((item) => attack(item.num, item.keys)),
      ...PNR_OFF.map((item) => guard(item.num, item.keys, 1.9)),
    ],
    arrows: [
      { t0: 3.4, t1: 5.0, from: { x: 10.6, z: 1.8 }, to: { x: 8.2, z: 0.4 } },
      { t0: 5.2, t1: 7.2, from: { x: 8.4, z: 0.4 }, to: { x: 5.2, z: 0.2 }, lift: 1.0 },
      { t0: 7.4, t1: 9.4, from: { x: 5.2, z: 0.2 }, to: { x: 3.2, z: 0.4 }, lift: 1.0 },
      { t0: 8.6, t1: 10.4, from: { x: 7.4, z: -2.6 }, to: { x: 3.6, z: 0.6 } },
    ],
    ball: [
      { t: 0, x: 11.6, z: 0.6, y: 0.4 },
      { t: 3.4, x: 10.6, z: 1.8, y: 0.4 },
      { t: 5.0, x: 8.2, z: 0.4, y: 0.5 },
      { t: 7.0, x: 6.0, z: 0.2, y: 0.4 },
      { t: 8.0, x: 5.6, z: 0.2, y: 0.5 },
      { t: 8.8, x: 4.0, z: 0.6, y: 1.9 },
      { t: 9.4, x: 3.4, z: 0.4, y: 1.0 },
      { t: 10.6, x: 2.2, z: 0.2, y: 2.9 },
      { t: 12, x: 2.2, z: 0.2, y: 0.3 },
    ],
  },
};

const HORNS_OFF: { num: number; keys: Key[] }[] = [
  {
    num: 1,
    keys: [
      [0, 11.8, 0],
      [4, 11.4, 0.6],
      [6, 10.2, 3.2],
      [9, 8.4, 4.6],
      [12, 8.4, 4.6],
    ],
  },
  {
    num: 4,
    keys: [
      [0, 6.4, -3.0],
      [4, 6.4, -3.0],
      [6, 5.6, -1.6],
      [9, 3.4, -0.6],
      [12, 3.4, -0.6],
    ],
  },
  {
    num: 5,
    keys: [
      [0, 6.4, 3.0],
      [4, 6.4, 3.0],
      [6, 5.4, 1.4],
      [9, 3.0, 1.2],
      [12, 3.0, 1.2],
    ],
  },
  {
    num: 2,
    keys: [
      [0, 1.4, 6.5],
      [9, 1.4, 6.5],
      [12, 1.4, 6.5],
    ],
  },
  {
    num: 3,
    keys: [
      [0, 1.4, -6.5],
      [9, 1.4, -6.5],
      [12, 1.4, -6.5],
    ],
  },
];

const HORNS: PlayPreset = {
  id: "horns",
  name: "Horns",
  hook: "Dois bloqueios, uma decisão",
  subtitle: "Horns: o defensor escolhe errado em 1 segundo",
  play: {
    id: "horns",
    name: "Horns",
    duration: DURATION,
    players: [
      ...HORNS_OFF.map((item) => attack(item.num, item.keys)),
      ...HORNS_OFF.map((item) => guard(item.num, item.keys, 1.8)),
    ],
    arrows: [
      { t0: 3.6, t1: 5.4, from: { x: 11.4, z: 0.4 }, to: { x: 10.0, z: 3.0 } },
      { t0: 5.6, t1: 7.4, from: { x: 10.0, z: 3.0 }, to: { x: 8.0, z: 4.6 } },
      { t0: 6.0, t1: 8.4, from: { x: 5.6, z: -1.6 }, to: { x: 3.2, z: -0.4 }, lift: 0.9 },
    ],
    ball: [
      { t: 0, x: 11.8, z: 0, y: 0.4 },
      { t: 4.0, x: 11.4, z: 0.6, y: 0.4 },
      { t: 6.0, x: 10.2, z: 3.2, y: 0.4 },
      { t: 8.0, x: 8.8, z: 4.4, y: 0.5 },
      { t: 8.8, x: 6.2, z: 3.4, y: 1.9 },
      { t: 9.2, x: 5.0, z: 2.0, y: 0.6 },
      { t: 10.4, x: 2.4, z: 0.4, y: 2.9 },
      { t: 12, x: 2.4, z: 0.4, y: 0.3 },
    ],
  },
};

const ZONE: PlayPreset = {
  id: "zone-2-3",
  name: "Zona 2-3",
  hook: "Zona 2-3 não é passiva",
  subtitle: "Ela empurra o ataque para onde quer",
  play: {
    id: "zone-2-3",
    name: "Zona 2-3",
    duration: DURATION,
    players: [
      attack(1, [
        [0, 11.6, 0],
        [4, 11.4, 2.4],
        [8, 9.6, 4.4],
        [12, 9.6, 4.4],
      ]),
      attack(2, [
        [0, 7.4, 6.4],
        [8, 7.4, 6.4],
        [12, 7.4, 6.4],
      ]),
      attack(3, [
        [0, 7.4, -6.4],
        [8, 7.4, -6.4],
        [12, 7.4, -6.4],
      ]),
      attack(4, [
        [0, 4.4, 3.0],
        [8, 4.4, 3.0],
        [12, 4.4, 3.0],
      ]),
      attack(5, [
        [0, 4.4, -3.0],
        [8, 4.4, -3.0],
        [12, 4.4, -3.0],
      ]),
      manual(1, [
        [0, 9.6, -1.4],
        [4, 9.4, 1.0],
        [8, 8.2, 3.0],
        [12, 8.2, 3.0],
      ]),
      manual(2, [
        [0, 9.6, 1.4],
        [4, 9.2, 3.2],
        [8, 7.8, 4.4],
        [12, 7.8, 4.4],
      ]),
      manual(3, [
        [0, 3.8, -3.4],
        [8, 3.8, -2.6],
        [12, 3.8, -2.6],
      ]),
      manual(4, [
        [0, 2.8, 0],
        [8, 3.0, 0.4],
        [12, 3.0, 0.4],
      ]),
      manual(5, [
        [0, 3.8, 3.4],
        [8, 3.6, 4.2],
        [12, 3.6, 4.2],
      ]),
    ],
    arrows: [
      { t0: 3.4, t1: 5.2, from: { x: 11.4, z: 2.2 }, to: { x: 9.6, z: 4.2 } },
      { t0: 5.6, t1: 7.6, from: { x: 9.0, z: 2.8 }, to: { x: 7.4, z: 4.6 }, lift: 0.8 },
      { t0: 7.8, t1: 9.6, from: { x: 7.4, z: 4.6 }, to: { x: 4.0, z: 5.6 }, lift: 0.8 },
    ],
    ball: [
      { t: 0, x: 11.6, z: 0, y: 0.4 },
      { t: 4.0, x: 11.4, z: 2.4, y: 0.4 },
      { t: 5.2, x: 9.8, z: 4.2, y: 1.6 },
      { t: 5.6, x: 9.6, z: 4.4, y: 0.5 },
      { t: 7.6, x: 8.2, z: 5.4, y: 1.6 },
      { t: 8.0, x: 7.4, z: 6.4, y: 0.5 },
      { t: 9.6, x: 5.2, z: 6.6, y: 1.7 },
      { t: 10.0, x: 4.4, z: 3.0, y: 0.5 },
      { t: 12, x: 4.4, z: 3.0, y: 0.5 },
    ],
  },
};

export const PLAY_PRESETS: PlayPreset[] = [TRIANGLE, PICK_AND_ROLL, HORNS, ZONE];
