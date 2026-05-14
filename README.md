# MET-SHIELD: Multi-Physics Re-entry Heat Shield Simulator

[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=nextdotjs)](https://nextjs.org/)
[![React Three Fiber](https://img.shields.io/badge/Three.js-R3F-blueviolet?style=flat-square)](https://docs.pmnd.rs/react-three-fiber/getting-started/introduction)
[![WebAssembly](https://img.shields.io/badge/C++-WASM-blue?style=flat-square&logo=webassembly)](https://webassembly.org/)
[![PINN](https://img.shields.io/badge/PyTorch-PINN-red?style=flat-square&logo=pytorch)](https://pytorch.org/)

MET-SHIELD is a high-fidelity, multi-physics simulation dashboard designed for aerospace re-entry thermal protection system (TPS) analysis. It bridges **hypersonic trajectory physics**, a **Physics-Informed Neural Network (PINN)**, a browser-based **C++/WASM Finite Difference Method (FDM) thermal voxel engine**, and an advanced **React Three Fiber (R3F) 3D visualizer** to simulate phase changes in advanced materials like Ti-6Al-4V.

---

## 🚀 System Architecture & Phases

### Phase 1: Hypersonic Trajectory Generation (`/trajectory`)
Calculates real-time telemetry for a capsule entering the upper atmosphere using an aerodynamic/thermodynamic integration scheme.
- **Outputs**: Latitude, Longitude, Altitude (km), Velocity (m/s), Dynamic Air Density, and Heat Flux ($W/m^2$).
- **Key Physics**: Generates the stagnation-point heat flux curve that drives the downstream thermal solver.

### Phase 2: Neural Engine (Physics-Informed Neural Network) (`/pinn`)
A PyTorch-based PINN designed to predict baseline heat fluxes across various flight conditions by embedding partial differential equations (PDEs) directly into the neural network loss function.
- Eliminates pure black-box neural assumptions by enforcing physical laws governing fluid and heat mechanics.

### Phase 3: Multiphase C++ Thermal Voxel Engine (`/engine`)
An explicit Finite Difference Method (FDM) solver compiled to WebAssembly (with a JS fallback mirror).
- **Explicit FDM Formulation**: Calculates heat diffusion through an $8\times8\times12$ 3D voxel grid representing the shield volume.
- **Boundary Conditions**: Neumann (heat flux input on the plasma-facing face) and Dirichlet (internal cooling).
- **Phase Shifts**: Implements automated transition states based on Gibbs free energy rules for **Ti-6Al-4V**:
  - **$\alpha$-Phase (HCP)**: Room temp to $1253 \text{ K}$
  - **$\beta$-Phase (BCC)**: $1253 \text{ K}$ to $1660 \text{ K}$ (Loss of 80% yield strength)
  - **Liquid State**: $> 1660 \text{ K}$ (Critical ablation threshold)

### Phase 4: High-Fidelity Next.js Dashboard (`/frontend`)
A production-grade, data-dense React dashboard built to emulate professional satellite telemetry and aerospace software.
- **Trajectory View**: Photorealistic PBR Earth sphere wrapped with high-res bump and specular maps, a glowing orbital spline calculated from spherical coords, and an animated satellite featuring a dynamic plasma wake effect driven by real-time heat flux.
- **Thermal Shield View**: Uses `InstancedMesh` for extreme browser performance. It reads the live 3D temperature array from the solver and colors the 8x8 face using the physical **Inferno Colormap**, acting as a virtual optical pyrometer.
- **GLSL Microstructure Lens**: A procedural Voronoi noise shader running on the GPU that simulates the physical grain crystal structure of the alloy. When you hover over a voxel, the shader transitions from circular equiaxed grains ($\alpha$-phase) to elongated, acicular needles ($\beta$-phase Widmanstätten structure) and coarsens (grows) in real-time as temperatures climb.

---

## 🛠️ Setup & Installation

### Requirements
*   Node.js 18+ / NPM
*   Python 3.9+ (optional, for retraining PINN or generating fresh trajectories)

### 1. Start the Frontend
```bash
cd frontend
npm install
npm run dev
```
Navigate to [http://localhost:3000](http://localhost:3000).

### 2. Running the Trajectory Generation (Optional)
```bash
cd trajectory
python -m venv .venv
source .venv/bin/activate  # On Windows use: .venv\Scripts\activate
pip install -r requirements.txt
python reentry_model.py
```

---

## 🔬 Scientific Applications & Insights

### 1. Optical Pyrometry
During real hypersonic flight, physical contact thermometers are incinerated by the ionizing plasma sheath. Engineers observe thermal conditions remotely by analyzing the emitted wavelengths of glowing metal. The **Inferno colormap** maps directly to blackbody radiative intensity, enabling physical temperature assessment just by visual color recognition.

### 2. The Alpha-to-Beta Structural Risk
Titanium isn't just "solid" until it melts. At $1253 \text{ K}$, the atoms reorganize from a Hexagonal Close-Packed (HCP) lattice into a Body-Centered Cubic (BCC) structure. This suddenly reduces the yield strength by ~80%. If the aerodynamic G-forces are too high during this $\beta$-phase window, the shield faces catastrophic buckling before ever reaching its melting point. The live **Microstructure Lens** explicitly maps this crystalline reorganization.

---

## 💡 Disclaimer & Feedback
This is a **prototype simulation prototype** and likely contains numerous physical simplifications, boundary condition approximations, and engineering bugs. The FDM spatial mesh is coarse ($8\times8\times12$), and the ablation dynamics do not yet account for dynamic mass loss or aerodynamic spallation. 

**Feedback is warmly welcome!** If you are a materials scientist, CFD specialist, or graphics developer, please submit issues or PRs suggesting how to improve the solver convergence, refine the lattice kinetics shader, or upgrade the PINN loss formulation.
