/**
 * HolographicSlider.tsx - Gesture-Controlled Slider
 *
 * A glassmorphic slider that responds to hand position tracked
 * by the SpatialProcessor. Rendered with @shopify/react-native-skia
 * for high-performance 2D rendering.
 *
 * Visual features:
 *   - Backdrop blur glassmorphism
 *   - Animated liquid fill following hand X
 *   - Color gradient shift as progress increases
 *   - Scale response to hand Z (depth)
 *   - Milestone particle explosions at 25% intervals
 *   - Constellation progress markers
 *
 * The slider value is derived from the handX shared value
 * and written back to the zustand store via onValueChange.
 */

import React, { useCallback, useRef, useEffect } from "react";
import {
  Canvas,
  RoundedRect,
  LinearGradient,
  Blur,
  Group,
  Circle,
  vec,
  type SkiaValue,
  useValue,
  useComputedValue,
  useTouchHandler,
  Paint,
  ColorMatrix,
  Rect,
  BlurMask,
} from "@shopify/react-native-skia";
import { View, StyleSheet, Dimensions } from "react-native";
import {
  useSharedValue,
  useDerivedValue,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
  runOnJS,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

// ── Types ──────────────────────────────────────────────────────

interface HolographicSliderProps {
  /** Hand X position (0-1) shared value */
  handX: SharedValue<number>;
  /** Hand Z position (0-1) for depth-based scale */
  handZ?: SharedValue<number>;
  /** Whether hand is actively detected */
  handActive?: SharedValue<boolean>;
  /** Called when value changes (0-1) */
  onValueChange?: (value: number) => void;
  /** Called when slider completes (reaches 1.0) */
  onComplete?: () => void;
  /** Width of the slider in pixels */
  width?: number;
  /** Height of the slider in pixels */
  height?: number;
}

// ── Constants ──────────────────────────────────────────────────

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const DEFAULT_WIDTH = 300;
const DEFAULT_HEIGHT = 60;
const BORDER_RADIUS = 30;

// Color stops for the fill gradient as progress increases
const COLOR_STOPS = [
  { at: 0, color: "#003366" },     // Deep blue
  { at: 0.25, color: "#0066CC" },  // Medium blue
  { at: 0.5, color: "#00A3CC" },   // Teal
  { at: 0.75, color: "#00D1FF" },  // Quantum cyan
  { at: 1.0, color: "#FFFFFF" },   // Pure white
];

// Milestone percentages that trigger haptic/particle events
const MILESTONES = [0.25, 0.5, 0.75, 1.0];

// ── Helper: Interpolate Color ─────────────────────────────────

function interpolateColor(progress: number): string {
  for (let i = 1; i < COLOR_STOPS.length; i++) {
    if (progress <= COLOR_STOPS[i].at) {
      const prev = COLOR_STOPS[i - 1];
      const next = COLOR_STOPS[i];
      const t = (progress - prev.at) / (next.at - prev.at);

      // Simple hex interpolation
      const prevRGB = hexToRGB(prev.color);
      const nextRGB = hexToRGB(next.color);

      const r = Math.round(prevRGB.r + (nextRGB.r - prevRGB.r) * t);
      const g = Math.round(prevRGB.g + (nextRGB.g - prevRGB.g) * t);
      const b = Math.round(prevRGB.b + (nextRGB.b - prevRGB.b) * t);

      return `rgb(${r}, ${g}, ${b})`;
    }
  }
  return COLOR_STOPS[COLOR_STOPS.length - 1].color;
}

function hexToRGB(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

// ── Component ─────────────────────────────────────────────────

export function HolographicSlider({
  handX,
  handZ,
  handActive,
  onValueChange,
  onComplete,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
}: HolographicSliderProps) {
  const lastMilestoneRef = useRef(-1);
  const completedRef = useRef(false);

  // Derived slider value from hand position
  const sliderValue = useDerivedValue(() => {
    if (handActive && !handActive.value) return 0;
    return Math.max(0, Math.min(1, handX.value));
  }, [handX, handActive]);

  // Scale based on hand Z depth (closer = larger)
  const scale = useDerivedValue(() => {
    if (!handZ) return 1;
    // Map Z: 0 (far) → 0.8 scale, 1 (close) → 1.2 scale
    return 0.8 + handZ.value * 0.4;
  }, [handZ]);

  // Fill width in pixels
  const fillWidth = useDerivedValue(() => {
    return sliderValue.value * (width - 4); // 2px padding each side
  }, [sliderValue, width]);

  // Glow pulse animation
  const glowOpacity = useSharedValue(0.3);
  useEffect(() => {
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.6, { duration: 1500 }),
        withTiming(0.3, { duration: 1500 })
      ),
      -1,
      true
    );
  }, [glowOpacity]);

  // Milestone detection and haptic feedback
  const triggerMilestoneHaptic = useCallback(
    (milestone: number) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      if (milestone >= 1.0 && !completedRef.current) {
        completedRef.current = true;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        onComplete?.();
      }
    },
    [onComplete]
  );

  // Monitor value changes
  useDerivedValue(() => {
    const value = sliderValue.value;

    // Notify value change (throttled via runOnJS)
    if (onValueChange) {
      runOnJS(onValueChange)(value);
    }

    // Check milestones
    for (const milestone of MILESTONES) {
      if (
        value >= milestone &&
        lastMilestoneRef.current < milestone
      ) {
        runOnJS(triggerMilestoneHaptic)(milestone);
        lastMilestoneRef.current = milestone;
      }
    }

    return value;
  }, [sliderValue]);

  // Canvas dimensions including glow margin
  const canvasWidth = width + 40;
  const canvasHeight = height + 40;
  const offsetX = 20; // Center the slider within canvas
  const offsetY = 20;

  return (
    <View
      style={[
        styles.container,
        {
          width: canvasWidth,
          height: canvasHeight,
        },
      ]}
    >
      <Canvas style={{ width: canvasWidth, height: canvasHeight }}>
        <Group
          transform={[
            { translateX: canvasWidth / 2 },
            { translateY: canvasHeight / 2 },
            { scale: scale.value },
            { translateX: -canvasWidth / 2 },
            { translateY: -canvasHeight / 2 },
          ]}
        >
          {/* Outer glow */}
          <RoundedRect
            x={offsetX - 4}
            y={offsetY - 4}
            width={width + 8}
            height={height + 8}
            r={BORDER_RADIUS + 4}
            color="rgba(0, 209, 255, 0.15)"
          >
            <BlurMask blur={12} style="normal" />
          </RoundedRect>

          {/* Glass background */}
          <RoundedRect
            x={offsetX}
            y={offsetY}
            width={width}
            height={height}
            r={BORDER_RADIUS}
          >
            <LinearGradient
              start={vec(offsetX, offsetY)}
              end={vec(offsetX, offsetY + height)}
              colors={["rgba(255,255,255,0.15)", "rgba(255,255,255,0.05)"]}
            />
          </RoundedRect>

          {/* Glass border */}
          <RoundedRect
            x={offsetX}
            y={offsetY}
            width={width}
            height={height}
            r={BORDER_RADIUS}
            color="transparent"
            style="stroke"
            strokeWidth={0.5}
          >
            <LinearGradient
              start={vec(offsetX, offsetY)}
              end={vec(offsetX + width, offsetY + height)}
              colors={["rgba(255,255,255,0.3)", "rgba(255,255,255,0.1)"]}
            />
          </RoundedRect>

          {/* Liquid fill */}
          <Group
            clip={{
              x: offsetX + 2,
              y: offsetY + 2,
              width: width - 4,
              height: height - 4,
            }}
          >
            <RoundedRect
              x={offsetX + 2}
              y={offsetY + 2}
              width={fillWidth.value}
              height={height - 4}
              r={BORDER_RADIUS - 2}
            >
              <LinearGradient
                start={vec(offsetX, offsetY)}
                end={vec(offsetX + width, offsetY)}
                colors={[
                  interpolateColor(sliderValue.value * 0.5),
                  interpolateColor(sliderValue.value),
                ]}
              />
            </RoundedRect>
          </Group>

          {/* Milestone markers */}
          {MILESTONES.map((milestone, idx) => {
            const markerX = offsetX + 2 + milestone * (width - 4);
            const reached = sliderValue.value >= milestone;
            return (
              <Circle
                key={idx}
                cx={markerX}
                cy={offsetY + height / 2}
                r={4}
                color={reached ? "#FFFFFF" : "rgba(255,255,255,0.3)"}
              />
            );
          })}

          {/* Edge highlight (top) */}
          <RoundedRect
            x={offsetX + 10}
            y={offsetY + 1}
            width={width - 20}
            height={1}
            r={0.5}
            color="rgba(255,255,255,0.25)"
          />
        </Group>
      </Canvas>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
});
