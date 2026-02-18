/**
 * AI Gateway with cascading fallback and proactive rate-limit switching
 * Providers: Gemini 1.5 Flash → Groq (Llama 3) → GitHub Models (GPT-4o)
 */

export type AIProvider = 'gemini' | 'groq' | 'github';

export interface AIResponse {
  content: string;
  provider: AIProvider;
  remainingQuota?: number;
  switchedProvider?: boolean;
}

export interface ProviderConfig {
  name: AIProvider;
  endpoint: string;
  model: string;
  apiKey: string;
  remainingQuota: number;
  threshold: number; // Switch when quota drops below this
}

export interface ApiKeys {
  gemini?: string;
  groq?: string;
  github?: string;
}

// Session state for tracking active provider
let currentProviderIndex = 0;
let providerQuotas: Map<AIProvider, number> = new Map([
  ['gemini', 100],
  ['groq', 100],
  ['github', 100],
]);

const QUOTA_THRESHOLD = 5; // Switch provider when remaining quota drops below this

export class AIGateway {
  private providers: ProviderConfig[];

  constructor() {
    this.providers = [
      {
        name: 'gemini',
        endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',
        model: 'gemini-1.5-flash',
        apiKey: process.env.GEMINI_API_KEY || '',
        remainingQuota: providerQuotas.get('gemini') || 100,
        threshold: QUOTA_THRESHOLD,
      },
      {
        name: 'groq',
        endpoint: 'https://api.groq.com/openai/v1/chat/completions',
        model: 'llama-3.3-70b-versatile',
        apiKey: process.env.GROQ_API_KEY || '',
        remainingQuota: providerQuotas.get('groq') || 100,
        threshold: QUOTA_THRESHOLD,
      },
      {
        name: 'github',
        endpoint: 'https://models.inference.ai.azure.com/chat/completions',
        model: 'gpt-4o',
        apiKey: process.env.GITHUB_TOKEN || '',
        remainingQuota: providerQuotas.get('github') || 100,
        threshold: QUOTA_THRESHOLD,
      },
    ];
  }

  private async callGemini(provider: ProviderConfig, messages: Array<{ role: string; content: string }>, apiKey: string): Promise<AIResponse> {
    const systemMessage = messages.find(m => m.role === 'system')?.content || '';
    const userMessages = messages.filter(m => m.role !== 'system');

    const contents = userMessages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    const response = await fetch(`${provider.endpoint}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents,
        systemInstruction: systemMessage ? { parts: [{ text: systemMessage }] } : undefined,
        generationConfig: {
          temperature: 0.9,
          maxOutputTokens: 500,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response';

    // Update quota from headers (Gemini doesn't provide standard rate limit headers)
    // Simulating quota tracking
    provider.remainingQuota = Math.max(0, provider.remainingQuota - 1);
    providerQuotas.set('gemini', provider.remainingQuota);

    return {
      content,
      provider: 'gemini',
      remainingQuota: provider.remainingQuota,
    };
  }

  private async callGroq(provider: ProviderConfig, messages: Array<{ role: string; content: string }>, apiKey: string): Promise<AIResponse> {
    const response = await fetch(provider.endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: provider.model,
        messages,
        temperature: 0.9,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Groq API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || 'No response';

    // Check rate limit headers
    const remaining = response.headers.get('x-ratelimit-remaining');
    if (remaining) {
      provider.remainingQuota = parseInt(remaining, 10);
      providerQuotas.set('groq', provider.remainingQuota);
    } else {
      provider.remainingQuota = Math.max(0, provider.remainingQuota - 1);
      providerQuotas.set('groq', provider.remainingQuota);
    }

    return {
      content,
      provider: 'groq',
      remainingQuota: provider.remainingQuota,
    };
  }

  private async callGitHub(provider: ProviderConfig, messages: Array<{ role: string; content: string }>, apiKey: string): Promise<AIResponse> {
    const response = await fetch(provider.endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: provider.model,
        messages,
        temperature: 0.9,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`GitHub Models API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || 'No response';

    // Check rate limit headers
    const remaining = response.headers.get('x-ratelimit-remaining');
    if (remaining) {
      provider.remainingQuota = parseInt(remaining, 10);
      providerQuotas.set('github', provider.remainingQuota);
    } else {
      provider.remainingQuota = Math.max(0, provider.remainingQuota - 1);
      providerQuotas.set('github', provider.remainingQuota);
    }

    return {
      content,
      provider: 'github',
      remainingQuota: provider.remainingQuota,
    };
  }

  private async callProvider(provider: ProviderConfig, messages: Array<{ role: string; content: string }>, apiKey: string): Promise<AIResponse> {
    switch (provider.name) {
      case 'gemini':
        return this.callGemini(provider, messages, apiKey);
      case 'groq':
        return this.callGroq(provider, messages, apiKey);
      case 'github':
        return this.callGitHub(provider, messages, apiKey);
      default:
        throw new Error(`Unknown provider: ${provider.name}`);
    }
  }

  /**
   * Generate a response with automatic fallback and proactive rate-limit switching
   */
  async generate(messages: Array<{ role: string; content: string }>, apiKeys?: ApiKeys): Promise<AIResponse> {
    let switchedProvider = false;

    // Check if current provider is below threshold, switch proactively
    const currentProvider = this.providers[currentProviderIndex];
    if (currentProvider.remainingQuota < currentProvider.threshold) {
      console.log(`⚠️ Provider ${currentProvider.name} quota low (${currentProvider.remainingQuota}). Switching...`);
      currentProviderIndex = Math.min(currentProviderIndex + 1, this.providers.length - 1);
      switchedProvider = true;
    }

    // Try providers in sequence starting from current index
    for (let i = currentProviderIndex; i < this.providers.length; i++) {
      const provider = this.providers[i];

      // Determine effective API key (runtime override or default)
      let effectiveKey = provider.apiKey;
      if (apiKeys) {
        if (provider.name === 'gemini' && apiKeys.gemini) effectiveKey = apiKeys.gemini;
        if (provider.name === 'groq' && apiKeys.groq) effectiveKey = apiKeys.groq;
        if (provider.name === 'github' && apiKeys.github) effectiveKey = apiKeys.github;
      }

      if (!effectiveKey) {
        console.log(`⚠️ Skipping ${provider.name}: No API key configured`);
        continue;
      }

      try {
        console.log(`🔄 Attempting ${provider.name}... (Quota: ${provider.remainingQuota})`);
        const response = await this.callProvider(provider, messages, effectiveKey);

        // Check if we need to switch for next request
        if (response.remainingQuota !== undefined && response.remainingQuota < provider.threshold) {
          console.log(`⚠️ ${provider.name} quota critical (${response.remainingQuota}). Will switch on next request.`);
          if (i < this.providers.length - 1) {
            currentProviderIndex = i + 1;
          }
        }

        return {
          ...response,
          switchedProvider: switchedProvider || i > 0,
        };
      } catch (error: any) {
        console.error(`❌ ${provider.name} failed:`, error.message);

        // Handle rate limit errors (429)
        if (error.message.includes('429')) {
          console.log(`🚨 Rate limit hit on ${provider.name}. Switching to next provider.`);
          provider.remainingQuota = 0;
          providerQuotas.set(provider.name, 0);
          currentProviderIndex = Math.min(i + 1, this.providers.length - 1);
        }

        // If this was the last provider, throw
        if (i === this.providers.length - 1) {
          throw new Error(`All AI providers failed. Last error: ${error.message}`);
        }

        // Continue to next provider
        continue;
      }
    }

    throw new Error('No AI providers available');
  }

  /**
   * Get current provider status for UI display
   */
  getProviderStatus() {
    return this.providers.map((p, index) => ({
      name: p.name,
      active: index === currentProviderIndex,
      remainingQuota: p.remainingQuota,
      threshold: p.threshold,
    }));
  }

  /**
   * Reset quotas (for testing or session reset)
   */
  resetQuotas() {
    currentProviderIndex = 0;
    providerQuotas.set('gemini', 100);
    providerQuotas.set('groq', 100);
    providerQuotas.set('github', 100);
    this.providers.forEach(p => {
      p.remainingQuota = 100;
    });
  }
}

// Singleton instance
let gatewayInstance: AIGateway | null = null;

export function getAIGateway(): AIGateway {
  if (!gatewayInstance) {
    gatewayInstance = new AIGateway();
  }
  return gatewayInstance;
}
