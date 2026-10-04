// Мягкий лаундж для ролика ЭВМО — синтез с нуля (без сэмплов и чужих записей).
// Электропиано (FM), пэд, бас, щётки, мягкая бочка, реверберация. Выход: WAV 44,1 кГц, стерео.
// Запуск: node music/lounge.mjs out.wav [секунд]
import fs from "node:fs";

const SR = 44100;
const DUR = Number(process.argv[3] || 48);
const N = Math.floor(SR * DUR);
const L = new Float32Array(N), R = new Float32Array(N);
const sendL = new Float32Array(N), sendR = new Float32Array(N);
const BPM = 84, BEAT = 60 / BPM, BAR = BEAT * 4;
let seed = 12345;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

function add(i, l, r, send = 0.3) {
  if (i < 0 || i >= N) return;
  L[i] += l; R[i] += r; sendL[i] += l * send; sendR[i] += r * send;
}

// Электропиано: FM 1:1 с затухающим индексом + лёгкий «колокольчик» на атаке, стереопанорама.
function epiano(t0, midi, vel, len = 2.6, pan = 0) {
  const f = hz(midi), i0 = Math.floor(t0 * SR), n = Math.floor(len * SR);
  const gl = Math.cos((pan + 1) * Math.PI / 4), gr = Math.sin((pan + 1) * Math.PI / 4);
  const decay = 1.5 + (72 - midi) * 0.03;
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    const env = Math.min(1, t / 0.004) * Math.exp(-t / decay) * (k > n - 2000 ? (n - k) / 2000 : 1);
    const idx = 0.25 + 1.4 * vel * Math.exp(-t / 0.35);
    const mod = Math.sin(2 * Math.PI * f * t);
    let v = Math.sin(2 * Math.PI * f * t + idx * mod);
    v += 0.12 * vel * Math.sin(2 * Math.PI * f * 14 * t) * Math.exp(-t / 0.05);
    v *= env * vel * 0.19;
    const trem = 1 + 0.12 * Math.sin(2 * Math.PI * 4.2 * t);
    add(i0 + k, v * gl * trem, v * gr * (2 - trem), 0.35);
  }
}

// Пэд: несколько слегка расстроенных синусов с медленной атакой — «воздух» под аккордом.
function pad(t0, notes, len) {
  const i0 = Math.floor(t0 * SR), n = Math.floor(len * SR);
  for (const m of notes) {
    const f = hz(m);
    for (const det of [-0.0035, 0.0035]) {
      const ff = f * (1 + det), ph = rnd() * 6.28;
      for (let k = 0; k < n; k++) {
        const t = k / SR;
        const env = Math.min(1, t / 1.2) * Math.min(1, (len - t) / 1.0);
        const v = (Math.sin(2 * Math.PI * ff * t + ph) + 0.18 * Math.sin(4 * Math.PI * ff * t + ph)) * env * 0.012;
        add(i0 + k, det < 0 ? v * 1.2 : v * 0.8, det < 0 ? v * 0.8 : v * 1.2, 0.6);
      }
    }
  }
}

// Бас: синус + немного второй гармоники, мягкая атака.
function bass(t0, midi, len, vel = 1) {
  const f = hz(midi), i0 = Math.floor(t0 * SR), n = Math.floor(len * SR);
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    const env = Math.min(1, t / 0.012) * Math.exp(-t / 0.9) * Math.min(1, (n - k) / 800);
    const v = (Math.sin(2 * Math.PI * f * t) + 0.22 * Math.sin(4 * Math.PI * f * t) + 0.06 * Math.sin(6 * Math.PI * f * t)) * env * 0.12 * vel;
    add(i0 + k, v, v, 0.05);
  }
}

function kick(t0, vel = 1) {
  const i0 = Math.floor(t0 * SR), n = Math.floor(0.35 * SR);
  let ph = 0;
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    const f = 48 + 40 * Math.exp(-t / 0.03);
    ph += 2 * Math.PI * f / SR;
    const v = Math.sin(ph) * Math.exp(-t / 0.14) * 0.2 * vel;
    add(i0 + k, v, v, 0.02);
  }
}

// Шумовые удары (щётки, «снэп»): шум через простые фильтры, короткая огибающая.
function noiseHit(t0, { len, decay, hp, lp, gain, pan = 0, send = 0.2 }) {
  const i0 = Math.floor(t0 * SR), n = Math.floor(len * SR);
  let lpL = 0, hpPrev = 0, hpOut = 0;
  const aL = Math.exp(-2 * Math.PI * lp / SR), aH = Math.exp(-2 * Math.PI * hp / SR);
  const gl = Math.cos((pan + 1) * Math.PI / 4), gr = Math.sin((pan + 1) * Math.PI / 4);
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    const x = rnd() * 2 - 1;
    lpL = (1 - aL) * x + aL * lpL;
    hpOut = aH * (hpOut + lpL - hpPrev); hpPrev = lpL;
    const env = Math.min(1, t / 0.002) * Math.exp(-t / decay);
    const v = hpOut * env * gain;
    add(i0 + k, v * gl, v * gr, send);
  }
}

const CHORDS = [
  { root: 38, notes: [54, 57, 61, 64], scale: [62, 64, 66, 69, 71, 73] }, // Dmaj9
  { root: 35, notes: [57, 61, 62, 66], scale: [62, 64, 66, 69, 71, 73] }, // Bm9
  { root: 31, notes: [54, 57, 59, 62], scale: [62, 66, 67, 69, 71, 74] }, // Gmaj9
  { root: 33, notes: [55, 59, 62, 66], scale: [64, 66, 67, 69, 71, 74] }, // A13sus
];
const bars = Math.ceil(DUR / BAR);
const swing = (beat8) => (beat8 % 2 === 1 ? BEAT * 0.58 : 0) + Math.floor(beat8 / 2) * BEAT;

for (let b = 0; b < bars; b++) {
  const t = b * BAR;
  const ch = CHORDS[b % 4];
  const last = b === bars - 1;
  const drums = b >= 2 && !last;
  pad(t, ch.notes.map((m) => m - 12).slice(0, 3), BAR + 0.6);
  // аккорды: раз и «и» второй доли, лёгкий арпеджированный «страм»
  const hits = last ? [[0, 0.75, 4.5]] : [[0, 0.62, 2.4], [BEAT * 1.58, 0.42, 1.6], [BEAT * 3, 0.3, 1.2]];
  for (const [off, vel, len] of hits) ch.notes.forEach((m, i) => epiano(t + off + i * 0.012 + rnd() * 0.006, m, vel * (0.85 + rnd() * 0.25), len, -0.35 + i * 0.22));
  // мелодия: редкие высокие ноты в середине
  if (b >= 4 && b < bars - 2 && b % 2 === 0) {
    const ph = [BEAT * 0.5, BEAT * 1.5, BEAT * 2.58, BEAT * 3.5];
    ph.forEach((o, i) => { if (rnd() < 0.75) epiano(t + o, ch.scale[Math.floor(rnd() * ch.scale.length)] + 12 * (i === 3 ? 0 : 0), 0.32 + rnd() * 0.1, 1.8, 0.45); });
  }
  // бас
  if (b >= 1) {
    bass(t, ch.root, BEAT * 1.4, 1);
    if (!last) {
      bass(t + BEAT * 2.58, ch.root + 7, BEAT * 0.8, 0.75);
      bass(t + BEAT * 3.5, ch.root + (b % 4 === 3 ? 4 : 12), BEAT * 0.45, 0.6);
    }
  }
  if (drums) {
    kick(t, 0.9); kick(t + BEAT * 2.58, 0.55);
    for (const beat of [1, 3]) noiseHit(t + beat * BEAT, { len: 0.22, decay: 0.05, hp: 900, lp: 4200, gain: 0.13, pan: 0.1, send: 0.4 });
    if (b >= 4) for (let e = 0; e < 8; e++) noiseHit(t + swing(e) + rnd() * 0.004, { len: 0.14, decay: e % 2 ? 0.025 : 0.035, hp: 4500, lp: 7500, gain: (e % 2 ? 0.035 : 0.05) * (0.8 + rnd() * 0.4), pan: 0.35, send: 0.15 });
    // щётка «свип» на 2 и 4
    for (const beat of [1, 3]) noiseHit(t + beat * BEAT - 0.08, { len: 0.3, decay: 0.12, hp: 2500, lp: 7000, gain: 0.035, pan: -0.3, send: 0.3 });
  }
}

// Реверберация (Freeverb-подобная): гребенчатые + всепропускающие фильтры по каналам.
function reverb(inp, offs) {
  const out = new Float32Array(N);
  const combs = [1116, 1188, 1277, 1356, 1422, 1491].map((d) => ({ buf: new Float32Array(d + offs), i: 0, store: 0 }));
  const aps = [556, 441, 341].map((d) => ({ buf: new Float32Array(d + offs), i: 0 }));
  for (let k = 0; k < N; k++) {
    let s = 0;
    for (const c of combs) {
      const y = c.buf[c.i];
      c.store = y * 0.6 + c.store * 0.4;
      c.buf[c.i] = inp[k] * 0.12 + c.store * 0.86;
      c.i = (c.i + 1) % c.buf.length;
      s += y;
    }
    for (const a of aps) {
      const y = a.buf[a.i];
      a.buf[a.i] = s + y * 0.5;
      a.i = (a.i + 1) % a.buf.length;
      s = y - s * 0.5;
    }
    out[k] = s;
  }
  return out;
}
const rvL = reverb(sendL, 0), rvR = reverb(sendR, 23);

// Сведение: реверберация, мягкое ограничение, затухание в конце.
const out = Buffer.alloc(44 + N * 4);
let peak = 0;
const mixL = new Float32Array(N), mixR = new Float32Array(N);
for (let k = 0; k < N; k++) {
  mixL[k] = L[k] + rvL[k] * 0.9;
  mixR[k] = R[k] + rvR[k] * 0.9;
  peak = Math.max(peak, Math.abs(mixL[k]), Math.abs(mixR[k]));
}
const g = 0.8 / peak;
const fadeOut = SR * 3.5;
for (let k = 0; k < N; k++) {
  const fo = k > N - fadeOut ? (N - k) / fadeOut : 1;
  const fi = Math.min(1, k / (SR * 0.4));
  const sat = (x) => Math.tanh(x * 1.1) / Math.tanh(1.1);
  out.writeInt16LE(Math.round(sat(mixL[k] * g) * fo * fi * 32000), 44 + k * 4);
  out.writeInt16LE(Math.round(sat(mixR[k] * g) * fo * fi * 32000), 46 + k * 4);
}
out.write("RIFF", 0); out.writeUInt32LE(36 + N * 4, 4); out.write("WAVE", 8); out.write("fmt ", 12);
out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(2, 22); out.writeUInt32LE(SR, 24); out.writeUInt32LE(SR * 4, 28);
out.writeUInt16LE(4, 32); out.writeUInt16LE(16, 34); out.write("data", 36); out.writeUInt32LE(N * 4, 40);
fs.writeFileSync(process.argv[2] || "lounge.wav", out);
console.log(`ok: ${DUR} с, ${bars} тактов, ${BPM} уд/мин`);
