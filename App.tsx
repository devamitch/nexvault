import Constants from "expo-constants";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef } from "react";
import { Linking, LogBox, Platform, StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import {
  QuantumNavigator,
  type RootStackParamList,
} from "./src/navigation/QuantumNavigator";
import { useQuantumStore } from "./src/store/quantumStore";
import { updateWidgetData } from "./src/widgets/QuantumWidget";

// Services
import { getAutomationEngine } from "./src/services/AutomationEngine";
import { getDeviceIntegration } from "./src/services/DeviceIntegration";
import { getIoTBridge } from "./src/services/IoTBridge";
import { getJarvis, type JarvisConfig } from "./src/services/JarvisCore";

// Platform
import { registerKeyboardShortcuts, registerServiceWorker } from "./src/platform/web";

// Suppress known harmless warnings from three.js / R3F / Reanimated
LogBox.ignoreLogs([
  "THREE.WebGLRenderer",
  "EXGL",
  "Overriding previous layout",
  "Sending `onAnimatedValueUpdate`",
]);

// ── Service Initialization ──────────────────────────────────────

function useServiceInit() {
  const servicesReady = useRef(false);

  useEffect(() => {
    if (servicesReady.current) return;
    servicesReady.current = true;

    const extra = (Constants.expoConfig?.extra as Record<string, unknown>) ?? {};

    // 1. Jarvis AI
    const jarvisConfig: Partial<JarvisConfig> = {
      provider:
        extra.aiProvider === "anthropic"
          ? "anthropic"
          : extra.aiProvider === "openai"
            ? "openai"
            : "local",
      apiKey: (extra.aiApiKey as string) || undefined,
      enableLearning: true,
      enableProactiveSuggestions: true,
      offlineFallback: true,
    };
    getJarvis(jarvisConfig);

    // 2. Automation Engine
    const engine = getAutomationEngine();
    engine.initialize();

    // Register default action executors
    engine.registerExecutor("SPEAK", async (params) => {
      const jarvis = getJarvis();
      jarvis.emit("speak", (params.text as string) ?? "");
    });

    /*
    engine.registerExecutor("NOTIFY", async (params) => {
      const device = getDeviceIntegration();
      await device.sendLocalNotification(
        (params.title as string) ?? "NexVault",
        (params.body as string) ?? "",
        params.data as Record<string, unknown>
      );
    });
    */

    engine.registerExecutor("HAPTIC", async () => {
      // Haptic feedback handled via the interaction layer
    });

    // 3. IoT Bridge
    const iotEnabled = extra.enableIoT === true;
    if (iotEnabled) {
      const bridge = getIoTBridge();
      bridge.initialize();
    }

    // 4. Device Integration
    const deviceIntegration = getDeviceIntegration();
    deviceIntegration.initialize();

    // 5. Web PWA service worker
    if (Platform.OS === "web") {
      registerServiceWorker();
    }

    // Cleanup
    return () => {
      engine.shutdown();
      if (iotEnabled) {
        getIoTBridge().shutdown();
      }
      deviceIntegration.shutdown();
    };
  }, []);
}

// ── Widget Sync ─────────────────────────────────────────────────

function useWidgetSync() {
  const vaultItems = useQuantumStore((s) => s.vaultItems);
  const memos = useQuantumStore((s) => s.memos);

  useEffect(() => {
    updateWidgetData({
      vaultItemCount: vaultItems.length,
      memoCount: memos.length,
      latestMemoTimestamp:
        memos.length > 0 ? Math.max(...memos.map((m) => m.createdAt)) : null,
      isListening: false,
    });
  }, [vaultItems.length, memos.length, memos]);
}

// ── Deep Linking ────────────────────────────────────────────────

function useDeepLinking() {
  const isAuthenticated = useQuantumStore((s) => s.isAuthenticated);
  const onboardingComplete = useQuantumStore((s) => s.onboardingComplete);

  useEffect(() => {
    const handleDeepLink = (event: { url: string }) => {
      if (!onboardingComplete) return;
      // Navigation handled by React Navigation linking config
      // We just need to validate auth state for protected routes
      const url = event.url;
      if (url.includes("nexvault://vault") || url.includes("nexvault://memos")) {
        if (!isAuthenticated) {
          useQuantumStore.getState().setPhase("AUTHENTICATION");
        }
      }
    };

    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink({ url });
    });

    const subscription = Linking.addEventListener("url", handleDeepLink);
    return () => subscription.remove();
  }, [isAuthenticated, onboardingComplete]);
}

// ── Web Keyboard Shortcuts ──────────────────────────────────────

function useWebShortcuts() {
  useEffect(() => {
    if (Platform.OS !== "web") return;

    const cleanup = registerKeyboardShortcuts((action) => {
      const jarvis = getJarvis();
      switch (action) {
        case "NEW_MEMO":
          jarvis.processInput("new memo");
          break;
        case "OPEN_VAULT":
          jarvis.processInput("open vault");
          break;
        case "GO_HOME":
          jarvis.processInput("go home");
          break;
        case "SAVE":
          jarvis.processInput("save memo");
          break;
        case "STATUS":
          jarvis.processInput("status");
          break;
        default:
          jarvis.processInput(action.toLowerCase().replace(/_/g, " "));
          break;
      }
    });

    return cleanup;
  }, []);
}

// ── Initial Route ───────────────────────────────────────────────

function useInitialRoute(): keyof RootStackParamList {
  const onboardingComplete = useQuantumStore((s) => s.onboardingComplete);
  const isAuthenticated = useQuantumStore((s) => s.isAuthenticated);

  if (onboardingComplete && isAuthenticated) return "Main";
  if (onboardingComplete) return "Authentication";
  return "Calibration";
}

// ── App Component ───────────────────────────────────────────────

export default function App() {
  useServiceInit();
  useWidgetSync();
  useDeepLinking();
  useWebShortcuts();

  const initialRoute = useInitialRoute();

  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar hidden />
      <QuantumNavigator initialRoute={initialRoute} />
    </GestureHandlerRootView>
  );
}

// ── Styles ──────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000000",
  },
});
