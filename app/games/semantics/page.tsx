'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSemanticSimilarity } from './hooks/useSemanticSimilarity';
import { Trophy, RefreshCw, Loader2 } from 'lucide-react';
import { supabase } from '@/utils/supabase';

type GamePhase = 'AUTH' | 'BET' | 'PLAYING' | 'RESULT';

interface Word {
  id: number;
  text: string;
  x: number;
  y: number;
}

const WORD_POOL: string[] = [
  'happy', 'joyful', 'cheerful', 'delighted', 
  'sad', 'unhappy', 'sorrowful', 'melancholy',
  'car', 'vehicle', 'automobile', 'truck',
  'house', 'home', 'building', 'residence',
  'dog', 'puppy', 'canine', 'hound',
  'cat', 'kitten', 'feline', 'kitty',
  'book', 'novel', 'tome', 'literature',
  'ocean', 'sea', 'water', 'marine',
  'mountain', 'peak', 'summit', 'hill',
  'forest', 'woods', 'woodland', 'trees',
  'computer', 'laptop', 'machine', 'device',
  'phone', 'smartphone', 'mobile', 'cellphone',
  'friend', 'buddy', 'pal', 'companion',
  'teacher', 'instructor', 'educator', 'professor',
  'food', 'meal', 'dish', 'cuisine',
  'music', 'melody', 'harmony', 'sound',
  'fast', 'quick', 'rapid', 'swift',
  'slow', 'sluggish', 'gradual', 'leisurely',
  'big', 'large', 'huge', 'enormous',
  'small', 'tiny', 'little', 'miniature',
  
  // Add more diverse words
  'brilliant', 'intelligent', 'smart', 'clever',
  'strong', 'powerful', 'mighty', 'robust',
  'weak', 'feeble', 'frail', 'fragile',
  'beautiful', 'gorgeous', 'stunning', 'lovely',
  'ugly', 'hideous', 'unattractive', 'unsightly',
  'hot', 'warm', 'heated', 'scorching',
  'cold', 'freezing', 'chilly', 'icy',
  'bright', 'luminous', 'radiant', 'shining',
  'dark', 'dim', 'gloomy', 'shadowy',
  'loud', 'noisy', 'deafening', 'thunderous',
  'quiet', 'silent', 'hushed', 'peaceful',
  'rich', 'wealthy', 'affluent', 'prosperous',
  'poor', 'impoverished', 'destitute', 'needy',
  'old', 'ancient', 'aged', 'elderly',
  'young', 'youthful', 'juvenile', 'adolescent',
  'new', 'fresh', 'novel', 'modern',
  
  // Nature & Elements
  'fire', 'flame', 'blaze', 'inferno',
  'rain', 'shower', 'drizzle', 'downpour',
  'snow', 'frost', 'ice', 'blizzard',
  'wind', 'breeze', 'gust', 'gale',
  'sun', 'sunshine', 'daylight', 'solar',
  'moon', 'lunar', 'celestial', 'nighttime',
  'star', 'stellar', 'cosmos', 'heavenly',
  'cloud', 'overcast', 'misty', 'foggy',
  'thunder', 'lightning', 'storm', 'tempest',
  'earthquake', 'tremor', 'quake', 'seismic',
  'volcano', 'lava', 'magma', 'eruption',
  'river', 'stream', 'creek', 'tributary',
  'lake', 'pond', 'lagoon', 'reservoir',
  'beach', 'shore', 'coast', 'seaside',
  'island', 'isle', 'atoll', 'archipelago',
  'desert', 'arid', 'wasteland', 'dunes',
  'jungle', 'rainforest', 'wilderness', 'tropical',
  'meadow', 'field', 'prairie', 'grassland',
  'valley', 'canyon', 'gorge', 'ravine',
  'cave', 'cavern', 'grotto', 'hollow',
  
  // Abstract Concepts
  'love', 'affection', 'adoration', 'devotion',
  'hate', 'loathing', 'abhorrence', 'disdain',
  'peace', 'harmony', 'tranquility', 'serenity',
  'war', 'conflict', 'battle', 'combat',
  'hope', 'optimism', 'faith', 'aspiration',
  'fear', 'dread', 'terror', 'phobia',
  'courage', 'bravery', 'valor', 'heroism',
  'wisdom', 'knowledge', 'insight', 'understanding',
  'freedom', 'liberty', 'independence', 'autonomy',
  'justice', 'fairness', 'equity', 'righteousness',
  'truth', 'honesty', 'veracity', 'authenticity',
  'beauty', 'elegance', 'grace', 'aesthetics',
  'chaos', 'disorder', 'turmoil', 'confusion',
  'order', 'organization', 'system', 'structure',
  'power', 'strength', 'force', 'might',
  'weakness', 'vulnerability', 'fragility', 'feebleness',
  
  // Science & Tech
  'robot', 'android', 'automaton', 'machine',
  'algorithm', 'procedure', 'formula', 'method',
  'data', 'information', 'statistics', 'metrics',
  'network', 'connection', 'link', 'infrastructure',
  'energy', 'power', 'electricity', 'voltage',
  'atom', 'molecule', 'particle', 'element',
  'gravity', 'force', 'attraction', 'pull',
  'space', 'universe', 'cosmos', 'galaxy',
  'planet', 'world', 'sphere', 'globe',
  'rocket', 'spacecraft', 'shuttle', 'vessel',
  'satellite', 'orbiter', 'probe', 'transmission',
  'experiment', 'test', 'trial', 'research',
  'theory', 'hypothesis', 'concept', 'idea',
  'discovery', 'finding', 'breakthrough', 'revelation',
  
  // Actions & Motion
  'run', 'sprint', 'dash', 'race',
  'walk', 'stroll', 'wander', 'amble',
  'jump', 'leap', 'hop', 'bound',
  'fly', 'soar', 'glide', 'hover',
  'swim', 'dive', 'plunge', 'submerge',
  'climb', 'ascend', 'scale', 'mount',
  'fall', 'drop', 'plummet', 'descend',
  'push', 'shove', 'thrust', 'propel',
  'pull', 'tug', 'drag', 'haul',
  'throw', 'toss', 'hurl', 'fling',
  'catch', 'grab', 'seize', 'snatch',
  'build', 'construct', 'create', 'assemble',
  'destroy', 'demolish', 'ruin', 'wreck',
  'fix', 'repair', 'mend', 'restore',
  'break', 'shatter', 'fracture', 'crack',
  
  // More Diverse  
  'glacier', 'iceberg', 'tundra', 'arctic',
  'tsunami', 'wave', 'surge', 'flood',
  'avalanche', 'landslide', 'rockslide', 'cascade',
  'harvest', 'crop', 'yield', 'produce',
  'festival', 'celebration', 'carnival', 'ceremony',
  'journey', 'voyage', 'expedition', 'trek',
  'adventure', 'quest', 'mission', 'odyssey',
  'mystery', 'puzzle', 'enigma', 'riddle',
  'magic', 'sorcery', 'witchcraft', 'enchantment',
  'dream', 'vision', 'fantasy', 'imagination',
  'reality', 'actuality', 'existence', 'truth',
  'memory', 'recollection', 'remembrance', 'reminiscence',
  'future', 'tomorrow', 'destiny', 'fate',
  'past', 'history', 'yesterday', 'antiquity',
  'present', 'now', 'current', 'contemporary',
];

const FALL_SPEED = 0.3;
const SPAWN_INTERVAL = 7500;
const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;
const WORD_BOTTOM_THRESHOLD = GAME_HEIGHT - 50;
const SIMILARITY_THRESHOLD = 0.45; // 45% similarity required

export default function SemanticClearGame() {
  const { isReady, isLoading, progress, error, calculateSimilarity } = useSemanticSimilarity();
  
  // --- AUTH & USER STATE ---
  const [gamePhase, setGamePhase] = useState<GamePhase>('AUTH');
  const [uid, setUid] = useState('');
  const [playerData, setPlayerData] = useState<{ name: string | null; stonks: number } | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  
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

  // --- AUTH & DEDUCTION ---
  const checkPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
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

    // Log Entry
    await supabase.from('game_logs').insert({
      player_uid: uid,
      game_title: 'Semantic Clear',
      result: 'PLAYING',
      stonks_change: -20
    });

    setPlayerData({ ...playerData, stonks: playerData.stonks - 20 });
    setGamePhase('PLAYING');
    setAuthLoading(false);
  };

  const resetToAuth = () => {
    setGamePhase('AUTH');
    setUid('');
    setPlayerData(null);
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
        setTimeout(() => setFeedback(''), 2000);
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
        
        setTimeout(() => setFeedback(''), 1500);
      } else {
        // Reset streak on miss
        setStreak(0);
        setBlazeMode(false);
        setFeedback(`✗ Too different (${(bestSimilarity * 100).toFixed(1)}%)`);
        setTimeout(() => setFeedback(''), 1000);
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
    
    // Stay in PLAYING phase for rematch
    if (gamePhase === 'RESULT') {
      setGamePhase('PLAYING');
    }
  }, [gamePhase]);

  // Calculate dynamic stonks based on score tiers
  const calculateStonks = (score: number): number => {
    let stonks = 0;
    
    // 100-500 points: 2 stonks per 100 points
    if (score >= 100) {
      const tier1Points = Math.min(score, 500);
      stonks += Math.floor(tier1Points / 100) * 2;
    }
    
    // 500-1000 points: 4 stonks per 100 points
    if (score > 500) {
      const tier2Points = Math.min(score - 500, 500);
      stonks += Math.floor(tier2Points / 100) * 4;
    }
    
    // 1000-2000 points: 8 stonks per 100 points
    if (score > 1000) {
      const tier3Points = Math.min(score - 1000, 1000);
      stonks += Math.floor(tier3Points / 100) * 6;
    }
    
    // 2000+ points: 16 stonks per 100 points
    if (score > 2000) {
      const tier4Points = score - 2000;
      stonks += Math.floor(tier4Points / 100) * 10;
    }
    
    return stonks;
  };

  // Game over: Log result and award stonks
  useEffect(() => {
    if (gameOver && gamePhase === 'PLAYING') {
      const handleGameOver = async () => {
        setGamePhase('RESULT');
        
        // Award stonks based on dynamic tier system
        const stonksEarned = calculateStonks(score);
        
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
  // AUTH SCREEN
  if (gamePhase === 'AUTH') {
    return (
      <div className="min-h-screen bg-neo-cyan text-black font-mono p-4 md:p-8 flex items-center justify-center">
        <div className="max-w-md w-full bg-white border-8 border-black shadow-[16px_16px_0px_#000] p-8">
          <h1 className="text-4xl font-heading mb-6 text-center uppercase">
            Semantic <span className="text-neo-pink">Clear</span>
          </h1>
          <p className="mb-6 text-center font-bold text-lg">Enter your Player ID to start</p>
          <form onSubmit={checkPlayer} className="space-y-4">
            <input
              type="text"
              value={uid}
              onChange={(e) => setUid(e.target.value)}
              required
              className="w-full text-4xl font-heading p-4 border-4 border-black text-center"
              placeholder="23BAI..."
              autoFocus
            />
            <button
              disabled={authLoading}
              className="w-full bg-black text-white text-2xl font-heading py-4 hover:bg-neo-green hover:text-black transition-colors"
            >
              {authLoading ? <Loader2 className="animate-spin mx-auto" /> : 'VERIFY PLAYER'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // BET SCREEN
  if (gamePhase === 'BET' && playerData) {
    return (
      <div className="min-h-screen bg-neo-yellow text-black font-mono p-4 md:p-8 flex items-center justify-center">
        <div className="max-w-md w-full bg-white border-8 border-black shadow-[16px_16px_0px_#000] p-8">
          <h1 className="text-4xl font-heading mb-6 text-center uppercase">
            Semantic <span className="text-neo-pink">Clear</span>
          </h1>
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">PLAYER: {playerData.name || uid}</h2>
            <div className="text-4xl font-heading mb-6">BALANCE: {playerData.stonks} 💎</div>
            {playerData.stonks >= 20 ? (
              <button
                onClick={payAndStart}
                disabled={authLoading}
                className="w-full bg-neo-green text-black text-3xl font-heading py-6 border-4 border-black shadow-[16px_16px_0px_#000] hover:translate-y-1 hover:shadow-none transition-all"
              >
                {authLoading ? 'PROCESSING...' : 'PAY 20 & START'}
              </button>
            ) : (
              <div className="bg-red-500 text-white p-4 font-bold text-xl border-4 border-black">
                INSUFFICIENT FUNDS
              </div>
            )}
            <button onClick={resetToAuth} className="mt-4 underline hover:text-neo-pink">
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // RESULT SCREEN
  if (gamePhase === 'RESULT') {
    const stonksEarned = calculateStonks(score);
    
    return (
      <div className="min-h-screen bg-neo-pink text-white font-mono p-4 md:p-8 flex items-center justify-center">
        <div className="max-w-md w-full bg-white border-8 border-black shadow-[16px_16px_0px_#000] p-8 text-black">
          <div className="text-center animate-in zoom-in duration-300">
            <div className="bg-neo-green p-8 border-4 border-black mb-6">
              <Trophy size={64} className="mx-auto mb-4" />
              <h2 className="text-5xl font-heading mb-2 uppercase">Game Over!</h2>
              <p className="text-3xl font-bold mb-2">Score: {score}</p>
              <p className="font-bold text-xl text-neo-pink">+{stonksEarned} STONKS EARNED</p>
            </div>
            <button
              onClick={restartGame}
              className="w-full bg-white text-black text-2xl font-heading py-4 border-4 border-black mb-4 shadow-[16px_16px_0px_#000] hover:translate-y-1 hover:shadow-none flex items-center justify-center gap-2"
            >
              <RefreshCw /> PLAY AGAIN (SAME PLAYER)
            </button>
            <button
              onClick={resetToAuth}
              className="w-full bg-black text-white text-xl font-heading py-4 border-4 border-black hover:bg-gray-800"
            >
              NEW PLAYER
            </button>
          </div>
        </div>
      </div>
    );
  }
  // Loading Screen
  if (isLoading) {
    return (
      <div className="min-h-screen bg-neo-yellow text-black font-mono p-4 md:p-8 flex items-center justify-center">
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
      <div className="min-h-screen bg-neo-pink text-white font-mono p-4 md:p-8 flex items-center justify-center">
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
    <div className="min-h-screen bg-neo-yellow text-black font-mono p-4 md:p-8 flex items-center justify-center">
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
                <span className={`font-heading text-xl ${
                  streak >= 3 ? 'text-neo-pink animate-pulse' : 'text-white'
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
                  onClick={restartGame}
                  className="w-full bg-neo-green text-black text-2xl font-heading py-4 border-4 border-black shadow-[4px_4px_0px_#000] hover:translate-y-1 hover:shadow-none transition-all flex items-center justify-center gap-2 mb-2"
                >
                  <RefreshCw /> Play Again
                </button>
                <button
                  onClick={resetToAuth}
                  className="w-full bg-black text-white text-xl font-heading py-3 border-4 border-black hover:bg-gray-800"
                >
                  New Player
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="bg-gray-100 p-4 border-t-8 border-black">
          <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
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
              className="bg-black text-neo-yellow font-heading text-xl px-8 py-3 border-4 border-black hover:bg-neo-pink hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={gameOver}
            >
              Submit
            </button>
          </form>
          
          {/* Feedback */}
          {feedback && (
            <div className={`text-center font-heading text-xl mb-4 p-2 border-4 border-black ${
              feedback.startsWith('✓') ? 'bg-neo-green text-black' : 'bg-neo-pink text-white'
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
