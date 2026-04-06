/**
 * IoTBridge.test.ts - IoT Device Communication Tests
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { IoTBridge } from "../../services/IoTBridge";

// Mock WebSocket
class MockWebSocket {
  static OPEN = 1;
  readyState = MockWebSocket.OPEN;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  send = jest.fn();
  close = jest.fn(() => { this.onclose?.(); });

  constructor(_url: string) {
    // Simulate async connection
    setTimeout(() => this.onopen?.(), 0);
  }
}

(global as unknown as Record<string, unknown>).WebSocket = MockWebSocket;

let bridge: IoTBridge;

beforeEach(async () => {
  jest.clearAllMocks();
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
  (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
  bridge = new IoTBridge();
  await bridge.initialize();
});

afterEach(async () => {
  await bridge.shutdown();
});

const makeDevice = (overrides: Record<string, unknown> = {}) => ({
  id: (overrides.id as string) ?? "dev1",
  name: (overrides.name as string) ?? "Test Device",
  type: (overrides.type as string) ?? "sensor",
  connectionType: (overrides.connectionType as string) ?? "http",
  address: (overrides.address as string) ?? "192.168.1.100",
  port: overrides.port as number | undefined,
  capabilities: (overrides.capabilities as string[]) ?? ["read"],
  metadata: (overrides.metadata as Record<string, string>) ?? {},
});

describe("IoTBridge", () => {
  it("registers a device", async () => {
    const device = await bridge.registerDevice(makeDevice({ id: "d1" }));
    expect(device.id).toBe("d1");
    expect(device.status).toBe("offline");
    expect(device.lastSeen).toBe(0);
    expect(bridge.getAllDevices()).toHaveLength(1);
  });

  it("removes a device", async () => {
    await bridge.registerDevice(makeDevice({ id: "d1" }));
    await bridge.registerDevice(makeDevice({ id: "d2" }));
    await bridge.removeDevice("d1");
    expect(bridge.getAllDevices()).toHaveLength(1);
    expect(bridge.getAllDevices()[0].id).toBe("d2");
  });

  it("gets device by id", async () => {
    await bridge.registerDevice(makeDevice({ id: "d1", name: "Sensor" }));
    const device = bridge.getDevice("d1");
    expect(device?.name).toBe("Sensor");
  });

  it("returns undefined for unknown device", () => {
    expect(bridge.getDevice("unknown")).toBeUndefined();
  });

  it("filters online devices", async () => {
    await bridge.registerDevice(makeDevice({ id: "d1" }));
    await bridge.registerDevice(makeDevice({ id: "d2" }));
    // Both offline by default
    expect(bridge.getOnlineDevices()).toHaveLength(0);
  });

  it("persists devices to AsyncStorage", async () => {
    await bridge.registerDevice(makeDevice({ id: "d1" }));
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      "@nexvault/iot_devices", expect.any(String)
    );
  });

  it("queues command for offline device", async () => {
    await bridge.registerDevice(makeDevice({ id: "d1" }));
    const listener = jest.fn();
    bridge.on("commandQueued", listener);
    const result = await bridge.sendCommand({
      deviceId: "d1", action: "toggle", params: {},
      timestamp: Date.now(), priority: "normal",
    });
    expect(result).toBe(false);
    expect(listener).toHaveBeenCalled();
  });

  it("returns false for command to unknown device", async () => {
    const result = await bridge.sendCommand({
      deviceId: "unknown", action: "toggle", params: {},
      timestamp: Date.now(), priority: "normal",
    });
    expect(result).toBe(false);
  });

  it("emits deviceRegistered event", async () => {
    const listener = jest.fn();
    bridge.on("deviceRegistered", listener);
    await bridge.registerDevice(makeDevice({ id: "d1" }));
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ id: "d1" }));
  });

  it("emits deviceRemoved event", async () => {
    const listener = jest.fn();
    bridge.on("deviceRemoved", listener);
    await bridge.registerDevice(makeDevice({ id: "d1" }));
    await bridge.removeDevice("d1");
    expect(listener).toHaveBeenCalledWith("d1");
  });

  it("loads devices from AsyncStorage on init", async () => {
    const stored = [{
      id: "stored1", name: "Stored", type: "light",
      connectionType: "http", address: "10.0.0.1",
      status: "online", lastSeen: 1000, state: { on: true },
      capabilities: ["toggle"], metadata: {},
    }];
    (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
      if (key === "@nexvault/iot_devices") return Promise.resolve(JSON.stringify(stored));
      return Promise.resolve(null);
    });
    const fresh = new IoTBridge();
    await fresh.initialize();
    expect(fresh.getAllDevices()).toHaveLength(1);
    expect(fresh.getAllDevices()[0].id).toBe("stored1");
    expect(fresh.getAllDevices()[0].status).toBe("offline"); // Reset on load
    await fresh.shutdown();
  });

  it("sends HTTP command to online device", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true });
    await bridge.registerDevice(makeDevice({ id: "d1", connectionType: "http" }));
    // Manually set device online for test
    const device = bridge.getDevice("d1");
    if (device) (device as Record<string, unknown>).status = "online";
    const listener = jest.fn();
    bridge.on("commandSent", listener);
    const result = await bridge.sendCommand({
      deviceId: "d1", action: "toggle", params: { state: true },
      timestamp: Date.now(), priority: "normal",
    });
    expect(result).toBe(true);
    expect(global.fetch).toHaveBeenCalled();
    expect(listener).toHaveBeenCalled();
  });

  it("shutdown closes all connections", async () => {
    await bridge.registerDevice(makeDevice({ id: "d1", connectionType: "websocket" }));
    // Give time for WebSocket to attempt connection
    await new Promise((r) => setTimeout(r, 50));
    await bridge.shutdown();
    // Should not throw
    expect(bridge.getAllDevices()).toHaveLength(1);
  });
});
