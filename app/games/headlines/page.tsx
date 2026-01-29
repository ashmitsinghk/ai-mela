'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import { Loader2, Newspaper, Trophy, TrendingUp } from 'lucide-react';
import { generateFakeHeadlines } from './headline-generator';
import newsData from './news-data.json';

type GamePhase = 'AUTH' | 'BET' | 'PLAYING' | 'RESULT';

interface HeadlineOption {
  text: string;
  isReal: boolean;
}

interface RoundResult {
  round: number;
  correct: boolean;
  selectedHeadline: string;
  correctHeadline: string;
}

// Fisher-Yates shuffle algorithm
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export default function HeadlinesGame() {
  // AUTH & USER STATE
  const [gameState, setGameState] = useState<GamePhase>('AUTH');
  const [uid, setUid] = useState('');
  const [playerData, setPlayerData] = useState<{ name: string | null; stonks: number } | null>(null);
  const [loading, setLoading] = useState(false);

  // GAME STATE
  const [currentRound, setCurrentRound] = useState(1);
  const [headlines, setHeadlines] = useState<HeadlineOption[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [roundResults, setRoundResults] = useState<RoundResult[]>([]);
  const [generatingHeadlines, setGeneratingHeadlines] = useState(false);
  const [usedHeadlines, setUsedHeadlines] = useState<Set<string>>(new Set());
  const [timeLeft, setTimeLeft] = useState(30);

  const TOTAL_ROUNDS = 5;
  const ENTRY_FEE = 20;
  const POINTS_PER_CORRECT = 8;

  // Reset game to AUTH
  const resetGame = () => {
    setGameState('AUTH');
    setUid('');
    setPlayerData(null);
    setCurrentRound(1);
    setHeadlines([]);
    setSelectedIndex(null);
    setRoundResults([]);
    setUsedHeadlines(new Set());
    setTimeLeft(30);
  };

  // AUTH: Check player
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

  // BET: Pay entry fee and start game
  const payAndStart = async () => {
    if (!playerData || playerData.stonks < ENTRY_FEE) {
      alert('Insufficient Stonks!');
      return;
    }
    setLoading(true);

    const { error: updateError } = await supabase
      .from('players')
      .update({ stonks: playerData.stonks - ENTRY_FEE })
      .eq('uid', uid);

    if (updateError) {
      alert('Transaction Failed');
      setLoading(false);
      return;
    }

    // Log the game entry
    await supabase.from('game_logs').insert({
      uid,
      game: 'headlines',
      result: 'started',
      delta: -ENTRY_FEE,
      timestamp: new Date().toISOString(),
    });

    setPlayerData({ ...playerData, stonks: playerData.stonks - ENTRY_FEE });
    setGameState('PLAYING');
    setLoading(false);
    
    // Generate first round
    await generateGameRound();
  };

  // Generate a new round with real + 2 fakes
  const generateGameRound = async () => {
    setGeneratingHeadlines(true);
    try {
      // Select a random real headline that hasn't been used
      const availableHeadlines = newsData.filter(h => !usedHeadlines.has(h.headline));
      
      if (availableHeadlines.length === 0) {
        // Reset used headlines if we've exhausted all
        setUsedHeadlines(new Set());
      }

      const randomHeadline = availableHeadlines[Math.floor(Math.random() * availableHeadlines.length)];
      
      // Mark as used
      setUsedHeadlines(prev => new Set([...prev, randomHeadline.headline]));

      // Generate fake headlines using AI
      const { real, fakes } = await generateFakeHeadlines(randomHeadline.headline);

      // Create options array with real + fakes
      const options: HeadlineOption[] = [
        { text: real, isReal: true },
        { text: fakes[0], isReal: false },
        { text: fakes[1], isReal: false },
      ];

      // Shuffle using Fisher-Yates
      const shuffledOptions = shuffleArray(options);
      
      setHeadlines(shuffledOptions);
      setSelectedIndex(null);
      setTimeLeft(30); // Reset timer for new round
    } catch (error) {
      console.error('Failed to generate round:', error);
      alert('Failed to generate headlines. Please try again.');
    } finally {
      setGeneratingHeadlines(false);
    }
  };

  // Timer countdown effect
  useEffect(() => {
    if (gameState !== 'PLAYING' || selectedIndex !== null || generatingHeadlines) return;

    if (timeLeft <= 0) {
      // Time's up - treat as incorrect answer
      handleTimeUp();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, gameState, selectedIndex, generatingHeadlines]);

  // Handle time up scenario
  const handleTimeUp = () => {
    const realHeadline = headlines.find(h => h.isReal)!;
    
    const result: RoundResult = {
      round: currentRound,
      correct: false,
      selectedHeadline: 'Time expired',
      correctHeadline: realHeadline.text,
    };

    setRoundResults([...roundResults, result]);
    setSelectedIndex(-1); // Use -1 to indicate time expired

    // Move to next round after delay
    setTimeout(() => {
      if (currentRound < TOTAL_ROUNDS) {
        setCurrentRound(currentRound + 1);
        generateGameRound();
      } else {
        finishGame([...roundResults, result]);
      }
    }, 2000);
  };

  // Handle headline selection
  const selectHeadline = (index: number) => {
    if (selectedIndex !== null) return; // Already selected
    setSelectedIndex(index);

    const selected = headlines[index];
    const realHeadline = headlines.find(h => h.isReal)!;

    // Record result
    const result: RoundResult = {
      round: currentRound,
      correct: selected.isReal,
      selectedHeadline: selected.text,
      correctHeadline: realHeadline.text,
    };

    setRoundResults([...roundResults, result]);

    // Move to next round after delay
    setTimeout(() => {
      if (currentRound < TOTAL_ROUNDS) {
        setCurrentRound(currentRound + 1);
        generateGameRound();
      } else {
        // Game over
        finishGame([...roundResults, result]);
      }
    }, 2000);
  };

  // Finish game and calculate rewards
  const finishGame = async (results: RoundResult[]) => {
    const correctCount = results.filter(r => r.correct).length;
    const reward = correctCount * POINTS_PER_CORRECT;
    
    if (reward > 0 && playerData) {
      // Update stonks
      const newStonks = playerData.stonks + reward;
      
      const { error } = await supabase
        .from('players')
        .update({ stonks: newStonks })
        .eq('uid', uid);

      if (!error) {
        setPlayerData({ ...playerData, stonks: newStonks });
      }

      // Log the win
      await supabase.from('game_logs').insert({
        uid,
        game: 'headlines',
        result: `${correctCount}/${TOTAL_ROUNDS} correct`,
        delta: reward,
        timestamp: new Date().toISOString(),
      });
    }

    setGameState('RESULT');
  };

  const correctCount = roundResults.filter(r => r.correct).length;
  const totalReward = correctCount * POINTS_PER_CORRECT;

  return (
    <div className="h-screen overflow-auto p-4" style={{
      backgroundImage: `url("/Newspaper collage.jpeg")`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      backgroundAttachment: 'fixed',
    }}>
      <div className="max-w-4xl mx-auto">
        {/* AUTH PHASE */}
        {gameState === 'AUTH' && (
          <div className="flex items-center justify-center min-h-[calc(100vh-2rem)]">
            <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md border-4 border-gray-800">
              <div className="text-center mb-6">
                <Newspaper className="w-16 h-16 mx-auto mb-4 text-blue-600" />
                <h1 className="text-4xl font-bold text-gray-800 mb-2">Headline Hunter</h1>
                <p className="text-gray-600">Can you spot the real news from the fake?</p>
              </div>

              <form onSubmit={checkPlayer} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Player UID</label>
                  <input
                    type="text"
                    value={uid}
                    onChange={(e) => setUid(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                    placeholder="Enter your UID"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors disabled:bg-gray-400 border-2 border-blue-800"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Checking...
                    </span>
                  ) : (
                    'Continue'
                  )}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* BET PHASE */}
        {gameState === 'BET' && playerData && (
          <div className="flex items-center justify-center min-h-[calc(100vh-2rem)]">
            <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md border-4 border-gray-800">
              <div className="text-center mb-6">
                <h2 className="text-3xl font-bold text-gray-800 mb-2">Welcome, {playerData.name}!</h2>
                <div className="text-2xl font-bold text-green-600 mb-4">💎 {playerData.stonks} Stonks</div>
              </div>

              <div className="bg-gray-50 rounded-lg p-6 mb-6 border-2 border-gray-300">
                <h3 className="font-bold text-lg mb-3 text-center">Game Rules</h3>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li>• Entry Fee: <span className="font-bold">{ENTRY_FEE} 💎</span></li>
                  <li>• 5 rounds of bizarre headlines</li>
                  <li>• Pick the REAL headline from 3 options</li>
                  <li>• Earn <span className="font-bold">{POINTS_PER_CORRECT} 💎</span> per correct answer</li>
                  <li>• Maximum reward: <span className="font-bold">{TOTAL_ROUNDS * POINTS_PER_CORRECT} 💎</span></li>
                </ul>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={resetGame}
                  className="flex-1 py-3 bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold rounded-lg transition-colors border-2 border-gray-500"
                >
                  Cancel
                </button>
                <button
                  onClick={payAndStart}
                  disabled={loading || playerData.stonks < ENTRY_FEE}
                  className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-colors disabled:bg-gray-400 border-2 border-green-800"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                    </span>
                  ) : (
                    `Pay ${ENTRY_FEE} 💎`
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PLAYING PHASE */}
        {gameState === 'PLAYING' && (
          <div className="flex items-center justify-center min-h-[calc(100vh-2rem)]">
            <div className="bg-white rounded-2xl shadow-2xl p-8 w-full border-4 border-gray-800">
              {/* Header */}
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">Round {currentRound}/{TOTAL_ROUNDS}</h2>
                  <p className="text-sm text-gray-600">Score: {correctCount}/{currentRound - 1}</p>
                </div>
                <div className="text-center">
                  <div className={`text-4xl font-bold mb-1 ${
                    timeLeft <= 5 ? 'text-red-600 animate-pulse' : 'text-blue-600'
                  }`}>{timeLeft}s</div>
                  <div className="text-xs text-gray-600">Time Left</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-green-600">💎 {playerData?.stonks}</div>
                  <div className="text-xs text-gray-600">+{POINTS_PER_CORRECT} per correct</div>
                </div>
              </div>

              {/* Question */}
              <div className="bg-blue-50 rounded-lg p-6 mb-6 border-2 border-blue-200">
                <h3 className="text-xl font-bold text-center text-gray-800 mb-2">
                  Which headline is REAL?
                </h3>
                <p className="text-sm text-center text-gray-600">
                  Two are fake, one actually happened!
                </p>
              </div>

              {/* Headlines */}
              {generatingHeadlines ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="w-12 h-12 animate-spin text-blue-600 mb-4" />
                  <p className="text-gray-600">Generating bizarre headlines...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {headlines.map((headline, index) => {
                    const isSelected = selectedIndex === index;
                    const showResult = selectedIndex !== null;
                    const isCorrect = headline.isReal;

                    let bgColor = 'bg-white hover:bg-gray-50';
                    let borderColor = 'border-gray-300';
                    
                    if (showResult && isSelected) {
                      if (isCorrect) {
                        bgColor = 'bg-green-100';
                        borderColor = 'border-green-500';
                      } else {
                        bgColor = 'bg-red-100';
                        borderColor = 'border-red-500';
                      }
                    } else if (showResult && isCorrect) {
                      bgColor = 'bg-green-50';
                      borderColor = 'border-green-400';
                    }

                    return (
                      <button
                        key={index}
                        onClick={() => selectHeadline(index)}
                        disabled={selectedIndex !== null}
                        className={`w-full p-6 ${bgColor} border-2 ${borderColor} rounded-lg text-left transition-all disabled:cursor-not-allowed hover:shadow-lg`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-200 flex items-center justify-center font-bold text-blue-800">
                            {String.fromCharCode(65 + index)}
                          </div>
                          <div className="flex-1">
                            <p className="text-gray-800 font-medium leading-relaxed">{headline.text}</p>
                            {showResult && isCorrect && (
                              <span className="inline-block mt-2 text-xs font-bold text-green-700 bg-green-200 px-2 py-1 rounded">
                                ✓ REAL HEADLINE
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Progress */}
              <div className="mt-6 flex gap-2">
                {Array.from({ length: TOTAL_ROUNDS }).map((_, i) => (
                  <div
                    key={i}
                    className={`flex-1 h-2 rounded-full ${
                      i < currentRound - 1
                        ? roundResults[i]?.correct
                          ? 'bg-green-500'
                          : 'bg-red-500'
                        : i === currentRound - 1
                        ? 'bg-blue-500'
                        : 'bg-gray-200'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* RESULT PHASE */}
        {gameState === 'RESULT' && (
          <div className="flex items-center justify-center min-h-[calc(100vh-2rem)]">
            <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md border-4 border-gray-800">
              <div className="text-center mb-6">
                {correctCount >= 4 ? (
                  <>
                    <Trophy className="w-20 h-20 mx-auto mb-4 text-yellow-500" />
                    <h2 className="text-4xl font-bold text-green-600 mb-2">Excellent!</h2>
                  </>
                ) : correctCount >= 3 ? (
                  <>
                    <TrendingUp className="w-20 h-20 mx-auto mb-4 text-blue-500" />
                    <h2 className="text-4xl font-bold text-blue-600 mb-2">Good Job!</h2>
                  </>
                ) : (
                  <>
                    <Newspaper className="w-20 h-20 mx-auto mb-4 text-gray-500" />
                    <h2 className="text-4xl font-bold text-gray-600 mb-2">Nice Try!</h2>
                  </>
                )}
                <p className="text-xl text-gray-700">You got {correctCount}/{TOTAL_ROUNDS} correct</p>
              </div>

              <div className="bg-gray-50 rounded-lg p-6 mb-6 border-2 border-gray-300">
                <div className="text-center mb-4">
                  <div className="text-3xl font-bold text-green-600 mb-2">
                    +{totalReward} 💎
                  </div>
                  <div className="text-sm text-gray-600">New Balance: {playerData?.stonks} 💎</div>
                </div>

                <div className="space-y-2">
                  {roundResults.map((result, index) => (
                    <div
                      key={index}
                      className={`flex items-center gap-2 text-sm p-2 rounded ${
                        result.correct ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}
                    >
                      <span className="font-bold">R{result.round}:</span>
                      <span>{result.correct ? '✓' : '✗'}</span>
                      <span className="text-xs truncate flex-1">
                        {result.correct ? 'Correct!' : 'Wrong'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={resetGame}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors border-2 border-blue-800"
              >
                Exit to Menu
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
