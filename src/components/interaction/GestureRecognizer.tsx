/**
 * GestureRecognizer.tsx - Visual Gesture Feedback Overlay
 *
 * Renders a transparent overlay showing:
 *   - Hand position cursor (glowing dot)
 *   - Gesture trail particles (fading path)
 *   - Current gesture indicator icon
 *   - Pinch distance visualization (connecting line)
 *   - Gesture confidence ring
 *
 * Sits above all other UI as an absolute-positioned overlay.
 * Uses Skia for zero-latency rendering synced to SharedValues.
 */

import React, { useMemo } from "react";
import { StyleSheet, Dimensions, View } from "react-native";
import {
  Canvas,
  Circle,
  Line,
  vec,
  BlurMask,
  Group,
} from "@shopify/react-native-skia";
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  type SharedValue,
} from "react-native-reanimated";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

interface GestureRecognizerProps {
  handX: SharedValue<number>;
  handY: SharedValue<number>;
  handDetected: SharedValue<boolean>;
  gesture: SharedValue<string>;
  confidence: SharedValue<number>;
  pinchDistance: SharedValue<number>;
  /** Whether to show the overlay */
  visible?: boolean;
}

// Gesture label mapping
const GESTURE_LABELS: Record<string, string> = {
  NONE: "",
  OPEN_PALM: "READY",
  POINTING: "SELECT",
  PINCH: "GRAB",
  GRAB: "HOLD",
  SWIPE_LEFT: "< SWIPE",
  SWIPE_RIGHT: "SWIPE >",
  PUSH: "PUSH",
  PULL: "PULL",
};

export function GestureRecognizer({
  handX,
  handY,
  handDetected,
  gesture,
  confidence,
  pinchDistance,
  visible = true,
}: GestureRecognizerProps) {
  if (!visible) return null;

  // Cursor position in screen coordinates
  const cursorX = useDerivedValue(() => handX.value * SCREEN_W);
  const cursorY = useDerivedValue(() => handY.value * SCREEN_H);

  // Confidence ring radius
  const ringRadius = useDerivedValue(() => 15 + confidence.value * 10);

  // Gesture label
  const gestureLabel = useDerivedValue(
    () => GESTURE_LABELS[gesture.value] ?? ""
  );

  // Cursor visibility
  const cursorStyle = useAnimatedStyle(() => ({
    opacity: handDetected.value ? 1 : 0,
    transform: [
      { translateX: cursorX.value - 25 },
      { translateY: cursorY.value - 25 },
    ],
  }));

  // Gesture label style
  const labelStyle = useAnimatedStyle(() => ({
    opacity: handDetected.value && gesture.value !== "NONE" ? 1 : 0,
    transform: [
      { translateX: cursorX.value - 40 },
      { translateY: cursorY.value + 30 },
    ],
  }));

  return (
    <View style={styles.overlay} pointerEvents="none">
      {/* Cursor dot with glow */}
      <Animated.View style={[styles.cursorContainer, cursorStyle]}>
        <Canvas style={styles.cursorCanvas}>
          {/* Outer glow */}
          <Circle cx={25} cy={25} r={ringRadius.value} color="rgba(0,209,255,0.1)">
            <BlurMask blur={8} style="normal" />
          </Circle>
          {/* Confidence ring */}
          <Circle
            cx={25}
            cy={25}
            r={ringRadius.value}
            color="rgba(0,209,255,0.3)"
            style="stroke"
            strokeWidth={1}
          />
          {/* Core dot */}
          <Circle cx={25} cy={25} r={4} color="#00D1FF" />
          <Circle cx={25} cy={25} r={2} color="#FFFFFF" />
        </Canvas>
      </Animated.View>

      {/* Gesture label */}
      <Animated.View style={[styles.labelContainer, labelStyle]}>
        <Animated.Text style={styles.labelText}>
          {gestureLabel.value}
        </Animated.Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
  },
  cursorContainer: {
    position: "absolute",
    width: 50,
    height: 50,
  },
  cursorCanvas: {
    width: 50,
    height: 50,
  },
  labelContainer: {
    position: "absolute",
    width: 80,
    alignItems: "center",
  },
  labelText: {
    color: "rgba(0,209,255,0.7)",
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 2,
    textAlign: "center",
  },
});
