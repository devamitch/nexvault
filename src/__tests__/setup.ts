/**
 * Jest test setup - runs before each test suite
 */

// Mock react-native-reanimated
jest.mock("react-native-reanimated", () => {
  const Reanimated = require("react-native-reanimated/mock");
  Reanimated.default.call = () => {};
  return Reanimated;
});

// Mock expo-haptics
jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
  NotificationFeedbackType: { Success: "success", Error: "error", Warning: "warning" },
}));

// Mock expo-speech
jest.mock("expo-speech", () => ({
  speak: jest.fn(),
  stop: jest.fn(),
  isSpeakingAsync: jest.fn().mockResolvedValue(false),
}));

// Mock expo-local-authentication
jest.mock("expo-local-authentication", () => ({
  hasHardwareAsync: jest.fn().mockResolvedValue(true),
  isEnrolledAsync: jest.fn().mockResolvedValue(true),
  supportedAuthenticationTypesAsync: jest.fn().mockResolvedValue([1]),
  authenticateAsync: jest.fn().mockResolvedValue({ success: true }),
  AuthenticationType: { FINGERPRINT: 1, FACIAL_RECOGNITION: 2, IRIS: 3 },
}));

jest.mock("expo-audio", () => ({
  AudioModule: {
    requestRecordingPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true })),
    AudioRecorder: jest.fn().mockImplementation(() => ({
      prepareToRecordAsync: jest.fn().mockResolvedValue(undefined),
      record: jest.fn(),
      stop: jest.fn().mockResolvedValue(undefined),
      getStatus: jest.fn().mockReturnValue({ durationMillis: 1000, metering: -20 }),
      uri: "file://test-audio.m4a",
      isRecording: false,
    })),
    AudioPlayer: jest.fn().mockImplementation(() => ({
      play: jest.fn(),
      pause: jest.fn(),
      replace: jest.fn(),
      remove: jest.fn(),
      currentStatus: { playing: false, currentTime: 0, duration: 10 },
    })),
  },
  RecordingPresets: {
    HIGH_QUALITY: { extension: ".m4a" },
  },
  useAudioRecorder: jest.fn(),
  useAudioPlayer: jest.fn(() => ({
    play: jest.fn(),
    pause: jest.fn(),
  })),
}));

jest.mock("expo-video", () => ({
  VideoView: "VideoView",
  useVideoPlayer: jest.fn(),
}));

// Mock expo-sensors
jest.mock("expo-sensors", () => ({
  Gyroscope: {
    setUpdateInterval: jest.fn(),
    addListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
    removeAllListeners: jest.fn(),
  },
  Accelerometer: {
    setUpdateInterval: jest.fn(),
    addListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
    removeAllListeners: jest.fn(),
  },
}));

// Mock @react-native-async-storage/async-storage
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
    clear: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock react-native-vision-camera
jest.mock("react-native-vision-camera", () => ({
  Camera: "Camera",
  useCameraDevice: jest.fn().mockReturnValue({ id: "front" }),
  useCameraPermission: jest.fn().mockReturnValue({
    hasPermission: true,
    requestPermission: jest.fn().mockResolvedValue(true),
  }),
}));

// Silence console warnings in tests
const originalWarn = console.warn;
console.warn = (...args: unknown[]) => {
  const msg = args[0];
  if (typeof msg === "string" && msg.includes("Animated")) return;
  originalWarn(...args);
};
