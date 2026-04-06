/**
 * web.ts - Web Platform Specific Utilities
 *
 * Provides fallbacks and adaptations for running on web:
 *   - Keyboard shortcuts (since no gestures)
 *   - Mouse/trackpad gesture simulation
 *   - WebGL context management
 *   - Service Worker registration
 *   - PWA manifest
 *   - Responsive breakpoints
 */

import { Platform } from "react-native";

// ── Keyboard Shortcuts ─────────────────────────────────────────

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  action: string;
  description: string;
}

export const KEYBOARD_SHORTCUTS: KeyboardShortcut[] = [
  { key: "n", ctrl: true, action: "NEW_MEMO", description: "New Memo" },
  { key: "s", ctrl: true, action: "SAVE", description: "Save" },
  { key: "v", ctrl: true, shift: true, action: "OPEN_VAULT", description: "Open Vault" },
  { key: "h", ctrl: true, action: "GO_HOME", description: "Go Home" },
  { key: "Escape", action: "GO_BACK", description: "Go Back" },
  { key: "Delete", action: "DELETE", description: "Delete Selected" },
  { key: "+", ctrl: true, action: "SCALE_UP", description: "Zoom In" },
  { key: "-", ctrl: true, action: "SCALE_DOWN", description: "Zoom Out" },
  { key: "l", ctrl: true, action: "TOGGLE_LISTENING", description: "Toggle Voice" },
  { key: "?", ctrl: true, action: "STATUS", description: "Show Status" },
];

/**
 * Register keyboard shortcut listeners for web platform.
 */
export function registerKeyboardShortcuts(
  onAction: (action: string) => void
): () => void {
  if (Platform.OS !== "web") return () => {};

  const handler = (e: KeyboardEvent) => {
    for (const shortcut of KEYBOARD_SHORTCUTS) {
      const ctrlMatch = shortcut.ctrl ? e.ctrlKey || e.metaKey : true;
      const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey;
      const altMatch = shortcut.alt ? e.altKey : !e.altKey;

      if (e.key === shortcut.key && ctrlMatch && shiftMatch && altMatch) {
        e.preventDefault();
        onAction(shortcut.action);
        return;
      }
    }
  };

  if (typeof window !== "undefined") {
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }

  return () => {};
}

// ── Responsive Breakpoints ─────────────────────────────────────

export const BREAKPOINTS = {
  mobile: 480,
  tablet: 768,
  desktop: 1024,
  wide: 1440,
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS;

export function getBreakpoint(width: number): Breakpoint {
  if (width < BREAKPOINTS.mobile) return "mobile";
  if (width < BREAKPOINTS.tablet) return "tablet";
  if (width < BREAKPOINTS.desktop) return "desktop";
  return "wide";
}

// ── Mouse Gesture Simulation ───────────────────────────────────

/**
 * Maps mouse position to hand tracking coordinates for web.
 * Normalizes mouse position to 0-1 range matching hand tracking output.
 */
export function mouseToHandCoords(
  clientX: number,
  clientY: number,
  windowWidth: number,
  windowHeight: number
): { x: number; y: number; z: number } {
  return {
    x: clientX / windowWidth,
    y: clientY / windowHeight,
    z: 0.5, // No depth from mouse - neutral
  };
}

// ── PWA Registration ───────────────────────────────────────────

export async function registerServiceWorker(): Promise<void> {
  if (
    Platform.OS !== "web" ||
    typeof navigator === "undefined" ||
    !("serviceWorker" in navigator)
  ) {
    return;
  }

  try {
    await navigator.serviceWorker.register("/service-worker.js");
  } catch {
    // Service worker registration failed - non-critical
  }
}
