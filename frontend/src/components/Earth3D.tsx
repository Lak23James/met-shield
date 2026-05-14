"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { TrajectoryPoint } from "@/lib/trajectoryData";

interface EarthProps {
  trajectory: TrajectoryPoint[];
  currentTimeIndex: number;
}

export default function Earth3D({ trajectory, currentTimeIndex }: EarthProps) {
  const earthRef = useRef<THREE.Mesh>(null);
  const satelliteRef = useRef<THREE.Group>(null);
  const plasmaWakeRef = useRef<THREE.Mesh>(null);
  const wakeLightRef = useRef<THREE.PointLight>(null);
  const RADIUS = 3;

  // Load high-fidelity Earth maps
  const [earthColor, earthBump, earthSpec] = useLoader(THREE.TextureLoader, [
    "/earth_diffuse.png",
    "/earth_bump.png",
    "/earth_specular.png",
  ]);
  earthColor.colorSpace = THREE.SRGBColorSpace;

  // Calculate Catmull-Rom spline curve from spherical coordinates
  const curve = useMemo(() => {
    if (trajectory.length < 2) return null;
    const points = trajectory.map((p) => {
      const altScale = p.altitude / 120000;
      const radius = RADIUS + Math.max(0.01, altScale * 0.5);
      const phi = (90 - p.latitude) * (Math.PI / 180);
      const theta = (p.longitude + 180) * (Math.PI / 180);
      const vec = new THREE.Vector3().setFromSphericalCoords(radius, phi, theta);
      vec.applyAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2); // align with map
      return vec;
    });
    return new THREE.CatmullRomCurve3(points);
  }, [trajectory, RADIUS]);

  // Full orbital track geometry (cyan glowing line)
  const trackGeometry = useMemo(() => {
    if (!curve) return null;
    return new THREE.TubeGeometry(curve, trajectory.length * 2, 0.008, 6, false);
  }, [curve, trajectory.length]);

  const maxFlux = useMemo(() => Math.max(...trajectory.map(p => p.heatFlux), 1), [trajectory]);

  // The Animation Loop
  useFrame((_, delta) => {
    // 1. Earth slow rotation
    if (earthRef.current) earthRef.current.rotation.y += delta * 0.01;

    // 2. Satellite marker animation
    if (curve && satelliteRef.current) {
      const totalLen = Math.max(trajectory.length - 1, 1);
      const t = Math.max(0, Math.min(1, currentTimeIndex / totalLen));
      
      const pos = curve.getPointAt(t);
      const tangent = curve.getTangentAt(t);
      
      satelliteRef.current.position.copy(pos);
      satelliteRef.current.lookAt(pos.clone().add(tangent));

      // 3. Dynamic Plasma Trail intensity & color based on flux
      const idx = Math.min(currentTimeIndex, trajectory.length - 1);
      const currentFlux = trajectory[idx]?.heatFlux || 0;
      const fluxRatio = currentFlux / maxFlux;

      if (plasmaWakeRef.current && wakeLightRef.current) {
        const c = new THREE.Color().lerpColors(new THREE.Color(0xff4400), new THREE.Color(0xffffff), fluxRatio);
        const mat = plasmaWakeRef.current.material as THREE.MeshBasicMaterial;
        mat.color = c;
        mat.opacity = 0.1 + fluxRatio * 0.5;
        wakeLightRef.current.color = c;
        wakeLightRef.current.intensity = fluxRatio * 20;

        // Scale the plasma bubble based on flux
        const s = 1.0 + fluxRatio * 1.5;
        plasmaWakeRef.current.scale.set(s, s, s);
      }
    }
  });

  return (
    <group>
      {/* High-Fidelity Earth */}
      <mesh ref={earthRef}>
        <sphereGeometry args={[RADIUS, 128, 128]} />
        <meshStandardMaterial
          map={earthColor}
          bumpMap={earthBump}
          bumpScale={0.015}
          roughnessMap={earthSpec} 
          roughness={0.7}
          metalness={0.1}
        />
      </mesh>

      {/* Atmospheric Halo (Additive Blending) */}
      <mesh>
        <sphereGeometry args={[RADIUS * 1.02, 64, 64]} />
        <meshBasicMaterial
          color="#4ca6ff"
          transparent={true}
          opacity={0.15}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.FrontSide}
        />
      </mesh>

      {/* Strong Sun Light for spec/bump details */}
      <directionalLight position={[10, 5, 8]} intensity={3.5} color="#ffffff" />
      <ambientLight intensity={0.05} />

      {/* Glowing Orbital Track */}
      {trackGeometry && (
        <mesh geometry={trackGeometry}>
          <meshStandardMaterial color="#00e5ff" emissive="#00e5ff" emissiveIntensity={1.2} transparent opacity={0.3} />
        </mesh>
      )}

      {/* Satellite Marker Group */}
      <group ref={satelliteRef}>
        {/* Capsule Body */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.02, 0.04, 0.08, 12]} />
          <meshStandardMaterial color="#888" metalness={0.8} roughness={0.2} />
        </mesh>
        
        {/* Solar Panels (cyan glow) */}
        <mesh position={[0.06, 0, 0]}>
          <boxGeometry args={[0.08, 0.01, 0.03]} />
          <meshStandardMaterial color="#00e5ff" emissive="#00e5ff" emissiveIntensity={2.0} />
        </mesh>
        <mesh position={[-0.06, 0, 0]}>
          <boxGeometry args={[0.08, 0.01, 0.03]} />
          <meshStandardMaterial color="#00e5ff" emissive="#00e5ff" emissiveIntensity={2.0} />
        </mesh>

        {/* Dynamic Plasma Wake Bubble */}
        <mesh ref={plasmaWakeRef} position={[0, 0, -0.06]}>
          <sphereGeometry args={[0.06, 16, 16]} />
          <meshBasicMaterial transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>

        <pointLight ref={wakeLightRef} position={[0, 0, -0.1]} distance={3} decay={2} intensity={0} />
      </group>
    </group>
  );
}
