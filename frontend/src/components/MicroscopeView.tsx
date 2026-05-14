"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

const grainShaderVertex = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const grainShaderFragment = `
uniform float uTemp;
varying vec2 vUv;

// Hash function for Voronoi
vec2 hash(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)),
             dot(p, vec2(269.5, 183.3)));
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

// Voronoi distance
vec3 voronoi(vec2 x, float stretch) {
    vec2 n = floor(x);
    vec2 f = fract(x);

    float m_dist = 8.0;
    vec2 m_point;

    for (int j = -1; j <= 1; j++) {
        for (int i = -1; i <= 1; i++) {
            vec2 g = vec2(float(i), float(j));
            vec2 o = hash(n + g);
            // Animate phase slightly based on time if needed
            o = 0.5 + 0.5 * sin(uTemp * 0.01 + 6.2831 * o);
            
            // Stretch the distance metric for acicular beta phase
            vec2 r = g + o - f;
            r.x *= stretch; 
            
            float d = dot(r, r);
            if (d < m_dist) {
                m_dist = d;
                m_point = r;
            }
        }
    }
    
    // Second pass for borders
    float b_dist = 8.0;
    for (int j = -2; j <= 2; j++) {
        for (int i = -2; i <= 2; i++) {
            vec2 g = vec2(float(i), float(j));
            vec2 o = hash(n + g);
            o = 0.5 + 0.5 * sin(uTemp * 0.01 + 6.2831 * o);
            vec2 r = g + o - f;
            r.x *= stretch;
            
            float d = dot(r, r);
            if (d > m_dist && d < b_dist) {
                b_dist = d;
            }
        }
    }
    
    return vec3(sqrt(m_dist), sqrt(b_dist), sqrt(b_dist) - sqrt(m_dist));
}

void main() {
    // Grain growth: lower scale means bigger grains
    // 300K -> scale 20.0 (small grains)
    // 1600K -> scale 5.0 (coarse grains)
    float scale = mix(20.0, 5.0, clamp((uTemp - 300.0) / 1300.0, 0.0, 1.0));
    
    // Alpha to Beta transition: 
    // Alpha (<1253K) -> Equiaxed (stretch = 1.0)
    // Beta (>1253K) -> Acicular/Needles (stretch = 4.0)
    float phaseMix = smoothstep(1200.0, 1300.0, uTemp);
    float stretch = mix(1.0, 4.0, phaseMix);
    
    vec2 uv = vUv * scale;
    vec3 v = voronoi(uv, stretch);
    
    // Dark grain boundaries (edge distance)
    float border = smoothstep(0.01, 0.05, v.z);
    
    // Metallic background with slight internal grain variation
    vec3 baseColor = vec3(0.5, 0.55, 0.6); // Ti grey
    vec3 color = baseColor * (0.8 + 0.2 * v.x); // internal gradient
    
    // Apply dark boundary lines (chemical etch effect)
    color *= border;
    
    // If melting (>1660K), blur the boundaries to simulate liquid
    float melt = smoothstep(1600.0, 1700.0, uTemp);
    color = mix(color, vec3(1.0, 0.4, 0.1) * (0.8 + 0.2 * v.x), melt); // glowing liquid

    gl_FragColor = vec4(color, 1.0);
}
`

function MicroscopeShader({ temp }: { temp: number }) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  useFrame(() => {
    if (materialRef.current) {
      // Smoothly animate towards target temp
      const prev = materialRef.current.uniforms.uTemp.value;
      materialRef.current.uniforms.uTemp.value += (temp - prev) * 0.1;
    }
  });

  const uniforms = useMemo(() => ({
    uTemp: { value: temp }
  }), [temp]);

  return (
    <mesh>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={grainShaderVertex}
        fragmentShader={grainShaderFragment}
        uniforms={uniforms}
      />
    </mesh>
  );
}

export default function MicroscopeView({ temperature }: { temperature: number }) {
  return (
    <div style={{ position: "relative", width: 140, height: 140, margin: "0 auto" }}>
      {/* Outer metallic ring */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
        borderRadius: "50%",
        border: "4px solid #333",
        boxShadow: "inset 0 0 10px rgba(0,0,0,0.8), 0 0 10px rgba(0,0,0,0.5)",
        overflow: "hidden",
        backgroundColor: "#111",
        zIndex: 1
      }}>
        <Canvas gl={{ antialias: true }}>
          <MicroscopeShader temp={temperature} />
        </Canvas>
      </div>
      
      {/* Crosshair overlay */}
      <div style={{
        position: "absolute", top: "50%", left: "50%", width: 10, height: 1, backgroundColor: "rgba(255,255,255,0.3)", zIndex: 2, transform: "translate(-50%, -50%)"
      }} />
      <div style={{
        position: "absolute", top: "50%", left: "50%", width: 1, height: 10, backgroundColor: "rgba(255,255,255,0.3)", zIndex: 2, transform: "translate(-50%, -50%)"
      }} />

      {/* Scale bar */}
      <div style={{
        position: "absolute", bottom: 15, left: "50%", transform: "translateX(-50%)", zIndex: 2,
        display: "flex", flexDirection: "column", alignItems: "center"
      }}>
        <div style={{ width: 40, height: 2, backgroundColor: "#fff", borderLeft: "1px solid #fff", borderRight: "1px solid #fff" }} />
        <span style={{ fontSize: "0.45rem", fontFamily: "var(--font-mono)", color: "#fff", marginTop: 2, textShadow: "0 0 2px #000" }}>
          50 µm
        </span>
      </div>
      
      {/* Title */}
      <div style={{
        position: "absolute", top: -16, left: 0, right: 0, textAlign: "center",
        fontSize: "0.55rem", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.1em"
      }}>
        Microstructure
      </div>
    </div>
  );
}
