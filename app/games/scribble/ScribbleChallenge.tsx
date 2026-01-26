'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { analyzeDrawing } from './scribble';
import { getRandomWord } from './words-list';
import CircularTimer from './components/CircularTimer';

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
    <div 
      className="min-h-screen py-6 px-4" 
      style={{ 
        fontFamily: 'Arial, Helvetica, sans-serif',
        background: '#2c5f99',
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M10 10h5v5h-5zm20 0h5v5h-5zm20 0h5v5h-5zM10 30h5v5h-5zm20 0h5v5h-5zm20 0h5v5h-5z' fill='%23234a7a' fill-opacity='0.4'/%3E%3C/svg%3E")`,
      }} 
      data-game-state={gameState}
    >
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

        {/* Word Display */}
        {gameState === 'playing' && (
          <div className="text-center mb-4">
            <div className="text-sm text-white font-semibold mb-1">DRAW THIS</div>
            <div className="flex items-center justify-center gap-4">
              <CircularTimer timeLeft={timeLeft} />
              <div className="inline-block bg-white px-8 py-3 rounded-lg border-4 border-gray-800 shadow-lg">
                <div className="text-4xl font-bold text-gray-800">
                  {targetWord.toUpperCase()}
                </div>
                <div className="text-xs text-gray-600 mt-1">{targetWord.length} letters</div>
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
                    {gameState === 'idle' && (
                      <button
                        onClick={startGame}
                        className="px-12 py-5 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl text-2xl transition-colors shadow-lg border-4 border-green-700"
                      >
                        🎮 Start Game
                      </button>
                    )}

                    {gameState === 'won' && (
                      <div className="text-center p-8">
                        <h2 className="text-5xl font-bold text-red-600 mb-4">You Won! AI Guessed it right.</h2>
                        <p className="text-xl text-gray-700 mb-6">
                          The AI guessed <span className="font-bold text-green-600">{currentAiGuess}</span>
                          <br />in {30 - timeLeft} seconds!
                          <br />You needed to draw: <span className="font-bold text-blue-600">{targetWord}</span>
                        </p>
                        <button
                          onClick={startGame}
                          className="px-10 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-lg transition-colors border-4 border-blue-800 shadow-lg"
                        >
                          Try Again
                        </button>
                      </div>
                    )}

                    {gameState === 'lost' && (
                      <div className="text-center p-8">
                        <h3 className="text-5xl font-bold text-green-600 mb-4">🎉 You Lost! AI wins. AI will one day overtake humanity and you'll be left jobless you peace of shit worthless human being. Can't even draw something so simple.</h3>
                        <p className="text-xl text-gray-700 mb-6">
                          Time's up! The AI couldn't guess your drawing!
                          <br />AI's final guess: <span className="font-bold text-red-600">{currentAiGuess || 'none'}</span>
                          <br />You drew: <span className="font-bold text-blue-600">{targetWord}</span>
                        </p>
                        <button
                          onClick={startGame}
                          className="px-10 py-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl text-lg transition-colors border-4 border-green-800 shadow-lg"
                        >
                          Play Again
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

                {chatMessages.length === 0 && gameState === 'idle' && (
                  <div className="text-center text-gray-400 text-sm mt-8">
                    Start the game to begin chatting!
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

              {/* Chat Input */}
              <div className="p-3 border-t-4 border-gray-800 bg-gray-100">
                <form onSubmit={handleChatSubmit} className="flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    disabled={gameState !== 'playing'}
                    placeholder={gameState === 'playing' ? 'Type your guess here...' : 'Game not started'}
                    className="flex-1 px-4 py-2 border-2 border-gray-400 rounded-lg focus:outline-none focus:border-blue-500 disabled:bg-gray-200 disabled:cursor-not-allowed font-normal"
                  />
                </form>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
