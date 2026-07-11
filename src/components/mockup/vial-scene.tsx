"use client";

import * as React from "react";
import * as THREE from "three";
import { Canvas, useThree } from "@react-three/fiber";
import { Environment, OrbitControls } from "@react-three/drei";
import type { VialSpec } from "@/lib/document/schema";

/**
 * Realistic vial mockup: parameterized glass body, liquid, cap, and the
 * label as its OWN open cylinder segment whose arc length equals the
 * label's physical width (thetaLength = width / circumference × 2π) — the
 * seam/gap preview falls out of the geometry for free.
 *
 * Scene units are millimeters. frameloop="demand" keeps the GPU idle
 * except on orbit/texture changes.
 */

export interface MockupSettings {
  lighting: "studio" | "soft" | "dramatic";
  backdrop: "light" | "dark" | "transparent";
  autoRotate?: boolean;
}

export const DEFAULT_MOCKUP_SETTINGS: MockupSettings = {
  lighting: "studio",
  backdrop: "light",
};

interface VialSceneProps {
  vial: VialSpec;
  labelWidthMm: number;
  labelHeightMm: number;
  labelCanvas: HTMLCanvasElement | null;
  settings?: MockupSettings;
  className?: string;
}

const GLASS_PRESETS: Record<
  VialSpec["glass"],
  { color: string; attenuationColor: string; attenuationDistance: number; roughness: number; transmission: number }
> = {
  clear: { color: "#ffffff", attenuationColor: "#f2f6f7", attenuationDistance: 60, roughness: 0.05, transmission: 1 },
  amber: { color: "#d29a3f", attenuationColor: "#7a4b08", attenuationDistance: 9, roughness: 0.05, transmission: 1 },
  cobalt: { color: "#3f66d2", attenuationColor: "#0c2a8a", attenuationDistance: 9, roughness: 0.05, transmission: 1 },
  frosted: { color: "#ffffff", attenuationColor: "#eef2f4", attenuationDistance: 40, roughness: 0.45, transmission: 0.95 },
  opaque: { color: "#f4f4f6", attenuationColor: "#ffffff", attenuationDistance: 1, roughness: 0.35, transmission: 0 },
};

function GlassMaterial({ glass }: { glass: VialSpec["glass"] }) {
  const preset = GLASS_PRESETS[glass];
  if (preset.transmission === 0) {
    return (
      <meshStandardMaterial color={preset.color} roughness={preset.roughness} metalness={0.05} />
    );
  }
  return (
    <meshPhysicalMaterial
      color={preset.color}
      transmission={preset.transmission}
      thickness={1.6}
      ior={1.5}
      roughness={preset.roughness}
      attenuationColor={preset.attenuationColor}
      attenuationDistance={preset.attenuationDistance}
      specularIntensity={1}
      clearcoat={0.4}
      clearcoatRoughness={0.2}
    />
  );
}

function Cap({ vial }: { vial: VialSpec }) {
  const capR = vial.capDiameterMm / 2;
  const capH = vial.capHeightMm;
  const neckTop = 0; // caps are positioned in the parent group at the neck top

  switch (vial.capStyle) {
    case "none":
      return null;
    case "dropper":
      return (
        <group position={[0, neckTop, 0]}>
          {/* Collar */}
          <mesh position={[0, capH * 0.2, 0]}>
            <cylinderGeometry args={[capR, capR, capH * 0.4, 40]} />
            <meshStandardMaterial color={vial.capColor} roughness={0.5} />
          </mesh>
          {/* Bulb */}
          <mesh position={[0, capH * 0.68, 0]} scale={[1, 1.25, 1]}>
            <sphereGeometry args={[capR * 0.72, 32, 24]} />
            <meshStandardMaterial color={vial.capColor} roughness={0.6} />
          </mesh>
        </group>
      );
    case "pump":
      return (
        <group position={[0, neckTop, 0]}>
          <mesh position={[0, capH * 0.25, 0]}>
            <cylinderGeometry args={[capR * 0.85, capR, capH * 0.5, 40]} />
            <meshStandardMaterial color={vial.capColor} roughness={0.35} metalness={0.15} />
          </mesh>
          <mesh position={[0, capH * 0.62, 0]}>
            <cylinderGeometry args={[capR * 0.3, capR * 0.3, capH * 0.5, 24]} />
            <meshStandardMaterial color={vial.capColor} roughness={0.35} metalness={0.15} />
          </mesh>
          {/* Nozzle */}
          <mesh position={[capR * 0.42, capH * 0.8, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[capR * 0.16, capR * 0.16, capR * 0.9, 20]} />
            <meshStandardMaterial color={vial.capColor} roughness={0.35} metalness={0.15} />
          </mesh>
        </group>
      );
    case "crimp":
      return (
        <group position={[0, neckTop, 0]}>
          <mesh position={[0, capH * 0.35, 0]}>
            <cylinderGeometry args={[capR, capR, capH * 0.7, 40]} />
            <meshStandardMaterial color="#c8ccd2" roughness={0.25} metalness={0.9} />
          </mesh>
          <mesh position={[0, capH * 0.75, 0]}>
            <cylinderGeometry args={[capR * 0.62, capR * 0.62, capH * 0.2, 32]} />
            <meshStandardMaterial color="#9aa0a8" roughness={0.4} metalness={0.6} />
          </mesh>
        </group>
      );
    case "flip-off":
      return (
        <group position={[0, neckTop, 0]}>
          <mesh position={[0, capH * 0.3, 0]}>
            <cylinderGeometry args={[capR, capR, capH * 0.6, 40]} />
            <meshStandardMaterial color="#c8ccd2" roughness={0.25} metalness={0.9} />
          </mesh>
          <mesh position={[0, capH * 0.72, 0]}>
            <cylinderGeometry args={[capR * 0.9, capR * 0.9, capH * 0.28, 40]} />
            <meshStandardMaterial color={vial.capColor} roughness={0.5} />
          </mesh>
        </group>
      );
    case "screw":
    default:
      return (
        <mesh position={[0, neckTop + capH * 0.45, 0]}>
          <cylinderGeometry args={[capR, capR, capH * 0.9, 48]} />
          <meshStandardMaterial color={vial.capColor} roughness={0.55} />
        </mesh>
      );
  }
}

function VialModel({
  vial,
  labelWidthMm,
  labelHeightMm,
  labelCanvas,
}: Pick<VialSceneProps, "vial" | "labelWidthMm" | "labelHeightMm" | "labelCanvas">) {
  const invalidate = useThree((s) => s.invalidate);
  const bodyR = vial.diameterMm / 2;
  const bodyH = Math.max(
    vial.totalHeightMm - vial.capHeightMm - 4,
    vial.straightWallHeightMm,
  );
  const neckR = vial.neckDiameterMm / 2;
  const neckH = Math.max(vial.totalHeightMm - vial.capHeightMm - bodyH, 0) + 2;

  const texture = React.useMemo(() => {
    if (!labelCanvas) return null;
    const t = new THREE.CanvasTexture(labelCanvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    t.wrapS = THREE.ClampToEdgeWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
  }, [labelCanvas]);

  React.useEffect(() => {
    invalidate();
    return () => {
      texture?.dispose();
    };
  }, [texture, invalidate]);

  const circumference = Math.PI * vial.diameterMm;
  const thetaLength = Math.min((labelWidthMm / circumference) * Math.PI * 2, Math.PI * 2);
  // Center the label on the front (+z). Three's cylinder theta starts at +z
  // when thetaStart = 0? It starts at +x and sweeps toward +z; front-center
  // is at theta = π/2 in three's convention (x = r·cosθ misconception guard):
  // CylinderGeometry uses x = r·sin(θ), z = r·cos(θ), so θ=0 faces +z.
  const thetaStart = -thetaLength / 2;

  const liquidH = Math.max(bodyH * vial.liquidFill - 2, 0);

  return (
    <group position={[0, -vial.totalHeightMm / 2, 0]}>
      {/* Body */}
      <mesh position={[0, bodyH / 2, 0]}>
        <cylinderGeometry args={[bodyR, bodyR, bodyH, 64]} />
        <GlassMaterial glass={vial.glass} />
      </mesh>
      {/* Bottom cap of glass (closes the tube) */}
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[bodyR * 0.98, bodyR * 0.98, 1, 64]} />
        <GlassMaterial glass={vial.glass} />
      </mesh>
      {/* Liquid */}
      {liquidH > 0 && vial.glass !== "opaque" && (
        <mesh position={[0, liquidH / 2 + 1.2, 0]}>
          <cylinderGeometry args={[bodyR - 1.1, bodyR - 1.1, liquidH, 48]} />
          <meshPhysicalMaterial
            color={vial.liquidColor}
            transmission={0.85}
            thickness={bodyR}
            roughness={0.18}
            ior={1.33}
            attenuationColor={vial.liquidColor}
            attenuationDistance={14}
          />
        </mesh>
      )}
      {/* Neck */}
      <mesh position={[0, bodyH + neckH / 2, 0]}>
        <cylinderGeometry args={[neckR, neckR, neckH, 48]} />
        <GlassMaterial glass={vial.glass} />
      </mesh>
      {/* Cap */}
      <group position={[0, bodyH + neckH, 0]}>
        <Cap vial={vial} />
      </group>
      {/* Label — its own cylinder segment at the true arc length,
          vertically centered on the straight-wall section (bottom of body) */}
      {texture && (
        <mesh position={[0, Math.min(vial.straightWallHeightMm / 2 + 1.5, bodyH / 2), 0]}>
          <cylinderGeometry
            args={[
              bodyR + 0.12,
              bodyR + 0.12,
              labelHeightMm,
              96,
              1,
              true,
              thetaStart,
              thetaLength,
            ]}
          />
          <meshStandardMaterial
            map={texture}
            transparent
            roughness={0.6}
            metalness={0.02}
            side={THREE.FrontSide}
            polygonOffset
            polygonOffsetFactor={-1}
          />
        </mesh>
      )}
    </group>
  );
}

const LIGHTING_PRESETS: Record<MockupSettings["lighting"], { envIntensity: number; key: number }> = {
  studio: { envIntensity: 1, key: 0.7 },
  soft: { envIntensity: 0.7, key: 0.25 },
  dramatic: { envIntensity: 0.45, key: 1.6 },
};

export interface VialSceneHandle {
  snapshot: () => string | null;
}

export const VialScene = React.forwardRef<VialSceneHandle, VialSceneProps>(
  function VialScene(
    { vial, labelWidthMm, labelHeightMm, labelCanvas, settings = DEFAULT_MOCKUP_SETTINGS, className },
    ref,
  ) {
    const glRef = React.useRef<THREE.WebGLRenderer | null>(null);

    React.useImperativeHandle(ref, () => ({
      snapshot: () => {
        const gl = glRef.current;
        if (!gl) return null;
        return gl.domElement.toDataURL("image/png");
      },
    }));

    const lighting = LIGHTING_PRESETS[settings.lighting];
    const cameraDistance = vial.totalHeightMm * 2.1;

    return (
      <div className={className}>
        <Canvas
          frameloop="demand"
          dpr={[1, 1.75]}
          gl={{ preserveDrawingBuffer: true, antialias: true, alpha: true }}
          camera={{
            position: [0, vial.totalHeightMm * 0.12, cameraDistance],
            fov: 30,
            near: 1,
            far: cameraDistance * 6,
          }}
          onCreated={({ gl }) => {
            glRef.current = gl;
          }}
        >
          {settings.backdrop !== "transparent" && (
            <color
              attach="background"
              args={[settings.backdrop === "dark" ? "#1a191f" : "#f2f1f4"]}
            />
          )}
          <React.Suspense fallback={null}>
            <Environment files="/env/studio.hdr" environmentIntensity={lighting.envIntensity} />
          </React.Suspense>
          <directionalLight position={[40, 80, 60]} intensity={lighting.key} />
          <VialModel
            vial={vial}
            labelWidthMm={labelWidthMm}
            labelHeightMm={labelHeightMm}
            labelCanvas={labelCanvas}
          />
          <OrbitControls
            makeDefault
            enablePan={false}
            minDistance={vial.totalHeightMm * 0.9}
            maxDistance={cameraDistance * 2.2}
            autoRotate={settings.autoRotate}
            autoRotateSpeed={1.2}
            target={[0, 0, 0]}
          />
        </Canvas>
      </div>
    );
  },
);
