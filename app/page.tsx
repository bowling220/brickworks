"use client";

import { useState } from "react";
import { Settings, UserRound, Volume2, Music2, Sparkles } from "lucide-react";
import { SkyScene } from "@/components/brickworks/SkyScene";
import { BrickworksLogo3D } from "@/components/brickworks/BrickworksLogo3D";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";

function AccountButton() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  return (
    <button className="account-button glass-button" type="button" onClick={() => setIsLoggedIn((value) => !value)} aria-label={isLoggedIn ? "Open profile" : "Log in or sign up"}>
      <span className="icon-orb" aria-hidden="true"><UserRound size={19} strokeWidth={2.8} /></span>
      <span>{isLoggedIn ? "Profile" : "Login / Sign Up"}</span>
    </button>
  );
}

function SettingsButton() {
  const [sound, setSound] = useState(true);
  const [music, setMusic] = useState(true);
  const [effects, setEffects] = useState(true);
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="settings-button glass-button" type="button" aria-label="Open settings"><Settings size={28} strokeWidth={2.8} aria-hidden="true" /></button>
      </DialogTrigger>
      <DialogContent className="settings-panel border-white/40 bg-[#113c74]/90 text-white shadow-[0_30px_80px_rgba(0,24,65,.45)] backdrop-blur-2xl sm:max-w-[390px]">
        <DialogHeader>
          <p className="settings-kicker">Game menu</p>
          <DialogTitle className="text-3xl font-black tracking-tight">Settings</DialogTitle>
          <DialogDescription className="text-blue-100/80">Tune the world before your next build.</DialogDescription>
        </DialogHeader>
        <div className="settings-list">
          <SettingRow icon={<Volume2 />} label="Sound effects" checked={sound} onCheckedChange={setSound} />
          <SettingRow icon={<Music2 />} label="Music" checked={music} onCheckedChange={setMusic} />
          <SettingRow icon={<Sparkles />} label="Ambient motion" checked={effects} onCheckedChange={setEffects} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SettingRow({ icon, label, checked, onCheckedChange }: { icon: React.ReactNode; label: string; checked: boolean; onCheckedChange: (checked: boolean) => void }) {
  const id = `setting-${label.replaceAll(" ", "-").toLowerCase()}`;
  return (
    <div className="setting-row">
      <span className="setting-icon" aria-hidden="true">{icon}</span>
      <label htmlFor={id}>{label}</label>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} className="data-[state=checked]:bg-[#38d866] data-[state=unchecked]:bg-white/20" />
    </div>
  );
}

function PlayButton() {
  const [message, setMessage] = useState("");
  const play = () => {
    console.log("Play clicked");
    setMessage("World loading soon!");
    window.setTimeout(() => setMessage(""), 2200);
  };
  return (
    <div className="play-area">
      <button type="button" className="play-button" onClick={play}><span className="play-icon" aria-hidden="true" /><span>PLAY</span></button>
      <div className={`play-toast ${message ? "is-visible" : ""}`} role="status" aria-live="polite">{message}</div>
    </div>
  );
}

export default function HomePage() {
  return (
    <main className="home-shell">
      <SkyScene />
      <div className="sky-vignette" aria-hidden="true" />
      <header className="top-bar">
        <AccountButton />
        <div className="build-badge" aria-label="Game motto"><span>BUILD</span><i /><span>EXPLORE</span><i /><span>CREATE</span></div>
      </header>
      <section className="menu-content" aria-labelledby="brickworks-title"><BrickworksLogo3D /><PlayButton /></section>
      <div className="corner-settings"><SettingsButton /></div>
      <p className="version-label">EARLY BUILD · v0.1</p>
    </main>
  );
}
