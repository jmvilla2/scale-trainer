// Small Web Audio synth for on-screen key taps and feedback sounds.

let ctx = null;

function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

const freq = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

function tone(f, { start = 0, dur = 0.9, gain = 0.25, type = 'triangle' } = {}) {
  const a = ac();
  const t = a.currentTime + start;
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  g.connect(a.destination);

  const o1 = a.createOscillator();
  o1.type = type;
  o1.frequency.value = f;
  const o2 = a.createOscillator();
  o2.type = 'sine';
  o2.frequency.value = f * 2;
  const g2 = a.createGain();
  g2.gain.value = 0.25;
  o1.connect(g);
  o2.connect(g2).connect(g);
  o1.start(t); o2.start(t);
  o1.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
}

export function playNote(midi) {
  tone(freq(midi));
}

export function playSuccess() {
  [72, 76, 79, 84].forEach((n, i) => tone(freq(n), { start: i * 0.08, dur: 0.5, gain: 0.15 }));
}

export function unlockAudio() {
  ac();
}
