/**
 * useVoiceCommand.ts - Voice Recognition Hook
 *
 * Manages the VoiceNexus lifecycle within React components.
 * Provides voice command recognition, memo recording,
 * and audio amplitude data for waveform visualization.
 *
 * Usage:
 *   const { startListening, stopListening, amplitude, lastCommand } = useVoiceCommand();
 */

import { useCallback, useEffect, useRef } from "react";
import { useSharedValue, type SharedValue } from "react-native-reanimated";
import { VoiceNexus, type VoiceCommand, type AudioAmplitude } from "../core/VoiceNexus";
import { useQuantumStore } from "../store/quantumStore";

// ── Types ──────────────────────────────────────────────────────

export interface VoiceCommandResult {
  /** Current audio amplitude (0-1) for waveform rendering */
  amplitude: SharedValue<number>;
  /** Peak audio amplitude (0-1) */
  peak: SharedValue<number>;
  /** Whether currently listening */
  isListening: boolean;
  /** Whether recording a voice memo */
  isRecordingMemo: boolean;
  /** Last recognized command */
  lastCommand: VoiceCommand | null;
  /** Start continuous voice listening */
  startListening: () => Promise<void>;
  /** Stop listening and return audio URI */
  stopListening: () => Promise<string | null>;
  /** Start recording a voice memo */
  startMemoRecording: () => Promise<void>;
  /** Stop memo recording and return audio data */
  stopMemoRecording: () => Promise<{ uri: string | null; duration: number }>;
  /** Process a text transcript as a voice command */
  processTranscript: (text: string) => VoiceCommand | null;
  /** Speak text through the synthesis engine */
  speak: (text: string) => Promise<void>;
  /** Speak a confirmation for a given action */
  speakConfirmation: (action: string) => Promise<void>;
}

// ── Hook ───────────────────────────────────────────────────────

export function useVoiceCommand(): VoiceCommandResult {
  const voiceNexusRef = useRef<VoiceNexus>(new VoiceNexus());
  const isInitializedRef = useRef(false);

  // Shared values for direct animation binding
  const amplitude = useSharedValue(0);
  const peak = useSharedValue(0);

  // Zustand state
  const isListening = useQuantumStore((s) => s.isListening);
  const isRecordingMemo = useQuantumStore((s) => s.isRecordingMemo);
  const lastCommand = useQuantumStore((s) => s.lastCommand);
  const setListening = useQuantumStore((s) => s.setListening);
  const setRecordingMemo = useQuantumStore((s) => s.setRecordingMemo);
  const setLastCommand = useQuantumStore((s) => s.setLastCommand);
  const setAudioAmplitude = useQuantumStore((s) => s.setAudioAmplitude);
  const setIslandState = useQuantumStore((s) => s.setIslandState);

  // Initialize VoiceNexus on mount
  useEffect(() => {
    const nexus = voiceNexusRef.current;

    const init = async () => {
      try {
        await nexus.initialize();
        isInitializedRef.current = true;

        // Subscribe to amplitude updates
        nexus.onAmplitude((amp: AudioAmplitude) => {
          amplitude.value = amp.level;
          peak.value = amp.peak;
          setAudioAmplitude(amp.level);
        });

        // Subscribe to command events
        nexus.onCommand((command: VoiceCommand) => {
          setLastCommand(command);
        });
      } catch (error) {
        console.error("VoiceNexus initialization failed:", error);
      }
    };

    init();

    return () => {
      nexus.dispose();
      isInitializedRef.current = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const startListening = useCallback(async () => {
    if (!isInitializedRef.current) return;
    await voiceNexusRef.current.startListening();
    setListening(true);
    setIslandState("LISTENING");
  }, [setListening, setIslandState]);

  const stopListening = useCallback(async () => {
    const uri = await voiceNexusRef.current.stopListening();
    setListening(false);
    setIslandState("IDLE");
    amplitude.value = 0;
    peak.value = 0;
    return uri;
  }, [setListening, setIslandState, amplitude, peak]);

  const startMemoRecording = useCallback(async () => {
    if (!isInitializedRef.current) return;
    await voiceNexusRef.current.startMemoRecording();
    setRecordingMemo(true);
    setIslandState("LISTENING");
  }, [setRecordingMemo, setIslandState]);

  const stopMemoRecording = useCallback(async () => {
    const result = await voiceNexusRef.current.stopMemoRecording();
    setRecordingMemo(false);
    setIslandState("IDLE");
    amplitude.value = 0;
    peak.value = 0;
    return result;
  }, [setRecordingMemo, setIslandState, amplitude, peak]);

  const processTranscript = useCallback(
    (text: string) => {
      const command = voiceNexusRef.current.processTranscript(text);
      if (command) {
        setLastCommand(command);
      }
      return command;
    },
    [setLastCommand]
  );

  const speak = useCallback(async (text: string) => {
    await voiceNexusRef.current.speak(text);
  }, []);

  const speakConfirmation = useCallback(async (action: string) => {
    await voiceNexusRef.current.speakConfirmation(action);
  }, []);

  return {
    amplitude,
    peak,
    isListening,
    isRecordingMemo,
    lastCommand,
    startListening,
    stopListening,
    startMemoRecording,
    stopMemoRecording,
    processTranscript,
    speak,
    speakConfirmation,
  };
}
