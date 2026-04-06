/**
 * WidgetBridge.ts - Cross-Platform Widget Data Synchronization Bridge
 *
 * Abstracts the native widget update mechanism for iOS and Android,
 * providing a unified TypeScript API that the React Native app uses
 * to push data to home screen widgets.
 *
 * Data flow:
 *   React Native app -> WidgetBridge -> Native storage -> Widget reads on next timeline/update
 *
 * iOS:
 *   Writes JSON to App Group shared UserDefaults (group.com.nexvault.app)
 *   via a native module call, then requests WidgetKit timeline reload.
 *
 * Android:
 *   Writes JSON to SharedPreferences (com.nexvault.app.widget_prefs)
 *   via a native module call, then sends a broadcast to trigger widget update.
 *
 * Web/Unsupported:
 *   Falls back gracefully with no-op implementations and console warnings.
 */

import { Platform, NativeModules } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ── Types ──────────────────────────────────────────────────────

/**
 * Shape of the widget data payload. Must match the structure expected
 * by QuantumWidgetBundle.swift (WidgetDataPayload) and
 * QuantumWidgetProvider.kt (WidgetDataModel).
 */
export interface WidgetData {
  vaultItemCount: number;
  memoCount: number;
  latestMemoTimestamp: number | null;
  isListening: boolean;
}

/**
 * Native module interface for the iOS widget bridge.
 * This module must be implemented as a native Objective-C/Swift module
 * that writes to the App Group UserDefaults and reloads WidgetKit timelines.
 */
interface NexVaultWidgetModuleIOS {
  /**
   * Writes JSON string to the App Group shared UserDefaults.
   * @param appGroup - The App Group identifier (e.g., "group.com.nexvault.app")
   * @param key - The UserDefaults key
   * @param value - The JSON string value
   */
  setSharedDefault(appGroup: string, key: string, value: string): Promise<void>;

  /**
   * Requests WidgetKit to reload all timelines for the given widget kind.
   * @param kind - The widget kind string (e.g., "QuantumWidget")
   */
  reloadAllTimelines(kind: string): Promise<void>;

  /**
   * Requests WidgetKit to reload all widget timelines regardless of kind.
   */
  reloadAllWidgetTimelines(): Promise<void>;
}

/**
 * Native module interface for the Android widget bridge.
 * This module must be implemented as a native Kotlin/Java module
 * that writes to SharedPreferences and sends an update broadcast.
 */
interface NexVaultWidgetModuleAndroid {
  /**
   * Writes a JSON string to SharedPreferences for native widget access.
   * @param prefsName - The SharedPreferences file name
   * @param key - The preference key
   * @param value - The JSON string value
   */
  setWidgetData(prefsName: string, key: string, value: string): Promise<void>;

  /**
   * Sends a broadcast to trigger immediate widget refresh.
   */
  updateWidgets(): Promise<void>;
}

// ── Constants ──────────────────────────────────────────────────

/** AsyncStorage key used by the React Native data layer */
const ASYNC_STORAGE_KEY = "@nexvault/widget_data";

/** iOS App Group identifier for shared UserDefaults */
const IOS_APP_GROUP = "group.com.nexvault.app";

/** iOS UserDefaults key (matches QuantumWidgetBundle.swift) */
const IOS_DEFAULTS_KEY = "@nexvault/widget_data";

/** iOS widget kind string (matches QuantumWidget.swift Widget.kind) */
const IOS_WIDGET_KIND = "QuantumWidget";

/** Android SharedPreferences file name (matches QuantumWidgetProvider.kt) */
const ANDROID_PREFS_NAME = "com.nexvault.app.widget_prefs";

/** Android SharedPreferences key (matches QuantumWidgetProvider.kt) */
const ANDROID_PREFS_KEY = "@nexvault/widget_data";

// ── Native Module Resolution ──────────────────────────────────

/**
 * Safely retrieves a native module, returning null if not available.
 * This prevents crashes on platforms where the module isn't linked.
 */
function getNativeModule<T>(moduleName: string): T | null {
  try {
    const mod = NativeModules[moduleName];
    return mod ?? null;
  } catch {
    return null;
  }
}

// ── Platform Implementations ──────────────────────────────────

/**
 * iOS implementation: writes to App Group UserDefaults via native module,
 * then requests a WidgetKit timeline reload.
 */
async function syncWidgetDataIOS(data: WidgetData): Promise<void> {
  const jsonString = JSON.stringify(data);

  // Always write to AsyncStorage for the React Native layer
  await AsyncStorage.setItem(ASYNC_STORAGE_KEY, jsonString);

  // Attempt to write to shared UserDefaults via native module
  const nativeModule = getNativeModule<NexVaultWidgetModuleIOS>(
    "NexVaultWidgetModule"
  );

  if (nativeModule?.setSharedDefault) {
    try {
      await nativeModule.setSharedDefault(
        IOS_APP_GROUP,
        IOS_DEFAULTS_KEY,
        jsonString
      );
    } catch (error) {
      console.warn(
        "[WidgetBridge] iOS: Failed to write to shared UserDefaults:",
        error
      );
    }
  } else {
    // Fallback: If the native module is not available (e.g., in Expo Go),
    // write only to AsyncStorage. The widget will show stale/default data
    // until the native module is linked in a production build.
    console.warn(
      "[WidgetBridge] iOS: NexVaultWidgetModule not available. " +
        "Widget data written to AsyncStorage only. " +
        "Link the native module for full widget support."
    );
  }

  // Request timeline reload
  await requestWidgetReloadIOS();
}

/**
 * iOS implementation: requests WidgetKit to reload timelines.
 */
async function requestWidgetReloadIOS(): Promise<void> {
  const nativeModule = getNativeModule<NexVaultWidgetModuleIOS>(
    "NexVaultWidgetModule"
  );

  if (nativeModule?.reloadAllTimelines) {
    try {
      await nativeModule.reloadAllTimelines(IOS_WIDGET_KIND);
    } catch (error) {
      console.warn(
        "[WidgetBridge] iOS: Failed to reload widget timelines:",
        error
      );
    }
  } else if (nativeModule?.reloadAllWidgetTimelines) {
    try {
      await nativeModule.reloadAllWidgetTimelines();
    } catch (error) {
      console.warn(
        "[WidgetBridge] iOS: Failed to reload all widget timelines:",
        error
      );
    }
  } else {
    console.warn(
      "[WidgetBridge] iOS: Cannot reload timelines - native module not available."
    );
  }
}

/**
 * Android implementation: writes to SharedPreferences via native module,
 * then sends a broadcast to trigger widget update.
 */
async function syncWidgetDataAndroid(data: WidgetData): Promise<void> {
  const jsonString = JSON.stringify(data);

  // Always write to AsyncStorage for the React Native layer
  await AsyncStorage.setItem(ASYNC_STORAGE_KEY, jsonString);

  // Attempt to write to SharedPreferences via native module
  const nativeModule = getNativeModule<NexVaultWidgetModuleAndroid>(
    "NexVaultWidgetModule"
  );

  if (nativeModule?.setWidgetData) {
    try {
      await nativeModule.setWidgetData(
        ANDROID_PREFS_NAME,
        ANDROID_PREFS_KEY,
        jsonString
      );
    } catch (error) {
      console.warn(
        "[WidgetBridge] Android: Failed to write to SharedPreferences:",
        error
      );
    }
  } else {
    console.warn(
      "[WidgetBridge] Android: NexVaultWidgetModule not available. " +
        "Widget data written to AsyncStorage only. " +
        "Link the native module for full widget support."
    );
  }

  // Send update broadcast
  await requestWidgetReloadAndroid();
}

/**
 * Android implementation: sends broadcast to trigger immediate widget update.
 */
async function requestWidgetReloadAndroid(): Promise<void> {
  const nativeModule = getNativeModule<NexVaultWidgetModuleAndroid>(
    "NexVaultWidgetModule"
  );

  if (nativeModule?.updateWidgets) {
    try {
      await nativeModule.updateWidgets();
    } catch (error) {
      console.warn(
        "[WidgetBridge] Android: Failed to send widget update broadcast:",
        error
      );
    }
  } else {
    console.warn(
      "[WidgetBridge] Android: Cannot update widgets - native module not available."
    );
  }
}

/**
 * Web/unsupported platform fallback: writes to AsyncStorage only.
 */
async function syncWidgetDataFallback(data: WidgetData): Promise<void> {
  try {
    await AsyncStorage.setItem(ASYNC_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // AsyncStorage may not be available on all platforms
  }

  if (__DEV__) {
    console.info(
      "[WidgetBridge] Home screen widgets are not supported on this platform. " +
        "Data saved to AsyncStorage for development purposes."
    );
  }
}

/**
 * Web/unsupported platform fallback for reload: no-op.
 */
async function requestWidgetReloadFallback(): Promise<void> {
  if (__DEV__) {
    console.info(
      "[WidgetBridge] Widget reload is not supported on this platform."
    );
  }
}

// ── Public API ────────────────────────────────────────────────

/**
 * Synchronizes widget data to the native widget layer.
 *
 * Call this function whenever vault items or memos change in the app.
 * It will:
 *   1. Write the data to AsyncStorage (for the React Native layer)
 *   2. Write to the platform-specific native storage (UserDefaults/SharedPreferences)
 *   3. Request an immediate widget refresh
 *
 * Falls back gracefully on unsupported platforms.
 *
 * @param data - The current widget data to sync
 *
 * @example
 * ```ts
 * import { syncWidgetData } from '@/widgets/WidgetBridge';
 *
 * // After adding a vault item:
 * await syncWidgetData({
 *   vaultItemCount: store.vaultItems.length,
 *   memoCount: store.memos.length,
 *   latestMemoTimestamp: store.memos[store.memos.length - 1]?.createdAt ?? null,
 *   isListening: store.isListening,
 * });
 * ```
 */
export async function syncWidgetData(data: WidgetData): Promise<void> {
  switch (Platform.OS) {
    case "ios":
      return syncWidgetDataIOS(data);
    case "android":
      return syncWidgetDataAndroid(data);
    default:
      return syncWidgetDataFallback(data);
  }
}

/**
 * Requests an immediate widget reload/refresh without changing data.
 *
 * Useful when you know the data has already been written (e.g., by a
 * background task) and you just need to tell the widget to re-read it.
 *
 * Falls back gracefully on unsupported platforms.
 *
 * @example
 * ```ts
 * import { requestWidgetReload } from '@/widgets/WidgetBridge';
 *
 * // After app comes to foreground:
 * await requestWidgetReload();
 * ```
 */
export async function requestWidgetReload(): Promise<void> {
  switch (Platform.OS) {
    case "ios":
      return requestWidgetReloadIOS();
    case "android":
      return requestWidgetReloadAndroid();
    default:
      return requestWidgetReloadFallback();
  }
}

/**
 * Reads the current widget data from AsyncStorage.
 *
 * This is a convenience method for reading back the data that was
 * previously synced. Useful for verifying the current widget state
 * or initializing UI that mirrors the widget content.
 *
 * @returns The current widget data, or defaults if none is stored
 */
export async function getWidgetData(): Promise<WidgetData> {
  try {
    const raw = await AsyncStorage.getItem(ASYNC_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw) as WidgetData;
    }
  } catch {
    // Fall through to defaults
  }

  return {
    vaultItemCount: 0,
    memoCount: 0,
    latestMemoTimestamp: null,
    isListening: false,
  };
}

/**
 * Checks whether native widget support is available on the current platform.
 *
 * Returns true if the native module is linked and the platform supports
 * home screen widgets. Returns false on web, Expo Go, or if the native
 * module is not linked.
 *
 * @returns Whether native widget updates will work
 */
export function isWidgetSupported(): boolean {
  if (Platform.OS === "ios" || Platform.OS === "android") {
    const nativeModule = getNativeModule<Record<string, unknown>>(
      "NexVaultWidgetModule"
    );
    return nativeModule !== null;
  }
  return false;
}

/**
 * Returns the current platform's widget support status as a descriptive string.
 * Useful for debugging and diagnostics UI.
 */
export function getWidgetSupportInfo(): string {
  const platform = Platform.OS;

  if (platform === "ios") {
    const mod = getNativeModule<NexVaultWidgetModuleIOS>("NexVaultWidgetModule");
    if (mod?.setSharedDefault && mod?.reloadAllTimelines) {
      return "iOS: Full WidgetKit support via NexVaultWidgetModule";
    }
    if (mod) {
      return "iOS: Partial native module (some methods missing)";
    }
    return "iOS: Native module not linked (AsyncStorage fallback only)";
  }

  if (platform === "android") {
    const mod = getNativeModule<NexVaultWidgetModuleAndroid>(
      "NexVaultWidgetModule"
    );
    if (mod?.setWidgetData && mod?.updateWidgets) {
      return "Android: Full AppWidgetProvider support via NexVaultWidgetModule";
    }
    if (mod) {
      return "Android: Partial native module (some methods missing)";
    }
    return "Android: Native module not linked (AsyncStorage fallback only)";
  }

  return `${platform}: Home screen widgets not supported`;
}
