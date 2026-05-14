/**
 * Met-Shield: Trajectory Data Loader
 * ====================================
 * Parses the re-entry CSV and provides typed access to flight data.
 */

export interface TrajectoryPoint {
  time: number;
  longitude: number;
  latitude: number;
  altitude: number;
  velocity: number;
  density: number;
  heatFlux: number;
}

export async function loadTrajectoryData(): Promise<TrajectoryPoint[]> {
  const res = await fetch("/reentry_data.csv");
  const text = await res.text();
  const lines = text.trim().split("\n");
  const header = lines[0].split(",");

  const data: TrajectoryPoint[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    data.push({
      time: parseFloat(cols[0]),
      longitude: parseFloat(cols[1]),
      latitude: parseFloat(cols[2]),
      altitude: parseFloat(cols[3]),
      velocity: parseFloat(cols[4]),
      density: parseFloat(cols[5]),
      heatFlux: parseFloat(cols[6]),
    });
  }
  return data;
}

/** Convert lat/lon to 3D coordinates on a sphere */
export function latLonToVec3(
  lat: number,
  lon: number,
  radius: number
): [number, number, number] {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lon + 180) * Math.PI) / 180;
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const y = radius * Math.cos(phi);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  return [x, y, z];
}

/** Map temperature to a color (blue -> yellow -> red -> white) */
export function tempToColor(temp: number, minT = 300, maxT = 3500): [number, number, number] {
  const t = Math.max(0, Math.min(1, (temp - minT) / (maxT - minT)));

  if (t < 0.25) {
    // Blue to Cyan
    return [0, t * 4, 1];
  } else if (t < 0.5) {
    // Cyan to Yellow
    const s = (t - 0.25) * 4;
    return [s, 1, 1 - s];
  } else if (t < 0.75) {
    // Yellow to Red
    const s = (t - 0.5) * 4;
    return [1, 1 - s, 0];
  } else {
    // Red to White
    const s = (t - 0.75) * 4;
    return [1, s, s];
  }
}
