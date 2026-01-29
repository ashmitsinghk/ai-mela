'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { analyzeDrawing } from './scribble';
import { getRandomWord } from './words-list';
import CircularTimer from './components/CircularTimer';
import { supabase } from '@/utils/supabase';
import { Loader2, Palette } from 'lucide-react';

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
  const [playerData, setPlayerData] = useState<{ name: string | null; stonks: number } | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Refs to avoid stale closure issues in intervals
  const gameStateRef = useRef<GameState>(gameState);
  const shieldActiveRef = useRef(shieldActive);
  const analyzingRef = useRef(analyzing);
  const targetWordRef = useRef(targetWord);
  
  // New UI state
  const [selectedColor, setSelectedColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(4);
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
        alert('Player not found!');
        setPlayerData(null);
      } else {
        setPlayerData(data);
        setGameState('BET');
      }
    } finally {
      setLoading(false);
    }
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
      className="h-screen overflow-auto" 
      style={{ 
        fontFamily: 'Arial, Helvetica, sans-serif',
      }} 
      data-game-state={gameState}
    >
      {/* AUTH PHASE */}
      {gameState === 'AUTH' && (
        <div className="h-screen overflow-auto text-black font-mono p-4 md:p-8 flex items-center justify-center" style={{
          background: '#2c5f99',
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M10 10h5v5h-5zm20 0h5v5h-5zm20 0h5v5h-5zM10 30h5v5h-5zm20 0h5v5h-5zm20 0h5v5h-5z' fill='%23234a7a' fill-opacity='0.4'/%3E%3C/svg%3E")`
        }}>
          <div className="max-w-md w-full bg-white shadow-[16px_16px_0px_#000] p-8">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-neo-pink border-4 border-black mb-4">
                <Palette className="w-10 h-10 text-white" />
              </div>
              <h1 className="text-4xl font-heading mb-2 uppercase">
                AI Scribble <span className="text-neo-pink">Challenge</span>
              </h1>
              <p className="font-bold text-lg">Enter your Player ID to start</p>
            </div>

            <form onSubmit={checkPlayer} className="space-y-4">
              <input
                type="text"
                value={uid}
                onChange={(e) => setUid(e.target.value)}
                placeholder="23BAI..."
                required
                autoFocus
                className="w-full text-4xl font-heading p-4 border-4 border-black text-center uppercase"
              />

              <button
                type="submit"
                disabled={loading || !uid.trim()}
                className="w-full bg-black text-white text-2xl font-heading py-4 hover:bg-neo-green hover:text-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    CHECKING...
                  </div>
                ) : (
                  'VERIFY PLAYER'
                )}
              </button>
            </form>

            <div className="mt-6 text-center text-sm">
              <p className="font-bold">Entry Fee: 20 💎</p>
            </div>
          </div>
        </div>
      )}

      {/* BET PHASE */}
      {gameState === 'BET' && playerData && (
        <div className="h-screen overflow-auto text-black font-mono p-4 md:p-8 flex items-center justify-center" style={{
          background: '#2c5f99',
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M10 10h5v5h-5zm20 0h5v5h-5zm20 0h5v5h-5zM10 30h5v5h-5zm20 0h5v5h-5zm20 0h5v5h-5z' fill='%23234a7a' fill-opacity='0.4'/%3E%3C/svg%3E")`
        }}>
          <div className="max-w-md w-full bg-white border-8 border-black shadow-[16px_16px_0px_#000] p-8">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-neo-green border-4 border-black mb-4">
                <span className="text-4xl">🎨</span>
              </div>
              <h1 className="text-4xl font-heading mb-2 uppercase">
                AI Scribble <span className="text-neo-pink">Challenge</span>
              </h1>
              <h2 className="text-2xl font-bold mb-2">PLAYER: {playerData.name || uid}</h2>
            </div>

            <div className="bg-neo-cyan border-4 border-black p-6 mb-6">
              <div className="text-center">
                <div className="text-4xl font-heading mb-4">BALANCE: {playerData.stonks} 💎</div>
                <div className="text-2xl font-bold mb-2">ENTRY FEE: -20 💎</div>
                <div className="border-t-4 border-black pt-3 mt-3">
                  <div className="text-3xl font-heading">
                    AFTER ENTRY: {playerData.stonks - 20} 💎
                  </div>
                </div>
              </div>
            </div>

            {playerData.stonks < 20 ? (
              <div className="bg-red-500 text-white p-4 font-bold text-xl border-4 border-black text-center mb-4">
                INSUFFICIENT FUNDS
              </div>
            ) : (
              <button
                onClick={payAndStart}
                disabled={loading}
                className="w-full bg-neo-green text-black text-3xl font-heading py-6 border-4 border-black shadow-[16px_16px_0px_#000] hover:translate-y-1 hover:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed mb-4"
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    PROCESSING...
                  </div>
                ) : (
                  'PAY 20 & START'
                )}
              </button>
            )}

            <button
              onClick={resetGame}
              className="w-full text-center underline hover:text-neo-pink font-bold"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* WORD SELECTION PHASE */}
      {gameState === 'wordSelection' && (
        <div className="h-screen overflow-auto py-6 px-4" style={{
          background: '#2c5f99',
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M10 10h5v5h-5zm20 0h5v5h-5zm20 0h5v5h-5zM10 30h5v5h-5zm20 0h5v5h-5zm20 0h5v5h-5z' fill='%23234a7a' fill-opacity='0.4'/%3E%3C/svg%3E")`
        }}>
          <div className="max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[calc(100vh-3rem)]">
            <div className="bg-white rounded-xl shadow-2xl border-4 border-gray-800 p-8 w-full">
              <div className="text-center mb-8">
                <h2 className="text-4xl font-bold text-gray-800 mb-4">Choose Your Word</h2>
                <div className="flex items-center justify-center gap-3 mb-2">
                  <div className={`text-6xl font-bold ${
                    selectionTimeLeft <= 5 ? 'text-red-600 animate-pulse' : 'text-blue-600'
                  }`}>
                    {selectionTimeLeft}
                  </div>
                  <span className="text-2xl text-gray-600">seconds</span>
                </div>
                <p className="text-gray-600 text-lg">
                  {selectionTimeLeft <= 5 ? '⏰ Hurry up!' : 'Pick a word to draw'}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {wordOptions.map((word, index) => (
                  <button
                    key={index}
                    onClick={() => selectWord(word)}
                    className="group relative bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white p-8 rounded-xl border-4 border-gray-800 shadow-lg hover:shadow-2xl hover:scale-105 transition-all duration-200"
                  >
                    <div className="text-4xl font-bold uppercase tracking-wide mb-2">
                      {word}
                    </div>
                    <div className="text-sm opacity-75">
                      {word.length} letters
                    </div>
                    <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 rounded-xl transition-opacity" />
                  </button>
                ))}
              </div>

              <div className="mt-8 text-center">
                <p className="text-sm text-gray-600">
                  💡 A random word will be selected if you don't choose in time
                </p>
              </div>
            </div>

            <button
              onClick={resetGame}
              className="mt-6 text-white underline hover:text-neo-pink font-bold text-lg"
            >
              Cancel Game
            </button>
          </div>
        </div>
      )}

      {/* GAME PHASE */}
      {(gameState === 'playing' || gameState === 'won' || gameState === 'lost') && (
        <div className="min-h-screen py-6 px-4" style={{
          background: '#2c5f99',
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M10 10h5v5h-5zm20 0h5v5h-5zm20 0h5v5h-5zM10 30h5v5h-5zm20 0h5v5h-5zm20 0h5v5h-5z' fill='%23234a7a' fill-opacity='0.4'/%3E%3C/svg%3E")`
        }}>
        <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="text-4xl font-bold" style={{ 
            fontFamily: 'Comic Sans MS, cursive',
            textShadow: '3px 3px 0px rgba(0,0,0,0.2)',
            color: '#ffffff',
            letterSpacing: '2px'
          }}>
            skribbl<span style={{ color: '#ff6b6b' }}>.io</span>
          </div>
          
          {gameState === 'playing' && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <span className="text-white font-bold text-lg" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
                  Round 1 of 1
                </span>
              </div>
              <button className="w-10 h-10 bg-white rounded-full border-[3px] border-black flex items-center justify-center shadow-md hover:bg-gray-100 transition-colors">
                <span className="text-xl">⚙️</span>
              </button>
            </div>
          )}
        </div>

        {/* Persistent Bar - Visible in playing, won, lost states */}
        {(gameState === 'playing' || gameState === 'won' || gameState === 'lost') && (
          <div className="shadow-lg p-3 mb-4" style={{
            background: 'linear-gradient(180deg, #4a90e2 0%, #357abd 100%)',
            borderTop: '3px solid #2c5f99',
            borderBottom: '3px solid #1a4d8f'
          }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 bg-white rounded-full px-3 py-1 border-2 border-gray-800">
                  <span className="text-xl">🕐</span>
                  <span className="text-sm font-bold text-gray-800">Round 1 of 1</span>
                </div>
              </div>
              
              <div className="flex flex-col items-center gap-1 flex-1">
                {gameState === 'playing' && (
                  <>
                    <div className="text-xs font-bold text-white tracking-wider">GUESS THIS</div>
                    <div className="flex items-center gap-2">
                      <div className="text-2xl font-bold text-white tracking-widest" style={{ fontFamily: 'monospace' }}>
                        {targetWord.split('').map((char, i) => (
                          <span key={i} className="inline-block mx-0.5">
                            <span className="border-b-4 border-white pb-1">{char.toUpperCase()}</span>
                          </span>
                        ))}
                      </div>
                      <span className="text-sm font-bold text-white bg-black bg-opacity-30 rounded px-2 py-0.5">
                        {targetWord.length}
                      </span>
                    </div>
                  </>
                )}
                {gameState === 'won' && (
                  <div className="text-xl font-bold text-white">✓ AI guessed: {targetWord.toUpperCase()}</div>
                )}
                {gameState === 'lost' && (
                  <div className="text-xl font-bold text-white">✗ Time's up! Word was: {targetWord.toUpperCase()}</div>
                )}
              </div>

              <div className="flex items-center gap-2">
                {gameState === 'playing' && (
                  <div className={`text-3xl font-bold px-4 py-1 rounded-lg ${
                    timeLeft <= 10 ? 'bg-red-500 text-white animate-pulse' : 'bg-white text-gray-800'
                  } border-2 border-gray-800`}>
                    {timeLeft}s
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Shield Alert */}
        {shieldActive && (
          <div className="bg-yellow-300 border-4 border-yellow-600 rounded-lg p-3 mb-4 text-center shadow-lg">
            <p className="text-yellow-900 font-bold">
              🛡️ Guardian is recharging shields... (5s pause)
            </p>
          </div>
        )}

        {/* Main Game Layout - Three Column */}
        <div className="flex flex-col lg:flex-row gap-4">
          
          {/* LEFT SIDEBAR - Leaderboard */}
          <div className="lg:w-72 w-full">
            <div className="bg-white rounded-xl shadow-lg border-4 border-gray-800 overflow-hidden">
              <div className="space-y-0">
                {players.map((player, index) => {
                  const isDrawing = index === 0 && gameState === 'playing';
                  const bgColor = isDrawing ? '#90EE90' : index === 1 ? '#FFB6C6' : '#f0f0f0';
                  
                  return (
                    <div
                      key={player.id}
                      className="flex items-center gap-3 p-4 border-b-2 border-gray-300 last:border-b-0"
                      style={{ backgroundColor: bgColor }}
                    >
                      <div className="text-sm font-bold text-gray-700 w-6">#{index + 1}</div>
                      <div className="flex items-center justify-center w-12 h-12 rounded-full border-4 border-gray-800 text-2xl font-bold" style={{
                        backgroundColor: index === 0 ? '#9b59b6' : '#e74c3c'
                      }}>
                        {player.avatar}
                      </div>
                      <div className="flex-1">
                        <div className="font-bold text-gray-900 text-lg">{player.name}</div>
                        <div className="text-sm text-gray-700 font-semibold">{player.score} points</div>
                      </div>
                      {isDrawing && (
                        <div className="text-xl">✏️</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* CENTER COLUMN - Canvas */}
          <div className="flex-1 min-w-0">
            <div className="bg-white rounded-xl shadow-lg border-4 border-gray-800 overflow-hidden">
              
              {/* Canvas */}
              <div className="relative bg-white" style={{ aspectRatio: '4/3' }}>
                <canvas
                  ref={canvasRef}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  className="w-full h-full cursor-crosshair touch-none"
                  style={{ display: 'block' }}
                />
                
                {/* Overlay for non-playing states */}
                {gameState !== 'playing' && (
                  <div className="absolute inset-0 bg-white bg-opacity-98 flex items-center justify-center">
                    {gameState === 'won' && (
                      <div className="text-center p-8">
                        <h2 className="text-5xl font-bold text-green-600 mb-4">🎉 You Won!</h2>
                        <p className="text-xl text-gray-700 mb-6">
                          The AI guessed <span className="font-bold text-green-600">{currentAiGuess}</span>
                          <br />in {30 - timeLeft} seconds!
                          <br />You drew: <span className="font-bold text-blue-600">{targetWord}</span>
                          <br /><span className="text-green-600 font-bold text-2xl">+35 💎</span>
                        </p>
                        <button
                          onClick={resetGame}
                          className="px-10 py-4 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-xl text-lg transition-colors border-4 border-gray-800 shadow-lg"
                        >
                          Exit
                        </button>
                      </div>
                    )}

                    {gameState === 'lost' && (
                      <div className="text-center p-8">
                        <h2 className="text-5xl font-bold text-red-600 mb-4">😢 You Lost! You worthless peace of human garbage. AI will one day take your job</h2>
                        <p className="text-xl text-gray-700 mb-6">
                          Time's up! The AI couldn't guess your drawing!
                          <br />AI's final guess: <span className="font-bold text-red-600">{currentAiGuess || 'none'}</span>
                          <br />You needed to draw: <span className="font-bold text-blue-600">{targetWord}</span>
                        </p>
                        <button
                          onClick={resetGame}
                          className="px-10 py-4 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-xl text-lg transition-colors border-4 border-gray-800 shadow-lg"
                        >
                          Exit
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Toolbar - Only show when playing */}
              {gameState === 'playing' && (
                <div className="p-4 bg-gray-100 border-t-4 border-gray-800">
                  <div className="flex items-center justify-between gap-4">
                    {/* Color Swatches */}
                    <div className="flex-1">
                      <div className="flex flex-wrap gap-2">
                        {COLORS.slice(0, 12).map((color) => (
                          <button
                            key={color}
                            onClick={() => setSelectedColor(color)}
                            className={`w-8 h-8 rounded border-2 transition-all hover:scale-110 ${
                              selectedColor === color ? 'border-gray-900 ring-2 ring-gray-900 scale-110' : 'border-gray-400'
                            }`}
                            style={{ backgroundColor: color }}
                            title={color}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Brush Sizes */}
                    <div className="flex gap-2 items-center">
                      {BRUSH_SIZES.slice(0, 4).map((size) => (
                        <button
                          key={size}
                          onClick={() => setBrushSize(size)}
                          className={`w-9 h-9 rounded-full border-2 transition-all hover:scale-110 flex items-center justify-center ${
                            brushSize === size ? 'border-gray-900 bg-gray-300' : 'border-gray-400 bg-white'
                          }`}
                          title={`Size ${size}`}
                        >
                          <div
                            className="rounded-full bg-gray-800"
                            style={{ width: `${size * 1.5}px`, height: `${size * 1.5}px` }}
                          />
                        </button>
                      ))}
                    </div>

                    {/* Clear Button */}
                    <button
                      onClick={clearCanvas}
                      className="px-5 py-2 bg-white hover:bg-gray-200 text-gray-900 font-bold rounded-lg border-2 border-gray-600 transition-colors shadow-sm"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT SIDEBAR - Chat */}
          <div className="lg:w-80 w-full">
            <div className="bg-white rounded-xl shadow-lg border-4 border-gray-800 flex flex-col overflow-hidden" style={{ height: gameState === 'playing' ? '500px' : '400px' }}>
              
              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {gameState === 'playing' && (
                  <div className="text-center p-2 bg-blue-100 rounded-lg border-2 border-blue-300">
                    <span className="text-sm font-bold text-blue-800">👤 You are drawing now!</span>
                  </div>
                )}
                
                {currentAiGuess && gameState === 'playing' && (
                  <div className="p-2 bg-gray-100 rounded-lg border-2 border-gray-300">
                    <div className="font-bold text-sm text-gray-700">🤖 AI Guardian</div>
                    <div className="text-sm text-gray-800">{currentAiGuess}</div>
                  </div>
                )}

                
                
                {chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-2 rounded-lg border-2 ${
                      msg.isCorrect
                        ? 'bg-green-100 border-green-400'
                        : 'bg-gray-50 border-gray-300'
                    }`}
                  >
                    <div className="font-bold text-sm text-gray-700">{msg.author}</div>
                    <div className={`text-sm ${msg.isCorrect ? 'text-green-800 font-bold' : 'text-gray-800'}`}>
                      {msg.message}
                      {msg.isCorrect && ' guessed the word!'}
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
            </div>
          </div>

        </div>
        </div>
        </div>
      )}
        
    </div>
  );
}
