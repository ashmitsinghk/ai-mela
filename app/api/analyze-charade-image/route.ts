import Groq from "groq-sdk";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const apiKey = req.headers.get("x-groq-api-key") || process.env.GROQ_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Groq API Key (Vision) is required" },
        { status: 401 }
      );
    }

    const groq = new Groq({
      apiKey: apiKey,
    });
    const { imageUrl } = await req.json();

    if (!imageUrl) {
      return NextResponse.json(
        { error: "Image URL is required" },
        { status: 400 }
      );
    }

    console.log('Analyzing image:', imageUrl);

    const completion = await groq.chat.completions.create({
      model: "llama-3.2-90b-vision-preview",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Describe this image in one concise sentence. Focus on the main subject, action, and key absurd or unusual details. Keep it under 20 words and make it sound like a funny charades prompt."
            },
            {
              type: "image_url",
              image_url: {
                url: imageUrl
              }
            }
          ]
        }
      ],
      temperature: 0.7,
      max_tokens: 100,
    });

    const prompt = completion.choices[0]?.message?.content || "An unusual scene";

    return NextResponse.json({ prompt });
  } catch (error: any) {
    console.error("Groq Vision API error:", error);
    console.error("Error details:", error.message, error.status);
    return NextResponse.json(
      { error: "Failed to analyze image", details: error.message },
      { status: 500 }
    );
  }
}
