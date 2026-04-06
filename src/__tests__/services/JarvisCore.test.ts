/**
 * JarvisCore.test.ts - AI Assistant Service Tests
 */

import { JarvisCore } from "../../services/JarvisCore";

let jarvis: JarvisCore;

beforeEach(() => {
  jarvis = new JarvisCore();
});

describe("JarvisCore", () => {
  it("initializes with default config", () => {
    const config = jarvis.getConfig();
    expect(config.provider).toBe("local");
    expect(config.enableLearning).toBe(true);
    expect(config.enableProactiveSuggestions).toBe(true);
    expect(config.offlineFallback).toBe(true);
    expect(config.maxTokens).toBe(500);
    expect(config.temperature).toBe(0.7);
  });

  it("accepts custom config", () => {
    const custom = new JarvisCore({ provider: "anthropic", apiKey: "key", maxTokens: 1000 });
    const config = custom.getConfig();
    expect(config.provider).toBe("anthropic");
    expect(config.apiKey).toBe("key");
    expect(config.maxTokens).toBe(1000);
  });

  it("updates config", () => {
    jarvis.updateConfig({ provider: "openai", temperature: 0.5 });
    const config = jarvis.getConfig();
    expect(config.provider).toBe("openai");
    expect(config.temperature).toBe(0.5);
    expect(config.enableLearning).toBe(true);
  });

  it("parses 'open vault' as NAVIGATE_VAULT", async () => {
    const response = await jarvis.processInput("open vault");
    expect(response.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "NAVIGATE", params: { screen: "Research" } }),
      ])
    );
  });

  it("parses 'show memos' as NAVIGATE_MEMOS", async () => {
    const response = await jarvis.processInput("show memos");
    expect(response.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "NAVIGATE", params: { screen: "Memos" } }),
      ])
    );
  });

  it("parses 'go home' as NAVIGATE_HOME", async () => {
    const response = await jarvis.processInput("home");
    expect(response.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "NAVIGATE", params: { screen: "Hub" } }),
      ])
    );
  });

  it("parses 'go back' as NAVIGATE_BACK", async () => {
    const response = await jarvis.processInput("go back");
    expect(response.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "NAVIGATE_BACK", params: {} }),
      ])
    );
  });

  it("parses 'create new note' as CREATE_ENTRY", async () => {
    const response = await jarvis.processInput("create new note");
    expect(response.actions).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "CREATE_VAULT_ITEM" })])
    );
  });

  it("parses 'search for quantum' with query entity", async () => {
    const response = await jarvis.processInput("search for quantum");
    expect(response.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "SEARCH", params: expect.objectContaining({ query: "quantum" }) }),
      ])
    );
  });

  it("parses 'record memo' as START_MEMO", async () => {
    const response = await jarvis.processInput("record a memo");
    expect(response.text).toContain("Recording");
    expect(response.actions).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "START_RECORDING" })])
    );
  });

  it("parses 'stop recording' as STOP_MEMO", async () => {
    const response = await jarvis.processInput("stop the recording");
    expect(response.actions).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "STOP_RECORDING" })])
    );
  });

  it("parses 'status'", async () => {
    const response = await jarvis.processInput("what is the status");
    expect(response.actions).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "SHOW_STATUS" })])
    );
  });

  it("parses 'help' and returns suggestions", async () => {
    const response = await jarvis.processInput("help");
    expect(response.text).toContain("Available commands");
    expect(response.suggestions).toBeDefined();
  });

  it("returns fallback for unrecognized input", async () => {
    const response = await jarvis.processInput("xyzzy12345abcde");
    expect(response.text).toContain("didn't understand");
    expect(response.actions).toEqual([]);
  });

  it("tracks conversation history", async () => {
    await jarvis.processInput("help");
    await jarvis.processInput("status");
    const history = jarvis.getHistory();
    expect(history.length).toBe(4);
    expect(history[0].role).toBe("user");
    expect(history[1].role).toBe("assistant");
  });

  it("limits history to 50 messages", async () => {
    for (let i = 0; i < 30; i++) {
      await jarvis.processInput("help");
    }
    expect(jarvis.getHistory().length).toBeLessThanOrEqual(50);
  });

  it("clears history", async () => {
    await jarvis.processInput("help");
    expect(jarvis.getHistory().length).toBeGreaterThan(0);
    jarvis.clearHistory();
    expect(jarvis.getHistory().length).toBe(0);
  });

  it("returns busy message when already processing", async () => {
    const p1 = jarvis.processInput("help");
    const p2 = jarvis.processInput("status");
    const [, result2] = await Promise.all([p1, p2]);
    expect(result2.text).toContain("Processing previous request");
  });

  it("emits response event", async () => {
    const listener = jest.fn();
    jarvis.on("response", listener);
    await jarvis.processInput("help");
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ text: expect.any(String) }));
  });
});
