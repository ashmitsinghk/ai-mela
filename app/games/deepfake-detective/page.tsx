'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { ImagePair, RoundData, GameState } from './types';
import gameData from './game-data.json';
import { supabase } from '@/utils/supabase';
import { useToast } from '@/contexts/ToastContext';
import { GAME_CONSTANTS } from '@/utils/game-constants';
import StandardBet from '@/components/game-ui/StandardBet';

type GamePhase = 'AUTH' | 'BET' | 'PLAYING' | 'RESULT';


import { useRouter } from 'next/navigation';

export default function DeepfakeDetective() {
  const router = useRouter();
  const { showToast } = useToast();
  const [gamePhase, setGamePhase] = useState<GamePhase>('BET'); // Start at BET
  const [uid, setUid] = useState('');
  const [playerData, setPlayerData] = useState<{ name: string | null; stonks: number } | null>(null);
  const [authLoading, setAuthLoading] = useState(true); // Start loading true

  const [gameState, setGameState] = useState<GameState>({
    round: 0,
    stonks: 0,
    currentRoundData: null,
    gameOver: false,
    selectedSide: null,
    showFeedback: false,
    timeLeft: 15,
  });

  const [usedPairIds, setUsedPairIds] = useState<number[]>([]);

  // Timer Refs for cleanup
  const feedbackTimerRef = useRef<NodeJS.Timeout | null>(null);
  const nextRoundTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
      if (nextRoundTimerRef.current) clearTimeout(nextRoundTimerRef.current);
    };
  }, []);

  // Timer Countdown
  useEffect(() => {
    let timer: NodeJS.Timeout;

    if (gamePhase === 'PLAYING' && !gameState.showFeedback && !gameState.gameOver && gameState.currentRoundData) {
      timer = setInterval(() => {
        setGameState(prev => {
          if (prev.timeLeft <= 1) {
            clearInterval(timer);
            handleTimeout();
            return { ...prev, timeLeft: 0 };
          }
          return { ...prev, timeLeft: prev.timeLeft - 1 };
        });
      }, 1000);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [gamePhase, gameState.showFeedback, gameState.gameOver, gameState.currentRoundData]);

  // Handle Timeout (Time's Up)
  const handleTimeout = () => {
    if (gameState.showFeedback || gameState.gameOver) return;

    // Time's up is a loss for this round
    setGameState(prev => ({
      ...prev,
      selectedSide: null, // No selection made
      showFeedback: true,
      // stonks do not increase
    }));

    // Move to next round after 2 seconds
    nextRoundTimerRef.current = setTimeout(() => {
      if (gameState.round >= 5) {
        endGame();
      } else {
        setGameState(prev => ({
          ...prev,
          round: prev.round + 1,
          currentRoundData: generateRound(),
          selectedSide: null,
          showFeedback: false,
          timeLeft: 15, // Reset timer
        }));
      }
    }, 2000);
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

  // Auth: Check player
  const checkPlayer = async (uidToCheck: string) => {
    setAuthLoading(true);
    try {
      const { data, error } = await supabase
        .from('players')
        .select('name, stonks')
        .eq('uid', uidToCheck)
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
      game_title: 'Deepfake Detective',
      result: 'PLAYING',
      stonks_change: -GAME_CONSTANTS.ENTRY_FEE
    });
    setPlayerData({ ...playerData, stonks: playerData.stonks - GAME_CONSTANTS.ENTRY_FEE });
    setGamePhase('PLAYING');
    setAuthLoading(false);
  };

  const resetGame = () => {
    setGamePhase('BET');
    setUsedPairIds([]);
    setGameState({
      round: 0,
      stonks: 0,
      currentRoundData: null,
      gameOver: false,
      selectedSide: null,
      showFeedback: false,
      timeLeft: 15,
    });
  };


  // Generate round data with randomized positions
  const generateRound = (): RoundData => {
    const data = gameData as ImagePair[];

    // Filter out already used pairs
    let availablePairs = data.filter(pair => !usedPairIds.includes(pair.id));

    // If we've used all pairs, reset history and use full list
    if (availablePairs.length === 0) {
      setUsedPairIds([]); // Reset state for future (will apply next render, but for now we use local logic)
      availablePairs = data; // Use all data

      // We also need to clear the usedPairIds immediately for THIS selection to work if we want to track it
      // But since state update is async, we'll just pick effectively from fresh.
      // However, we should be careful. If we just pick one, the next generateRound call might still see old usedPairIds if we aren't careful?
      // Actually, setUsedPairIds([]) schedules the update.
      // If we pick one now and add it to usedPairIds:
      // setUsedPairIds(prev => [...prev]) -> prev here will be the OLD full list unless we strictly reset it.
      // Better approach: When empty, just clear everything and restart logic.
      // But we need to return a RoundData *now*.
    }

    // Pick a random pair from available ones
    const selectedPair = availablePairs[Math.floor(Math.random() * availablePairs.length)];

    // Mark this pair as used.
    // If we just reset (length === 0), we want to start a FRESH list with just this one.
    // If we didn't reset, we append to existing.
    if (availablePairs.length === data.length) {
      // This implies we reset (or it's the very first time).
      setUsedPairIds([selectedPair.id]);
    } else {
      setUsedPairIds(prev => [...prev, selectedPair.id]);
    }

    // Randomize which side gets the fake image
    const leftIsFake = Math.random() < 0.5;

    return {
      leftImage: leftIsFake ? selectedPair.fakeImage : selectedPair.realImage,
      rightImage: leftIsFake ? selectedPair.realImage : selectedPair.fakeImage,
      leftIsFake,
      pairId: selectedPair.id
    };
  };

  // Start new game
  const startNewGame = () => {
    setGameState({
      round: 1,
      stonks: 0,
      currentRoundData: generateRound(),
      gameOver: false,
      selectedSide: null,
      showFeedback: false,
      timeLeft: 15,
    });
  };

  // Handle image selection
  const handleImageClick = (side: 'left' | 'right') => {
    if (gameState.showFeedback || gameState.selectedSide) return;

    setGameState(prev => ({ ...prev, selectedSide: side }));

    feedbackTimerRef.current = setTimeout(() => {
      const isCorrect = (side === 'left' && gameState.currentRoundData?.leftIsFake) ||
        (side === 'right' && !gameState.currentRoundData?.leftIsFake);
      const newStonks = isCorrect ? gameState.stonks + 8 : gameState.stonks;

      setGameState(prev => ({
        ...prev,
        stonks: newStonks,
        showFeedback: true,
      }));

      // Move to next round after 2 seconds
      nextRoundTimerRef.current = setTimeout(() => {
        if (gameState.round >= 5) {
          endGame(newStonks);
        } else {
          setGameState(prev => ({
            ...prev,
            round: prev.round + 1,
            currentRoundData: generateRound(),
            selectedSide: null,
            showFeedback: false,
            timeLeft: 15,
          }));
        }
      }, 2000);
    }, 300);
  };

  // End game and update stonks
  const endGame = async (finalStonks?: number) => {
    setGameState(prev => ({ ...prev, gameOver: true }));
    setGamePhase('RESULT');

    // Calculate winnings
    const totalStonks = finalStonks !== undefined ? finalStonks : gameState.stonks;

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
          game_title: 'Deepfake Detective',
          result: 'WIN',
          stonks_change: totalStonks
        });

        // Update local player data
        setPlayerData(prev => prev ? { ...prev, stonks: prev.stonks + totalStonks } : null);
      }
    }
  };




  // Initialize game on mount
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
        onCancel={resetGame}
        loading={authLoading}
        themeColor="orange-500"

        title={
          <h1 className="text-4xl font-black uppercase text-center">
            <span className="inline-block bg-orange-500 text-white px-6 py-3 -skew-x-6 border-4 border-black">
              READY TO DETECT?
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
          <div className="space-y-2 text-sm font-bold text-left">
            <p>🕵️ 5 Rounds of deepfake detection</p>
            <p>💰 +8 Stonks per correct detection</p>
            <p>🎉 Max win: 40 Stonks!</p>
            <p>🧠 Can you spot the fake?</p>
          </div>
        }
      />
    );
  }

  // RESULT SCREEN
  if (gamePhase === 'RESULT' && gameState.gameOver) {
    const correctCount = gameState.stonks / 8;
    return (
      <div className="min-h-screen bg-white relative overflow-hidden">
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

        <div className="relative z-10 container mx-auto px-4 py-12 flex items-center justify-center min-h-screen">
          <div className="bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-8 max-w-lg w-full">
            <h1 className="text-5xl font-black uppercase text-center mb-8">
              <span className="inline-block bg-orange-500 text-white px-6 py-3 -skew-x-6 border-4 border-black">
                CASE CLOSED!
              </span>
            </h1>

            <div className="text-center mb-8">
              <p className="text-2xl font-bold uppercase mb-4">DETECTION REPORT</p>
              <div className="bg-orange-500 border-4 border-black inline-block px-8 py-4 mb-4">
                <p className="text-5xl font-black text-white uppercase">
                  {gameState.stonks} STONKS
                </p>
              </div>
              <p className="text-xl font-bold uppercase">
                {correctCount} / 5 Correct Detections
              </p>
              <p className="text-lg mt-2">
                {correctCount === 5 ? '🏆 Perfect Detective!' :
                  correctCount >= 3 ? '👍 Good Eye!' :
                    '🔍 Keep Practicing!'}
              </p>
            </div>

            <div className="text-center mb-8">
              <p className="text-xl font-bold uppercase mb-2">Total Stonks Balance</p>
              <div className="bg-blue-500 border-4 border-black inline-block px-8 py-4">
                <p className="text-3xl font-black text-white uppercase">
                  {playerData?.stonks} STONKS
                </p>
              </div>
            </div>

            <button
              onClick={resetGame}
              className="w-full bg-gray-300 text-black text-xl font-black uppercase py-3 px-6 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
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

  const { leftImage, rightImage, leftIsFake } = gameState.currentRoundData;
  const selectedLeft = gameState.selectedSide === 'left';
  const selectedRight = gameState.selectedSide === 'right';
  const isLeftCorrect = leftIsFake;
  const isRightCorrect = !leftIsFake;

  return (
    <div className="min-h-screen bg-white relative overflow-hidden">
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

      <div className="relative z-10 container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-5xl font-black uppercase text-center mb-4">
            <span className="inline-block bg-orange-500 text-white px-6 py-3 -skew-x-6 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
              DEEPFAKE DETECTIVE
            </span>
          </h1>

          <div className="flex justify-between items-center max-w-4xl mx-auto">
            <div className="bg-white border-4 border-black px-4 py-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <span className="text-xl font-bold uppercase">Round: {gameState.round}/5</span>
            </div>

            <div className={`border-4 border-black px-4 py-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ${gameState.timeLeft <= 5 ? 'bg-red-500 text-white animate-pulse' : 'bg-white text-black'
              }`}>
              <span className="text-xl font-black uppercase">
                Time: {gameState.timeLeft}s
              </span>
            </div>

            <div className="bg-[#22C55E] border-4 border-black px-4 py-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <span className="text-xl font-black text-white uppercase">
                {gameState.stonks} STONKS
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Game Area */}
      <div className="relative z-10 max-w-6xl mx-auto">
        <div className="bg-orange-100 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 mb-6">
          <p className="text-2xl md:text-3xl font-black uppercase text-center mb-6">
            🕵️ WHICH IMAGE IS THE DEEPFAKE?
          </p>

          {/* Image Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Image */}
            <button
              onClick={() => handleImageClick('left')}
              disabled={gameState.showFeedback}
              className={`
                  relative bg-white border-4 border-black p-4
                  transition-all cursor-pointer
                  ${!gameState.showFeedback ? 'shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px]' : ''}
                  ${selectedLeft && !gameState.showFeedback ? 'translate-x-[4px] translate-y-[4px] shadow-none' : ''}
                  ${gameState.showFeedback && selectedLeft && isLeftCorrect ? 'bg-green-200 border-green-600' : ''}
                  ${gameState.showFeedback && selectedLeft && !isLeftCorrect ? 'bg-red-200 border-red-600' : ''}
                  ${gameState.showFeedback && isLeftCorrect && !selectedLeft ? 'border-green-600 animate-pulse' : ''}
                  ${gameState.showFeedback ? 'cursor-not-allowed' : ''}
                `}
            >
              <div className="relative aspect-square mb-4">
                <Image
                  src={leftImage}
                  alt="Option 1"
                  fill
                  className="object-cover"
                  priority
                />
              </div>
              <p className="text-xl font-black uppercase text-center">
                IMAGE A
                {gameState.showFeedback && isLeftCorrect && (
                  <span className="ml-2 text-green-600">✓ FAKE</span>
                )}
                {gameState.showFeedback && selectedLeft && !isLeftCorrect && (
                  <span className="ml-2 text-red-600">✗</span>
                )}
              </p>
            </button>

            {/* Right Image */}
            <button
              onClick={() => handleImageClick('right')}
              disabled={gameState.showFeedback}
              className={`
                  relative bg-white border-4 border-black p-4
                  transition-all cursor-pointer
                  ${!gameState.showFeedback ? 'shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px]' : ''}
                  ${selectedRight && !gameState.showFeedback ? 'translate-x-[4px] translate-y-[4px] shadow-none' : ''}
                  ${gameState.showFeedback && selectedRight && isRightCorrect ? 'bg-green-200 border-green-600' : ''}
                  ${gameState.showFeedback && selectedRight && !isRightCorrect ? 'bg-red-200 border-red-600' : ''}
                  ${gameState.showFeedback && isRightCorrect && !selectedRight ? 'border-green-600 animate-pulse' : ''}
                  ${gameState.showFeedback ? 'cursor-not-allowed' : ''}
                `}
            >
              <div className="relative aspect-square mb-4">
                <Image
                  src={rightImage}
                  alt="Option 2"
                  fill
                  className="object-cover"
                  priority
                />
              </div>
              <p className="text-xl font-black uppercase text-center">
                IMAGE B
                {gameState.showFeedback && isRightCorrect && (
                  <span className="ml-2 text-green-600">✓ FAKE</span>
                )}
                {gameState.showFeedback && selectedRight && !isRightCorrect && (
                  <span className="ml-2 text-red-600">✗</span>
                )}
              </p>
            </button>
          </div>
        </div>

        {/* Feedback Message */}
        {gameState.showFeedback && (
          <div className="text-center">
            <div className={`inline-block px-6 py-3 border-4 border-black font-black text-2xl uppercase ${((selectedLeft && isLeftCorrect) || (selectedRight && isRightCorrect))
              ? 'bg-green-500 text-white'
              : 'bg-red-500 text-white'
              }`}>
              {((selectedLeft && isLeftCorrect) || (selectedRight && isRightCorrect))
                ? '🎉 CORRECT! +8 STONKS'
                : '❌ WRONG! THAT WAS REAL'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
