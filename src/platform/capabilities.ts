/**
 * capabilities.ts - Cross-Platform Capability Detection
 *
 * Detects what features are available on the current platform
 * and provides feature flags for conditional rendering/behavior.
 *
 * Supports: iOS, Android, Web, macOS, iPad, watchOS, tvOS
 */

import { Platform, Dimensions } from "react-native";
import * as Device from "expo-device";

// ── Types ──────────────────────────────────────────────────────

export type PlatformType =
  | "ios"
  | "android"
  | "web"
  | "macos"
  | "windows"
  | "watchos"
  | "tvos";

export type DeviceType =
  | "phone"
  | "tablet"
  | "desktop"
  | "watch"
  | "tv"
  | "unknown";

export interface PlatformCapabilities {
  platform: PlatformType;
  deviceType: DeviceType;

  // Hardware
  hasCamera: boolean;
  hasFrontCamera: boolean;
  hasBiometrics: boolean;
  hasHaptics: boolean;
  hasGyroscope: boolean;
  hasAccelerometer: boolean;
  hasGPS: boolean;
  hasBluetooth: boolean;
  hasNFC: boolean;

  // Display
  isHighDensity: boolean;
  supportsHDR: boolean;
  screenWidth: number;
  screenHeight: number;
  isLandscape: boolean;
  isTablet: boolean;
  isDesktop: boolean;

  // Interaction
  supportsTouchGestures: boolean;
  supportsPointer: boolean;
  supportsKeyboard: boolean;
  supportsStylus: boolean;
  supportsMultiWindow: boolean;

  // Graphics
  supportsWebGL: boolean;
  supports3D: boolean;
  supportsShaders: boolean;
  supportsSkia: boolean;

  // Audio
  supportsSpeechRecognition: boolean;
  supportsSpeechSynthesis: boolean;
  supportsSpatialAudio: boolean;

  // Connectivity
  supportsWebSocket: boolean;
  supportsBLE: boolean;
  supportsMQTT: boolean;

  // AR
  supportsAR: boolean;
  supportsDepthCamera: boolean;
  supportsLiDAR: boolean;
}

// ── Detection ──────────────────────────────────────────────────

function detectPlatform(): PlatformType {
  if (Platform.OS === "ios") return "ios";
  if (Platform.OS === "android") return "android";
  if (Platform.OS === "web") return "web";
  if (Platform.OS === "macos") return "macos";
  if (Platform.OS === "windows") return "windows";
  return "web"; // Default fallback
}

function detectDeviceType(): DeviceType {
  const { width, height } = Dimensions.get("window");
  const platform = Platform.OS;

  if (platform === "web") {
    if (width >= 1024) return "desktop";
    if (width >= 768) return "tablet";
    return "phone";
  }

  if (platform === "macos" || platform === "windows") return "desktop";

  // iOS/Android
  const deviceType = Device.deviceType;
  if (deviceType === Device.DeviceType.TABLET) return "tablet";
  if (deviceType === Device.DeviceType.DESKTOP) return "desktop";
  if (deviceType === Device.DeviceType.TV) return "tv";
  return "phone";
}

// ── Main Capabilities ──────────────────────────────────────────

export function getCapabilities(): PlatformCapabilities {
  const platform = detectPlatform();
  const deviceType = detectDeviceType();
  const { width, height } = Dimensions.get("window");
  const isNative = platform === "ios" || platform === "android";
  const isApple = platform === "ios" || platform === "macos";

  return {
    platform,
    deviceType,

    // Hardware
    hasCamera: isNative,
    hasFrontCamera: isNative,
    hasBiometrics: isNative,
    hasHaptics: platform === "ios" || platform === "android",
    hasGyroscope: isNative,
    hasAccelerometer: isNative,
    hasGPS: isNative,
    hasBluetooth: isNative,
    hasNFC: platform === "ios" || platform === "android",

    // Display
    isHighDensity: (Dimensions.get("window").scale ?? 1) >= 2,
    supportsHDR: isApple,
    screenWidth: width,
    screenHeight: height,
    isLandscape: width > height,
    isTablet: deviceType === "tablet",
    isDesktop: deviceType === "desktop",

    // Interaction
    supportsTouchGestures: isNative || platform === "web",
    supportsPointer: platform === "web" || deviceType === "desktop",
    supportsKeyboard: platform === "web" || deviceType === "desktop",
    supportsStylus: platform === "ios" && deviceType === "tablet",
    supportsMultiWindow:
      (platform === "ios" && deviceType === "tablet") ||
      deviceType === "desktop",

    // Graphics
    supportsWebGL: true,
    supports3D: true,
    supportsShaders: isNative,
    supportsSkia: isNative,

    // Audio
    supportsSpeechRecognition: true,
    supportsSpeechSynthesis: true,
    supportsSpatialAudio: isApple,

    // Connectivity
    supportsWebSocket: true,
    supportsBLE: isNative,
    supportsMQTT: true,

    // AR
    supportsAR: platform === "ios" || platform === "android",
    supportsDepthCamera: platform === "ios",
    supportsLiDAR: platform === "ios",
  };
}

// ── Singleton ──────────────────────────────────────────────────

let _capabilities: PlatformCapabilities | null = null;

export function capabilities(): PlatformCapabilities {
  if (!_capabilities) {
    _capabilities = getCapabilities();
  }
  return _capabilities;
}

/**
 * Conditional feature wrapper. Returns the value if the capability
 * is available, otherwise returns fallback.
 */
export function ifCapable<T>(
  capability: keyof PlatformCapabilities,
  value: T,
  fallback: T
): T {
  const caps = capabilities();
  return caps[capability] ? value : fallback;
}
