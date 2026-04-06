/**
 * voiceCommandParser.ts
 *
 * Advanced voice command parsing utilities.
 * Extends the basic pattern matching in VoiceNexus with
 * fuzzy matching, synonym expansion, and command history
 * for improved recognition accuracy.
 */

// ── Types ──────────────────────────────────────────────────────

export interface ParsedCommand {
  intent: string;
  entities: Record<string, string>;
  confidence: number;
  alternatives: Array<{ intent: string; confidence: number }>;
}

// ── Synonym Map ────────────────────────────────────────────────

const SYNONYMS: Record<string, string[]> = {
  open: ["show", "display", "reveal", "navigate to", "go to"],
  close: ["hide", "dismiss", "collapse"],
  create: ["new", "add", "make", "start"],
  delete: ["remove", "discard", "destroy", "erase", "clear"],
  save: ["store", "keep", "preserve"],
  larger: ["bigger", "expand", "enlarge", "zoom in", "scale up"],
  smaller: ["shrink", "reduce", "zoom out", "scale down"],
  grab: ["hold", "lock", "select", "pick"],
  home: ["main", "hub", "dashboard", "center"],
  back: ["return", "previous", "go back"],
  vault: ["storage", "files", "items", "data"],
  memo: ["recording", "voice note", "note", "audio"],
  status: ["state", "info", "information"],
};

// ── Fuzzy Matching ─────────────────────────────────────────────

/**
 * Levenshtein distance for fuzzy string matching.
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= a.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= b.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[a.length][b.length];
}

/**
 * Calculate similarity score (0-1) between two strings.
 */
export function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshteinDistance(a.toLowerCase(), b.toLowerCase()) / maxLen;
}

// ── Command Parsing ────────────────────────────────────────────

/**
 * Expand a word to include its synonyms for matching.
 */
export function expandSynonyms(word: string): string[] {
  const lower = word.toLowerCase();
  const results = [lower];

  for (const [canonical, syns] of Object.entries(SYNONYMS)) {
    if (canonical === lower || syns.includes(lower)) {
      results.push(canonical, ...syns);
    }
  }

  return [...new Set(results)];
}

/**
 * Parse a raw transcript into a structured command with
 * fuzzy matching and synonym expansion.
 */
export function parseCommand(transcript: string): ParsedCommand | null {
  const words = transcript.trim().toLowerCase().split(/\s+/);
  if (words.length === 0) return null;

  // Known command patterns with their intents
  const patterns: Array<{
    keywords: string[];
    intent: string;
    requiredWords: number;
  }> = [
    { keywords: ["open", "vault"], intent: "OPEN_VAULT", requiredWords: 1 },
    { keywords: ["show", "research"], intent: "SHOW_RESEARCH", requiredWords: 1 },
    { keywords: ["home"], intent: "GO_HOME", requiredWords: 1 },
    { keywords: ["back"], intent: "GO_BACK", requiredWords: 1 },
    { keywords: ["new", "memo"], intent: "NEW_MEMO", requiredWords: 1 },
    { keywords: ["save"], intent: "SAVE", requiredWords: 1 },
    { keywords: ["create", "entry"], intent: "CREATE_ENTRY", requiredWords: 1 },
    { keywords: ["status"], intent: "STATUS", requiredWords: 1 },
    { keywords: ["grab"], intent: "GRAB", requiredWords: 1 },
    { keywords: ["larger"], intent: "SCALE_UP", requiredWords: 1 },
    { keywords: ["smaller"], intent: "SCALE_DOWN", requiredWords: 1 },
    { keywords: ["delete"], intent: "DELETE", requiredWords: 1 },
  ];

  const matches: Array<{ intent: string; score: number }> = [];

  for (const pattern of patterns) {
    let score = 0;
    let matchedKeywords = 0;

    for (const keyword of pattern.keywords) {
      const expanded = expandSynonyms(keyword);
      let bestMatch = 0;

      for (const word of words) {
        for (const syn of expanded) {
          const sim = similarity(word, syn);
          bestMatch = Math.max(bestMatch, sim);
        }
      }

      if (bestMatch > 0.7) {
        matchedKeywords++;
        score += bestMatch;
      }
    }

    if (matchedKeywords >= pattern.requiredWords) {
      matches.push({
        intent: pattern.intent,
        score: score / pattern.keywords.length,
      });
    }
  }

  if (matches.length === 0) return null;

  // Sort by score descending
  matches.sort((a, b) => b.score - a.score);

  return {
    intent: matches[0].intent,
    entities: {},
    confidence: matches[0].score,
    alternatives: matches.slice(1).map((m) => ({
      intent: m.intent,
      confidence: m.score,
    })),
  };
}
