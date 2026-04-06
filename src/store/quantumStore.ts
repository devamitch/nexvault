/**
 * quantumStore.ts - Zustand State Management with Persist
 *
 * Central state store for the entire application.
 * Uses zustand with AsyncStorage persistence middleware
 * for state survival across app restarts.
 *
 * State is partitioned into logical domains:
 *   - Phase control (navigation state machine)
 *   - Spatial tracking (hand position, gestures)
 *   - Voice state (listening, transcripts)
 *   - Vault data (items, selected item)
 *   - Voice memos
 *   - Visual state (particle count, island mode)
 *   - User preferences
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Phase, InteractionMode } from "../core/QuantumEngine";
import type { GestureType, Point3D } from "../core/SpatialProcessor";
import type { VoiceCommand } from "../core/VoiceNexus";

// ── Types ──────────────────────────────────────────────────────

export type IslandState = "IDLE" | "LISTENING" | "PROCESSING" | "ALERT";

export interface AlertInfo {
  type: "INFO" | "WARNING" | "SUCCESS" | "ERROR";
  message: string;
  timestamp: number;
}

export interface VaultItemData {
  id: string;
  type: "MEMO" | "RESEARCH" | "DATA" | "NOTE";
  title: string;
  content: string;
  createdAt: number;
  accessedAt: number;
  accessCount: number;
  tags: string[];
  importance: number;
}

export interface MemoData {
  id: string;
  audioUri: string;
  duration: number;
  transcript: string;
  createdAt: number;
  tags: string[];
  /** Serialized waveform amplitude samples */
  waveformData: number[];
}

// ── State Interface ────────────────────────────────────────────

interface QuantumState {
  // Phase Control
  currentPhase: Phase;
  onboardingComplete: boolean;
  isAuthenticated: boolean;

  // Spatial Tracking
  handPosition: Point3D;
  normalizedHandPosition: Point3D;
  currentGesture: GestureType;
  gestureConfidence: number;
  handDetected: boolean;
  pinchDistance: number;

  // Voice State
  isListening: boolean;
  isRecordingMemo: boolean;
  currentTranscript: string;
  lastCommand: VoiceCommand | null;
  audioAmplitude: number;

  // Vault Data
  vaultItems: VaultItemData[];
  selectedItemId: string | null;

  // Voice Memos
  memos: MemoData[];

  // Interaction
  sliderValue: number;
  interactionMode: InteractionMode;

  // Visual State
  particleCount: number;
  islandState: IslandState;
  currentAlert: AlertInfo | null;

  // Persistence
  lastSync: number;
  preferredHandedness: "LEFT" | "RIGHT";

  // ── Actions ──

  // Phase
  setPhase: (phase: Phase) => void;
  completeOnboarding: () => void;
  setAuthenticated: (value: boolean) => void;

  // Spatial
  updateHandTracking: (data: {
    position: Point3D;
    normalized: Point3D;
    gesture: GestureType;
    confidence: number;
    detected: boolean;
    pinchDistance: number;
  }) => void;

  // Voice
  setListening: (value: boolean) => void;
  setRecordingMemo: (value: boolean) => void;
  setTranscript: (text: string) => void;
  setLastCommand: (command: VoiceCommand | null) => void;
  setAudioAmplitude: (level: number) => void;

  // Vault
  addVaultItem: (item: VaultItemData) => void;
  updateVaultItem: (id: string, updates: Partial<VaultItemData>) => void;
  removeVaultItem: (id: string) => void;
  selectItem: (id: string | null) => void;

  // Memos
  addMemo: (memo: MemoData) => void;
  removeMemo: (id: string) => void;

  // Interaction
  setSliderValue: (value: number) => void;
  setInteractionMode: (mode: InteractionMode) => void;

  // Visual
  setParticleCount: (count: number) => void;
  setIslandState: (state: IslandState) => void;
  showAlert: (alert: AlertInfo) => void;
  dismissAlert: () => void;

  // Preferences
  setHandedness: (hand: "LEFT" | "RIGHT") => void;

  // Reset
  resetState: () => void;
}

// ── Default State ──────────────────────────────────────────────

const DEFAULT_STATE = {
  currentPhase: "CALIBRATION" as Phase,
  onboardingComplete: false,
  isAuthenticated: false,

  handPosition: { x: 0, y: 0, z: 0 },
  normalizedHandPosition: { x: 0.5, y: 0.5, z: 0.5 },
  currentGesture: "NONE" as GestureType,
  gestureConfidence: 0,
  handDetected: false,
  pinchDistance: 1,

  isListening: false,
  isRecordingMemo: false,
  currentTranscript: "",
  lastCommand: null,
  audioAmplitude: 0,

  vaultItems: [] as VaultItemData[],
  selectedItemId: null,

  memos: [] as MemoData[],

  sliderValue: 0,
  interactionMode: "HYBRID" as InteractionMode,

  particleCount: 2000,
  islandState: "IDLE" as IslandState,
  currentAlert: null,

  lastSync: 0,
  preferredHandedness: "RIGHT" as const,
};

// ── Store ──────────────────────────────────────────────────────

export const useQuantumStore = create<QuantumState>()(
  persist(
    (set, _get) => ({
      ...DEFAULT_STATE,

      // Phase
      setPhase: (phase) =>
        set({ currentPhase: phase }),

      completeOnboarding: () =>
        set({ onboardingComplete: true }),

      setAuthenticated: (value) =>
        set({ isAuthenticated: value }),

      // Spatial - uses a single setter for all tracking data
      // to minimize re-renders from rapid frame updates
      updateHandTracking: (data) =>
        set({
          handPosition: data.position,
          normalizedHandPosition: data.normalized,
          currentGesture: data.gesture,
          gestureConfidence: data.confidence,
          handDetected: data.detected,
          pinchDistance: data.pinchDistance,
        }),

      // Voice
      setListening: (value) =>
        set({ isListening: value }),

      setRecordingMemo: (value) =>
        set({ isRecordingMemo: value }),

      setTranscript: (text) =>
        set({ currentTranscript: text }),

      setLastCommand: (command) =>
        set({ lastCommand: command }),

      setAudioAmplitude: (level) =>
        set({ audioAmplitude: level }),

      // Vault
      addVaultItem: (item) =>
        set((state) => ({
          vaultItems: [...state.vaultItems, item],
          lastSync: Date.now(),
        })),

      updateVaultItem: (id, updates) =>
        set((state) => ({
          vaultItems: state.vaultItems.map((item) =>
            item.id === id ? { ...item, ...updates } : item
          ),
          lastSync: Date.now(),
        })),

      removeVaultItem: (id) =>
        set((state) => ({
          vaultItems: state.vaultItems.filter((item) => item.id !== id),
          selectedItemId:
            state.selectedItemId === id ? null : state.selectedItemId,
          lastSync: Date.now(),
        })),

      selectItem: (id) =>
        set({ selectedItemId: id }),

      // Memos
      addMemo: (memo) =>
        set((state) => ({
          memos: [...state.memos, memo],
          lastSync: Date.now(),
        })),

      removeMemo: (id) =>
        set((state) => ({
          memos: state.memos.filter((m) => m.id !== id),
          lastSync: Date.now(),
        })),

      // Interaction
      setSliderValue: (value) =>
        set({ sliderValue: value }),

      setInteractionMode: (mode) =>
        set({ interactionMode: mode }),

      // Visual
      setParticleCount: (count) =>
        set({ particleCount: count }),

      setIslandState: (state) =>
        set({ islandState: state }),

      showAlert: (alert) =>
        set({ currentAlert: alert, islandState: "ALERT" }),

      dismissAlert: () =>
        set({ currentAlert: null, islandState: "IDLE" }),

      // Preferences
      setHandedness: (hand) =>
        set({ preferredHandedness: hand }),

      // Reset
      resetState: () => set(DEFAULT_STATE),
    }),
    {
      name: "nexvault-quantum-state",
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist specific fields (not transient tracking data)
      partialize: (state) => ({
        onboardingComplete: state.onboardingComplete,
        vaultItems: state.vaultItems,
        memos: state.memos,
        preferredHandedness: state.preferredHandedness,
        lastSync: state.lastSync,
        interactionMode: state.interactionMode,
      }),
    }
  )
);
