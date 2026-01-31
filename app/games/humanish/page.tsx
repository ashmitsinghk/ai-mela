"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, Coins } from "lucide-react";
import { supabase } from "@/utils/supabase";

type Message = {
  sender: "me" | "partner";
  text: string;
};

type PartnerType = "human" | "ai";
type GameState = "AUTH" | "PLAYING" | "RESULT";

export default function HumanishGame() {
  // Auth & General State
  const [gameState, setGameState] = useState<GameState>("AUTH");
  const [uid, setUid] = useState("");
  const [playerData, setPlayerData] = useState<{ name: string | null; stonks: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  // Game State
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
  const sessionIdRef = useRef<string>("");

  // Check Player (Login)
  const checkPlayer = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setAuthError("");

    try {
      const { data, error } = await supabase
        .from('players')
        .select('name, stonks')
        .eq('uid', uid)
        .single();

      if (error || !data) {
        setAuthError("Player not found! Please check your ID.");
        setPlayerData(null);
      } else {
        setPlayerData(data);
        // Automatically check balance but don't start yet, user is just "logged in"
      }
    } catch (err) {
      console.error("Auth error:", err);
      setAuthError("Failed to connect. Try again.");
    } finally {
      setLoading(false);
    }
  };

  // Start game - Deduct Fee & Register
  const startGame = async () => {
    if (!playerData || !uid) return;

    if (playerData.stonks < 20) {
      setAuthError("Not enough gems! Need 20 gems to play.");
      return;
    }

    setLoading(true);

    // DEDUCT BET (20 Gems)
    try {
      // 1. Deduct from DB
      const { error: updateError } = await supabase
        .from('players')
        .update({ stonks: playerData.stonks - 20 })
        .eq('uid', uid);

      if (updateError) throw updateError;

      // 2. Log transaction
      await supabase.from('game_logs').insert({
        player_uid: uid,
        game_title: 'Humanish',
        result: 'PLAYING',
        stonks_change: -20
      });

      // 3. Update local state
      setPlayerData(prev => prev ? ({ ...prev, stonks: prev.stonks - 20 }) : null);

      // 4. Start Game Logic
      initializeGame();

    } catch (err) {
      console.error("Betting error:", err);
      setAuthError("Transaction failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const initializeGame = async () => {
    // Clear any existing intervals
    if (decisionCheckInterval.current) clearInterval(decisionCheckInterval.current);
    if (pollInterval.current) clearInterval(pollInterval.current);

    const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setSessionId(newSessionId);
    sessionIdRef.current = newSessionId;

    setGameState("PLAYING");
    setGameEnded(false);
    setTimeLeft(90);
    setMessages([]);
    setUserGuess(null);
    setShowResult(false);
    setPartnerType(null);
    setBackgroundTimeout(15);
    lastMessageId.current = null;

    // Register in waiting queue
    try {
      await fetch("/api/chat-broker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: newSessionId, action: "register_waiting" }),
      });

      // Start checking if a volunteer has joined
      decisionCheckInterval.current = setInterval(checkVolunteerStatus, 500);

    } catch (error) {
      console.error("Failed to register:", error);
    }
  };

  // Check volunteer status
  const checkVolunteerStatus = async () => {
    const currentSessionId = sessionIdRef.current;
    if (!currentSessionId) return;

    try {
      const response = await fetch(`/api/chat-broker?sessionId=${currentSessionId}&lastId=${lastMessageId.current || ""}`);
      const data = await response.json();

      if (data.decision === "chat") {
        setPartnerType("human");
        if (decisionCheckInterval.current) clearInterval(decisionCheckInterval.current);
        pollInterval.current = setInterval(pollMessages, 500);
      }
      else if (data.decision === "ai") {
        connectToAI();
      }
    } catch (error) {
      console.error("Status check error:", error);
    }
  };

  // Connect to AI
  const connectToAI = () => {
    setPartnerType("ai");
    if (decisionCheckInterval.current) clearInterval(decisionCheckInterval.current);
    setTimeout(() => {
      sendBotMessage("Start the conversation with a casual hinglish greeting or question.");
    }, 1000);
  };

  // Background timeout
  useEffect(() => {
    if (gameState !== "PLAYING" || gameEnded || partnerType) return;

    const timer = setInterval(() => {
      setBackgroundTimeout((prev) => {
        if (prev <= 1) {
          connectToAI();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState, gameEnded, partnerType]);

  // Game timer
  useEffect(() => {
    if (gameState !== "PLAYING" || gameEnded || !partnerType) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setGameEnded(true);
          clearInterval(timer);
          if (pollInterval.current) clearInterval(pollInterval.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(timer);
      if (pollInterval.current) clearInterval(pollInterval.current);
    };
  }, [gameState, gameEnded, partnerType]);

  // Poll messages
  const pollMessages = async () => {
    const currentSessionId = sessionIdRef.current;
    if (!currentSessionId) return;

    try {
      const response = await fetch(`/api/chat-broker?sessionId=${currentSessionId}&lastId=${lastMessageId.current || ""}`);
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

  // Send to AI
  const sendBotMessage = async (userMessage?: string) => {
    try {
      const messagesToSend = userMessage
        ? [...messages, { sender: "me" as const, text: userMessage }]
        : messages;

      const response = await fetch("/api/gemini-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: messagesToSend }),
      });

      const data = await response.json();

      if (data.reply) {
        const baseDelay = 500 + Math.random() * 500;
        const typingDelay = data.reply.length * (10 + Math.random() * 20);
        const totalDelay = Math.min(baseDelay + typingDelay, 3000);

        setTimeout(() => {
          setMessages((prev) => [
            ...prev,
            { sender: "partner", text: data.reply },
          ]);
          setIsWaitingForReply(false);
        }, totalDelay);
      }
    } catch (error) {
      console.error("Failed to get bot response:", error);
      setIsWaitingForReply(false);
    }
  };

  // Send to Volunteer
  const sendVolunteerMessage = async (text: string) => {
    const currentSessionId = sessionIdRef.current;
    if (!currentSessionId) return;

    try {
      await fetch("/api/chat-broker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: currentSessionId,
          message: text,
          sender: "player",
        }),
      });
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  // Handle Send
  const handleSend = async () => {
    if (!inputText.trim() || gameState !== "PLAYING" || gameEnded) return;

    const messageText = inputText.trim();
    const newMessage: Message = { sender: "me", text: messageText };
    setMessages((prev) => [...prev, newMessage]);
    setInputText("");
    setIsWaitingForReply(true);

    if (partnerType === "ai") {
      await sendBotMessage(messageText);
    } else {
      await sendVolunteerMessage(messageText);
    }
  };

  // Submit Guess & Award Points
  const submitGuess = async (guess: PartnerType) => {
    if (!playerData || !uid) return;

    setUserGuess(guess);
    const correct = guess === partnerType;
    setLoading(true);

    try {
      if (correct) {
        // AWARD 30 GEMS
        const { error: updateError } = await supabase
          .from('players')
          .update({ stonks: playerData.stonks + 30 })
          .eq('uid', uid);

        if (updateError) throw updateError;

        await supabase.from('game_logs').insert({
          player_uid: uid,
          game_title: 'Humanish',
          result: 'WIN',
          stonks_change: 30
        });

        // Update local
        setPlayerData(prev => prev ? ({ ...prev, stonks: prev.stonks + 30 }) : null);
      } else {
        // LOG LOSS
        await supabase.from('game_logs').insert({
          player_uid: uid,
          game_title: 'Humanish',
          result: 'LOSS',
          stonks_change: 0
        });
      }
    } catch (err) {
      console.error("Scoring error:", err);
    } finally {
      setLoading(false);
      setShowResult(true);
      setGameState("RESULT");
    }
  };

  const isCorrect = userGuess === partnerType;

  // --- RENDER ---

  const renderAuth = () => (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <div className="bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-8 max-w-md w-full">
        <h2 className="text-3xl font-bold mb-6 text-center">LOGIN</h2>

        {!playerData ? (
          <form onSubmit={checkPlayer} className="space-y-4">
            <div>
              <label className="block font-bold text-sm mb-1">ENTER YOUR ID</label>
              <input
                type="text"
                value={uid}
                onChange={(e) => setUid(e.target.value)}
                className="w-full p-3 border-2 border-black focus:ring-2 focus:ring-pink-400 focus:outline-none"
                placeholder="Unique ID..."
              />
            </div>
            {authError && <p className="text-red-500 font-bold text-sm">{authError}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-black text-white font-bold py-3 hover:bg-gray-800 disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin mx-auto" /> : "CONNECT"}
            </button>
          </form>
        ) : (
          <div className="text-center space-y-6">
            <div className="bg-gray-100 p-4 border-2 border-black">
              <p className="text-gray-500 text-sm font-bold uppercase">Welcome back</p>
              <p className="text-2xl font-black">{playerData.name || "Unknown Player"}</p>
              <div className="flex items-center justify-center gap-2 mt-2 font-bold text-xl text-green-600">
                <Coins size={24} />
                {playerData.stonks}
              </div>
            </div>

            <div className="space-y-3">
              <p className="font-bold text-sm">ENTRY FEE: <span className="text-red-500">20 GEMS</span></p>
              <p className="font-bold text-sm">REWARD: <span className="text-green-600">30 GEMS</span></p>
            </div>

            <button
              onClick={startGame}
              disabled={loading || playerData.stonks < 20}
              className="w-full bg-pink-400 hover:bg-pink-500 text-black font-bold py-4 text-xl border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="animate-spin mx-auto" /> : "PAY & PLAY"}
            </button>

            {authError && <p className="text-red-500 font-bold text-sm">{authError}</p>}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="h-screen overflow-auto bg-gradient-to-br from-pink-100 to-cyan-100 p-4 font-mono">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold mb-2 text-black drop-shadow-[3px_3px_0px_rgba(0,0,0,0.3)]">
            HUMANISH
          </h1>
          <p className="text-lg text-gray-700 mb-4">
            Chat for 90 seconds. Guess: Human or AI?
          </p>

          {playerData && gameState !== 'AUTH' && (
            <div className="inline-flex items-center gap-4 bg-white px-4 py-2 border-2 border-black rounded-full shadow-md">
              <span className="font-bold">{playerData.name}</span>
              <span className="w-px h-4 bg-gray-300" />
              <span className="flex items-center gap-1 font-bold text-green-600">
                <Coins size={16} /> {playerData.stonks}
              </span>
            </div>
          )}
        </div>

        {gameState === 'AUTH' && renderAuth()}

        {gameState === 'PLAYING' && (
          <>
            {/* Timer logic handles transition to gameEnded, but we still show UI */}
            {/* Timer */}
            <div className="bg-cyan-400 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4 mb-4">
              <div className="flex justify-between items-center">
                <span className="text-xl font-bold">TIME LEFT:</span>
                <span className={`text-3xl font-bold ${timeLeft <= 10 ? "text-red-600 animate-pulse" : ""}`}>
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
                  <div key={idx} className={`flex ${msg.sender === "me" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[70%] p-3 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${msg.sender === "me" ? "bg-pink-300" : "bg-cyan-200"}`}>
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
                  disabled={isWaitingForReply || gameEnded}
                />
                <button
                  onClick={handleSend}
                  disabled={!inputText.trim() || isWaitingForReply || gameEnded}
                  className="bg-cyan-400 hover:bg-cyan-500 disabled:bg-gray-300 text-black font-bold py-3 px-6 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] transition-all disabled:cursor-not-allowed"
                >
                  SEND
                </button>
              </div>
            </div>

            {/* Guess Section */}
            {gameEnded && !showResult && (
              <div className="bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 text-center animate-in fade-in slide-in-from-bottom-4">
                <h2 className="text-2xl font-bold mb-4">TIME'S UP!</h2>
                <p className="mb-6 text-gray-700">
                  Was your chat partner a human or an AI?
                </p>
                <div className="flex gap-4 justify-center">
                  <button
                    onClick={() => submitGuess("human")}
                    disabled={loading}
                    className="bg-pink-400 hover:bg-pink-500 text-black font-bold py-4 px-8 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="animate-spin" /> : "👤 HUMAN"}
                  </button>
                  <button
                    onClick={() => submitGuess("ai")}
                    disabled={loading}
                    className="bg-cyan-400 hover:bg-cyan-500 text-black font-bold py-4 px-8 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="animate-spin" /> : "🤖 AI"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {gameState === 'RESULT' && (
          <div className={`border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 text-center ${isCorrect ? "bg-green-300" : "bg-red-300"}`}>
            <h2 className="text-4xl font-black mb-2">
              {isCorrect ? "🎉 CORRECT!" : "❌ WRONG!"}
            </h2>
            <p className="text-xl mb-6 font-bold">
              It was {partnerType === "ai" ? "an AI" : "a human"}!
            </p>

            <div className="inline-block bg-white px-6 py-3 border-2 border-black rounded-lg shadow-sm mb-8">
              <p className="text-sm font-bold text-gray-500 uppercase">Winnings</p>
              <p className={`text-2xl font-black ${isCorrect ? "text-green-600" : "text-gray-400"}`}>
                {isCorrect ? "+30 GEMS" : "0 GEMS"}
              </p>
            </div>

            <div>
              <button
                onClick={startGame}
                disabled={loading}
                className="bg-white hover:bg-gray-100 text-black font-bold py-3 px-8 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
              >
                PLAY AGAIN
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
