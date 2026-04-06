/**
 * SpatialGrab.tsx - AR Object Manipulation Component
 *
 * Wraps children in a spatial container that responds to
 * hand gestures for 3D manipulation:
 *   - Pinch to grab
 *   - Move hand to reposition
 *   - Push/pull for depth scaling
 *   - Release (open palm) to drop
 *
 * Objects animate with spring physics when grabbed/released.
 */

import React, { useEffect, useCallback } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  useDerivedValue,
  type SharedValue,
} from "react-native-reanimated";

interface SpatialGrabProps {
  /** Hand X position (0-1) */
  handX: SharedValue<number>;
  /** Hand Y position (0-1) */
  handY: SharedValue<number>;
  /** Hand Z depth (0-1) */
  handZ: SharedValue<number>;
  /** Current gesture type */
  gesture: SharedValue<string>;
  /** Container width */
  width: number;
  /** Container height */
  height: number;
  /** Whether this object is currently selected/targeted */
  isTarget?: boolean;
  /** Initial position X (screen coordinates) */
  initialX?: number;
  /** Initial position Y (screen coordinates) */
  initialY?: number;
  /** Called when object is grabbed */
  onGrab?: () => void;
  /** Called when object is released */
  onRelease?: () => void;
  children: React.ReactNode;
}

const SPRING = { damping: 20, stiffness: 200, mass: 0.5 };

export function SpatialGrab({
  handX,
  handY,
  handZ,
  gesture,
  width,
  height,
  isTarget = false,
  initialX = 0,
  initialY = 0,
  onGrab,
  onRelease,
  children,
}: SpatialGrabProps) {
  const isGrabbed = useSharedValue(false);
  const posX = useSharedValue(initialX);
  const posY = useSharedValue(initialY);
  const scale = useSharedValue(1);
  const glowIntensity = useSharedValue(0);

  // Track grab state
  useDerivedValue(() => {
    if (!isTarget) return;

    const isPinching = gesture.value === "PINCH" || gesture.value === "GRAB";

    if (isPinching && !isGrabbed.value) {
      isGrabbed.value = true;
      glowIntensity.value = withTiming(0.5, { duration: 200 });
      // Can't call onGrab here (UI thread), handled in effect
    } else if (!isPinching && isGrabbed.value) {
      isGrabbed.value = false;
      glowIntensity.value = withTiming(0, { duration: 300 });
    }

    // Follow hand when grabbed
    if (isGrabbed.value) {
      posX.value = withSpring(handX.value * width - 40, SPRING);
      posY.value = withSpring(handY.value * height - 40, SPRING);
      // Depth affects scale
      scale.value = withSpring(0.8 + handZ.value * 0.6, SPRING);
    }
  });

  // Target highlight effect
  useEffect(() => {
    if (isTarget) {
      glowIntensity.value = withSpring(0.3, SPRING);
    } else {
      glowIntensity.value = withTiming(0, { duration: 300 });
    }
  }, [isTarget, glowIntensity]);

  const containerStyle = useAnimatedStyle(() => ({
    position: "absolute" as const,
    transform: [
      { translateX: posX.value },
      { translateY: posY.value },
      { scale: scale.value },
    ],
    shadowColor: "#00D1FF",
    shadowOpacity: glowIntensity.value,
    shadowRadius: 15,
  }));

  return (
    <Animated.View style={containerStyle}>
      {children}
    </Animated.View>
  );
}
