/**
 * useDepthPerception.ts - Gyroscope Parallax Hook
 *
 * Uses device gyroscope and accelerometer data from expo-sensors
 * to create 3D parallax effects on particle systems and UI layers.
 * The device tilt maps to camera offset in the 3D scene.
 */

import { useEffect, useCallback } from "react";
import { useSharedValue, withSpring, type SharedValue } from "react-native-reanimated";
import { Gyroscope, Accelerometer } from "expo-sensors";

// ── Types ──────────────────────────────────────────────────────

export interface DepthPerceptionResult {
  /** Device tilt X (-1 to 1) */
  tiltX: SharedValue<number>;
  /** Device tilt Y (-1 to 1) */
  tiltY: SharedValue<number>;
  /** Device rotation rate Z (rad/s) */
  rotationZ: SharedValue<number>;
  /** Start listening to sensors */
  start: () => void;
  /** Stop listening to sensors */
  stop: () => void;
}

// ── Config ─────────────────────────────────────────────────────

const SENSOR_UPDATE_INTERVAL = 16; // ~60fps
const TILT_SENSITIVITY = 0.3;
const SPRING_CONFIG = {
  damping: 25,
  stiffness: 150,
  mass: 0.8,
};

// ── Hook ───────────────────────────────────────────────────────

export function useDepthPerception(): DepthPerceptionResult {
  const tiltX = useSharedValue(0);
  const tiltY = useSharedValue(0);
  const rotationZ = useSharedValue(0);

  const start = useCallback(() => {
    Accelerometer.setUpdateInterval(SENSOR_UPDATE_INTERVAL);
    Gyroscope.setUpdateInterval(SENSOR_UPDATE_INTERVAL);

    Accelerometer.addListener(({ x, y }) => {
      // Accelerometer gives gravity vector. On a flat table:
      // x ≈ 0, y ≈ 0. Tilting maps naturally to parallax.
      tiltX.value = withSpring(
        clamp(x * TILT_SENSITIVITY, -1, 1),
        SPRING_CONFIG
      );
      tiltY.value = withSpring(
        clamp(y * TILT_SENSITIVITY, -1, 1),
        SPRING_CONFIG
      );
    });

    Gyroscope.addListener(({ z }) => {
      rotationZ.value = z;
    });
  }, [tiltX, tiltY, rotationZ]);

  const stop = useCallback(() => {
    Accelerometer.removeAllListeners();
    Gyroscope.removeAllListeners();
  }, []);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return { tiltX, tiltY, rotationZ, start, stop };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
