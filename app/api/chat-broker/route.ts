import { NextRequest, NextResponse } from "next/server";

// In-memory message queue (resets on server restart)
const messageQueues: Map<string, any[]> = new Map();
const activeConnections: Map<string, { type: "player" | "volunteer"; lastSeen: number }> = new Map();

// Clean up old sessions every 2 minutes
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, conn] of activeConnections.entries()) {
    if (now - conn.lastSeen > 120000) { // 2 minutes
      messageQueues.delete(sessionId);
      activeConnections.delete(sessionId);
    }
  }
}, 120000);

export async function POST(req: NextRequest) {
  try {
    const { action, sessionId, message, userType } = await req.json();

    if (!sessionId) {
      return NextResponse.json({ error: "Session ID required" }, { status: 400 });
    }

    // Initialize queue if it doesn't exist
    if (!messageQueues.has(sessionId)) {
      messageQueues.set(sessionId, []);
    }

    if (action === "send") {
      // Add message to queue
      const messages = messageQueues.get(sessionId)!;
      messages.push({
        id: Date.now().toString(),
        sender: userType,
        text: message,
        timestamp: Date.now(),
      });
      
      // Update last seen
      activeConnections.set(sessionId, { type: userType, lastSeen: Date.now() });
      
      return NextResponse.json({ success: true });
    }

    if (action === "poll") {
      // Get messages since lastMessageId
      const { lastMessageId } = await req.json();
      const messages = messageQueues.get(sessionId) || [];
      
      const lastIndex = lastMessageId 
        ? messages.findIndex(m => m.id === lastMessageId)
        : -1;
      
      const newMessages = messages.slice(lastIndex + 1);
      
      // Update last seen
      activeConnections.set(sessionId, { type: userType, lastSeen: Date.now() });
      
      return NextResponse.json({ messages: newMessages });
    }

    if (action === "join") {
      // Register connection
      activeConnections.set(sessionId, { type: userType, lastSeen: Date.now() });
      return NextResponse.json({ success: true, sessionId });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Chat broker error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const sessionId = searchParams.get("sessionId");
  const lastMessageId = searchParams.get("lastMessageId");

  if (!sessionId) {
    return NextResponse.json({ error: "Session ID required" }, { status: 400 });
  }

  const messages = messageQueues.get(sessionId) || [];
  const lastIndex = lastMessageId 
    ? messages.findIndex(m => m.id === lastMessageId)
    : -1;
  
  const newMessages = messages.slice(lastIndex + 1);
  
  return NextResponse.json({ messages: newMessages });
}
