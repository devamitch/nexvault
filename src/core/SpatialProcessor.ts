/**
 * SpatialProcessor.ts - Hand-Space Mapping Engine
 *
 * Processes 21-point MediaPipe hand landmarks from VisionCamera
 * frame processor output and classifies gestures in real-time.
 *
 * Pipeline:
 *   Raw landmarks → Normalization → Feature extraction →
 *   Gesture classification → Velocity computation → Event emission
 *
 * Runs at 60fps on the JS thread, with SharedValue updates
 * bridged to the UI thread via Reanimated for 120fps rendering.
 */

// ── Types ──────────────────────────────────────────────────────

/** MediaPipe hand landmark indices */
export enum Landmark {
  WRIST = 0,
  THUMB_CMC = 1,
  THUMB_MCP = 2,
  THUMB_IP = 3,
  THUMB_TIP = 4,
  INDEX_MCP = 5,
  INDEX_PIP = 6,
  INDEX_DIP = 7,
  INDEX_TIP = 8,
  MIDDLE_MCP = 9,
  MIDDLE_PIP = 10,
  MIDDLE_DIP = 11,
  MIDDLE_TIP = 12,
  RING_MCP = 13,
  RING_PIP = 14,
  RING_DIP = 15,
  RING_TIP = 16,
  PINKY_MCP = 17,
  PINKY_PIP = 18,
  PINKY_DIP = 19,
  PINKY_TIP = 20,
}

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export type HandLandmarks = Point3D[];

export type GestureType =
  | "NONE"
  | "OPEN_PALM"
  | "POINTING"
  | "PINCH"
  | "GRAB"
  | "SWIPE_LEFT"
  | "SWIPE_RIGHT"
  | "PUSH"
  | "PULL";

export interface GestureResult {
  type: GestureType;
  confidence: number;
  handPosition: Point3D;
  /** Normalized 0-1 palm center position */
  normalizedPosition: Point3D;
  /** Pixels per frame velocity */
  velocity: Point3D;
  /** Distance between index tip and thumb tip (normalized) */
  pinchDistance: number;
  /** Whether a hand is currently detected */
  handDetected: boolean;
  timestamp: number;
}

type GestureCallback = (gesture: GestureResult) => void;

// ── Constants ──────────────────────────────────────────────────

const PINCH_THRESHOLD = 0.06; // Normalized distance for pinch detection
const SWIPE_VELOCITY_THRESHOLD = 0.015; // Per-frame velocity for swipe detection
const PUSH_PULL_VELOCITY_THRESHOLD = 0.01; // Z-axis velocity threshold
const FINGER_EXTENDED_THRESHOLD = 0.04; // Tip-to-MCP distance for extension check
const SMOOTHING_FACTOR = 0.3; // Exponential smoothing (lower = smoother)
const VELOCITY_HISTORY_SIZE = 5; // Frames to average for velocity

// ── Processor ──────────────────────────────────────────────────

export class SpatialProcessor {
  private gestureCallbacks: Set<GestureCallback> = new Set();
  private previousPosition: Point3D | null = null;
  private velocityHistory: Point3D[] = [];
  private smoothedPosition: Point3D = { x: 0.5, y: 0.5, z: 0.5 };
  private lastGestureType: GestureType = "NONE";
  private gestureHoldFrames = 0;
  private initialized = false;

  async initialize(): Promise<void> {
    // Reset internal state
    this.previousPosition = null;
    this.velocityHistory = [];
    this.smoothedPosition = { x: 0.5, y: 0.5, z: 0.5 };
    this.lastGestureType = "NONE";
    this.gestureHoldFrames = 0;
    this.initialized = true;
  }

  async dispose(): Promise<void> {
    this.gestureCallbacks.clear();
    this.initialized = false;
  }

  onGesture(callback: GestureCallback): () => void {
    this.gestureCallbacks.add(callback);
    return () => {
      this.gestureCallbacks.delete(callback);
    };
  }

  /**
   * Main processing pipeline. Called once per camera frame with
   * the 21 MediaPipe hand landmarks.
   */
  processLandmarks(landmarks: HandLandmarks): GestureResult {
    if (!landmarks || landmarks.length < 21) {
      return this.createEmptyResult();
    }

    // 1. Extract key points
    const indexTip = landmarks[Landmark.INDEX_TIP];
    const thumbTip = landmarks[Landmark.THUMB_TIP];
    const palmCenter = this.calculatePalmCenter(landmarks);

    // 2. Normalize position (0-1 range)
    const normalized = this.normalizePosition(palmCenter);

    // 3. Apply exponential smoothing
    this.smoothedPosition = {
      x: lerp(this.smoothedPosition.x, normalized.x, SMOOTHING_FACTOR),
      y: lerp(this.smoothedPosition.y, normalized.y, SMOOTHING_FACTOR),
      z: lerp(this.smoothedPosition.z, normalized.z, SMOOTHING_FACTOR),
    };

    // 4. Calculate velocity
    const velocity = this.calculateVelocity(this.smoothedPosition);

    // 5. Calculate pinch distance
    const pinchDistance = distance3D(indexTip, thumbTip);

    // 6. Classify gesture
    const gesture = this.classifyGesture(
      landmarks,
      pinchDistance,
      velocity
    );

    // 7. Apply gesture stability (debouncing)
    const stableGesture = this.stabilizeGesture(gesture);

    // 8. Build result
    const result: GestureResult = {
      type: stableGesture,
      confidence: this.calculateConfidence(stableGesture, landmarks),
      handPosition: palmCenter,
      normalizedPosition: { ...this.smoothedPosition },
      velocity,
      pinchDistance,
      handDetected: true,
      timestamp: Date.now(),
    };

    // 9. Emit to listeners
    this.gestureCallbacks.forEach((cb) => cb(result));

    // 10. Store for next frame
    this.previousPosition = { ...this.smoothedPosition };

    return result;
  }

  // ── Feature Extraction ──

  private calculatePalmCenter(landmarks: HandLandmarks): Point3D {
    // Average of wrist, index MCP, middle MCP, ring MCP, pinky MCP
    const palmIndices = [
      Landmark.WRIST,
      Landmark.INDEX_MCP,
      Landmark.MIDDLE_MCP,
      Landmark.RING_MCP,
      Landmark.PINKY_MCP,
    ];
    let x = 0,
      y = 0,
      z = 0;
    for (const idx of palmIndices) {
      x += landmarks[idx].x;
      y += landmarks[idx].y;
      z += landmarks[idx].z;
    }
    const count = palmIndices.length;
    return { x: x / count, y: y / count, z: z / count };
  }

  private normalizePosition(point: Point3D): Point3D {
    // MediaPipe landmarks are already normalized 0-1 for x,y.
    // Z is relative depth where smaller = closer to camera.
    return {
      x: clamp(point.x, 0, 1),
      y: clamp(point.y, 0, 1),
      z: clamp(point.z + 0.5, 0, 1), // Shift z into 0-1 range
    };
  }

  private calculateVelocity(current: Point3D): Point3D {
    if (!this.previousPosition) {
      return { x: 0, y: 0, z: 0 };
    }

    const instantVelocity: Point3D = {
      x: current.x - this.previousPosition.x,
      y: current.y - this.previousPosition.y,
      z: current.z - this.previousPosition.z,
    };

    // Maintain rolling average for stability
    this.velocityHistory.push(instantVelocity);
    if (this.velocityHistory.length > VELOCITY_HISTORY_SIZE) {
      this.velocityHistory.shift();
    }

    // Average velocity over history window
    const avg: Point3D = { x: 0, y: 0, z: 0 };
    for (const v of this.velocityHistory) {
      avg.x += v.x;
      avg.y += v.y;
      avg.z += v.z;
    }
    const n = this.velocityHistory.length;
    return { x: avg.x / n, y: avg.y / n, z: avg.z / n };
  }

  // ── Gesture Classification ──

  private classifyGesture(
    landmarks: HandLandmarks,
    pinchDistance: number,
    velocity: Point3D
  ): GestureType {
    // Priority-ordered classification

    // 1. Swipe detection (highest priority for navigation)
    if (velocity.x < -SWIPE_VELOCITY_THRESHOLD) return "SWIPE_LEFT";
    if (velocity.x > SWIPE_VELOCITY_THRESHOLD) return "SWIPE_RIGHT";

    // 2. Push / Pull (Z-axis movement)
    if (velocity.z < -PUSH_PULL_VELOCITY_THRESHOLD) return "PUSH";
    if (velocity.z > PUSH_PULL_VELOCITY_THRESHOLD) return "PULL";

    // 3. Pinch
    if (pinchDistance < PINCH_THRESHOLD) return "PINCH";

    // 4. Grab (all fingers curled)
    if (this.isAllFingersCurled(landmarks)) return "GRAB";

    // 5. Pointing (only index extended)
    if (this.isPointing(landmarks)) return "POINTING";

    // 6. Open palm (all fingers extended)
    if (this.isOpenPalm(landmarks)) return "OPEN_PALM";

    return "NONE";
  }

  private isFingerExtended(
    landmarks: HandLandmarks,
    tipIdx: number,
    mcpIdx: number
  ): boolean {
    const tip = landmarks[tipIdx];
    const mcp = landmarks[mcpIdx];
    // Finger is extended if tip is significantly farther from wrist than MCP
    const wrist = landmarks[Landmark.WRIST];
    const tipDist = distance3D(tip, wrist);
    const mcpDist = distance3D(mcp, wrist);
    return tipDist - mcpDist > FINGER_EXTENDED_THRESHOLD;
  }

  private isOpenPalm(landmarks: HandLandmarks): boolean {
    return (
      this.isFingerExtended(landmarks, Landmark.INDEX_TIP, Landmark.INDEX_MCP) &&
      this.isFingerExtended(landmarks, Landmark.MIDDLE_TIP, Landmark.MIDDLE_MCP) &&
      this.isFingerExtended(landmarks, Landmark.RING_TIP, Landmark.RING_MCP) &&
      this.isFingerExtended(landmarks, Landmark.PINKY_TIP, Landmark.PINKY_MCP)
    );
  }

  private isPointing(landmarks: HandLandmarks): boolean {
    const indexExtended = this.isFingerExtended(
      landmarks,
      Landmark.INDEX_TIP,
      Landmark.INDEX_MCP
    );
    const middleCurled = !this.isFingerExtended(
      landmarks,
      Landmark.MIDDLE_TIP,
      Landmark.MIDDLE_MCP
    );
    const ringCurled = !this.isFingerExtended(
      landmarks,
      Landmark.RING_TIP,
      Landmark.RING_MCP
    );
    return indexExtended && middleCurled && ringCurled;
  }

  private isAllFingersCurled(landmarks: HandLandmarks): boolean {
    return (
      !this.isFingerExtended(landmarks, Landmark.INDEX_TIP, Landmark.INDEX_MCP) &&
      !this.isFingerExtended(landmarks, Landmark.MIDDLE_TIP, Landmark.MIDDLE_MCP) &&
      !this.isFingerExtended(landmarks, Landmark.RING_TIP, Landmark.RING_MCP) &&
      !this.isFingerExtended(landmarks, Landmark.PINKY_TIP, Landmark.PINKY_MCP)
    );
  }

  /**
   * Prevents rapid gesture flickering by requiring a gesture to be
   * consistently detected for a minimum number of frames.
   */
  private stabilizeGesture(gesture: GestureType): GestureType {
    if (gesture === this.lastGestureType) {
      this.gestureHoldFrames++;
    } else {
      this.gestureHoldFrames = 0;
    }

    // Swipes are instant (no hold needed)
    if (
      gesture === "SWIPE_LEFT" ||
      gesture === "SWIPE_RIGHT" ||
      gesture === "PUSH" ||
      gesture === "PULL"
    ) {
      this.lastGestureType = gesture;
      return gesture;
    }

    // Static gestures require 3 consistent frames
    if (this.gestureHoldFrames >= 3) {
      this.lastGestureType = gesture;
      return gesture;
    }

    return this.lastGestureType;
  }

  private calculateConfidence(
    gesture: GestureType,
    _landmarks: HandLandmarks
  ): number {
    if (gesture === "NONE") return 0;
    // Base confidence from hold frame count, capped at 1.0
    const holdConfidence = Math.min(this.gestureHoldFrames / 10, 1);
    return 0.6 + holdConfidence * 0.4;
  }

  private createEmptyResult(): GestureResult {
    return {
      type: "NONE",
      confidence: 0,
      handPosition: { x: 0, y: 0, z: 0 },
      normalizedPosition: { x: 0.5, y: 0.5, z: 0.5 },
      velocity: { x: 0, y: 0, z: 0 },
      pinchDistance: 1,
      handDetected: false,
      timestamp: Date.now(),
    };
  }
}

// ── Math Utilities ─────────────────────────────────────────────

function distance3D(a: Point3D, b: Point3D): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
