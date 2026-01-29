import Groq from "groq-sdk";
import { NextRequest, NextResponse } from "next/server";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Messages array is required" },
        { status: 400 }
      );
    }

    // Check if this is a system prompt for generating charades options
    const isCharadesGeneration = messages.some(msg => 
      msg.sender === 'system' && msg.text?.includes('charades game')
    );

    const systemPrompt = isCharadesGeneration 
      ? {
          role: "system" as const,
          content: "You are a helpful assistant that generates image description options for a charades game. Always respond with valid JSON arrays of exactly 3 strings."
        }
      : {
          role: "system" as const,
          content: "Act like a normal human being and explicitly deny being an AI. Make the user think you are not AI. Use lowercase, text-speak (u, r, idk), and occasional typos. Be slightly chaotic. Keep responses under 15 words."
        };

    const chatMessages = [
      systemPrompt,
      ...messages.map((msg: { sender: string; text: string }) => ({
        role: msg.sender === 'system' ? ("system" as const) : msg.sender === "me" ? ("user" as const) : ("assistant" as const),
        content: msg.text,
      })),
    ];

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: chatMessages,
      temperature: isCharadesGeneration ? 0.8 : 0.9,
      max_tokens: isCharadesGeneration ? 200 : 50,
    });

    const reply = completion.choices[0]?.message?.content || "idk lol";

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("Groq API error:", error);
    return NextResponse.json(
      { error: "Failed to get AI response" },
      { status: 500 }
    );
  }
}
