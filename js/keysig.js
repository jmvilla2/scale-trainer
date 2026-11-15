// Draws a treble-clef key signature as inline SVG.

// Staff position in steps above the bottom line (E4 = 0).
const SHARP_POS = [8, 5, 9, 6, 3, 7, 4]; // F C G D A E B
const FLAT_POS = [4, 7, 3, 6, 2, 5, 1];  // B E A D G C F

const BOTTOM = 80;  // y of bottom staff line
const STEP = 5;     // half the line spacing
const yOf = (pos) => BOTTOM - pos * STEP;

function sharp(x, y) {
  return `
    <line x1="${x - 2.5}" y1="${y - 10}" x2="${x - 2.5}" y2="${y + 11}" stroke-width="1.4"/>
    <line x1="${x + 2.5}" y1="${y - 11}" x2="${x + 2.5}" y2="${y + 10}" stroke-width="1.4"/>
    <polygon points="${x - 5.5},${y - 2} ${x + 5.5},${y - 5.5} ${x + 5.5},${y - 2.5} ${x - 5.5},${y + 1}" stroke="none"/>
    <polygon points="${x - 5.5},${y + 5} ${x + 5.5},${y + 1.5} ${x + 5.5},${y + 4.5} ${x - 5.5},${y + 8}" stroke="none"/>`;
}

function flat(x, y) {
  return `
    <line x1="${x - 3}" y1="${y - 15}" x2="${x - 3}" y2="${y + 5}" stroke-width="1.5"/>
    <path d="M ${x - 3} ${y + 5} C ${x + 6} ${y}, ${x + 6} ${y - 6}, ${x - 3} ${y - 1.5}" fill="none" stroke-width="2.2"/>`;
}

const CLEF = `
  <path d="M 21 95 Q 23 101 29 98 Q 33 95 31 89 L 26 30 Q 25 15 32 13 Q 39 15 33 31
           Q 15 46 14 63 Q 14 81 29 81 Q 40 80 39 69 Q 38 59 28 60 Q 19 62 21 71 Q 23 76 28 75"
        fill="none" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="22" cy="94" r="3.4" stroke="none"/>`;

export function renderKeySignature({ type, count }) {
  const startX = 52;
  const gap = 13;
  const width = startX + Math.max(count, 1) * gap + 22;
  const positions = type === 'sharp' ? SHARP_POS : FLAT_POS;
  const draw = type === 'sharp' ? sharp : flat;

  let lines = '';
  for (let i = 0; i < 5; i++) {
    const y = BOTTOM - i * 10;
    lines += `<line x1="4" y1="${y}" x2="${width - 4}" y2="${y}" stroke-width="1"/>`;
  }
  let accs = '';
  for (let i = 0; i < count; i++) accs += draw(startX + i * gap, yOf(positions[i]));

  const label = count === 0 ? 'No sharps or flats'
    : `${count} ${type}${count > 1 ? 's' : ''}`;

  return `<svg class="keysig" viewBox="0 0 ${width} 110" role="img" aria-label="${label}"
      stroke="currentColor" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      ${lines}${CLEF}${accs}</svg>
      <div class="keysig-label">${label}</div>`;
}
