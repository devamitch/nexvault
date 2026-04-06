/**
 * gestureClassifier.ts
 *
 * Supplementary gesture classification utilities that extend
 * the SpatialProcessor with complex multi-frame gesture detection.
 *
 * Handles compound gestures that require tracking over time:
 *   - Telekinetic Grab (pinch + hold + move)
 *   - Quantum Lock (pinch held for 2 seconds)
 *   - Void Dismiss (rapid palm spread)
 *   - Gesture Trails (position history with decay)
 */

import type { GestureType, Point3D, GestureResult } from "../core/SpatialProcessor";

// ── Types ──────────────────────────────────────────────────────

export type CompoundGesture =
  | "TELEKINETIC_GRAB"
  | "QUANTUM_LOCK"
  | "VOID_DISMISS"
  | "DEPTH_PUSH"
  | "DEPTH_PULL"
  | "NONE";

export interface GestureTrailPoint {
  position: Point3D;
  timestamp: number;
  gesture: GestureType;
  opacity: number; // Decays over time (1.0 → 0.0)
}

export interface CompoundGestureResult {
  type: CompoundGesture;
  progress: number; // 0-1 for gestures that build up
  trailPoints: GestureTrailPoint[];
}

// ── Constants ──────────────────────────────────────────────────

const QUANTUM_LOCK_DURATION_MS = 2000;
const TRAIL_MAX_LENGTH = 60; // frames (~1 second at 60fps)
const TRAIL_DECAY_RATE = 0.02; // opacity loss per frame

// ── Compound Gesture Classifier ───────────────────────────────

export class CompoundGestureClassifier {
  private gestureHistory: GestureResult[] = [];
  private trail: GestureTrailPoint[] = [];
  private pinchStartTime: number | null = null;
  private isDragging = false;
  private dragStartPosition: Point3D | null = null;

  /**
   * Process a gesture frame and detect compound gestures.
   */
  classify(gesture: GestureResult): CompoundGestureResult {
    // Update history
    this.gestureHistory.push(gesture);
    if (this.gestureHistory.length > 120) {
      this.gestureHistory.shift();
    }

    // Update trail
    this.updateTrail(gesture);

    // Detect compound gestures
    const compound = this.detectCompoundGesture(gesture);

    return {
      type: compound.type,
      progress: compound.progress,
      trailPoints: [...this.trail],
    };
  }

  private updateTrail(gesture: GestureResult): void {
    if (gesture.handDetected) {
      this.trail.push({
        position: { ...gesture.normalizedPosition },
        timestamp: gesture.timestamp,
        gesture: gesture.type,
        opacity: 1.0,
      });
    }

    // Limit trail length
    if (this.trail.length > TRAIL_MAX_LENGTH) {
      this.trail.shift();
    }

    // Decay opacity
    for (const point of this.trail) {
      point.opacity = Math.max(0, point.opacity - TRAIL_DECAY_RATE);
    }

    // Remove fully faded points
    this.trail = this.trail.filter((p) => p.opacity > 0);
  }

  private detectCompoundGesture(gesture: GestureResult): {
    type: CompoundGesture;
    progress: number;
  } {
    const now = Date.now();

    // ── Quantum Lock: Pinch held for 2 seconds ──
    if (gesture.type === "PINCH") {
      if (!this.pinchStartTime) {
        this.pinchStartTime = now;
      }

      const holdDuration = now - this.pinchStartTime;
      if (holdDuration >= QUANTUM_LOCK_DURATION_MS) {
        this.pinchStartTime = null;
        return { type: "QUANTUM_LOCK", progress: 1 };
      }

      // Check if hand is also moving (Telekinetic Grab)
      const velocity = Math.abs(gesture.velocity.x) + Math.abs(gesture.velocity.y);
      if (velocity > 0.005) {
        if (!this.isDragging) {
          this.isDragging = true;
          this.dragStartPosition = { ...gesture.normalizedPosition };
        }
        return { type: "TELEKINETIC_GRAB", progress: 1 };
      }

      // Still holding pinch, show lock progress
      return {
        type: "NONE",
        progress: holdDuration / QUANTUM_LOCK_DURATION_MS,
      };
    } else {
      this.pinchStartTime = null;
      this.isDragging = false;
      this.dragStartPosition = null;
    }

    // ── Void Dismiss: Rapid palm spread ──
    if (gesture.type === "OPEN_PALM" && this.gestureHistory.length >= 5) {
      const recentHistory = this.gestureHistory.slice(-5);
      const wasClosed = recentHistory.some(
        (g) => g.type === "GRAB" || g.type === "PINCH"
      );
      if (wasClosed) {
        return { type: "VOID_DISMISS", progress: 1 };
      }
    }

    // ── Depth Push/Pull: Sustained Z movement ──
    if (gesture.type === "PUSH") {
      return { type: "DEPTH_PUSH", progress: Math.abs(gesture.velocity.z) * 50 };
    }
    if (gesture.type === "PULL") {
      return { type: "DEPTH_PULL", progress: Math.abs(gesture.velocity.z) * 50 };
    }

    return { type: "NONE", progress: 0 };
  }

  /**
   * Get the current gesture trail for visualization.
   */
  getTrail(): GestureTrailPoint[] {
    return [...this.trail];
  }

  /**
   * Clear all state.
   */
  reset(): void {
    this.gestureHistory = [];
    this.trail = [];
    this.pinchStartTime = null;
    this.isDragging = false;
    this.dragStartPosition = null;
  }
}
