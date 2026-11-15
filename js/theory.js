// Music theory data: keys, scale spelling, fingerings.

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

// Semitone steps from the tonic for one octave (degrees 1–7).
const PATTERNS = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10], // natural minor
};

// Keys in circle-of-fifths order. Fingerings are for one octave ascending
// (8 notes, tonic to tonic); descending uses the same fingers in reverse.
export const KEYS = {
  major: [
    { tonic: 'C',  rh: '12312345', lh: '54321321' },
    { tonic: 'G',  rh: '12312345', lh: '54321321' },
    { tonic: 'D',  rh: '12312345', lh: '54321321' },
    { tonic: 'A',  rh: '12312345', lh: '54321321' },
    { tonic: 'E',  rh: '12312345', lh: '54321321' },
    { tonic: 'B',  rh: '12312345', lh: '43214321' },
    { tonic: 'F#', rh: '23412312', lh: '43213214' },
    { tonic: 'Db', rh: '23123412', lh: '32143213' },
    { tonic: 'Ab', rh: '34123123', lh: '32143213' },
    { tonic: 'Eb', rh: '31234123', lh: '32143213' },
    { tonic: 'Bb', rh: '41231234', lh: '32143213' },
    { tonic: 'F',  rh: '12341234', lh: '54321321' },
  ],
  minor: [
    { tonic: 'A',  rh: '12312345', lh: '54321321' },
    { tonic: 'E',  rh: '12312345', lh: '54321321' },
    { tonic: 'B',  rh: '12312345', lh: '43214321' },
    { tonic: 'F#', rh: '34123123', lh: '43213214' },
    { tonic: 'C#', rh: '34123123', lh: '32143213' },
    { tonic: 'G#', rh: '34123123', lh: '32143213' },
    { tonic: 'D#', rh: '31234123', lh: '21432132' },
    { tonic: 'Bb', rh: '41231234', lh: '21432132' },
    { tonic: 'F',  rh: '12341234', lh: '54321321' },
    { tonic: 'C',  rh: '12312345', lh: '54321321' },
    { tonic: 'G',  rh: '12312345', lh: '54321321' },
    { tonic: 'D',  rh: '12312345', lh: '54321321' },
  ],
};

const mod = (n, m) => ((n % m) + m) % m;

function accidental(alter) {
  if (alter > 0) return '♯'.repeat(alter);
  if (alter < 0) return '♭'.repeat(-alter);
  return '';
}

export function prettyName(name) {
  return name[0] + name.slice(1).replace(/#/g, '♯').replace(/b/g, '♭');
}

/** Build everything the app needs for one key. */
export function buildKey(def, mode, octaves = 2) {
  const letter = def.tonic[0];
  const acc = def.tonic.slice(1);
  const alter = (acc.match(/#/g) || []).length - (acc.match(/b/g) || []).length;
  const tonicPc = mod(LETTER_PC[letter] + alter, 12);
  const li = LETTERS.indexOf(letter);

  const pattern = PATTERNS[mode];
  const notes = pattern.map((iv, i) => {
    const L = LETTERS[(li + i) % 7];
    const pc = (tonicPc + iv) % 12;
    const diff = mod(pc - LETTER_PC[L] + 6, 12) - 6; // -6..5
    return L + accidental(diff);
  });

  const sharps = notes.filter((n) => n.includes('♯')).length;
  const flats = notes.filter((n) => n.includes('♭')).length;

  // Up N octaves and back down (1 octave = 15 notes, 2 octaves = 29).
  const upCount = 7 * octaves + 1;
  const upDegrees = Array.from({ length: upCount }, (_, i) => i);
  const upOffsets = upDegrees.map((i) => pattern[i % 7] + 12 * Math.floor(i / 7));
  const offsets = [...upOffsets, ...upOffsets.slice(0, -1).reverse()];
  const degrees = [...upDegrees, ...upDegrees.slice(0, -1).reverse()];
  const sequence = degrees.map((d) => notes[d % 7]);

  return {
    tonic: def.tonic,
    tonicPc,
    mode,
    octaves,
    upCount,
    title: `${prettyName(def.tonic)} ${mode === 'major' ? 'Major' : 'Minor'}`,
    notes,                      // 7 spelled notes
    upNotes: upDegrees.map((d) => notes[d % 7]),
    sequence,                   // spelled notes, up then down
    offsets,                    // semitone offsets from the starting tonic
    signature: sharps ? { type: 'sharp', count: sharps } : { type: 'flat', count: flats },
    fingering: {
      rh: extendFingering(def.rh, octaves, 'rh'),
      lh: extendFingering(def.lh, octaves, 'lh'),
    },
  };
}

/**
 * Extend a one-octave fingering (8 digits) to N octaves.
 * RH repeats the first 7 fingers per octave and ends on the last finger
 * (C major: 1231234 1231234 5). LH keeps its starting finger, then repeats
 * fingers 2–8 per octave (C major: 5 4321321 4321321), so the thumb crosses
 * correctly at each middle tonic.
 */
function extendFingering(str, octaves, hand) {
  const f = str.split('').map(Number);
  const out = [];
  if (hand === 'rh') {
    for (let o = 0; o < octaves; o++) out.push(...f.slice(0, 7));
    out.push(f[7]);
  } else {
    out.push(f[0]);
    for (let o = 0; o < octaves; o++) out.push(...f.slice(1));
  }
  return out;
}
