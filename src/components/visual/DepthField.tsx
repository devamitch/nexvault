/**
 * DepthField.tsx - Z-Axis Particle System
 *
 * A 2D Skia-based particle system that simulates depth by
 * varying particle size, opacity, and blur based on a Z value.
 * Particles closer to the "camera" are larger/brighter; farther
 * particles are smaller/dimmer.
 *
 * Uses no 3D engine - pure 2D rendering with depth illusion.
 * Ideal for backgrounds and ambient depth effects on all platforms
 * including web where Three.js may have limitations.
 */

import React, { useMemo, useEffect, useRef } from "react";
import { View, StyleSheet } from "react-native";
import { Canvas, Circle, Group } from "@shopify/react-native-skia";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

interface DepthFieldProps {
  width: number;
  height: number;
  particleCount?: number;
  color?: string;
  /** Depth layers (more = finer parallax) */
  layers?: number;
  /** Device tilt X for parallax offset */
  tiltX?: SharedValue<number>;
  /** Device tilt Y for parallax offset */
  tiltY?: SharedValue<number>;
}

interface Particle {
  x: number;
  y: number;
  z: number; // 0 = farthest, 1 = closest
  size: number;
  opacity: number;
  speed: number;
  phase: number;
}

export function DepthField({
  width,
  height,
  particleCount = 300,
  color = "#00D1FF",
  layers = 5,
  tiltX,
  tiltY,
}: DepthFieldProps) {
  const time = useSharedValue(0);

  useEffect(() => {
    time.value = withRepeat(
      withTiming(1000, { duration: 100000 }),
      -1,
      false
    );
  }, [time]);

  const particles = useMemo((): Particle[] => {
    return Array.from({ length: particleCount }, () => {
      const z = Math.random(); // depth 0-1
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        z,
        size: 0.5 + z * 3, // closer = bigger
        opacity: 0.1 + z * 0.6, // closer = brighter
        speed: 0.2 + (1 - z) * 0.5, // farther = slower drift
        phase: Math.random() * Math.PI * 2,
      };
    });
  }, [width, height, particleCount]);

  // Group particles by depth layer for parallax
  const layerGroups = useMemo(() => {
    const groups: Particle[][] = Array.from({ length: layers }, () => []);
    for (const p of particles) {
      const layerIdx = Math.min(
        layers - 1,
        Math.floor(p.z * layers)
      );
      groups[layerIdx].push(p);
    }
    return groups;
  }, [particles, layers]);

  // Parse color for alpha manipulation
  const colorBase = color.startsWith("#") ? color : "#00D1FF";

  return (
    <View style={[styles.container, { width, height }]}>
      <Canvas style={{ width, height }}>
        {layerGroups.map((layerParticles, layerIdx) => {
          // Parallax offset scales with depth
          const parallaxMultiplier = (layerIdx / layers) * 15;
          const offsetX = (tiltX?.value ?? 0) * parallaxMultiplier;
          const offsetY = (tiltY?.value ?? 0) * parallaxMultiplier;

          return (
            <Group
              key={layerIdx}
              transform={[
                { translateX: offsetX },
                { translateY: offsetY },
              ]}
            >
              {layerParticles.map((p, i) => (
                <Circle
                  key={`${layerIdx}-${i}`}
                  cx={p.x}
                  cy={p.y}
                  r={p.size}
                  color={`${colorBase}${Math.round(p.opacity * 255)
                    .toString(16)
                    .padStart(2, "0")}`}
                />
              ))}
            </Group>
          );
        })}
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
  },
});
