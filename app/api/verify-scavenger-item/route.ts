import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY!);

export async function POST(req: NextRequest) {
    try {
        const { image, target } = await req.json();

        if (!image || !target) {
            return NextResponse.json({ error: 'Missing image or target' }, { status: 400 });
        }

        // Clean base64 string (remove header if present)
        const base64Data = image.replace(/^data:image\/(png|jpeg|webp);base64,/, '');

        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const prompt = `Is this image showing a ${target}? Answer strictly with YES or NO. If it is unclear or unrelated, answer NO.`;

        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    data: base64Data,
                    mimeType: 'image/jpeg', // react-webcam uses jpeg by default
                },
            },
        ]);

        const response = await result.response;
        const text = response.text().trim().toUpperCase();
        const isMatch = text.includes('YES');

        return NextResponse.json({ 
            match: isMatch, 
            debug: text 
        });

    } catch (error) {
        console.error('Error verifying object with Gemini:', error);
        return NextResponse.json({ error: 'Verification failed', match: false }, { status: 500 });
    }
}
