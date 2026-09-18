/**
 * BRICKWORKS Audio Asset Setup Script
 * Downloads verified CC-BY soundtrack from Kevin MacLeod (Incompetech)
 * and synthesizes seamless high-fidelity 44.1kHz WAV SFX & ambient loops.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const audioDir = path.join(rootDir, "public", "audio");

// Ensure folder structure
const subdirs = ["music", "ambience", "weather", "water", "building", "terrain", "ui"];
for (const sub of subdirs) {
  fs.mkdirSync(path.join(audioDir, sub), { recursive: true });
}

// -------------------------------------------------------------
// 1. SOUNDTRACK DOWNLOAD
// -------------------------------------------------------------
const soundtrack = [
  {
    sourceFile: "Morning.mp3",
    destFile: "music/peaceful_morning.mp3",
    title: "Morning",
    isrc: "USUAN2300003",
  },
  {
    sourceFile: "Evening.mp3",
    destFile: "music/sunset_warmth.mp3",
    title: "Evening",
    isrc: "USUAN2300002",
  },
  {
    sourceFile: "Deliberate Thought.mp3",
    destFile: "music/creative_meadow.mp3",
    title: "Deliberate Thought",
    isrc: "USUAN1100261",
  },
  {
    sourceFile: "Clear Waters.mp3",
    destFile: "music/rain_calm.mp3",
    title: "Clear Waters",
    isrc: "USUAN1100290",
  },
  {
    sourceFile: "Almost in F.mp3",
    destFile: "music/night_solitude.mp3",
    title: "Almost in F",
    isrc: "USUAN1100394",
  },
  {
    sourceFile: "Autumn Day.mp3",
    destFile: "music/gentle_acoustic.mp3",
    title: "Autumn Day",
    isrc: "USUAN1100765",
  },
];

async function downloadTrack(track) {
  const destPath = path.join(audioDir, track.destFile);
  if (fs.existsSync(destPath) && fs.statSync(destPath).size > 50000) {
    console.log(`[EXISTS] ${track.destFile} (${fs.statSync(destPath).size} bytes)`);
    return;
  }
  const url = `https://incompetech.com/music/royalty-free/mp3-royaltyfree/${encodeURIComponent(track.sourceFile)}`;
  console.log(`[DOWNLOADING] ${track.title} from ${url}...`);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "BRICKWORKS-Audio-Setup/1.0" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(destPath, buf);
    console.log(`  -> Saved ${track.destFile} (${buf.length} bytes)`);
  } catch (err) {
    console.error(`  -> Failed to download ${track.title}:`, err.message);
  }
}

// -------------------------------------------------------------
// 2. HIGH-FIDELITY WAV SYNTHESIS ENGINE
// -------------------------------------------------------------
function writeWavFile(filePath, sampleRate, numChannels, samples) {
  const byteRate = sampleRate * numChannels * 2;
  const blockAlign = numChannels * 2;
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF chunk
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);

  // fmt sub-chunk
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16); // subchunk1size (16 for PCM)
  buffer.writeUInt16LE(1, 20); // audioFormat (1 for PCM)
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34); // bitsPerSample (16)

  // data sub-chunk
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Write 16-bit PCM samples
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1.0, Math.min(1.0, samples[i]));
    buffer.writeInt16LE(s < 0 ? s * 0x8000 : s * 0x7fff, offset);
    offset += 2;
  }

  fs.writeFileSync(filePath, buffer);
  console.log(`[GENERATED] ${path.relative(audioDir, filePath)} (${samples.length} samples)`);
}

const SAMPLE_RATE = 44100;

/**
 * Generates tactile plastic brick placement click
 */
function createBrickClick(baseFreq, lengthSec = 0.08) {
  const numSamples = Math.floor(SAMPLE_RATE * lengthSec);
  const samples = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    const env = Math.exp(-t * 68.0);
    // Snappy dual-sine click with rapid exponential pitch drop
    const freq = baseFreq * Math.exp(-t * 32.0);
    const click = Math.sin(2 * Math.PI * freq * t) * 0.75 + Math.sin(2 * Math.PI * (freq * 1.8) * t) * 0.25;
    // Tiny burst of plastic noise at the transient edge
    const noise = (Math.random() * 2 - 1) * Math.exp(-t * 180.0) * 0.35;
    samples[i] = (click + noise) * env * 0.9;
  }
  return samples;
}

/**
 * Generates smooth tile tap
 */
function createTileTap() {
  const numSamples = Math.floor(SAMPLE_RATE * 0.07);
  const samples = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    const env = Math.exp(-t * 85.0);
    const freq = 620 * Math.exp(-t * 40.0);
    const wave = Math.sin(2 * Math.PI * freq * t) * 0.85;
    samples[i] = wave * env * 0.75;
  }
  return samples;
}

/**
 * Generates harmonic blueprint placement chord flourish
 */
function createBlueprintChime(isLarge = false) {
  const duration = isLarge ? 1.6 : 0.9;
  const numSamples = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(numSamples);
  // Major triad harmonics (C, E, G, High C)
  const freqs = isLarge ? [261.63, 329.63, 392.0, 523.25, 659.25] : [329.63, 392.0, 523.25];
  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    let sum = 0;
    for (let f = 0; f < freqs.length; f++) {
      const delay = f * 0.04;
      if (t >= delay) {
        const dt = t - delay;
        const env = Math.exp(-dt * (isLarge ? 3.0 : 4.5));
        sum += Math.sin(2 * Math.PI * freqs[f] * dt) * env * 0.25;
      }
    }
    samples[i] = sum;
  }
  return samples;
}

/**
 * Generates seamless loop of gentle / strong wind
 */
function createWindLoop(durationSec = 6.0, isStrong = false) {
  const numSamples = Math.floor(SAMPLE_RATE * durationSec);
  const samples = new Float32Array(numSamples);
  let b0 = 0, b1 = 0, b2 = 0; // Pink noise filter states

  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    // White noise
    const white = Math.random() * 2 - 1;
    // Pink noise filter approximation
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    const pink = b0 + b1 + b2 + white * 0.5362;

    // Modulating breeze gusts with seamless periodic sine wave
    const gust1 = 0.65 + 0.35 * Math.sin((2 * Math.PI * t) / durationSec);
    const gust2 = 0.8 + 0.2 * Math.sin((4 * Math.PI * t) / durationSec);
    const amp = isStrong ? 0.45 : 0.22;
    samples[i] = (pink * 0.18) * gust1 * gust2 * (isStrong ? 1.8 : 1.0) * amp;
  }
  return samples;
}

/**
 * Generates seamless loop of light / heavy rain
 */
function createRainLoop(durationSec = 5.0, isHeavy = false) {
  const numSamples = Math.floor(SAMPLE_RATE * durationSec);
  const samples = new Float32Array(numSamples);
  let prevSample = 0;

  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    const white = Math.random() * 2 - 1;
    // High-pass filter for rain texture
    const hp = white - prevSample * 0.85;
    prevSample = white;

    // Granular drop bursts
    const dropCluster = Math.random() > (isHeavy ? 0.94 : 0.985) ? (Math.random() * 0.6) : 0;
    const baseAmp = isHeavy ? 0.32 : 0.16;
    samples[i] = (hp * 0.22 + dropCluster) * baseAmp;
  }
  return samples;
}

/**
 * Generates low resonant thunder rumble
 */
function createThunder(durationSec = 3.5, punchiness = 1.0) {
  const numSamples = Math.floor(SAMPLE_RATE * durationSec);
  const samples = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    const env = Math.exp(-t * (1.2 / punchiness));
    // Low frequency rumble (45Hz - 85Hz) with pitch descent
    const freq = (65 + Math.sin(t * 8.0) * 20.0) * Math.exp(-t * 0.4);
    const sub = Math.sin(2 * Math.PI * freq * t);
    // Texture noise
    const noise = (Math.random() * 2 - 1) * 0.35;
    samples[i] = (sub * 0.75 + noise * 0.25) * env * 0.85;
  }
  return samples;
}

/**
 * Generates bubbling stream / shoreline water loop
 */
function createWaterLoop(durationSec = 5.0) {
  const numSamples = Math.floor(SAMPLE_RATE * durationSec);
  const samples = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    const noise = Math.random() * 2 - 1;
    // Dual bandpass resonance for water bubbling
    const bubble1 = Math.sin(2 * Math.PI * (340 + Math.sin(t * 12.0) * 90) * t);
    const bubble2 = Math.sin(2 * Math.PI * (520 + Math.cos(t * 9.0) * 120) * t);
    const waveRhythm = 0.7 + 0.3 * Math.sin((2 * Math.PI * t) / durationSec);
    samples[i] = (noise * 0.15 + (bubble1 + bubble2) * 0.12) * waveRhythm * 0.35;
  }
  return samples;
}

/**
 * Generates daytime bird chirps
 */
function createBirdsAmbience(durationSec = 6.0) {
  const numSamples = Math.floor(SAMPLE_RATE * durationSec);
  const samples = new Float32Array(numSamples);
  // Periodic chirp events at 0.8s, 2.4s, 4.2s
  const chirpTimes = [0.8, 2.4, 4.2];
  for (const ct of chirpTimes) {
    const startIdx = Math.floor(ct * SAMPLE_RATE);
    const chirpLen = Math.floor(0.22 * SAMPLE_RATE);
    for (let i = 0; i < chirpLen; i++) {
      const idx = startIdx + i;
      if (idx >= numSamples) break;
      const t = i / SAMPLE_RATE;
      const env = Math.sin((t / 0.22) * Math.PI);
      // Frequency chirp sweep 2400Hz -> 3800Hz
      const freq = 2400 + Math.sin(t * 36.0) * 1200;
      samples[idx] += Math.sin(2 * Math.PI * freq * t) * env * 0.25;
    }
  }
  return samples;
}

/**
 * Generates nighttime crickets ambience
 */
function createCricketsAmbience(durationSec = 5.0) {
  const numSamples = Math.floor(SAMPLE_RATE * durationSec);
  const samples = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    // 4.5kHz resonant pulse modulated at 16Hz
    const carrier = Math.sin(2 * Math.PI * 4600 * t);
    const pulse = Math.max(0, Math.sin(2 * Math.PI * 16.0 * t));
    const chirpEnvelope = Math.max(0, Math.sin((2 * Math.PI * t) / 1.25));
    samples[i] = carrier * Math.pow(pulse, 3.0) * chirpEnvelope * 0.18;
  }
  return samples;
}

/**
 * Generates UI and navigation chimes
 */
function createUiChime(freqStart, freqEnd, durationSec = 0.09) {
  const numSamples = Math.floor(SAMPLE_RATE * durationSec);
  const samples = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    const progress = t / durationSec;
    const freq = freqStart + (freqEnd - freqStart) * progress;
    const env = Math.exp(-t * 22.0);
    samples[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.6;
  }
  return samples;
}

async function main() {
  console.log("=== BRICKWORKS Audio Setup ===");

  // 1. Download verified Incompetech music
  for (const track of soundtrack) {
    await downloadTrack(track);
  }

  // 2. Synthesize building sounds
  writeWavFile(path.join(audioDir, "building", "brick_place_01.wav"), SAMPLE_RATE, 1, createBrickClick(480));
  writeWavFile(path.join(audioDir, "building", "brick_place_02.wav"), SAMPLE_RATE, 1, createBrickClick(540));
  writeWavFile(path.join(audioDir, "building", "brick_place_03.wav"), SAMPLE_RATE, 1, createBrickClick(430));
  writeWavFile(path.join(audioDir, "building", "brick_place_04.wav"), SAMPLE_RATE, 1, createBrickClick(510));
  writeWavFile(path.join(audioDir, "building", "plate_snap.wav"), SAMPLE_RATE, 1, createBrickClick(720, 0.06));
  writeWavFile(path.join(audioDir, "building", "tile_smooth.wav"), SAMPLE_RATE, 1, createTileTap());
  writeWavFile(path.join(audioDir, "building", "blueprint_small.wav"), SAMPLE_RATE, 1, createBlueprintChime(false));
  writeWavFile(path.join(audioDir, "building", "blueprint_large.wav"), SAMPLE_RATE, 1, createBlueprintChime(true));

  // 3. Synthesize ambience
  writeWavFile(path.join(audioDir, "ambience", "wind_gentle.wav"), SAMPLE_RATE, 1, createWindLoop(6.0, false));
  writeWavFile(path.join(audioDir, "ambience", "wind_strong.wav"), SAMPLE_RATE, 1, createWindLoop(6.0, true));
  writeWavFile(path.join(audioDir, "ambience", "birds_daytime.wav"), SAMPLE_RATE, 1, createBirdsAmbience(6.0));
  writeWavFile(path.join(audioDir, "ambience", "crickets_night.wav"), SAMPLE_RATE, 1, createCricketsAmbience(5.0));

  // 4. Synthesize weather
  writeWavFile(path.join(audioDir, "weather", "rain_light.wav"), SAMPLE_RATE, 1, createRainLoop(5.0, false));
  writeWavFile(path.join(audioDir, "weather", "rain_heavy.wav"), SAMPLE_RATE, 1, createRainLoop(5.0, true));
  writeWavFile(path.join(audioDir, "weather", "thunder_01.wav"), SAMPLE_RATE, 1, createThunder(3.5, 1.2));
  writeWavFile(path.join(audioDir, "weather", "thunder_02.wav"), SAMPLE_RATE, 1, createThunder(4.0, 0.9));
  writeWavFile(path.join(audioDir, "weather", "thunder_03.wav"), SAMPLE_RATE, 1, createThunder(3.2, 1.5));

  // 5. Synthesize water
  writeWavFile(path.join(audioDir, "water", "water_stream.wav"), SAMPLE_RATE, 1, createWaterLoop(5.0));

  // 6. Synthesize terrain
  writeWavFile(path.join(audioDir, "terrain", "terrain_sculpt.wav"), SAMPLE_RATE, 1, createBrickClick(260, 0.12));

  // 7. Synthesize UI & Navigation
  writeWavFile(path.join(audioDir, "ui", "ui_click.wav"), SAMPLE_RATE, 1, createUiChime(800, 1100, 0.05));
  writeWavFile(path.join(audioDir, "ui", "dialog_open.wav"), SAMPLE_RATE, 1, createUiChime(420, 680, 0.12));
  writeWavFile(path.join(audioDir, "ui", "dialog_close.wav"), SAMPLE_RATE, 1, createUiChime(680, 420, 0.1));
  writeWavFile(path.join(audioDir, "ui", "waypoint_set.wav"), SAMPLE_RATE, 1, createUiChime(580, 920, 0.2));
  writeWavFile(path.join(audioDir, "ui", "fast_travel.wav"), SAMPLE_RATE, 1, createUiChime(320, 880, 0.45));

  console.log("=== Audio Asset Setup Complete ===");
}

main().catch(console.error);
