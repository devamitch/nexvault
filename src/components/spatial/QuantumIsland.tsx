/**
 * QuantumIsland.tsx - Dynamic Morphing UI Element
 *
 * The "Quantum Dynamic Island" is a living, morphing glassmorphic
 * element that sits at the top of the screen and changes form
 * based on application state.
 *
 * States:
 *   IDLE       - Small capsule (120x35) with subtle pulse
 *   LISTENING  - Expanded (full width x 150) with waveform viz
 *   PROCESSING - Circular (100x100) with vortex animation
 *   ALERT      - Variable size with color-coded background
 *
 * All transitions use spring physics and Bezier curve shape
 * interpolation via Reanimated for organic feel.
 */

import React, { useEffect, useMemo } from "react";
import { StyleSheet, Dimensions, View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  interpolate,
  useDerivedValue,
  type SharedValue,
} from "react-native-reanimated";
import { Canvas, RoundedRect, LinearGradient, vec, BlurMask, Circle, Group, Line, Paint } from "@shopify/react-native-skia";
import type { IslandState, AlertInfo } from "../../store/quantumStore";

// ── Types ──────────────────────────────────────────────────────

interface QuantumIslandProps {
  /** Current island state */
  state: IslandState;
  /** Audio amplitude (0-1) for waveform viz in LISTENING state */
  amplitude?: SharedValue<number>;
  /** Alert info for ALERT state */
  alert?: AlertInfo | null;
  /** Called when alert is dismissed via gesture */
  onDismissAlert?: () => void;
}

// ── Constants ──────────────────────────────────────────────────

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const TOP_OFFSET = 50;

// State dimensions
const DIMENSIONS = {
  IDLE: { width: 120, height: 35 },
  LISTENING: { width: SCREEN_WIDTH - 40, height: 150 },
  PROCESSING: { width: 100, height: 100 },
  ALERT: { width: SCREEN_WIDTH - 40, height: 80 },
};

const SPRING_CONFIG = {
  damping: 20,
  stiffness: 200,
  mass: 0.6,
};

const ALERT_COLORS: Record<string, string> = {
  INFO: "rgba(0, 120, 255, 0.4)",
  WARNING: "rgba(255, 180, 0, 0.4)",
  SUCCESS: "rgba(0, 200, 100, 0.4)",
  ERROR: "rgba(255, 50, 50, 0.4)",
};

// ── Waveform Visualization ────────────────────────────────────

interface WaveformProps {
  width: number;
  height: number;
  amplitude: SharedValue<number>;
}

function WaveformVisualization({ width, height, amplitude }: WaveformProps) {
  const BARS = 40;
  const barWidth = (width - 20) / BARS;

  return (
    <Canvas style={{ width, height }}>
      {Array.from({ length: BARS }, (_, i) => {
        // Each bar has slightly different phase for wave effect
        const phase = i / BARS;
        const centerDist = Math.abs(i - BARS / 2) / (BARS / 2);
        const baseHeight = (1 - centerDist * 0.6) * 0.8;

        return (
          <RoundedRect
            key={i}
            x={10 + i * barWidth}
            y={height / 2 - (baseHeight * amplitude.value * height * 0.4) / 2}
            width={barWidth - 2}
            height={Math.max(2, baseHeight * amplitude.value * height * 0.4)}
            r={1}
            color={`rgba(0, 209, 255, ${0.4 + amplitude.value * 0.6})`}
          />
        );
      })}
    </Canvas>
  );
}

// ── Mini Particle System (for IDLE state) ─────────────────────

function MiniParticles({ width, height }: { width: number; height: number }) {
  const PARTICLE_COUNT = 30;

  // Pre-computed particle positions with gentle animation offsets
  const particles = useMemo(
    () =>
      Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
        cx: 10 + Math.random() * (width - 20),
        cy: 5 + Math.random() * (height - 10),
        r: 0.5 + Math.random() * 1.5,
        phase: Math.random() * Math.PI * 2,
        speed: 0.5 + Math.random() * 1.5,
      })),
    [width, height]
  );

  return (
    <Canvas style={{ width, height }}>
      {particles.map((p, i) => (
        <Circle
          key={i}
          cx={p.cx}
          cy={p.cy}
          r={p.r}
          color={`rgba(0, 209, 255, ${0.3 + Math.random() * 0.4})`}
        />
      ))}
    </Canvas>
  );
}

// ── Processing Vortex ─────────────────────────────────────────

function ProcessingVortex({ size }: { size: number }) {
  return (
    <Canvas style={{ width: size, height: size }}>
      {Array.from({ length: 12 }, (_, i) => {
        const angle = (i / 12) * Math.PI * 2;
        const radius = size * 0.3;
        return (
          <Circle
            key={i}
            cx={size / 2 + Math.cos(angle) * radius}
            cy={size / 2 + Math.sin(angle) * radius}
            r={2 + (i % 3)}
            color={`rgba(0, 209, 255, ${0.3 + (i / 12) * 0.5})`}
          />
        );
      })}
    </Canvas>
  );
}

// ── Main Component ────────────────────────────────────────────

export function QuantumIsland({
  state,
  amplitude,
  alert,
  onDismissAlert,
}: QuantumIslandProps) {
  const defaultAmplitude = useSharedValue(0);
  const amp = amplitude ?? defaultAmplitude;

  // Animated dimensions
  const animWidth = useSharedValue(DIMENSIONS.IDLE.width);
  const animHeight = useSharedValue(DIMENSIONS.IDLE.height);
  const borderRadius = useSharedValue(20);
  const glowIntensity = useSharedValue(0);

  // Pulse animation for IDLE state
  const pulseScale = useSharedValue(1);

  // Rotation for PROCESSING state
  const rotation = useSharedValue(0);

  useEffect(() => {
    const dims = DIMENSIONS[state];
    animWidth.value = withSpring(dims.width, SPRING_CONFIG);
    animHeight.value = withSpring(dims.height, SPRING_CONFIG);

    switch (state) {
      case "IDLE":
        borderRadius.value = withSpring(20, SPRING_CONFIG);
        glowIntensity.value = withTiming(0.1, { duration: 300 });
        pulseScale.value = withRepeat(
          withSequence(
            withTiming(1.02, { duration: 2000 }),
            withTiming(1.0, { duration: 2000 })
          ),
          -1,
          true
        );
        rotation.value = 0;
        break;

      case "LISTENING":
        borderRadius.value = withSpring(25, SPRING_CONFIG);
        glowIntensity.value = withTiming(0.4, { duration: 300 });
        pulseScale.value = withSpring(1, SPRING_CONFIG);
        rotation.value = 0;
        break;

      case "PROCESSING":
        borderRadius.value = withSpring(50, SPRING_CONFIG);
        glowIntensity.value = withTiming(0.3, { duration: 300 });
        pulseScale.value = withSpring(1, SPRING_CONFIG);
        rotation.value = withRepeat(
          withTiming(Math.PI * 2, { duration: 2000 }),
          -1,
          false
        );
        break;

      case "ALERT":
        borderRadius.value = withSpring(20, SPRING_CONFIG);
        glowIntensity.value = withTiming(0.6, { duration: 200 });
        pulseScale.value = withSpring(1, SPRING_CONFIG);
        rotation.value = 0;
        break;
    }
  }, [state, animWidth, animHeight, borderRadius, glowIntensity, pulseScale, rotation]);

  // Animated container style
  const containerStyle = useAnimatedStyle(() => ({
    width: animWidth.value,
    height: animHeight.value,
    borderRadius: borderRadius.value,
    transform: [
      { scale: pulseScale.value },
      { rotate: `${rotation.value}rad` },
    ],
  }));

  // Glow style
  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowIntensity.value,
    width: animWidth.value + 16,
    height: animHeight.value + 16,
    borderRadius: borderRadius.value + 8,
  }));

  // Alert background color
  const alertBgColor = alert ? ALERT_COLORS[alert.type] ?? ALERT_COLORS.INFO : "transparent";

  return (
    <View style={styles.wrapper}>
      {/* Outer glow layer */}
      <Animated.View style={[styles.glow, glowStyle]} />

      {/* Main island container */}
      <Animated.View
        style={[
          styles.island,
          containerStyle,
          state === "ALERT" && { backgroundColor: alertBgColor },
        ]}
      >
        {/* Glass effect overlay */}
        <View style={styles.glassOverlay} />

        {/* State-specific content */}
        {state === "IDLE" && (
          <MiniParticles
            width={DIMENSIONS.IDLE.width}
            height={DIMENSIONS.IDLE.height}
          />
        )}

        {state === "LISTENING" && (
          <WaveformVisualization
            width={DIMENSIONS.LISTENING.width}
            height={DIMENSIONS.LISTENING.height}
            amplitude={amp}
          />
        )}

        {state === "PROCESSING" && (
          <ProcessingVortex size={DIMENSIONS.PROCESSING.width} />
        )}

        {state === "ALERT" && alert && (
          <Animated.Text style={styles.alertText}>
            {alert.message}
          </Animated.Text>
        )}
      </Animated.View>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    top: TOP_OFFSET,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 100,
  },
  glow: {
    position: "absolute",
    backgroundColor: "rgba(0, 209, 255, 0.15)",
  },
  island: {
    overflow: "hidden",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 0.5,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  glassOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  alertText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
    padding: 16,
  },
});
