import { VoiceNexus } from "../../core/VoiceNexus";

describe("VoiceNexus", () => {
  let nexus: VoiceNexus;

  beforeEach(async () => {
    nexus = new VoiceNexus();
    await nexus.initialize();
  });

  afterEach(async () => {
    await nexus.dispose();
  });

  it("should initialize successfully", () => {
    expect(nexus.isActive()).toBe(true);
  });

  describe("Command Parsing", () => {
    it("should parse navigation commands", () => {
      const result = nexus.processTranscript("open vault");
      expect(result).not.toBeNull();
      expect(result!.category).toBe("NAVIGATION");
      expect(result!.action).toBe("OPEN_VAULT");
    });

    it("should parse creation commands", () => {
      const result = nexus.processTranscript("new memo");
      expect(result).not.toBeNull();
      expect(result!.category).toBe("CREATION");
      expect(result!.action).toBe("NEW_MEMO");
    });

    it("should parse query commands", () => {
      const result = nexus.processTranscript("status");
      expect(result).not.toBeNull();
      expect(result!.category).toBe("QUERY");
      expect(result!.action).toBe("STATUS");
    });

    it("should parse manipulation commands", () => {
      const result = nexus.processTranscript("grab this");
      expect(result).not.toBeNull();
      expect(result!.category).toBe("MANIPULATION");
      expect(result!.action).toBe("GRAB");
    });

    it("should return null for unrecognized commands", () => {
      const result = nexus.processTranscript("do something random");
      expect(result).toBeNull();
    });

    it("should be case insensitive", () => {
      const result = nexus.processTranscript("OPEN VAULT");
      expect(result).not.toBeNull();
      expect(result!.action).toBe("OPEN_VAULT");
    });

    it("should handle empty strings", () => {
      expect(nexus.processTranscript("")).toBeNull();
      expect(nexus.processTranscript("   ")).toBeNull();
    });
  });

  describe("Command Callbacks", () => {
    it("should fire callbacks when commands are recognized", () => {
      const callback = jest.fn();
      nexus.onCommand(callback);

      nexus.processTranscript("home");
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ action: "GO_HOME" })
      );
    });

    it("should support unsubscribe", () => {
      const callback = jest.fn();
      const unsub = nexus.onCommand(callback);

      nexus.processTranscript("home");
      expect(callback).toHaveBeenCalledTimes(1);

      unsub();
      nexus.processTranscript("back");
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe("Pause/Resume", () => {
    it("should toggle active state", () => {
      expect(nexus.isActive()).toBe(true);
      nexus.pause();
      expect(nexus.isActive()).toBe(false);
      nexus.resume();
      expect(nexus.isActive()).toBe(true);
    });
  });
});
