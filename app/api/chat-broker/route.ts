import { NextRequest, NextResponse } from "next/server";

// Simple in-memory storage for 90-second chats
const channels = new Map<string, {
  messages: Array<{ id: string; sender: string; text: string }>;
  volunteerChoice: "chat" | "ai" | null;
  createdAt: number;
}>();

// Auto-cleanup after 3 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, data] of channels.entries()) {
    if (now - data.createdAt > 180000) channels.delete(id);
  }
}, 60000);

export async function POST(req: NextRequest) {
  const { sessionId, message, sender, decision } = await req.json();
  
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }

  // Initialize channel if needed
  if (!channels.has(sessionId)) {
    channels.set(sessionId, { messages: [], volunteerChoice: null, createdAt: Date.now() });
  }

  const channel = channels.get(sessionId)!;

  // Send message
  if (message && sender) {
    channel.messages.push({
      id: `${Date.now()}_${Math.random()}`,
      sender,
      text: message,
    });
    return NextResponse.json({ success: true });
  }

  // Set volunteer decision
  if (decision) {
    channel.volunteerChoice = decision;
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid request" }, { status: 400 });
}

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId");
  const lastId = req.nextUrl.searchParams.get("lastId");

  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }

  const channel = channels.get(sessionId);
  if (!channel) {
    return NextResponse.json({ messages: [], decision: null });
  }

  // Get new messages since lastId
  const lastIndex = lastId ? channel.messages.findIndex(m => m.id === lastId) : -1;
  const newMessages = channel.messages.slice(lastIndex + 1);

  return NextResponse.json({ 
    messages: newMessages, 
    decision: channel.volunteerChoice 
  });
}
