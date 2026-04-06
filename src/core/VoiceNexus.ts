/**
 * VoiceNexus.ts - Audio Consciousness Interface
 *
 * Manages bidirectional voice interaction:
 * - Continuous listening via expo-av Audio.Recording
 * - Command parsing from transcribed speech
 * - Voice synthesis feedback via expo-speech
 * - Real-time audio amplitude for waveform visualization
 *
 * The system operates in three modes:
 *   PASSIVE  - Listening for wake commands
 *   ACTIVE   - Processing all speech as commands
 *   RECORDING - Capturing voice memo audio
 */

import type { AudioRecorder, RecordingStatus } from "expo-audio";
import { AudioModule, RecordingPresets } from "expo-audio";
import * as Speech from "expo-speech";

// ── Types ──────────────────────────────────────────────────────

export type VoiceMode = "PASSIVE" | "ACTIVE" | "RECORDING";

export type CommandCategory = "NAVIGATION" | "CREATION" | "QUERY" | "MANIPULATION";

export interface VoiceCommand {
  raw: string;
  category: CommandCategory;
  action: string;
  params: Record<string, string>;
  confidence: number;
  timestamp: number;
}

export interface AudioAmplitude {
  /** RMS amplitude 0-1 */
  level: number;
  /** Peak amplitude 0-1 */
  peak: number;
  timestamp: number;
}

type CommandCallback = (command: VoiceCommand) => void;
type AmplitudeCallback = (amplitude: AudioAmplitude) => void;

// ── Command Definitions ────────────────────────────────────────

interface CommandPattern {
  patterns: RegExp[];
  category: CommandCategory;
  action: string;
  extractParams?: (match: RegExpMatchArray) => Record<string, string>;
}

const COMMAND_PATTERNS: CommandPattern[] = [
  // Navigation
  {
    patterns: [/^open\s+vault$/i, /^show\s+vault$/i, /^vault$/i],
    category: "NAVIGATION",
    action: "OPEN_VAULT",
  },
  {
    patterns: [/^show\s+research$/i, /^research$/i],
    category: "NAVIGATION",
    action: "SHOW_RESEARCH",
  },
  {
    patterns: [/^home$/i, /^go\s+home$/i, /^main$/i],
    category: "NAVIGATION",
    action: "GO_HOME",
  },
  {
    patterns: [/^back$/i, /^go\s+back$/i],
    category: "NAVIGATION",
    action: "GO_BACK",
  },

  // Creation
  {
    patterns: [/^new\s+memo$/i, /^start\s+memo$/i, /^record$/i],
    category: "CREATION",
    action: "NEW_MEMO",
  },
  {
    patterns: [/^save\s+this$/i, /^save$/i],
    category: "CREATION",
    action: "SAVE",
  },
  {
    patterns: [/^create\s+entry$/i, /^new\s+entry$/i],
    category: "CREATION",
    action: "CREATE_ENTRY",
  },

  // Query
  {
    patterns: [/^status$/i, /^what'?s?\s+the\s+status$/i],
    category: "QUERY",
    action: "STATUS",
  },
  {
    patterns: [/^what'?s?\s+here$/i, /^describe$/i],
    category: "QUERY",
    action: "DESCRIBE_SCREEN",
  },
  {
    patterns: [/^read\s+memos$/i, /^play\s+memos$/i],
    category: "QUERY",
    action: "READ_MEMOS",
  },

  // Manipulation
  {
    patterns: [/^grab\s+this$/i, /^grab$/i, /^hold$/i],
    category: "MANIPULATION",
    action: "GRAB",
  },
  {
    patterns: [/^larger$/i, /^bigger$/i, /^scale\s+up$/i, /^zoom\s+in$/i],
    category: "MANIPULATION",
    action: "SCALE_UP",
  },
  {
    patterns: [/^smaller$/i, /^scale\s+down$/i, /^zoom\s+out$/i],
    category: "MANIPULATION",
    action: "SCALE_DOWN",
  },
  {
    patterns: [/^delete$/i, /^remove$/i, /^discard$/i],
    category: "MANIPULATION",
    action: "DELETE",
  },
];

// ── Voice Synthesis Config ─────────────────────────────────────

const SPEECH_CONFIG: Speech.SpeechOptions = {
  pitch: 0.7,
  rate: 0.9,
  language: "en-US",
};

// ── VoiceNexus ─────────────────────────────────────────────────

export class VoiceNexus {
  private mode: VoiceMode = "PASSIVE";
  private recorder: AudioRecorder | null = null;
  private commandCallbacks: Set<CommandCallback> = new Set();
  private amplitudeCallbacks: Set<AmplitudeCallback> = new Set();
  private amplitudeInterval: ReturnType<typeof setInterval> | null = null;
  private isInitialized = false;
  private isPaused = false;

  async initialize(): Promise<void> {
    try {
      // Request audio permissions
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        throw new Error("Microphone permission denied");
      }

      this.isInitialized = true;
    } catch (error) {
      console.error("VoiceNexus initialization failed:", error);
      throw error;
    }
  }

  async dispose(): Promise<void> {
    await this.stopListening();
    this.commandCallbacks.clear();
    this.amplitudeCallbacks.clear();
    this.isInitialized = false;
  }

  // ── Listeners ──

  onCommand(callback: CommandCallback): () => void {
    this.commandCallbacks.add(callback);
    return () => {
      this.commandCallbacks.delete(callback);
    };
  }

  onAmplitude(callback: AmplitudeCallback): () => void {
    this.amplitudeCallbacks.add(callback);
    return () => {
      this.amplitudeCallbacks.delete(callback);
    };
  }

  // ── Recording Control ──

  async startListening(): Promise<void> {
    if (!this.isInitialized || this.isPaused) return;
    if (this.recorder?.isRecording) return; // Already recording

    try {
      this.recorder = new AudioModule.AudioRecorder({
        ...RecordingPresets.HIGH_QUALITY,
        isMeteringEnabled: true,
      });
      await this.recorder.prepareToRecordAsync();
      this.recorder.record();

      this.mode = "ACTIVE";
      this.startAmplitudePolling();
    } catch (error) {
      console.error("Failed to start listening:", error);
    }
  }

  async stopListening(): Promise<string | null> {
    this.stopAmplitudePolling();

    if (!this.recorder) return null;

    try {
      await this.recorder.stop();
      const uri = this.recorder.uri;
      this.mode = "PASSIVE";
      return uri;
    } catch (error) {
      console.error("Failed to stop listening:", error);
      return null;
    } finally {
      this.recorder = null;
    }
  }

  async startMemoRecording(): Promise<void> {
    // Stop any current listening session
    await this.stopListening();

    try {
      this.recorder = new AudioModule.AudioRecorder({
        ...RecordingPresets.HIGH_QUALITY,
        isMeteringEnabled: true,
      });
      await this.recorder.prepareToRecordAsync();
      this.recorder.record();

      this.mode = "RECORDING";
      this.startAmplitudePolling();
    } catch (error) {
      console.error("Failed to start memo recording:", error);
    }
  }

  async stopMemoRecording(): Promise<{ uri: string | null; duration: number }> {
    this.stopAmplitudePolling();

    if (!this.recorder) return { uri: null, duration: 0 };

    try {
      const status = this.recorder.getStatus();
      await this.recorder.stop();
      const uri = this.recorder.uri;
      this.mode = "PASSIVE";
      return {
        uri,
        duration: status.durationMillis || 0,
      };
    } catch (error) {
      console.error("Failed to stop memo recording:", error);
      return { uri: null, duration: 0 };
    } finally {
      this.recorder = null;
    }
  }

  // ── Command Processing ──

  /**
   * Parse raw transcript text into a structured command.
   * Called externally when speech-to-text provides a transcript.
   */
  processTranscript(transcript: string): VoiceCommand | null {
    const trimmed = transcript.trim();
    if (!trimmed) return null;

    for (const pattern of COMMAND_PATTERNS) {
      for (const regex of pattern.patterns) {
        const match = trimmed.match(regex);
        if (match) {
          const command: VoiceCommand = {
            raw: trimmed,
            category: pattern.category,
            action: pattern.action,
            params: pattern.extractParams?.(match) ?? {},
            confidence: 0.9,
            timestamp: Date.now(),
          };

          this.commandCallbacks.forEach((cb) => cb(command));
          return command;
        }
      }
    }

    // No pattern matched - return as unrecognized
    return null;
  }

  // ── Voice Synthesis ──

  async speak(text: string): Promise<void> {
    return new Promise<void>((resolve) => {
      Speech.speak(text, {
        ...SPEECH_CONFIG,
        onDone: resolve,
        onError: () => resolve(),
      });
    });
  }

  async speakConfirmation(action: string): Promise<void> {
    const confirmations: Record<string, string> = {
      OPEN_VAULT: "Opening vault.",
      SHOW_RESEARCH: "Displaying research.",
      GO_HOME: "Returning home.",
      GO_BACK: "Going back.",
      NEW_MEMO: "Ready to record.",
      SAVE: "Saved.",
      CREATE_ENTRY: "Creating new entry.",
      STATUS: "System operational.",
      GRAB: "Object locked.",
      SCALE_UP: "Enlarging.",
      SCALE_DOWN: "Reducing.",
      DELETE: "Item removed.",
    };

    const text = confirmations[action] ?? "Command received.";
    await this.speak(text);
  }

  stopSpeaking(): void {
    Speech.stop();
  }

  // ── Amplitude Monitoring ──

  private startAmplitudePolling(): void {
    let sustainedSpeechCount = 0;
    this.amplitudeInterval = setInterval(() => {
      if (!this.recorder || !this.recorder.isRecording) return;
      try {
        const status = this.recorder.getStatus();
        if (status.metering !== null && status.metering !== undefined) {
          const normalizedLevel = Math.max(0, (status.metering + 60) / 60);
          const amplitude: AudioAmplitude = {
            level: normalizedLevel,
            peak: Math.min(1, normalizedLevel * 1.3),
            timestamp: Date.now(),
          };
          this.amplitudeCallbacks.forEach((cb) => cb(amplitude));

          // Mock VAD: If amplitude > 0.3 for 10 consecutive ticks (~500ms)
          if (normalizedLevel > 0.3) {
            sustainedSpeechCount++;
          } else {
            sustainedSpeechCount = 0;
          }

          if (sustainedSpeechCount > 10) {
            // Sustained voice detected - trigger 'Listening' state
            sustainedSpeechCount = 0;
            this.handleSustainedSpeech();
          }
        }
      } catch {
        // Recording may have been stopped
      }
    }, 50);
  }

  private handleSustainedSpeech(): void {
    // In a real app, this would trigger STT.
    // Here we just emit a generic 'process' event to show the UI reacts.
    console.log("VoiceNexus: Sustained speech detected. Triggering mock processing.");
  }

  private stopAmplitudePolling(): void {
    if (this.amplitudeInterval) {
      clearInterval(this.amplitudeInterval);
      this.amplitudeInterval = null;
    }
  }

  private handleRecordingStatus(_status: RecordingStatus): void {
    // Status updates handled via amplitude polling for more control
  }

  // ── State Control ──

  pause(): void {
    this.isPaused = true;
    this.stopListening();
  }

  resume(): void {
    this.isPaused = false;
  }

  getMode(): VoiceMode {
    return this.mode;
  }

  isActive(): boolean {
    return this.isInitialized && !this.isPaused;
  }
}
