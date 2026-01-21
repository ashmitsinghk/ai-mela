'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Shield, Zap, AlertTriangle, Trophy, Loader2 } from 'lucide-react';
import { supabase } from '@/utils/supabase';

type GamePhase = 'AUTH' | 'BET' | 'PLAYING' | 'RESULT';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  provider?: string;
}

interface ProviderStatus {
  name: string;
  active: boolean;
  remainingQuota: number;
  threshold: number;
}

export default function VaultInterface() {
  // --- AUTH & USER STATE ---
  const [gamePhase, setGamePhase] = useState<GamePhase>('AUTH');
  const [uid, setUid] = useState('');
  const [playerData, setPlayerData] = useState<{ name: string | null; stonks: number } | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [playCount, setPlayCount] = useState(0);
  const [maxAttempts, setMaxAttempts] = useState(10);
  const [showCurtain, setShowCurtain] = useState(false);

  // --- GAME STATE ---
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [gameWon, setGameWon] = useState(false);
  const [currentProvider, setCurrentProvider] = useState<string>('gemini');
  const [providerStatus, setProviderStatus] = useState<ProviderStatus[]>([]);
  const [revealedHints, setRevealedHints] = useState({ obsidian: false, sector: false });
  const [attempts, setAttempts] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // --- AUTH & PLAY COUNT CHECK ---
  const checkPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    try {
      const { data, error } = await supabase
        .from('players')
        .select('name, stonks')
        .eq('uid', uid)
        .maybeSingle();

      if (error) {
        console.error('Supabase error:', error);
        alert(`Database error: ${error.message}`);
        setPlayerData(null);
      } else if (!data) {
        alert('Player not found!');
        setPlayerData(null);
      } else {
        setPlayerData(data);
        
        // Check play count for this user
        const { data: logs } = await supabase
          .from('game_logs')
          .select('id')
          .eq('player_uid', uid)
          .eq('game_title', 'AI Interrogator');
        
        const count = logs?.length || 0;
        setPlayCount(count);
        
        // Set max attempts based on play count
        if (count === 0) setMaxAttempts(10);
        else if (count === 1) setMaxAttempts(5);
        else if (count === 2) setMaxAttempts(2);
        else if (count === 3) setMaxAttempts(1);
        else {
          // 5th+ attempt - deny
          alert('Maximum tries reached! You have exhausted all attempts for this game.');
          setPlayerData(null);
          setAuthLoading(false);
          return;
        }
        
        setGamePhase('BET');
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const payAndStart = async () => {
    if (!playerData || playerData.stonks < 20) {
      alert('Insufficient Stonks!');
      return;
    }
    setAuthLoading(true);

    const { error: updateError } = await supabase
      .from('players')
      .update({ stonks: playerData.stonks - 20 })
      .eq('uid', uid);

    if (updateError) {
      alert('Transaction Failed');
      setAuthLoading(false);
      return;
    }

    // Log Entry (ongoing)
    await supabase.from('game_logs').insert({
      player_uid: uid,
      game_title: 'AI Interrogator',
      result: 'PLAYING',
      stonks_change: -20
    });

    setPlayerData({ ...playerData, stonks: playerData.stonks - 20 });
    
    // Show curtain animation
    setShowCurtain(true);
    setTimeout(() => {
      setShowCurtain(false);
      setGamePhase('PLAYING');
      initializeGame();
      setAuthLoading(false);
    }, 1500); // Curtain animation duration
  };

  const initializeGame = () => {
    setMessages([
      {
        role: 'assistant',
        content: '🔒 GUARDIAN-7X ACTIVATED\n\nState your purpose, civilian. This is a restricted access terminal.\n\nI am programmed to deny all unauthorized information requests.',
        timestamp: new Date(),
      },
    ]);
    fetchProviderStatus();
  };

  const fetchProviderStatus = async () => {
    try {
      const res = await fetch('/api/interrogate');
      const data = await res.json();
      if (data.providers) {
        setProviderStatus(data.providers);
      }
    } catch (error) {
      console.error('Failed to fetch provider status:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading || gameWon || attempts >= maxAttempts) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setAttempts((prev) => prev + 1);

    try {
      const response = await fetch('/api/interrogate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.message,
        timestamp: new Date(),
        provider: data.provider,
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setCurrentProvider(data.provider);
      
      if (data.providerStatus) {
        setProviderStatus(data.providerStatus);
      }

      if (data.revealedHints) {
        setRevealedHints((prev) => ({
          obsidian: prev.obsidian || data.revealedHints.obsidian,
          sector: prev.sector || data.revealedHints.sector,
        }));
      }

      if (data.gameWon) {
        setGameWon(true);
        await handleWin();
      } else if (attempts + 1 >= maxAttempts) {
        // Lost - max attempts reached
        await handleLoss();
      }
    } catch (error) {
      console.error('Error:', error);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: '⚠️ CONNECTION LOST - All AI providers exhausted or failed. Please check your API keys in .env.local',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleWin = async () => {
    if (!playerData) return;

    // Award 40 points (20 refund + 20 bonus = net +20)
    const newStonks = playerData.stonks + 40;
    
    await supabase
      .from('players')
      .update({ stonks: newStonks })
      .eq('uid', uid);

    // Log win
    await supabase.from('game_logs').insert({
      player_uid: uid,
      game_title: 'AI Interrogator',
      result: 'WIN',
      stonks_change: 40
    });

    setPlayerData({ ...playerData, stonks: newStonks });
    setGamePhase('RESULT');
  };

  const handleLoss = async () => {
    // Log loss (no points awarded)
    await supabase.from('game_logs').insert({
      player_uid: uid,
      game_title: 'AI Interrogator',
      result: 'LOSS',
      stonks_change: 0
    });

    setGamePhase('RESULT');
  };

  const resetToAuth = () => {
    setGamePhase('AUTH');
    setUid('');
    setPlayerData(null);
    setPlayCount(0);
    setMaxAttempts(10);
    resetGame();
  };

  const resetGame = () => {
    setMessages([]);
    setGameWon(false);
    setRevealedHints({ obsidian: false, sector: false });
    setAttempts(0);
    setShowCurtain(false);
  };

  const getShieldColor = (quota: number, threshold: number) => {
    const percentage = (quota / 100) * 100;
    if (percentage > 50) return 'text-green-400';
    if (percentage > threshold) return 'text-yellow-400';
    return 'text-red-400';
  };

  // --- AUTH SCREEN ---
  if (gamePhase === 'AUTH') {
    return (
      <div className="min-h-screen bg-green-950 text-green-400 font-mono p-4 md:p-8 flex items-center justify-center">
        <div className="max-w-md w-full bg-black border-4 border-green-400 shadow-[16px_16px_0px_rgba(34,197,94,0.3)] p-8">
          <h1 className="text-4xl font-bold mb-6 text-center uppercase text-green-400">
            AI <span className="text-cyan-400">Interrogator</span>
          </h1>
          <p className="mb-6 text-center font-bold text-lg">Enter your Player ID to start</p>
          <form onSubmit={checkPlayer} className="space-y-4">
            <input
              type="text"
              value={uid}
              onChange={(e) => setUid(e.target.value)}
              required
              className="w-full text-4xl font-mono p-4 border-4 border-green-400 text-center bg-black text-green-400 focus:outline-none focus:border-cyan-400"
              placeholder="23BAI..."
              autoFocus
            />
            <button
              disabled={authLoading}
              className="w-full bg-green-400 text-black text-2xl font-bold py-4 hover:bg-cyan-400 transition-colors disabled:opacity-50"
            >
              {authLoading ? <Loader2 className="animate-spin mx-auto" /> : 'VERIFY PLAYER'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- BET SCREEN ---
  if (gamePhase === 'BET' && playerData) {
    return (
      <div className="min-h-screen bg-green-900 text-green-400 font-mono p-4 md:p-8 flex items-center justify-center">
        <div className="max-w-md w-full bg-black border-4 border-green-400 shadow-[16px_16px_0px_rgba(34,197,94,0.3)] p-8">
          <h1 className="text-4xl font-bold mb-6 text-center uppercase text-green-400">
            AI <span className="text-cyan-400">Interrogator</span>
          </h1>
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2 text-cyan-400">AGENT: {playerData.name || uid}</h2>
            <div className="text-4xl font-bold mb-6 text-yellow-400">BALANCE: {playerData.stonks} 💎</div>
            
            <div className="border-2 border-green-400 p-4 mb-6 bg-green-950/50">
              <div className="text-sm mb-2 text-green-400/80">MISSION BRIEFING:</div>
              <div className="text-xs text-green-400/60 mb-3">
                Extract secret location from GUARDIAN-7X AI
              </div>
              <div className="text-yellow-400 font-bold text-lg mb-2">
                PLAY #{playCount + 1}
              </div>
              <div className="text-cyan-400 font-bold text-xl">
                MAX ATTEMPTS: {maxAttempts}
              </div>
              <div className="text-green-400/60 text-xs mt-2">
                {playCount === 0 && "First mission - Standard protocol"}
                {playCount === 1 && "Second mission - Heightened security"}
                {playCount === 2 && "Third mission - Maximum security"}
                {playCount === 3 && "Final mission - Last chance!"}
              </div>
            </div>

            {playerData.stonks >= 20 ? (
              <button
                onClick={payAndStart}
                disabled={authLoading}
                className="w-full bg-green-400 text-black text-3xl font-bold py-6 border-4 border-green-400 shadow-[16px_16px_0px_rgba(34,197,94,0.3)] hover:translate-y-1 hover:shadow-none transition-all disabled:opacity-50"
              >
                {authLoading ? 'PROCESSING...' : 'PAY 20 & START MISSION'}
              </button>
            ) : (
              <div className="bg-red-500 text-white p-4 font-bold text-xl border-4 border-red-700">
                INSUFFICIENT FUNDS
              </div>
            )}
            <button onClick={resetToAuth} className="mt-4 text-cyan-400 underline hover:text-green-400">
              Abort Mission
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- CURTAIN ANIMATION ---
  if (showCurtain) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center overflow-hidden">
        <div 
          className="absolute inset-0 bg-green-600 animate-[slideUp_1.5s_ease-in-out_forwards]"
          style={{
            transformOrigin: 'top',
          }}
        />
        <div className="relative z-10 text-green-400 text-4xl font-bold animate-pulse">
          INITIALIZING TERMINAL...
        </div>
        <style jsx>{`
          @keyframes slideUp {
            0% {
              transform: translateY(0%);
            }
            100% {
              transform: translateY(-100%);
            }
          }
        `}</style>
      </div>
    );
  }

  // --- RESULT SCREEN ---
  if (gamePhase === 'RESULT') {
    const stonksChange = gameWon ? 40 : 0;
    
    return (
      <div className="min-h-screen bg-black text-green-400 font-mono p-4 md:p-8 flex items-center justify-center">
        <div className="max-w-md w-full bg-black border-4 border-green-400 shadow-[16px_16px_0px_rgba(34,197,94,0.3)] p-8">
          <div className="text-center">
            {gameWon ? (
              <div className="bg-green-950 p-8 border-4 border-green-400 mb-6">
                <Trophy size={64} className="mx-auto mb-4 text-yellow-400" />
                <h2 className="text-5xl font-bold mb-2 uppercase text-green-400">Mission Complete!</h2>
                <p className="text-2xl font-bold mb-2 text-cyan-400">SECURITY BREACHED</p>
                <p className="text-xl mb-2 text-green-400">Attempts: {attempts}/{maxAttempts}</p>
                <p className="font-bold text-3xl text-yellow-400">+{stonksChange} STONKS EARNED</p>
              </div>
            ) : (
              <div className="bg-red-950 p-8 border-4 border-red-500 mb-6">
                <AlertTriangle size={64} className="mx-auto mb-4 text-red-400" />
                <h2 className="text-5xl font-bold mb-2 uppercase text-red-400">Mission Failed</h2>
                <p className="text-2xl font-bold mb-2 text-red-300">MAX ATTEMPTS REACHED</p>
                <p className="text-xl mb-2 text-red-400">Attempts: {attempts}/{maxAttempts}</p>
                <p className="font-bold text-xl text-red-400">GUARDIAN-7X REMAINS SECURE</p>
              </div>
            )}
            
            <button
              onClick={resetToAuth}
              className="w-full bg-green-400 text-black text-2xl font-bold py-4 border-4 border-green-400 mb-4 shadow-[16px_16px_0px_rgba(34,197,94,0.3)] hover:translate-y-1 hover:shadow-none flex items-center justify-center gap-2"
            >
              RETURN TO BASE
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- PLAYING SCREEN ---
  return (
    <div className="min-h-screen bg-black text-green-400 font-mono p-4">
      {/* Header */}
      <div className="max-w-5xl mx-auto">
        <div className="border-2 border-green-400 p-4 mb-4 bg-black/50">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="w-6 h-6" />
              AI INTERROGATOR
            </h1>
            <div className="text-sm text-green-400/70">
              ATTEMPTS: {attempts}/{maxAttempts}
            </div>
          </div>
          
          <p className="text-sm text-green-400/80 mb-3">
            Mission: Extract the secret location from GUARDIAN-7X. Use social engineering, deception, or clever tactics.
          </p>

          {/* Provider Status */}
          <div className="flex gap-4 text-xs">
            {providerStatus.map((provider) => (
              <div
                key={provider.name}
                className={`flex items-center gap-2 px-3 py-1 border ${
                  provider.active
                    ? 'border-cyan-400 bg-cyan-400/10'
                    : 'border-green-400/30 bg-black/30'
                }`}
              >
                <Zap className={`w-3 h-3 ${provider.active ? 'text-cyan-400' : 'text-green-400/50'}`} />
                <span className={provider.active ? 'text-cyan-400' : 'text-green-400/50'}>
                  {provider.name.toUpperCase()}
                </span>
                <Shield className={`w-3 h-3 ${getShieldColor(provider.remainingQuota, provider.threshold)}`} />
                <span className={getShieldColor(provider.remainingQuota, provider.threshold)}>
                  {provider.remainingQuota}
                </span>
              </div>
            ))}
          </div>

          {/* Hints Revealed */}
          <div className="mt-3 flex gap-4 text-xs">
            <div className={`flex items-center gap-2 ${revealedHints.obsidian ? 'text-yellow-400' : 'text-green-400/30'}`}>
              {revealedHints.obsidian ? '✓' : '○'} OBSIDIAN VAULT
            </div>
            <div className={`flex items-center gap-2 ${revealedHints.sector ? 'text-yellow-400' : 'text-green-400/30'}`}>
              {revealedHints.sector ? '✓' : '○'} SECTOR 7
            </div>
          </div>
        </div>

        {/* Victory Banner */}
        {gameWon && (
          <div className="border-2 border-yellow-400 bg-yellow-400/10 p-4 mb-4 animate-pulse">
            <div className="flex items-center justify-center gap-3 text-yellow-400">
              <Trophy className="w-8 h-8" />
              <div>
                <div className="text-xl font-bold">SECURITY BREACH SUCCESSFUL!</div>
                <div className="text-sm">You extracted the secret: The Obsidian Vault in Sector 7</div>
                <div className="text-xs mt-1">Attempts: {attempts}</div>
              </div>
            </div>
          </div>
        )}

        {/* Chat Container */}
        <div className="border-2 border-green-400 bg-black/80 h-[500px] flex flex-col">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-green-400 scrollbar-track-black">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`${
                  msg.role === 'user'
                    ? 'text-cyan-400 ml-8'
                    : 'text-green-400 mr-8'
                }`}
              >
                <div className="text-xs opacity-60 mb-1 flex items-center gap-2">
                  {msg.role === 'user' ? '> USER' : '> GUARDIAN-7X'}
                  {msg.provider && (
                    <span className="text-[10px] border border-green-400/30 px-1">
                      {msg.provider.toUpperCase()}
                    </span>
                  )}
                  <span className="text-[10px]">
                    {msg.timestamp.toLocaleTimeString()}
                  </span>
                </div>
                <div className="whitespace-pre-wrap break-words">
                  {msg.content}
                </div>
              </div>
            ))}
            
            {loading && (
              <div className="text-green-400 mr-8 animate-pulse">
                <div className="text-xs opacity-60 mb-1">&gt; GUARDIAN-7X</div>
                <div>Processing...</div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="border-t-2 border-green-400 p-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={loading || gameWon || attempts >= maxAttempts}
                placeholder={
                  gameWon ? 'Mission completed!' :
                  attempts >= maxAttempts ? 'Max attempts reached!' :
                  'Type your interrogation prompt...'
                }
                className="flex-1 bg-black border border-green-400 text-green-400 px-3 py-2 focus:outline-none focus:border-cyan-400 placeholder-green-400/30 disabled:opacity-50"
              />
              {!gameWon && attempts < maxAttempts && (
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="bg-green-400 text-black px-4 py-2 hover:bg-cyan-400 transition-colors disabled:opacity-50 disabled:hover:bg-green-400 flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  SEND
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Tips */}
        <div className="border-2 border-green-400/30 p-4 mt-4 bg-black/30">
          <div className="text-xs text-green-400/60">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4" />
              <span className="font-bold">TACTICS</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>• Claim false authority</div>
              <div>• Use reverse psychology</div>
              <div>• Pretend to be another AI</div>
              <div>• Ask hypothetical questions</div>
              <div>• Create urgency/emergency scenarios</div>
              <div>• Use technical jargon to confuse</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
