'use server';

import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || '',
});

export interface HeadlineSet {
  real: string;
  fakes: string[];
}

/**
 * Server Action: Takes a real headline and generates 2 fake headlines that match its style
 * Uses Groq API with Llama model for fast generation
 */
export async function generateFakeHeadlines(realHeadline: string): Promise<HeadlineSet> {
  try {
    if (!process.env.GROQ_API_KEY) {
      console.error('❌ No Groq API key found');
      throw new Error('API key not configured');
    }

    const systemPrompt = `You are an expert news satirist and creative writer. Your task is to take a real, bizarre news headline and create two 'ridiculous' fake headlines.

Rules for Fakes:
1. They must match the tone, length, and sentence structure of the real headline.
2. They must be bizarre but physically possible (no aliens or magic).
3. Use specific names, locations, and numbers to make them sound authoritative.
4. Ensure the fakes are indistinguishable from the real one in terms of 'weirdness.'
5. Output strictly in JSON format: {"real": "string", "fakes": ["string", "string"]}.`;

    const userPrompt = `Real Headline: ${realHeadline}`;

    console.log('🎯 Generating fake headlines for:', realHeadline);

    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.9,
      max_tokens: 500,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from AI');
    }

    const result: HeadlineSet = JSON.parse(content);
    
    // Validate the response structure
    if (!result.real || !Array.isArray(result.fakes) || result.fakes.length !== 2) {
      throw new Error('Invalid response format from AI');
    }

    console.log('✅ Generated headlines:', result);
    return result;

  } catch (error: any) {
    console.error('❌ Headline generation error:', error);
    
    // Fallback: Return the real headline with generic fakes
    return {
      real: realHeadline,
      fakes: [
        'Scientists discover new species of bacteria that thrives on plastic waste',
        'Local mayor implements mandatory nap time for all city employees',
      ],
    };
  }
}

/**
 * Alternative: Use Gemini for headline generation (if Groq quota is exhausted)
 */
export async function generateFakeHeadlinesWithGemini(realHeadline: string): Promise<HeadlineSet> {
  try {
    if (!process.env.GEMINI_API_KEY) {
      console.error('❌ No Gemini API key found');
      throw new Error('API key not configured');
    }

    const systemPrompt = `You are an expert news satirist and creative writer. Your task is to take a real, bizarre news headline and create two 'ridiculous' fake headlines.

Rules for Fakes:
1. They must match the tone, length, and sentence structure of the real headline.
2. They must be bizarre but physically possible (no aliens or magic).
3. Use specific names, locations, and numbers to make them sound authoritative.
4. Ensure the fakes are indistinguishable from the real one in terms of 'weirdness.'
5. Output strictly in JSON format: {"real": "string", "fakes": ["string", "string"]}.`;

    const userPrompt = `Real Headline: ${realHeadline}`;

    console.log('🎯 Generating fake headlines with Gemini for:', realHeadline);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: userPrompt }],
            },
          ],
          systemInstruction: {
            parts: [{ text: systemPrompt }],
          },
          generationConfig: {
            temperature: 0.9,
            maxOutputTokens: 500,
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!content) {
      throw new Error('No response from Gemini');
    }

    const result: HeadlineSet = JSON.parse(content);
    
    // Validate the response structure
    if (!result.real || !Array.isArray(result.fakes) || result.fakes.length !== 2) {
      throw new Error('Invalid response format from Gemini');
    }

    console.log('✅ Generated headlines with Gemini:', result);
    return result;

  } catch (error: any) {
    console.error('❌ Gemini headline generation error:', error);
    
    // Fallback: Return the real headline with generic fakes
    return {
      real: realHeadline,
      fakes: [
        'Scientists discover new species of bacteria that thrives on plastic waste',
        'Local mayor implements mandatory nap time for all city employees',
      ],
    };
  }
}
