"use client";

import { getAudioManager } from "./AudioManager";
import { WeatherType } from "./WorldEnvironment";

export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  url: string;
  moods: ("day" | "sunset" | "night" | "rain" | "creative")[];
  lengthFormatted: string;
}

export const SOUNDTRACK: MusicTrack[] = [
  {
    id: "peaceful_morning",
    title: "Morning",
    artist: "Kevin MacLeod",
    url: "/audio/music/peaceful_morning.mp3",
    moods: ["day", "creative"],
    lengthFormatted: "2:33",
  },
  {
    id: "sunset_warmth",
    title: "Evening",
    artist: "Kevin MacLeod",
    url: "/audio/music/sunset_warmth.mp3",
    moods: ["sunset", "night"],
    lengthFormatted: "3:06",
  },
  {
    id: "creative_meadow",
    title: "Deliberate Thought",
    artist: "Kevin MacLeod",
    url: "/audio/music/creative_meadow.mp3",
    moods: ["day", "creative"],
    lengthFormatted: "4:59",
  },
  {
    id: "rain_calm",
    title: "Clear Waters",
    artist: "Kevin MacLeod",
    url: "/audio/music/rain_calm.mp3",
    moods: ["rain", "day"],
    lengthFormatted: "3:38",
  },
  {
    id: "night_solitude",
    title: "Almost in F",
    artist: "Kevin MacLeod",
    url: "/audio/music/night_solitude.mp3",
    moods: ["night", "sunset"],
    lengthFormatted: "28:06",
  },
  {
    id: "gentle_acoustic",
    title: "Autumn Day",
    artist: "Kevin MacLeod",
    url: "/audio/music/gentle_acoustic.mp3",
    moods: ["day", "creative", "sunset"],
    lengthFormatted: "5:08",
  },
];

/**
 * Intelligent Soundtrack Manager for BRICKWORKS
 * Handles atmospheric track rotation, breathing pauses, time/weather weighting,
 * and seamless 4-second crossfades without repeating the same track consecutively.
 */
export class MusicManager {
  private currentAudio: HTMLAudioElement | null = null;
  private currentSourceNode: MediaElementAudioSourceNode | null = null;
  private currentTrack: MusicTrack | null = null;
  private lastTrackId: string | null = null;
  private pauseTimer: NodeJS.Timeout | null = null;
  private isPlaying = false;
  private trackGainNode: GainNode | null = null;

  private static instance: MusicManager | null = null;

  public static getInstance(): MusicManager {
    if (!MusicManager.instance) {
      MusicManager.instance = new MusicManager();
    }
    return MusicManager.instance;
  }

  private constructor() {
    // Singleton
  }

  private subscribers: Set<(track: MusicTrack | null, isPlaying: boolean) => void> = new Set();

  public subscribe(callback: (track: MusicTrack | null, isPlaying: boolean) => void): () => void {
    this.subscribers.add(callback);
    callback(this.currentTrack, this.isPlaying);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  private notifySubscribers() {
    this.subscribers.forEach((cb) => cb(this.currentTrack, this.isPlaying));
  }

  public getCurrentTrack(): MusicTrack | null {
    return this.currentTrack;
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  /**
   * Starts music playback with intelligent context selection
   */
  public start(timeOfDay = 12.0, weatherType: WeatherType = "clear") {
    if (this.isPlaying && this.currentAudio) return;
    this.playNextTrack(timeOfDay, weatherType);
  }

  /**
   * Starts or resumes the dedicated BRICKWORKS menu soundtrack.
   * Defaults to "Morning" by Kevin MacLeod or cycles peaceful daytime tracks.
   */
  public startMenuMusic() {
    if (this.isPlaying && this.currentAudio) return;

    // Prefer peaceful morning as the signature menu theme
    const menuTrack = SOUNDTRACK.find((t) => t.id === "peaceful_morning") || SOUNDTRACK[0];
    this.playSpecificTrack(menuTrack);
  }

  /**
   * Plays a specific music track with smooth crossfade
   */
  public playSpecificTrack(chosen: MusicTrack, fadeSec = 3.0) {
    this.stopCurrentTrack(1.0);

    this.currentTrack = chosen;
    this.lastTrackId = chosen.id;
    this.isPlaying = true;
    this.notifySubscribers();

    const audio = new Audio(chosen.url);
    audio.crossOrigin = "anonymous";
    audio.preload = "auto";
    this.currentAudio = audio;

    const audioMgr = getAudioManager();
    const ctx = audioMgr.initContext();
    const musicGain = audioMgr.getMusicGainNode();

    if (ctx && musicGain) {
      try {
        const source = ctx.createMediaElementSource(audio);
        this.currentSourceNode = source;

        const trackGain = ctx.createGain();
        this.trackGainNode = trackGain;
        trackGain.gain.setValueAtTime(0.001, ctx.currentTime);
        trackGain.gain.exponentialRampToValueAtTime(1.0, ctx.currentTime + fadeSec);

        source.connect(trackGain);
        trackGain.connect(musicGain);
      } catch {
        audio.volume = 0.5;
      }
    }

    audio.onended = () => {
      this.handleTrackEnded(12.0, "clear");
    };

    audio.onerror = () => {
      this.handleTrackEnded(12.0, "clear");
    };

    audio.play().then(() => {
      this.isPlaying = true;
      this.notifySubscribers();
    }).catch(() => {
      // Browser autoplay policy blocked audio before user interaction
      this.isPlaying = false;
      this.currentAudio = null;
      this.currentSourceNode = null;
      this.trackGainNode = null;
      this.notifySubscribers();
    });
  }

  /**
   * Selects and plays next track, respecting rotation & mood weighting
   */
  public playNextTrack(timeOfDay = 12.0, weatherType: WeatherType = "clear") {
    this.stopCurrentTrack();

    const candidates = this.filterCandidates(timeOfDay, weatherType);
    const chosen = candidates[Math.floor(Math.random() * candidates.length)] || SOUNDTRACK[0];

    this.currentTrack = chosen;
    this.lastTrackId = chosen.id;
    this.isPlaying = true;
    this.notifySubscribers();

    const audio = new Audio(chosen.url);
    audio.crossOrigin = "anonymous";
    audio.preload = "auto";
    this.currentAudio = audio;

    const audioMgr = getAudioManager();
    const ctx = audioMgr.initContext();
    const musicGain = audioMgr.getMusicGainNode();

    if (ctx && musicGain) {
      // Connect HTMLAudioElement through Web Audio GainNode for clean crossfading
      try {
        const source = ctx.createMediaElementSource(audio);
        this.currentSourceNode = source;

        const trackGain = ctx.createGain();
        this.trackGainNode = trackGain;
        trackGain.gain.setValueAtTime(0.001, ctx.currentTime);
        // Smooth 4-second fade in
        trackGain.gain.exponentialRampToValueAtTime(1.0, ctx.currentTime + 4.0);

        source.connect(trackGain);
        trackGain.connect(musicGain);
      } catch {
        // Fallback to direct element volume
        audio.volume = 0.5;
      }
    }

    audio.onended = () => {
      this.handleTrackEnded(timeOfDay, weatherType);
    };

    audio.onerror = () => {
      this.handleTrackEnded(timeOfDay, weatherType);
    };

    audio.play().then(() => {
      this.isPlaying = true;
      this.notifySubscribers();
    }).catch(() => {
      // Autoplay waiting for interaction
      this.isPlaying = false;
      this.currentAudio = null;
      this.currentSourceNode = null;
      this.trackGainNode = null;
      this.notifySubscribers();
    });
  }

  private filterCandidates(timeOfDay: number, weatherType: WeatherType): MusicTrack[] {
    let targetMood: "day" | "sunset" | "night" | "rain" | "creative" = "day";

    if (weatherType === "rain" || weatherType === "storm") {
      targetMood = "rain";
    } else if (timeOfDay >= 4.8 && timeOfDay < 17.0) {
      targetMood = "day";
    } else if (timeOfDay >= 17.0 && timeOfDay < 19.5) {
      targetMood = "sunset";
    } else {
      targetMood = "night";
    }

    // Filter by mood and exclude immediate repeat
    let filtered = SOUNDTRACK.filter((t) => t.moods.includes(targetMood) && t.id !== this.lastTrackId);

    // Fallback if no matching track
    if (filtered.length === 0) {
      filtered = SOUNDTRACK.filter((t) => t.id !== this.lastTrackId);
    }
    if (filtered.length === 0) {
      filtered = [...SOUNDTRACK];
    }

    return filtered;
  }

  /**
   * After a track completes, introduce a 35s - 75s natural breathing pause
   * before fading in the next track, allowing the environment to be heard.
   */
  private handleTrackEnded(timeOfDay: number, weatherType: WeatherType) {
    this.stopCurrentTrack();
    this.isPlaying = false;
    this.notifySubscribers();

    // Atmospheric silence interval (35s to 75s)
    const silenceSeconds = 35 + Math.random() * 40;

    if (this.pauseTimer) clearTimeout(this.pauseTimer);
    this.pauseTimer = setTimeout(() => {
      this.playNextTrack(timeOfDay, weatherType);
    }, silenceSeconds * 1000);
  }

  /**
   * Fades out and cleans up current track
   */
  public stopCurrentTrack(fadeSec = 3.0) {
    if (this.pauseTimer) {
      clearTimeout(this.pauseTimer);
      this.pauseTimer = null;
    }

    const audio = this.currentAudio;
    const trackGain = this.trackGainNode;
    const ctx = getAudioManager().getContext();

    if (audio && trackGain && ctx) {
      try {
        const now = ctx.currentTime;
        trackGain.gain.setValueAtTime(Math.max(0.001, trackGain.gain.value), now);
        trackGain.gain.exponentialRampToValueAtTime(0.001, now + fadeSec);
        setTimeout(() => {
          audio.pause();
          audio.src = "";
          trackGain.disconnect();
        }, fadeSec * 1000);
      } catch {
        audio.pause();
        audio.src = "";
      }
    } else if (audio) {
      audio.pause();
      audio.src = "";
    }

    this.currentAudio = null;
    this.currentSourceNode = null;
    this.trackGainNode = null;
    this.currentTrack = null;
    this.isPlaying = false;
    this.notifySubscribers();
  }

  public skipTrack(timeOfDay = 12.0, weatherType: WeatherType = "clear") {
    this.stopCurrentTrack(1.0);
    setTimeout(() => {
      this.playNextTrack(timeOfDay, weatherType);
    }, 1100);
  }
}

export function getMusicManager(): MusicManager {
  return MusicManager.getInstance();
}
