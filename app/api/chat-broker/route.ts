import { NextRequest, NextResponse } from "next/server";

// Simple in-memory storage for 90-second chats
const channels = new Map<string, {
  messages: Array<{ id: string; sender: string; text: string }>;
  volunteerChoice: "chat" | "ai" | null;
  createdAt: number;
  volunteerJoined: boolean;
}>();

// Queue of session IDs waiting for a volunteer
const waitingQueue: string[] = [];

// Auto-cleanup after 3 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, data] of channels.entries()) {
    if (now - data.createdAt > 180000) channels.delete(id);
  }
  // Cleanup waiting queue for expired sessions
  for (let i = waitingQueue.length - 1; i >= 0; i--) {
    if (!channels.has(waitingQueue[i])) {
      waitingQueue.splice(i, 1);
    }
  }
}, 60000);

export async function POST(req: NextRequest) {
  const { sessionId, message, sender, decision, action } = await req.json();

  // ACTION: Register as waiting player
  if (action === "register_waiting") {
    if (!sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 });

    if (!channels.has(sessionId)) {
      channels.set(sessionId, {
        messages: [],
        volunteerChoice: null,
        createdAt: Date.now(),
        volunteerJoined: false
      });
    }

    if (!waitingQueue.includes(sessionId)) {
      waitingQueue.push(sessionId);
    }
    return NextResponse.json({ success: true, queuePosition: waitingQueue.length });
  }

  // ACTION: Volunteer looking for player
  if (action === "find_player") {
    if (waitingQueue.length === 0) {
      return NextResponse.json({ found: false });
    }

    const foundSessionId = waitingQueue.shift(); // Get oldest waiter
    const channel = channels.get(foundSessionId!);

    if (channel) {
      channel.volunteerJoined = true; // Mark as picked up
      return NextResponse.json({ found: true, sessionId: foundSessionId });
    } else {
      // Should happen rarely due to cleanup, but just in case check next
      return NextResponse.json({ found: false }); // Client will retry
    }
  }

  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }

  // Initialize channel if needed (fallback)
  if (!channels.has(sessionId)) {
    channels.set(sessionId, { messages: [], volunteerChoice: null, createdAt: Date.now(), volunteerJoined: false });
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
    return NextResponse.json({ messages: [], decision: null, volunteerJoined: false });
  }

  // Get new messages since lastId
  const lastIndex = lastId ? channel.messages.findIndex(m => m.id === lastId) : -1;
  const newMessages = channel.messages.slice(lastIndex + 1);

  return NextResponse.json({
    messages: newMessages,
    decision: channel.volunteerChoice,
    volunteerJoined: channel.volunteerJoined
  });
}
