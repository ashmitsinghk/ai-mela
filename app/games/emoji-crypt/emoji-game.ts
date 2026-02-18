'use server';

import Groq from 'groq-sdk';

export interface EmojiClue {
    title: string;
    emojis: string;
    category: string;
    hint: string;
}

export interface ApiKeys {
    groq?: string;
}

export async function generateEmojiClue(
    category: string = 'MIXED',
    difficulty: string = 'MEDIUM',
    apiKeys?: ApiKeys
): Promise<EmojiClue> {
    const groqKey = apiKeys?.groq || process.env.GROQ_API_KEY;

    if (!groqKey) {
        throw new Error('API_KEY_MISSING');
    }

    const groq = new Groq({ apiKey: groqKey });

    const systemPrompt = `You are a game host for 'Emoji Crypt'. Your job is to generate a popular movie, book, or song title and describe it using ONLY emojis.

Rules:
1. Choose a ${difficulty} difficulty title from the '${category}' category (or mixed if MIXED).
2. The emoji description must be clever but solvable.
3. Do NOT use any text in the emoji field.
4. Output JSON only: { "title": "The Matrix", "emojis": "🕶️💊🔴🔵", "category": "Movie", "hint": "Red pill or blue pill?" }`;

    try {
        const completion = await groq.chat.completions.create({
            messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: 'Generate one round.' }],
            model: 'llama-3.3-70b-versatile',
            temperature: 0.9,
            response_format: { type: 'json_object' },
        });

        const content = completion.choices[0]?.message?.content;
        if (!content) throw new Error('No content from AI');

        const result = JSON.parse(content);
        return {
            title: result.title,
            emojis: result.emojis,
            category: result.category,
            hint: result.hint,
        };
    } catch (error) {
        console.error('Emoji Gen Error:', error);
        throw new Error('FAILED_TO_GENERATE');
    }
}
