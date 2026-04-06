import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "NexVault",
  slug: "nexvault",
  version: "1.0.0",
  orientation: "default",
  userInterfaceStyle: "dark",
  backgroundColor: "#000000",
  scheme: "nexvault",

  // ── Icons & Splash ────────────────────────────────────────
  icon: "./assets/icon.png",
  splash: {
    image: "./assets/splash-icon.png",
    backgroundColor: "#000000",
    resizeMode: "contain",
  },

  // ── iOS ──────────────────────────────────────────────────
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.nexvault.app",
    buildNumber: "1",
    requireFullScreen: false,
    deploymentTarget: "16.0",
    infoPlist: {
      NSCameraUsageDescription:
        "NexVault uses the camera for spatial hand tracking to enable gesture-based interaction.",
      NSMicrophoneUsageDescription:
        "NexVault uses the microphone for voice commands and memo recording.",
      NSFaceIDUsageDescription:
        "NexVault uses Face ID for secure biometric authentication.",
      NSMotionUsageDescription:
        "NexVault uses motion sensors for spatial parallax effects.",
      NSLocationWhenInUseUsageDescription:
        "NexVault uses location for Reality Anchors - pinning data to physical locations.",
      NSContactsUsageDescription: "NexVault can access contacts for sharing vault items.",
      UIBackgroundModes: ["audio", "location", "fetch"],
      UISupportsDocumentBrowser: true,
      ITSAppUsesNonExemptEncryption: false,
      UIRequiresFullScreen: false,
      UISupportedInterfaceOrientations: [
        "UIInterfaceOrientationPortrait",
        "UIInterfaceOrientationLandscapeLeft",
        "UIInterfaceOrientationLandscapeRight",
      ],
      "UISupportedInterfaceOrientations~ipad": [
        "UIInterfaceOrientationPortrait",
        "UIInterfaceOrientationPortraitUpsideDown",
        "UIInterfaceOrientationLandscapeLeft",
        "UIInterfaceOrientationLandscapeRight",
      ],
    },
    config: {
      usesNonExemptEncryption: false,
    },
  },

  // ── Android ──────────────────────────────────────────────
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#000000",
    },
    package: "com.nexvault.app",
    versionCode: 1,
    permissions: [
      "CAMERA",
      "RECORD_AUDIO",
      "USE_BIOMETRIC",
      "USE_FINGERPRINT",
      "VIBRATE",
      "HIGH_SAMPLING_RATE_SENSORS",
      "ACCESS_FINE_LOCATION",
      "ACCESS_COARSE_LOCATION",
      "READ_CONTACTS",
      "INTERNET",
      "ACCESS_NETWORK_STATE",
      "RECEIVE_BOOT_COMPLETED",
      "BLUETOOTH",
      "BLUETOOTH_ADMIN",
      "BLUETOOTH_CONNECT",
      "BLUETOOTH_SCAN",
      "POST_NOTIFICATIONS",
    ],
    blockedPermissions: ["READ_PHONE_STATE"],
  },

  // ── Web ──────────────────────────────────────────────────
  web: {
    favicon: "./assets/favicon.png",
    bundler: "metro",
    output: "single",
    name: "NexVault",
    shortName: "NexVault",
    description: "Quantum Spatial Research Interface",
    themeColor: "#000000",
    backgroundColor: "#000000",
    lang: "en",
  },

  // ── Plugins ──────────────────────────────────────────────
  plugins: [
    [
      "react-native-vision-camera",
      {
        cameraPermissionText: "NexVault uses the camera for spatial hand tracking.",
        enableMicrophonePermission: true,
        microphonePermissionText: "NexVault uses the microphone for voice commands.",
        enableFrameProcessors: true,
      },
    ],
    "expo-local-authentication",
    "expo-sensors",
    [
      "expo-location",
      {
        locationAlwaysAndWhenInUsePermission:
          "NexVault uses location for Reality Anchors.",
        isIosBackgroundLocationEnabled: true,
      },
    ],

    [
      "expo-contacts",
      {
        contactsPermission: "NexVault can access contacts for sharing.",
      },
    ],
    "expo-font",
    "expo-asset",
    // ── expo-av REMOVED in SDK 55 — replaced by expo-audio + expo-video ──
    [
      "expo-audio",
      {
        microphonePermission:
          "NexVault uses the microphone for voice commands and memo recording.",
      },
    ],
    "expo-video",
    "expo-sharing",
    "expo-web-browser",
    [
      "expo-splash-screen",
      {
        backgroundColor: "#000000",
        image: "./assets/splash-icon.png",
        imageWidth: 200,
      },
    ],
  ],

  // ── Extra Config ─────────────────────────────────────────
  extra: {
    eas: {
      projectId: "9699b617-6d47-464d-b719-1fc3919b0aae",
    },
    aiProvider: process.env.AI_PROVIDER ?? "openapi",
    aiApiKey: process.env.AI_API_KEY ?? "",
    iotBrokerUrl: process.env.IOT_BROKER_URL ?? "",
    enableAI: process.env.ENABLE_AI === "true",
    enableIoT: process.env.ENABLE_IOT === "true",
    enableAR: process.env.ENABLE_AR === "true",
  },
  experiments: {
    typedRoutes: false, // ← ADD THIS (stops expo-router/_ctx-shared error)
  },

  // ── Updates ──────────────────────────────────────────────
  updates: {
    fallbackToCacheTimeout: 0,
  },

  // ── Runtime Version ──────────────────────────────────────
  runtimeVersion: {
    policy: "sdkVersion",
  },
  owner: "amit98ch",
});
