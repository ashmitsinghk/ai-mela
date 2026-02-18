'use server';

import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || 'dummy_init', // Init with dummy if empty, will override locally
});

// ... interface ...
export interface ScribbleGuessResult {
  guess: string;
  confidence: number;
  shieldActive: boolean;
  remainingTokens?: number;
  remainingRequests?: number;
  error?: string;
}

/**
 * Server Action: Analyzes a drawing and returns the AI's guess
 * Implements proactive rate-limit monitoring to prevent quota exhaustion
 */
export async function analyzeDrawing(
  imageBase64: string,
  targetWord: string,
  apiKeyOverride?: string
): Promise<ScribbleGuessResult> {
  console.log('=== SERVER ACTION CALLED ===');

  const apiKey = apiKeyOverride || process.env.GROQ_API_KEY;

  if (!apiKey) {
    console.error('❌ No API key found');
    return {
      guess: '',
      confidence: 0,
      shieldActive: false,
      error: 'API key not configured',
    };
  }

  // Create local client with specific key
  const groqClient = new Groq({
    apiKey: apiKey,
  });

  try {
    // ...


    console.log('✓ API key found, calling Groq...');

    // Call Groq Vision API
    const response = await groqClient.chat.completions.create({
      model: 'llama-3.2-11b-vision-preview', // Updated to vision model
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `You are playing a drawing guessing game. Look at this drawing and guess what object or thing it represents. 
              
Rules:
- Respond with ONLY ONE WORD (the object name)
- Be specific but simple (e.g., "cat" not "animal")
- No explanations, just the guess
- If unclear, make your best guess

What is this drawing?`,
            },
            {
              type: 'image_url',
              image_url: {
                url: imageBase64,
              },
            },
          ],
        },
      ],
      temperature: 0.3,
      max_tokens: 50,
    });

    console.log('Groq API Response:', JSON.stringify(response, null, 2));

    // Extract rate limit headers from the response
    const headers = (response as any).response_headers || {};
    const remainingTokens = parseInt(headers['x-ratelimit-remaining-tokens'] || '999999', 10);
    const remainingRequests = parseInt(headers['x-ratelimit-remaining-requests'] || '999999', 10);

    console.log('Rate limits:', { remainingTokens, remainingRequests });

    // Proactive shield activation if quota is low
    const shieldActive = remainingTokens < 10000 || remainingRequests < 10;

    // Extract the guess from the AI response
    const rawGuess = response.choices[0]?.message?.content?.trim() || '';
    console.log('Raw AI guess:', rawGuess);
    const guess = rawGuess.toLowerCase().replace(/[^a-z\s]/g, '').trim();
    console.log('Processed guess:', guess);

    // Calculate confidence based on response quality
    const confidence = guess.length > 0 && guess.length < 20 ? 0.8 : 0.5;

    return {
      guess,
      confidence,
      shieldActive,
      remainingTokens,
      remainingRequests,
    };
  } catch (error: any) {
    console.error('Groq API error:', error);

    // Check if it's a rate limit error
    if (error.status === 429) {
      return {
        guess: '',
        confidence: 0,
        shieldActive: true,
        error: 'Rate limit reached',
      };
    }

    return {
      guess: '',
      confidence: 0,
      shieldActive: false,
      error: error.message || 'Analysis failed',
    };
  }
}
