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
  musicVolume: 0.35,
  ambientVolume: 0.0,
  weatherVolume: 0.0,
  sfxVolume: 0.0,
  isMuted: false,
};

const STORAGE_KEY = "bw_audio_settings_v1";

/**
 * Authoritative Centralized Audio Manager for BRICKWORKS
 * Configured for Music-Only mode (Lobby & Game soundtrack active, all SFX disabled).
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

    // Channel Gain Nodes: Music active, all SFX channels muted
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.setValueAtTime(this.settings.musicVolume, this.ctx.currentTime);
    this.musicGain.connect(this.masterGain);

    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.setValueAtTime(0.0, this.ctx.currentTime);
    this.ambientGain.connect(this.masterGain);

    this.weatherGain = this.ctx.createGain();
    this.weatherGain.gain.setValueAtTime(0.0, this.ctx.currentTime);
    this.weatherGain.connect(this.masterGain);

    this.buildGain = this.ctx.createGain();
    this.buildGain.gain.setValueAtTime(0.0, this.ctx.currentTime);
    this.buildGain.connect(this.masterGain);

    this.terrainGain = this.ctx.createGain();
    this.terrainGain.gain.setValueAtTime(0.0, this.ctx.currentTime);
    this.terrainGain.connect(this.masterGain);

    this.uiGain = this.ctx.createGain();
    this.uiGain.gain.setValueAtTime(0.0, this.ctx.currentTime);
    this.uiGain.connect(this.masterGain);

    this.navigationGain = this.ctx.createGain();
    this.navigationGain.gain.setValueAtTime(0.0, this.ctx.currentTime);
    this.navigationGain.connect(this.masterGain);

    this.waterGain = this.ctx.createGain();
    this.waterGain.gain.setValueAtTime(0.0, this.ctx.currentTime);
    this.waterGain.connect(this.ambientGain);

    // Ambient Sub-Gains
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
  // AMBIENT & WEATHER DYNAMICS (Disabled per user request)
  // -------------------------------------------------------------

  public setInMenuMode(_inMenu: boolean) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.birdsGain?.gain.setValueAtTime(0.0, now);
    this.cricketsGain?.gain.setValueAtTime(0.0, now);
    this.windGentleGain?.gain.setValueAtTime(0.0, now);
    this.windStrongGain?.gain.setValueAtTime(0.0, now);
    this.waterGain?.gain.setValueAtTime(0.0, now);
    this.rainLightGain?.gain.setValueAtTime(0.0, now);
    this.rainHeavyGain?.gain.setValueAtTime(0.0, now);
  }

  public setAmbienceState(_isNight: boolean, _isRain: boolean, _windStrength: number) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.birdsGain?.gain.setValueAtTime(0.0, now);
    this.cricketsGain?.gain.setValueAtTime(0.0, now);
    this.windGentleGain?.gain.setValueAtTime(0.0, now);
    this.windStrongGain?.gain.setValueAtTime(0.0, now);
  }

  public setWeatherState(_weatherType: WeatherType, _intensity: number) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.rainLightGain?.gain.setValueAtTime(0.0, now);
    this.rainHeavyGain?.gain.setValueAtTime(0.0, now);
  }

  public playThunder(_intensity = 1.0) {
    // SFX disabled per user request
  }

  public updateWaterProximity(_distanceToWater: number) {
    // SFX disabled per user request
  }

  // -------------------------------------------------------------
  // BUILDING SOUND DESIGN (Disabled per user request)
  // -------------------------------------------------------------

  public playPlaceBrick(_type: BrickTypeId) {
    // SFX disabled per user request
  }

  public playBlueprintPlacement(_brickCount: number) {
    // SFX disabled per user request
  }

  // -------------------------------------------------------------
  // UI & NAVIGATION SOUND DESIGN (Disabled per user request)
  // -------------------------------------------------------------

  public playUiClick() {
    // SFX disabled per user request
  }

  public playDialogOpen() {
    // SFX disabled per user request
  }

  public playDialogClose() {
    // SFX disabled per user request
  }

  public playWaypointSet() {
    // SFX disabled per user request
  }

  public playFastTravel() {
    // SFX disabled per user request
  }

  public playTerrainSculpt() {
    // SFX disabled per user request
  }

  private async playOneShot(
    _url: string,
    _targetGain: GainNode,
    _volume = 1.0,
    _playbackRate = 1.0,
    onEnded?: () => void
  ) {
    // SFX disabled per user request
    onEnded?.();
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
    // SFX channels always remain silent
    this.ambientGain?.gain.linearRampToValueAtTime(0.0, now + 0.05);
    this.weatherGain?.gain.linearRampToValueAtTime(0.0, now + 0.05);
    this.buildGain?.gain.linearRampToValueAtTime(0.0, now + 0.05);
    this.terrainGain?.gain.linearRampToValueAtTime(0.0, now + 0.05);
    this.uiGain?.gain.linearRampToValueAtTime(0.0, now + 0.05);
    this.navigationGain?.gain.linearRampToValueAtTime(0.0, now + 0.05);
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
