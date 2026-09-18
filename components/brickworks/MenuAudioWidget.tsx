"use client";

import React, { useState, useEffect } from "react";
import { Music2, Volume2, VolumeX, Play, Pause, SkipForward } from "lucide-react";
import { getMusicManager, MusicTrack } from "./MusicManager";
import { getAudioManager, AudioSettings } from "./AudioManager";

interface MenuAudioWidgetProps {
  className?: string;
}

export function MenuAudioWidget({ className = "" }: MenuAudioWidgetProps) {
  const [track, setTrack] = useState<MusicTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  useEffect(() => {
    const musicMgr = getMusicManager();
    const audioMgr = getAudioManager();

    setTrack(musicMgr.getCurrentTrack());
    setIsPlaying(musicMgr.getIsPlaying());
    setIsMuted(audioMgr.getSettings().isMuted);

    const unsubscribe = musicMgr.subscribe((currentTrack, playing) => {
      setTrack(currentTrack);
      setIsPlaying(playing);
      if (playing) setHasInteracted(true);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleTogglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    const audioMgr = getAudioManager();
    const musicMgr = getMusicManager();

    audioMgr.initContext();
    audioMgr.playUiClick();
    setHasInteracted(true);

    if (isPlaying) {
      musicMgr.stopCurrentTrack(1.0);
    } else {
      musicMgr.startMenuMusic();
    }
  };

  const handleToggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const audioMgr = getAudioManager();
    audioMgr.initContext();
    audioMgr.playUiClick();

    const nextMute = !isMuted;
    audioMgr.setMuted(nextMute);
    setIsMuted(nextMute);
  };

  const handleSkip = (e: React.MouseEvent) => {
    e.stopPropagation();
    const audioMgr = getAudioManager();
    const musicMgr = getMusicManager();
    audioMgr.initContext();
    audioMgr.playUiClick();
    setHasInteracted(true);
    musicMgr.skipTrack(12.0, "clear");
  };

  return (
    <aside
      className={`glass-panel flex items-center justify-between sm:justify-start gap-2.5 sm:gap-3 px-3.5 py-2 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.25)] backdrop-blur-xl transition-all duration-300 pointer-events-auto select-none w-full ${className}`}
      aria-label="Menu soundtrack player"
    >
      {/* Animated Note / Play trigger */}
      <button
        type="button"
        onClick={handleTogglePlay}
        className="relative flex items-center justify-center w-8 h-8 rounded-full bg-sky-500/20 hover:bg-sky-500/35 border border-sky-400/40 text-sky-200 transition-all cursor-pointer group shrink-0"
        title={isPlaying ? "Pause music" : "Play menu music"}
        aria-label={isPlaying ? "Pause soundtrack" : "Play soundtrack"}
      >
        {isPlaying ? (
          <Pause size={15} className="text-white fill-current transition-transform group-hover:scale-110" />
        ) : (
          <Play size={15} className="text-white fill-current ml-0.5 transition-transform group-hover:scale-110" />
        )}
      </button>

      {/* Track info & state */}
      <div
        className="flex flex-col cursor-pointer min-w-0 flex-1 max-w-[150px] sm:max-w-[190px]"
        onClick={handleTogglePlay}
        title="Click to toggle soundtrack"
      >
        <div className="flex items-center gap-1.5">
          <Music2
            size={13}
            className={`${isPlaying ? "text-emerald-400 animate-pulse" : "text-blue-200/60"}`}
          />
          <span className="text-[11px] font-bold tracking-wide uppercase text-blue-200/90 truncate">
            {isPlaying ? "Menu Soundtrack" : hasInteracted ? "Paused" : "Click For Music"}
          </span>
        </div>
        <p className="text-xs font-semibold text-white truncate drop-shadow-sm leading-tight">
          {track ? `${track.title} - ${track.artist}` : "Morning - Kevin MacLeod"}
        </p>
      </div>

      {/* Control Actions */}
      <div className="flex items-center gap-1 ml-1 border-l border-white/15 pl-2">
        <button
          type="button"
          onClick={handleSkip}
          className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition cursor-pointer"
          title="Next track"
          aria-label="Skip to next track"
        >
          <SkipForward size={14} />
        </button>

        <button
          type="button"
          onClick={handleToggleMute}
          className={`p-1.5 rounded-lg transition cursor-pointer ${
            isMuted ? "text-amber-400 bg-amber-500/20" : "text-white/80 hover:text-white hover:bg-white/10"
          }`}
          title={isMuted ? "Unmute audio" : "Mute all audio"}
          aria-label={isMuted ? "Unmute audio" : "Mute audio"}
        >
          {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
        </button>
      </div>
    </aside>
  );
}
