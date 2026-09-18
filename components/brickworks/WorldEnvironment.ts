/**
 * BRICKWORKS World Environment & Atmosphere System
 * Core data models, celestial trajectories, sky colors, and weather simulation.
 */

import * as THREE from "three";

export type WeatherType = "clear" | "cloudy" | "rain" | "storm";
export type TimeSpeed = "paused" | "slow" | "normal" | "fast";
export type GraphicsQuality = "low" | "medium" | "high";

export interface WorldEnvironmentState {
  timeOfDay: number; // 0.00 to 24.00 hours (0 = midnight, 6 = sunrise, 12 = noon, 18 = sunset)
  dayLengthMinutes: number; // Duration of a full 24h cycle in real-world minutes (default 30 min)
  cycleEnabled: boolean; // When false, time is frozen
  timeSpeed: TimeSpeed; // Speed multiplier
  weatherType: WeatherType;
  weatherIntensity: number; // 0.0 to 1.0 (transition blend, cloud cover, precipitation rate)
  dynamicWeather: boolean; // When true, weather transitions organically
  windDirection: number; // Wind angle in radians (0 to 2*PI)
  windStrength: number; // 0.0 (calm) to 1.0 (gale)
  cloudiness: number; // 0.0 (clear sky) to 1.0 (overcast)
}

export interface AtmosphereColors {
  skyColor: string;
  fogColor: string;
  sunColor: string;
  sunIntensity: number;
  moonColor: string;
  moonIntensity: number;
  ambientColor: string;
  ambientIntensity: number;
  starOpacity: number;
  isNight: boolean;
  isSunrise: boolean;
  isSunset: boolean;
}

/**
 * Returns clean default environment configuration for new worlds
 */
export function getDefaultWorldEnvironment(): WorldEnvironmentState {
  return {
    timeOfDay: 12.0, // Midday by default
    dayLengthMinutes: 30.0,
    cycleEnabled: true,
    timeSpeed: "normal",
    weatherType: "clear",
    weatherIntensity: 0.0,
    dynamicWeather: true,
    windDirection: Math.PI / 4, // 45 deg North-East breeze
    windStrength: 0.35,
    cloudiness: 0.25,
  };
}

/**
 * Converts TimeSpeed preset into time progression rate multiplier
 */
export function getTimeSpeedMultiplier(speed: TimeSpeed): number {
  switch (speed) {
    case "paused":
      return 0.0;
    case "slow":
      return 0.5; // 60 min day
    case "normal":
      return 1.0; // 30 min day
    case "fast":
      return 6.0; // 5 min day (for watching transitions & testing)
  }
}

/**
 * Calculates continuous 3D sun position on the celestial sphere.
 * Rises in the East (+X), reaches zenith at 12:00 (+Y, slightly South +Z), sets in the West (-X).
 */
export function getSunPosition(timeOfDay: number, distance = 35): [number, number, number] {
  // Normalize time so 6:00 is 0 rad, 12:00 is PI/2, 18:00 is PI, 24:00 is 3PI/2
  const angle = ((timeOfDay - 6.0) / 24.0) * Math.PI * 2;

  const x = Math.cos(angle) * distance;
  const y = Math.sin(angle) * (distance * 0.88);
  const z = Math.sin(angle * 0.5) * (distance * 0.35);

  return [x, y, z];
}

/**
 * Calculates 3D moon position approximately opposite to the sun.
 */
export function getMoonPosition(timeOfDay: number, distance = 35): [number, number, number] {
  const sunPos = getSunPosition(timeOfDay, distance);
  return [-sunPos[0], -sunPos[1], -sunPos[2]];
}

/**
 * Linear color interpolation helper between two hex colors
 */
function lerpColor(hexA: string, hexB: string, t: number): string {
  const cA = new THREE.Color(hexA);
  const cB = new THREE.Color(hexB);
  cA.lerp(cB, THREE.MathUtils.clamp(t, 0, 1));
  return `#${cA.getHexString()}`;
}

/**
 * Pure mathematical resolver for atmospheric colors, fog, and lighting intensities
 * across dawn, noon, dusk, night, and weather states.
 */
export function getSkyAtmosphereColors(
  timeOfDay: number,
  weatherType: WeatherType = "clear",
  weatherIntensity = 0.0
): AtmosphereColors {
  const t = ((timeOfDay % 24) + 24) % 24;

  let skyColor = "#5bb8ff";
  let fogColor = "#a6dcff";
  let sunColor = "#fff4dc";
  let sunIntensity = 4.6;
  let moonColor = "#95bcf7";
  let moonIntensity = 0.0;
  let ambientColor = "#e6f4ff";
  let ambientIntensity = 0.95;
  let starOpacity = 0.0;
  let isNight = false;
  let isSunrise = false;
  let isSunset = false;

  // 1. Base Day/Night & Twilight Cycles
  if (t >= 0 && t < 4.8) {
    // Deep Night
    isNight = true;
    skyColor = "#07111e";
    fogColor = "#0b192c";
    sunIntensity = 0.0;
    moonIntensity = 1.6;
    ambientColor = "#1a2c4e";
    ambientIntensity = 0.55;
    starOpacity = 1.0;
  } else if (t >= 4.8 && t < 6.5) {
    // Dawn / Sunrise (Gradient: Deep Blue -> Purple -> Pink -> Gold -> Bright Sky)
    isSunrise = true;
    const progress = (t - 4.8) / 1.7; // 0.0 to 1.0
    isNight = progress < 0.35;

    skyColor = progress < 0.5
      ? lerpColor("#07111e", "#7b3f94", progress * 2)
      : lerpColor("#7b3f94", "#5bb8ff", (progress - 0.5) * 2);

    fogColor = progress < 0.5
      ? lerpColor("#0b192c", "#ff9862", progress * 2)
      : lerpColor("#ff9862", "#a6dcff", (progress - 0.5) * 2);

    sunColor = lerpColor("#ff8544", "#fff4dc", progress);
    sunIntensity = THREE.MathUtils.lerp(0.0, 4.4, progress);
    moonIntensity = THREE.MathUtils.lerp(1.5, 0.0, progress);
    ambientColor = lerpColor("#1a2c4e", "#fef3e7", progress);
    ambientIntensity = THREE.MathUtils.lerp(0.55, 0.92, progress);
    starOpacity = Math.max(0, 1.0 - progress * 1.5);
  } else if (t >= 6.5 && t < 17.2) {
    // Crisp Daytime
    skyColor = "#5bb8ff";
    fogColor = "#a6dcff";
    sunColor = "#fff4dc";
    sunIntensity = 4.6;
    moonIntensity = 0.0;
    ambientColor = "#e6f4ff";
    ambientIntensity = 0.95;
    starOpacity = 0.0;
  } else if (t >= 17.2 && t < 19.5) {
    // Sunset / Dusk (Golden Hour -> Rich Amber -> Purple -> Deep Indigo)
    isSunset = true;
    const progress = (t - 17.2) / 2.3; // 0.0 to 1.0

    skyColor = progress < 0.5
      ? lerpColor("#5bb8ff", "#e05342", progress * 2)
      : lerpColor("#e05342", "#0c182c", (progress - 0.5) * 2);

    fogColor = progress < 0.5
      ? lerpColor("#a6dcff", "#ff8a4a", progress * 2)
      : lerpColor("#ff8a4a", "#0e2038", (progress - 0.5) * 2);

    sunColor = lerpColor("#fff4dc", "#ff6b35", progress);
    sunIntensity = THREE.MathUtils.lerp(4.4, 0.0, progress);
    moonIntensity = THREE.MathUtils.lerp(0.0, 1.6, progress);
    ambientColor = lerpColor("#e6f4ff", "#293d62", progress);
    ambientIntensity = THREE.MathUtils.lerp(0.95, 0.58, progress);
    starOpacity = Math.min(1.0, Math.max(0, (progress - 0.35) * 1.55));
  } else {
    // Late Evening to Midnight
    isNight = true;
    skyColor = "#07111e";
    fogColor = "#0b192c";
    sunIntensity = 0.0;
    moonIntensity = 1.6;
    ambientColor = "#1a2c4e";
    ambientIntensity = 0.55;
    starOpacity = 1.0;
  }

  // 2. Weather Overrides (Cloudy, Rain, Storm)
  if (weatherType === "cloudy") {
    const factor = Math.max(0.3, weatherIntensity || 0.6);
    skyColor = lerpColor(skyColor, "#6d8ba8", factor * 0.65);
    fogColor = lerpColor(fogColor, "#85a3c2", factor * 0.65);
    sunIntensity *= 1.0 - factor * 0.45;
    ambientIntensity *= 1.0 - factor * 0.2;
    starOpacity *= 1.0 - factor * 0.8;
  } else if (weatherType === "rain") {
    const factor = Math.max(0.45, weatherIntensity || 0.75);
    skyColor = lerpColor(skyColor, "#485b70", factor * 0.75);
    fogColor = lerpColor(fogColor, "#617791", factor * 0.75);
    sunIntensity *= 1.0 - factor * 0.65;
    ambientColor = lerpColor(ambientColor, "#889db5", factor * 0.5);
    ambientIntensity *= 1.0 - factor * 0.35;
    starOpacity *= 1.0 - factor;
  } else if (weatherType === "storm") {
    const factor = Math.max(0.65, weatherIntensity || 0.95);
    skyColor = lerpColor(skyColor, "#222d3b", factor * 0.85);
    fogColor = lerpColor(fogColor, "#364556", factor * 0.85);
    sunIntensity *= 1.0 - factor * 0.82;
    ambientColor = lerpColor(ambientColor, "#4e6074", factor * 0.65);
    ambientIntensity *= 1.0 - factor * 0.45;
    starOpacity = 0.0;
  }

  return {
    skyColor,
    fogColor,
    sunColor,
    sunIntensity,
    moonColor,
    moonIntensity,
    ambientColor,
    ambientIntensity,
    starOpacity,
    isNight,
    isSunrise,
    isSunset,
  };
}

/**
 * Advances environment state forward in time smoothly
 */
export function advanceWorldEnvironment(
  state: WorldEnvironmentState,
  deltaSeconds: number
): WorldEnvironmentState {
  if (!state.cycleEnabled || state.timeSpeed === "paused") {
    return state;
  }

  const speedMult = getTimeSpeedMultiplier(state.timeSpeed);
  // dayLengthMinutes minutes = 24 hours of in-game time
  // hoursPerSecond = 24 / (dayLengthMinutes * 60)
  const hoursPerSecond = 24.0 / (Math.max(1, state.dayLengthMinutes) * 60.0);
  const hourDelta = deltaSeconds * hoursPerSecond * speedMult;

  let newTime = (state.timeOfDay + hourDelta) % 24.0;
  if (newTime < 0) newTime += 24.0;

  // Gentle wind drift over time
  const windDirDelta = Math.sin(newTime * 0.5) * 0.0004 * deltaSeconds;
  const newWindDir = (state.windDirection + windDirDelta + Math.PI * 2) % (Math.PI * 2);

  return {
    ...state,
    timeOfDay: newTime,
    windDirection: newWindDir,
  };
}

/**
 * Formats fractional 24-hour time into human readable 12-hour string (e.g. "12:00 PM", "7:30 AM")
 */
export function formatTimeOfDay(hours: number): string {
  const wrapped = ((hours % 24) + 24) % 24;
  const totalMinutes = Math.floor(wrapped * 60);
  const h24 = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  const period = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const mStr = m.toString().padStart(2, "0");
  return `${h12}:${mStr} ${period}`;
}

export type TimePeriodType = "sunrise" | "day" | "sunset" | "night";

export function getTimePeriod(hours: number): { type: TimePeriodType; label: string } {
  const h = ((hours % 24) + 24) % 24;
  if (h >= 5.0 && h < 8.5) return { type: "sunrise", label: "Sunrise" };
  if (h >= 8.5 && h < 17.0) return { type: "day", label: "Day" };
  if (h >= 17.0 && h < 20.0) return { type: "sunset", label: "Sunset" };
  return { type: "night", label: "Night" };
}
