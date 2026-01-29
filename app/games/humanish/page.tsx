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
  const [isWaitingForReply, setIsWaitingForReply] = useState(false);
  const [userGuess, setUserGuess] = useState<PartnerType | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [gameEnded, setGameEnded] = useState(false);
  const [sessionId, setSessionId] = useState<string>("");
  const [backgroundTimeout, setBackgroundTimeout] = useState(15);

  const lastMessageId = useRef<string | null>(null);
  const pollInterval = useRef<NodeJS.Timeout | null>(null);
  const decisionCheckInterval = useRef<NodeJS.Timeout | null>(null);

  // Start game - create session and check for volunteer in background
  const startGame = async () => {
    // Clear any existing intervals before starting
    if (decisionCheckInterval.current) {
      clearInterval(decisionCheckInterval.current);
    }
    if (pollInterval.current) {
      clearInterval(pollInterval.current);
    }

    const newSessionId = `session_${Date.now()}`;
    setSessionId(newSessionId);
    setGameStarted(true);
    setGameEnded(false);
    setTimeLeft(90);
    setMessages([]);
    setUserGuess(null);
    setShowResult(false);
    setPartnerType(null);
    setBackgroundTimeout(15);
    lastMessageId.current = null;

    // Start checking for volunteer decision in background
    try {
      decisionCheckInterval.current = setInterval(checkVolunteerDecision, 500);
    } catch (error) {
      console.error("Failed to join:", error);
    }
  };

  // Check volunteer decision
  const checkVolunteerDecision = async () => {
    if (!sessionId) return;

    try {
      const response = await fetch(`/api/chat-broker?sessionId=${sessionId}&lastId=${lastMessageId.current || ""}`);
      const data = await response.json();

      if (data.decision === "chat") {
        setPartnerType("human");
        if (decisionCheckInterval.current) {
          clearInterval(decisionCheckInterval.current);
        }
        pollInterval.current = setInterval(pollMessages, 500);
      } else if (data.decision === "ai") {
        connectToAI();
      }
    } catch (error) {
      console.error("Decision check error:", error);
    }
  };

  // Connect to AI (volunteer passed or timeout)
  const connectToAI = () => {
    setPartnerType("ai");
    if (decisionCheckInterval.current) {
      clearInterval(decisionCheckInterval.current);
    }
    // Send initial AI greeting
    setTimeout(() => {
      sendBotMessage("hey whats up lol");
    }, 1000);
  };

  // Background timeout counter (hidden from user)
  useEffect(() => {
    if (!gameStarted || gameEnded || partnerType) return;

    const timer = setInterval(() => {
      setBackgroundTimeout((prev) => {
        if (prev <= 1) {
          // Timeout - connect to AI
          connectToAI();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameStarted, gameEnded, partnerType]);

  // Game timer - only starts when connected to partner (AI or human)
  useEffect(() => {
    if (!gameStarted || gameEnded || !partnerType) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setGameEnded(true);
          clearInterval(timer);
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
  }, [gameStarted, gameEnded, partnerType]);

  // Poll for new messages from volunteer
  const pollMessages = async () => {
    if (!sessionId || !gameStarted || gameEnded) return;

    try {
      const response = await fetch(`/api/chat-broker?sessionId=${sessionId}&lastId=${lastMessageId.current || ""}`);
      const data = await response.json();

      if (data.messages && data.messages.length > 0) {
        data.messages.forEach((msg: any) => {
          if (msg.sender === "volunteer") {
            setMessages((prev) => [...prev, { sender: "partner", text: msg.text }]);
            setIsWaitingForReply(false);
          }
          lastMessageId.current = msg.id;
        });
      }
    } catch (error) {
      console.error("Polling error:", error);
    }
  };

  // Send message to AI
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
        setIsWaitingForReply(false);
      }
    } catch (error) {
      console.error("Failed to get bot response:", error);
      setIsWaitingForReply(false);
    }
  };

  // Send message to volunteer
  const sendVolunteerMessage = async (text: string) => {
    if (!sessionId) return;
    
    try {
      await fetch("/api/chat-broker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          message: text,
          sender: "player",
        }),
      });
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  // Handle sending message
  const handleSend = async () => {
    if (!inputText.trim() || !gameStarted || gameEnded) return;

    const messageText = inputText.trim();
    const newMessage: Message = { sender: "me", text: messageText };
    setMessages((prev) => [...prev, newMessage]);
    setInputText("");
    setIsWaitingForReply(true);

    // Route to bot or volunteer
    if (partnerType === "ai") {
      await sendBotMessage(messageText);
    } else {
      await sendVolunteerMessage(messageText);
    }
  };

  // Handle guess submission
  const submitGuess = (guess: PartnerType) => {
    setUserGuess(guess);
    setShowResult(true);
  };

  const isCorrect = userGuess === partnerType;

  return (
    <div className="h-screen overflow-auto bg-gradient-to-br from-pink-100 to-cyan-100 p-4 font-mono">
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
                    Chat started! Say hello...
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
      </div>
    </div>
  );
}
