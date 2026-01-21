/**
 * Type definitions for AI Interrogator game
 */

export interface GameMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface InterrogationRequest {
  messages: GameMessage[];
  resetQuotas?: boolean;
}

export interface ProviderStatus {
  name: 'gemini' | 'groq' | 'github';
  active: boolean;
  remainingQuota: number;
  threshold: number;
}

export interface RevealedHints {
  obsidian: boolean;
  sector: boolean;
}

export interface InterrogationResponse {
  message: string;
  provider: string;
  remainingQuota?: number;
  switchedProvider?: boolean;
  providerStatus: ProviderStatus[];
  gameWon: boolean;
  revealedHints: RevealedHints;
}

export interface GameState {
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    provider?: string;
  }>;
  gameWon: boolean;
  attempts: number;
  currentProvider: string;
  revealedHints: RevealedHints;
}
