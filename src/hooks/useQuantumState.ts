/**
 * useQuantumState.ts - Convenience State Hook
 *
 * Provides typed selectors into the quantum store with
 * computed/derived state values commonly needed by screens.
 */

import { useMemo } from "react";
import { useQuantumStore } from "../store/quantumStore";
import type { Phase } from "../core/QuantumEngine";

// ── Types ──────────────────────────────────────────────────────

export interface QuantumStateResult {
  // Phase
  phase: Phase;
  isCalibrating: boolean;
  isAuthenticating: boolean;
  isInHub: boolean;
  isInVault: boolean;
  isInMemo: boolean;
  onboardingComplete: boolean;
  isAuthenticated: boolean;

  // Interaction summary
  hasHandControl: boolean;
  isVoiceActive: boolean;

  // Vault summary
  vaultItemCount: number;
  memoCount: number;
  selectedItemId: string | null;

  // Visual
  islandState: string;
  particleCount: number;

  // Actions
  navigateTo: (phase: Phase) => void;
  completeOnboarding: () => void;
  setAuthenticated: (value: boolean) => void;
}

// ── Hook ───────────────────────────────────────────────────────

export function useQuantumState(): QuantumStateResult {
  const phase = useQuantumStore((s) => s.currentPhase);
  const onboardingComplete = useQuantumStore((s) => s.onboardingComplete);
  const isAuthenticated = useQuantumStore((s) => s.isAuthenticated);
  const handDetected = useQuantumStore((s) => s.handDetected);
  const isListening = useQuantumStore((s) => s.isListening);
  const vaultItems = useQuantumStore((s) => s.vaultItems);
  const memos = useQuantumStore((s) => s.memos);
  const selectedItemId = useQuantumStore((s) => s.selectedItemId);
  const islandState = useQuantumStore((s) => s.islandState);
  const particleCount = useQuantumStore((s) => s.particleCount);
  const setPhase = useQuantumStore((s) => s.setPhase);
  const completeOnboarding = useQuantumStore((s) => s.completeOnboarding);
  const setAuthenticated = useQuantumStore((s) => s.setAuthenticated);

  return useMemo(
    () => ({
      phase,
      isCalibrating: phase === "CALIBRATION",
      isAuthenticating: phase === "AUTHENTICATION",
      isInHub: phase === "HUB",
      isInVault: phase === "VAULT",
      isInMemo: phase === "MEMO",
      onboardingComplete,
      isAuthenticated,

      hasHandControl: handDetected,
      isVoiceActive: isListening,

      vaultItemCount: vaultItems.length,
      memoCount: memos.length,
      selectedItemId,

      islandState,
      particleCount,

      navigateTo: setPhase,
      completeOnboarding,
      setAuthenticated,
    }),
    [
      phase, onboardingComplete, isAuthenticated, handDetected,
      isListening, vaultItems.length, memos.length, selectedItemId,
      islandState, particleCount, setPhase, completeOnboarding,
      setAuthenticated,
    ]
  );
}
