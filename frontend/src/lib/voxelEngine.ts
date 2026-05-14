/**
 * Met-Shield: JavaScript VoxelGrid Engine
 * ========================================
 * A JavaScript mirror of the C++ VoxelGrid physics engine.
 * This runs the exact same FDM thermal solver in the browser.
 * When the WASM binary is compiled, this module can be swapped out.
 */

export const ALPHA = 0.0000068; // Thermal diffusivity of Ti-6Al-4V (m²/s)
export const T_INITIAL = 300.0; // Room temperature (K)

// Phase IDs matching the C++ PhaseID enum
export const PhaseID = {
  SOLID_ALPHA: 0,
  SOLID_BETA: 1,
  LIQUID: 2,
  VAPOR: 3,
} as const;

export class VoxelGridJS {
  width: number;
  height: number;
  depth: number;
  temps: Float32Array;
  phases: Uint8Array;
  nextTemps: Float32Array;

  constructor(width: number, height: number, depth: number) {
    this.width = width;
    this.height = height;
    this.depth = depth;
    const total = width * height * depth;
    this.temps = new Float32Array(total);
    this.phases = new Uint8Array(total);
    this.nextTemps = new Float32Array(total);
  }

  getIndex(x: number, y: number, z: number): number {
    return x + y * this.width + z * this.width * this.height;
  }

  getTemp(x: number, y: number, z: number): number {
    return this.temps[this.getIndex(x, y, z)];
  }

  setTemp(x: number, y: number, z: number, t: number): void {
    this.temps[this.getIndex(x, y, z)] = t;
  }

  getPhase(x: number, y: number, z: number): number {
    return this.phases[this.getIndex(x, y, z)];
  }

  setPhase(x: number, y: number, z: number, p: number): void {
    this.phases[this.getIndex(x, y, z)] = p;
  }

  initDefaultState(): void {
    this.temps.fill(T_INITIAL);
    this.phases.fill(PhaseID.SOLID_ALPHA);
  }

  /**
   * Finite Difference Method thermal solver — mirrors C++ stepThermalFDM.
   * Now accepts dynamic heat flux from the trajectory data.
   */
  stepThermalFDM(alpha: number, dt: number, currentHeatFlux: number): void {
    this.nextTemps.fill(0);

    // Interior nodes
    for (let z = 1; z < this.depth - 1; z++) {
      for (let y = 1; y < this.height - 1; y++) {
        for (let x = 1; x < this.width - 1; x++) {
          const T_c = this.getTemp(x, y, z);
          const lap =
            this.getTemp(x - 1, y, z) +
            this.getTemp(x + 1, y, z) +
            this.getTemp(x, y - 1, z) +
            this.getTemp(x, y + 1, z) +
            this.getTemp(x, y, z - 1) +
            this.getTemp(x, y, z + 1) -
            6 * T_c;

          this.nextTemps[this.getIndex(x, y, z)] = T_c + alpha * dt * lap;
        }
      }
    }

    // BC1: Dirichlet bottom (z=0) — internal cooling at T_INITIAL
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.nextTemps[this.getIndex(x, y, 0)] = T_INITIAL;
      }
    }

    // BC2: Neumann top (z=depth-1) — plasma heat flux
    const topZ = this.depth - 1;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const curr = this.getTemp(x, y, topZ);
        this.nextTemps[this.getIndex(x, y, topZ)] = curr + currentHeatFlux * dt;
      }
    }

    // Commit: skip X/Y edges (insulation)
    for (let z = 0; z < this.depth; z++) {
      for (let y = 1; y < this.height - 1; y++) {
        for (let x = 1; x < this.width - 1; x++) {
          this.setTemp(x, y, z, this.nextTemps[this.getIndex(x, y, z)]);
        }
      }
    }

    // Phase transitions (Gibbs Free Energy + Ablation)
    for (let z = 0; z < this.depth; z++) {
      for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
          const temp = this.getTemp(x, y, z);
          const phase = this.getPhase(x, y, z);

          if (temp >= 3287) {
            this.setPhase(x, y, z, PhaseID.VAPOR);
          } else if (temp >= 1660) {
            this.setPhase(x, y, z, PhaseID.LIQUID);
          } else if (temp > 1250 && phase === PhaseID.SOLID_ALPHA) {
            this.setPhase(x, y, z, PhaseID.SOLID_BETA);
          } else if (temp <= 1250 && phase === PhaseID.SOLID_BETA) {
            this.setPhase(x, y, z, PhaseID.SOLID_ALPHA);
          }
        }
      }
    }
  }

  /** Extract a 2D temperature slice at the center Y for visualization */
  getTemperatureSlice(): Float32Array {
    const midY = Math.floor(this.height / 2);
    const slice = new Float32Array(this.width * this.depth);
    for (let z = 0; z < this.depth; z++) {
      for (let x = 0; x < this.width; x++) {
        slice[x + z * this.width] = this.getTemp(x, midY, z);
      }
    }
    return slice;
  }

  /** Get maximum temperature across all voxels */
  getMaxTemp(): number {
    let max = 0;
    for (let i = 0; i < this.temps.length; i++) {
      if (this.temps[i] > max) max = this.temps[i];
    }
    return max;
  }

  /** Get full 3D temperature array for R3F rendering */
  getAllTemps(): Float32Array {
    return this.temps;
  }
}
