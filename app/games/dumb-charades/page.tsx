'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { GameEntry, RoundData, GameState } from './types';
import gameData from './game-data.json';
import { supabase } from '@/utils/supabase';
import { useToast } from '@/contexts/ToastContext';
import { GAME_CONSTANTS } from '@/utils/game-constants';
import StandardBet from '@/components/game-ui/StandardBet';
import { useApiKeys } from '@/contexts/ApiKeyContext';

type GamePhase = 'AUTH' | 'BET' | 'PLAYING' | 'RESULT';


import { useRouter } from 'next/navigation';

export default function DumbCharadesGame() {
  const router = useRouter();
  const { showToast } = useToast();
  const [gamePhase, setGamePhase] = useState<GamePhase>('BET'); // Start at BET
  const [uid, setUid] = useState('');
  const [playerData, setPlayerData] = useState<{ name: string | null; stonks: number } | null>(null);
  const [authLoading, setAuthLoading] = useState(true); // Start loading true
  const { groqKey, setModalOpen } = useApiKeys();

  // ... (rest of state)

  // Added timeLeft to state
  const [gameState, setGameState] = useState<GameState & { timeLeft: number }>({
    round: 0,
    stonks: 0,
    currentRoundData: null,
    gameOver: false,
    selectedAnswer: null,
    showFeedback: false,
    timeLeft: 10, // Initialize with 10 seconds
  });

  const [isPressed, setIsPressed] = useState<string | null>(null);
  const [usedEntryIds, setUsedEntryIds] = useState<(string | number)[]>([]);

  // Timer refs
  const feedbackRef = useRef<NodeJS.Timeout | null>(null);
  const nextRoundRef = useRef<NodeJS.Timeout | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (feedbackRef.current) clearTimeout(feedbackRef.current);
      if (nextRoundRef.current) clearTimeout(nextRoundRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Timer Logic
  useEffect(() => {
    // Only run timer if we are in PLAYING phase, feedback is NOT showing, and game is NOT over
    if (gamePhase === 'PLAYING' && !gameState.showFeedback && !gameState.gameOver && gameState.currentRoundData) {
      timerRef.current = setInterval(() => {
        setGameState(prev => {
          if (prev.timeLeft <= 1) {
            // Time is up!
            clearInterval(timerRef.current!);
            handleTimeout();
            return { ...prev, timeLeft: 0 };
          }
          return { ...prev, timeLeft: prev.timeLeft - 1 };
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gamePhase, gameState.showFeedback, gameState.gameOver, gameState.currentRoundData]); // Dependencies for timer

  const handleTimeout = () => {
    // Treat as wrong answer
    setGameState(prev => ({ ...prev, showFeedback: true, selectedAnswer: null })); // selectedAnswer null means timeout/wrong implies logic check below

    // Delay then move to next round
    nextRoundRef.current = setTimeout(async () => {
      if (gameState.round >= 4) {
        endGame();
      } else {
        const nextRoundData = await generateRound();
        setGameState(prev => ({
          ...prev,
          round: prev.round + 1,
          currentRoundData: nextRoundData,
          selectedAnswer: null,
          showFeedback: false,
          timeLeft: 10, // Reset timer
        }));
      }
    }, 1500);
  };

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

  const checkPlayer = async (checkUid: string) => {
    setAuthLoading(true);
    try {
      const { data, error } = await supabase
        .from('players')
        .select('name, stonks')
        .eq('uid', checkUid)
        .single();

      if (error || !data) {
        showToast('Player data not found!', 'error');
        // router.push('/login');
      } else {
        setPlayerData(data);
        // GamePhase is already BET
      }
    } finally {
      setAuthLoading(false);
    }
  };

  // ... (rest of component logic)


  // Pay 20 Stonks and start game
  const payAndStart = async () => {
    if (!playerData || playerData.stonks < GAME_CONSTANTS.ENTRY_FEE) {
      showToast(`Insufficient Stonks! You need ${GAME_CONSTANTS.ENTRY_FEE} Stonks to play.`, 'error');
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
      game_title: 'Dumb Charades',
      result: 'PLAYING',
      stonks_change: -GAME_CONSTANTS.ENTRY_FEE
    });

    setPlayerData({ ...playerData, stonks: playerData.stonks - GAME_CONSTANTS.ENTRY_FEE });
    setGamePhase('PLAYING');
    setAuthLoading(false);
  };

  const resetToAuth = () => {
    setGamePhase('AUTH');
    setUid('');
    setPlayerData(null);
    setUsedEntryIds([]);
    setGameState({
      round: 0,
      stonks: 0,
      currentRoundData: null,
      gameOver: false,
      selectedAnswer: null,
      showFeedback: false,
      timeLeft: 10,
    });
  };

  // Shuffle array utility
  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // Generate round data
  const generateRound = async (): Promise<RoundData> => {
    const data = gameData as GameEntry[];

    // Filter out already used entries
    const availableEntries = data.filter(entry => !usedEntryIds.includes(entry.id));

    // If we've used all entries, reset
    if (availableEntries.length === 0) {
      setUsedEntryIds([]);
      return generateRound();
    }

    // Pick a random correct entry from available ones
    const correctEntry = availableEntries[Math.floor(Math.random() * availableEntries.length)];

    // Mark this entry as used
    setUsedEntryIds(prev => [...prev, correctEntry.id]);

    try {
      // Generate 3 options (1 correct + 2 decoys) using Groq
      const response = await fetch('/api/groq', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-groq-api-key': groqKey || ''
        },
        body: JSON.stringify({
          messages: [{
            sender: 'system',
            text: `Generate exactly 3 image descriptions for a charades game. The first one should accurately describe: "${correctEntry.prompt}". The other 2 should be similar but clearly wrong alternatives that could plausibly be confused with the first. Return ONLY a JSON array of 3 strings, nothing else. Example format: ["correct description", "wrong but similar option 1", "wrong but similar option 2"]`
          }]
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Prompt for keys without error message
          setModalOpen(true);
        }
        throw new Error('Failed to generate options from API');
      }

      const result = await response.json();
      let options: string[];

      if (result.reply) {
        try {
          options = JSON.parse(result.reply);
          if (!Array.isArray(options) || options.length < 3) {
            throw new Error("Parsed data is not an array of at least 3 strings.");
          }
          // Ensure we only take 3 options, even if the LLM provides more
          options = options.slice(0, 3);
        } catch (e) {
          console.error("Failed to parse Groq response, using fallback.", e);
          throw new Error("Parsing failed"); // Throw to fall into the outer catch block
        }
      } else {
        throw new Error("API response did not contain a 'reply' field.");
      }

      const correctAnswer = options[0]; // Per the prompt, the first option is the correct one
      const shuffledOptions = shuffleArray(options);

      return {
        correctEntry,
        options: shuffledOptions,
        correctAnswer,
      };
    } catch (error) {
      console.error('Error generating round via API, using local fallback:', error);

      // Fallback to random prompts from JSON
      const remainingEntries = data.filter(entry => entry.id !== correctEntry.id);
      const decoys = shuffleArray(remainingEntries).slice(0, 2);

      const options = [
        correctEntry.prompt,
        decoys[0].prompt,
        decoys[1].prompt
      ];

      return {
        correctEntry,
        options: shuffleArray(options),
        correctAnswer: correctEntry.prompt
      };
    }
  };

  // Start new game
  const startNewGame = async () => {
    const roundData = await generateRound();
    setGameState({
      round: 1,
      stonks: 0,
      currentRoundData: roundData,
      gameOver: false,
      selectedAnswer: null,
      showFeedback: false,
      timeLeft: 10,
    });
  };

  // Handle answer selection
  const handleAnswerClick = (answer: string) => {
    if (gameState.showFeedback || gameState.selectedAnswer) return;

    if (timerRef.current) clearInterval(timerRef.current); // Stop timer immediately

    setIsPressed(answer);
    setGameState(prev => ({ ...prev, selectedAnswer: answer }));

    feedbackRef.current = setTimeout(() => {
      setIsPressed(null);
      const isCorrect = answer === gameState.currentRoundData?.correctAnswer;
      const newStonks = isCorrect ? gameState.stonks + 10 : gameState.stonks;

      setGameState(prev => ({
        ...prev,
        stonks: newStonks,
        showFeedback: true,
      }));

      // Move to next round after 1.5 seconds
      nextRoundRef.current = setTimeout(async () => {
        if (gameState.round >= 4) {
          endGame();
        } else {
          const nextRoundData = await generateRound();
          setGameState(prev => ({
            ...prev,
            round: prev.round + 1,
            currentRoundData: nextRoundData,
            selectedAnswer: null,
            showFeedback: false,
            timeLeft: 10,
          }));
        }
      }, 1500);
    }, 200);
  };

  // End game and update stonks
  const endGame = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setGameState(prev => ({ ...prev, gameOver: true }));
    setGamePhase('RESULT');

    // Calculate winnings
    const totalStonks = gameState.stonks;

    if (totalStonks > 0 && uid) {
      // Add winnings to player's stonks
      const { error: updateError } = await supabase
        .from('players')
        .update({ stonks: (playerData?.stonks || 0) + totalStonks })
        .eq('uid', uid);

      if (!updateError) {
        // Log the game result
        await supabase.from('game_logs').insert({
          player_uid: uid,
          game_title: 'Dumb Charades',
          result: 'WIN',
          stonks_change: totalStonks
        });

        // Update local player data
        setPlayerData(prev => prev ? { ...prev, stonks: prev.stonks + totalStonks } : null);
      }
    }
  };




  // Initialize game on mount when phase becomes 'PLAYING'
  useEffect(() => {
    if (gamePhase === 'PLAYING' && gameState.round === 0) {
      startNewGame();
    }
  }, [gamePhase]);

  // BET SCREEN
  if (gamePhase === 'BET' && playerData) {

    return (
      <StandardBet
        playerData={playerData}
        uid={uid}
        entryFee={GAME_CONSTANTS.ENTRY_FEE}
        onPlay={payAndStart}
        onCancel={resetToAuth}
        loading={authLoading}
        themeColor="purple-500"
        title={
          <h1 className="text-3xl font-black uppercase text-center">
            <span className="inline-block bg-[#A855F7] text-white px-4 py-2 -skew-x-6 border-4 border-black">
              READY TO PLAY?
            </span>
          </h1>
        }
        backgroundElement={
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `
              linear-gradient(#dbeafe 1px, transparent 1px),
              linear-gradient(90deg, #dbeafe 1px, transparent 1px)
            `,
              backgroundSize: '24px 24px',
            }}
          />
        }
        instructions={
          <div className="space-y-1 text-sm font-bold text-left">
            <p>🎯 4 Rounds</p>
            <p>⏱️ 10s Timer</p>
            <p>💰 +10 Stonks ea.</p>
          </div>
        }
      />
    );
  }

  // RESULT SCREEN - Compact
  if (gamePhase === 'RESULT' && gameState.gameOver) {
    return (
      <div className="h-screen w-screen bg-white relative overflow-hidden flex items-center justify-center">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(#dbeafe 1px, transparent 1px),
              linear-gradient(90deg, #dbeafe 1px, transparent 1px)
            `,
            backgroundSize: '24px 24px',
          }}
        />

        <div className="relative z-10 w-full max-w-md px-4">
          <div className="bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 w-full">
            <h1 className="text-4xl font-black uppercase text-center mb-6">
              <span className="inline-block bg-[#A855F7] text-white px-4 py-2 -skew-x-6 border-4 border-black">
                GAME OVER!
              </span>
            </h1>

            <div className="text-center mb-6">
              <p className="text-xl font-bold uppercase mb-2">FINAL SCORE</p>
              <div className="bg-[#22C55E] border-4 border-black inline-block px-6 py-3">
                <p className="text-4xl font-black text-white uppercase">
                  {gameState.stonks} STONKS
                </p>
              </div>
            </div>

            <div className="text-center mb-6">
              <p className="text-lg font-bold uppercase mb-2">Total</p>
              <div className="bg-blue-500 border-4 border-black inline-block px-6 py-3">
                <p className="text-2xl font-black text-white uppercase">
                  {playerData?.stonks} STONKS
                </p>
              </div>
            </div>

            <button
              onClick={resetToAuth}
              className="w-full bg-gray-300 text-black text-lg font-black uppercase py-3 px-4 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
            >
              EXIT
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!gameState.currentRoundData) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  const { correctEntry, options } = gameState.currentRoundData;

  // PLAYING SCREEN - Compact Layout
  return (
    <div className="h-screen w-screen bg-white relative overflow-hidden flex flex-col">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(#dbeafe 1px, transparent 1px),
            linear-gradient(90deg, #dbeafe 1px, transparent 1px)
          `,
          backgroundSize: '24px 24px',
        }}
      />

      <div className="relative z-10 container mx-auto px-2 py-4 flex-1 flex flex-col max-w-2xl h-full">
        {/* Header */}
        <div className="mb-2 shrink-0">
          <div className="flex justify-between items-center mb-2">
            <h1 className="text-xl md:text-2xl font-black uppercase">
              <span className="inline-block bg-[#A855F7] text-white px-3 py-1 -skew-x-6 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                DUMB CHARADES
              </span>
            </h1>
            <div className="bg-[#22C55E] border-2 border-black px-3 py-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <span className="text-lg font-black text-white uppercase">
                {gameState.stonks} 💰
              </span>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <div className="bg-white border-2 border-black px-3 py-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <span className="text-sm font-bold uppercase">Round: {gameState.round}/4</span>
            </div>
            {/* Timer Display */}
            <div className={`bg-white border-2 border-black px-3 py-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${gameState.timeLeft <= 3 ? 'text-red-600' : ''}`}>
              <span className="text-sm font-black uppercase">⏱️ {gameState.timeLeft}s</span>
            </div>
          </div>
        </div>

        {/* Main Content Area - Scrollable if absolutely necessary but try to fit */}
        <div className="flex-1 flex flex-col justify-center min-h-0">
          <div className="bg-white border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-3 flex flex-col h-full max-h-full">

            {/* Image Container - Flexible height */}
            <div className="relative w-full flex-1 min-h-0 mb-3 border-2 border-black bg-gray-100 overflow-hidden">
              <Image
                src={correctEntry.image}
                alt="Charade Image"
                fill
                className="object-contain"
                priority
              />
            </div>

            <p className="text-lg font-bold uppercase text-center mb-3 shrink-0">
              WHAT IS THIS?
            </p>

            {/* Options - Fixed height per button, maybe compact */}
            <div className="space-y-2 shrink-0">
              {options.map((option, index) => {
                const isSelected = gameState.selectedAnswer === option;
                const isCorrect = option === gameState.currentRoundData?.correctAnswer;
                // If timeout happened (selectedAnswer is null but showFeedback is true), show correct answer but no "wrong" selection unless clicked
                // Actually handleTimeout logic sets selectedAnswer to null.

                const showCorrect = gameState.showFeedback && isCorrect;
                const showWrong = gameState.showFeedback && isSelected && !isCorrect;
                // If timeout, no selection made. just show correct.

                const isPressedButton = isPressed === option;

                return (
                  <button
                    key={index}
                    onClick={() => handleAnswerClick(option)}
                    disabled={gameState.showFeedback}
                    className={`
                      w-full text-left px-4 py-2 text-sm md:text-base font-bold uppercase leading-tight
                      border-2 border-black transition-all
                      ${showCorrect ? 'bg-[#22C55E] text-white' : ''}
                      ${showWrong ? 'bg-red-500 text-white' : ''}
                      ${!gameState.showFeedback && !isPressedButton ? 'bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none' : ''}
                      ${isPressedButton ? 'bg-white translate-x-[2px] translate-y-[2px] shadow-none' : ''}
                      ${gameState.showFeedback ? 'cursor-not-allowed' : 'cursor-pointer'}
                    `}
                  >
                    <div className="flex justify-between items-center w-full">
                      <span>{option}</span>
                      {showCorrect && <span>✓</span>}
                      {showWrong && <span>✗</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        {/* Feedback Toast - Overlay or integrated */}
        {gameState.showFeedback && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50">
            <div className={`px-6 py-4 border-4 border-black font-black text-2xl uppercase shadow-[8px_8px_0px_0px_rgba(0,0,0,0.5)] ${gameState.selectedAnswer === gameState.currentRoundData?.correctAnswer
              ? 'bg-[#22C55E] text-white'
              : 'bg-red-500 text-white'
              }`}>
              {gameState.selectedAnswer === gameState.currentRoundData?.correctAnswer
                ? '🎉 GOOD! +10'
                : (gameState.timeLeft === 0 ? '⏰ TIME UP!' : '❌ NOPE!')}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
