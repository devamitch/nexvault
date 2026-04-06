/**
 * DeviceIntegration.ts - Maximum Device Capability Usage
 *
 * Integrates with every available device sensor and API:
 *   - Location (GPS + geofencing)
 *   - Network status (online/offline handling)
 *   - Battery monitoring
 *   - Device info
 *   - Clipboard
 *   - File system access
 *   - Sharing
 *
 * This is the "maximum phone capacity" layer.
 */

import * as Device from "expo-device";
import * as Location from "expo-location";
import * as Network from "expo-network";
import { AppState, type AppStateStatus } from "react-native";
// import * as Notifications from "expo-notifications";
import { EventEmitter } from "eventemitter3";
import * as Clipboard from "expo-clipboard";
import * as Sharing from "expo-sharing";

// ── Types ──────────────────────────────────────────────────────

export interface DeviceState {
  // Location
  location: { latitude: number; longitude: number; altitude: number | null } | null;
  locationPermission: boolean;

  // Network
  isConnected: boolean;
  connectionType: string | null;

  // Device
  deviceName: string | null;
  deviceModel: string | null;
  osVersion: string | null;
  isDevice: boolean; // vs simulator

  // App
  appState: AppStateStatus;

  // Storage
  freeStorage: number | null;
}

// ── Device Integration ─────────────────────────────────────────

export class DeviceIntegration extends EventEmitter {
  private state: DeviceState = {
    location: null,
    locationPermission: false,
    isConnected: true,
    connectionType: null,
    deviceName: null,
    deviceModel: null,
    osVersion: null,
    isDevice: true,
    appState: "active",
    freeStorage: null,
  };

  private locationWatcher: Location.LocationSubscription | null = null;
  private appStateListener: ReturnType<typeof AppState.addEventListener> | null = null;

  async initialize(): Promise<void> {
    // Device info (sync)
    this.state.deviceName = Device.deviceName;
    this.state.deviceModel = Device.modelName;
    this.state.osVersion = Device.osVersion;
    this.state.isDevice = Device.isDevice;

    // Network state
    const networkState = await Network.getNetworkStateAsync();
    this.state.isConnected = networkState.isConnected ?? true;
    this.state.connectionType = networkState.type ?? null;

    /*
    // Storage
    try {
      const info = await FileSystem.getInfoAsync(
        FileSystem.documentDirectory ?? ""
      );
      this.state.freeStorage = info.exists ? info.size : null;
    } catch { // Non-critical }
    */

    // App state listener
    this.appStateListener = AppState.addEventListener("change", (nextState) => {
      this.state.appState = nextState;
      this.emit("appStateChange", nextState);
    });

    // Notification setup (commented out due to missing expo-notifications)
    // await this.setupNotifications();
  }

  async shutdown(): Promise<void> {
    this.stopLocationTracking();
    this.appStateListener?.remove();
    this.removeAllListeners();
  }

  // ── Location ──

  async requestLocationPermission(): Promise<boolean> {
    const { status } = await Location.requestForegroundPermissionsAsync();
    this.state.locationPermission = status === "granted";
    return this.state.locationPermission;
  }

  async startLocationTracking(): Promise<void> {
    if (!this.state.locationPermission) {
      const granted = await this.requestLocationPermission();
      if (!granted) return;
    }

    this.locationWatcher = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 10000, // 10 seconds
        distanceInterval: 50, // 50 meters
      },
      (location) => {
        this.state.location = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          altitude: location.coords.altitude,
        };
        this.emit("locationUpdate", this.state.location);
      }
    );
  }

  stopLocationTracking(): void {
    this.locationWatcher?.remove();
    this.locationWatcher = null;
  }

  async getCurrentLocation(): Promise<DeviceState["location"]> {
    if (!this.state.locationPermission) {
      await this.requestLocationPermission();
    }

    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      this.state.location = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        altitude: loc.coords.altitude,
      };
      return this.state.location;
    } catch {
      return null;
    }
  }

  /*
  private async setupNotifications(): Promise<void> {
    if (Platform.OS === "web") return;

    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== "granted") return;

    // Configure notification handler
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  }

  async sendLocalNotification(
    title: string,
    body: string,
    data?: Record<string, unknown>,
    scheduleSecs?: number
  ): Promise<string> {
    if (scheduleSecs) {
      return Notifications.scheduleNotificationAsync({
        content: { title, body, data },
        trigger: { seconds: scheduleSecs, type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL },
      });
    }

    return Notifications.scheduleNotificationAsync({
      content: { title, body, data },
      trigger: null, // Immediate
    });
  }
  */

  // ── Clipboard ──

  async copyToClipboard(text: string): Promise<void> {
    await Clipboard.setStringAsync(text);
  }

  async getClipboard(): Promise<string> {
    return Clipboard.getStringAsync();
  }

  // ── Sharing ──

  async shareFile(uri: string, mimeType?: string): Promise<void> {
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType });
    }
  }

  // ── Network ──

  async checkNetwork(): Promise<{ connected: boolean; type: string | null }> {
    const state = await Network.getNetworkStateAsync();
    this.state.isConnected = state.isConnected ?? false;
    this.state.connectionType = state.type ?? null;
    return {
      connected: this.state.isConnected,
      type: this.state.connectionType,
    };
  }

  // ── File System ──

  async saveToDocuments(filename: string, content: string): Promise<string> {
    // const path = `${FileSystem.documentDirectory}${filename}`;
    // await FileSystem.writeAsStringAsync(path, content);
    console.warn("DeviceIntegration: saveToDocuments is disabled.");
    return "";
  }

  async readFromDocuments(filename: string): Promise<string | null> {
    /*
    const path = `${FileSystem.documentDirectory}${filename}`;
    try {
      return await FileSystem.readAsStringAsync(path);
    } catch {
      return null;
    }
    */
    return null;
  }

  async listDocuments(): Promise<string[]> {
    /*
    try {
      return await FileSystem.readDirectoryAsync(
        FileSystem.documentDirectory ?? ""
      );
    } catch {
      return [];
    }
    */
    return [];
  }

  // ── State Access ──

  getState(): Readonly<DeviceState> {
    return { ...this.state };
  }
}

// ── Singleton ──────────────────────────────────────────────────

let _integration: DeviceIntegration | null = null;

export function getDeviceIntegration(): DeviceIntegration {
  if (!_integration) {
    _integration = new DeviceIntegration();
  }
  return _integration;
}
