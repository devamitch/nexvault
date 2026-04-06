/**
 * useSpatialTracking.ts - Hand Tracking Hook
 *
 * Bridges the VisionCamera frame processor output to
 * React components via Reanimated SharedValues for
 * zero-bridge-crossing 120fps UI updates.
 *
 * Provides:
 *   - Shared values for hand position (x, y, z)
 *   - Current gesture classification
 *   - Pinch distance for slider/grab interactions
 *   - Hand detection status
 *
 * Usage:
 *   const { handX, handY, handZ, gesture } = useSpatialTracking();
 *   // Use handX/handY/handZ in Reanimated animated styles
 */

import { useCallback, useEffect, useRef } from "react";
import {
  runOnJS,
  useSharedValue,
  withSpring,
  type SharedValue,
} from "react-native-reanimated";
import {
  SpatialProcessor,
  type GestureType,
  type HandLandmarks,
} from "../core/SpatialProcessor";
import { useQuantumStore } from "../store/quantumStore";

// ── Types ──────────────────────────────────────────────────────

export interface SpatialTrackingResult {
  /** Smoothed hand X position (0-1), animated shared value */
  handX: SharedValue<number>;
  /** Smoothed hand Y position (0-1), animated shared value */
  handY: SharedValue<number>;
  /** Smoothed hand Z depth (0-1), animated shared value */
  handZ: SharedValue<number>;
  /** Current pinch distance (0-1), animated shared value */
  pinchDistance: SharedValue<number>;
  /** Whether a hand is currently detected */
  handDetected: SharedValue<boolean>;
  /** Current gesture type string */
  gesture: SharedValue<string>;
  /** Gesture confidence 0-1 */
  confidence: SharedValue<number>;
  /** Hand velocity X */
  velocityX: SharedValue<number>;
  /** Hand velocity Y */
  velocityY: SharedValue<number>;
  /** Process a frame of hand landmarks (call from frame processor) */
  processFrame: (landmarks: HandLandmarks) => void;
  /** Reset tracking state */
  reset: () => void;
}

// ── Spring Config ──────────────────────────────────────────────

const POSITION_SPRING = {
  damping: 20,
  stiffness: 300,
  mass: 0.5,
};

const PINCH_SPRING = {
  damping: 15,
  stiffness: 200,
  mass: 0.3,
};

import { Accelerometer } from "expo-sensors";

// ── Hook ───────────────────────────────────────────────────────

export function useSpatialTracking(): SpatialTrackingResult {
  const processorRef = useRef<SpatialProcessor>(new SpatialProcessor());
  const updateHandTracking = useQuantumStore((s) => s.updateHandTracking);

  // Shared values live on the UI thread for direct animation binding
  const handX = useSharedValue(0.5);
  const handY = useSharedValue(0.5);
  const handZ = useSharedValue(0.5);
  const pinchDistance = useSharedValue(1);
  const handDetected = useSharedValue(false);
  const gesture = useSharedValue("NONE");
  const confidence = useSharedValue(0);
  const velocityX = useSharedValue(0);
  const velocityY = useSharedValue(0);

  // ── Gyroscope Fallback ──
  // If no landmarks arrive, we use device tilt to simulate hand movement
  useEffect(() => {
    const sub = Accelerometer.addListener(({ x, y }) => {
      // If no recent hand landmarks, drive mapping via tilt
      // x is side-to-side (-1 to 1) -> handX (inverted + offset)
      // y is forward-backward (-1 to 1) -> handY
      if (!handDetected.value) {
        handX.value = withSpring(0.5 - x * 0.8, POSITION_SPRING);
        handY.value = withSpring(0.5 - y * 0.8, POSITION_SPRING);
        handZ.value = withSpring(0.8, POSITION_SPRING); // Default depth
      }
    });

    Accelerometer.setUpdateInterval(16);

    return () => sub.remove();
  }, [handX, handY, handZ, handDetected]);

  useEffect(() => {
    const processor = processorRef.current;
    processor.initialize();
    return () => {
      processor.dispose();
    };
  }, []);

  // Bridge gesture results to zustand store (throttled to 30fps)
  const lastStoreUpdate = useRef(0);
  const syncToStore = useCallback(
    (
      gestureType: GestureType,
      conf: number,
      detected: boolean,
      pinch: number,
      x: number,
      y: number,
      z: number
    ) => {
      const now = Date.now();
      if (now - lastStoreUpdate.current < 33) return; // ~30fps store updates
      lastStoreUpdate.current = now;

      updateHandTracking({
        position: { x, y, z },
        normalized: { x, y, z },
        gesture: gestureType,
        confidence: conf,
        detected,
        pinchDistance: pinch,
      });
    },
    [updateHandTracking]
  );

  const processFrame = useCallback(
    (landmarks: HandLandmarks) => {
      const result = processorRef.current.processLandmarks(landmarks);

      // Update shared values with spring physics for smooth rendering
      handX.value = withSpring(result.normalizedPosition.x, POSITION_SPRING);
      handY.value = withSpring(result.normalizedPosition.y, POSITION_SPRING);
      handZ.value = withSpring(result.normalizedPosition.z, POSITION_SPRING);
      pinchDistance.value = withSpring(result.pinchDistance, PINCH_SPRING);
      handDetected.value = result.handDetected;
      gesture.value = result.type;
      confidence.value = result.confidence;
      velocityX.value = result.velocity.x;
      velocityY.value = result.velocity.y;

      // Sync to zustand store at lower frequency
      runOnJS(syncToStore)(
        result.type,
        result.confidence,
        result.handDetected,
        result.pinchDistance,
        result.normalizedPosition.x,
        result.normalizedPosition.y,
        result.normalizedPosition.z
      );
    },
    [
      handX,
      handY,
      handZ,
      pinchDistance,
      handDetected,
      gesture,
      confidence,
      velocityX,
      velocityY,
      syncToStore,
    ]
  );

  const reset = useCallback(() => {
    handX.value = 0.5;
    handY.value = 0.5;
    handZ.value = 0.5;
    pinchDistance.value = 1;
    handDetected.value = false;
    gesture.value = "NONE";
    confidence.value = 0;
    velocityX.value = 0;
    velocityY.value = 0;
  }, [
    handX,
    handY,
    handZ,
    pinchDistance,
    handDetected,
    gesture,
    confidence,
    velocityX,
    velocityY,
  ]);

  return {
    handX,
    handY,
    handZ,
    pinchDistance,
    handDetected,
    gesture,
    confidence,
    velocityX,
    velocityY,
    processFrame,
    reset,
  };
}
