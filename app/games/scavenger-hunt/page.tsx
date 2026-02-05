'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import { useToast } from '@/contexts/ToastContext';
import { GAME_CONSTANTS } from '@/utils/game-constants';
import StandardAuth from '@/components/game-ui/StandardAuth';
import StandardBet from '@/components/game-ui/StandardBet';
import { Camera, Timer, CheckCircle, XCircle, ArrowRight, Loader2 } from 'lucide-react';

const ITEMS = [
    { emoji: '👓', label: 'Sunglasses' },
    { emoji: '🖊️', label: 'Pen' },
    { emoji: '💻', label: 'Laptop' },
    { emoji: '📱', label: 'Phone' },
    { emoji: '🎧', label: 'Headphones' },
    { emoji: '🥤', label: 'Cup' },
    { emoji: '⌚', label: 'Watch' },
    { emoji: '🔑', label: 'Keys' },
    { emoji: '🖱️', label: 'Computer Mouse' },
    { emoji: '🪑', label: 'Chair' },
    { emoji: '🎒', label: 'Backpack' },
    { emoji: '👟', label: 'Shoe' },
    { emoji: '📕', label: 'Book' },
    { emoji: '🥄', label: 'Spoon' },
    { emoji: '⌨️', label: 'Keyboard' },
    { emoji: '🧴', label: 'Bottle' },
    { emoji: '🧢', label: 'Hat' },
    { emoji: '✂️', label: 'Scissors' },
    { emoji: '🪙', label: 'Coin' },
    { emoji: '🖥️', label: 'Monitor' },
    { emoji: '📐', label: 'Ruler' },
    { emoji: '📎', label: 'Paperclip' },
    { emoji: '📓', label: 'Notebook' },
    { emoji: '🔌', label: 'Charger' },
    { emoji: '🔋', label: 'Power Bank' },
    { emoji: '💾', label: 'USB Drive' },
];

export default function ScavengerHunt() {
    const { showToast } = useToast();
    const router = useRouter();
    const webcamRef = useRef<Webcam>(null);
    const [gameState, setGameState] = useState<'AUTH' | 'BET' | 'PLAYING' | 'VERIFYING' | 'FINISHED'>('AUTH');
    const [timeLeft, setTimeLeft] = useState(90);
    const [itemTimeLeft, setItemTimeLeft] = useState(9);
    const [score, setScore] = useState(0);
    const [currentItem, setCurrentItem] = useState(ITEMS[0]);
    const [feedback, setFeedback] = useState<'NONE' | 'CORRECT' | 'WRONG'>('NONE');
    const [uid, setUid] = useState<string | null>(null);
    const [playerData, setPlayerData] = useState<{ name: string | null; stonks: number } | null>(null);
    const [loading, setLoading] = useState(false);

    // Timer refs
    const feedbackTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
        };
    }, []);

    // Use StandardAuth instead
    useEffect(() => {
        // init
    }, [router]);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (gameState === 'PLAYING' && timeLeft > 0) {
            interval = setInterval(() => {
                setTimeLeft((prev) => prev - 1);
                setItemTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
            }, 1000);
        } else if (timeLeft === 0 && gameState === 'PLAYING') {
            endGame();
        }
        return () => clearInterval(interval);
    }, [gameState, timeLeft]);

    // Auto-Capture when item timer hits 0
    useEffect(() => {
        if (itemTimeLeft === 0 && gameState === 'PLAYING') {
            captureAndVerify();
        }
    }, [itemTimeLeft, gameState]);

    const startGame = async () => {
        if (!uid || !playerData) return;
        setLoading(true);

        try {
            const { error: updateError } = await supabase
                .from('players')
                .update({ stonks: playerData.stonks - GAME_CONSTANTS.ENTRY_FEE })
                .eq('uid', uid);

            if (updateError) throw updateError;

            // Log the game start fee
            await supabase.from('game_logs').insert({
                player_uid: uid,
                game_title: 'Emoji Scavenger Hunt (Entry)',
                result: 'LOSS',
                stonks_change: -GAME_CONSTANTS.ENTRY_FEE
            });

            setScore(0);
            setTimeLeft(90);
            nextItem();
            setGameState('PLAYING');
        } catch (e) {
            showToast('Failed to start game', 'error');
        } finally {
            setLoading(false);
        }
    };

    const nextItem = () => {
        const randomItem = ITEMS[Math.floor(Math.random() * ITEMS.length)];
        setCurrentItem(randomItem);
        setItemTimeLeft(9);
        setFeedback('NONE');
    };

    const captureAndVerify = async () => {
        if (gameState !== 'PLAYING' || !webcamRef.current) return;

        setGameState('VERIFYING');
        const imageSrc = webcamRef.current.getScreenshot();

        if (!imageSrc) {
            setGameState('PLAYING');
            return;
        }

        try {
            const res = await fetch('/api/verify-scavenger-item', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: imageSrc, target: currentItem.label }),
            });
            const data = await res.json();

            if (data.match) {
                setFeedback('CORRECT');
                setScore((prev) => prev + 4);
                feedbackTimerRef.current = setTimeout(() => {
                    if (score + 4 >= 40) {
                        endGame(score + 4);
                    } else {
                        nextItem();
                        setGameState('PLAYING');
                    }
                }, 1500);
            } else {
                setFeedback('WRONG');
                feedbackTimerRef.current = setTimeout(() => {
                    setFeedback('NONE');
                    nextItem();
                    setGameState('PLAYING');
                }, 1500);
            }
        } catch (e: any) {
            console.error(e);
            setFeedback('NONE');
            setGameState('PLAYING');
            // If error, maybe shouldn't skip? Let's just reset timer for same item or skip
            // For now, if error (rate limit etc), we probably kept same item effectively by not calling nextItem
            // But timer might be 0? itemTimeLeft needs reset.
            setItemTimeLeft(9);
            if (e.message?.includes('429') || e.message?.includes('Too Many Requests')) {
                showToast('Server is busy (Rate Limit). Please wait 10 seconds and try again.', 'warning');
            }
        }
    };

    const endGame = async (finalScore?: number) => {
        setGameState('FINISHED');
        const actualScore = finalScore !== undefined ? finalScore : score;
        const cappedScore = Math.min(actualScore, 40);

        if (uid && cappedScore > 0) {
            // Update Stonks
            const { data: userData } = await supabase
                .from('players')
                .select('stonks')
                .eq('uid', uid)
                .single();

            if (userData) {
                await supabase.from('players').update({ stonks: userData.stonks + cappedScore }).eq('uid', uid);

                await supabase.from('game_logs').insert({
                    player_uid: uid,
                    game_title: 'Emoji Scavenger Hunt (Win)',
                    result: 'WIN',
                    stonks_change: cappedScore
                });
            }
        }
    };

    return (
        <div className="min-h-screen bg-black text-neo-green font-mono flex flex-col">
            {/* Navbar Placeholder if needed, or back button */}
            <button onClick={() => router.push('/games')} className="absolute top-4 left-4 z-50 bg-white text-black p-2 border-2 border-neo-green font-bold hover:bg-neo-green hover:text-black transition-colors">
                ← EXIT
            </button>

            {gameState === 'AUTH' && (
                <StandardAuth
                    onVerify={async (id) => {
                        setUid(id);
                        setLoading(true);
                        const { data } = await supabase.from('players').select('*').eq('uid', id).single();
                        if (data) {
                            setPlayerData(data);
                            setGameState('BET');
                        } else {
                            showToast('Player not found', 'error');
                        }
                        setLoading(false);
                    }}
                    loading={loading}
                    title={
                        <h1 className="text-4xl md:text-6xl font-heading text-white mb-4 animate-pulse">
                            EMOJI SCAVENGER HUNT
                        </h1>
                    }
                    themeColor="neo-green"
                    bgColor="bg-black"
                />
            )}

            {gameState === 'BET' && playerData && (
                <StandardBet
                    playerData={playerData}
                    uid={uid || undefined}
                    entryFee={GAME_CONSTANTS.ENTRY_FEE}
                    onPlay={startGame}
                    onCancel={() => setGameState('AUTH')}
                    loading={loading}
                    themeColor="neo-green"
                    bgColor="bg-black"
                    title={
                        <h1 className="text-4xl md:text-6xl font-heading text-white mb-4">
                            READY?
                        </h1>
                    }
                    instructions={
                        <ul className="text-left space-y-2 text-sm text-gray-800 mb-6">
                            <li>• Find items in real life!</li>
                            <li>• Time: 90 Seconds</li>
                            <li>• Reward: +4 Stonks per item</li>
                            <li>• Max Reward: 40 Stonks</li>
                        </ul>
                    }
                />
            )}

            {(gameState === 'PLAYING' || gameState === 'VERIFYING') && (
                <div className="flex-1 relative flex flex-col">
                    {/* HUD */}
                    <div className="absolute top-14 left-0 right-0 z-10 p-4 flex justify-between items-start pointer-events-none">
                        <div className="bg-black/80 text-white p-2 border-2 border-white">
                            <div className="text-xs text-gray-400">TIME</div>
                            <div className={`text-2xl font-bold ${timeLeft < 10 ? 'text-red-500 animate-pulse' : ''}`}>{timeLeft}s</div>
                        </div>
                        <div className="bg-black/80 text-neo-green p-2 border-2 border-neo-green">
                            <div className="text-xs text-gray-400">SCORE</div>
                            <div className="text-2xl font-bold">{score}</div>
                        </div>
                    </div>

                    {/* Camera Feed */}
                    <div className="flex-1 relative bg-gray-900 overflow-hidden">
                        <Webcam
                            ref={webcamRef}
                            audio={false}
                            screenshotFormat="image/jpeg"
                            videoConstraints={{ facingMode: "environment" }}
                            className="absolute inset-0 w-full h-full object-cover"
                        />

                        {/* Target Overlay */}
                        <div className="absolute inset-x-0 bottom-32 flex flex-col items-center justify-center pointer-events-none">
                            <div className="bg-black/60 p-4 rounded-xl backdrop-blur-sm border border-white/20 text-center animate-bounce-slow">
                                <div className="text-6xl mb-2">{currentItem.emoji}</div>
                                {/* <div className="text-xl font-bold text-white uppercase tracking-widest">{currentItem.label}</div> */}
                            </div>
                        </div>

                        {/* Feedback Overlay */}
                        {feedback === 'CORRECT' && (
                            <div className="absolute inset-0 flex items-center justify-center bg-green-500/40 z-20">
                                <CheckCircle size={100} className="text-white animate-bounce" />
                            </div>
                        )}
                        {feedback === 'WRONG' && (
                            <div className="absolute inset-0 flex items-center justify-center bg-red-500/40 z-20">
                                <XCircle size={100} className="text-white animate-shake" />
                                <p className="absolute mt-32 text-white font-bold text-2xl bg-black px-2">TRY AGAIN</p>
                            </div>
                        )}
                    </div>

                    {/* Controls / Auto-Timer Status */}
                    <div className="h-24 bg-black flex flex-col items-center justify-center p-4">
                        {gameState === 'VERIFYING' ? (
                            <div className="flex items-center gap-2 text-xl animate-pulse text-neo-green">
                                <Loader2 className="animate-spin" /> VERIFYING...
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-2">
                                <div className="text-gray-400 text-sm tracking-widest uppercase">Scanning In</div>
                                <div className="text-4xl font-bold font-heading text-white">{itemTimeLeft}s</div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {gameState === 'FINISHED' && (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-8">
                    <h2 className="text-5xl font-heading text-white">GAME OVER</h2>

                    <div className="bg-white text-black p-8 border-4 border-neo-green shadow-[8px_8px_0px_#00FF66] max-w-sm w-full">
                        <div className="text-sm font-bold text-gray-500 mb-2">FINAL SCORE</div>
                        <div className="text-6xl font-heading mb-6">{Math.min(score, 40)}</div>

                        <div className="space-y-4">
                            <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                                <span>Items Found</span>
                                <span className="font-bold">{score / 4}</span>
                            </div>
                            <div className="flex justify-between items-center border-b border-gray-200 pb-2 text-green-600">
                                <span>Earned</span>
                                <span className="font-bold">+{Math.min(score, 40)} Stonks</span>
                            </div>
                            <div className="flex justify-between items-center text-red-500 text-sm">
                                <span>Entry Fee</span>
                                <span>-{GAME_CONSTANTS.ENTRY_FEE} Stonks</span>
                            </div>
                        </div>

                        <div className="mt-8">
                            <div className="flex justify-between items-center text-blue-600 font-bold text-lg mb-4 border-t border-gray-200 pt-2">
                                <span>Total Stonks</span>
                                <span>{playerData?.stonks} 💎</span>
                            </div>
                            <button
                                onClick={() => setGameState('AUTH')}
                                className="w-full bg-black text-white p-3 font-bold hover:bg-gray-800"
                            >
                                EXIT
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
