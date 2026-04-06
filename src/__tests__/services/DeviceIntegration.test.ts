/**
 * DeviceIntegration.test.ts - Device Capability Tests
 */

import { DeviceIntegration } from "../../services/DeviceIntegration";

// Mock expo modules
jest.mock("expo-location", () => ({
  requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: "granted" }),
  watchPositionAsync: jest.fn().mockResolvedValue({ remove: jest.fn() }),
  getCurrentPositionAsync: jest.fn().mockResolvedValue({
    coords: { latitude: 40.7128, longitude: -74.006, altitude: 10 },
  }),
  Accuracy: { Balanced: 3 },
}));

jest.mock("expo-network", () => ({
  getNetworkStateAsync: jest.fn().mockResolvedValue({
    isConnected: true,
    type: "wifi",
  }),
}));

jest.mock("expo-device", () => ({
  deviceName: "iPhone 15 Pro",
  modelName: "iPhone15,2",
  osVersion: "17.0",
  isDevice: true,
}));

/*
jest.mock("expo-notifications", () => ({
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: "granted" }),
  setNotificationHandler: jest.fn(),
  scheduleNotificationAsync: jest.fn().mockResolvedValue("notif-id-123"),
  SchedulableTriggerInputTypes: { TIME_INTERVAL: "timeInterval" },
}));
*/

jest.mock("expo-file-system", () => ({
  documentDirectory: "/mock/documents/",
  getInfoAsync: jest.fn().mockResolvedValue({ exists: true, size: 1024000 }),
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
  readAsStringAsync: jest.fn().mockResolvedValue("file content here"),
  readDirectoryAsync: jest.fn().mockResolvedValue(["file1.txt", "file2.json"]),
}));

jest.mock("expo-clipboard", () => ({
  setStringAsync: jest.fn().mockResolvedValue(undefined),
  getStringAsync: jest.fn().mockResolvedValue("clipboard text"),
}));

jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  shareAsync: jest.fn().mockResolvedValue(undefined),
}));

let integration: DeviceIntegration;

beforeEach(async () => {
  jest.clearAllMocks();
  integration = new DeviceIntegration();
  await integration.initialize();
});

afterEach(async () => {
  await integration.shutdown();
});

describe("DeviceIntegration", () => {
  // ── Initialization ──

  it("populates device info on init", () => {
    const state = integration.getState();
    expect(state.deviceName).toBe("iPhone 15 Pro");
    expect(state.deviceModel).toBe("iPhone15,2");
    expect(state.osVersion).toBe("17.0");
    expect(state.isDevice).toBe(true);
  });

  it("checks network state on init", () => {
    const state = integration.getState();
    expect(state.isConnected).toBe(true);
    expect(state.connectionType).toBe("wifi");
  });

  // ── Location ──

  it("requests location permission", async () => {
    const Location = require("expo-location");
    const result = await integration.requestLocationPermission();
    expect(result).toBe(true);
    expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalled();
  });

  it("gets current location", async () => {
    const loc = await integration.getCurrentLocation();
    expect(loc).toEqual({
      latitude: 40.7128,
      longitude: -74.006,
      altitude: 10,
    });
    expect(integration.getState().location).toEqual(loc);
  });

  it("starts and stops location tracking", async () => {
    const Location = require("expo-location");
    await integration.startLocationTracking();
    expect(Location.watchPositionAsync).toHaveBeenCalled();
    integration.stopLocationTracking();
    // Should not throw
  });

  // ── Clipboard ──

  it("copies to clipboard", async () => {
    const Clipboard = require("expo-clipboard");
    await integration.copyToClipboard("test text");
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith("test text");
  });

  it("reads from clipboard", async () => {
    const text = await integration.getClipboard();
    expect(text).toBe("clipboard text");
  });

  // ── File System ──

  it("saves to documents", async () => {
    const FileSystem = require("expo-file-system");
    const path = await integration.saveToDocuments("test.txt", "content");
    expect(path).toBe("/mock/documents/test.txt");
    expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(
      "/mock/documents/test.txt",
      "content"
    );
  });

  it("reads from documents", async () => {
    const content = await integration.readFromDocuments("test.txt");
    expect(content).toBe("file content here");
  });

  it("lists documents", async () => {
    const files = await integration.listDocuments();
    expect(files).toEqual(["file1.txt", "file2.json"]);
  });

  /*
  // ── Notifications ──

  it("sends immediate notification", async () => {
    const Notifications = require("expo-notifications");
    const id = await integration.sendLocalNotification("Title", "Body", { key: "val" });
    expect(id).toBe("notif-id-123");
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
      content: { title: "Title", body: "Body", data: { key: "val" } },
      trigger: null,
    });
  });

  it("sends scheduled notification", async () => {
    const Notifications = require("expo-notifications");
    await integration.sendLocalNotification("Title", "Body", undefined, 60);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
      content: { title: "Title", body: "Body", data: undefined },
      trigger: { seconds: 60, type: "timeInterval" },
    });
  });
  */

  // ── Network ──

  it("checks network state", async () => {
    const result = await integration.checkNetwork();
    expect(result.connected).toBe(true);
    expect(result.type).toBe("wifi");
  });

  // ── Sharing ──

  it("shares a file", async () => {
    const Sharing = require("expo-sharing");
    await integration.shareFile("/path/to/file.pdf", "application/pdf");
    expect(Sharing.shareAsync).toHaveBeenCalledWith("/path/to/file.pdf", {
      mimeType: "application/pdf",
    });
  });

  // ── State ──

  it("returns a copy of state (not reference)", () => {
    const s1 = integration.getState();
    const s2 = integration.getState();
    expect(s1).toEqual(s2);
    expect(s1).not.toBe(s2);
  });

  // ── Shutdown ──

  it("cleans up on shutdown", async () => {
    await integration.shutdown();
    // Should not throw if called twice
    await integration.shutdown();
  });
});
