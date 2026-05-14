"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { tempToBlackbody } from "@/lib/thermalColors";

interface HeatmapProps {
  temperatures: Float32Array;
  gridWidth: number;
  gridHeight: number;
  gridDepth: number;
  maxTemp: number;
}

type SlicePlane = "XZ" | "YZ" | "XY";

/**
 * Scientific 2D Thermal Heatmap
 * Renders a pixel-accurate temperature cross-section with:
 * - Selectable slice planes (XZ, YZ, XY)
 * - Mouse hover temperature readout
 * - Proper colorbar with tick marks
 * - Grid lines and axis labels
 */
export default function Heatmap2D({
  temperatures,
  gridWidth,
  gridHeight,
  gridDepth,
  maxTemp,
}: HeatmapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colorbarRef = useRef<HTMLCanvasElement>(null);
  const [plane, setPlane] = useState<SlicePlane>("XZ");
  const [sliceIndex, setSliceIndex] = useState(Math.floor(gridHeight / 2));
  const [hoverInfo, setHoverInfo] = useState<{
    x: number;
    y: number;
    temp: number;
    gridX: number;
    gridY: number;
  } | null>(null);

  // Get the slice dimensions
  const getSliceDims = useCallback((): {
    cols: number;
    rows: number;
    maxSlice: number;
    xLabel: string;
    yLabel: string;
    sliceLabel: string;
  } => {
    switch (plane) {
      case "XZ":
        return {
          cols: gridWidth,
          rows: gridDepth,
          maxSlice: gridHeight - 1,
          xLabel: "X (width)",
          yLabel: "Z (depth → plasma)",
          sliceLabel: "Y",
        };
      case "YZ":
        return {
          cols: gridHeight,
          rows: gridDepth,
          maxSlice: gridWidth - 1,
          xLabel: "Y (height)",
          yLabel: "Z (depth → plasma)",
          sliceLabel: "X",
        };
      case "XY":
        return {
          cols: gridWidth,
          rows: gridHeight,
          maxSlice: gridDepth - 1,
          xLabel: "X (width)",
          yLabel: "Y (height)",
          sliceLabel: "Z",
        };
    }
  }, [plane, gridWidth, gridHeight, gridDepth]);

  // Get temperature from the 3D array for the current slice
  const getSliceTemp = useCallback(
    (col: number, row: number): number => {
      let x: number, y: number, z: number;
      switch (plane) {
        case "XZ":
          x = col;
          y = sliceIndex;
          z = row;
          break;
        case "YZ":
          x = sliceIndex;
          y = col;
          z = row;
          break;
        case "XY":
          x = col;
          y = row;
          z = sliceIndex;
          break;
      }
      return temperatures[x + y * gridWidth + z * gridWidth * gridHeight] || 0;
    },
    [temperatures, plane, sliceIndex, gridWidth, gridHeight]
  );

  // Render the heatmap
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { cols, rows } = getSliceDims();
    const PADDING = 50;
    const drawW = canvas.width - PADDING - 20;
    const drawH = canvas.height - PADDING - 30;
    const cellW = drawW / cols;
    const cellH = drawH / rows;

    // Clear
    ctx.fillStyle = "#0a0a12";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Effective max for scaling
    const effMax = Math.max(maxTemp, 400);

    // Draw cells — row 0 is bottom (z=0 = back face), top row = plasma face
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const temp = getSliceTemp(col, row);
        const { r, g, b } = tempToBlackbody(temp, 300, effMax);

        const px = PADDING + col * cellW;
        // Flip Y so z=depth-1 (plasma face) is at the top
        const py = 10 + (rows - 1 - row) * cellH;

        ctx.fillStyle = `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
        ctx.fillRect(px, py, Math.ceil(cellW), Math.ceil(cellH));
      }
    }

    // Grid lines
    ctx.strokeStyle = "rgba(100, 116, 139, 0.15)";
    ctx.lineWidth = 0.5;
    for (let col = 0; col <= cols; col++) {
      const px = PADDING + col * cellW;
      ctx.beginPath();
      ctx.moveTo(px, 10);
      ctx.lineTo(px, 10 + drawH);
      ctx.stroke();
    }
    for (let row = 0; row <= rows; row++) {
      const py = 10 + row * cellH;
      ctx.beginPath();
      ctx.moveTo(PADDING, py);
      ctx.lineTo(PADDING + drawW, py);
      ctx.stroke();
    }

    // Axis tick labels
    ctx.fillStyle = "#64748b";
    ctx.font = "10px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";

    // X-axis labels
    for (let col = 0; col < cols; col++) {
      const px = PADDING + col * cellW + cellW / 2;
      ctx.fillText(String(col), px, canvas.height - 15);
    }

    // Y-axis labels (flipped)
    ctx.textAlign = "right";
    for (let row = 0; row < rows; row++) {
      const py = 10 + (rows - 1 - row) * cellH + cellH / 2 + 3;
      ctx.fillText(String(row), PADDING - 6, py);
    }

    // Axis titles
    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px 'Inter', sans-serif";
    ctx.textAlign = "center";
    const { xLabel, yLabel } = getSliceDims();
    ctx.fillText(xLabel, PADDING + drawW / 2, canvas.height - 2);

    ctx.save();
    ctx.translate(12, 10 + drawH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(yLabel, 0, 0);
    ctx.restore();

    // Hover crosshair
    if (hoverInfo) {
      const hCol = hoverInfo.gridX;
      const hRow = hoverInfo.gridY;
      const px = PADDING + hCol * cellW;
      const py = 10 + (rows - 1 - hRow) * cellH;

      ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);

      // Vertical
      ctx.beginPath();
      ctx.moveTo(px + cellW / 2, 10);
      ctx.lineTo(px + cellW / 2, 10 + drawH);
      ctx.stroke();

      // Horizontal
      ctx.beginPath();
      ctx.moveTo(PADDING, py + cellH / 2);
      ctx.lineTo(PADDING + drawW, py + cellH / 2);
      ctx.stroke();

      ctx.setLineDash([]);

      // Cell highlight
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.strokeRect(px, py, cellW, cellH);
    }
  }, [temperatures, plane, sliceIndex, maxTemp, hoverInfo, getSliceDims, getSliceTemp, gridWidth, gridHeight, gridDepth]);

  // Render the colorbar
  useEffect(() => {
    const canvas = colorbarRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const barX = 10;
    const barW = 20;
    const barTop = 20;
    const barH = h - 40;

    ctx.fillStyle = "#0a0a12";
    ctx.fillRect(0, 0, w, h);

    const effMax = Math.max(maxTemp, 400);

    // Draw gradient bar
    for (let py = 0; py < barH; py++) {
      const t = 1 - py / barH; // top = hot, bottom = cold
      const temp = 300 + t * (effMax - 300);
      const { r, g, b } = tempToBlackbody(temp, 300, effMax);
      ctx.fillStyle = `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
      ctx.fillRect(barX, barTop + py, barW, 1);
    }

    // Border
    ctx.strokeStyle = "rgba(100, 116, 139, 0.3)";
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barTop, barW, barH);

    // Tick marks
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px 'JetBrains Mono', monospace";
    ctx.textAlign = "left";

    const numTicks = 6;
    for (let i = 0; i <= numTicks; i++) {
      const frac = i / numTicks;
      const temp = 300 + (1 - frac) * (effMax - 300);
      const py = barTop + frac * barH;

      // Tick line
      ctx.strokeStyle = "rgba(148, 163, 184, 0.4)";
      ctx.beginPath();
      ctx.moveTo(barX + barW, py);
      ctx.lineTo(barX + barW + 4, py);
      ctx.stroke();

      // Label
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(`${Math.round(temp)}K`, barX + barW + 7, py + 3);
    }

    // Title
    ctx.save();
    ctx.fillStyle = "#64748b";
    ctx.font = "9px 'Inter', sans-serif";
    ctx.translate(w - 4, barTop + barH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.fillText("Temperature (K)", 0, 0);
    ctx.restore();
  }, [maxTemp]);

  // Mouse handler
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const { cols, rows } = getSliceDims();
      const PADDING = 50;
      const drawW = canvas.width - PADDING - 20;
      const drawH = canvas.height - PADDING - 30;
      const cellW = drawW / cols;
      const cellH = drawH / rows;

      const col = Math.floor((mx - PADDING) / cellW);
      const rowFlipped = Math.floor((my - 10) / cellH);
      const row = rows - 1 - rowFlipped;

      if (col >= 0 && col < cols && row >= 0 && row < rows) {
        const temp = getSliceTemp(col, row);
        setHoverInfo({ x: mx, y: my, temp, gridX: col, gridY: row });
      } else {
        setHoverInfo(null);
      }
    },
    [getSliceDims, getSliceTemp]
  );

  const dims = getSliceDims();

  return (
    <div className="glass-panel p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2
            className="text-xs font-semibold uppercase tracking-[0.12em]"
            style={{ color: "#94a3b8" }}
          >
            Thermal Cross-Section
          </h2>
          <p className="text-[0.6rem] mt-0.5" style={{ color: "#475569" }}>
            {dims.sliceLabel} = {sliceIndex} &nbsp;|&nbsp; T<sub>max</sub> ={" "}
            <span className="font-mono" style={{ color: "#ff3333" }}>
              {maxTemp.toFixed(1)}K
            </span>
          </p>
        </div>
        <div className="flex gap-1.5">
          {(["XZ", "YZ", "XY"] as SlicePlane[]).map((p) => (
            <button
              key={p}
              onClick={() => {
                setPlane(p);
                const maxIdx =
                  p === "XZ"
                    ? gridHeight - 1
                    : p === "YZ"
                    ? gridWidth - 1
                    : gridDepth - 1;
                setSliceIndex(Math.floor(maxIdx / 2));
              }}
              className="control-tab"
              style={{
                padding: "4px 10px",
                fontSize: "0.6rem",
                ...(plane === p
                  ? {
                      borderColor: "rgba(0, 229, 255, 0.35)",
                      color: "#00e5ff",
                      background: "rgba(0, 229, 255, 0.06)",
                    }
                  : {}),
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Slice index slider */}
      <div className="flex items-center gap-3">
        <span
          className="text-[0.6rem] font-mono w-16"
          style={{ color: "#64748b" }}
        >
          {dims.sliceLabel} = {sliceIndex}
        </span>
        <input
          type="range"
          min={0}
          max={dims.maxSlice}
          value={sliceIndex}
          onChange={(e) => setSliceIndex(parseInt(e.target.value))}
          className="flex-1"
          style={{
            background: `linear-gradient(to right, #00e5ff ${
              (sliceIndex / Math.max(dims.maxSlice, 1)) * 100
            }%, rgba(100,116,139,0.15) ${
              (sliceIndex / Math.max(dims.maxSlice, 1)) * 100
            }%)`,
          }}
        />
      </div>

      {/* Canvas + Colorbar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <canvas
            ref={canvasRef}
            width={420}
            height={320}
            className="w-full rounded-md cursor-crosshair"
            style={{ border: "1px solid rgba(100,116,139,0.12)" }}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoverInfo(null)}
          />

          {/* Hover tooltip */}
          {hoverInfo && (
            <div
              className="absolute pointer-events-none rounded-md px-2.5 py-1.5"
              style={{
                left: Math.min(hoverInfo.x + 12, 340),
                top: hoverInfo.y - 40,
                background: "rgba(5, 5, 10, 0.9)",
                backdropFilter: "blur(8px)",
                border: "1px solid rgba(100,116,139,0.2)",
              }}
            >
              <div className="text-[0.55rem] font-mono" style={{ color: "#64748b" }}>
                [{hoverInfo.gridX}, {hoverInfo.gridY}]
              </div>
              <div
                className="text-sm font-mono font-bold"
                style={{
                  color:
                    hoverInfo.temp > 1660
                      ? "#ff3333"
                      : hoverInfo.temp > 800
                      ? "#ff8c42"
                      : "#00e5ff",
                }}
              >
                {hoverInfo.temp.toFixed(2)} K
              </div>
            </div>
          )}
        </div>

        {/* Colorbar */}
        <canvas
          ref={colorbarRef}
          width={90}
          height={320}
          className="rounded-md"
        />
      </div>
    </div>
  );
}
