'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import { useToast } from '@/contexts/ToastContext';
import { useApiKeys } from '@/contexts/ApiKeyContext';
import { GAME_CONSTANTS } from '@/utils/game-constants';
import StandardBet from '@/components/game-ui/StandardBet';
import { generateEmojiClue, EmojiClue } from './emoji-game';
import { Loader2, HelpCircle, Trophy } from 'lucide-react';

type GamePhase = 'BET' | 'PLAYING' | 'RESULT';

export default function EmojiCrypt() {
    const router = useRouter();
    const { showToast } = useToast();
    const { groqKey, setModalOpen } = useApiKeys();

    // Auth & User State
    const [uid, setUid] = useState('');
    const [playerData, setPlayerData] = useState<{ name: string | null; stonks: number } | null>(null);
    const [loading, setLoading] = useState(true);

    // Game State
    const [gameState, setGameState] = useState<GamePhase>('BET');
    const [currentClue, setCurrentClue] = useState<EmojiClue | null>(null);
    const [guess, setGuess] = useState('');
    const [score, setScore] = useState(0);
    const [lives, setLives] = useState(3);
    const [timeLeft, setTimeLeft] = useState(30);
    const [round, setRound] = useState(1);
    const [isShake, setIsShake] = useState(false);
    const [showHint, setShowHint] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);

    // Refs
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Auth Check
    useEffect(() => {
        const userUid = localStorage.getItem('user_uid');
        if (!userUid) {
            router.push('/login');
            return;
        }
        setUid(userUid);
        checkPlayer(userUid);
    }, []);

    const checkPlayer = async (id: string) => {
        setLoading(true);
        const { data } = await supabase.from('players').select('name, stonks').eq('uid', id).single();
        if (data) {
            setPlayerData(data);
        } else {
            showToast('Player not found', 'error');
        }
        setLoading(false);
    };

    // Start Game
    const payAndStart = async () => {
        if (!playerData || playerData.stonks < GAME_CONSTANTS.ENTRY_FEE) {
            showToast('Insufficient Stonks!', 'error');
            return;
        }

        setLoading(true);
        const { error: updateError } = await supabase
            .from('players')
            .update({ stonks: playerData.stonks - GAME_CONSTANTS.ENTRY_FEE })
            .eq('uid', uid);

        if (updateError) {
            showToast('Transaction Failed', 'error');
            setLoading(false);
            return;
        }

        // Log Entry
        await supabase.from('game_logs').insert({
            player_uid: uid,
            game_title: 'Emoji Crypt',
            result: 'PLAYING',
            stonks_change: -GAME_CONSTANTS.ENTRY_FEE
        });

        setPlayerData({ ...playerData, stonks: playerData.stonks - GAME_CONSTANTS.ENTRY_FEE });
        setScore(0);
        setLives(3);
        setRound(1);
        startGameLoop();
    };

    const startGameLoop = async () => {
        setGameState('PLAYING');
        nextRound();
    };

    const nextRound = async () => {
        setIsGenerating(true);
        setGuess('');
        setShowHint(false);
        setTimeLeft(30);

        try {
            const clue = await generateEmojiClue('MIXED', 'MEDIUM', { groq: groqKey || undefined });
            setCurrentClue(clue);
            setIsGenerating(false);
            startTimer();
        } catch (error: any) {
            console.error('Failed to generate clue:', error);
            setIsGenerating(false);
            if (error.message === 'API_KEY_MISSING' || error.message.includes('401')) {
                setModalOpen(true);
                setGameState('BET'); // Reset to bet so they can try again after adding key
            } else {
                showToast('Failed to generate emojis. Try again.', 'error');
                setGameState('BET');
            }
        }
    };

    const startTimer = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    handleTimeUp();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const handleTimeUp = () => {
        clearInterval(timerRef.current!);
        handleLifeLoss();
    };

    const handleLifeLoss = () => {
        if (lives > 1) {
            setLives((prev) => prev - 1);
            showToast(`Time's up! The answer was: ${currentClue?.title}`, 'error');
            nextRound();
        } else {
            endGame();
        }
    };

    const endGame = async () => {
        clearInterval(timerRef.current!);
        setGameState('RESULT');

        // Reward Logic: 10 stonks for every 500 score (approx 5 correct answers)
        const reward = Math.floor(score / 100) * 2; // Simple: 2 stonks per 100 pts

        if (reward > 0 && playerData) {
            await supabase.from('players').update({ stonks: playerData.stonks + reward }).eq('uid', uid);
            setPlayerData({ ...playerData, stonks: playerData.stonks + reward });
            await supabase.from('game_logs').insert({
                player_uid: uid,
                game_title: 'Emoji Crypt (Win)',
                result: 'WIN',
                stonks_change: reward
            });
        }
    };

    const handleGuess = (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentClue || !guess.trim()) return;

        // Simple normalization: remove special chars, spaces, lowercase
        const normalizedGuess = guess.toLowerCase().replace(/[^a-z0-9]/g, '');
        const normalizedTarget = currentClue.title.toLowerCase().replace(/[^a-z0-9]/g, '');

        if (normalizedGuess === normalizedTarget) {
            // Correct!
            const points = timeLeft * 10 + 100; // Speed bonus
            setScore((prev) => prev + points);
            showToast(`Correct! +${points} pts`, 'success');
            setRound((prev) => prev + 1);
            nextRound();
        } else {
            // Wrong
            setIsShake(true);
            setTimeout(() => setIsShake(false), 500);
            setGuess('');
        }
    };

    // Cleanup
    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    if (gameState === 'BET' && playerData) {
        return (
            <StandardBet
                playerData={playerData}
                uid={uid}
                entryFee={GAME_CONSTANTS.ENTRY_FEE}
                onPlay={payAndStart}
                onCancel={() => router.push('/games')}
                loading={loading}
                themeColor="neo-pink"
                bgColor="bg-black"
                title={
                    <h1 className="text-4xl md:text-6xl font-heading text-white mb-4 text-center">
                        EMOJI <span className="text-neo-pink">CRYPT</span>
                    </h1>
                }
                instructions={
                    <ul className="text-left space-y-2 text-sm text-gray-400 mb-6">
                        <li>• Guess the title from emojis</li>
                        <li>• Speed matters!</li>
                        <li>• 3 Lives</li>
                    </ul>
                }
            />
        );
    }

    if (gameState === 'RESULT') {
        return (
            <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
                <div className="bg-white text-black p-8 border-4 border-neo-pink text-center max-w-md w-full">
                    <Trophy className="w-16 h-16 mx-auto mb-4 text-neo-pink" />
                    <h1 className="text-4xl font-heading mb-2">GAME OVER</h1>
                    <p className="text-xl mb-6">Final Score: <span className="font-bold">{score}</span></p>
                    <div className="flex justify-between border-t border-black pt-4">
                        <span>Reward:</span>
                        <span className="font-bold text-neo-green">+{Math.floor(score / 100) * 2} Stonks</span>
                    </div>
                    <button onClick={() => window.location.reload()} className="w-full bg-black text-white py-3 mt-8 font-heading hover:bg-gray-800">
                        PLAY AGAIN
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white font-mono flex flex-col items-center justify-center p-4">
            {/* HUD */}
            <div className="absolute top-4 left-0 right-0 px-4 flex justify-between items-start max-w-4xl mx-auto w-full">
                <div className="bg-white/10 p-2 border border-white/20 backdrop-blur">
                    <div className="text-xs text-gray-400">SCORE</div>
                    <div className="text-2xl font-bold">{score}</div>
                </div>
                <div className="flex gap-2">
                    {[...Array(lives)].map((_, i) => (
                        <span key={i} className="text-2xl">❤️</span>
                    ))}
                </div>
                <div className={`bg-white/10 p-2 border border-white/20 backdrop-blur ${timeLeft < 10 ? 'text-red-500 border-red-500 animate-pulse' : ''}`}>
                    <div className="text-xs text-gray-400">TIME</div>
                    <div className="text-2xl font-bold">{timeLeft}s</div>
                </div>
            </div>

            {/* GAME AREA */}
            <div className="max-w-xl w-full">
                {isGenerating ? (
                    <div className="text-center py-20">
                        <Loader2 className="w-16 h-16 animate-spin mx-auto mb-4 text-neo-pink" />
                        <p className="text-xl animate-pulse">Decrypting Signal...</p>
                    </div>
                ) : currentClue ? (
                    <div className="space-y-8 animate-in zoom-in duration-300">
                        <div className="text-center">
                            <span className="inline-block bg-neo-pink text-black px-3 py-1 font-bold text-sm mb-4 transform -rotate-2">
                                {currentClue.category}
                            </span>
                            <div className="text-6xl md:text-8xl mb-4 leading-normal filter drop-shadow-[0_0_10px_rgba(255,105,180,0.5)]">
                                {currentClue.emojis}
                            </div>
                        </div>

                        <form onSubmit={handleGuess} className={`relative ${isShake ? 'animate-shake' : ''}`}>
                            <input
                                type="text"
                                value={guess}
                                onChange={(e) => setGuess(e.target.value)}
                                placeholder="Type your guess..."
                                autoFocus
                                className="w-full bg-transparent border-b-4 border-white text-3xl py-4 text-center focus:outline-none focus:border-neo-pink placeholder-gray-600 uppercase font-heading"
                            />
                        </form>

                        <div className="text-center">
                            {!showHint ? (
                                <button
                                    onClick={() => setShowHint(true)}
                                    className="text-sm text-gray-500 hover:text-white flex items-center justify-center gap-2 mx-auto"
                                >
                                    <HelpCircle size={16} /> Need a hint?
                                </button>
                            ) : (
                                <p className="text-neo-cyan animate-in fade-in italic">{currentClue.hint}</p>
                            )}
                        </div>
                    </div>
                ) : null}
            </div>

            {/* CSS for Shake Animation */}
            <style jsx global>{`
            @keyframes shake {
                0%, 100% { transform: translateX(0); }
                25% { transform: translateX(-10px); }
                75% { transform: translateX(10px); }
            }
            .animate-shake {
                animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both;
            }
        `}</style>
        </div>
    );
}
