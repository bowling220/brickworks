"use client";

import { BrickTypeId, BRICK_CATALOG } from "./BrickCatalog";
import { WeatherType } from "./WorldEnvironment";

const clamp = (v: number) => Math.max(0, Math.min(1, v));

export interface AudioSettings {
  masterVolume: number; // 0.0 to 1.0 (default 0.8)
  musicVolume: number; // 0.0 to 1.0 (default 0.22)
  ambientVolume: number; // 0.0 to 1.0 (default 0.5)
  weatherVolume: number; // 0.0 to 1.0 (default 0.55)
  sfxVolume: number; // 0.0 to 1.0 (default 0.6)
  isMuted: boolean; // default false
}

const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  masterVolume: 0.8,
  musicVolume: 0.22,
  ambientVolume: 0.5,
  weatherVolume: 0.55,
  sfxVolume: 0.6,
  isMuted: false,
};

const STORAGE_KEY = "bw_audio_settings_v1";

/**
 * Authoritative Centralized Audio Manager for BRICKWORKS
 * Manages Web Audio context, gain routing hierarchy, looping ambient beds,
 * spatial water audio, sound effects, voice limiting, and tab visibility handling.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private isUnlocked = false;

  // Channel Gain Nodes
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private weatherGain: GainNode | null = null;
  private buildGain: GainNode | null = null;
  private terrainGain: GainNode | null = null;
  private uiGain: GainNode | null = null;
  private navigationGain: GainNode | null = null;
  private waterGain: GainNode | null = null;

  // Loop Source Nodes & Individual Sub-Gain Nodes
  private windGentleGain: GainNode | null = null;
  private windStrongGain: GainNode | null = null;
  private birdsGain: GainNode | null = null;
  private cricketsGain: GainNode | null = null;
  private rainLightGain: GainNode | null = null;
  private rainHeavyGain: GainNode | null = null;

  // Cached Decoded Audio Buffers
  private bufferCache = new Map<string, AudioBuffer>();

  // Settings State
  private settings: AudioSettings = { ...DEFAULT_AUDIO_SETTINGS };

  // Voice Limiter State
  private activePlacementVoices = 0;
  private lastPlacementTime = 0;

  // Singleton Instance
  private static instance: AudioManager | null = null;

  public static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  private constructor() {
    if (typeof window !== "undefined") {
      this.loadSettings();
      this.setupAutoplayUnlock();
      this.setupVisibilityListener();
    }
  }

  /**
   * Initializes or lazily unlocks AudioContext on first user interaction
   */
  public initContext(): AudioContext | null {
    if (typeof window === "undefined") return null;

    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;

      this.ctx = new AudioCtx();
      this.buildGainHierarchy();
      this.startAmbientLoops();
    }

    if (this.ctx.state === "suspended") {
      this.ctx.resume().then(() => {
        this.isUnlocked = true;
      }).catch(() => {});
    } else {
      this.isUnlocked = true;
    }

    return this.ctx;
  }

  public getContext(): AudioContext | null {
    return this.ctx;
  }

  public getMusicGainNode(): GainNode | null {
    this.initContext();
    return this.musicGain;
  }

  private buildGainHierarchy() {
    if (!this.ctx) return;

    // Master
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(
      this.settings.isMuted ? 0.0 : this.settings.masterVolume,
      this.ctx.currentTime
    );
    this.masterGain.connect(this.ctx.destination);

    // Channel Gain Nodes
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.setValueAtTime(this.settings.musicVolume, this.ctx.currentTime);
    this.musicGain.connect(this.masterGain);

    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.setValueAtTime(this.settings.ambientVolume, this.ctx.currentTime);
    this.ambientGain.connect(this.masterGain);

    this.weatherGain = this.ctx.createGain();
    this.weatherGain.gain.setValueAtTime(this.settings.weatherVolume, this.ctx.currentTime);
    this.weatherGain.connect(this.masterGain);

    this.buildGain = this.ctx.createGain();
    this.buildGain.gain.setValueAtTime(this.settings.sfxVolume, this.ctx.currentTime);
    this.buildGain.connect(this.masterGain);

    this.terrainGain = this.ctx.createGain();
    this.terrainGain.gain.setValueAtTime(this.settings.sfxVolume * 0.7, this.ctx.currentTime);
    this.terrainGain.connect(this.masterGain);

    this.uiGain = this.ctx.createGain();
    this.uiGain.gain.setValueAtTime(this.settings.sfxVolume * 0.85, this.ctx.currentTime);
    this.uiGain.connect(this.masterGain);

    this.navigationGain = this.ctx.createGain();
    this.navigationGain.gain.setValueAtTime(this.settings.sfxVolume * 0.85, this.ctx.currentTime);
    this.navigationGain.connect(this.masterGain);

    this.waterGain = this.ctx.createGain();
    this.waterGain.gain.setValueAtTime(0.0, this.ctx.currentTime);
    this.waterGain.connect(this.ambientGain);

    // Ambient Sub-Gains (All initialize muted until player enters in-game world)
    this.windGentleGain = this.ctx.createGain();
    this.windGentleGain.gain.setValueAtTime(0.0, this.ctx.currentTime);
    this.windGentleGain.connect(this.ambientGain);

    this.windStrongGain = this.ctx.createGain();
    this.windStrongGain.gain.setValueAtTime(0.0, this.ctx.currentTime);
    this.windStrongGain.connect(this.ambientGain);

    this.birdsGain = this.ctx.createGain();
    this.birdsGain.gain.setValueAtTime(0.0, this.ctx.currentTime);
    this.birdsGain.connect(this.ambientGain);

    this.cricketsGain = this.ctx.createGain();
    this.cricketsGain.gain.setValueAtTime(0.0, this.ctx.currentTime);
    this.cricketsGain.connect(this.ambientGain);

    // Weather Sub-Gains
    this.rainLightGain = this.ctx.createGain();
    this.rainLightGain.gain.setValueAtTime(0.0, this.ctx.currentTime);
    this.rainLightGain.connect(this.weatherGain);

    this.rainHeavyGain = this.ctx.createGain();
    this.rainHeavyGain.gain.setValueAtTime(0.0, this.ctx.currentTime);
    this.rainHeavyGain.connect(this.weatherGain);
  }

  /**
   * Starts background seamless loop beds
   */
  private async startAmbientLoops() {
    if (!this.ctx) return;

    this.startLoop("/audio/ambience/wind_gentle.wav", this.windGentleGain);
    this.startLoop("/audio/ambience/wind_strong.wav", this.windStrongGain);
    this.startLoop("/audio/ambience/birds_daytime.wav", this.birdsGain);
    this.startLoop("/audio/ambience/crickets_night.wav", this.cricketsGain);
    this.startLoop("/audio/weather/rain_light.wav", this.rainLightGain);
    this.startLoop("/audio/weather/rain_heavy.wav", this.rainHeavyGain);
    this.startLoop("/audio/water/water_stream.wav", this.waterGain);
  }

  private async startLoop(url: string, targetGain: GainNode | null) {
    if (!this.ctx || !targetGain) return;
    try {
      const buffer = await this.loadAudioBuffer(url);
      if (!buffer || !this.ctx) return;

      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(targetGain);
      source.start(0);
    } catch {
      // Loop fallback
    }
  }

  /**
   * Fetches and caches decoded AudioBuffer from URL
   */
  public async loadAudioBuffer(url: string): Promise<AudioBuffer | null> {
    if (this.bufferCache.has(url)) {
      return this.bufferCache.get(url)!;
    }
    if (!this.ctx) return null;

    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const arrayBuf = await res.arrayBuffer();
      const decoded = await this.ctx.decodeAudioData(arrayBuf);
      this.bufferCache.set(url, decoded);
      return decoded;
    } catch {
      return null;
    }
  }

  // -------------------------------------------------------------
  // AMBIENT & WEATHER DYNAMICS
  // -------------------------------------------------------------

  /**
   * Silences all world ambient and weather loops when in the main menu,
   * ensuring only the menu soundtrack and UI clicks are audible.
   */
  public setInMenuMode(inMenu: boolean) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (inMenu) {
      this.birdsGain?.gain.setValueAtTime(0.0, now);
      this.cricketsGain?.gain.setValueAtTime(0.0, now);
      this.windGentleGain?.gain.setValueAtTime(0.0, now);
      this.windStrongGain?.gain.setValueAtTime(0.0, now);
      this.waterGain?.gain.setValueAtTime(0.0, now);
      this.rainLightGain?.gain.setValueAtTime(0.0, now);
      this.rainHeavyGain?.gain.setValueAtTime(0.0, now);
    }
  }

  /**
   * Updates ambient layers based on Day/Night state and wind strength
   */
  public setAmbienceState(isNight: boolean, isRain: boolean, windStrength: number) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const ramp = 2.5;

    // Daytime Birds fade at night or in rain
    if (this.birdsGain) {
      const targetBirds = !isNight && !isRain ? 0.35 : 0.0;
      this.birdsGain.gain.linearRampToValueAtTime(targetBirds, now + ramp);
    }

    // Nighttime Crickets rise at night (unless raining heavily)
    if (this.cricketsGain) {
      const targetCrickets = isNight && !isRain ? 0.25 : 0.0;
      this.cricketsGain.gain.linearRampToValueAtTime(targetCrickets, now + ramp);
    }

    // Wind blend
    if (this.windGentleGain && this.windStrongGain) {
      const strongFactor = Math.max(0, (windStrength - 0.4) / 0.6);
      this.windGentleGain.gain.linearRampToValueAtTime(0.35 * (1.0 - strongFactor * 0.5), now + ramp);
      this.windStrongGain.gain.linearRampToValueAtTime(0.45 * strongFactor, now + ramp);
    }
  }

  /**
   * Updates weather audio layers based on weather type and intensity
   */
  public setWeatherState(weatherType: WeatherType, intensity: number) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const ramp = 2.0;

    let lightRain = 0.0;
    let heavyRain = 0.0;

    if (weatherType === "rain") {
      lightRain = 0.7;
      heavyRain = Math.max(0, (intensity - 0.5) * 1.4);
    } else if (weatherType === "storm") {
      lightRain = 0.4;
      heavyRain = 0.95;
    }

    if (this.rainLightGain) {
      this.rainLightGain.gain.linearRampToValueAtTime(lightRain, now + ramp);
    }
    if (this.rainHeavyGain) {
      this.rainHeavyGain.gain.linearRampToValueAtTime(heavyRain, now + ramp);
    }
  }

  /**
   * Plays thunder sound with random variation and volume scaling
   */
  public playThunder(intensity = 1.0) {
    this.initContext();
    if (!this.ctx || !this.weatherGain) return;

    const variants = [
      "/audio/weather/thunder_01.wav",
      "/audio/weather/thunder_02.wav",
      "/audio/weather/thunder_03.wav",
    ];
    const chosen = variants[Math.floor(Math.random() * variants.length)];
    this.playOneShot(chosen, this.weatherGain, Math.min(1.0, intensity * 0.9));
  }

  /**
   * Proximity water audio: smoothly scales volume based on camera distance to nearest water
   */
  public updateWaterProximity(distanceToWater: number) {
    if (!this.ctx || !this.waterGain) return;
    // audible within 32 meters
    const maxDist = 32.0;
    const norm = Math.max(0, Math.min(1, 1.0 - distanceToWater / maxDist));
    const targetGain = Math.pow(norm, 1.8) * 0.7;

    this.waterGain.gain.linearRampToValueAtTime(targetGain, this.ctx.currentTime + 0.4);
  }

  // -------------------------------------------------------------
  // BUILDING SOUND DESIGN & VOICE LIMITING
  // -------------------------------------------------------------

  /**
   * Plays snappy plastic brick placement sound with subtle pitch variance & spam limiter
   */
  public playPlaceBrick(type: BrickTypeId) {
    this.initContext();
    if (!this.ctx || !this.buildGain) return;

    const now = performance.now();
    // 35ms cooldown to prevent spam clicks
    if (now - this.lastPlacementTime < 35) return;
    this.lastPlacementTime = now;

    // Voice limiting (max 4 concurrent placement clicks)
    if (this.activePlacementVoices >= 4) return;
    this.activePlacementVoices++;

    let file = "/audio/building/brick_place_01.wav";
    if (type.startsWith("plate") || BRICK_CATALOG[type]?.category === "plate") {
      file = "/audio/building/plate_snap.wav";
    } else if (type.startsWith("tile")) {
      file = "/audio/building/tile_smooth.wav";
    } else {
      const idx = Math.floor(Math.random() * 4) + 1;
      file = `/audio/building/brick_place_0${idx}.wav`;
    }

    // Subtle pitch variance (+-4%)
    const pitch = 0.96 + Math.random() * 0.08;
    this.playOneShot(file, this.buildGain, 0.85, pitch, () => {
      this.activePlacementVoices = Math.max(0, this.activePlacementVoices - 1);
    });
  }

  /**
   * Plays single grouped harmonic chime when stamping a blueprint (never 500 simultaneous clicks!)
   */
  public playBlueprintPlacement(brickCount: number) {
    this.initContext();
    if (!this.ctx || !this.buildGain) return;

    const file = brickCount > 50
      ? "/audio/building/blueprint_large.wav"
      : "/audio/building/blueprint_small.wav";

    this.playOneShot(file, this.buildGain, 0.95);
  }

  // -------------------------------------------------------------
  // UI & NAVIGATION SOUND DESIGN
  // -------------------------------------------------------------

  public playUiClick() {
    this.initContext();
    if (!this.ctx || !this.uiGain) return;
    this.playOneShot("/audio/ui/ui_click.wav", this.uiGain, 0.6);
  }

  public playDialogOpen() {
    this.initContext();
    if (!this.ctx || !this.uiGain) return;
    this.playOneShot("/audio/ui/dialog_open.wav", this.uiGain, 0.7);
  }

  public playDialogClose() {
    this.initContext();
    if (!this.ctx || !this.uiGain) return;
    this.playOneShot("/audio/ui/dialog_close.wav", this.uiGain, 0.65);
  }

  public playWaypointSet() {
    this.initContext();
    if (!this.ctx || !this.navigationGain) return;
    this.playOneShot("/audio/ui/waypoint_set.wav", this.navigationGain, 0.85);
  }

  public playFastTravel() {
    this.initContext();
    if (!this.ctx || !this.navigationGain) return;
    this.playOneShot("/audio/ui/fast_travel.wav", this.navigationGain, 0.95);
  }

  public playTerrainSculpt() {
    this.initContext();
    if (!this.ctx || !this.terrainGain) return;
    // Rate limit terrain brush sound
    const now = performance.now();
    if (now - this.lastPlacementTime < 90) return;
    this.lastPlacementTime = now;
    this.playOneShot("/audio/terrain/terrain_sculpt.wav", this.terrainGain, 0.45);
  }

  private async playOneShot(
    url: string,
    targetGain: GainNode,
    volume = 1.0,
    playbackRate = 1.0,
    onEnded?: () => void
  ) {
    if (!this.ctx) {
      onEnded?.();
      return;
    }
    try {
      const buffer = await this.loadAudioBuffer(url);
      if (!buffer || !this.ctx) {
        onEnded?.();
        return;
      }

      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = playbackRate;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(volume, this.ctx.currentTime);
      source.connect(gain);
      gain.connect(targetGain);

      source.onended = () => {
        onEnded?.();
        gain.disconnect();
      };

      source.start(0);
    } catch {
      onEnded?.();
    }
  }

  // -------------------------------------------------------------
  // SETTINGS PERSISTENCE & VOLUME CONTROLS
  // -------------------------------------------------------------

  public getSettings(): AudioSettings {
    return { ...this.settings };
  }

  public setMasterVolume(vol: number) {
    this.settings.masterVolume = clamp(vol);
    this.applyVolumes();
    this.saveSettings();
  }

  public setMusicVolume(vol: number) {
    this.settings.musicVolume = clamp(vol);
    this.applyVolumes();
    this.saveSettings();
  }

  public setAmbientVolume(vol: number) {
    this.settings.ambientVolume = clamp(vol);
    this.applyVolumes();
    this.saveSettings();
  }

  public setWeatherVolume(vol: number) {
    this.settings.weatherVolume = clamp(vol);
    this.applyVolumes();
    this.saveSettings();
  }

  public setSfxVolume(vol: number) {
    this.settings.sfxVolume = clamp(vol);
    this.applyVolumes();
    this.saveSettings();
  }

  public setMuted(isMuted: boolean) {
    this.settings.isMuted = isMuted;
    this.applyVolumes();
    this.saveSettings();
  }

  private applyVolumes() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const targetMaster = this.settings.isMuted ? 0.0 : this.settings.masterVolume;

    this.masterGain?.gain.linearRampToValueAtTime(targetMaster, now + 0.05);
    this.musicGain?.gain.linearRampToValueAtTime(this.settings.musicVolume, now + 0.05);
    this.ambientGain?.gain.linearRampToValueAtTime(this.settings.ambientVolume, now + 0.05);
    this.weatherGain?.gain.linearRampToValueAtTime(this.settings.weatherVolume, now + 0.05);
    this.buildGain?.gain.linearRampToValueAtTime(this.settings.sfxVolume, now + 0.05);
    this.terrainGain?.gain.linearRampToValueAtTime(this.settings.sfxVolume * 0.7, now + 0.05);
    this.uiGain?.gain.linearRampToValueAtTime(this.settings.sfxVolume * 0.85, now + 0.05);
    this.navigationGain?.gain.linearRampToValueAtTime(this.settings.sfxVolume * 0.85, now + 0.05);
  }

  private loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.settings = { ...DEFAULT_AUDIO_SETTINGS, ...JSON.parse(raw) };
      }
    } catch {
      this.settings = { ...DEFAULT_AUDIO_SETTINGS };
    }
  }

  private saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch {
      // LocalStorage fallback
    }
  }

  // -------------------------------------------------------------
  // AUTOPLAY UNLOCK & TAB VISIBILITY
  // -------------------------------------------------------------

  private setupAutoplayUnlock() {
    const unlock = () => {
      this.initContext();
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock, { passive: true });
  }

  private setupVisibilityListener() {
    document.addEventListener("visibilitychange", () => {
      if (!this.ctx || !this.masterGain) return;
      const now = this.ctx.currentTime;

      if (document.hidden) {
        // Smoothly fade out when tab is hidden
        this.masterGain.gain.linearRampToValueAtTime(0.0, now + 0.3);
      } else {
        // Smoothly restore when foregrounded
        const target = this.settings.isMuted ? 0.0 : this.settings.masterVolume;
        this.masterGain.gain.linearRampToValueAtTime(target, now + 0.5);
      }
    });
  }
}

export function getAudioManager(): AudioManager {
  return AudioManager.getInstance();
}
