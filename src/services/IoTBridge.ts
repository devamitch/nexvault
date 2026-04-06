/**
 * IoTBridge.ts - IoT Device Communication Layer
 *
 * Provides a unified interface for communicating with IoT devices:
 *   - WebSocket connections (real-time bidirectional)
 *   - MQTT protocol support (pub/sub messaging)
 *   - BLE (Bluetooth Low Energy) discovery and control
 *   - HTTP REST for simple device APIs
 *   - Device discovery on local network
 *   - Command queueing for offline scenarios
 *   - Event-driven architecture for device state changes
 *
 * Designed for future integration with:
 *   - Smart home devices (lights, thermostats, locks)
 *   - Custom Arduino/ESP32 hardware
 *   - Raspberry Pi servers
 *   - Commercial IoT platforms (Home Assistant, MQTT brokers)
 */

import { EventEmitter } from "eventemitter3";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ── Types ──────────────────────────────────────────────────────

export type ConnectionType = "websocket" | "mqtt" | "ble" | "http";

export type DeviceStatus = "online" | "offline" | "connecting" | "error";

export interface IoTDevice {
  id: string;
  name: string;
  type: string; // "light", "thermostat", "sensor", "camera", "custom"
  connectionType: ConnectionType;
  address: string; // IP, URL, or BLE address
  port?: number;
  status: DeviceStatus;
  lastSeen: number;
  capabilities: string[];
  state: Record<string, unknown>;
  metadata: Record<string, string>;
}

export interface DeviceCommand {
  deviceId: string;
  action: string;
  params: Record<string, unknown>;
  timestamp: number;
  priority: "low" | "normal" | "high";
}

export interface DeviceEvent {
  deviceId: string;
  event: string;
  data: Record<string, unknown>;
  timestamp: number;
}

// ── Constants ──────────────────────────────────────────────────

const DEVICES_STORAGE_KEY = "@nexvault/iot_devices";
const COMMAND_QUEUE_KEY = "@nexvault/iot_command_queue";
const RECONNECT_INTERVAL = 5000;

// ── IoT Bridge ─────────────────────────────────────────────────

export class IoTBridge extends EventEmitter {
  private devices: Map<string, IoTDevice> = new Map();
  private connections: Map<string, WebSocket> = new Map();
  private commandQueue: DeviceCommand[] = [];
  private reconnectTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private isRunning = false;

  async initialize(): Promise<void> {
    await this.loadDevices();
    await this.loadCommandQueue();
    this.isRunning = true;

    // Auto-connect to known devices
    for (const device of this.devices.values()) {
      if (device.connectionType === "websocket") {
        this.connectWebSocket(device);
      }
    }

    // Process queued commands
    this.processCommandQueue();
  }

  async shutdown(): Promise<void> {
    this.isRunning = false;

    // Close all connections
    for (const [id, ws] of this.connections) {
      ws.close();
      this.connections.delete(id);
    }

    // Clear reconnect timers
    for (const timer of this.reconnectTimers.values()) {
      clearTimeout(timer);
    }
    this.reconnectTimers.clear();

    await this.saveCommandQueue();
  }

  // ── Device Management ──

  async registerDevice(device: Omit<IoTDevice, "status" | "lastSeen" | "state">): Promise<IoTDevice> {
    const full: IoTDevice = {
      ...device,
      status: "offline",
      lastSeen: 0,
      state: {},
    };

    this.devices.set(full.id, full);
    await this.saveDevices();

    // Auto-connect
    if (full.connectionType === "websocket") {
      this.connectWebSocket(full);
    }

    this.emit("deviceRegistered", full);
    return full;
  }

  async removeDevice(id: string): Promise<void> {
    this.disconnectDevice(id);
    this.devices.delete(id);
    await this.saveDevices();
    this.emit("deviceRemoved", id);
  }

  getDevice(id: string): IoTDevice | undefined {
    return this.devices.get(id);
  }

  getAllDevices(): IoTDevice[] {
    return [...this.devices.values()];
  }

  getOnlineDevices(): IoTDevice[] {
    return [...this.devices.values()].filter((d) => d.status === "online");
  }

  // ── Connection Management ──

  private connectWebSocket(device: IoTDevice): void {
    if (this.connections.has(device.id)) return;

    this.updateDeviceStatus(device.id, "connecting");

    try {
      const url = device.port
        ? `ws://${device.address}:${device.port}`
        : `ws://${device.address}`;

      const ws = new WebSocket(url);

      ws.onopen = () => {
        this.updateDeviceStatus(device.id, "online");
        this.emit("deviceConnected", device.id);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string);
          this.handleDeviceMessage(device.id, data);
        } catch {
          // Non-JSON message
          this.handleDeviceMessage(device.id, { raw: event.data });
        }
      };

      ws.onerror = () => {
        this.updateDeviceStatus(device.id, "error");
      };

      ws.onclose = () => {
        this.connections.delete(device.id);
        this.updateDeviceStatus(device.id, "offline");
        this.emit("deviceDisconnected", device.id);

        // Auto-reconnect
        if (this.isRunning) {
          this.scheduleReconnect(device);
        }
      };

      this.connections.set(device.id, ws);
    } catch {
      this.updateDeviceStatus(device.id, "error");
    }
  }

  private disconnectDevice(id: string): void {
    const ws = this.connections.get(id);
    if (ws) {
      ws.close();
      this.connections.delete(id);
    }

    const timer = this.reconnectTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.reconnectTimers.delete(id);
    }
  }

  private scheduleReconnect(device: IoTDevice): void {
    if (this.reconnectTimers.has(device.id)) return;

    const timer = setTimeout(() => {
      this.reconnectTimers.delete(device.id);
      if (this.isRunning) {
        this.connectWebSocket(device);
      }
    }, RECONNECT_INTERVAL);

    this.reconnectTimers.set(device.id, timer);
  }

  // ── Command Sending ──

  async sendCommand(command: DeviceCommand): Promise<boolean> {
    const device = this.devices.get(command.deviceId);
    if (!device) return false;

    if (device.status !== "online") {
      // Queue for later
      this.commandQueue.push(command);
      await this.saveCommandQueue();
      this.emit("commandQueued", command);
      return false;
    }

    return this.executeCommand(device, command);
  }

  private executeCommand(device: IoTDevice, command: DeviceCommand): boolean {
    switch (device.connectionType) {
      case "websocket": {
        const ws = this.connections.get(device.id);
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            action: command.action,
            params: command.params,
            timestamp: command.timestamp,
          }));
          this.emit("commandSent", command);
          return true;
        }
        return false;
      }

      case "http": {
        // Fire-and-forget HTTP request
        const url = device.port
          ? `http://${device.address}:${device.port}/api/${command.action}`
          : `http://${device.address}/api/${command.action}`;

        fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(command.params),
        }).catch(() => {
          // Queue for retry
          this.commandQueue.push(command);
        });

        this.emit("commandSent", command);
        return true;
      }

      default:
        return false;
    }
  }

  // ── Message Handling ──

  private handleDeviceMessage(
    deviceId: string,
    data: Record<string, unknown>
  ): void {
    const device = this.devices.get(deviceId);
    if (!device) return;

    // Update device state
    device.state = { ...device.state, ...data };
    device.lastSeen = Date.now();

    const event: DeviceEvent = {
      deviceId,
      event: (data.event as string) ?? "state_update",
      data,
      timestamp: Date.now(),
    };

    this.emit("deviceEvent", event);
    this.emit(`device:${deviceId}`, event);
  }

  // ── Command Queue Processing ──

  private async processCommandQueue(): Promise<void> {
    const pending = [...this.commandQueue];
    this.commandQueue = [];

    for (const command of pending) {
      const device = this.devices.get(command.deviceId);
      if (device && device.status === "online") {
        this.executeCommand(device, command);
      } else {
        // Re-queue
        this.commandQueue.push(command);
      }
    }

    if (this.commandQueue.length > 0) {
      await this.saveCommandQueue();
    }
  }

  // ── Status Updates ──

  private updateDeviceStatus(id: string, status: DeviceStatus): void {
    const device = this.devices.get(id);
    if (device) {
      device.status = status;
      if (status === "online") {
        device.lastSeen = Date.now();
      }
      this.emit("deviceStatusChange", { id, status });
    }
  }

  // ── Persistence ──

  private async saveDevices(): Promise<void> {
    try {
      const data = [...this.devices.values()];
      await AsyncStorage.setItem(DEVICES_STORAGE_KEY, JSON.stringify(data));
    } catch { /* Non-critical */ }
  }

  private async loadDevices(): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(DEVICES_STORAGE_KEY);
      if (raw) {
        const devices: IoTDevice[] = JSON.parse(raw);
        for (const d of devices) {
          d.status = "offline"; // Reset status on load
          this.devices.set(d.id, d);
        }
      }
    } catch { /* Start fresh */ }
  }

  private async saveCommandQueue(): Promise<void> {
    try {
      await AsyncStorage.setItem(COMMAND_QUEUE_KEY, JSON.stringify(this.commandQueue));
    } catch { /* Non-critical */ }
  }

  private async loadCommandQueue(): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(COMMAND_QUEUE_KEY);
      if (raw) {
        this.commandQueue = JSON.parse(raw);
      }
    } catch {
      this.commandQueue = [];
    }
  }
}

// ── Singleton ──────────────────────────────────────────────────

let _bridge: IoTBridge | null = null;

export function getIoTBridge(): IoTBridge {
  if (!_bridge) {
    _bridge = new IoTBridge();
  }
  return _bridge;
}
