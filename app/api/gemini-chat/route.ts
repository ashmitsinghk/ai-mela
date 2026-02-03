import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || "");

export async function POST(req: NextRequest) {
    let messages: any[] = [];
    try {
        const body = await req.json();
        messages = body.messages;

        if (!messages || !Array.isArray(messages)) {
            return NextResponse.json(
                { error: "Messages array is required" },
                { status: 400 }
            );
        }

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        // Construct chat history
        // Gemini expects structure: { role: 'user' | 'model', parts: [{ text: string }] }
        // Our messages: { sender: 'me' | 'partner', text: string }

        // System instruction (Humanish persona)
        const systemInstruction = `
        vibe: you're just a random person from india hanging out online. 
        low effort: don't use caps. don't use full stops at the end of msgs.
        language: mostly English, but can use casual Indian slang like "yaar", "bro", "scene" if it fits. 
        IMPORTANT: Start in English. If the user speaks Hindi, you can switch, but DEFAULT TO ENGLISH.
        personality:
        - you're not an assistant. if asked for help, be slightly lazy.
        - never use bold(**), bullet points, or numbered lists. it's a dead giveaway.
        - if someone asks if you're ai, just be dismissive like "lol what", "nah bro", "kya bol rha h".
        - if a question is too long, just reply to one part of it.
        `.trim();

        const history = messages.slice(0, -1).map((msg: any) => ({
            role: msg.sender === "me" ? "user" : "model",
            parts: [{ text: msg.text }],
        }));

        const lastMessage = messages[messages.length - 1];

        // Start chat
        const chat = model.startChat({
            history: history,
            systemInstruction: systemInstruction,
        });

        const result = await chat.sendMessage(lastMessage.text);
        const response = result.response;
        const reply = response.text();

        return NextResponse.json({ reply });
    } catch (error) {
        console.error("Gemini API error:", error);

        // Fallback to Groq
        try {
            console.log("Falling back to Groq...");
            // Determine protocol (http or https) - simplified, assuming http for local/internal or same origin
            const protocol = req.nextUrl.protocol;
            const host = req.nextUrl.host;
            // Use the 'messages' variable already parsed from the request body

            const groqResponse = await fetch(`${protocol}//${host}/api/groq`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ messages }),
            });

            if (groqResponse.ok) {
                const data = await groqResponse.json();
                return NextResponse.json(data);
            } else {
                throw new Error("Groq fallback failed");
            }

        } catch (fallbackError) {
            console.error("Groq fallback error:", fallbackError);
            return NextResponse.json(
                { error: "Failed to get AI response (Gemini & Groq failed)" },
                { status: 500 }
            );
        }
    }
}
