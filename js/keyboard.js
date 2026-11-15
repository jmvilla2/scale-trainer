// Tappable on-screen piano keyboard.

const BLACK = new Set([1, 3, 6, 8, 10]);
const NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];

export function createKeyboard(container, { low = 48, high = 84, onPress }) {
  container.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'kb';
  container.appendChild(wrap);

  const whites = [];
  for (let n = low; n <= high; n++) if (!BLACK.has(n % 12)) whites.push(n);
  const whiteW = 100 / whites.length;
  const keys = new Map();

  let whiteIndex = 0;
  for (let n = low; n <= high; n++) {
    const el = document.createElement('button');
    el.type = 'button';
    el.dataset.note = n;
    el.setAttribute('aria-label', NAMES[n % 12] + (Math.floor(n / 12) - 1));
    if (BLACK.has(n % 12)) {
      el.className = 'key black';
      el.style.left = `${whiteIndex * whiteW - whiteW * 0.31}%`;
      el.style.width = `${whiteW * 0.62}%`;
    } else {
      el.className = 'key white';
      el.style.left = `${whiteIndex * whiteW}%`;
      el.style.width = `${whiteW}%`;
      if (n % 12 === 0) el.innerHTML = `<span>C${Math.floor(n / 12) - 1}</span>`;
      whiteIndex++;
    }
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      onPress(n);
    });
    wrap.appendChild(el);
    keys.set(n, el);
  }

  return {
    flash(note, cls) {
      const el = keys.get(note);
      if (!el) return;
      el.classList.remove('ok', 'bad');
      void el.offsetWidth; // restart animation
      el.classList.add(cls);
      clearTimeout(el._t);
      el._t = setTimeout(() => el.classList.remove(cls), 350);
    },
  };
}
