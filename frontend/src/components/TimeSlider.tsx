"use client";

import { Play, Pause } from "lucide-react";

interface TimeSliderProps {
  value: number;
  max: number;
  onChange: (val: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
}

export default function TimeSlider({
  value,
  max,
  onChange,
  isPlaying,
  onTogglePlay,
}: TimeSliderProps) {
  const progress = max > 0 ? (value / max) * 100 : 0;
  const missionTime = max > 0 ? ((value / max) * 400).toFixed(1) : "0.0";

  return (
    <div className="glass-panel p-3.5" style={{
      boxShadow: "0 0 30px rgba(0, 229, 255, 0.03)"
    }}>
      <div className="flex items-center gap-4">
        {/* Play/Pause */}
        <button
          onClick={onTogglePlay}
          className="control-tab"
          style={{
            width: 40,
            height: 40,
            padding: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderColor: isPlaying
              ? "rgba(255, 51, 51, 0.3)"
              : "rgba(0, 229, 255, 0.3)",
            color: isPlaying ? "#ff3333" : "#00e5ff",
            background: isPlaying
              ? "rgba(255, 51, 51, 0.06)"
              : "rgba(0, 229, 255, 0.06)",
          }}
        >
          {isPlaying ? <Pause size={16} /> : <Play size={16} />}
        </button>

        {/* Slider track */}
        <div className="flex-1">
          <input
            type="range"
            min={0}
            max={max}
            value={value}
            onChange={(e) => onChange(parseInt(e.target.value))}
            className="w-full"
            style={{
              background: `linear-gradient(to right, #00e5ff ${progress}%, rgba(100, 116, 139, 0.15) ${progress}%)`,
            }}
          />
          <div className="flex justify-between mt-1">
            <span
              className="text-[0.6rem] font-mono"
              style={{ color: "#475569" }}
            >
              T+0.0s
            </span>
            <span
              className="text-[0.65rem] font-mono font-semibold"
              style={{ color: "#00e5ff" }}
            >
              T+{missionTime}s
            </span>
            <span
              className="text-[0.6rem] font-mono"
              style={{ color: "#475569" }}
            >
              T+400.0s
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
