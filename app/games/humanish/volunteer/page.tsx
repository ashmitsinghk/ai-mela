"use client";

import { useState, useEffect, useRef } from "react";

type Message = {
  sender: "me" | "partner";
  text: string;
};

export default function VolunteerDashboard() {
  const [isReady, setIsReady] = useState(false);
  const [sessionId, setSessionId] = useState<string>("");
  const [timeLeft, setTimeLeft] = useState(15);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [guess, setGuess] = useState<"ai" | "human" | null>(null);
  const [connected, setConnected] = useState(false);
  const [showTimeout, setShowTimeout] = useState(false);

  const lastMessageId = useRef<string | null>(null);
  const pollInterval = useRef<NodeJS.Timeout | null>(null);

  // Start volunteering
  const startVolunteering = () => {
    const id = `session_${Date.now()}`;
    setSessionId(id);
    setIsReady(true);
    setTimeLeft(15);
    setGuess(null);
    setShowTimeout(false);
    
    // Join the session
    joinSession(id);
  };

  // Join session
  const joinSession = async (id: string) => {
    try {
      await fetch("/api/chat-broker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "join",
          sessionId: id,
          userType: "volunteer",
        }),
      });
      setConnected(true);
    } catch (error) {
      console.error("Failed to join session:", error);
    }
  };

  // Poll for new messages
  const pollMessages = async () => {
    if (!sessionId || !connected) return;

    try {
      const response = await fetch(
        `/api/chat-broker?sessionId=${sessionId}&lastMessageId=${lastMessageId.current || ""}`
      );
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

  // Start polling when guess is made
  useEffect(() => {
    if (guess && connected) {
      pollInterval.current = setInterval(pollMessages, 500); // Poll every 500ms
      return () => {
        if (pollInterval.current) clearInterval(pollInterval.current);
      };
    }
  }, [guess, connected, sessionId]);

  // Timer for selection
  useEffect(() => {
    if (!isReady || guess !== null) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setShowTimeout(true);
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isReady, guess]);

  // Handle guess selection
  const handleGuess = (selection: "ai" | "human") => {
    setGuess(selection);
  };

  // Send message
  const handleSend = async () => {
    if (!inputText.trim() || !connected) return;

    const newMessage: Message = { sender: "me", text: inputText.trim() };
    setMessages((prev) => [...prev, newMessage]);

    // Send to broker
    try {
      await fetch("/api/chat-broker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send",
          sessionId,
          message: inputText.trim(),
          userType: "volunteer",
        }),
      });
    } catch (error) {
      console.error("Failed to send message:", error);
    }

    setInputText("");
  };

  // Reset
  const reset = () => {
    if (pollInterval.current) {
      clearInterval(pollInterval.current);
    }
    setIsReady(false);
    setMessages([]);
    setGuess(null);
    setConnected(false);
    lastMessageId.current = null;
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

        {!isReady ? (
          <div className="bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-8 text-center">
            <h2 className="text-2xl font-bold mb-4">Join as Volunteer</h2>
            <p className="mb-6 text-gray-700">
              You'll chat with players and they'll try to guess if you're human
              or AI. First, you'll need to make your own guess about your chat
              partner!
            </p>
            <div className="bg-cyan-100 border-2 border-cyan-400 p-4 mb-6">
              <p className="font-bold mb-2">📱 Session Code:</p>
              <p className="text-sm text-gray-600">
                You'll get a session code to share with the player
              </p>
            </div>
            <button
              onClick={startVolunteering}
              className="bg-purple-400 hover:bg-purple-500 text-black font-bold py-3 px-8 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
            >
              START VOLUNTEERING
            </button>
          </div>
        ) : (
          <>
            {/* Selection Phase */}
            {guess === null && !showTimeout && (
              <div className="bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-8">
                {/* Session Code Display */}
                <div className="bg-cyan-400 border-2 border-black p-4 mb-6 text-center">
                  <p className="font-bold mb-2">SHARE THIS CODE WITH PLAYER:</p>
                  <p className="text-3xl font-mono font-bold">{sessionId.split('_')[1]}</p>
                  <p className="text-sm mt-2 text-gray-700">Player needs this to connect</p>
                </div>

                <div className="text-center mb-6">
                  <div className="text-6xl mb-4 animate-pulse">🤔</div>
                  <h2 className="text-2xl font-bold mb-2">Quick Question!</h2>
                  <p className="text-gray-700 mb-4">
                    Do you think your chat partner will be AI or Human?
                  </p>
                  <div className="bg-yellow-100 border-2 border-yellow-400 p-3 mb-4">
                    <p className="font-bold text-lg">
                      Time to decide: <span className="text-red-600">{timeLeft}s</span>
                    </p>
                  </div>
                </div>

                <div className="flex gap-4 justify-center">
                  <button
                    onClick={() => handleGuess("human")}
                    className="bg-pink-400 hover:bg-pink-500 text-black font-bold py-4 px-8 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                  >
                    👤 HUMAN
                  </button>
                  <button
                    onClick={() => handleGuess("ai")}
                    className="bg-cyan-400 hover:bg-cyan-500 text-black font-bold py-4 px-8 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                  >
                    🤖 AI
                  </button>
                </div>
              </div>
            )}

            {/* Timeout Message */}
            {showTimeout && guess === null && (
              <div className="bg-red-300 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-8 text-center">
                <h2 className="text-3xl font-bold mb-4">⏰ TIME'S UP!</h2>
                <p className="text-xl mb-6">
                  You didn't select in time. Transferring to AI mode...
                </p>
                <button
                  onClick={reset}
                  className="bg-white hover:bg-gray-100 text-black font-bold py-3 px-8 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                >
                  TRY AGAIN
                </button>
              </div>
            )}

            {/* Chat Interface (after selection) */}
            {guess !== null && (
              <>
                <div className="bg-purple-400 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4 mb-4">
                  <div className="flex justify-between items-center">
                    <span className="text-xl font-bold">
                      Your guess: {guess === "ai" ? "🤖 AI" : "👤 HUMAN"}
                    </span>
                    <span className="text-sm bg-white px-3 py-1 border-2 border-black">
                      {connected ? "🟢 CONNECTED" : "🔴 CONNECTING..."}
                    </span>
                  </div>
                </div>

                {/* Chat Box */}
                <div className="bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] mb-4">
                  <div className="h-96 overflow-y-auto p-4 space-y-3">
                    {messages.length === 0 && (
                      <p className="text-gray-400 text-center mt-20">
                        Waiting for player to connect with code: <strong>{sessionId.split('_')[1]}</strong>
                      </p>
                    )}
                    {messages.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`flex ${
                          msg.sender === "me" ? "justify-end" : "justify-start"
                        }`}
                      >
                        <div
                          className={`max-w-[70%] p-3 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${
                            msg.sender === "me"
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
                      disabled={!connected}
                    />
                    <button
                      onClick={handleSend}
                      disabled={!inputText.trim() || !connected}
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
          </>
        )}
      </div>
    </div>
  );
}
