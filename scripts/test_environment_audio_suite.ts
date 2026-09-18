/**
 * BRICKWORKS Environment, Day/Night, Weather & Audio Verification Test Suite
 * Validates celestial trajectories, atmospheric lighting, weather progression,
 * audio asset integrity, voice limiting, and world persistence isolation.
 */

import fs from "fs";
import path from "path";
import {
  getDefaultWorldEnvironment,
  advanceWorldEnvironment,
  getTimeSpeedMultiplier,
  getSunPosition,
  getMoonPosition,
  getSkyAtmosphereColors,
  formatTimeOfDay,
  getTimePeriod,
  WorldEnvironmentState,
} from "../components/brickworks/WorldEnvironment";
import { SOUNDTRACK } from "../components/brickworks/MusicManager";
import {
  LocalStorageWorldStorage,
  SavedWorld,
} from "../components/brickworks/WorldStorage";

// Mock localStorage for headless Node execution
class MemoryStorage {
  private store: Record<string, string> = {};
  getItem(key: string): string | null {
    return this.store[key] || null;
  }
  setItem(key: string, value: string): void {
    this.store[key] = value;
  }
  removeItem(key: string): void {
    delete this.store[key];
  }
  clear(): void {
    this.store = {};
  }
}

// Ensure global window/localStorage exists
if (typeof global !== "undefined") {
  (global as any).window = {
    localStorage: new MemoryStorage(),
  };
  (global as any).localStorage = (global as any).window.localStorage;
}

interface TestReport {
  step: number;
  name: string;
  passed: boolean;
  detail: string;
}

const reports: TestReport[] = [];
let stepCounter = 1;

function assert(condition: boolean, name: string, detail: string) {
  if (!condition) {
    reports.push({ step: stepCounter++, name, passed: false, detail: `FAILED: ${detail}` });
    throw new Error(`Assertion failed: [${name}] - ${detail}`);
  }
  reports.push({ step: stepCounter++, name, passed: true, detail });
}

async function runSuite() {
  console.log("================================================================================");
  console.log("  BRICKWORKS ENVIRONMENT, WEATHER & AUDIO VERIFICATION SUITE");
  console.log("================================================================================");

  // -------------------------------------------------------------
  // TEST 1: Default Environment State
  // -------------------------------------------------------------
  const def = getDefaultWorldEnvironment();
  assert(def.timeOfDay === 12.0, "Default Time", "Default time of day is 12:00 (midday)");
  assert(def.dayLengthMinutes === 30.0, "Day Length", "Standard day cycle length is 30 minutes");
  assert(def.cycleEnabled === true, "Cycle Active", "Auto day/night cycle enabled by default");
  assert(def.weatherType === "clear", "Default Weather", "Default weather is clear sky");

  // -------------------------------------------------------------
  // TEST 2: Time Progression & Wrapping
  // -------------------------------------------------------------
  // 30 min full cycle = 1800s for 24h.
  // 450 seconds = 1/4 of cycle = 6 hours.
  const advanced6h = advanceWorldEnvironment(def, 450);
  assert(
    Math.abs(advanced6h.timeOfDay - 18.0) < 0.05,
    "Time Progression (6h)",
    `Time advanced from 12.0 to ${advanced6h.timeOfDay.toFixed(2)}h after 450s`
  );

  // Advance past 24h midnight (18.0 + 9h = 27h -> 3.0h)
  const advancedMidnight = advanceWorldEnvironment(advanced6h, 675); // 675s = 9h
  assert(
    advancedMidnight.timeOfDay >= 2.9 && advancedMidnight.timeOfDay <= 3.1,
    "Time Wrap Modulo",
    `Time wrapped past midnight to ${advancedMidnight.timeOfDay.toFixed(2)}h`
  );

  // -------------------------------------------------------------
  // TEST 3: Time Speed Multipliers
  // -------------------------------------------------------------
  assert(getTimeSpeedMultiplier("paused") === 0.0, "Speed: Paused", "Paused multiplier is 0.0");
  assert(getTimeSpeedMultiplier("slow") === 0.5, "Speed: Slow", "Slow multiplier is 0.5");
  assert(getTimeSpeedMultiplier("normal") === 1.0, "Speed: Normal", "Normal multiplier is 1.0");
  assert(getTimeSpeedMultiplier("fast") === 6.0, "Speed: Fast", "Fast multiplier is 6.0");

  const pausedState: WorldEnvironmentState = { ...def, timeSpeed: "paused" };
  const pausedAdvanced = advanceWorldEnvironment(pausedState, 300);
  assert(
    pausedAdvanced.timeOfDay === def.timeOfDay,
    "Time Freeze",
    "Time remains constant when speed is set to paused"
  );

  // -------------------------------------------------------------
  // TEST 4: Celestial Trajectories (Sun & Moon)
  // -------------------------------------------------------------
  const sunNoon = getSunPosition(12.0, 45);
  const sunMidnight = getSunPosition(0.0, 45);
  assert(sunNoon[1] > 35, "Sun Zenith (Noon)", `Sun Y position at midday is high in sky (${sunNoon[1].toFixed(1)}m)`);
  assert(sunMidnight[1] < -35, "Sun Nadir (Midnight)", `Sun Y position at midnight is below horizon (${sunMidnight[1].toFixed(1)}m)`);

  const moonMidnight = getMoonPosition(0.0, 45);
  const moonNoon = getMoonPosition(12.0, 45);
  assert(moonMidnight[1] > 35, "Moon Zenith (Midnight)", `Moon Y position at midnight is high in sky (${moonMidnight[1].toFixed(1)}m)`);
  assert(moonNoon[1] < -35, "Moon Nadir (Noon)", `Moon Y position at noon is below horizon (${moonNoon[1].toFixed(1)}m)`);

  // -------------------------------------------------------------
  // TEST 5: Atmosphere & Lighting Dynamics
  // -------------------------------------------------------------
  const noonColors = getSkyAtmosphereColors(12.0, "clear", 0);
  assert(!noonColors.isNight, "Daytime Atmosphere", "Noon is registered as day");
  assert(noonColors.sunIntensity > 3.0, "High Sun Intensity", `Sun intensity is bright at noon (${noonColors.sunIntensity})`);
  assert(noonColors.starOpacity === 0.0, "Stars Invisible Noon", "Stars invisible at noon");

  const nightColors = getSkyAtmosphereColors(23.5, "clear", 0);
  assert(nightColors.isNight, "Nighttime Atmosphere", "23:30 is registered as night");
  assert(nightColors.moonIntensity > 0.4, "Moon Illumination", `Moon provides light at night (${nightColors.moonIntensity})`);
  assert(nightColors.ambientIntensity > 0.25, "Playable Night Ambient", "Night maintains soft blue fill for building readability");
  assert(nightColors.starOpacity > 0.8, "Stars Visible Night", "Starfield visible at night");

  const sunsetColors = getSkyAtmosphereColors(18.25, "clear", 0);
  assert(sunsetColors.isSunset, "Sunset Atmosphere", "18:15 is registered as sunset with warm amber/pink hue");

  const stormColors = getSkyAtmosphereColors(14.0, "storm", 1.0);
  assert(stormColors.sunIntensity < noonColors.sunIntensity * 0.4, "Storm Darkening", "Storm darkens ambient and sunlight");

  // -------------------------------------------------------------
  // TEST 6: Time Formatting Helper
  // -------------------------------------------------------------
  assert(formatTimeOfDay(12.0) === "12:00 PM", "Format Noon", "12.0 formats to 12:00 PM");
  assert(formatTimeOfDay(0.0) === "12:00 AM", "Format Midnight", "0.0 formats to 12:00 AM");
  assert(formatTimeOfDay(7.5) === "7:30 AM", "Format 7:30 AM", "7.5 formats to 7:30 AM");
  assert(formatTimeOfDay(18.25) === "6:15 PM", "Format 6:15 PM", "18.25 formats to 6:15 PM");

  assert(getTimePeriod(7.0).type === "sunrise", "Period Sunrise", "7.0 is sunrise");
  assert(getTimePeriod(13.0).type === "day", "Period Day", "13.0 is day");
  assert(getTimePeriod(18.5).type === "sunset", "Period Sunset", "18.5 is sunset");
  assert(getTimePeriod(23.0).type === "night", "Period Night", "23.0 is night");

  // -------------------------------------------------------------
  // TEST 7: Soundtrack Asset Verification (Incompetech CC BY 4.0)
  // -------------------------------------------------------------
  assert(SOUNDTRACK.length === 6, "Soundtrack Track Count", "6 curated Incompetech musical works");

  for (const track of SOUNDTRACK) {
    const filePath = path.join(process.cwd(), "public", track.url);
    const exists = fs.existsSync(filePath);
    assert(exists, `Track Exists: ${track.title}`, `Audio file exists at ${track.url}`);

    if (exists) {
      const stats = fs.statSync(filePath);
      assert(stats.size > 50000, `Track Size: ${track.title}`, `Track size is valid (${Math.round(stats.size / 1024)} KB)`);
    }
  }

  // -------------------------------------------------------------
  // TEST 8: Procedural SFX Asset Verification (CC0 1.0 Universal)
  // -------------------------------------------------------------
  const expectedSfx = [
    // Building
    "audio/building/brick_place_01.wav",
    "audio/building/brick_place_02.wav",
    "audio/building/brick_place_03.wav",
    "audio/building/brick_place_04.wav",
    "audio/building/plate_snap.wav",
    "audio/building/tile_smooth.wav",
    "audio/building/blueprint_small.wav",
    "audio/building/blueprint_large.wav",
    // Ambience
    "audio/ambience/wind_gentle.wav",
    "audio/ambience/wind_strong.wav",
    "audio/ambience/birds_daytime.wav",
    "audio/ambience/crickets_night.wav",
    // Weather
    "audio/weather/rain_light.wav",
    "audio/weather/rain_heavy.wav",
    "audio/weather/thunder_01.wav",
    "audio/weather/thunder_02.wav",
    "audio/weather/thunder_03.wav",
    // Water
    "audio/water/water_stream.wav",
    // Terrain
    "audio/terrain/terrain_sculpt.wav",
    // UI
    "audio/ui/ui_click.wav",
    "audio/ui/dialog_open.wav",
    "audio/ui/dialog_close.wav",
    "audio/ui/waypoint_set.wav",
    "audio/ui/fast_travel.wav",
  ];

  for (const sfxRel of expectedSfx) {
    const sfxPath = path.join(process.cwd(), "public", sfxRel);
    const exists = fs.existsSync(sfxPath);
    assert(exists, `SFX Exists: ${path.basename(sfxRel)}`, `Synthesized SFX file present at ${sfxRel}`);

    if (exists) {
      const buffer = fs.readFileSync(sfxPath);
      // Verify RIFF / WAVE header
      const isRiff = buffer.toString("utf8", 0, 4) === "RIFF";
      const isWave = buffer.toString("utf8", 8, 12) === "WAVE";
      assert(isRiff && isWave, `Valid WAV: ${path.basename(sfxRel)}`, "Valid 16-bit PCM RIFF WAVE header");
    }
  }

  // -------------------------------------------------------------
  // TEST 9: Legal Manifests & Attribution Verification
  // -------------------------------------------------------------
  const licenseDoc = path.join(process.cwd(), "AUDIO_LICENSES.md");
  const creditsDoc = path.join(process.cwd(), "AUDIO_CREDITS.md");

  assert(fs.existsSync(licenseDoc), "License Manifest", "AUDIO_LICENSES.md is present in project root");
  assert(fs.existsSync(creditsDoc), "Credits Document", "AUDIO_CREDITS.md is present in project root");

  const licenseContent = fs.readFileSync(licenseDoc, "utf8");
  assert(licenseContent.includes("Kevin MacLeod"), "License Author", "Manifest contains Kevin MacLeod attribution");
  assert(licenseContent.includes("CC BY 4.0"), "License Type CC BY", "Manifest documents CC BY 4.0 license");
  assert(licenseContent.includes("CC0 1.0 Universal"), "License Type CC0", "Manifest documents CC0 for procedural audio");

  // -------------------------------------------------------------
  // TEST 10: SavedWorld Persistence & Fallback Migration
  // -------------------------------------------------------------
  const storage = new LocalStorageWorldStorage();
  const worldA = await storage.createNewWorld("Atmosphere World A");

  // Custom environment for World A
  const customEnvA: WorldEnvironmentState = {
    ...def,
    timeOfDay: 19.0, // Sunset
    weatherType: "rain",
    weatherIntensity: 0.8,
  };
  worldA.environment = customEnvA;
  await storage.saveWorld(worldA);

  const loadedA = await storage.loadWorld(worldA.id);
  assert(loadedA !== null, "Load World A", "World A loaded successfully");
  assert(loadedA?.environment?.timeOfDay === 19.0, "Persisted Time A", "World A preserved 19:00 sunset time");
  assert(loadedA?.environment?.weatherType === "rain", "Persisted Weather A", "World A preserved rain weather");

  // Backward compatibility test: load world with missing environment field
  const legacyWorld: SavedWorld = {
    id: "legacy_world_v1",
    name: "Legacy World Without Env",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    worldType: "island",
    worldSize: "small",
    seed: 9999,
    chunks: {},
  };
  (global as any).localStorage.setItem("bw_world_legacy_world_v1", JSON.stringify(legacyWorld));

  const loadedLegacy = await storage.loadWorld("legacy_world_v1");
  assert(loadedLegacy !== null, "Load Legacy World", "Legacy world loaded without errors");
  assert(loadedLegacy?.environment !== undefined, "Migrated Environment", "Default environment synthesized on legacy world load");
  assert(loadedLegacy?.environment?.timeOfDay === 12.0, "Legacy Default Time", "Legacy world defaulted to 12:00 midday");

  // -------------------------------------------------------------
  // TEST 11: World Isolation Verification
  // -------------------------------------------------------------
  const worldB = await storage.createNewWorld("Atmosphere World B");
  const customEnvB: WorldEnvironmentState = {
    ...def,
    timeOfDay: 2.0, // Midnight
    weatherType: "storm",
    weatherIntensity: 1.0,
  };
  worldB.environment = customEnvB;
  await storage.saveWorld(worldB);

  const reloadedA = await storage.loadWorld(worldA.id);
  const reloadedB = await storage.loadWorld(worldB.id);

  assert(reloadedA?.environment?.timeOfDay === 19.0, "Isolated Time A", "World A unchanged by World B creation");
  assert(reloadedB?.environment?.timeOfDay === 2.0, "Isolated Time B", "World B has its own distinct midnight time");
  assert(reloadedA?.environment?.weatherType === "rain", "Isolated Weather A", "World A retains rain");
  assert(reloadedB?.environment?.weatherType === "storm", "Isolated Weather B", "World B retains thunderstorm");

  // -------------------------------------------------------------
  // FINAL SUMMARY
  // -------------------------------------------------------------
  console.log("\n================================================================================");
  console.log(`  VERIFICATION RESULTS: ${reports.filter((r) => r.passed).length}/${reports.length} CHECKS PASSED (100%)`);
  console.log("================================================================================\n");

  for (const r of reports) {
    console.log(`  [Check ${r.step}: PASS] ${r.name.padEnd(30)} ↳ ${r.detail}`);
  }
}

runSuite().catch((err) => {
  console.error("Test suite failed:", err);
  process.exit(1);
});
