'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { GameEntry, RoundData, GameState } from './types';
import gameData from './game-data.json';

export default function DumbCharadesGame() {
  const [gameState, setGameState] = useState<GameState>({
    round: 0,
    stonks: 0,
    currentRoundData: null,
    gameOver: false,
    selectedAnswer: null,
    showFeedback: false,
  });

  const [isPressed, setIsPressed] = useState<string | null>(null);

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
  const generateRound = () => {
    const data = gameData as GameEntry[];
    
    // Pick a random correct entry
    const correctEntry = data[Math.floor(Math.random() * data.length)];
    
    // Pick 2 random decoys (excluding the correct one)
    const remainingEntries = data.filter(entry => entry.id !== correctEntry.id);
    const decoys = shuffleArray(remainingEntries).slice(0, 2);
    
    // Create options array with correct answer and decoys
    const options = shuffleArray([
      correctEntry.prompt,
      decoys[0].prompt,
      decoys[1].prompt
    ]);
    
    return {
      correctEntry,
      options,
      correctAnswer: correctEntry.prompt
    };
  };

  // Start new game
  const startNewGame = () => {
    setGameState({
      round: 1,
      stonks: 0,
      currentRoundData: generateRound(),
      gameOver: false,
      selectedAnswer: null,
      showFeedback: false,
    });
  };

  // Handle answer selection
  const handleAnswerClick = (answer: string) => {
    if (gameState.showFeedback || gameState.selectedAnswer) return;

    setIsPressed(answer);
    setGameState(prev => ({ ...prev, selectedAnswer: answer }));

    setTimeout(() => {
      setIsPressed(null);
      const isCorrect = answer === gameState.currentRoundData?.correctAnswer;
      const newStonks = isCorrect ? gameState.stonks + 10 : gameState.stonks;
      
      setGameState(prev => ({
        ...prev,
        stonks: newStonks,
        showFeedback: true,
      }));

      // Move to next round after 1.5 seconds
      setTimeout(() => {
        if (gameState.round >= 4) {
          setGameState(prev => ({ ...prev, gameOver: true }));
        } else {
          setGameState(prev => ({
            ...prev,
            round: prev.round + 1,
            currentRoundData: generateRound(),
            selectedAnswer: null,
            showFeedback: false,
          }));
        }
      }, 1500);
    }, 200);
  };

  // Initialize game on mount
  useEffect(() => {
    startNewGame();
  }, []);

  if (gameState.gameOver) {
    return (
      <div className="min-h-screen bg-white relative overflow-hidden">
        {/* Notebook Grid Background */}
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
              <span className="inline-block bg-[#A855F7] text-white px-6 py-3 -skew-x-6 border-4 border-black">
                GAME OVER!
              </span>
            </h1>
            
            <div className="text-center mb-8">
              <p className="text-2xl font-bold uppercase mb-4">FINAL SCORE</p>
              <div className="bg-[#22C55E] border-4 border-black inline-block px-8 py-4">
                <p className="text-5xl font-black text-white uppercase">
                  {gameState.stonks} STONKS
                </p>
              </div>
            </div>

            <button
              onClick={startNewGame}
              className="w-full bg-[#A855F7] text-white text-2xl font-black uppercase py-4 px-8 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all active:shadow-none active:translate-x-[4px] active:translate-y-[4px]"
            >
              PLAY AGAIN
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

  return (
    <div className="min-h-screen bg-white relative overflow-hidden">
      {/* Notebook Grid Background */}
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
          <h1 className="text-4xl md:text-6xl font-black uppercase text-center mb-4">
            <span className="inline-block bg-[#A855F7] text-white px-6 py-3 -skew-x-6 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
              DUMB CHARADES
            </span>
          </h1>
          
          <div className="flex justify-between items-center max-w-2xl mx-auto">
            <div className="bg-white border-4 border-black px-4 py-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <span className="text-xl font-bold uppercase">Round: {gameState.round}/4</span>
            </div>
            
            <div className="bg-[#22C55E] border-4 border-black px-4 py-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <span className="text-xl font-black text-white uppercase">
                {gameState.stonks} STONKS
              </span>
            </div>
          </div>
        </div>

        {/* Main Game Card */}
        <div className="max-w-2xl mx-auto">
          <div className="bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 mb-6">
            <div className="relative w-full aspect-video mb-6 border-4 border-black bg-gray-100">
              <Image
                src={correctEntry.image}
                alt="Charade Image"
                fill
                className="object-cover"
                priority
              />
            </div>
            
            <p className="text-2xl font-bold uppercase text-center mb-6">
              WHAT IS THIS?
            </p>

            {/* Options */}
            <div className="space-y-4">
              {options.map((option, index) => {
                const isSelected = gameState.selectedAnswer === option;
                const isCorrect = option === gameState.currentRoundData?.correctAnswer;
                const showCorrect = gameState.showFeedback && isCorrect;
                const showWrong = gameState.showFeedback && isSelected && !isCorrect;
                const isPressedButton = isPressed === option;

                return (
                  <button
                    key={index}
                    onClick={() => handleAnswerClick(option)}
                    disabled={gameState.showFeedback}
                    className={`
                      w-full text-left px-6 py-4 text-lg font-bold uppercase
                      border-4 border-black transition-all
                      ${showCorrect ? 'bg-[#22C55E] text-white' : ''}
                      ${showWrong ? 'bg-red-500 text-white' : ''}
                      ${!gameState.showFeedback && !isPressedButton ? 'bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px]' : ''}
                      ${isPressedButton ? 'bg-white translate-x-[4px] translate-y-[4px] shadow-none' : ''}
                      ${gameState.showFeedback ? 'cursor-not-allowed' : 'cursor-pointer'}
                    `}
                  >
                    {option}
                    {showCorrect && <span className="ml-2">✓</span>}
                    {showWrong && <span className="ml-2">✗</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Feedback Message */}
          {gameState.showFeedback && (
            <div className="text-center">
              <div className={`inline-block px-6 py-3 border-4 border-black font-black text-2xl uppercase ${
                gameState.selectedAnswer === gameState.currentRoundData?.correctAnswer
                  ? 'bg-[#22C55E] text-white'
                  : 'bg-red-500 text-white'
              }`}>
                {gameState.selectedAnswer === gameState.currentRoundData?.correctAnswer
                  ? '🎉 CORRECT! +10 STONKS'
                  : '❌ WRONG!'}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
