"use client";

import { useState, useEffect } from "react";
import {
  Sun,
  Moon,
  Sunrise,
  Sunset,
  Cloud,
  CloudRain,
  Zap,
  Volume2,
  VolumeX,
  Music,
  Wind,
  Sliders,
  Sparkles,
  RotateCcw,
  SkipForward,
  Info,
  ShieldCheck,
  Check,
  Eye,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  WorldEnvironmentState,
  WeatherType,
  TimeSpeed,
  GraphicsQuality,
  formatTimeOfDay,
  getTimePeriod,
  getDefaultWorldEnvironment,
} from "./WorldEnvironment";
import { getAudioManager, AudioSettings } from "./AudioManager";
import { getMusicManager, MusicTrack } from "./MusicManager";

export interface EnvironmentSettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  environment: WorldEnvironmentState;
  onEnvironmentChange: (updated: WorldEnvironmentState) => void;
  graphicsQuality: GraphicsQuality;
  onGraphicsQualityChange: (quality: GraphicsQuality) => void;
  reducedLightningFlash: boolean;
  onReducedLightningFlashChange: (val: boolean) => void;
}

type TabType = "atmosphere" | "sound" | "graphics";

export function EnvironmentSettingsDialog({
  isOpen,
  onClose,
  environment,
  onEnvironmentChange,
  graphicsQuality,
  onGraphicsQualityChange,
  reducedLightningFlash,
  onReducedLightningFlashChange,
}: EnvironmentSettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<TabType>("atmosphere");
  const [audioSettings, setAudioSettings] = useState<AudioSettings>(() =>
    getAudioManager().getSettings()
  );
  const [currentTrack, setCurrentTrack] = useState<MusicTrack | null>(null);
  const [showCreditsModal, setShowCreditsModal] = useState(false);

  // Sync audio state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setAudioSettings(getAudioManager().getSettings());
      setCurrentTrack(getMusicManager().getCurrentTrack());
      getAudioManager().playDialogOpen();
    }
  }, [isOpen]);

  const handleClose = () => {
    getAudioManager().playDialogClose();
    onClose();
  };

  const period = getTimePeriod(environment.timeOfDay);

  const handleTimeSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    onEnvironmentChange({
      ...environment,
      timeOfDay: val,
    });
  };

  const setTimePreset = (hours: number) => {
    getAudioManager().playUiClick();
    onEnvironmentChange({
      ...environment,
      timeOfDay: hours,
    });
  };

  const setWeatherPreset = (weather: WeatherType) => {
    getAudioManager().playUiClick();
    const intensity = weather === "clear" ? 0.0 : weather === "cloudy" ? 0.4 : weather === "rain" ? 0.75 : 1.0;
    onEnvironmentChange({
      ...environment,
      weatherType: weather,
      weatherIntensity: intensity,
    });
    getAudioManager().setWeatherState(weather, intensity);
  };

  const handleSpeedChange = (speed: TimeSpeed) => {
    getAudioManager().playUiClick();
    onEnvironmentChange({
      ...environment,
      timeSpeed: speed,
    });
  };

  const handleResetDefaults = () => {
    getAudioManager().playUiClick();
    const def = getDefaultWorldEnvironment();
    onEnvironmentChange(def);
    onGraphicsQualityChange("medium");
    onReducedLightningFlashChange(false);
  };

  // Audio Handlers
  const handleMasterVol = (v: number) => {
    getAudioManager().setMasterVolume(v);
    setAudioSettings(getAudioManager().getSettings());
  };
  const handleMusicVol = (v: number) => {
    getAudioManager().setMusicVolume(v);
    setAudioSettings(getAudioManager().getSettings());
  };
  const handleAmbientVol = (v: number) => {
    getAudioManager().setAmbientVolume(v);
    setAudioSettings(getAudioManager().getSettings());
  };
  const handleWeatherVol = (v: number) => {
    getAudioManager().setWeatherVolume(v);
    setAudioSettings(getAudioManager().getSettings());
  };
  const handleSfxVol = (v: number) => {
    getAudioManager().setSfxVolume(v);
    setAudioSettings(getAudioManager().getSettings());
  };
  const handleMuteToggle = () => {
    getAudioManager().playUiClick();
    getAudioManager().setMuted(!audioSettings.isMuted);
    setAudioSettings(getAudioManager().getSettings());
  };
  const handleSkipTrack = () => {
    getAudioManager().playUiClick();
    getMusicManager().skipTrack(environment.timeOfDay, environment.weatherType);
    setTimeout(() => {
      setCurrentTrack(getMusicManager().getCurrentTrack());
    }, 1200);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-2xl bg-slate-900/95 border-slate-700/80 text-white backdrop-blur-xl shadow-2xl p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500/20 to-sky-500/20 border border-amber-500/30 text-amber-400">
                <Sun className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                  World Atmosphere & Environment
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-400">
                  Control time of day, dynamic weather, environmental soundscapes, and graphics fidelity.
                </DialogDescription>
              </div>
            </div>
            <button
              onClick={handleResetDefaults}
              className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white transition-colors border border-slate-700"
              title="Reset environment settings to default"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Defaults
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex gap-2 mt-4 pt-2 border-t border-slate-800/80">
            <button
              onClick={() => {
                getAudioManager().playUiClick();
                setActiveTab("atmosphere");
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activeTab === "atmosphere"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <Sun className="w-3.5 h-3.5" />
              Day & Weather
            </button>
            <button
              onClick={() => {
                getAudioManager().playUiClick();
                setActiveTab("sound");
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activeTab === "sound"
                  ? "bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <Volume2 className="w-3.5 h-3.5" />
              Audio & Music
            </button>
            <button
              onClick={() => {
                getAudioManager().playUiClick();
                setActiveTab("graphics");
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activeTab === "graphics"
                  ? "bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              Graphics & Comfort
            </button>
          </div>
        </DialogHeader>

        {/* Tab Body */}
        <div className="p-6 max-h-[65vh] overflow-y-auto space-y-6">
          {/* TAB 1: ATMOSPHERE / DAY & WEATHER */}
          {activeTab === "atmosphere" && (
            <div className="space-y-6">
              {/* Time of Day Card */}
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/60 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {period.type === "sunrise" && <Sunrise className="w-4 h-4 text-orange-400" />}
                    {period.type === "day" && <Sun className="w-4 h-4 text-amber-400" />}
                    {period.type === "sunset" && <Sunset className="w-4 h-4 text-pink-400" />}
                    {period.type === "night" && <Moon className="w-4 h-4 text-sky-300" />}
                    <span className="text-sm font-semibold text-slate-200">
                      Time of Day: <span className="text-amber-300 font-mono">{formatTimeOfDay(environment.timeOfDay)}</span>
                    </span>
                  </div>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-700/80 text-slate-300 font-medium">
                    {period.label}
                  </span>
                </div>

                {/* Time Slider */}
                <div className="space-y-1">
                  <input
                    type="range"
                    min="0"
                    max="24"
                    step="0.1"
                    value={environment.timeOfDay}
                    onChange={handleTimeSliderChange}
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500 hover:accent-amber-400 transition"
                  />
                  <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                    <span>12 AM</span>
                    <span>6 AM (Dawn)</span>
                    <span>12 PM (Noon)</span>
                    <span>6 PM (Dusk)</span>
                    <span>12 AM</span>
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="grid grid-cols-4 gap-2 pt-1">
                  <button
                    onClick={() => setTimePreset(7.0)}
                    className={`py-2 px-2.5 rounded-lg text-xs font-medium flex flex-col items-center gap-1 border transition-all ${
                      Math.abs(environment.timeOfDay - 7.0) < 1.0
                        ? "bg-orange-500/20 text-orange-300 border-orange-500/40"
                        : "bg-slate-800/80 text-slate-300 border-slate-700/80 hover:bg-slate-700"
                    }`}
                  >
                    <Sunrise className="w-4 h-4 text-orange-400" />
                    Morning (7 AM)
                  </button>
                  <button
                    onClick={() => setTimePreset(12.0)}
                    className={`py-2 px-2.5 rounded-lg text-xs font-medium flex flex-col items-center gap-1 border transition-all ${
                      Math.abs(environment.timeOfDay - 12.0) < 1.0
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                        : "bg-slate-800/80 text-slate-300 border-slate-700/80 hover:bg-slate-700"
                    }`}
                  >
                    <Sun className="w-4 h-4 text-amber-400" />
                    Noon (12 PM)
                  </button>
                  <button
                    onClick={() => setTimePreset(18.25)}
                    className={`py-2 px-2.5 rounded-lg text-xs font-medium flex flex-col items-center gap-1 border transition-all ${
                      Math.abs(environment.timeOfDay - 18.25) < 1.0
                        ? "bg-pink-500/20 text-pink-300 border-pink-500/40"
                        : "bg-slate-800/80 text-slate-300 border-slate-700/80 hover:bg-slate-700"
                    }`}
                  >
                    <Sunset className="w-4 h-4 text-pink-400" />
                    Sunset (6:15 PM)
                  </button>
                  <button
                    onClick={() => setTimePreset(23.0)}
                    className={`py-2 px-2.5 rounded-lg text-xs font-medium flex flex-col items-center gap-1 border transition-all ${
                      Math.abs(environment.timeOfDay - 23.0) < 1.0 || environment.timeOfDay < 2.0
                        ? "bg-sky-500/20 text-sky-300 border-sky-500/40"
                        : "bg-slate-800/80 text-slate-300 border-slate-700/80 hover:bg-slate-700"
                    }`}
                  >
                    <Moon className="w-4 h-4 text-sky-300" />
                    Night (11 PM)
                  </button>
                </div>

                {/* Progression & Speed Controls */}
                <div className="pt-2 border-t border-slate-700/60 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={environment.cycleEnabled}
                      onChange={(e) => {
                        getAudioManager().playUiClick();
                        onEnvironmentChange({
                          ...environment,
                          cycleEnabled: e.target.checked,
                        });
                      }}
                      className="w-4 h-4 rounded text-amber-500 bg-slate-900 border-slate-600 focus:ring-amber-500 focus:ring-offset-0"
                    />
                    <span className="text-slate-200 font-medium">Auto Day/Night Cycle</span>
                  </label>

                  <div className="flex items-center gap-1">
                    <span className="text-slate-400 mr-1">Speed:</span>
                    {(["paused", "slow", "normal", "fast"] as TimeSpeed[]).map((spd) => (
                      <button
                        key={spd}
                        onClick={() => handleSpeedChange(spd)}
                        className={`px-2.5 py-1 rounded capitalize font-medium transition ${
                          environment.timeSpeed === spd
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                            : "bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700"
                        }`}
                      >
                        {spd}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Weather Card */}
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/60 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cloud className="w-4 h-4 text-sky-400" />
                    <span className="text-sm font-semibold text-slate-200">Weather & Atmosphere</span>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer select-none text-xs">
                    <input
                      type="checkbox"
                      checked={environment.dynamicWeather}
                      onChange={(e) => {
                        getAudioManager().playUiClick();
                        onEnvironmentChange({
                          ...environment,
                          dynamicWeather: e.target.checked,
                        });
                      }}
                      className="w-4 h-4 rounded text-sky-500 bg-slate-900 border-slate-600 focus:ring-sky-500 focus:ring-offset-0"
                    />
                    <span className="text-slate-300">Dynamic Shifts</span>
                  </label>
                </div>

                {/* Weather Type Buttons */}
                <div className="grid grid-cols-4 gap-2">
                  <button
                    onClick={() => setWeatherPreset("clear")}
                    className={`py-2 px-2 rounded-lg text-xs font-medium flex flex-col items-center gap-1 border transition-all ${
                      environment.weatherType === "clear"
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/40 shadow"
                        : "bg-slate-800/80 text-slate-300 border-slate-700/80 hover:bg-slate-700"
                    }`}
                  >
                    <Sun className="w-4 h-4 text-amber-400" />
                    Clear Sky
                  </button>
                  <button
                    onClick={() => setWeatherPreset("cloudy")}
                    className={`py-2 px-2 rounded-lg text-xs font-medium flex flex-col items-center gap-1 border transition-all ${
                      environment.weatherType === "cloudy"
                        ? "bg-slate-600/40 text-sky-200 border-slate-500/60 shadow"
                        : "bg-slate-800/80 text-slate-300 border-slate-700/80 hover:bg-slate-700"
                    }`}
                  >
                    <Cloud className="w-4 h-4 text-slate-300" />
                    Overcast
                  </button>
                  <button
                    onClick={() => setWeatherPreset("rain")}
                    className={`py-2 px-2 rounded-lg text-xs font-medium flex flex-col items-center gap-1 border transition-all ${
                      environment.weatherType === "rain"
                        ? "bg-blue-500/20 text-blue-300 border-blue-500/40 shadow"
                        : "bg-slate-800/80 text-slate-300 border-slate-700/80 hover:bg-slate-700"
                    }`}
                  >
                    <CloudRain className="w-4 h-4 text-blue-400" />
                    Rain
                  </button>
                  <button
                    onClick={() => setWeatherPreset("storm")}
                    className={`py-2 px-2 rounded-lg text-xs font-medium flex flex-col items-center gap-1 border transition-all ${
                      environment.weatherType === "storm"
                        ? "bg-indigo-500/25 text-indigo-200 border-indigo-500/50 shadow"
                        : "bg-slate-800/80 text-slate-300 border-slate-700/80 hover:bg-slate-700"
                    }`}
                  >
                    <Zap className="w-4 h-4 text-amber-400" />
                    Thunderstorm
                  </button>
                </div>

                {/* Weather Intensity Slider */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-300">
                    <span>Precipitation / Density</span>
                    <span className="font-mono text-slate-400">{Math.round(environment.weatherIntensity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={environment.weatherIntensity}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      onEnvironmentChange({
                        ...environment,
                        weatherIntensity: val,
                      });
                      getAudioManager().setWeatherState(environment.weatherType, val);
                    }}
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-500 hover:accent-sky-400 transition"
                  />
                </div>

                {/* Wind Strength Slider */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <Wind className="w-3.5 h-3.5 text-teal-400" /> Wind Strength
                    </span>
                    <span className="font-mono text-slate-400">{Math.round(environment.windStrength * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={environment.windStrength}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      onEnvironmentChange({
                        ...environment,
                        windStrength: val,
                      });
                      getAudioManager().setAmbienceState(
                        period.type === "night",
                        environment.weatherType === "rain" || environment.weatherType === "storm",
                        val
                      );
                    }}
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-teal-500 hover:accent-teal-400 transition"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SOUND & MUSIC */}
          {activeTab === "sound" && (
            <div className="space-y-5">
              {/* Master Volume Card */}
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {audioSettings.isMuted ? (
                      <VolumeX className="w-4 h-4 text-rose-400" />
                    ) : (
                      <Volume2 className="w-4 h-4 text-emerald-400" />
                    )}
                    <span className="text-sm font-semibold text-slate-200">Master Audio</span>
                  </div>
                  <button
                    onClick={handleMuteToggle}
                    className={`text-xs px-3 py-1 rounded-lg border font-medium transition ${
                      audioSettings.isMuted
                        ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                        : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
                    }`}
                  >
                    {audioSettings.isMuted ? "Unmute Audio" : "Mute All"}
                  </button>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-300">
                    <span>Master Volume</span>
                    <span className="font-mono text-slate-400">
                      {audioSettings.isMuted ? "0%" : `${Math.round(audioSettings.masterVolume * 100)}%`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    disabled={audioSettings.isMuted}
                    value={audioSettings.masterVolume}
                    onChange={(e) => handleMasterVol(parseFloat(e.target.value))}
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500 disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Individual Audio Channels */}
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/60 space-y-4">
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                  Channel Mixing
                </span>

                {/* Music Slider */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <Music className="w-3.5 h-3.5 text-sky-400" /> Background Music
                    </span>
                    <span className="font-mono text-slate-400">{Math.round(audioSettings.musicVolume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    disabled={audioSettings.isMuted}
                    value={audioSettings.musicVolume}
                    onChange={(e) => handleMusicVol(parseFloat(e.target.value))}
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-500 disabled:opacity-50"
                  />
                </div>

                {/* Ambience Slider */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <Wind className="w-3.5 h-3.5 text-teal-400" /> Environmental Ambience (Wind, Birds, Crickets)
                    </span>
                    <span className="font-mono text-slate-400">{Math.round(audioSettings.ambientVolume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    disabled={audioSettings.isMuted}
                    value={audioSettings.ambientVolume}
                    onChange={(e) => handleAmbientVol(parseFloat(e.target.value))}
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-teal-500 disabled:opacity-50"
                  />
                </div>

                {/* Weather Slider */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <CloudRain className="w-3.5 h-3.5 text-blue-400" /> Weather & Storms (Rain, Thunder)
                    </span>
                    <span className="font-mono text-slate-400">{Math.round(audioSettings.weatherVolume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    disabled={audioSettings.isMuted}
                    value={audioSettings.weatherVolume}
                    onChange={(e) => handleWeatherVol(parseFloat(e.target.value))}
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500 disabled:opacity-50"
                  />
                </div>

                {/* SFX Slider */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Sound Effects (Bricks, UI, Sculpt)
                    </span>
                    <span className="font-mono text-slate-400">{Math.round(audioSettings.sfxVolume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    disabled={audioSettings.isMuted}
                    value={audioSettings.sfxVolume}
                    onChange={(e) => handleSfxVol(parseFloat(e.target.value))}
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500 disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Now Playing Bar & Legal Credits */}
              <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/60 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <div className="p-2 rounded-lg bg-sky-500/20 text-sky-400 shrink-0">
                    <Music className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[11px] text-slate-400 block">Now Playing</span>
                    <span className="font-medium text-slate-200 truncate block">
                      {currentTrack ? `"${currentTrack.title}" — ${currentTrack.artist}` : "Atmospheric Silence / Interlude"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleSkipTrack}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 flex items-center gap-1 transition text-xs"
                    title="Play next track"
                  >
                    <SkipForward className="w-3.5 h-3.5" />
                    Skip Track
                  </button>
                  <button
                    onClick={() => setShowCreditsModal(true)}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 flex items-center gap-1 transition text-xs"
                    title="View Audio Licenses & Attribution"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    Credits
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: GRAPHICS & COMFORT */}
          {activeTab === "graphics" && (
            <div className="space-y-5">
              {/* Graphics Quality Preset */}
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-purple-400" />
                    <span className="text-sm font-semibold text-slate-200">Graphics Quality Preset</span>
                  </div>
                  <span className="text-xs text-slate-400 capitalize">{graphicsQuality} Fidelity</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(["low", "medium", "high"] as GraphicsQuality[]).map((q) => (
                    <button
                      key={q}
                      onClick={() => {
                        getAudioManager().playUiClick();
                        onGraphicsQualityChange(q);
                      }}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        graphicsQuality === q
                          ? "bg-purple-500/20 text-purple-200 border-purple-500/50 shadow"
                          : "bg-slate-800/80 text-slate-300 border-slate-700/80 hover:bg-slate-700"
                      }`}
                    >
                      <div className="font-semibold capitalize text-sm">{q}</div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        {q === "low" && "No dynamic shadows, 900 rain drops"}
                        {q === "medium" && "2K shadows, 1800 rain drops"}
                        {q === "high" && "2K expanded shadows, 3200 rain drops"}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Accessibility & Visual Comfort */}
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/60 space-y-4">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-amber-400" />
                  <span className="text-sm font-semibold text-slate-200">Accessibility & Visual Comfort</span>
                </div>

                <label className="flex items-start gap-3 p-3 rounded-lg bg-slate-900/50 border border-slate-700/50 cursor-pointer hover:bg-slate-900/80 transition">
                  <input
                    type="checkbox"
                    checked={reducedLightningFlash}
                    onChange={(e) => {
                      getAudioManager().playUiClick();
                      onReducedLightningFlashChange(e.target.checked);
                    }}
                    className="w-4 h-4 mt-0.5 rounded text-amber-500 bg-slate-900 border-slate-600 focus:ring-amber-500 focus:ring-offset-0"
                  />
                  <div>
                    <span className="text-xs font-medium text-slate-200 block">
                      Reduced Lightning Flash (Photosensitivity Protection)
                    </span>
                    <span className="text-[11px] text-slate-400 mt-0.5 block">
                      Suppresses bright full-screen lighting spikes during thunderstorms while preserving ambient thunder audio.
                    </span>
                  </div>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-900/80 border-t border-slate-800 flex justify-end">
          <button
            onClick={handleClose}
            className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs shadow transition-colors"
          >
            Done
          </button>
        </div>

        {/* Nested Audio Credits Modal */}
        {showCreditsModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="max-w-lg w-full bg-slate-900 border border-slate-700 rounded-2xl p-6 text-white space-y-4 shadow-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                  <ShieldCheck className="w-5 h-5" />
                  <span>BRICKWORKS Audio Credits & Licensing</span>
                </div>
                <button
                  onClick={() => setShowCreditsModal(false)}
                  className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded bg-slate-800"
                >
                  Close
                </button>
              </div>

              <div className="text-xs text-slate-300 space-y-3 max-h-72 overflow-y-auto pr-1">
                <div>
                  <h4 className="font-bold text-slate-100">Original Compositions</h4>
                  <p className="text-slate-400 mt-0.5">
                    Music composed by <strong className="text-slate-200">Kevin MacLeod</strong> (incompetech.com), licensed under Creative Commons: By Attribution 4.0 International (CC BY 4.0).
                  </p>
                  <ul className="list-disc pl-5 mt-1.5 space-y-0.5 text-slate-400">
                    <li>&quot;Morning&quot; (USUAN2300003)</li>
                    <li>&quot;Evening&quot; (USUAN2300002)</li>
                    <li>&quot;Deliberate Thought&quot; (USUAN1100261)</li>
                    <li>&quot;Clear Waters&quot; (USUAN1100290)</li>
                    <li>&quot;Almost in F&quot; (USUAN1100394)</li>
                    <li>&quot;Autumn Day&quot; (USUAN1100765)</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-bold text-slate-100">Environmental & Sound Design</h4>
                  <p className="text-slate-400 mt-0.5">
                    Procedurally synthesized environmental audio beds (wind, birds, crickets, precipitation, thunder), water proximity, brick clicks, blueprint chimes, and UI sounds created by the BRICKWORKS Core Engineering Team under <strong>Creative Commons CC0 1.0 Universal (Public Domain)</strong>.
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end">
                <button
                  onClick={() => setShowCreditsModal(false)}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition"
                >
                  Close Credits
                </button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
