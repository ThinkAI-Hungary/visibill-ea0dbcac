/**
 * ISO/IEC 15417 Code 128 (Subset B) lineáris vonalkód generátor.
 * Külső függőség nélkül, tiszta TypeScript kód SVG és Canvas rendereléshez.
 */

const CODE128_PATTERNS: number[][] = [
  [2, 1, 2, 2, 2, 2], // 0: ' '
  [2, 2, 2, 1, 2, 2], // 1: '!'
  [2, 2, 2, 2, 2, 1], // 2: '"'
  [1, 2, 1, 2, 2, 3], // 3: '#'
  [1, 2, 1, 3, 2, 2], // 4: '$'
  [1, 3, 1, 2, 2, 2], // 5: '%'
  [1, 2, 2, 2, 1, 3], // 6: '&'
  [1, 2, 2, 3, 1, 2], // 7: '\''
  [1, 3, 2, 2, 1, 2], // 8: '('
  [2, 2, 1, 2, 1, 3], // 9: ')'
  [2, 2, 1, 3, 1, 2], // 10: '*'
  [2, 3, 1, 2, 1, 2], // 11: '+'
  [1, 1, 2, 2, 3, 2], // 12: ','
  [1, 2, 2, 1, 3, 2], // 13: '-'
  [1, 2, 2, 2, 3, 1], // 14: '.'
  [1, 1, 3, 2, 2, 2], // 15: '/'
  [1, 2, 3, 1, 2, 2], // 16: '0'
  [1, 2, 3, 2, 2, 1], // 17: '1'
  [2, 2, 3, 2, 1, 1], // 18: '2'
  [2, 2, 1, 1, 3, 2], // 19: '3'
  [2, 2, 1, 2, 3, 1], // 20: '4'
  [2, 1, 3, 2, 1, 2], // 21: '5'
  [2, 2, 3, 1, 1, 2], // 22: '6'
  [3, 1, 2, 1, 3, 1], // 23: '7'
  [3, 1, 1, 2, 2, 2], // 24: '8'
  [3, 2, 1, 1, 2, 2], // 25: '9'
  [3, 2, 1, 2, 2, 1], // 26: ':'
  [3, 1, 2, 2, 1, 2], // 27: ';'
  [3, 2, 2, 1, 1, 2], // 28: '<'
  [3, 2, 2, 2, 1, 1], // 29: '='
  [2, 1, 2, 1, 2, 3], // 30: '>'
  [2, 1, 2, 3, 2, 1], // 31: '?'
  [2, 3, 2, 1, 2, 1], // 32: '@'
  [1, 1, 1, 3, 2, 3], // 33: 'A'
  [1, 3, 1, 1, 2, 3], // 34: 'B'
  [1, 3, 1, 3, 2, 1], // 35: 'C'
  [1, 1, 2, 3, 1, 3], // 36: 'D'
  [1, 3, 2, 1, 1, 3], // 37: 'E'
  [1, 3, 2, 3, 1, 1], // 38: 'F'
  [2, 1, 1, 3, 1, 3], // 39: 'G'
  [2, 3, 1, 1, 1, 3], // 40: 'H'
  [2, 3, 1, 3, 1, 1], // 41: 'I'
  [1, 1, 2, 1, 3, 3], // 42: 'J'
  [1, 1, 2, 3, 3, 1], // 43: 'K'
  [1, 3, 2, 1, 3, 1], // 44: 'L'
  [1, 1, 3, 1, 2, 3], // 45: 'M'
  [1, 1, 3, 3, 2, 1], // 46: 'N'
  [1, 3, 3, 1, 2, 1], // 47: 'O'
  [3, 1, 3, 1, 2, 1], // 48: 'P'
  [2, 1, 1, 3, 3, 1], // 49: 'Q'
  [2, 3, 1, 1, 3, 1], // 50: 'R'
  [2, 1, 3, 1, 1, 3], // 51: 'S'
  [2, 1, 3, 3, 1, 1], // 52: 'T'
  [2, 1, 3, 1, 3, 1], // 53: 'U'
  [3, 1, 1, 1, 2, 3], // 54: 'V'
  [3, 1, 1, 3, 2, 1], // 55: 'W'
  [3, 3, 1, 1, 2, 1], // 56: 'X'
  [3, 1, 2, 1, 1, 3], // 57: 'Y'
  [3, 1, 2, 3, 1, 1], // 58: 'Z'
  [3, 3, 2, 1, 1, 1], // 59: '['
  [3, 1, 4, 1, 1, 1], // 60: '\\'
  [2, 2, 1, 4, 1, 1], // 61: ']'
  [4, 3, 1, 1, 1, 1], // 62: '^'
  [1, 1, 1, 2, 2, 4], // 63: '_'
  [1, 1, 1, 4, 2, 2], // 64: '`'
  [1, 2, 1, 1, 2, 4], // 65: 'a'
  [1, 2, 1, 4, 2, 1], // 66: 'b'
  [1, 4, 1, 1, 2, 2], // 67: 'c'
  [1, 4, 1, 2, 2, 1], // 68: 'd'
  [1, 1, 2, 2, 1, 4], // 69: 'e'
  [1, 1, 2, 4, 1, 2], // 70: 'f'
  [1, 2, 2, 1, 1, 4], // 71: 'g'
  [1, 2, 2, 4, 1, 1], // 72: 'h'
  [1, 4, 2, 1, 1, 2], // 73: 'i'
  [1, 4, 2, 2, 1, 1], // 74: 'j'
  [2, 4, 1, 2, 1, 1], // 75: 'k'
  [2, 2, 1, 1, 1, 4], // 76: 'l'
  [4, 1, 3, 1, 1, 1], // 77: 'm'
  [2, 4, 1, 1, 1, 2], // 78: 'n'
  [1, 3, 4, 1, 1, 1], // 79: 'o'
  [1, 1, 1, 2, 4, 2], // 80: 'p'
  [1, 2, 1, 1, 4, 2], // 81: 'q'
  [1, 2, 1, 2, 4, 1], // 82: 'r'
  [1, 1, 4, 2, 1, 2], // 83: 's'
  [1, 2, 4, 1, 1, 2], // 84: 't'
  [1, 2, 4, 2, 1, 1], // 85: 'u'
  [4, 1, 1, 2, 1, 2], // 86: 'v'
  [4, 2, 1, 1, 1, 2], // 87: 'w'
  [4, 2, 1, 2, 1, 1], // 88: 'x'
  [2, 1, 2, 1, 4, 1], // 89: 'y'
  [2, 1, 4, 1, 2, 1], // 90: 'z'
  [4, 1, 2, 1, 2, 1], // 91: '{'
  [1, 1, 1, 1, 4, 3], // 92: '|'
  [1, 1, 1, 3, 4, 1], // 93: '}'
  [1, 3, 1, 1, 4, 1], // 94: '~'
  [1, 1, 4, 1, 1, 3], // 95: DEL
  [1, 1, 4, 3, 1, 1], // 96: FNC 3
  [4, 1, 1, 1, 1, 3], // 97: FNC 2
  [4, 1, 1, 3, 1, 1], // 98: SHIFT
  [1, 1, 3, 1, 4, 1], // 99: CODE C
  [1, 1, 4, 1, 3, 1], // 100: CODE B
  [3, 1, 1, 1, 4, 1], // 101: FNC 4
  [4, 1, 1, 1, 3, 1], // 102: FNC 1
  [2, 1, 1, 4, 1, 2], // 103: START A
  [2, 1, 1, 2, 1, 4], // 104: START B
  [2, 1, 1, 2, 3, 2], // 105: START C
  [2, 3, 3, 1, 1, 1, 2], // 106: STOP
];

const START_B = 104;
const STOP = 106;

export interface Code128Options {
  height?: number;
  barWidth?: number;
  quietZone?: number;
  includeText?: boolean;
  fontSize?: number;
}

/**
 * Szöveg átalakítása Code 128B szimbólum-indexek tömbjére, ellenőrző összeggel és start/stop kódokkal.
 */
export function encodeCode128B(text: string): number[] {
  const cleanText = text.replace(/[^\x20-\x7E]/g, ''); // ASCII 32-126
  const symbols: number[] = [START_B];
  let checksum = START_B;

  for (let i = 0; i < cleanText.length; i++) {
    const code = cleanText.charCodeAt(i) - 32;
    symbols.push(code);
    checksum += code * (i + 1);
  }

  symbols.push(checksum % 103);
  symbols.push(STOP);
  return symbols;
}

/**
 * Code 128B vonalkód modulok (1 = fekete csík, 0 = fehér köz) sorozatának előállítása.
 */
export function generateCode128Modules(text: string): boolean[] {
  const symbolIndices = encodeCode128B(text);
  const modules: boolean[] = [];

  for (const idx of symbolIndices) {
    const pattern = CODE128_PATTERNS[idx];
    if (!pattern) continue;

    let isBar = true;
    for (const width of pattern) {
      for (let w = 0; w < width; w++) {
        modules.push(isBar);
      }
      isBar = !isBar;
    }
  }

  return modules;
}

/**
 * Code 128 SVG string generálása beágyazáshoz vagy letöltéshez.
 */
export function generateCode128Svg(text: string, options: Code128Options = {}): string {
  const {
    height = 50,
    barWidth = 1.5,
    quietZone = 10,
    includeText = true,
    fontSize = 11,
  } = options;

  const modules = generateCode128Modules(text);
  const contentWidth = modules.length * barWidth;
  const totalWidth = contentWidth + quietZone * 2;
  const textHeight = includeText ? fontSize + 6 : 0;
  const totalHeight = height + textHeight;

  let rectsSvg = '';
  let currentX = quietZone;

  for (let i = 0; i < modules.length; i++) {
    if (modules[i]) {
      rectsSvg += `<rect x="${currentX.toFixed(2)}" y="0" width="${barWidth.toFixed(2)}" height="${height}" fill="#000000" />`;
    }
    currentX += barWidth;
  }

  const textSvg = includeText
    ? `<text x="${(totalWidth / 2).toFixed(2)}" y="${(height + fontSize + 2).toFixed(2)}" font-family="monospace, monospace" font-size="${fontSize}" font-weight="600" text-anchor="middle" fill="#000000" letter-spacing="1px">${escapeXml(text)}</text>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth.toFixed(2)} ${totalHeight.toFixed(2)}" width="${totalWidth.toFixed(2)}" height="${totalHeight.toFixed(2)}" shape-rendering="crispEdges">
    <rect width="100%" height="100%" fill="#ffffff" />
    ${rectsSvg}
    ${textSvg}
  </svg>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
