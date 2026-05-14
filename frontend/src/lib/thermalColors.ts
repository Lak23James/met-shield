/**
 * Inferno Scientific Colormap
 * Standard thermographic scale used in aerospace thermal analysis.
 * 300K  → #0a1128 (black/cold void)
 * 800K  → #780000 (crimson)
 * 2000K → #f77f00 (orange glow)
 * 3000K → #ffffff (white-hot plasma)
 */
export function tempToInferno(
  temp: number,
  minT = 300,
  maxT = 3500
): { r: number; g: number; b: number; intensity: number } {
  const t = Math.max(0, Math.min(1, (temp - minT) / (maxT - minT)));

  let r: number, g: number, b: number;

  if (t < 0.16) {
    // 300K–800K: void black → deep crimson
    const s = t / 0.16;
    r = 0.04 + s * 0.43;  // 0a → 78
    g = 0.07 + s * (-0.07);
    b = 0.16 + s * (-0.16);
  } else if (t < 0.53) {
    // 800K–2000K: crimson → orange glow
    const s = (t - 0.16) / 0.37;
    r = 0.47 + s * 0.50;  // 78 → f7
    g = 0.0 + s * 0.50;   // 00 → 7f
    b = 0.0;
  } else if (t < 0.84) {
    // 2000K–3000K: orange → bright yellow-white
    const s = (t - 0.53) / 0.31;
    r = 0.97 + s * 0.03;
    g = 0.50 + s * 0.50;
    b = 0.0 + s * 0.7;
  } else {
    // 3000K+: white-hot plasma
    const s = (t - 0.84) / 0.16;
    r = 1.0;
    g = 1.0;
    b = 0.7 + s * 0.3;
  }

  // Emissive intensity: exponential glow for Bloom post-processing
  const intensity = t < 0.1 ? 0 : Math.pow(t, 2.8) * 4.0;

  return { r: Math.max(0, r), g: Math.max(0, g), b: Math.max(0, b), intensity };
}

/** Hex string for UI display */
export function tempToHex(temp: number, minT = 300, maxT = 3500): string {
  const { r, g, b } = tempToInferno(temp, minT, maxT);
  const h = (v: number) => Math.round(Math.min(255, v * 255)).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}
