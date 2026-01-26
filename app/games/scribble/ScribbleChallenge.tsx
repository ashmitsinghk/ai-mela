'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { analyzeDrawing } from './scribble';
import { getRandomWord } from './words-list';

type GameState = 'idle' | 'playing' | 'won' | 'lost';

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
  const [gameState, setGameState] = useState<GameState>('idle');
  const [currentAiGuess, setCurrentAiGuess] = useState('');
  const [shieldActive, setShieldActive] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastAnalysisRef = useRef<number>(0);
  
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
  }, [targetWord]);

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
      isCorrect: chatInput.toLowerCase().trim() === targetWord.toLowerCase().trim()
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
    if (now - lastAnalysisRef.current < 1000) {
      console.log('⏱️ Throttled (< 1s since last call)');
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
      const normalizedGuess = result.guess.toLowerCase().trim();
      const normalizedTarget = currentTargetWord.toLowerCase().trim();
      
      if (normalizedGuess === normalizedTarget) {
        setGameState('won');
        stopGame();
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
    }, 1000);
    
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
    if (gameState === 'won' || gameState === 'lost' || gameState === 'idle') {
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopGame();
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#eeeeee] py-8 px-4" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }} data-game-state={gameState}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            🎨 AI Scribble Challenge
          </h1>
          {gameState === 'playing' && (
            <div className="flex justify-center items-center gap-4 mt-4">
              <div className="bg-white px-6 py-3 rounded-lg shadow-md border-2 border-gray-300">
                <span className="text-sm text-gray-600 mr-2">Target:</span>
                <span className="text-2xl font-bold text-gray-900">{targetWord.toUpperCase()}</span>
              </div>
              <div className={`bg-white px-6 py-3 rounded-lg shadow-md border-2 ${timeLeft <= 10 ? 'border-red-500' : 'border-gray-300'}`}>
                <span className="text-sm text-gray-600 mr-2">Time:</span>
                <span className={`text-2xl font-bold ${timeLeft <= 10 ? 'text-red-600' : 'text-gray-900'}`}>{timeLeft}s</span>
              </div>
            </div>
          )}
        </div>

        {/* Shield Alert */}
        {shieldActive && (
          <div className="bg-amber-100 border-2 border-amber-400 rounded-lg p-3 mb-4 text-center shadow-md">
            <p className="text-amber-900 font-semibold">
              🛡️ Guardian is recharging shields... (5s pause)
            </p>
          </div>
        )}

        {/* Main Game Layout - Three Column */}
        <div className="flex flex-col lg:flex-row gap-4">
          
          {/* LEFT SIDEBAR - Leaderboard */}
          <div className="lg:w-64 w-full">
            <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
              <h2 className="text-xl font-bold text-gray-800 mb-4 text-center">Players</h2>
              <div className="space-y-3">
                {players.map((player, index) => (
                  <div
                    key={player.id}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <div className="text-2xl">{player.avatar}</div>
                    <div className="flex-1">
                      <div className="font-bold text-gray-800">{player.name}</div>
                      <div className="text-sm text-gray-600">Score: {player.score}</div>
                    </div>
                    {index === 0 && (
                      <div className="text-yellow-500 text-xl">👑</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* CENTER COLUMN - Canvas */}
          <div className="flex-1 min-w-0">
            <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
              
              {/* Canvas */}
              <div className="relative bg-white border-2 border-gray-300 rounded-lg overflow-hidden" style={{ aspectRatio: '4/3' }}>
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
                  <div className="absolute inset-0 bg-white bg-opacity-95 flex items-center justify-center">
                    {gameState === 'idle' && (
                      <button
                        onClick={startGame}
                        className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xl transition-colors shadow-lg border-2 border-blue-700"
                      >
                        Start Game
                      </button>
                    )}

                    {gameState === 'won' && (
                      <div className="text-center p-8">
                        <h2 className="text-4xl font-bold text-green-600 mb-3">🎉 Victory!</h2>
                        <p className="text-lg text-gray-700 mb-4">
                          The AI guessed <span className="font-bold text-green-600">{currentAiGuess}</span>
                          <br />in {30 - timeLeft} seconds!
                        </p>
                        <button
                          onClick={startGame}
                          className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-colors border-2 border-green-700"
                        >
                          Play Again
                        </button>
                      </div>
                    )}

                    {gameState === 'lost' && (
                      <div className="text-center p-8">
                        <h2 className="text-4xl font-bold text-red-600 mb-3">⏰ Time's Up!</h2>
                        <p className="text-lg text-gray-700 mb-4">
                          AI's final guess: <span className="font-bold text-red-600">{currentAiGuess || 'none'}</span>
                          <br />Target word: <span className="font-bold text-blue-600">{targetWord}</span>
                        </p>
                        <button
                          onClick={startGame}
                          className="px-8 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors border-2 border-red-700"
                        >
                          Try Again
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Toolbar */}
              <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                {/* Color Swatches - Two Rows */}
                <div className="mb-4">
                  <div className="text-xs text-gray-600 mb-2 font-semibold">COLORS</div>
                  <div className="grid grid-cols-9 gap-2">
                    {COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => setSelectedColor(color)}
                        disabled={gameState !== 'playing'}
                        className={`w-10 h-10 rounded border-2 transition-all hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed ${
                          selectedColor === color ? 'border-gray-900 shadow-lg scale-110' : 'border-gray-400'
                        }`}
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>

                {/* Brush Sizes and Clear */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-gray-600 mb-2 font-semibold">BRUSH SIZE</div>
                    <div className="flex gap-3 items-center">
                      {BRUSH_SIZES.map((size) => (
                        <button
                          key={size}
                          onClick={() => setBrushSize(size)}
                          disabled={gameState !== 'playing'}
                          className={`rounded-full border-2 transition-all hover:scale-110 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed ${
                            brushSize === size ? 'border-gray-900 bg-gray-200' : 'border-gray-400 bg-white'
                          }`}
                          style={{ width: '40px', height: '40px' }}
                          title={`Size ${size}`}
                        >
                          <div
                            className="rounded-full bg-gray-800"
                            style={{ width: `${size * 2}px`, height: `${size * 2}px` }}
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={clearCanvas}
                      disabled={gameState !== 'playing'}
                      className="px-6 py-3 bg-white hover:bg-gray-100 text-gray-900 font-bold rounded-lg border-2 border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                    >
                      🗑️ Clear
                    </button>
                    {gameState === 'playing' && (
                      <button
                        onClick={() => {
                          stopGame();
                          setGameState('idle');
                        }}
                        className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-lg border-2 border-red-700 transition-colors shadow-sm"
                      >
                        End Game
                      </button>
                    )}
                  </div>
                </div>

                {/* Status */}
                {analyzing && gameState === 'playing' && !shieldActive && (
                  <div className="mt-3 text-center">
                    <p className="text-sm text-blue-600 font-semibold">🤖 AI is analyzing...</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT SIDEBAR - Chat */}
          <div className="lg:w-80 w-full">
            <div className="bg-white rounded-lg shadow-md border border-gray-200 flex flex-col" style={{ height: '600px' }}>
              
              {/* Chat Header */}
              <div className="p-4 border-b border-gray-200 bg-gray-50 rounded-t-lg">
                <h2 className="text-xl font-bold text-gray-800">Chat</h2>
                {currentAiGuess && gameState === 'playing' && (
                  <div className="mt-2 text-sm">
                    <span className="text-gray-600">AI thinks:</span>
                    <span className="ml-2 font-bold text-blue-600">{currentAiGuess}</span>
                  </div>
                )}
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {chatMessages.length === 0 && (
                  <div className="text-center text-gray-400 text-sm mt-8">
                    No messages yet...
                  </div>
                )}
                {chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-2 rounded-lg ${
                      msg.isCorrect
                        ? 'bg-green-100 border border-green-300'
                        : 'bg-gray-50 border border-gray-200'
                    }`}
                  >
                    <div className="font-bold text-sm text-gray-700">{msg.author}</div>
                    <div className={`text-sm ${msg.isCorrect ? 'text-green-800 font-semibold' : 'text-gray-800'}`}>
                      {msg.message}
                      {msg.isCorrect && ' ✓'}
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input */}
              <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
                <form onSubmit={handleChatSubmit} className="flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    disabled={gameState !== 'playing'}
                    placeholder={gameState === 'playing' ? 'Type your guess...' : 'Game not started'}
                    className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                  <button
                    type="submit"
                    disabled={gameState !== 'playing' || !chatInput.trim()}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg border-2 border-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Send
                  </button>
                </form>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
