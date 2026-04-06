/**
 * handLandmarkProcessor.ts
 *
 * Utility functions for processing raw MediaPipe hand landmark
 * data from the VisionCamera frame processor.
 *
 * In production, the frame processor worklet would call MediaPipe's
 * Hand Landmarker, which outputs 21 3D landmarks per detected hand.
 * These utilities normalize, filter, and prepare that data for
 * consumption by the SpatialProcessor.
 */

import type { Point3D, HandLandmarks } from "../core/SpatialProcessor";

// ── Types ──────────────────────────────────────────────────────

export interface RawMediaPipeLandmark {
  x: number; // Normalized 0-1 (image width)
  y: number; // Normalized 0-1 (image height)
  z: number; // Relative depth (negative = closer)
}

export interface HandDetectionResult {
  landmarks: HandLandmarks;
  handedness: "LEFT" | "RIGHT";
  score: number;
}

// ── Processing Functions ──────────────────────────────────────

/**
 * Convert raw MediaPipe landmark array to our Point3D format.
 * MediaPipe outputs landmarks as {x, y, z} where:
 *   x: 0.0 (left) to 1.0 (right) in image space
 *   y: 0.0 (top) to 1.0 (bottom) in image space
 *   z: relative depth, roughly same scale as x
 */
export function convertMediaPipeLandmarks(
  raw: RawMediaPipeLandmark[]
): HandLandmarks {
  return raw.map((lm) => ({
    x: lm.x,
    y: lm.y,
    z: lm.z,
  }));
}

/**
 * Mirror landmarks horizontally for front-facing camera.
 * Front camera produces mirrored image, so x needs flipping.
 */
export function mirrorLandmarks(landmarks: HandLandmarks): HandLandmarks {
  return landmarks.map((lm) => ({
    x: 1.0 - lm.x,
    y: lm.y,
    z: lm.z,
  }));
}

/**
 * Apply temporal smoothing to landmarks using exponential moving average.
 * Reduces jitter in tracking while maintaining responsiveness.
 */
export function smoothLandmarks(
  current: HandLandmarks,
  previous: HandLandmarks | null,
  alpha: number = 0.4
): HandLandmarks {
  if (!previous || previous.length !== current.length) {
    return current;
  }

  return current.map((curr, i) => ({
    x: previous[i].x + alpha * (curr.x - previous[i].x),
    y: previous[i].y + alpha * (curr.y - previous[i].y),
    z: previous[i].z + alpha * (curr.z - previous[i].z),
  }));
}

/**
 * Calculate the bounding box of a hand from its landmarks.
 * Useful for determining hand region for proximity calculations.
 */
export function getHandBoundingBox(landmarks: HandLandmarks): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  centerX: number;
  centerY: number;
  width: number;
  height: number;
} {
  let minX = Infinity,
    minY = Infinity;
  let maxX = -Infinity,
    maxY = -Infinity;

  for (const lm of landmarks) {
    minX = Math.min(minX, lm.x);
    minY = Math.min(minY, lm.y);
    maxX = Math.max(maxX, lm.x);
    maxY = Math.max(maxY, lm.y);
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Estimate hand size from landmarks. Useful for normalizing
 * gesture thresholds across different hand sizes and distances.
 */
export function estimateHandSize(landmarks: HandLandmarks): number {
  // Distance from wrist to middle finger tip
  const wrist = landmarks[0];
  const middleTip = landmarks[12];
  return distance(wrist, middleTip);
}

/**
 * Check if landmark data is valid (no NaN, within bounds).
 */
export function validateLandmarks(landmarks: HandLandmarks): boolean {
  if (landmarks.length !== 21) return false;

  for (const lm of landmarks) {
    if (isNaN(lm.x) || isNaN(lm.y) || isNaN(lm.z)) return false;
    if (lm.x < -0.5 || lm.x > 1.5) return false;
    if (lm.y < -0.5 || lm.y > 1.5) return false;
  }

  return true;
}

// ── Math Helpers ──────────────────────────────────────────────

function distance(a: Point3D, b: Point3D): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
