"use client";

import {
  Clock,
  Mountain,
  Gauge,
  Flame,
  Thermometer,
  Atom,
} from "lucide-react";
import { tempToHex } from "@/lib/thermalColors";

interface InfoPanelProps {
  time: number;
  altitude: number;
  velocity: number;
  heatFlux: number;
  maxTemp: number;
  phase: string;
}

export default function InfoPanel({
  time,
  altitude,
  velocity,
  heatFlux,
  maxTemp,
  phase,
}: InfoPanelProps) {
  const fmt = (n: number, d = 1) =>
    n.toLocaleString("en-US", {
      minimumFractionDigits: d,
      maximumFractionDigits: d,
    });

  // Dynamic color thresholds
  const fluxColor =
    heatFlux > 400000
      ? "#ef4444"
      : heatFlux > 200000
      ? "#ff8c42"
      : "#00e5ff";

  const tempColor = tempToHex(maxTemp);

  const phaseColor =
    phase === "VAPOR"
      ? "#ef4444"
      : phase === "LIQUID"
      ? "#ff8c42"
      : phase === "β-TITANIUM"
      ? "#8b5cf6"
      : "#0ea5e9";

  const stats = [
    {
      label: "Mission Time",
      value: `${fmt(time, 1)}s`,
      Icon: Clock,
      color: "#00e5ff",
    },
    {
      label: "Altitude",
      value: `${fmt(altitude / 1000, 1)} km`,
      Icon: Mountain,
      color: "#0ea5e9",
    },
    {
      label: "Velocity",
      value: `${fmt(velocity, 0)} m/s`,
      Icon: Gauge,
      color: "#8b5cf6",
    },
    {
      label: "Heat Flux",
      value: `${fmt(heatFlux, 0)} W/m²`,
      Icon: Flame,
      color: fluxColor,
    },
    {
      label: "Max Shield Temp",
      value: `${fmt(maxTemp, 0)} K`,
      Icon: Thermometer,
      color: tempColor,
    },
    {
      label: "Shield Phase",
      value: phase,
      Icon: Atom,
      color: phaseColor,
    },
  ];

  return (
    <div className="glass-panel p-4 space-y-3">
      <h2 className="telemetry-label" style={{ fontSize: "0.65rem" }}>
        Flight Telemetry
      </h2>
      <div className="grid grid-cols-2 gap-2.5">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-lg p-3 transition-all duration-300"
            style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.04)",
            }}
          >
            <div className="flex items-center gap-1.5 mb-1.5">
              <s.Icon size={12} style={{ color: s.color, opacity: 0.7 }} />
              <span className="telemetry-label">{s.label}</span>
            </div>
            <div
              className="telemetry-value text-lg"
              style={{
                color: s.color,
                transition: "color 0.4s ease",
              }}
            >
              {s.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
