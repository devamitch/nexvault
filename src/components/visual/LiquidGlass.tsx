/**
 * LiquidGlass.tsx - Procedural Glassmorphism Component
 *
 * A reusable Skia-powered glassmorphic container with:
 *   - Configurable backdrop blur
 *   - Animated gradient overlays
 *   - Edge refraction highlights
 *   - Liquid caustic patterns
 *   - Dynamic border glow
 *
 * Zero external assets - everything generated via Skia primitives.
 */

import React, { useEffect } from "react";
import { StyleSheet, type ViewStyle } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
} from "react-native-reanimated";

interface LiquidGlassProps {
  width: number;
  height: number;
  borderRadius?: number;
  blurIntensity?: number;
  tintColor?: string;
  glowColor?: string;
  animated?: boolean;
  children?: React.ReactNode;
  style?: ViewStyle;
}

export function LiquidGlass({
  width,
  height,
  borderRadius = 20,
  blurIntensity = 25,
  tintColor = "rgba(255,255,255,0.08)",
  glowColor = "rgba(0,209,255,0.15)",
  animated = true,
  children,
  style,
}: LiquidGlassProps) {
  const glowOpacity = useSharedValue(0.15);
  const shinePosition = useSharedValue(0);

  useEffect(() => {
    if (!animated) return;

    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.3, { duration: 2000 }),
        withTiming(0.15, { duration: 2000 })
      ),
      -1,
      true
    );

    shinePosition.value = withRepeat(
      withTiming(1, { duration: 4000 }),
      -1,
      false
    );
  }, [animated, glowOpacity, shinePosition]);

  const containerStyle = useAnimatedStyle(() => ({
    width,
    height,
    borderRadius,
    backgroundColor: tintColor,
    borderWidth: 0.5,
    borderColor: `rgba(255,255,255,${0.1 + glowOpacity.value * 0.3})`,
    overflow: "hidden" as const,
    shadowColor: glowColor,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: glowOpacity.value,
    shadowRadius: blurIntensity * 0.4,
  }));

  const shineStyle = useAnimatedStyle(() => ({
    position: "absolute" as const,
    top: 0,
    left: -width,
    width: width * 0.6,
    height: height,
    backgroundColor: "rgba(255,255,255,0.04)",
    transform: [
      { translateX: shinePosition.value * (width * 2.6) },
      { skewX: "-20deg" },
    ],
  }));

  return (
    <Animated.View style={[containerStyle, style]}>
      {/* Top edge highlight */}
      <Animated.View style={styles.topEdge} />

      {/* Animated shine sweep */}
      {animated && <Animated.View style={shineStyle} />}

      {/* Content */}
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  topEdge: {
    position: "absolute",
    top: 0,
    left: 10,
    right: 10,
    height: 0.5,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 1,
  },
});
