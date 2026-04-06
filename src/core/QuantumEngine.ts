/**
 * QuantumEngine.ts - Main Reality Bridge
 *
 * Central orchestrator that connects all subsystems:
 * - Spatial hand tracking pipeline
 * - Voice consciousness interface
 * - Biometric security vault
 * - Particle visual engine
 * - Haptic feedback system
 *
 * Manages application lifecycle, phase transitions, and
 * cross-system event propagation.
 */

import { SpatialProcessor, HandLandmarks, GestureResult } from "./SpatialProcessor";
import { VoiceNexus, VoiceCommand } from "./VoiceNexus";
import { BiometricVault, AuthResult } from "./BiometricVault";
import * as Haptics from "expo-haptics";

// ── Types ──────────────────────────────────────────────────────

export type Phase =
  | "CALIBRATION"
  | "AUTHENTICATION"
  | "HUB"
  | "VAULT"
  | "MEMO";

export type InteractionMode = "GESTURE" | "VOICE" | "HYBRID" | "TOUCH";

export interface EngineConfig {
  targetFps: number;
  particleBudget: number;
  enableVoice: boolean;
  enableHaptics: boolean;
  enableCamera: boolean;
  preferredHandedness: "LEFT" | "RIGHT";
}

export interface EngineState {
  phase: Phase;
  isRunning: boolean;
  fps: number;
  frameCount: number;
  interactionMode: InteractionMode;
  lastGesture: GestureResult | null;
  lastVoiceCommand: VoiceCommand | null;
  isAuthenticated: boolean;
}

type EngineEventType =
  | "phaseChange"
  | "gesture"
  | "voiceCommand"
  | "authResult"
  | "error";

type EngineEventCallback = (data: unknown) => void;

const DEFAULT_CONFIG: EngineConfig = {
  targetFps: 60,
  particleBudget: 5000,
  enableVoice: true,
  enableHaptics: true,
  enableCamera: true,
  preferredHandedness: "RIGHT",
};

// ── Engine ─────────────────────────────────────────────────────

export class QuantumEngine {
  private config: EngineConfig;
  private state: EngineState;
  private spatialProcessor: SpatialProcessor;
  private voiceNexus: VoiceNexus;
  private biometricVault: BiometricVault;
  private listeners: Map<EngineEventType, Set<EngineEventCallback>>;
  private frameTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: Partial<EngineConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = {
      phase: "CALIBRATION",
      isRunning: false,
      fps: 0,
      frameCount: 0,
      interactionMode: "HYBRID",
      lastGesture: null,
      lastVoiceCommand: null,
      isAuthenticated: false,
    };
    this.listeners = new Map();
    this.spatialProcessor = new SpatialProcessor();
    this.voiceNexus = new VoiceNexus();
    this.biometricVault = new BiometricVault();
  }

  // ── Lifecycle ──

  async initialize(): Promise<void> {
    try {
      // Initialize subsystems in parallel where possible
      const initTasks: Promise<void>[] = [];

      if (this.config.enableCamera) {
        initTasks.push(this.spatialProcessor.initialize());
      }
      if (this.config.enableVoice) {
        initTasks.push(this.voiceNexus.initialize());
      }

      await Promise.all(initTasks);

      // Set up cross-system event wiring
      this.wireSubsystems();
      this.state.isRunning = true;
      this.startFrameCounter();
    } catch (error) {
      this.emit("error", {
        source: "QuantumEngine.initialize",
        error,
      });
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    this.state.isRunning = false;
    this.stopFrameCounter();

    await Promise.all([
      this.spatialProcessor.dispose(),
      this.voiceNexus.dispose(),
    ]);

    this.listeners.clear();
  }

  // ── Phase Management ──

  async transitionToPhase(nextPhase: Phase): Promise<void> {
    const previousPhase = this.state.phase;

    // Validate transition
    if (!this.isValidTransition(previousPhase, nextPhase)) {
      throw new Error(
        `Invalid phase transition: ${previousPhase} → ${nextPhase}`
      );
    }

    // Execute exit logic for current phase
    await this.onPhaseExit(previousPhase);

    // Apply haptic feedback for transition
    if (this.config.enableHaptics) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }

    this.state.phase = nextPhase;
    this.emit("phaseChange", { from: previousPhase, to: nextPhase });

    // Execute entry logic for new phase
    await this.onPhaseEnter(nextPhase);
  }

  private isValidTransition(from: Phase, to: Phase): boolean {
    const validTransitions: Record<Phase, Phase[]> = {
      CALIBRATION: ["AUTHENTICATION"],
      AUTHENTICATION: ["HUB", "CALIBRATION"],
      HUB: ["VAULT", "MEMO", "AUTHENTICATION"],
      VAULT: ["HUB"],
      MEMO: ["HUB"],
    };
    return validTransitions[from]?.includes(to) ?? false;
  }

  private async onPhaseExit(_phase: Phase): Promise<void> {
    // Cleanup logic per phase if needed
  }

  private async onPhaseEnter(phase: Phase): Promise<void> {
    switch (phase) {
      case "AUTHENTICATION":
        // Voice nexus pauses during auth
        if (this.config.enableVoice) {
          this.voiceNexus.pause();
        }
        break;
      case "HUB":
        // Resume voice listening on hub entry
        if (this.config.enableVoice) {
          this.voiceNexus.resume();
        }
        break;
    }
  }

  // ── Subsystem Wiring ──

  private wireSubsystems(): void {
    // Forward spatial gestures to engine event bus
    this.spatialProcessor.onGesture((gesture) => {
      this.state.lastGesture = gesture;
      this.emit("gesture", gesture);
      this.handleGestureHaptics(gesture);
    });

    // Forward voice commands to engine event bus
    this.voiceNexus.onCommand((command) => {
      this.state.lastVoiceCommand = command;
      this.emit("voiceCommand", command);
    });
  }

  private async handleGestureHaptics(gesture: GestureResult): Promise<void> {
    if (!this.config.enableHaptics) return;

    switch (gesture.type) {
      case "PINCH":
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        break;
      case "GRAB":
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        break;
      case "OPEN_PALM":
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        break;
      case "SWIPE_LEFT":
      case "SWIPE_RIGHT":
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        );
        break;
    }
  }

  // ── Authentication ──

  async authenticate(): Promise<AuthResult> {
    const result = await this.biometricVault.authenticate();
    this.state.isAuthenticated = result.success;
    this.emit("authResult", result);

    if (result.success && this.config.enableHaptics) {
      // Success haptic pattern: 3 quick pulses
      for (let i = 0; i < 3; i++) {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await delay(80);
      }
    } else if (!result.success && this.config.enableHaptics) {
      // Error haptic pattern: 2 long pulses
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      await delay(200);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }

    return result;
  }

  // ── Hand Tracking Bridge ──

  processFrame(landmarks: HandLandmarks): GestureResult | null {
    if (!this.state.isRunning) return null;
    this.state.frameCount++;
    return this.spatialProcessor.processLandmarks(landmarks);
  }

  // ── FPS Counter ──

  private startFrameCounter(): void {
    let lastFrameCount = 0;
    this.frameTimer = setInterval(() => {
      this.state.fps = this.state.frameCount - lastFrameCount;
      lastFrameCount = this.state.frameCount;
    }, 1000);
  }

  private stopFrameCounter(): void {
    if (this.frameTimer) {
      clearInterval(this.frameTimer);
      this.frameTimer = null;
    }
  }

  // ── Event System ──

  on(event: EngineEventType, callback: EngineEventCallback): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  private emit(event: EngineEventType, data: unknown): void {
    this.listeners.get(event)?.forEach((cb) => cb(data));
  }

  // ── Accessors ──

  getState(): Readonly<EngineState> {
    return { ...this.state };
  }

  getConfig(): Readonly<EngineConfig> {
    return { ...this.config };
  }

  getSpatialProcessor(): SpatialProcessor {
    return this.spatialProcessor;
  }

  getVoiceNexus(): VoiceNexus {
    return this.voiceNexus;
  }

  getBiometricVault(): BiometricVault {
    return this.biometricVault;
  }
}

// ── Singleton Factory ──

let engineInstance: QuantumEngine | null = null;

export function getQuantumEngine(
  config?: Partial<EngineConfig>
): QuantumEngine {
  if (!engineInstance) {
    engineInstance = new QuantumEngine(config);
  }
  return engineInstance;
}

export function resetQuantumEngine(): void {
  engineInstance?.shutdown();
  engineInstance = null;
}

// ── Utilities ──

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
