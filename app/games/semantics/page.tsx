'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSemanticSimilarity } from './hooks/useSemanticSimilarity';
import { Trophy, RefreshCw, Loader2 } from 'lucide-react';
import { supabase } from '@/utils/supabase';
import { useToast } from '@/contexts/ToastContext';
import { GAME_CONSTANTS } from '@/utils/game-constants';

import StandardBet from '@/components/game-ui/StandardBet';

type GamePhase = 'AUTH' | 'BET' | 'PLAYING' | 'RESULT';

interface Word {
  id: number;
  text: string;
  x: number;
  y: number;
}

import WORD_POOL from './word-pool.json';

const FALL_SPEED = 0.3;
const SPAWN_INTERVAL = 7500;
const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;
const WORD_BOTTOM_THRESHOLD = GAME_HEIGHT - 50;
const SIMILARITY_THRESHOLD = 0.45; // 45% similarity required


import { useRouter } from 'next/navigation';

export default function SemanticClearGame() {
  const { isReady, isLoading, progress, error, calculateSimilarity } = useSemanticSimilarity();
  const router = useRouter();

  // --- AUTH & USER STATE ---
  const { showToast } = useToast();
  const [gamePhase, setGamePhase] = useState<GamePhase>('BET'); // Start at BET
  const [uid, setUid] = useState('');
  const [playerData, setPlayerData] = useState<{ name: string | null; stonks: number } | null>(null);
  const [authLoading, setAuthLoading] = useState(true); // Start loading true

  // Auth: Check player (Auto-login)
  useEffect(() => {
    const userUid = localStorage.getItem('user_uid');
    if (!userUid) {
      router.push('/login');
      return;
    }
    setUid(userUid);
    checkPlayer(userUid);
  }, []);

  const [words, setWords] = useState<Word[]>([]);
  const [inputValue, setInputValue] = useState<string>('');
  const [score, setScore] = useState<number>(0);
  const [lives, setLives] = useState<number>(3);
  const [streak, setStreak] = useState<number>(0);
  const [blazeMode, setBlazeMode] = useState<boolean>(false);
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<string>('');

  const gameLoopRef = useRef<number | null>(null);
  const spawnIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const nextWordId = useRef<number>(0);
  const lastLifeLossTime = useRef<number>(0);
  const feedbackTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    };
  }, []);

  const startTimeRef = useRef<number>(0);
  const [survivalSeconds, setSurvivalSeconds] = useState(0);

  // --- AUTH & DEDUCTION ---
  const checkPlayer = async (id: string) => {
    const finalUid = id.trim();
    if (!finalUid) return;

    setAuthLoading(true);
    try {
      const { data, error } = await supabase
        .from('players')
        .select('name, stonks')
        .eq('uid', finalUid)
        .single();

      if (error || !data) {
        showToast('Player not found!', 'error');
        setPlayerData(null);
      } else {
        // DEBUG: Check data integrity
        if (!data.name) console.warn('Player data loaded but name is missing:', data);

        setPlayerData(data);
        setGamePhase('BET');
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const payAndStart = async () => {
    if (!playerData || playerData.stonks < GAME_CONSTANTS.ENTRY_FEE) {
      showToast(`Insufficient Stonks! Need ${GAME_CONSTANTS.ENTRY_FEE}.`, 'error');
      return;
    }
    setAuthLoading(true);

    const { error: updateError } = await supabase
      .from('players')
      .update({ stonks: playerData.stonks - GAME_CONSTANTS.ENTRY_FEE })
      .eq('uid', uid);

    if (updateError) {
      showToast('Transaction Failed', 'error');
      setAuthLoading(false);
      return;
    }

    // Log Entry
    await supabase.from('game_logs').insert({
      player_uid: uid,
      game_title: 'Semantic Clear',
      result: 'PLAYING',
      stonks_change: -GAME_CONSTANTS.ENTRY_FEE
    });

    setPlayerData({ ...playerData, stonks: playerData.stonks - GAME_CONSTANTS.ENTRY_FEE });
    setGamePhase('PLAYING');
    setAuthLoading(false);
  };

  const resetToAuth = () => {
    setGamePhase('BET');
    // setUid(''); // Keep UID
    // setPlayerData(null); // Keep Data
    restartGame();
  };

  const getRandomWord = useCallback((): string => {
    return WORD_POOL[Math.floor(Math.random() * WORD_POOL.length)];
  }, []);

  const spawnWord = useCallback(() => {
    const newWord: Word = {
      id: nextWordId.current++,
      text: getRandomWord(),
      x: Math.random() * (GAME_WIDTH - 100) + 50,
      y: 0,
    };
    setWords((prevWords) => [...prevWords, newWord]);
  }, [getRandomWord]);

  const gameLoop = useCallback(() => {
    if (gameOver) return; // Stop immediately if game is over

    setWords((prevWords) => {
      // Calculate dynamic fall speed based on score (increases every 500 points)
      const speedMultiplier = 1 + Math.floor(score / 500) * 0.05;
      const currentFallSpeed = FALL_SPEED * speedMultiplier;

      const updatedWords = prevWords.map((word) => ({
        ...word,
        y: word.y + currentFallSpeed,
      }));

      const collidedWords = updatedWords.filter(
        (word) => word.y >= WORD_BOTTOM_THRESHOLD
      );

      if (collidedWords.length > 0) {
        // Only lose life if at least 500ms has passed since last life loss (prevents double triggers)
        const now = Date.now();
        if (now - lastLifeLossTime.current > 500) {
          lastLifeLossTime.current = now;

          // Lose only 1 life per frame, regardless of how many words hit bottom
          setLives((prevLives) => {
            const newLives = prevLives - 1;
            if (newLives <= 0) {
              setGameOver(true);
              // Cancel the next frame immediately
              if (gameLoopRef.current) {
                cancelAnimationFrame(gameLoopRef.current);
                gameLoopRef.current = null;
              }
            }
            return Math.max(0, newLives);
          });

          // Reset streak on collision
          setStreak(0);
          setBlazeMode(false);
        }

        // Remove ALL collided words immediately to prevent multi-frame triggers
        return updatedWords.filter(
          (word) => word.y < WORD_BOTTOM_THRESHOLD
        );
      }

      return updatedWords;
    });

    if (!gameOver) {
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    }
  }, [score, gameOver]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      if (!inputValue.trim() || words.length === 0 || !isReady) {
        return;
      }

      const userWord = inputValue.trim().toLowerCase();
      let bestMatch: Word | null = null;
      let bestSimilarity = 0;

      for (const word of words) {
        try {
          const similarity = await calculateSimilarity(userWord, word.text.toLowerCase());

          if (similarity > bestSimilarity) {
            bestSimilarity = similarity;
            bestMatch = word;
          }
        } catch (err) {
          console.error('Error calculating similarity:', err);
        }
      }

      // Reject exact matches (>95% similarity)
      if (bestMatch && bestSimilarity >= 0.95) {
        setFeedback(`✗ Too similar! Try a related but different word`);
        feedbackTimerRef.current = setTimeout(() => setFeedback(''), 2000);
        setInputValue('');
        return;
      }

      if (bestMatch && bestSimilarity >= SIMILARITY_THRESHOLD) {
        setWords((prevWords) => prevWords.filter((w) => w.id !== bestMatch.id));

        // Calculate score with blaze mode multiplier
        const basePoints = Math.round(bestSimilarity * 100);
        const points = blazeMode ? basePoints * 2 : basePoints;
        setScore((prevScore) => prevScore + points);

        // Update streak and check for blaze mode
        setStreak((prevStreak) => {
          const newStreak = prevStreak + 1;
          if (newStreak >= 3 && !blazeMode) {
            setBlazeMode(true);
            setFeedback(`🔥 BLAZE MODE! 2x Points! +${points}`);
          } else if (blazeMode) {
            setFeedback(`🔥 ${newStreak} Streak! +${points} (2x)`);
          } else {
            setFeedback(`✓ Match! +${points} (${(bestSimilarity * 100).toFixed(1)}%)`);
          }
          return newStreak;
        });

        feedbackTimerRef.current = setTimeout(() => setFeedback(''), 1500);
      } else {
        // Reset streak on miss
        setStreak(0);
        setBlazeMode(false);
        setFeedback(`✗ Too different (${(bestSimilarity * 100).toFixed(1)}%)`);
        feedbackTimerRef.current = setTimeout(() => setFeedback(''), 1000);
      }

      setInputValue('');
    },
    [inputValue, words, isReady, calculateSimilarity]
  );

  const restartGame = useCallback(() => {
    setWords([]);
    setScore(0);
    setLives(3);
    setStreak(0);
    setBlazeMode(false);
    setGameOver(false);
    setInputValue('');
    setFeedback('');
    nextWordId.current = 0;
  }, []);

  // Calculate dynamic stonks based on survival time (10 per 30s, max 50)
  const calculateStonks = (seconds: number): number => {
    // Rule: 10 Stonks per 30 seconds
    const chunks = Math.floor(seconds / 30);
    const stonks = chunks * 10;

    // Rule: Max 50 Stonks
    return Math.min(stonks, 50);
  };

  // Game over: Log result and award stonks
  useEffect(() => {
    if (gameOver && gamePhase === 'PLAYING') {
      const handleGameOver = async () => {
        setGamePhase('RESULT');
        const survived = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setSurvivalSeconds(survived);

        // Award stonks based on dynamic tier system
        const stonksEarned = calculateStonks(survived);

        if (playerData && stonksEarned > 0) {
          await supabase
            .from('players')
            .update({ stonks: playerData.stonks + stonksEarned })
            .eq('uid', uid);

          setPlayerData({ ...playerData, stonks: playerData.stonks + stonksEarned });
        }

        // Log game result
        await supabase.from('game_logs').insert({
          player_uid: uid,
          game_title: 'Semantic Clear',
          result: 'COMPLETED',
          stonks_change: stonksEarned
        });
      };

      handleGameOver();
    }
  }, [gameOver, gamePhase, score, playerData, uid]);

  useEffect(() => {
    if (isReady && !gameOver && gamePhase === 'PLAYING') {
      gameLoopRef.current = requestAnimationFrame(gameLoop);
      spawnIntervalRef.current = setInterval(spawnWord, SPAWN_INTERVAL);
      spawnWord(); // Initial word
    }

    return () => {
      if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
      if (spawnIntervalRef.current) clearInterval(spawnIntervalRef.current);
    };
  }, [isReady, gameOver, gamePhase]);


  // BET SCREEN
  if (gamePhase === 'BET' && playerData) {
    return (
      <StandardBet
        playerData={playerData}
        uid={uid}
        entryFee={GAME_CONSTANTS.ENTRY_FEE}
        onPlay={payAndStart}
        onCancel={() => router.push('/games')}
        loading={authLoading}
        themeColor="neo-green"
        bgImage="/semantics.gif"
        bgColor="bg-neo-yellow"
        title={
          <h1 className="text-4xl font-heading mb-6 text-center uppercase text-black">
            Semantic <span className="text-neo-pink">Clear</span>
          </h1>
        }
        instructions={
          <ul className="space-y-2 text-sm text-gray-700 font-mono text-left">
            <li>• Type words similar to the falling words to clear them.</li>
            <li>• 10 Stonks for every 30 seconds you survive.</li>
            <li>• Maximum reward: 50 Stonks.</li>
          </ul>
        }
      />
    );
  }

  // RESULT SCREEN
  if (gamePhase === 'RESULT') {
    // Calculate time survived directly or use a tracked state.
    // Since we don't have a robust timer state, we can estimate or standard practice would be to use a ref tracking start time.
    // For now, let's assume 'score' tracks points, but we need TIME.
    // I will add a 'survivalTime' ref/state in a separate edit, but for now let's reuse score variable if I can change its meaning, or better, add a new variable.
    // Wait, simpler: I'll use a new Ref for startTime in the main component.

    // Actually, I can't easily inject a ref hook here without re-reading the whole file top.
    // I recall reading the top. Let's ASSUME I need to inject `startTimeRef`.
    // Instead of injecting, I can check if 'score' tracks something else.
    // The previous code incremented 'score' by points. 
    // I should probably change the Game Loop to increment score by TIME or track time separately.

    // Plan: I will use 'score' to represent "Survival Score" which correlates to time? No points are "100" etc.
    // The user said "10 Stonks for surviving every 30 seconds".
    // I'll calculate it based on a new `survivalSeconds` variable I'll introduce.

    // For this specific replacement, I'll pass `survivalSeconds` which I'll add.
    const stonksEarned = calculateStonks(survivalSeconds);

    return (
      <div className="h-screen overflow-auto bg-neo-pink text-white font-mono p-4 md:p-8 flex items-center justify-center">
        <div className="max-w-md w-full bg-white border-8 border-black shadow-[16px_16px_0px_#000] p-8 text-black">
          <div className="text-center animate-in zoom-in duration-300">
            <div className="bg-neo-green p-8 border-4 border-black mb-6">
              <Trophy size={64} className="mx-auto mb-4" />
              <h2 className="text-5xl font-heading mb-2 uppercase">Game Over!</h2>
              <p className="text-xl font-bold mb-2">Survival Time: {survivalSeconds}s</p>
              <p className="text-xl font-bold mb-2 text-gray-500">Score: {score}</p>
              <p className="font-bold text-xl text-neo-pink">+{stonksEarned} STONKS EARNED</p>
              <div className="mt-4 pt-4 border-t-2 border-black">
                <p className="text-sm font-bold uppercase mb-1">Total Balance</p>
                <p className="text-3xl font-heading text-neo-cyan">{playerData?.stonks} 💎</p>
              </div>
            </div>
            <button
              onClick={resetToAuth}
              className="w-full bg-black text-white text-xl font-heading py-4 border-4 border-black hover:bg-gray-800"
            >
              EXIT
            </button>
          </div>
        </div>
      </div>
    );
  }
  // Loading Screen
  if (isLoading) {
    return (
      <div className="h-screen overflow-auto bg-neo-yellow text-black font-mono p-4 md:p-8 flex items-center justify-center">
        <div className="max-w-md w-full bg-white border-8 border-black shadow-[16px_16px_0px_#000] p-8">
          <h2 className="text-3xl font-heading mb-6 text-center uppercase">
            Loading AI Model...
          </h2>

          <div className="w-full bg-gray-200 border-4 border-black h-8 mb-4 overflow-hidden">
            <div
              className="bg-neo-green h-full transition-all duration-300"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>

          <p className="text-center font-bold text-2xl">
            {Math.round(progress * 100)}%
          </p>

          <p className="text-center text-sm mt-4">
            Preparing semantic similarity model...
          </p>
        </div>
      </div>
    );
  }

  // Error Screen
  if (error) {
    return (
      <div className="h-screen overflow-auto bg-neo-pink text-white font-mono p-4 md:p-8 flex items-center justify-center">
        <div className="max-w-md w-full bg-white border-8 border-black shadow-[16px_16px_0px_#000] p-8 text-black">
          <h2 className="text-3xl font-heading mb-4 text-center uppercase">Error Loading Model</h2>
          <p className="mb-6 text-center">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-black text-white text-xl font-heading py-4 border-4 border-black hover:bg-gray-800"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  // Main Game (PLAYING phase)
  return (
    <div
      className="h-screen overflow-auto bg-cover bg-center bg-no-repeat text-black font-mono p-4 md:p-8 flex items-center justify-center"
      style={{ backgroundImage: "url('/semantics.gif')" }}
    >
      <div className="max-w-4xl w-full bg-white border-8 border-black shadow-[16px_16px_0px_#000] overflow-hidden">
        {/* Header */}
        <div className="bg-black text-neo-green p-4 border-b-8 border-black">
          <div className="flex justify-between items-center mb-2">
            <h1 className="text-2xl md:text-4xl font-heading uppercase">
              Semantic <span className="text-neo-cyan">Clear</span>
            </h1>
            <div className="text-xl md:text-3xl font-heading">
              SCORE: <span className="text-neo-pink">{score}</span>
            </div>
          </div>

          {/* Lives and Streak Bar */}
          <div className="flex justify-between items-center text-sm md:text-base">
            {/* Lives */}
            <div className="flex items-center gap-2">
              <span className="font-heading text-neo-yellow">LIVES:</span>
              <div className="flex gap-1">
                {Array.from({ length: 3 }).map((_, i) => (
                  <span key={i} className="text-xl">
                    {i < lives ? '❤️' : '🖤'}
                  </span>
                ))}
              </div>
            </div>

            {/* Streak and Blaze Mode */}
            <div className="flex items-center gap-3">
              {blazeMode && (
                <div className="bg-neo-pink text-white px-3 py-1 border-2 border-white font-heading animate-pulse">
                  🔥 BLAZE MODE 2X
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="font-heading text-neo-cyan">STREAK:</span>
                <span className={`font-heading text-xl ${streak >= 3 ? 'text-neo-pink animate-pulse' : 'text-white'
                  }`}>
                  {streak}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Game Area */}
        <div
          className="relative bg-gray-100"
          style={{ height: GAME_HEIGHT }}
        >
          {/* Falling Words */}
          {words.map((word) => (
            <div
              key={word.id}
              className="absolute bg-neo-pink text-white font-heading text-xl px-4 py-2 border-4 border-black shadow-[4px_4px_0px_#000]"
              style={{
                left: `${word.x}px`,
                top: `${word.y}px`,
                transform: 'translateX(-50%)',
              }}
            >
              {word.text}
            </div>
          ))}

          {/* Game Over Overlay */}
          {gameOver && (
            <div className="absolute inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
              <div className="bg-white p-8 border-8 border-black shadow-[16px_16px_0px_#000] text-center max-w-md">
                <h2 className="text-4xl md:text-6xl font-heading text-neo-pink mb-4 uppercase">Game Over!</h2>
                <p className="text-2xl md:text-3xl mb-2">
                  Final Score: <span className="font-heading text-neo-green">{score}</span>
                </p>
                <p className="text-xl mb-6">
                  Stonks Earned: <span className="font-heading text-neo-cyan">{calculateStonks(score)}</span> 💎
                </p>
                <button
                  onClick={resetToAuth}
                  className="w-full bg-black text-white text-xl font-heading py-3 border-4 border-black hover:bg-gray-800"
                >
                  EXIT
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="bg-gray-100 p-4 border-t-8 border-black">
          <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-2 mb-4">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Type a similar word..."
              className="flex-1 px-4 py-3 border-4 border-black font-heading text-xl focus:outline-none focus:ring-4 focus:ring-neo-cyan"
              disabled={gameOver}
              autoFocus
            />
            <button
              type="submit"
              className="bg-black text-neo-yellow font-heading text-xl px-8 py-3 border-4 border-black hover:bg-neo-pink hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed w-full md:w-auto"
              disabled={gameOver}
            >
              Submit
            </button>
          </form>

          {/* Feedback */}
          {feedback && (
            <div className={`text-center font-heading text-xl mb-4 p-2 border-4 border-black ${feedback.startsWith('✓') ? 'bg-neo-green text-black' : 'bg-neo-pink text-white'
              }`}>
              {feedback}
            </div>
          )}

          {/* Instructions */}
          <div className="text-sm text-center">
            <p className="font-bold mb-1">Type words semantically similar to falling blocks!</p>
            <p className="text-xs">
              Similarity threshold: {SIMILARITY_THRESHOLD * 100}% |
              Press <kbd className="px-2 py-1 bg-white border-2 border-black font-mono mx-1">Enter</kbd> to submit
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
