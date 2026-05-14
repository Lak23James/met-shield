"use client";

import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface HeatShieldProps {
  temperatures: Float32Array;
  gridWidth: number;
  gridHeight: number;
  gridDepth: number;
  maxTemp: number;
  onHoverTemp?: (temp: number | null) => void;
}

/**
 * Temperature → color using the Inferno scientific scale.
 * Returns a THREE.Color and emissive intensity.
 */
function tempToColor(temp: number, maxT: number): { color: THREE.Color; emissive: number } {
  const effMax = Math.max(maxT, 500);
  const t = Math.max(0, Math.min(1, (temp - 300) / (effMax - 300)));

  let r: number, g: number, b: number;

  if (t < 0.2) {
    // <800K: Black/cold void (#0a1128)
    const s = t / 0.2;
    r = 0.04 + s * 0.04;
    g = 0.07 + s * (-0.02);
    b = 0.16 + s * (-0.06);
  } else if (t < 0.5) {
    // 800–1500K: Crimson (#d62828)
    const s = (t - 0.2) / 0.3;
    r = 0.08 + s * 0.76;
    g = 0.05 + s * 0.11;
    b = 0.10 + s * 0.06;
  } else if (t < 0.8) {
    // 1500–2500K: Orange (#f77f00)
    const s = (t - 0.5) / 0.3;
    r = 0.84 + s * 0.13;
    g = 0.16 + s * 0.34;
    b = 0.16 - s * 0.16;
  } else {
    // 2500K+: White-hot (#ffffff)
    const s = (t - 0.8) / 0.2;
    r = 0.97 + s * 0.03;
    g = 0.50 + s * 0.50;
    b = 0.0 + s * 1.0;
  }

  // Exponential emissive intensity so hot voxels GLOW through Bloom
  const emissive = t < 0.15 ? 0 : Math.pow(t, 2.5) * 5.0;

  return { color: new THREE.Color(r, g, b), emissive };
}

export default function HeatShield3D({
  temperatures,
  gridWidth,
  gridHeight,
  gridDepth,
  maxTemp,
  onHoverTemp,
}: HeatShieldProps) {
  const shieldMeshRef = useRef<THREE.InstancedMesh>(null);

  // The shield face is the 8×8 bottom layer (z = gridDepth-1, the plasma-facing side)
  const shieldCount = gridWidth * gridHeight;

  // Pre-allocate reusable objects
  const tempMatrix = useMemo(() => new THREE.Matrix4(), []);
  const tempColor = useMemo(() => new THREE.Color(), []);
  const tempScale = useMemo(() => new THREE.Vector3(), []);

  // Initialize shield grid positions (only once)
  useEffect(() => {
    if (!shieldMeshRef.current) return;
    const mesh = shieldMeshRef.current;
    const cellSize = 0.18;
    const offsetX = -(gridWidth * cellSize) / 2 + cellSize / 2;
    const offsetY = -(gridHeight * cellSize) / 2 + cellSize / 2;

    for (let y = 0; y < gridHeight; y++) {
      for (let x = 0; x < gridWidth; x++) {
        const idx = x + y * gridWidth;
        tempMatrix.identity();
        tempMatrix.setPosition(
          offsetX + x * cellSize,
          offsetY + y * cellSize,
          0
        );
        tempScale.set(cellSize * 0.92, cellSize * 0.92, cellSize * 0.4);
        tempMatrix.scale(tempScale);
        mesh.setMatrixAt(idx, tempMatrix);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [gridWidth, gridHeight, tempMatrix, tempScale]);

  // Update colors EVERY FRAME from the temperature array
  useFrame(() => {
    if (!shieldMeshRef.current) return;
    const mesh = shieldMeshRef.current;
    const topZ = gridDepth - 1; // plasma-facing layer

    for (let y = 0; y < gridHeight; y++) {
      for (let x = 0; x < gridWidth; x++) {
        const voxelIdx = x + y * gridWidth + topZ * gridWidth * gridHeight;
        const temp = temperatures[voxelIdx] || 300;
        const { color } = tempToColor(temp, maxTemp);

        const idx = x + y * gridWidth;
        tempColor.copy(color);
        mesh.setColorAt(idx, tempColor);
      }
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  // Dynamic emissive intensity for the material
  const emissiveIntensity = useMemo(() => {
    const t = Math.max(0, Math.min(1, (maxTemp - 300) / 3200));
    return Math.pow(t, 2.2) * 5.0;
  }, [maxTemp]);

  return (
    <group>
      {/* ═══ SPACECRAFT (aligned on Y-axis) ═══ */}

      {/* 1. Command Module (Cone) — top */}
      <mesh position={[0, 1.1, 0]}>
        <coneGeometry args={[0.45, 0.9, 32]} />
        <meshStandardMaterial
          color="#0e0e0e"
          roughness={0.35}
          metalness={0.9}
        />
      </mesh>

      {/* 2. Main Body (Cylinder) — middle, directly under cone */}
      <mesh position={[0, 0.4, 0]}>
        <cylinderGeometry args={[0.45, 0.55, 0.5, 32]} />
        <meshStandardMaterial
          color="#111111"
          roughness={0.3}
          metalness={0.85}
        />
      </mesh>

      {/* 3. Shield Skirt (Cylinder) — lower, wider */}
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.55, 0.75, 0.2, 32]} />
        <meshStandardMaterial
          color="#1a0a02"
          roughness={0.5}
          metalness={0.4}
          emissive={new THREE.Color(1, 0.3, 0.05)}
          emissiveIntensity={emissiveIntensity * 0.3}
          toneMapped={false}
        />
      </mesh>

      {/* ═══ HEAT SHIELD (8×8 InstancedMesh heatmap) ═══ */}
      <group position={[0, -0.15, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <instancedMesh
          ref={shieldMeshRef}
          args={[undefined, undefined, shieldCount]}
          onPointerMove={(e) => {
            e.stopPropagation();
            if (e.instanceId !== undefined && onHoverTemp) {
              const x = e.instanceId % gridWidth;
              const y = Math.floor(e.instanceId / gridWidth);
              const topZ = gridDepth - 1;
              const voxelIdx = x + y * gridWidth + topZ * gridWidth * gridHeight;
              const temp = temperatures[voxelIdx] || 300;
              onHoverTemp(temp);
            }
          }}
          onPointerOut={() => onHoverTemp?.(null)}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial
            roughness={0.1}
            metalness={0.9}
            emissive={new THREE.Color(1, 0.4, 0.05)}
            emissiveIntensity={emissiveIntensity}
            toneMapped={false}
          />
        </instancedMesh>
      </group>

      {/* Plasma glow light (in front of shield) */}
      <pointLight
        position={[0, -0.8, 0]}
        color={
          maxTemp > 2500 ? "#ffffff" : maxTemp > 1000 ? "#f77f00" : "#0a1128"
        }
        intensity={emissiveIntensity * 3}
        distance={3}
        decay={2}
      />
    </group>
  );
}
