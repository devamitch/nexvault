/**
 * AutomationEngine.ts - Task Automation System
 *
 * Enables automated workflows triggered by:
 *   - Time-based schedules (cron-like)
 *   - Location geofences
 *   - Device sensor thresholds
 *   - IoT device events
 *   - Voice commands
 *   - App state changes
 *
 * This is the "automation" layer that makes NexVault a real
 * Jarvis-like assistant, not just a UI toy.
 */

import { EventEmitter } from "eventemitter3";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ── Types ──────────────────────────────────────────────────────

export type TriggerType =
  | "SCHEDULE"
  | "LOCATION"
  | "SENSOR"
  | "IOT_EVENT"
  | "VOICE"
  | "STATE_CHANGE"
  | "MANUAL";

export type ActionType =
  | "SPEAK"
  | "NOTIFY"
  | "HAPTIC"
  | "NAVIGATE"
  | "CREATE_ENTRY"
  | "IOT_COMMAND"
  | "HTTP_REQUEST"
  | "RUN_SCRIPT";

export interface AutomationTrigger {
  type: TriggerType;
  config: Record<string, unknown>;
}

export interface AutomationAction {
  type: ActionType;
  params: Record<string, unknown>;
  delay?: number; // ms delay before execution
}

export interface Automation {
  id: string;
  name: string;
  description: string;
  trigger: AutomationTrigger;
  actions: AutomationAction[];
  enabled: boolean;
  lastRun: number | null;
  runCount: number;
  createdAt: number;
}

type ActionExecutor = (params: Record<string, unknown>) => Promise<void>;

// ── Constants ──────────────────────────────────────────────────

const STORAGE_KEY = "@nexvault/automations";

// ── Engine ─────────────────────────────────────────────────────

export class AutomationEngine extends EventEmitter {
  private automations: Automation[] = [];
  private executors: Map<ActionType, ActionExecutor> = new Map();
  private scheduleTimers: Map<string, ReturnType<typeof setInterval>> = new Map();
  private isRunning = false;

  async initialize(): Promise<void> {
    await this.loadAutomations();
    this.isRunning = true;
    this.startScheduledAutomations();
  }

  async shutdown(): Promise<void> {
    this.isRunning = false;
    // Clear all scheduled timers
    for (const timer of this.scheduleTimers.values()) {
      clearInterval(timer);
    }
    this.scheduleTimers.clear();
  }

  // ── Action Executors Registration ──

  registerExecutor(type: ActionType, executor: ActionExecutor): void {
    this.executors.set(type, executor);
  }

  // ── CRUD ──

  async addAutomation(automation: Omit<Automation, "lastRun" | "runCount" | "createdAt">): Promise<Automation> {
    const full: Automation = {
      ...automation,
      lastRun: null,
      runCount: 0,
      createdAt: Date.now(),
    };

    this.automations.push(full);
    await this.saveAutomations();

    if (full.enabled && full.trigger.type === "SCHEDULE") {
      this.scheduleAutomation(full);
    }

    this.emit("automationAdded", full);
    return full;
  }

  async removeAutomation(id: string): Promise<void> {
    this.automations = this.automations.filter((a) => a.id !== id);
    this.clearSchedule(id);
    await this.saveAutomations();
    this.emit("automationRemoved", id);
  }

  async toggleAutomation(id: string, enabled: boolean): Promise<void> {
    const automation = this.automations.find((a) => a.id === id);
    if (!automation) return;

    automation.enabled = enabled;

    if (enabled && automation.trigger.type === "SCHEDULE") {
      this.scheduleAutomation(automation);
    } else {
      this.clearSchedule(id);
    }

    await this.saveAutomations();
    this.emit("automationToggled", { id, enabled });
  }

  getAutomations(): Readonly<Automation[]> {
    return [...this.automations];
  }

  // ── Trigger Handling ──

  /**
   * External systems call this when an event occurs that
   * might trigger an automation.
   */
  async handleEvent(
    triggerType: TriggerType,
    eventData: Record<string, unknown>
  ): Promise<void> {
    if (!this.isRunning) return;

    const matching = this.automations.filter(
      (a) => a.enabled && a.trigger.type === triggerType
    );

    for (const automation of matching) {
      if (this.matchesTrigger(automation.trigger, eventData)) {
        await this.executeAutomation(automation);
      }
    }
  }

  private matchesTrigger(
    trigger: AutomationTrigger,
    eventData: Record<string, unknown>
  ): boolean {
    switch (trigger.type) {
      case "IOT_EVENT": {
        const deviceId = trigger.config.deviceId;
        return eventData.deviceId === deviceId;
      }
      case "STATE_CHANGE": {
        const stateKey = trigger.config.stateKey as string;
        return eventData.key === stateKey;
      }
      case "SENSOR": {
        const threshold = trigger.config.threshold as number;
        const value = eventData.value as number;
        const operator = trigger.config.operator as string;
        if (operator === "gt") return value > threshold;
        if (operator === "lt") return value < threshold;
        return value === threshold;
      }
      case "VOICE": {
        const keyword = (trigger.config.keyword as string)?.toLowerCase();
        const input = (eventData.transcript as string)?.toLowerCase();
        return input?.includes(keyword) ?? false;
      }
      default:
        return true;
    }
  }

  // ── Execution ──

  private async executeAutomation(automation: Automation): Promise<void> {
    this.emit("automationStart", automation.id);

    try {
      for (const action of automation.actions) {
        if (action.delay) {
          await new Promise((r) => setTimeout(r, action.delay));
        }

        const executor = this.executors.get(action.type);
        if (executor) {
          await executor(action.params);
        } else {
          this.emit("actionSkipped", {
            automationId: automation.id,
            actionType: action.type,
            reason: "No executor registered",
          });
        }
      }

      automation.lastRun = Date.now();
      automation.runCount++;
      await this.saveAutomations();

      this.emit("automationComplete", automation.id);
    } catch (error) {
      this.emit("automationError", { id: automation.id, error });
    }
  }

  // ── Scheduling ──

  private startScheduledAutomations(): void {
    for (const automation of this.automations) {
      if (automation.enabled && automation.trigger.type === "SCHEDULE") {
        this.scheduleAutomation(automation);
      }
    }
  }

  private scheduleAutomation(automation: Automation): void {
    this.clearSchedule(automation.id);

    const intervalMs = (automation.trigger.config.intervalMs as number) ?? 60000;
    const timer = setInterval(() => {
      if (this.isRunning && automation.enabled) {
        this.executeAutomation(automation);
      }
    }, intervalMs);

    this.scheduleTimers.set(automation.id, timer);
  }

  private clearSchedule(id: string): void {
    const timer = this.scheduleTimers.get(id);
    if (timer) {
      clearInterval(timer);
      this.scheduleTimers.delete(id);
    }
  }

  // ── Persistence ──

  private async saveAutomations(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(this.automations)
      );
    } catch {
      // Non-critical
    }
  }

  private async loadAutomations(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (data) {
        this.automations = JSON.parse(data);
      }
    } catch {
      this.automations = [];
    }
  }
}

// ── Singleton ──────────────────────────────────────────────────

let _engine: AutomationEngine | null = null;

export function getAutomationEngine(): AutomationEngine {
  if (!_engine) {
    _engine = new AutomationEngine();
  }
  return _engine;
}
