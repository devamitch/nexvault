/**
 * AutomationEngine.test.ts - Task Automation System Tests
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { AutomationEngine, type Automation } from "../../services/AutomationEngine";

let engine: AutomationEngine;

beforeEach(async () => {
  jest.clearAllMocks();
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
  (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
  engine = new AutomationEngine();
  await engine.initialize();
});

afterEach(async () => {
  await engine.shutdown();
});

function makeAutomation(overrides: Record<string, unknown> = {}) {
  return {
    id: (overrides.id as string) ?? `auto_${Date.now()}`,
    name: (overrides.name as string) ?? "Test",
    description: (overrides.description as string) ?? "desc",
    trigger: (overrides.trigger as { type: string; config: Record<string, unknown> }) ?? { type: "MANUAL", config: {} },
    actions: (overrides.actions as Array<{ type: string; params: Record<string, unknown> }>) ?? [],
    enabled: overrides.enabled !== undefined ? (overrides.enabled as boolean) : true,
  };
}

describe("AutomationEngine", () => {
  it("adds an automation", async () => {
    const auto = await engine.addAutomation(makeAutomation({ id: "a1" }));
    expect(auto.id).toBe("a1");
    expect(auto.runCount).toBe(0);
    expect(auto.lastRun).toBeNull();
    expect(engine.getAutomations()).toHaveLength(1);
  });

  it("removes an automation", async () => {
    await engine.addAutomation(makeAutomation({ id: "a1" }));
    await engine.addAutomation(makeAutomation({ id: "a2" }));
    await engine.removeAutomation("a1");
    expect(engine.getAutomations()).toHaveLength(1);
    expect(engine.getAutomations()[0].id).toBe("a2");
  });

  it("toggles automation enabled state", async () => {
    await engine.addAutomation(makeAutomation({ id: "a1", enabled: true }));
    await engine.toggleAutomation("a1", false);
    expect(engine.getAutomations()[0].enabled).toBe(false);
    await engine.toggleAutomation("a1", true);
    expect(engine.getAutomations()[0].enabled).toBe(true);
  });

  it("persists automations to AsyncStorage", async () => {
    await engine.addAutomation(makeAutomation({ id: "a1" }));
    expect(AsyncStorage.setItem).toHaveBeenCalledWith("@nexvault/automations", expect.any(String));
  });

  it("matches IOT_EVENT trigger by deviceId", async () => {
    const executor = jest.fn();
    engine.registerExecutor("SPEAK", executor);
    await engine.addAutomation(makeAutomation({
      id: "iot1",
      trigger: { type: "IOT_EVENT", config: { deviceId: "sensor_01" } },
      actions: [{ type: "SPEAK", params: { text: "hello" } }],
    }));
    await engine.handleEvent("IOT_EVENT", { deviceId: "sensor_01" });
    expect(executor).toHaveBeenCalledWith({ text: "hello" });
  });

  it("does NOT match IOT_EVENT for wrong deviceId", async () => {
    const executor = jest.fn();
    engine.registerExecutor("SPEAK", executor);
    await engine.addAutomation(makeAutomation({
      id: "iot2",
      trigger: { type: "IOT_EVENT", config: { deviceId: "sensor_01" } },
      actions: [{ type: "SPEAK", params: { text: "hello" } }],
    }));
    await engine.handleEvent("IOT_EVENT", { deviceId: "sensor_99" });
    expect(executor).not.toHaveBeenCalled();
  });

  it("matches SENSOR trigger with gt operator", async () => {
    const executor = jest.fn();
    engine.registerExecutor("NOTIFY", executor);
    await engine.addAutomation(makeAutomation({
      id: "s1",
      trigger: { type: "SENSOR", config: { threshold: 50, operator: "gt" } },
      actions: [{ type: "NOTIFY", params: { body: "hot!" } }],
    }));
    await engine.handleEvent("SENSOR", { value: 60 });
    expect(executor).toHaveBeenCalled();
    executor.mockClear();
    await engine.handleEvent("SENSOR", { value: 30 });
    expect(executor).not.toHaveBeenCalled();
  });

  it("matches SENSOR trigger with lt operator", async () => {
    const executor = jest.fn();
    engine.registerExecutor("NOTIFY", executor);
    await engine.addAutomation(makeAutomation({
      id: "s2",
      trigger: { type: "SENSOR", config: { threshold: 20, operator: "lt" } },
      actions: [{ type: "NOTIFY", params: { body: "cold!" } }],
    }));
    await engine.handleEvent("SENSOR", { value: 10 });
    expect(executor).toHaveBeenCalled();
  });

  it("matches VOICE trigger by keyword", async () => {
    const executor = jest.fn();
    engine.registerExecutor("SPEAK", executor);
    await engine.addAutomation(makeAutomation({
      id: "v1",
      trigger: { type: "VOICE", config: { keyword: "lights" } },
      actions: [{ type: "SPEAK", params: { text: "toggling" } }],
    }));
    await engine.handleEvent("VOICE", { transcript: "Turn on the lights" });
    expect(executor).toHaveBeenCalled();
  });

  it("matches STATE_CHANGE trigger by stateKey", async () => {
    const executor = jest.fn();
    engine.registerExecutor("HAPTIC", executor);
    await engine.addAutomation(makeAutomation({
      id: "st1",
      trigger: { type: "STATE_CHANGE", config: { stateKey: "isListening" } },
      actions: [{ type: "HAPTIC", params: {} }],
    }));
    await engine.handleEvent("STATE_CHANGE", { key: "isListening", value: true });
    expect(executor).toHaveBeenCalled();
  });

  it("does not run disabled automations", async () => {
    const executor = jest.fn();
    engine.registerExecutor("SPEAK", executor);
    await engine.addAutomation(makeAutomation({
      id: "d1", enabled: false,
      trigger: { type: "MANUAL", config: {} },
      actions: [{ type: "SPEAK", params: {} }],
    }));
    await engine.handleEvent("MANUAL", {});
    expect(executor).not.toHaveBeenCalled();
  });

  it("emits automationAdded event", async () => {
    const listener = jest.fn();
    engine.on("automationAdded", listener);
    await engine.addAutomation(makeAutomation({ id: "e1" }));
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ id: "e1" }));
  });

  it("emits automationRemoved event", async () => {
    const listener = jest.fn();
    engine.on("automationRemoved", listener);
    await engine.addAutomation(makeAutomation({ id: "e2" }));
    await engine.removeAutomation("e2");
    expect(listener).toHaveBeenCalledWith("e2");
  });

  it("emits start and complete events", async () => {
    const startFn = jest.fn();
    const completeFn = jest.fn();
    engine.on("automationStart", startFn);
    engine.on("automationComplete", completeFn);
    engine.registerExecutor("SPEAK", jest.fn());
    await engine.addAutomation(makeAutomation({
      id: "e3",
      trigger: { type: "MANUAL", config: {} },
      actions: [{ type: "SPEAK", params: {} }],
    }));
    await engine.handleEvent("MANUAL", {});
    expect(startFn).toHaveBeenCalledWith("e3");
    expect(completeFn).toHaveBeenCalledWith("e3");
  });

  it("emits actionSkipped when no executor registered", async () => {
    const listener = jest.fn();
    engine.on("actionSkipped", listener);
    await engine.addAutomation(makeAutomation({
      id: "sk1",
      trigger: { type: "MANUAL", config: {} },
      actions: [{ type: "RUN_SCRIPT", params: {} }],
    }));
    await engine.handleEvent("MANUAL", {});
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ automationId: "sk1", actionType: "RUN_SCRIPT" })
    );
  });

  it("increments runCount after execution", async () => {
    engine.registerExecutor("SPEAK", jest.fn());
    await engine.addAutomation(makeAutomation({
      id: "c1",
      trigger: { type: "MANUAL", config: {} },
      actions: [{ type: "SPEAK", params: {} }],
    }));
    await engine.handleEvent("MANUAL", {});
    await engine.handleEvent("MANUAL", {});
    const auto = engine.getAutomations().find((a) => a.id === "c1");
    expect(auto?.runCount).toBe(2);
    expect(auto?.lastRun).toBeGreaterThan(0);
  });

  it("loads automations from AsyncStorage on init", async () => {
    const stored = [{
      id: "stored1", name: "Stored", description: "From storage",
      trigger: { type: "MANUAL", config: {} }, actions: [],
      enabled: true, lastRun: null, runCount: 5, createdAt: 1000,
    }];
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(stored));
    const fresh = new AutomationEngine();
    await fresh.initialize();
    expect(fresh.getAutomations()).toHaveLength(1);
    expect(fresh.getAutomations()[0].id).toBe("stored1");
    await fresh.shutdown();
  });
});
