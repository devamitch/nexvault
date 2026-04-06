/**
 * JarvisCore.ts - AI Assistant Service Layer
 *
 * The "brain" of NexVault. Provides:
 *   - Natural Language Understanding (NLU) beyond regex commands
 *   - AI-powered responses via configurable LLM backend
 *   - Context-aware command interpretation
 *   - Task automation engine
 *   - Proactive suggestions based on user patterns
 *   - Memory/learning from interactions
 *
 * Architecture:
 *   User Input → NLU Parser → Intent Router → Action Executor → Response
 *
 * Supports multiple AI backends:
 *   - Anthropic Claude API
 *   - OpenAI API
 *   - Local/offline fallback (regex + heuristics)
 */

import { EventEmitter } from "eventemitter3";

// ── Types ──────────────────────────────────────────────────────

export type AIProvider = "anthropic" | "openai" | "local";

export interface JarvisConfig {
  provider: AIProvider;
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  enableLearning: boolean;
  enableProactiveSuggestions: boolean;
  offlineFallback: boolean;
}

export interface Intent {
  action: string;
  entities: Record<string, string>;
  confidence: number;
  requiresAI: boolean;
}

export interface JarvisResponse {
  text: string;
  actions: IntentAction[];
  suggestions?: string[];
  emotion?: "neutral" | "helpful" | "excited" | "concerned";
}

export interface IntentAction {
  type: string;
  params: Record<string, unknown>;
}

export interface ConversationMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
}

// ── Intent Definitions ─────────────────────────────────────────

interface IntentPattern {
  patterns: RegExp[];
  action: string;
  entities?: string[];
  requiresAI: boolean;
}

const INTENT_PATTERNS: IntentPattern[] = [
  // Navigation
  { patterns: [/(?:open|show|go\s+to)\s+(?:the\s+)?vault/i], action: "NAVIGATE_VAULT", requiresAI: false },
  { patterns: [/(?:open|show|go\s+to)\s+(?:the\s+)?(?:memos?|recordings?)/i], action: "NAVIGATE_MEMOS", requiresAI: false },
  { patterns: [/(?:go\s+)?home/i, /main\s+screen/i, /hub/i], action: "NAVIGATE_HOME", requiresAI: false },
  { patterns: [/(?:go\s+)?back/i], action: "NAVIGATE_BACK", requiresAI: false },

  // Vault CRUD
  { patterns: [/(?:create|new|add)\s+(?:a\s+)?(?:note|entry|item)/i], action: "CREATE_ENTRY", requiresAI: false },
  { patterns: [/(?:delete|remove)\s+(?:this|the|current)/i], action: "DELETE_ITEM", requiresAI: false },
  { patterns: [/(?:search|find|look\s+for)\s+(.+)/i], action: "SEARCH", entities: ["query"], requiresAI: false },

  // Memos
  { patterns: [/(?:record|new|start)\s+(?:a\s+)?memo/i], action: "START_MEMO", requiresAI: false },
  { patterns: [/(?:stop|save|finish)\s+(?:the\s+)?(?:recording|memo)/i], action: "STOP_MEMO", requiresAI: false },
  { patterns: [/play\s+(?:the\s+)?(?:last|latest)\s+memo/i], action: "PLAY_LAST_MEMO", requiresAI: false },

  // System
  { patterns: [/(?:what's|what\s+is)\s+(?:the\s+)?(?:status|time|date)/i], action: "STATUS", requiresAI: false },
  { patterns: [/battery|power/i], action: "BATTERY_STATUS", requiresAI: false },
  { patterns: [/settings|preferences/i], action: "OPEN_SETTINGS", requiresAI: false },

  // AI-required intents (complex queries)
  { patterns: [/summarize|summary/i], action: "SUMMARIZE", requiresAI: true },
  { patterns: [/remind\s+me\s+(?:to\s+)?(.+)/i], action: "SET_REMINDER", entities: ["task"], requiresAI: true },
  { patterns: [/what\s+(?:should|can)\s+I/i], action: "SUGGEST", requiresAI: true },
  { patterns: [/explain|tell\s+me\s+about/i], action: "EXPLAIN", requiresAI: true },
  { patterns: [/help/i], action: "HELP", requiresAI: false },
];

// ── Default Config ─────────────────────────────────────────────

const DEFAULT_CONFIG: JarvisConfig = {
  provider: "local",
  maxTokens: 500,
  temperature: 0.7,
  enableLearning: true,
  enableProactiveSuggestions: true,
  offlineFallback: true,
};

// ── Jarvis Core ────────────────────────────────────────────────

export class JarvisCore extends EventEmitter {
  private config: JarvisConfig;
  private conversationHistory: ConversationMessage[] = [];
  private userPatterns: Map<string, number> = new Map();
  private isProcessing = false;

  constructor(config: Partial<JarvisConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ── Main Processing Pipeline ──

  async processInput(input: string): Promise<JarvisResponse> {
    if (this.isProcessing) {
      return { text: "Processing previous request...", actions: [] };
    }

    this.isProcessing = true;

    try {
      // Add to conversation history
      this.addMessage("user", input);

      // Track usage patterns
      this.trackPattern(input);

      // 1. Local intent parsing (fast path)
      const intent = this.parseIntent(input);

      if (intent && !intent.requiresAI) {
        // Fast local response
        const response = this.generateLocalResponse(intent);
        this.addMessage("assistant", response.text);
        this.emit("response", response);
        return response;
      }

      // 2. AI-powered response (if configured and available)
      if (intent?.requiresAI && this.config.provider !== "local" && this.config.apiKey) {
        try {
          const aiResponse = await this.callAIProvider(input, intent);
          this.addMessage("assistant", aiResponse.text);
          this.emit("response", aiResponse);
          return aiResponse;
        } catch {
          // Fallback to local
          if (this.config.offlineFallback) {
            const fallback = this.generateLocalResponse(intent);
            this.addMessage("assistant", fallback.text);
            return fallback;
          }
        }
      }

      // 3. Fallback: unrecognized command
      const fallback: JarvisResponse = {
        text: "I didn't understand that. Try commands like 'open vault', 'new memo', or 'status'.",
        actions: [],
        suggestions: this.getSuggestions(),
        emotion: "helpful",
      };
      this.addMessage("assistant", fallback.text);
      return fallback;
    } finally {
      this.isProcessing = false;
    }
  }

  // ── Intent Parsing ──

  private parseIntent(input: string): Intent | null {
    const trimmed = input.trim();

    for (const pattern of INTENT_PATTERNS) {
      for (const regex of pattern.patterns) {
        const match = trimmed.match(regex);
        if (match) {
          const entities: Record<string, string> = {};
          if (pattern.entities) {
            pattern.entities.forEach((name, idx) => {
              if (match[idx + 1]) {
                entities[name] = match[idx + 1].trim();
              }
            });
          }

          return {
            action: pattern.action,
            entities,
            confidence: 0.9,
            requiresAI: pattern.requiresAI,
          };
        }
      }
    }

    return null;
  }

  // ── Local Response Generation ──

  private generateLocalResponse(intent: Intent): JarvisResponse {
    const responses: Record<string, JarvisResponse> = {
      NAVIGATE_VAULT: {
        text: "Opening the vault.",
        actions: [{ type: "NAVIGATE", params: { screen: "Research" } }],
        emotion: "neutral",
      },
      NAVIGATE_MEMOS: {
        text: "Opening memos.",
        actions: [{ type: "NAVIGATE", params: { screen: "Memos" } }],
        emotion: "neutral",
      },
      NAVIGATE_HOME: {
        text: "Returning home.",
        actions: [{ type: "NAVIGATE", params: { screen: "Hub" } }],
        emotion: "neutral",
      },
      NAVIGATE_BACK: {
        text: "Going back.",
        actions: [{ type: "NAVIGATE_BACK", params: {} }],
        emotion: "neutral",
      },
      CREATE_ENTRY: {
        text: "Creating a new entry.",
        actions: [{ type: "CREATE_VAULT_ITEM", params: {} }],
        emotion: "helpful",
      },
      DELETE_ITEM: {
        text: "Deleting the selected item.",
        actions: [{ type: "DELETE_SELECTED", params: {} }],
        emotion: "concerned",
      },
      SEARCH: {
        text: `Searching for "${intent.entities.query ?? ""}".`,
        actions: [{ type: "SEARCH", params: { query: intent.entities.query ?? "" } }],
        emotion: "neutral",
      },
      START_MEMO: {
        text: "Recording. Speak when ready.",
        actions: [{ type: "START_RECORDING", params: {} }],
        emotion: "neutral",
      },
      STOP_MEMO: {
        text: "Memo saved.",
        actions: [{ type: "STOP_RECORDING", params: {} }],
        emotion: "helpful",
      },
      PLAY_LAST_MEMO: {
        text: "Playing last memo.",
        actions: [{ type: "PLAY_MEMO", params: { index: -1 } }],
        emotion: "neutral",
      },
      STATUS: {
        text: "All systems operational.",
        actions: [{ type: "SHOW_STATUS", params: {} }],
        emotion: "neutral",
      },
      BATTERY_STATUS: {
        text: "Checking device status.",
        actions: [{ type: "SHOW_BATTERY", params: {} }],
        emotion: "neutral",
      },
      HELP: {
        text: "Available commands: open vault, new memo, record, search, status, go home, go back, delete.",
        actions: [],
        emotion: "helpful",
        suggestions: ["Open vault", "New memo", "Status"],
      },
    };

    return (
      responses[intent.action] ?? {
        text: "Command received.",
        actions: [{ type: intent.action, params: intent.entities }],
        emotion: "neutral" as const,
      }
    );
  }

  // ── AI Provider Integration ──

  private async callAIProvider(
    input: string,
    intent: Intent
  ): Promise<JarvisResponse> {
    const systemPrompt = `You are Jarvis, an AI assistant embedded in NexVault, a spatial computing research interface. You help users manage their vault items and voice memos. Be concise - respond in 1-2 sentences. Current context: User is performing action "${intent.action}".`;

    const messages = [
      { role: "system" as const, content: systemPrompt },
      ...this.conversationHistory.slice(-10).map((m) => ({
        role: m.role,
        content: m.content,
      })),
    ];

    if (this.config.provider === "anthropic") {
      return this.callAnthropic(messages, input);
    } else if (this.config.provider === "openai") {
      return this.callOpenAI(messages, input);
    }

    throw new Error(`Unknown provider: ${this.config.provider}`);
  }

  private async callAnthropic(
    _messages: Array<{ role: string; content: string }>,
    input: string
  ): Promise<JarvisResponse> {
    // Anthropic Claude API call structure
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.config.apiKey!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.config.model ?? "claude-haiku-4-5-20251001",
        max_tokens: this.config.maxTokens,
        messages: [{ role: "user", content: input }],
      }),
    });

    const data = await response.json();
    const text = data.content?.[0]?.text ?? "I couldn't process that request.";

    return {
      text,
      actions: [],
      emotion: "helpful",
    };
  }

  private async callOpenAI(
    messages: Array<{ role: string; content: string }>,
    _input: string
  ): Promise<JarvisResponse> {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model ?? "gpt-4o-mini",
        messages,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
      }),
    });

    const data = await response.json();
    const text =
      data.choices?.[0]?.message?.content ?? "I couldn't process that.";

    return {
      text,
      actions: [],
      emotion: "helpful",
    };
  }

  // ── Pattern Learning ──

  private trackPattern(input: string): void {
    if (!this.config.enableLearning) return;

    const words = input.toLowerCase().split(/\s+/);
    for (const word of words) {
      this.userPatterns.set(word, (this.userPatterns.get(word) ?? 0) + 1);
    }
  }

  private getSuggestions(): string[] {
    if (!this.config.enableProactiveSuggestions) return [];

    // Suggest based on common user patterns
    const sorted = [...this.userPatterns.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    return sorted.map(([word]) => {
      if (word.includes("memo")) return "New memo";
      if (word.includes("vault") || word.includes("research")) return "Open vault";
      if (word.includes("status")) return "Check status";
      return `Search ${word}`;
    });
  }

  // ── Conversation Management ──

  private addMessage(role: "user" | "assistant" | "system", content: string): void {
    this.conversationHistory.push({ role, content, timestamp: Date.now() });
    // Keep last 50 messages
    if (this.conversationHistory.length > 50) {
      this.conversationHistory = this.conversationHistory.slice(-50);
    }
  }

  getHistory(): Readonly<ConversationMessage[]> {
    return [...this.conversationHistory];
  }

  clearHistory(): void {
    this.conversationHistory = [];
  }

  // ── Config ──

  updateConfig(config: Partial<JarvisConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): Readonly<JarvisConfig> {
    return { ...this.config };
  }
}

// ── Singleton ──────────────────────────────────────────────────

let _jarvis: JarvisCore | null = null;

export function getJarvis(config?: Partial<JarvisConfig>): JarvisCore {
  if (!_jarvis) {
    _jarvis = new JarvisCore(config);
  }
  return _jarvis;
}
