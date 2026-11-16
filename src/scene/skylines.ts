/**
 * One silhouette per city, drawn with a single colour (`currentColor`) in a 1000 x 200 box.
 * No text in any of them: the city must not be named, the child has to recognise the landmark.
 */

const rect = (x: number, y: number, w: number, h: number) => `<rect x="${x}" y="${y}" width="${w}" height="${h}"/>`;
const poly = (points: string) => `<polygon points="${points}"/>`;
const path = (d: string) => `<path d="${d}"/>`;
const stroke = (d: string, width = 3) => `<path d="${d}" fill="none" stroke="currentColor" stroke-width="${width}" stroke-linecap="round"/>`;
const ellipse = (cx: number, cy: number, rx: number, ry: number, rotate = 0) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"${rotate ? ` transform="rotate(${rotate} ${cx} ${cy})"` : ''}/>`;
const group = (transform: string, body: string) => `<g transform="${transform}">${body}</g>`;

/** Crenellations (small blocks) along a wall top. */
function crenels(x0: number, x1: number, y: number, w = 12, gap = 12, h = 9): string {
  let out = '';
  for (let x = x0; x + w <= x1; x += w + gap) out += rect(x, y - h, w, h);
  return out;
}

/** A band of gentle waves from x0 to x1 whose crest line is at y, filled down to the bottom edge. */
function waves(y: number, x0: number, x1: number, amp = 4, len = 50): string {
  let d = `M${x0} ${y} Q${x0 + len / 4} ${y - amp} ${x0 + len / 2} ${y}`;
  for (let x = x0 + len; x < x1 + len; x += len) d += ` T${x} ${y}`;
  return path(`${d} L${x1 + len} 200 L${x0} 200 Z`);
}

function palm(x: number, y: number, height: number): string {
  const top = y - height;
  return stroke(`M${x} ${y} Q${x + 8} ${y - height / 2} ${x + 3} ${top}`, 4) +
    [[-34, 14], [-24, -6], [0, -14], [26, -6], [36, 14]].map(([dx, dy]) =>
      stroke(`M${x + 3} ${top} q${dx / 2} ${Math.min(dy, 0) - 10} ${dx} ${dy}`, 3)).join('');
}

function camel(x: number, y: number, scale: number): string {
  return group(`translate(${x} ${y}) scale(${scale})`,
    ellipse(40, 32, 27, 14) + ellipse(38, 17, 10, 10) +
    stroke('M62 28 Q74 14 80 4', 9) + ellipse(86, 4, 10, 5, 12) +
    rect(18, 40, 5, 42) + rect(29, 40, 5, 42) + rect(50, 40, 5, 42) + rect(61, 40, 5, 42) +
    stroke('M14 28 Q4 36 6 52', 3));
}

function boat(x: number, y: number, scale: number): string {
  return group(`translate(${x} ${y}) scale(${scale})`,
    path('M0 0 L64 0 L52 13 L12 13 Z') + rect(30, -42, 2, 42) + poly('34,-40 34,-6 58,-6') + poly('28,-30 28,-6 8,-6'));
}

function crane(x: number): string {
  return rect(x - 40, 46, 230, 8) +                                   // boom, long towards the ship
    rect(x + 20, 46, 7, 142) + rect(x + 96, 46, 7, 142) +               // legs
    poly(`${x + 20},46 ${x + 62},12 ${x + 103},46`) +                    // A-frame
    rect(x + 30, 54, 38, 16) +                                           // cabin
    stroke(`M${x + 160} 54 V104`, 2) + rect(x + 150, 104, 22, 14);       // hanging container
}

function ibex(x: number, y: number, scale: number, flip = false): string {
  return group(`translate(${x} ${y}) scale(${flip ? -scale : scale} ${scale})`,
    ellipse(0, -28, 21, 9) +
    rect(-17, -22, 4, 22) + rect(-8, -22, 4, 22) + rect(8, -22, 4, 22) + rect(16, -22, 4, 22) +
    poly('14,-32 28,-48 35,-43 24,-24') + ellipse(37, -45, 8, 4, -20) +
    stroke('M32 -50 Q22 -74 0 -64', 3.5) + rect(-24, -34, 7, 3));
}

const BUILDERS: Record<string, () => string> = {
  jerusalem: () =>
    rect(0, 150, 1000, 50) + crenels(0, 1000, 150) +
    rect(104, 112, 32, 38) + crenels(104, 136, 112, 8, 4, 8) + rect(864, 112, 32, 38) + crenels(864, 896, 112, 8, 4, 8) +
    poly('300,150 312,126 408,126 420,150') + path('M318 126 A42 42 0 0 1 402 126 Z') + rect(359, 66, 3, 20) +   // dome of the rock
    rect(440, 120, 44, 30) + rect(500, 132, 34, 18) + rect(700, 126, 54, 24) + path('M768 126 A16 16 0 0 1 800 126 Z') + rect(762, 126, 44, 24) +
    rect(596, 74, 40, 76) + rect(590, 64, 52, 11) + crenels(590, 642, 64, 8, 6, 7) +                             // tower of david
    rect(610, 26, 12, 40) + poly('607,26 625,26 616,4') + rect(604, 40, 24, 4),

  'tel-aviv': () =>
    [[30, 34, 90], [70, 28, 120], [104, 40, 70], [150, 30, 150], [186, 36, 100], [228, 26, 130], [260, 44, 80],
     [312, 30, 110], [348, 40, 160], [394, 28, 90], [428, 36, 120], [470, 34, 75]]
      .map(([x, w, h]) => rect(x, 200 - h, w, h) + (h >= 120 ? rect(x + w / 2 - 1, 200 - h - 16, 2, 16) : '')).join('') +
    path('M520 200 L520 186 Q700 176 1000 190 L1000 200 Z') + waves(192, 560, 1000, 3, 44) + palm(610, 186, 60) + palm(820, 188, 52),

  haifa: () =>
    path('M0 200 L0 120 Q150 60 330 70 Q520 80 640 140 Q700 172 720 200 Z') +
    [[90, 106, 14, 20], [140, 90, 12, 22], [190, 82, 16, 18], [240, 78, 12, 22], [400, 88, 14, 20], [450, 100, 12, 22],
     [500, 112, 16, 20], [550, 124, 12, 24], [600, 138, 14, 22]].map(([x, y, w, h]) => rect(x, y - h + 6, w, h)).join('') +
    rect(290, 52, 40, 20) + path('M296 52 A14 14 0 0 1 324 52 Z') + rect(308, 28, 3, 10) +                         // golden dome on the slope
    path('M740 200 L790 172 Q860 150 930 172 L1000 188 L1000 200 Z') + waves(194, 720, 1000, 3, 50),

  eilat: () =>
    poly('0,200 0,112 60,82 112,122 172,60 242,112 302,70 362,130 422,92 472,200') +
    poly('760,200 800,122 852,102 902,132 942,110 1000,152 1000,200') +
    waves(192, 470, 760, 3, 40) + boat(560, 180, 0.9) + rect(0, 196, 1000, 4),

  'beer-sheva': () =>
    path('M0 200 L0 172 Q120 122 260 168 Q400 206 520 152 Q650 100 780 162 Q900 206 1000 152 L1000 200 Z') +
    camel(520, 62, 1) + camel(690, 84, 0.78) + rect(60, 150, 3, 20) + poly('46,150 76,150 61,128'),

  tiberias: () =>
    path('M0 200 L0 122 Q90 88 170 124 L240 200 Z') + path('M1000 200 L1000 116 Q920 86 840 124 L760 200 Z') +
    rect(10, 150, 18, 20) + rect(34, 142, 16, 28) + rect(56, 156, 22, 14) +
    waves(186, 0, 1000, 3, 50) + boat(290, 172, 1) + boat(540, 176, 0.8) + boat(770, 170, 1.05),

  acre: () =>
    rect(0, 140, 1000, 60) + crenels(0, 1000, 140, 14, 12, 10) +
    rect(412, 80, 176, 62) + crenels(412, 588, 80, 12, 10, 9) + rect(392, 56, 44, 86) + crenels(392, 436, 56, 8, 6, 8) +
    rect(564, 56, 44, 86) + crenels(564, 608, 56, 8, 6, 8) +
    rect(686, 118, 76, 24) + path('M690 118 A34 34 0 0 1 758 118 Z') + rect(722, 66, 4, 14) +
    rect(790, 56, 10, 90) + poly('788,56 802,56 795,26') + rect(785, 84, 20, 5),

  ashdod: () =>
    rect(0, 188, 1000, 12) + path('M70 188 L540 188 L508 168 L102 168 Z') +
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => rect(120 + i * 38, 168 - 20 - (i % 3 === 1 ? 20 : 0), 34, 20 + (i % 3 === 1 ? 20 : 0))).join('') +
    crane(180) + crane(440) +
    [0, 1, 2, 3, 4, 5, 6, 7].map(i => rect(640 + i * 40, 168, 36, 20) + (i % 2 ? rect(640 + i * 40, 148, 36, 20) : '')).join('') +
    rect(960, 120, 14, 68) + poly('956,120 978,120 967,100'),

  'mitzpe-ramon': () =>
    path('M0 200 L0 72 L300 72 L350 92 L386 142 L412 200 Z') + path('M1000 200 L1000 72 L700 72 L650 92 L614 142 L588 200 Z') +
    path('M410 200 L426 176 Q500 164 574 176 L590 200 Z') + ibex(250, 72, 1.3) + ibex(770, 72, 1.0, true),

  caesarea: () =>
    `<path fill-rule="evenodd" d="M0 100 H700 V172 H0 Z${Array.from({ length: 11 }, (_, i) =>
      ` M${12 + i * 63} 172 V132 A22 22 0 0 1 ${56 + i * 63} 132 V172 Z`).join('')}"/>` +
    rect(0, 92, 700, 8) + path('M0 200 L0 172 Q300 166 700 172 L1000 182 L1000 200 Z') + waves(192, 700, 1000, 4, 50) +
    [0, 1, 2, 3].map(i => rect(748 + i * 28, 122, 8, 52)).join('') + rect(740, 112, 104, 10) + poly('740,112 792,92 844,112'),
};

/**
 * The drawing is wider than a phone screen, so it is scaled to fill the strip it is shown in and cropped at the sides
 * (`slice`). Which part stays in view depends on where the city's landmarks are drawn.
 */
const ALIGN: Record<string, 'xMinYMax' | 'xMidYMax' | 'xMaxYMax'> = {
  'tel-aviv': 'xMinYMax', haifa: 'xMinYMax', ashdod: 'xMinYMax', 'beer-sheva': 'xMaxYMax',
};

export function skylineSvg(cityId: string): string {
  const body = (BUILDERS[cityId] ?? (() => rect(0, 170, 1000, 30)))();
  const align = ALIGN[cityId] ?? 'xMidYMax';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 200" preserveAspectRatio="${align} slice" fill="currentColor" aria-hidden="true" focusable="false">${body}</svg>`;
}
