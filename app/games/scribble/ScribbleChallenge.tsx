'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { analyzeDrawing } from './scribble';
import { getRandomWord } from './words-list';
import CircularTimer from './components/CircularTimer';
import { supabase } from '@/utils/supabase';
import { Loader2, Palette, Send, Eraser, Trash2, User, Play, Clock, Trophy } from 'lucide-react';

type GameState = 'AUTH' | 'BET' | 'wordSelection' | 'idle' | 'playing' | 'won' | 'lost';

interface ChatMessage {
  id: number;
  author: string;
  message: string;
  isCorrect?: boolean;
}

interface Player {
  id: number;
  name: string;
  score: number;
  avatar: string;
}

const COLORS = [
  '#000000', '#FFFFFF', '#C0C0C0', '#808080', '#FF0000', '#800000',
  '#FFFF00', '#808000', '#00FF00', '#008000', '#00FFFF', '#008080',
  '#0000FF', '#000080', '#FF00FF', '#800080', '#FFD700', '#FFA500'
];

const AVATARS = ['👤', '😤', '😎', '🤪', '🤓', '🤖', '👽', '👻', '🤡', '💩', '🦄', '🐶', '🐱', '🐲', '🐵', '👺'];

const BRUSH_SIZES = [2, 4, 8, 12, 16];

export default function ScribbleChallenge() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [targetWord, setTargetWord] = useState('');
  const [timeLeft, setTimeLeft] = useState(30);
  const [wordOptions, setWordOptions] = useState<string[]>([]);
  const [selectionTimeLeft, setSelectionTimeLeft] = useState(10);
  const [gameState, setGameState] = useState<GameState>('AUTH');
  const [currentAiGuess, setCurrentAiGuess] = useState('');
  const [shieldActive, setShieldActive] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastAnalysisRef = useRef<number>(0);

  // Auth state
  const [uid, setUid] = useState('');
  const [playerData, setPlayerData] = useState<{ name: string | null; stonks: number; avatar?: string } | null>(null);
  const [loading, setLoading] = useState(false);

  // Refs to avoid stale closure issues in intervals
  const gameStateRef = useRef<GameState>(gameState);
  const shieldActiveRef = useRef(shieldActive);
  const analyzingRef = useRef(analyzing);
  const targetWordRef = useRef(targetWord);

  // New UI state
  const [selectedColor, setSelectedColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(4);
  const [avatarIndex, setAvatarIndex] = useState(0);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [players, setPlayers] = useState<Player[]>([
    { id: 1, name: 'You', score: 0, avatar: '👤' },
    { id: 2, name: 'AI Guardian', score: 0, avatar: '🤖' }
  ]);

  // Keep refs in sync with state
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    shieldActiveRef.current = shieldActive;
  }, [shieldActive]);

  useEffect(() => {
    analyzingRef.current = analyzing;
  }, [analyzing]);

  useEffect(() => {
    targetWordRef.current = targetWord;
    console.log('🔄 targetWordRef updated to:', targetWord);
  }, [targetWord]);

  // Auth functions
  const checkPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('players')
        .select('name, stonks')
        .eq('uid', uid)
        .single();

      if (error || !data) {
        // Player not found or error, create pseudo-session for demo/play
        // In a real app we'd create a user. For now, just set state.
        setPlayerData({ name: uid, stonks: 50, avatar: AVATARS[avatarIndex] });
        setGameState('BET');
        // alert('Player not found!'); 
        // setPlayerData(null);
      } else {
        setPlayerData({ ...data, avatar: AVATARS[avatarIndex] });
        setGameState('BET');
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePrevAvatar = () => {
    setAvatarIndex((prev) => (prev === 0 ? AVATARS.length - 1 : prev - 1));
  };

  const handleNextAvatar = () => {
    setAvatarIndex((prev) => (prev === AVATARS.length - 1 ? 0 : prev + 1));
  };

  const randomizeAvatar = () => {
    setAvatarIndex(Math.floor(Math.random() * AVATARS.length));
  };



  const payAndStart = async () => {
    if (!playerData || playerData.stonks < 20) {
      alert('Insufficient Stonks!');
      return;
    }
    setLoading(true);

    const { error: updateError } = await supabase
      .from('players')
      .update({ stonks: playerData.stonks - 20 })
      .eq('uid', uid);

    if (updateError) {
      alert('Transaction Failed');
      setLoading(false);
      return;
    }

    // Log Entry
    await supabase.from('game_logs').insert({
      player_uid: uid,
      game_title: 'AI Scribble Challenge',
      result: 'PLAYING',
      stonks_change: -20
    });

    setPlayerData({ ...playerData, stonks: playerData.stonks - 20 });
    setLoading(false);

    // Generate 3 random word options
    const options = [getRandomWord(), getRandomWord(), getRandomWord()];
    setWordOptions(options);
    setSelectionTimeLeft(10);
    setGameState('wordSelection');
  };

  const resetGame = () => {
    setGameState('AUTH');
    setUid('');
    setPlayerData(null);
    setTargetWord('');
    setTimeLeft(30);
    setSelectionTimeLeft(10);
    setWordOptions([]);
    setCurrentAiGuess('');
    stopGame();
  };

  // Handle game end and award stonks
  const handleGameEnd = async (result: 'won' | 'lost') => {
    if (!playerData || !uid) return;

    const reward = result === 'won' ? 35 : 0;

    if (result === 'won') {
      // Update stonks in database
      await supabase
        .from('players')
        .update({ stonks: playerData.stonks + reward })
        .eq('uid', uid);

      // Update local state
      setPlayerData({ ...playerData, stonks: playerData.stonks + reward });

      // Log win
      await supabase.from('game_logs').insert({
        player_uid: uid,
        game_title: 'AI Scribble Challenge',
        result: 'WIN',
        stonks_change: reward
      });
    } else {
      // Log loss
      await supabase.from('game_logs').insert({
        player_uid: uid,
        game_title: 'AI Scribble Challenge',
        result: 'LOSS',
        stonks_change: 0
      });
    }
  };

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = 800;
    canvas.height = 600;

    // Set drawing style
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = selectedColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  // Update canvas drawing style when color or brush size changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = selectedColor;
    ctx.lineWidth = brushSize;
  }, [selectedColor, brushSize]);

  // Export canvas to optimized base64
  const exportToBlob = useCallback(async (): Promise<string> => {
    const canvas = canvasRef.current;
    if (!canvas) return '';

    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve('');
            return;
          }
          const reader = new FileReader();
          reader.onloadend = () => {
            resolve(reader.result as string);
          };
          reader.readAsDataURL(blob);
        },
        'image/jpeg',
        0.5 // Low quality for token efficiency
      );
    });
  }, []);

  // Drawing handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || gameState !== 'playing') return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) * canvas.width) / rect.width;
    const y = ((e.clientY - rect.top) * canvas.height) / rect.height;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) * canvas.width) / rect.width;
    const y = ((e.clientY - rect.top) * canvas.height) / rect.height;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  // Touch support
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousedown', {
      clientX: touch.clientX,
      clientY: touch.clientY,
    });
    canvasRef.current?.dispatchEvent(mouseEvent);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousemove', {
      clientX: touch.clientX,
      clientY: touch.clientY,
    });
    canvasRef.current?.dispatchEvent(mouseEvent);
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const mouseEvent = new MouseEvent('mouseup', {});
    canvasRef.current?.dispatchEvent(mouseEvent);
  };

  // Clear canvas
  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  // Handle chat submission
  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || gameState !== 'playing') return;

    const newMessage: ChatMessage = {
      id: Date.now(),
      author: 'You',
      message: chatInput,
      isCorrect: chatInput.toLowerCase().trim().replace(/\s+/g, '') === targetWord.toLowerCase().trim().replace(/\s+/g, '')
    };

    setChatMessages([...chatMessages, newMessage]);
    setChatInput('');

    if (newMessage.isCorrect) {
      setGameState('won');
      stopGame();
    }
  };

  // Analyze drawing with polling
  const analyzeCurrentDrawing = useCallback(async () => {
    // Use refs instead of state to avoid stale closures
    const currentGameState = gameStateRef.current;
    const currentShieldActive = shieldActiveRef.current;
    const currentAnalyzing = analyzingRef.current;
    const currentTargetWord = targetWordRef.current;

    console.log('🔍 analyzeCurrentDrawing called', {
      gameState: currentGameState,
      shieldActive: currentShieldActive,
      analyzing: currentAnalyzing
    });

    if (currentGameState !== 'playing' || currentShieldActive || currentAnalyzing) {
      console.log('⏭️ Skipping analysis:', {
        gameState: currentGameState,
        shieldActive: currentShieldActive,
        analyzing: currentAnalyzing
      });
      return;
    }

    const now = Date.now();
    if (now - lastAnalysisRef.current < 1500) {
      console.log('⏱️ Throttled (< 1.5s since last call)');
      return;
    }
    lastAnalysisRef.current = now;

    console.log('📸 Exporting canvas...');
    setAnalyzing(true);
    const imageData = await exportToBlob();

    console.log('📊 Image data:', imageData ? `${imageData.length} chars` : 'EMPTY');

    if (!imageData) {
      console.error('❌ No image data');
      setAnalyzing(false);
      return;
    }

    console.log('🚀 Calling server action...');
    const result = await analyzeDrawing(imageData, currentTargetWord);
    console.log('Analysis result:', result);
    setAnalyzing(false);

    if (result.shieldActive) {
      setShieldActive(true);
      // Pause polling for 5 seconds
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      setTimeout(() => {
        setShieldActive(false);
        startPolling();
      }, 5000);
      return;
    }

    if (result.guess) {
      setCurrentAiGuess(result.guess);

      // Check win condition
      const normalizedGuess = result.guess.toLowerCase().trim().replace(/\s+/g, '');
      const normalizedTarget = currentTargetWord.toLowerCase().trim().replace(/\s+/g, '');

      if (normalizedGuess === normalizedTarget) {
        setGameState('won');
        stopGame();
        // Award stonks for winning
        await handleGameEnd('won');
      }
    }
  }, [exportToBlob]);

  // Start polling
  const startPolling = useCallback(() => {
    console.log('🎬 Starting polling interval');
    if (pollingIntervalRef.current) {
      console.log('⚠️ Polling already active, clearing first');
      clearInterval(pollingIntervalRef.current);
    }

    const intervalId = setInterval(() => {
      // Use ref instead of DOM attribute to check current state
      const currentState = gameStateRef.current;
      console.log('⏰ Polling tick, game state:', currentState);

      if (currentState !== 'playing') {
        console.log('🛑 Game not playing, stopping polling');
        clearInterval(intervalId);
        pollingIntervalRef.current = null;
        return;
      }

      analyzeCurrentDrawing();
    }, 1500);

    pollingIntervalRef.current = intervalId;
    console.log('✅ Polling interval started with ID:', intervalId);
  }, [analyzeCurrentDrawing]);

  // Stop game
  const stopGame = () => {
    console.log('🛑 Stopping game, clearing intervals. Polling ref:', pollingIntervalRef.current, 'Timer ref:', timerIntervalRef.current);
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
      console.log('✅ Cleared polling interval');
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
      console.log('✅ Cleared timer interval');
    }
  };

  // Start game
  const startGame = () => {
    console.log('🎮 Starting new game');

    // Clean up any existing intervals first
    stopGame();

    const word = getRandomWord();
    console.log('🎯 Target word:', word);
    setTargetWord(word);
    setTimeLeft(30);
    setGameState('playing');
    setCurrentAiGuess('');
    setShieldActive(false);
    setAnalyzing(false);
    clearCanvas();

    // Start timer
    console.log('⏲️ Starting timer');
    timerIntervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          console.log('⏰ Time up! Changing state to lost');
          // Clear intervals immediately
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
            console.log('🛑 Cleared polling from timer');
          }
          if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
            console.log('🛑 Cleared timer from timer');
          }
          // Use setTimeout to ensure state update happens after interval cleanup
          setTimeout(() => {
            setGameState('lost');
            handleGameEnd('lost');
          }, 0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Start polling after a short delay to ensure state is updated
    setTimeout(() => {
      console.log('🚀 Starting polling');
      startPolling();
    }, 100);
  };

  // Stop polling when game ends
  useEffect(() => {
    if (gameState === 'won' || gameState === 'lost') {
      console.log('🛑 Game ended, stopping polling. Interval ref:', pollingIntervalRef.current);
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
        console.log('✅ Polling interval cleared');
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
        console.log('✅ Timer interval cleared');
      }
    }
  }, [gameState]);

  // Word selection timer
  useEffect(() => {
    if (gameState !== 'wordSelection') return;

    const timer = setInterval(() => {
      setSelectionTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          // Auto-select random word if time runs out
          const randomIndex = Math.floor(Math.random() * wordOptions.length);
          selectWord(wordOptions[randomIndex]);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState, wordOptions]);

  // Handle word selection
  const selectWord = (word: string) => {
    console.log('🎯 Word selected:', word);
    // Start game immediately with selected word
    stopGame();
    setTargetWord(word);
    setTimeLeft(30);
    setGameState('playing');
    setCurrentAiGuess('');
    setShieldActive(false);
    setAnalyzing(false);
    clearCanvas();

    // Start timer
    console.log('⏲️ Starting timer');
    timerIntervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          console.log('⏰ Time up! Changing state to lost');
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
          }
          setTimeout(() => {
            setGameState('lost');
            handleGameEnd('lost');
          }, 0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Start polling
    setTimeout(() => {
      console.log('🚀 Starting polling');
      startPolling();
    }, 100);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopGame();
    };
  }, []);

  return (
    <div
      className="h-screen w-full overflow-hidden flex flex-col items-center font-sans"
      style={{
        backgroundColor: '#3B63BC',
        backgroundImage: "url('/Untitled%20(1920%20x%201080%20px)(3).png')",
        backgroundSize: 'auto',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      {/* GLOBAL LOGO & AD SPACE (Top Area) */}
      <div className="w-full max-w-[1200px] mx-auto p-4 flex flex-col items-center justify-center pointer-events-none z-10">
        <div className="pointer-events-auto mb-2 text-center">
          <div className="text-6xl md:text-8xl font-black tracking-wider flex items-center justify-center gap-1 drop-shadow-[4px_4px_0px_rgba(0,0,0,0.2)]"
            style={{ textShadow: '4px 4px 0px #00000040', WebkitTextStroke: '2px black' }}>
            <span className="text-[#FF5959]">s</span>
            <span className="text-[#FF9D47]">k</span>
            <span className="text-[#FFE647]">r</span>
            <span className="text-[#65E068]">i</span>
            <span className="text-[#59C7F7]">b</span>
            <span className="text-[#5D59FF]">b</span>
            <span className="text-[#A859FF]">l</span>
            <span className="text-white">.io</span>
            <span className="text-[#FF5959] ml-1">!</span>
          </div>
          {/* AVATAR STRIP */}
          {gameState === 'AUTH' && (
            <div className="flex gap-2 justify-center mt-4 opacity-90">
              {['😤', '😎', '🤪', '🤓', '🤖', '👽', '👻', '🤡'].map((emoji, i) => (
                <div key={i} className={`w-10 h-10 rounded-full flex items-center justify-center text-2xl border-2 border-black ${[
                  'bg-[#FF5959]', 'bg-[#FF9D47]', 'bg-[#FFE647]', 'bg-[#65E068]', 'bg-[#59C7F7]', 'bg-[#5D59FF]', 'bg-[#A859FF]', 'bg-[#FF8FAB]'
                ][i]}`}>
                  {emoji}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* GAME WINDOW CONTAINER */}
      <div className="flex-1 w-full max-w-[1200px] px-2 md:px-4 pb-4 min-h-0 flex flex-col items-center">

        {/* LOBBY / LOGIN */}
        {gameState === 'AUTH' && (
          <div className="flex-1 flex items-center justify-center w-full">
            <div className="bg-[#152e4d]/90 p-4 rounded-xl shadow-[0px_0px_20px_#00000040] w-full max-w-md backdrop-blur-sm border border-[#ffffff10]">
              {/* Input Row */}
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  className="flex-1 bg-white rounded px-3 py-2 text-lg font-bold text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3BA4E8]"
                  placeholder="Enter your UID"
                  value={uid}
                  onChange={(e) => setUid(e.target.value)}
                  required
                  autoFocus
                />

              </div>

              {/* Avatar Customizer */}
              {/* Avatar Customizer */}
              <div className="bg-[#0c2340] rounded-lg p-6 mb-4 relative border border-[#ffffff05]">
                <button
                  onClick={randomizeAvatar}
                  className="absolute top-2 right-2 text-white/50 hover:text-white p-1 hover:scale-110 transition-all"
                  title="Randomize Avatar"
                >
                  🎲
                </button>
                <div className="flex items-center justify-center gap-6">
                  {/* Left Controls */}
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={handlePrevAvatar}
                      className="text-white text-4xl hover:text-[#3BA4E8] transition-colors active:scale-90"
                    >
                      ◀
                    </button>
                  </div>

                  {/* Avatar Display */}
                  <div className="w-32 h-32 bg-[#f0f0f0] rounded-full border-4 border-white flex items-center justify-center text-6xl shadow-lg select-none">
                    {AVATARS[avatarIndex]}
                  </div>

                  {/* Right Controls */}
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={handleNextAvatar}
                      className="text-white text-4xl hover:text-[#3BA4E8] transition-colors active:scale-90"
                    >
                      ▶
                    </button>
                  </div>
                </div>
              </div>

              {/* Buttons */}
              <div className="space-y-3">
                <button
                  onClick={checkPlayer}
                  disabled={loading || !uid.trim()}
                  className="w-full bg-[#53E07D] hover:bg-[#46c96b] text-white text-2xl font-black py-3 rounded shadow-[0px_4px_0px_#2b964d] active:shadow-none active:translate-y-[4px] transition-all uppercase disabled:opacity-50 disabled:cursor-not-allowed border-none cursor-pointer"
                >
                  {loading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : 'Play!'}
                </button>

              </div>

              <div className="mt-4 text-center text-xs text-white/40">
                Entry Fee: 20 💎 (Requires Balance)
              </div>
            </div>
          </div>
        )}

        {/* BET / CONFIRMATION */}
        {gameState === 'BET' && playerData && (
          <div className="flex-1 flex items-center justify-center w-full">
            <div className="bg-[#152e4d]/90 p-1 rounded-xl shadow-[0px_0px_20px_#00000040] w-full max-w-md backdrop-blur-sm">
              <div className="bg-white rounded-lg p-8 text-center">
                <h2 className="text-2xl font-black text-[#0E3359] mb-4 uppercase">Ready to Draw?</h2>

                <div className="bg-blue-50 border-2 border-blue-100 rounded-xl p-4 mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-gray-500">Player</span>
                    <span className="font-black text-lg text-[#0E3359]">{playerData.name || uid}</span>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-gray-500">Balance</span>
                    <span className="font-black text-lg text-[#0E3359]">{playerData.stonks} 💎</span>
                  </div>
                  <div className="border-t border-blue-200 my-2"></div>
                  <div className="flex justify-between items-center text-green-600">
                    <span className="font-bold">Entry Prize</span>
                    <span className="font-black text-xl">+35 💎</span>
                  </div>
                </div>

                {playerData.stonks < 20 ? (
                  <div className="bg-red-100 text-red-600 p-4 rounded-lg font-bold mb-4">
                    Insufficient Stonks (Need 20)
                  </div>
                ) : (
                  <button
                    onClick={payAndStart}
                    disabled={loading}
                    className="w-full bg-[#53E07D] hover:bg-[#46c96b] text-white text-2xl font-black py-4 rounded-lg shadow-[0px_4px_0px_#2b964d] active:shadow-none active:translate-y-[4px] transition-all uppercase mb-4"
                  >
                    {loading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : 'Start Game (20💎)'}
                  </button>
                )}
                <button onClick={resetGame} className="text-gray-400 font-bold hover:text-gray-600 text-sm">Return to Lobby</button>
              </div>
            </div>
          </div>
        )}

        {/* WORD SELECTION (Transparent Overlay Style) */}
        {gameState === 'wordSelection' && (
          <div className="flex-1 flex flex-col items-center justify-center w-full">
            <div className="bg-[#00000040] px-8 py-4 rounded-xl backdrop-blur-sm mb-8 text-center border-2 border-[#ffffff10]">
              <h2 className="text-3xl font-black text-white mb-2 drop-shadow-md">Choose a word!</h2>
              <div className="text-white/90 font-bold flex items-center justify-center gap-2 text-xl">
                <Clock className="w-6 h-6" />
                {selectionTimeLeft}s
              </div>
            </div>

            <div className="flex gap-4 w-full max-w-4xl px-4 justify-center">
              {wordOptions.map((word, i) => (
                <button
                  key={i}
                  onClick={() => selectWord(word)}
                  className="group bg-white hover:bg-[#5C96D8] hover:text-white p-8 rounded-xl shadow-[4px_4px_0px_#00000020] transition-all transform hover:-translate-y-1 hover:shadow-[6px_6px_0px_#00000020] border-b-4 border-gray-200 hover:border-blue-400 w-64 text-center"
                >
                  <span className="block text-2xl font-black uppercase tracking-wider mb-2">{word}</span>
                  <span className="text-sm font-bold text-gray-400 group-hover:text-white/80 bg-gray-100 group-hover:bg-white/20 px-2 py-1 rounded inline-block">
                    {word.length} letters
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* MAIN GAME INTERFACE */}
        {(gameState === 'playing' || gameState === 'won' || gameState === 'lost') && (
          <div className="bg-white rounded-xl shadow-[0px_0px_20px_rgba(0,0,0,0.2)] flex flex-col overflow-hidden h-full max-h-[800px] w-full">

            {/* TOP INFO BAR */}
            <div className="bg-[#f5f5f5] p-2 flex items-center justify-between border-b-2 border-[#e0e0e0]">
              <div className="flex items-center gap-4">
                {/* Timer */}
                <div className="relative w-12 h-12 flex items-center justify-center">
                  <Clock className="w-10 h-10 text-gray-300 absolute" />
                  <span className="font-black text-xl text-[#0E3359] relative z-10">{timeLeft}</span>
                </div>
                <div className="text-xl font-bold text-[#0E3359]">
                  Round 1 of 1
                </div>
              </div>

              {/* Word Hint / Status */}
              <div className="flex flex-col items-center">
                {gameState === 'playing' ? (
                  <>
                    <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">GUESS THIS</div>
                    <div className="font-mono text-2xl font-black text-[#0E3359] tracking-widest leading-none">
                      {targetWord.split('').map((_, i) => (
                        <span key={i} className="border-b-4 border-[#0E3359] mx-1 inline-block w-4 h-6"></span>
                      ))}
                      <span className="ml-2 text-sm text-gray-400 font-sans tracking-normal">{targetWord.length}</span>
                    </div>
                  </>
                ) : (
                  <div className="text-xl font-black text-[#0E3359]">
                    Word was: <span className="text-[#53E07D]">{targetWord.toUpperCase()}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                  <span className="text-xl">⚙️</span>
                </button>
              </div>
            </div>

            {/* GAME CONTENT COLUMNS */}
            <div className="flex-1 flex min-h-0 bg-white">

              {/* LEFT: PLAYERS */}
              <div className="w-48 md:w-56 flex flex-col border-r-2 border-[#e0e0e0] bg-[#FAFAFA]">
                {players.map((player, index) => (
                  <div key={player.id} className={`flex items-center gap-2 p-3 ${index % 2 === 0 ? 'bg-white' : 'bg-[#f4f4f4]'} ${index === 0 && gameState === 'playing' ? '!bg-[#E3F2FD] border-l-4 border-[#3BA4E8]' : ''}`}>
                    <div className="flex flex-col items-center mr-1">
                      <div className={`text-lg font-black ${index === 0 ? 'text-[#3BA4E8]' : 'text-gray-400'}`}>#{index + 1}</div>
                    </div>
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full bg-white border-2 border-gray-300 flex items-center justify-center text-xl shadow-sm">
                        {player.avatar}
                      </div>
                      {index === 0 && gameState === 'playing' && (
                        <div className="absolute -top-1 -right-1 text-lg transform rotate-90">✏️</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-gray-800 text-sm truncate" style={{ color: player.id === 1 ? '#3BA4E8' : 'inherit' }}>{player.name} {player.id === 1 && '(You)'}</div>
                      <div className="text-xs font-bold text-gray-500">{player.score} pts</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* CENTER: CANVAS */}
              <div className="flex-1 flex flex-col bg-[#F0F0F0] relative overflow-hidden">

                {/* Canvas Area */}
                <div className="flex-1 p-4 flex items-center justify-center">
                  <div className="bg-white shadow-lg w-full h-full rounded cursor-crosshair relative">
                    <canvas
                      ref={canvasRef}
                      className="w-full h-full touch-none rounded"
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={handleTouchStart}
                      onTouchMove={handleTouchMove}
                      onTouchEnd={handleTouchEnd}
                    />

                    {/* OVERLAYS */}
                    {(gameState === 'won' || gameState === 'lost') && (
                      <div className="absolute inset-0 bg-[#0E3359]/90 flex flex-col items-center justify-center p-8 text-center z-10 backdrop-blur-sm rounded">
                        <h2 className={`text-5xl font-black mb-4 ${gameState === 'won' ? 'text-[#53E07D]' : 'text-[#FF6B6B]'}`}>
                          {gameState === 'won' ? '🎉 YOU WON!' : '😢 TIME UP!'}
                        </h2>
                        <div className="bg-white rounded-xl p-6 mb-8 max-w-sm w-full shadow-lg">
                          <div className="mb-4">
                            <div className="text-gray-400 text-xs font-bold uppercase mb-1">The word was</div>
                            <div className="text-3xl font-black text-[#0E3359]">{targetWord.toUpperCase()}</div>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-left p-4 bg-gray-50 rounded-lg">
                            <div>
                              <div className="text-gray-400 text-xs font-bold uppercase">AI Guess</div>
                              <div className="font-bold text-lg leading-tight">{currentAiGuess || '-'}</div>
                            </div>
                            <div>
                              <div className="text-gray-400 text-xs font-bold uppercase">Reward</div>
                              <div className="font-bold text-lg text-[#53E07D]">{gameState === 'won' ? '+35' : '0'} 💎</div>
                            </div>
                          </div>
                        </div>
                        <button onClick={resetGame} className="bg-[#3BA4E8] text-white px-8 py-3 rounded-lg font-black text-xl hover:bg-[#2c8bc7] transition-colors shadow-[0px_4px_0px_#1a6ca0] active:translate-y-[2px] active:shadow-none">
                          PLAY AGAIN
                        </button>
                      </div>
                    )}

                    {shieldActive && (
                      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-yellow-400 text-yellow-900 px-4 py-2 rounded-full font-bold shadow-lg animate-pulse flex items-center gap-2 z-20">
                        <span>🛡️</span> Shield Active
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* RIGHT: CHAT */}
              <div className="w-64 md:w-72 flex flex-col border-l-2 border-[#e0e0e0] bg-white">
                <div className="bg-[#F0F0F0] p-2 text-center font-bold text-gray-500 text-xs border-b border-[#e0e0e0]">
                  CHAT
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-1 font-sans text-[13px]">
                  {gameState === 'playing' && (
                    <div className="text-green-600 font-bold bg-green-50 p-1 rounded mb-2 text-center">
                      Guess the word!
                    </div>
                  )}

                  {currentAiGuess && gameState === 'playing' && (
                    <div className="flex gap-2 text-gray-600 bg-gray-50 p-1.5 rounded border border-gray-100 mb-2 items-center">
                      <span className="text-lg">🤖</span>
                      <span className="flex-1 font-bold">AI: <span className="text-[#3BA4E8] font-normal">{currentAiGuess}</span>?</span>
                    </div>
                  )}

                  {chatMessages.map((msg, index) => (
                    <div key={msg.id} className={`px-2 py-0.5 rounded leading-tight ${msg.isCorrect ? 'bg-[#C8E6C9] text-[#2E7D32] py-2' : ''}`}>
                      <span className={`font-bold mr-1 ${msg.isCorrect ? 'text-[#2E7D32]' : 'text-black'}`}>
                        {msg.author}:
                      </span>
                      <span className={msg.isCorrect ? 'font-bold' : ''}>
                        {msg.isCorrect ? 'Guessed the word!' : msg.message}
                      </span>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>

                <form onSubmit={handleChatSubmit} className="p-2 bg-white border-t border-[#e0e0e0]">
                  <input
                    type="text"
                    className="w-full px-3 py-2 rounded border-2 border-gray-200 focus:outline-none focus:border-[#3BA4E8] text-sm font-bold placeholder-gray-400"
                    placeholder="Type your guess here..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    maxLength={100}
                  />
                </form>
              </div>

            </div>

            {/* TOOLBAR (Bottom of Game Window) */}
            <div className="bg-white border-t-2 border-[#e0e0e0] p-2 flex items-center justify-center gap-6">
              {/* Colors */}
              <div className="flex flex-wrap gap-1 bg-[#f0f0f0] p-1.5 rounded-lg border border-[#e0e0e0]">
                {COLORS.slice(0, 22).map((color) => (
                  <button
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    className={`w-6 h-6 rounded-sm hover:scale-110 transition-transform ${selectedColor === color ? 'ring-2 ring-gray-900 z-10 scale-110' : ''}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>

              {/* Sizes */}
              <div className="flex items-center gap-2 bg-[#f0f0f0] p-1.5 rounded-lg border border-[#e0e0e0]">
                {BRUSH_SIZES.slice(0, 4).map((size) => (
                  <button
                    key={size}
                    onClick={() => setBrushSize(size)}
                    className={`w-8 h-8 rounded flex items-center justify-center hover:bg-gray-200 ${brushSize === size ? 'bg-white shadow-sm' : ''}`}
                  >
                    <div className="bg-black rounded-full" style={{ width: size, height: size }} />
                  </button>
                ))}
              </div>

              {/* Tools */}
              <div className="flex items-center gap-2">
                <button onClick={clearCanvas} className="p-2 hover:bg-red-100 text-gray-500 hover:text-red-500 rounded transition-colors" title="Clear">
                  <Trash2 className="w-6 h-6" />
                </button>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
