/**
 * useRealityBridge.ts - Unified Reality Interface Hook
 *
 * Combines spatial tracking, voice commands, and depth perception
 * into a single interface. This is the primary hook used by screens
 * to interact with all input modalities simultaneously.
 */

import { useCallback } from "react";
import { useSpatialTracking, type SpatialTrackingResult } from "./useSpatialTracking";
import { useVoiceCommand, type VoiceCommandResult } from "./useVoiceCommand";
import { useDepthPerception, type DepthPerceptionResult } from "./useDepthPerception";
import * as Haptics from "expo-haptics";

// ── Types ──────────────────────────────────────────────────────

export interface RealityBridgeResult {
  spatial: SpatialTrackingResult;
  voice: VoiceCommandResult;
  depth: DepthPerceptionResult;
  /** Activate all input systems */
  activateAll: () => Promise<void>;
  /** Deactivate all input systems */
  deactivateAll: () => Promise<void>;
  /** Fire haptic feedback by type */
  haptic: {
    light: () => Promise<void>;
    medium: () => Promise<void>;
    heavy: () => Promise<void>;
    success: () => Promise<void>;
    error: () => Promise<void>;
    progress: (step: number, total: number) => Promise<void>;
  };
}

// ── Hook ───────────────────────────────────────────────────────

export function useRealityBridge(): RealityBridgeResult {
  const spatial = useSpatialTracking();
  const voice = useVoiceCommand();
  const depth = useDepthPerception();

  const activateAll = useCallback(async () => {
    depth.start();
    await voice.startListening();
  }, [depth, voice]);

  const deactivateAll = useCallback(async () => {
    depth.stop();
    await voice.stopListening();
    spatial.reset();
  }, [depth, voice, spatial]);

  // Haptic feedback vocabulary
  const haptic = {
    light: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
    medium: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
    heavy: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
    success: async () => {
      for (let i = 0; i < 3; i++) {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await delay(80);
      }
    },
    error: async () => {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      await delay(200);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    },
    progress: async (step: number, _total: number) => {
      // Increasingly strong pulses as progress increases
      if (step % 25 === 0) {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } else {
        await Haptics.selectionAsync();
      }
    },
  };

  return {
    spatial,
    voice,
    depth,
    activateAll,
    deactivateAll,
    haptic,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
