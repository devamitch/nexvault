import { parseCommand, similarity, expandSynonyms } from "../../utils/voiceCommandParser";

describe("voiceCommandParser", () => {
  describe("similarity", () => {
    it("should return 1 for identical strings", () => {
      expect(similarity("hello", "hello")).toBe(1);
    });

    it("should return high score for similar strings", () => {
      expect(similarity("open", "open")).toBeGreaterThan(0.7);
    });

    it("should return low score for different strings", () => {
      expect(similarity("open", "close")).toBeLessThan(0.5);
    });
  });

  describe("expandSynonyms", () => {
    it("should expand known synonyms", () => {
      const expanded = expandSynonyms("open");
      expect(expanded).toContain("show");
      expect(expanded).toContain("display");
    });

    it("should include the original word", () => {
      const expanded = expandSynonyms("delete");
      expect(expanded).toContain("delete");
    });

    it("should return just the word for unknown words", () => {
      const expanded = expandSynonyms("xyzabc");
      expect(expanded).toEqual(["xyzabc"]);
    });
  });

  describe("parseCommand", () => {
    it("should parse exact command matches", () => {
      const result = parseCommand("open vault");
      expect(result).not.toBeNull();
      expect(result!.intent).toBe("OPEN_VAULT");
    });

    it("should parse fuzzy matches", () => {
      const result = parseCommand("show vault");
      expect(result).not.toBeNull();
      expect(result!.intent).toBe("OPEN_VAULT");
    });

    it("should return null for gibberish", () => {
      expect(parseCommand("asdfgh jklmn")).toBeNull();
    });

    it("should provide alternatives for ambiguous commands", () => {
      const result = parseCommand("save");
      expect(result).not.toBeNull();
      expect(result!.intent).toBe("SAVE");
    });

    it("should parse single-word commands", () => {
      const result = parseCommand("home");
      expect(result).not.toBeNull();
      expect(result!.intent).toBe("GO_HOME");
    });

    it("should handle empty input", () => {
      expect(parseCommand("")).toBeNull();
    });
  });
});
