/**
 * HapticFeedback.ts - Programmatic Haptic Pattern System
 *
 * Provides a vocabulary of haptic patterns beyond simple
 * single-tap feedback. Supports:
 *   - Named patterns (morse, heartbeat, cascade, etc.)
 *   - Custom pattern sequences
 *   - Platform-aware fallbacks (web: no-op, watch: simplified)
 *   - "Haptic Morse" encoding for secret communication
 */

import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

// ── Types ──────────────────────────────────────────────────────

type HapticStep =
  | { type: "impact"; style: Haptics.ImpactFeedbackStyle }
  | { type: "notification"; style: Haptics.NotificationFeedbackType }
  | { type: "selection" }
  | { type: "pause"; duration: number };

export type HapticPattern = HapticStep[];

type PatternName =
  | "success"
  | "error"
  | "warning"
  | "heartbeat"
  | "cascade"
  | "progress"
  | "unlock"
  | "lock"
  | "grab"
  | "release"
  | "swipe"
  | "milestone"
  | "wormhole";

// ── Predefined Patterns ────────────────────────────────────────

const PATTERNS: Record<PatternName, HapticPattern> = {
  success: [
    { type: "impact", style: Haptics.ImpactFeedbackStyle.Light },
    { type: "pause", duration: 80 },
    { type: "impact", style: Haptics.ImpactFeedbackStyle.Light },
    { type: "pause", duration: 80 },
    { type: "impact", style: Haptics.ImpactFeedbackStyle.Medium },
  ],

  error: [
    { type: "impact", style: Haptics.ImpactFeedbackStyle.Heavy },
    { type: "pause", duration: 200 },
    { type: "impact", style: Haptics.ImpactFeedbackStyle.Heavy },
  ],

  warning: [
    { type: "notification", style: Haptics.NotificationFeedbackType.Warning },
    { type: "pause", duration: 300 },
    { type: "selection" },
  ],

  heartbeat: [
    { type: "impact", style: Haptics.ImpactFeedbackStyle.Medium },
    { type: "pause", duration: 100 },
    { type: "impact", style: Haptics.ImpactFeedbackStyle.Light },
    { type: "pause", duration: 600 },
  ],

  cascade: [
    { type: "impact", style: Haptics.ImpactFeedbackStyle.Light },
    { type: "pause", duration: 50 },
    { type: "impact", style: Haptics.ImpactFeedbackStyle.Medium },
    { type: "pause", duration: 50 },
    { type: "impact", style: Haptics.ImpactFeedbackStyle.Heavy },
    { type: "pause", duration: 50 },
    { type: "impact", style: Haptics.ImpactFeedbackStyle.Medium },
    { type: "pause", duration: 50 },
    { type: "impact", style: Haptics.ImpactFeedbackStyle.Light },
  ],

  progress: [
    { type: "selection" },
    { type: "pause", duration: 150 },
    { type: "selection" },
  ],

  unlock: [
    { type: "impact", style: Haptics.ImpactFeedbackStyle.Light },
    { type: "pause", duration: 60 },
    { type: "impact", style: Haptics.ImpactFeedbackStyle.Light },
    { type: "pause", duration: 60 },
    { type: "notification", style: Haptics.NotificationFeedbackType.Success },
  ],

  lock: [
    { type: "impact", style: Haptics.ImpactFeedbackStyle.Heavy },
    { type: "pause", duration: 100 },
    { type: "impact", style: Haptics.ImpactFeedbackStyle.Medium },
  ],

  grab: [
    { type: "impact", style: Haptics.ImpactFeedbackStyle.Medium },
  ],

  release: [
    { type: "impact", style: Haptics.ImpactFeedbackStyle.Light },
  ],

  swipe: [
    { type: "selection" },
  ],

  milestone: [
    { type: "notification", style: Haptics.NotificationFeedbackType.Success },
    { type: "pause", duration: 100 },
    { type: "impact", style: Haptics.ImpactFeedbackStyle.Medium },
  ],

  wormhole: [
    { type: "impact", style: Haptics.ImpactFeedbackStyle.Heavy },
    { type: "pause", duration: 50 },
    { type: "impact", style: Haptics.ImpactFeedbackStyle.Heavy },
    { type: "pause", duration: 50 },
    { type: "impact", style: Haptics.ImpactFeedbackStyle.Heavy },
    { type: "pause", duration: 100 },
    { type: "notification", style: Haptics.NotificationFeedbackType.Success },
  ],
};

// ── Execution Engine ───────────────────────────────────────────

const isHapticSupported = Platform.OS === "ios" || Platform.OS === "android";

async function executeStep(step: HapticStep): Promise<void> {
  switch (step.type) {
    case "impact":
      await Haptics.impactAsync(step.style);
      break;
    case "notification":
      await Haptics.notificationAsync(step.style);
      break;
    case "selection":
      await Haptics.selectionAsync();
      break;
    case "pause":
      await new Promise((resolve) => setTimeout(resolve, step.duration));
      break;
  }
}

/**
 * Play a named haptic pattern.
 */
export async function playPattern(name: PatternName): Promise<void> {
  if (!isHapticSupported) return;

  const pattern = PATTERNS[name];
  if (!pattern) return;

  for (const step of pattern) {
    await executeStep(step);
  }
}

/**
 * Play a custom haptic pattern sequence.
 */
export async function playCustomPattern(pattern: HapticPattern): Promise<void> {
  if (!isHapticSupported) return;

  for (const step of pattern) {
    await executeStep(step);
  }
}

// ── Haptic Morse Encoder ───────────────────────────────────────

const MORSE_MAP: Record<string, string> = {
  A: ".-", B: "-...", C: "-.-.", D: "-..", E: ".",
  F: "..-.", G: "--.", H: "....", I: "..", J: ".---",
  K: "-.-", L: ".-..", M: "--", N: "-.", O: "---",
  P: ".--.", Q: "--.-", R: ".-.", S: "...", T: "-",
  U: "..-", V: "...-", W: ".--", X: "-..-", Y: "-.--",
  Z: "--..",
  "0": "-----", "1": ".----", "2": "..---", "3": "...--",
  "4": "....-", "5": ".....", "6": "-....", "7": "--...",
  "8": "---..", "9": "----.",
  " ": "/",
};

/**
 * Encode a text message as haptic Morse code.
 * Dot = light tap, Dash = heavy tap, gaps = pauses.
 */
export async function playMorseMessage(text: string): Promise<void> {
  if (!isHapticSupported) return;

  const upper = text.toUpperCase();

  for (const char of upper) {
    const code = MORSE_MAP[char];
    if (!code) continue;

    for (const symbol of code) {
      if (symbol === ".") {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await delay(100);
      } else if (symbol === "-") {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        await delay(250);
      } else if (symbol === "/") {
        await delay(500); // Word gap
      }
    }
    await delay(200); // Letter gap
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
