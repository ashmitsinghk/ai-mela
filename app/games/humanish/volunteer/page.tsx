"use client";

import { useState, useEffect, useRef } from "react";

type Message = {
  sender: "me" | "partner";
  text: string;
};

export default function VolunteerDashboard() {
  const [isChatting, setIsChatting] = useState(false);
  const [sessionId, setSessionId] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [decisionTimeout, setDecisionTimeout] = useState(15);
  const sessionIdRef = useRef<string>("");

  const lastMessageId = useRef<string | null>(null);
  const pollInterval = useRef<NodeJS.Timeout | null>(null);
  const playerCheckInterval = useRef<NodeJS.Timeout | null>(null);

  // Start polling for a player when the component mounts or session is reset
  useEffect(() => {
    const checkForPlayer = async () => {
      if (sessionId) return;
      try {
        // Try to find a waiting player
        const response = await fetch("/api/chat-broker", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "find_player" })
        });
        const data = await response.json();

        if (data.found && data.sessionId) {
          setSessionId(data.sessionId);
          sessionIdRef.current = data.sessionId;
          setDecisionTimeout(15);
        }
      } catch (error) {
        console.error("Error checking for player:", error);
      }
    };

    let interval: NodeJS.Timeout;
    if (!sessionId) {
      // Poll every 1s to find a player
      interval = setInterval(checkForPlayer, 1000);
      checkForPlayer(); // Initial check
    }

    return () => {
      if (interval) clearInterval(interval);
    }
  }, [sessionId]);

  // Decision timeout counter
  useEffect(() => {
    if (isChatting || !sessionId) return;

    const timer = setInterval(() => {
      setDecisionTimeout((prev) => {
        if (prev <= 1) {
          // Timeout - choose AI automatically
          handleDecision("ai");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isChatting, sessionId]);

  // Handle volunteer decision
  const handleDecision = async (choice: "chat" | "ai") => {
    try {
      await fetch("/api/chat-broker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          decision: choice,
        }),
      });

      if (choice === "chat") {
        setIsChatting(true);
        pollInterval.current = setInterval(pollMessages, 500);
      } else {
        reset();
      }
    } catch (error) {
      console.error("Failed to send decision:", error);
    }
  };

  // Poll for new messages from player
  const pollMessages = async () => {
    const currentSessionId = sessionIdRef.current;
    if (!currentSessionId) return;

    try {
      const response = await fetch(`/api/chat-broker?sessionId=${sessionId}&lastId=${lastMessageId.current || ""}`);
      const data = await response.json();

      if (data.messages && data.messages.length > 0) {
        data.messages.forEach((msg: any) => {
          if (msg.sender === "player") {
            setMessages((prev) => [...prev, { sender: "partner", text: msg.text }]);
          }
          lastMessageId.current = msg.id;
        });
      }
    } catch (error) {
      console.error("Polling error:", error);
    }
  };

  // Send message
  const handleSend = async () => {
    if (!inputText.trim() || !isChatting) return;

    const newMessage: Message = { sender: "me", text: inputText.trim() };
    setMessages((prev) => [...prev, newMessage]);

    try {
      await fetch("/api/chat-broker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          message: inputText.trim(),
          sender: "volunteer",
        }),
      });
    } catch (error) {
      console.error("Failed to send message:", error);
    }

    setInputText("");
  };

  // Reset and go back to polling
  const reset = () => {
    if (pollInterval.current) {
      clearInterval(pollInterval.current);
    }
    if (playerCheckInterval.current) {
      clearInterval(playerCheckInterval.current);
    }
    setIsChatting(false);
    setMessages([]);
    lastMessageId.current = null;
    setDecisionTimeout(15);
    setSessionId(""); // This triggers the useEffect to start polling again
    sessionIdRef.current = "";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 to-indigo-100 p-4 font-mono">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold mb-2 text-black drop-shadow-[3px_3px_0px_rgba(0,0,0,0.3)]">
            VOLUNTEER PORTAL
          </h1>
          <p className="text-lg text-gray-700">
            Help humans test their Turing skills!
          </p>
        </div>

        {/* Waiting for Player */}
        {!sessionId && !isChatting && (
          <div className="bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-8 text-center">
            <h2 className="text-2xl font-bold mb-4">Scanning for Players</h2>
            <p className="text-gray-700">
              Looking for a player in the waiting queue...
            </p>
            <div className="mt-4 text-xl animate-pulse font-mono">. . .</div>
          </div>
        )}

        {/* Decision Phase */}
        {!isChatting && sessionId && (
          <div className="bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-8">
            <div className="text-center mb-6">
              <div className="text-6xl mb-4">👋</div>
              <h2 className="text-2xl font-bold mb-2">Player Joined</h2>
              <p className="text-gray-700 mb-4">
                Do you want to chat or transfer to AI?
              </p>
              <div className="bg-yellow-100 border-2 border-yellow-400 p-3 mb-4">
                <p className="font-bold text-lg">
                  <span className="text-red-600 text-2xl">{decisionTimeout}s</span>
                </p>
              </div>
            </div>

            <div className="flex gap-4 justify-center">
              <button
                onClick={() => handleDecision("chat")}
                className="bg-pink-400 hover:bg-pink-500 text-black font-bold py-4 px-8 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
              >
                Chat Myself
              </button>
              <button
                onClick={() => handleDecision("ai")}
                className="bg-cyan-400 hover:bg-cyan-500 text-black font-bold py-4 px-8 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
              >
                AI Transfer
              </button>
            </div>
          </div>
        )}

        {/* Chat Interface */}
        {isChatting && (
          <>
            <div className="bg-purple-400 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4 mb-4">
              <div className="flex justify-between items-center">
                <span className="text-xl font-bold">💬 CHATTING WITH PLAYER</span>
                <span className="text-sm bg-white px-3 py-1 border-2 border-black">
                  🟢 CONNECTED
                </span>
              </div>
            </div>

            {/* Chat Box */}
            <div className="bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] mb-4">
              <div className="h-96 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 && (
                  <p className="text-gray-400 text-center mt-20">
                    Waiting for player to send first message...
                  </p>
                )}
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.sender === "me" ? "justify-end" : "justify-start"
                      }`}
                  >
                    <div
                      className={`max-w-[70%] p-3 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${msg.sender === "me"
                        ? "bg-purple-300"
                        : "bg-indigo-200"
                        }`}
                    >
                      <p className="break-words">{msg.text}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Input */}
              <div className="border-t-4 border-black p-4 flex gap-2">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  placeholder="Type your message..."
                  className="flex-1 p-3 border-2 border-black focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
                <button
                  onClick={handleSend}
                  disabled={!inputText.trim()}
                  className="bg-purple-400 hover:bg-purple-500 disabled:bg-gray-300 text-black font-bold py-3 px-6 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] transition-all disabled:cursor-not-allowed"
                >
                  SEND
                </button>
              </div>
            </div>

            <button
              onClick={reset}
              className="w-full bg-red-400 hover:bg-red-500 text-black font-bold py-3 px-6 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
            >
              LEAVE CHAT
            </button>
          </>
        )}
      </div>
    </div>
  );
}
