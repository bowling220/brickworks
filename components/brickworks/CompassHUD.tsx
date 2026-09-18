"use client";

import { useState, useEffect, useMemo } from "react";
import { Navigation } from "lucide-react";
import { subscribePlayerMovement, getPlayerMovementState } from "./PlayerState";

interface CompassHUDProps {
  yaw?: number; // radians
  position?: [number, number, number];
  visible?: boolean;
}

export function CompassHUD({ yaw: propYaw, position: propPos, visible = true }: CompassHUDProps) {
  const [internalState, setInternalState] = useState(() => getPlayerMovementState());

  useEffect(() => {
    if (propYaw !== undefined && propPos !== undefined) return;
    return subscribePlayerMovement((pos, yaw) => {
      setInternalState({ pos, yaw });
    });
  }, [propPos, propYaw]);

  const yaw = propYaw !== undefined ? propYaw : internalState.yaw;
  const position = propPos !== undefined ? propPos : internalState.pos;
  // Convert camera yaw (radians) to 0-360 compass degrees
  // In three.js standard, yaw = 0 is facing -Z (North), yaw = PI/2 is facing -X (West)
  const degrees = useMemo(() => {
    let deg = Math.round((-yaw * 180) / Math.PI) % 360;
    if (deg < 0) deg += 360;
    return deg;
  }, [yaw]);

  const cardinal = useMemo(() => {
    if (degrees >= 338 || degrees < 23) return "N";
    if (degrees >= 23 && degrees < 68) return "NE";
    if (degrees >= 68 && degrees < 113) return "E";
    if (degrees >= 113 && degrees < 158) return "SE";
    if (degrees >= 158 && degrees < 203) return "S";
    if (degrees >= 203 && degrees < 248) return "SW";
    if (degrees >= 248 && degrees < 293) return "W";
    return "NW";
  }, [degrees]);

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-30 flex flex-col items-center select-none">
      {/* Minimal Top Compass Pill */}
      <div className="flex items-center gap-2 rounded-full border border-white/10 bg-slate-900/70 px-3.5 py-1 text-xs font-semibold text-slate-200 shadow-lg backdrop-blur-md">
        <Navigation
          size={12}
          className="text-amber-400 transition-transform duration-100"
          style={{ transform: `rotate(${degrees}deg)` }}
        />
        <span className="font-mono text-amber-300 w-6 text-center">{cardinal}</span>
        <span className="text-slate-400 text-[10px] font-mono">{degrees}°</span>
      </div>

      {/* World Coordinates Display (Small & Non-intrusive) */}
      <div className="pointer-events-none fixed bottom-4 left-4 z-30 flex items-center gap-2 rounded-lg border border-white/10 bg-slate-900/65 px-2.5 py-1 text-[11px] font-mono text-slate-300 shadow-md backdrop-blur-md">
        <span className="text-slate-400 font-sans font-medium text-[10px]">POS</span>
        <span>X {Math.round(position[0])}</span>
        <span className="text-slate-500">•</span>
        <span>Y {position[1].toFixed(1)}</span>
        <span className="text-slate-500">•</span>
        <span>Z {Math.round(position[2])}</span>
      </div>
    </div>
  );
}
