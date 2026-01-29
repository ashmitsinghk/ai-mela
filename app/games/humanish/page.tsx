"use client";

import { useState, useEffect, useRef } from "react";

type Message = {
  sender: "me" | "partner";
  text: string;
};

type PartnerType = "human" | "ai";

export default function HumanishGame() {
  const [gameStarted, setGameStarted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(90);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [partnerType, setPartnerType] = useState<PartnerType | null>(null);
  const [isBotHijacked, setIsBotHijacked] = useState(false);
  const [isWaitingForReply, setIsWaitingForReply] = useState(false);
  const [gameEnded, setGameEnded] = useState(false);
  const [userGuess, setUserGuess] = useState<PartnerType | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [sessionCode, setSessionCode] = useState<string>("");
  const [sessionId, setSessionId] = useState<string>("");
  const [connected, setConnected] = useState(false);

  const lastPartnerMessageTime = useRef<number>(Date.now());
  const failoverTimeout = useRef<NodeJS.Timeout | null>(null);
  const lastMessageId = useRef<string | null>(null);
  const pollInterval = useRef<NodeJS.Timeout | null>(null);

  // Initialize game
  const startGame = () => {
    const randomType: PartnerType = Math.random() > 0.5 ? "human" : "ai";
    setPartnerType(randomType);
    setGameStarted(true);
    setTimeLeft(90);
    setMessages([]);
    setIsBotHijacked(randomType === "ai");
    setGameEnded(false);
    setUserGuess(null);
    setShowResult(false);
    lastPartnerMessageTime.current = Date.now();

    if (randomType === "human" && sessionCode) {
      // Connect with volunteer using session code
      const fullSessionId = `session_${sessionCode}`;
      setSessionId(fullSessionId);
      joinSession(fullSessionId);
    } else {
      // Send initial greeting from AI
      setTimeout(() => {
        sendBotMessage("hey whats up lol");
      }, 1000);
    }
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
          userType: "player",
        }),
      });
      setConnected(true);
      // Start polling for volunteer messages
      pollInterval.current = setInterval(pollMessages, 500);
    } catch (error) {
      console.error("Failed to join session:", error);
    }
  };

  // Poll for new messages from volunteer
  const pollMessages = async () => {
    if (!sessionId || !connected) return;

    try {
      const response = await fetch(
        `/api/chat-broker?sessionId=${sessionId}&lastMessageId=${lastMessageId.current || ""}`
      );
      const data = await response.json();

      if (data.messages && data.messages.length > 0) {
        data.messages.forEach((msg: any) => {
          if (msg.sender === "volunteer") {
            setMessages((prev) => [...prev, { sender: "partner", text: msg.text }]);
            lastPartnerMessageTime.current = Date.now();
            setIsWaitingForReply(false);
            
            // Clear failover timeout since volunteer responded
            if (failoverTimeout.current) {
              clearTimeout(failoverTimeout.current);
            }
          }
          lastMessageId.current = msg.id;
        });
      }
    } catch (error) {
      console.error("Polling error:", error);
    }
  };

  // Game timer
  useEffect(() => {
    if (!gameStarted || gameEnded) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setGameEnded(true);
          clearInterval(timer);
          // Cleanup polling when game ends
          if (pollInterval.current) {
            clearInterval(pollInterval.current);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(timer);
      if (pollInterval.current) {
        clearInterval(pollInterval.current);
      }
    };
  }, [gameStarted, gameEnded]);

  // Volunteer failover mechanism
  useEffect(() => {
    if (!gameStarted || gameEnded || isBotHijacked || !isWaitingForReply) return;

    // Clear existing timeout
    if (failoverTimeout.current) {
      clearTimeout(failoverTimeout.current);
    }

    // Set 15-second failover
    failoverTimeout.current = setTimeout(() => {
      console.log("Volunteer timeout - switching to bot");
      setIsBotHijacked(true);
      setIsWaitingForReply(false);
      // Send a delayed response from bot
      setTimeout(() => {
        sendBotMessage("sorry was afk lol");
      }, 500);
    }, 15000);

    return () => {
      if (failoverTimeout.current) {
        clearTimeout(failoverTimeout.current);
      }
    };
  }, [isWaitingForReply, gameStarted, gameEnded, isBotHijacked]);

  // Send message to Groq API
  const sendBotMessage = async (userMessage?: string) => {
    try {
      const messagesToSend = userMessage
        ? [...messages, { sender: "me" as const, text: userMessage }]
        : messages;

      const response = await fetch("/api/groq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: messagesToSend }),
      });

      const data = await response.json();
      
      if (data.reply) {
        setMessages((prev) => [
          ...prev,
          { sender: "partner", text: data.reply },
        ]);
        lastPartnerMessageTime.current = Date.now();
        setIsWaitingForReply(false);
      }
    } catch (error) {
      console.error("Failed to get bot response:", error);
      setIsWaitingForReply(false);
    }
  };

  // Mock volunteer response (simulate human behavior) - NO LONGER USED
  const sendVolunteerMessage = async (text: string) => {
    if (!sessionId || !connected) return;
    
    // Send message to volunteer via broker
    try {
      await fetch("/api/chat-broker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send",
          sessionId,
          message: text,
          userType: "player",
        }),
      });
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  // Handle sending message
  const handleSend = async () => {
    if (!inputText.trim() || gameEnded) return;

    const messageText = inputText.trim();
    const newMessage: Message = { sender: "me", text: messageText };
    setMessages((prev) => [...prev, newMessage]);
    setInputText("");
    setIsWaitingForReply(true);

    // Route to bot or volunteer
    if (isBotHijacked) {
      await sendBotMessage(messageText);
    } else {
      // Send to volunteer via broker
      await sendVolunteerMessage(messageText);
      // Failover will trigger after 15 seconds if no response
    }
  };

  // Handle guess submission
  const submitGuess = (guess: PartnerType) => {
    setUserGuess(guess);
    setShowResult(true);
  };

  const isCorrect = userGuess === partnerType;

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-100 to-cyan-100 p-4 font-mono">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold mb-2 text-black drop-shadow-[3px_3px_0px_rgba(0,0,0,0.3)]">
            HUMANISH
          </h1>
          <p className="text-lg text-gray-700">
            Chat for 90 seconds. Guess: Human or AI?
          </p>
        </div>

        {!gameStarted ? (
          <div className="bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-8 text-center">
            <h2 className="text-2xl font-bold mb-4">How It Works</h2>
            <p className="mb-6 text-gray-700">
              You'll chat with someone for 90 seconds. They could be a real
              human volunteer or an AI pretending to be human. Your job? Figure
              out which one!
            </p>
            
            {/* Session Code Input */}
            <div className="mb-6">
              <label className="block font-bold mb-2 text-left">
                Got a volunteer code? Enter it here (optional):
              </label>
              <input
                type="text"
                value={sessionCode}
                onChange={(e) => setSessionCode(e.target.value)}
                placeholder="Enter session code..."
                className="w-full p-3 border-2 border-black focus:outline-none focus:ring-2 focus:ring-pink-400 mb-2"
              />
              <p className="text-sm text-gray-600 text-left">
                Leave empty to get matched with AI or random volunteer
              </p>
            </div>
            
            <button
              onClick={startGame}
              className="bg-pink-400 hover:bg-pink-500 text-black font-bold py-3 px-8 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
            >
              START GAME
            </button>
          </div>
        ) : (
          <>
            {/* Timer */}
            <div className="bg-cyan-400 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4 mb-4">
              <div className="flex justify-between items-center">
                <span className="text-xl font-bold">TIME LEFT:</span>
                <span
                  className={`text-3xl font-bold ${
                    timeLeft <= 10 ? "text-red-600 animate-pulse" : ""
                  }`}
                >
                  {timeLeft}s
                </span>
              </div>
            </div>

            {/* Chat Box */}
            <div className="bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] mb-4">
              <div className="h-96 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 && (
                  <p className="text-gray-400 text-center mt-20">
                    Waiting for chat to start...
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
                          ? "bg-pink-300"
                          : "bg-cyan-200"
                      }`}
                    >
                      <p className="break-words">{msg.text}</p>
                    </div>
                  </div>
                ))}
                {isWaitingForReply && (
                  <div className="flex justify-start">
                    <div className="bg-gray-200 p-3 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                      <p className="text-gray-500">typing...</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Input */}
              {!gameEnded && (
                <div className="border-t-4 border-black p-4 flex gap-2">
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSend()}
                    placeholder="Type your message..."
                    className="flex-1 p-3 border-2 border-black focus:outline-none focus:ring-2 focus:ring-pink-400"
                    disabled={isWaitingForReply}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!inputText.trim() || isWaitingForReply}
                    className="bg-cyan-400 hover:bg-cyan-500 disabled:bg-gray-300 text-black font-bold py-3 px-6 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] transition-all disabled:cursor-not-allowed"
                  >
                    SEND
                  </button>
                </div>
              )}
            </div>

            {/* Guess Section */}
            {gameEnded && !showResult && (
              <div className="bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 text-center">
                <h2 className="text-2xl font-bold mb-4">TIME'S UP!</h2>
                <p className="mb-6 text-gray-700">
                  Was your chat partner a human or an AI?
                </p>
                <div className="flex gap-4 justify-center">
                  <button
                    onClick={() => submitGuess("human")}
                    className="bg-pink-400 hover:bg-pink-500 text-black font-bold py-4 px-8 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                  >
                    👤 HUMAN
                  </button>
                  <button
                    onClick={() => submitGuess("ai")}
                    className="bg-cyan-400 hover:bg-cyan-500 text-black font-bold py-4 px-8 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                  >
                    🤖 AI
                  </button>
                </div>
              </div>
            )}

            {/* Result */}
            {showResult && (
              <div
                className={`border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 text-center ${
                  isCorrect ? "bg-green-300" : "bg-red-300"
                }`}
              >
                <h2 className="text-3xl font-bold mb-2">
                  {isCorrect ? "🎉 CORRECT!" : "❌ WRONG!"}
                </h2>
                <p className="text-xl mb-4">
                  It was {partnerType === "ai" ? "an AI" : "a human"}!
                </p>
                <button
                  onClick={startGame}
                  className="bg-white hover:bg-gray-100 text-black font-bold py-3 px-8 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                >
                  PLAY AGAIN
                </button>
              </div>
            )}
          </>
        )}

        {/* Debug Info (remove in production) */}
        {gameStarted && (
          <div className="mt-4 p-3 bg-gray-800 text-white text-xs font-mono border-2 border-black">
            <p>Debug: Partner = {partnerType} | Bot Hijacked = {String(isBotHijacked)}</p>
          </div>
        )}
      </div>
    </div>
  );
}
