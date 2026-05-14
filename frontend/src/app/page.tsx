"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stars, PerspectiveCamera } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import Earth3D from "@/components/Earth3D";
import HeatShield3D from "@/components/HeatShield3D";
import MicroscopeView from "@/components/MicroscopeView";
import { loadTrajectoryData, TrajectoryPoint } from "@/lib/trajectoryData";
import { VoxelGridJS, ALPHA } from "@/lib/voxelEngine";
import { tempToHex } from "@/lib/thermalColors";

const GRID_W = 8, GRID_H = 8, GRID_D = 12;
const DT = 0.001, STEPS = 3;



export default function Page() {
  const [traj, setTraj] = useState<TrajectoryPoint[]>([]);
  const [ti, setTi] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [temps, setTemps] = useState(new Float32Array(GRID_W * GRID_H * GRID_D));
  const [maxT, setMaxT] = useState(300);
  const [hoverTemp, setHoverTemp] = useState<number | null>(null);
  const [view, setView] = useState<"traj" | "shield">("traj");
  const [shieldPhase, setShieldPhase] = useState("α-TITANIUM");
  const grid = useRef<VoxelGridJS | null>(null);
  const anim = useRef<number | null>(null);

  useEffect(() => {
    loadTrajectoryData().then(setTraj);
    const g = new VoxelGridJS(GRID_W, GRID_H, GRID_D);
    g.initDefaultState();
    grid.current = g;
    setTemps(new Float32Array(g.temps));
  }, []);

  const step = useCallback((idx: number) => {
    if (!grid.current || !traj.length) return;
    const p = traj[Math.min(idx, traj.length - 1)];
    for (let s = 0; s < STEPS; s++) grid.current.stepThermalFDM(ALPHA, DT, p.heatFlux * 0.002);
    setTemps(new Float32Array(grid.current.temps));
    const newMax = grid.current.getMaxTemp();
    setMaxT(newMax);
    // Reactive shield phase based on maxTemp
    if (newMax > 1660) setShieldPhase("MELTING (CRITICAL)");
    else if (newMax > 1253) setShieldPhase("β-TITANIUM");
    else setShieldPhase("α-TITANIUM");
  }, [traj]);

  useEffect(() => {
    if (!playing) { if (anim.current) cancelAnimationFrame(anim.current); return; }
    let i = ti;
    const tick = () => {
      i = Math.min(i + 1, traj.length - 1);
      setTi(i); step(i);
      if (i < traj.length - 1) anim.current = requestAnimationFrame(tick);
      else setPlaying(false);
    };
    anim.current = requestAnimationFrame(tick);
    return () => { if (anim.current) cancelAnimationFrame(anim.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, traj, step]);

  const onSlider = useCallback((v: number) => {
    setTi(v);
    if (!grid.current) return;
    grid.current.initDefaultState();
    const n = Math.min(v, 50);
    for (let i = 0; i < n; i++) {
      const idx = Math.floor((i / n) * v);
      const p = traj[Math.min(idx, traj.length - 1)];
      if (p) grid.current.stepThermalFDM(ALPHA, DT, p.heatFlux * 0.002);
    }
    setTemps(new Float32Array(grid.current.temps));
    const newMax = grid.current.getMaxTemp();
    setMaxT(newMax);
    if (newMax > 1660) setShieldPhase("MELTING (CRITICAL)");
    else if (newMax > 1253) setShieldPhase("β-TITANIUM");
    else setShieldPhase("α-TITANIUM");
  }, [traj]);

  const pt = traj[ti] || { time: 0, altitude: 120000, velocity: 7800, heatFlux: 0, longitude: 0, latitude: 0, density: 0 };
  const progress = traj.length > 1 ? (ti / (traj.length - 1)) * 100 : 0;
  const missionT = traj.length > 1 ? ((ti / (traj.length - 1)) * 400).toFixed(1) : "0.0";
  const highRisk = pt.heatFlux > 400000;

  const fmt = (n: number, d = 1) => n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col" style={{ background: "#050505" }}>
      {/* ═══ TOP BAR ═══ */}
      <header
        className="flex items-center justify-between px-4 shrink-0"
        style={{ height: 48, background: "#0a0a0a", borderBottom: "1px solid #1a1a1a" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-2 h-2 rounded-full"
            style={{ background: playing ? "#22c55e" : "#555", boxShadow: playing ? "0 0 6px #22c55e" : "none" }}
          />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem", fontWeight: 700, color: "#f3f4f6", letterSpacing: "0.08em" }}>
            MET-SHIELD
          </span>
          <span style={{ fontSize: "0.55rem", color: "#555", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Thermal Protection System
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="data-label">Engine</span>
            <span className="badge badge-ready">JS/WASM</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="data-label">Status</span>
            <span className="badge badge-live">{playing ? "LIVE" : "READY"}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="data-label">T<sub>max</sub></span>
            <span className="data-value" style={{ fontSize: "0.7rem", color: tempToHex(maxT) }}>
              {fmt(maxT, 0)}K
            </span>
          </div>
        </div>
      </header>

      {/* ═══ MAIN 3-COL ═══ */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── LEFT SIDEBAR: Telemetry ── */}
        <aside
          className="shrink-0 sidebar-scroll"
          style={{ width: 280, background: "#0a0a0a", borderRight: "1px solid #1a1a1a", padding: "12px 14px" }}
        >
          <div className="section-header">Telemetry &amp; Live Feed</div>

          <div className="data-row">
            <span className="data-label">Mission Time</span>
            <span className="data-value" style={{ color: "#22d3ee" }}>{fmt(pt.time, 1)}s</span>
          </div>
          <div className="data-row">
            <span className="data-label">Altitude</span>
            <span className="data-value">{fmt(pt.altitude / 1000, 1)} km</span>
          </div>
          <div className="data-row">
            <span className="data-label">Velocity</span>
            <span className="data-value">{fmt(pt.velocity, 0)} m/s</span>
          </div>
          <div className="data-row">
            <div className="flex items-center gap-2">
              <span className="data-label">Heat Flux</span>
              {highRisk && <span className="badge badge-risk">HIGH RISK</span>}
            </div>
            <span className="data-value" style={{ color: highRisk ? "#ef4444" : pt.heatFlux > 200000 ? "#f97316" : "#d1d5db" }}>
              {fmt(pt.heatFlux, 0)} W/m²
            </span>
          </div>
          <div className="data-row">
            <span className="data-label">Air Density</span>
            <span className="data-value">{pt.density.toExponential(2)} kg/m³</span>
          </div>
          <div className="data-row">
            <span className="data-label">Position</span>
            <span className="data-value" style={{ fontSize: "0.7rem" }}>
              {fmt(pt.latitude, 2)}° {fmt(pt.longitude, 2)}°
            </span>
          </div>

          <div className="section-header" style={{ marginTop: 12 }}>Shield Diagnostics</div>

          <div className="data-row">
            <span className="data-label">Max Temp</span>
            <span className="data-value" style={{ color: tempToHex(maxT) }}>{fmt(maxT, 1)} K</span>
          </div>
          <div className="data-row">
            <span className="data-label">Phase</span>
            <span className="data-value" style={{
              color: shieldPhase.includes("CRITICAL") ? "#ef4444" : shieldPhase === "β-TITANIUM" ? "#a78bfa" : "#22d3ee"
            }}>
              {shieldPhase}
            </span>
            {shieldPhase.includes("CRITICAL") && <span className="badge badge-risk" style={{ marginLeft: 4 }}>CRITICAL</span>}
          </div>

          {/* Inferno color scale */}
          <div style={{ marginTop: 16 }}>
            <div className="section-header">Inferno Colormap</div>
            <div style={{
              height: 10,
              borderRadius: 1,
              background: "linear-gradient(to right, #0a1128, #780000, #f77f00, #ffffff)",
              marginTop: 6,
            }} />
            <div className="flex justify-between" style={{ marginTop: 3 }}>
              {["300K", "800K", "2000K", "3500K"].map((l, i) => (
                <span key={l} style={{
                  fontSize: "0.5rem",
                  fontFamily: "var(--font-mono)",
                  color: ["#0a1128", "#780000", "#f77f00", "#ffffff"][i],
                }}>{l}</span>
              ))}
            </div>
          </div>
        </aside>

        {/* ── CENTER: 3D Canvas ── */}
        <main className="flex-1 flex flex-col relative overflow-hidden">
          <Canvas
            gl={{ antialias: true, toneMapping: 5, toneMappingExposure: 1.1 }}
            style={{ background: "#030303", flex: 1 }}
          >
            <PerspectiveCamera makeDefault position={[0, 2, 6]} fov={50} />
            <OrbitControls enableDamping dampingFactor={0.05} minDistance={2} maxDistance={15} />
            <ambientLight intensity={0.12} />
            <directionalLight position={[8, 5, 6]} intensity={1.0} color="#e0d8d0" />
            <directionalLight position={[-5, -3, -5]} intensity={0.2} color="#334466" />
            <Stars radius={60} depth={60} count={2500} factor={3} saturation={0.05} fade speed={0.2} />

            <Suspense fallback={null}>
              {view === "traj" ? (
                <Earth3D trajectory={traj} currentTimeIndex={ti} />
              ) : (
                <HeatShield3D 
                  temperatures={temps} 
                  gridWidth={GRID_W} 
                  gridHeight={GRID_H} 
                  gridDepth={GRID_D} 
                  maxTemp={maxT} 
                  onHoverTemp={setHoverTemp}
                />
              )}
            </Suspense>

            <EffectComposer>
              <Bloom luminanceThreshold={0.7} luminanceSmoothing={0.85} intensity={1.8} mipmapBlur />
              <Vignette eskil={false} offset={0.15} darkness={0.7} />
            </EffectComposer>
          </Canvas>

          {/* Floating view toggle */}
          <div className="absolute top-3 right-3 flex" style={{ zIndex: 10 }}>
            <button
              onClick={() => setView("traj")}
              className={`view-toggle ${view === "traj" ? "active" : ""}`}
              style={{ borderRadius: "2px 0 0 2px" }}
            >
              Trajectory View
            </button>
            <button
              onClick={() => setView("shield")}
              className={`view-toggle ${view === "shield" ? "active" : ""}`}
              style={{ borderRadius: "0 2px 2px 0", borderLeft: "none" }}
            >
              Thermal Shield
            </button>
          </div>

          {/* View label */}
          <div className="absolute top-3 left-3" style={{ zIndex: 10 }}>
            <span style={{
              fontSize: "0.55rem", fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase" as const,
              color: view === "traj" ? "#22d3ee" : "#ef4444",
              background: "rgba(5,5,5,0.8)", padding: "4px 10px", border: "1px solid #1a1a1a", borderRadius: 2,
            }}>
              {view === "traj" ? "Re-Entry Trajectory" : "Heat Shield — FDM Voxel Grid"}
            </span>
          </div>

          {/* ═══ BOTTOM TIMELINE BAR ═══ */}
          <div
            className="shrink-0 flex items-center gap-3 px-4"
            style={{ height: 52, background: "#0a0a0a", borderTop: "1px solid #1a1a1a" }}
          >
            <button
              onClick={() => setPlaying(p => !p)}
              style={{
                width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
                border: `1px solid ${playing ? "rgba(239,68,68,0.3)" : "rgba(34,211,238,0.3)"}`,
                background: playing ? "rgba(239,68,68,0.05)" : "rgba(34,211,238,0.05)",
                color: playing ? "#ef4444" : "#22d3ee",
                borderRadius: 2, cursor: "pointer", fontSize: "0.9rem",
              }}
            >
              {playing ? "⏸" : "▶"}
            </button>

            <span className="data-value" style={{ width: 60, fontSize: "0.7rem", color: "#22d3ee", textAlign: "center" }}>
              T+{missionT}s
            </span>

            <input
              type="range" min={0} max={Math.max(traj.length - 1, 0)} value={ti}
              onChange={e => onSlider(parseInt(e.target.value))}
              className="flex-1"
              style={{
                background: `linear-gradient(to right, #22d3ee ${progress}%, #222 ${progress}%)`,
              }}
            />

            <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.6rem", color: "#555", width: 55, textAlign: "right" }}>
              400.0s
            </span>
          </div>
        </main>

        {/* ── RIGHT SIDEBAR: Constraints ── */}
        <aside
          className="shrink-0 sidebar-scroll"
          style={{ width: 260, background: "#0a0a0a", borderLeft: "1px solid #1a1a1a", padding: "12px 14px" }}
        >
          <div style={{ marginBottom: 20 }}>
            <MicroscopeView temperature={hoverTemp ?? maxT} />
          </div>

          <div className="section-header">PINN Parameters</div>
          <div className="data-row">
            <span className="data-label">Architecture</span>
            <span className="data-value" style={{ fontSize: "0.7rem" }}>4→256×4→1</span>
          </div>
          <div className="data-row">
            <span className="data-label">Baseline Flux</span>
            <span className="data-value">500 kW/m²</span>
          </div>
          <div className="data-row">
            <span className="data-label">Training</span>
            <span className="data-value" style={{ color: "#a78bfa" }}>Adam + L-BFGS</span>
          </div>
          <div className="data-row">
            <span className="data-label">Dimensions</span>
            <span className="data-value">3D (x,y,z,t)</span>
          </div>

          <div className="section-header" style={{ marginTop: 10 }}>FDM Engine</div>
          <div className="data-row">
            <span className="data-label">Voxel Grid</span>
            <span className="data-value" style={{ color: "#22d3ee" }}>{GRID_W}×{GRID_H}×{GRID_D}</span>
          </div>
          <div className="data-row">
            <span className="data-label">Solver</span>
            <span className="data-value">Explicit FDM</span>
          </div>
          <div className="data-row">
            <span className="data-label">Timestep</span>
            <span className="data-value">{DT} s</span>
          </div>
          <div className="data-row">
            <span className="data-label">State</span>
            <span className="badge badge-live">ACTIVE</span>
          </div>

          <div className="section-header" style={{ marginTop: 10 }}>Material — Ti-6Al-4V</div>
          <div className="data-row">
            <span className="data-label">α → β Transus</span>
            <span className="data-value">1250 K</span>
          </div>
          <div className="data-row">
            <span className="data-label">Melting Point</span>
            <span className="data-value">1660 K</span>
          </div>
          <div className="data-row">
            <span className="data-label">Boiling Point</span>
            <span className="data-value">3287 K</span>
          </div>
          <div className="data-row">
            <span className="data-label">Thermal Diff.</span>
            <span className="data-value">6.8×10⁻⁶ m²/s</span>
          </div>
          <div className="data-row">
            <span className="data-label">Conductivity</span>
            <span className="data-value">21.9 W/m·K</span>
          </div>

          <div className="section-header" style={{ marginTop: 10 }}>Post-Processing</div>
          <div className="data-row">
            <span className="data-label">Bloom</span>
            <span className="data-value" style={{ color: "#22d3ee" }}>Active</span>
          </div>
          <div className="data-row">
            <span className="data-label">Colormap</span>
            <span className="data-value">Inferno</span>
          </div>
          <div className="data-row">
            <span className="data-label">Tone Mapping</span>
            <span className="data-value">ACES Filmic</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
