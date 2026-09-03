/**
 * Sons générés à la volée (WebAudio) : aucun fichier à télécharger.
 * Coupables via le bouton muet de l'en-tête.
 */
const CLE_MUET = 'coupable:muet';

let contexte: AudioContext | null = null;
let muet = (() => {
  try {
    return localStorage.getItem(CLE_MUET) === '1';
  } catch {
    return false;
  }
})();

const abonnes = new Set<(m: boolean) => void>();

export function estMuet() {
  return muet;
}

export function basculerMuet() {
  muet = !muet;
  try {
    localStorage.setItem(CLE_MUET, muet ? '1' : '0');
  } catch {
    /* ignoré */
  }
  abonnes.forEach((f) => f(muet));
  return muet;
}

export function surChangementMuet(f: (m: boolean) => void): () => void {
  abonnes.add(f);
  return () => {
    abonnes.delete(f);
  };
}

function ctx(): AudioContext | null {
  if (muet) return null;
  if (!contexte) {
    const AC = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!AC) return null;
    contexte = new AC();
  }
  if (contexte.state === 'suspended') void contexte.resume();
  return contexte;
}

function bip(freq: number, duree: number, type: OscillatorType = 'sine', volume = 0.25, delai = 0) {
  const c = ctx();
  if (!c) return;
  const t0 = c.currentTime + delai;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duree);
  osc.connect(gain).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + duree + 0.05);
}

function bruit(duree: number, volume = 0.4, delai = 0) {
  const c = ctx();
  if (!c) return;
  const frames = Math.floor(c.sampleRate * duree);
  const buffer = c.createBuffer(1, frames, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / frames) ** 2;
  }
  const src = c.createBufferSource();
  src.buffer = buffer;
  const filtre = c.createBiquadFilter();
  filtre.type = 'lowpass';
  filtre.frequency.value = 1400;
  const gain = c.createGain();
  gain.gain.value = volume;
  src.connect(filtre).connect(gain).connect(c.destination);
  src.start(c.currentTime + delai);
}

export type Son = 'marteau' | 'tic' | 'tic-urgent' | 'point' | 'tirage' | 'fanfare' | 'clic';

export function jouer(son: Son) {
  switch (son) {
    case 'marteau':
      bruit(0.28, 0.5);
      bip(90, 0.22, 'triangle', 0.5);
      bip(55, 0.32, 'sine', 0.35, 0.02);
      break;
    case 'tic':
      bip(880, 0.05, 'square', 0.08);
      break;
    case 'tic-urgent':
      bip(1180, 0.06, 'square', 0.16);
      break;
    case 'point':
      bip(660, 0.09, 'triangle', 0.2);
      bip(990, 0.12, 'triangle', 0.18, 0.08);
      break;
    case 'tirage':
      bip(420, 0.08, 'sawtooth', 0.12);
      bip(520, 0.08, 'sawtooth', 0.12, 0.09);
      bip(640, 0.14, 'sawtooth', 0.14, 0.18);
      break;
    case 'fanfare':
      [523, 659, 784, 1047].forEach((f, i) => bip(f, 0.35, 'triangle', 0.22, i * 0.13));
      break;
    case 'clic':
      bip(520, 0.04, 'square', 0.07);
      break;
  }
}
