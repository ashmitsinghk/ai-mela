'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '@/utils/supabase';
import { useToast } from '@/contexts/ToastContext';
import { GAME_CONSTANTS } from '@/utils/game-constants';
import StandardAuth from '@/components/game-ui/StandardAuth';
import StandardBet from '@/components/game-ui/StandardBet';
import Webcam from 'react-webcam';
import Script from 'next/script';
import { Trophy, Skull, Loader2, RefreshCw, Camera, Timer, Hand } from 'lucide-react';
import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

// --- TYPES ---
type GamePhase = 'AUTH' | 'BET' | 'TOSS' | 'INNINGS_1' | 'INNINGS_2' | 'RESULT';
type Role = 'BAT' | 'BOWL';

export default function OddEveGame() {
    const { showToast } = useToast();
    // --- AUTH & USER STATE ---
    const [gameState, setGameState] = useState<GamePhase>('AUTH');
    const [uid, setUid] = useState('');
    const [playerData, setPlayerData] = useState<{ name: string | null; stonks: number } | null>(null);
    const [loading, setLoading] = useState(false);

    // --- MATCH STATE ---
    const [playerRole, setPlayerRole] = useState<Role | null>(null);
    const [target, setTarget] = useState<number | null>(null);
    const [inningsScore, setInningsScore] = useState(0);
    const [ballHistory, setBallHistory] = useState<{ p: number, ai: number }[]>([]);
    const [gameResult, setGameResult] = useState<'WIN' | 'LOSS' | 'DRAW' | null>(null);

    // Toss State
    const [tossChoice, setTossChoice] = useState<'ODD' | 'EVE' | null>(null);
    const [tossWinner, setTossWinner] = useState<'PLAYER' | 'AI' | null>(null);

    // UI Feedback State
    const [popup, setPopup] = useState<{ title: string; subtitle?: string; color: string } | null>(null);
    const [commentary, setCommentary] = useState('Match Starting...');

    // Move State
    const [lastPlayerMove, setLastPlayerMove] = useState<number | null>(null);
    const [lastAiMove, setLastAiMove] = useState<number | null>(null);

    // --- AI BRAIN (Session Based) ---
    const [playerPattern, setPlayerPattern] = useState<number[][]>(
        Array(7).fill(0).map(() => Array(7).fill(0))
    );
    const [lastMoveIndex, setLastMoveIndex] = useState<number>(0);

    // --- GESTURE STATE ---
    const webcamRef = useRef<Webcam>(null);
    const landmarkerRef = useRef<HandLandmarker | null>(null);
    const requestRef = useRef<number>(null);
    const [modelLoaded, setModelLoaded] = useState(false);
    const [detectedGesture, setDetectedGesture] = useState<number | null>(null);
    const [gameTimer, setGameTimer] = useState<number | null>(null);
    const [isThinking, setIsThinking] = useState(false);

    // Timer Refs
    const logicTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (logicTimerRef.current) clearTimeout(logicTimerRef.current);
        };
    }, []);

    // --- INIT AI (MediaPipe Tasks) ---
    useEffect(() => {
        const initMediaPipe = async () => {
            try {
                const vision = await FilesetResolver.forVisionTasks(
                    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
                );
                const landmarker = await HandLandmarker.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
                        delegate: "GPU"
                    },
                    runningMode: "VIDEO",
                    numHands: 1,
                    minHandDetectionConfidence: 0.2,
                    minHandPresenceConfidence: 0.2,
                    minTrackingConfidence: 0.2,
                });
                landmarkerRef.current = landmarker;
                setModelLoaded(true);
            } catch (err) {
                console.error("MediaPipe Init Error:", err);
            }
        };
        initMediaPipe();
    }, []);

    // --- HAND LOGIC ---
    const estimateGesture = (landmarks: any[]): number | null => {
        if (!landmarks) return null;
        const isFingerExtended = (tipIdx: number, mcpIdx: number) => landmarks[tipIdx].y < landmarks[mcpIdx].y;
        let fingers = 0;
        if (isFingerExtended(8, 5)) fingers++;
        if (isFingerExtended(12, 9)) fingers++;
        if (isFingerExtended(16, 13)) fingers++;
        if (isFingerExtended(20, 17)) fingers++;

        const thumbTip = landmarks[4];
        const thumbIP = landmarks[3];
        const isThumbHighest = thumbTip.y < landmarks[8].y && thumbTip.y < landmarks[12].y && thumbTip.y < landmarks[16].y && thumbTip.y < landmarks[20].y;

        if (fingers === 0 && isThumbHighest && thumbTip.y < thumbIP.y) return 6; // Thumbs Up

        const thumbWide = Math.abs(thumbTip.x - landmarks[17].x) > Math.abs(landmarks[5].x - landmarks[17].x);
        if (fingers === 4) return thumbWide ? 5 : 4;
        if (fingers > 0 && fingers < 4) return fingers;
        return null;
    };

    // --- DETECTION LOOP ---
    const detect = useCallback(async () => {
        if (!landmarkerRef.current || !webcamRef.current?.video || webcamRef.current.video.readyState !== 4) {
            requestRef.current = requestAnimationFrame(detect);
            return;
        }
        const video = webcamRef.current.video;
        const startTimeMs = performance.now();
        try {
            const results = landmarkerRef.current.detectForVideo(video, startTimeMs);
            if (results.landmarks && results.landmarks.length > 0) {
                const gesture = estimateGesture(results.landmarks[0]);
                if (gesture && gesture >= 1 && gesture <= 6) setDetectedGesture(gesture);
                else setDetectedGesture(null);
            } else setDetectedGesture(null);
        } catch (e) { console.error("Detection Loop Error:", e); }
        requestRef.current = requestAnimationFrame(detect);
    }, []);

    useEffect(() => {
        if (modelLoaded && (gameState === 'TOSS' || gameState === 'INNINGS_1' || gameState === 'INNINGS_2')) {
            requestRef.current = requestAnimationFrame(detect);
        }
        return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); }
    }, [modelLoaded, gameState, detect]);


    // --- GAME LOGIC UTILS ---
    const getAiMove = useCallback((isAiBatting: boolean) => {
        if (isAiBatting) {
            const r = Math.random();
            if (r < 0.2) return 6;
            if (r < 0.4) return 4;
            return Math.floor(Math.random() * 6) + 1;
        } else {
            if (lastMoveIndex === 0) return Math.floor(Math.random() * 6) + 1;
            // Improved AI: Counter player habits?
            // For now, random is safest to avoid predictable loops
            return Math.floor(Math.random() * 6) + 1;
        }
    }, [lastMoveIndex]);

    const handleBallLogic = useCallback((pMove: number) => {
        const aiMove = Math.floor(Math.random() * 6) + 1;
        setLastPlayerMove(pMove);
        setLastAiMove(aiMove);

        const isOut = pMove === aiMove;
        const currentBattingMove = playerRole === 'BAT' ? pMove : aiMove;

        setBallHistory(prev => [...prev, { p: pMove, ai: aiMove }].slice(-6));

        if (gameState === 'INNINGS_1') {
            if (isOut) {
                setPopup({ title: 'WICKET!', subtitle: `End of Innings. Target: ${inningsScore + 1}`, color: 'bg-red-600' });
                setPopup({ title: 'WICKET!', subtitle: `End of Innings. Target: ${inningsScore + 1}`, color: 'bg-red-600' });
                setCommentary("WICKET! INNINGS OVER.");
                logicTimerRef.current = setTimeout(() => {
                    setTarget(inningsScore + 1);
                    setPlayerRole(playerRole === 'BAT' ? 'BOWL' : 'BAT');
                    setInningsScore(0);
                    setBallHistory([]);
                    setGameState('INNINGS_2');
                    setPopup(null); // Clear popup
                }, 3000);
            } else {
                setInningsScore(prev => prev + currentBattingMove);
                setCommentary(`${currentBattingMove} RUNS SCORED.`);
            }
        } else {
            // Innings 2 
            if (isOut) {
                const result = (playerRole === 'BAT')
                    ? (inningsScore >= target! ? 'WIN' : 'LOSS')
                    : (inningsScore >= target! ? 'LOSS' : 'WIN');

                setPopup({
                    title: 'WICKET!',
                    subtitle: result === 'WIN' ? 'You reached the target!' : 'All Out!',
                    color: result === 'WIN' ? 'bg-neo-green' : 'bg-red-600'
                });

                logicTimerRef.current = setTimeout(() => finishMatch(result), 2000);
            } else {
                const diff = currentBattingMove;
                setInningsScore(prev => prev + diff);
                setCommentary(`${diff} RUNS SCORED.`);

                if (inningsScore + diff >= target!) {
                    setPopup({ title: 'VICTORY!', subtitle: 'Target Chased!', color: 'bg-neo-green' });
                    logicTimerRef.current = setTimeout(() => finishMatch(playerRole === 'BAT' ? 'WIN' : 'LOSS'), 2000);
                }
            }
        }
    }, [inningsScore, gameState, playerRole, target]);

    const playTossLogic = useCallback((playerNum: number) => {
        if (!tossChoice) return;
        const aiNum = Math.floor(Math.random() * 6) + 1;
        const sum = playerNum + aiNum;
        const isSumOdd = sum % 2 !== 0;
        const resultType = isSumOdd ? 'ODD' : 'EVE';
        const playerWonToss = (isSumOdd && tossChoice === 'ODD') || (!isSumOdd && tossChoice === 'EVE');

        setLastPlayerMove(playerNum);
        setLastAiMove(aiNum);

        if (playerWonToss) {
            setTossWinner('PLAYER');
            setPopup({ title: 'YOU WON THE TOSS!', subtitle: `Sum: ${sum} (${resultType})`, color: 'bg-neo-green' });
            logicTimerRef.current = setTimeout(() => setPopup(null), 2000);
            // Player will clarify Bat/Bowl in UI manually
        } else {
            setTossWinner('AI');
            const airole = Math.random() > 0.5 ? 'BAT' : 'BOWL';
            setPopup({ title: 'AI WON TOSS', subtitle: `AI Chose to ${airole}`, color: 'bg-red-500' });

            logicTimerRef.current = setTimeout(() => {
                setPopup(null);
                startInnings1(airole === 'BAT' ? 'BOWL' : 'BAT');
            }, 3000);
        }
    }, [tossChoice]);


    const handleTimerFinish = useCallback(async () => {
        setIsThinking(true);
        const move = detectedGesture;
        await new Promise(r => setTimeout(r, 500));

        if (!move) {
            setCommentary("Gesture not detected! Try again.");
        } else {
            if (gameState === 'TOSS') playTossLogic(move);
            else handleBallLogic(move);
        }

        logicTimerRef.current = setTimeout(() => {
            setIsThinking(false);
            setGameTimer(2);
        }, 2000);
    }, [detectedGesture, gameState, playTossLogic, handleBallLogic]);

    // --- GAME LOOP ---
    // Pause matches if popup is showing
    const isPlaying = (gameState === 'INNINGS_1' || gameState === 'INNINGS_2') || (gameState === 'TOSS' && tossChoice && !lastPlayerMove);
    const isPaused = isThinking || (popup !== null);

    useEffect(() => {
        if (!isPlaying || isPaused) {
            if (!isPlaying) setGameTimer(null);
            return;
        }

        if (gameTimer === null) {
            setGameTimer(2);
            return;
        }

        if (gameTimer === 0) {
            handleTimerFinish();
            return;
        }

        const timeout = setTimeout(() => {
            setGameTimer(t => (t as number) - 1);
        }, 1000);

        return () => clearTimeout(timeout);
    }, [gameTimer, isPlaying, isPaused, handleTimerFinish]);


    // --- HELPERS ---
    const startInnings1 = (role: Role) => {
        setPlayerRole(role);
        setInningsScore(0);
        setBallHistory([]);
        setGameState('INNINGS_1');
        setCommentary(role === 'BAT' ? "You are Batting First" : "You are Bowling First");
        setLastPlayerMove(null);
        setLastAiMove(null);
        setTossWinner(null);
        setGameTimer(2);
    };

    const finishMatch = async (result: 'WIN' | 'LOSS' | 'DRAW') => {
        setPopup(null); // Clear any partial popups
        setGameResult(result);
        const reward = result === 'WIN' ? 30 : 0;
        if (result === 'WIN') {
            if (playerData) await supabase.from('players').update({ stonks: playerData.stonks + reward }).eq('uid', uid);
        }
        await supabase.from('game_logs').insert({
            player_uid: uid,
            game_title: 'Odd-Eve Cricket',
            result: result,
            stonks_change: result === 'WIN' ? reward : 0
        });
        setGameState('RESULT');
    };

    const resetGame = () => {
        setGameState('AUTH');
        setUid('');
        setPlayerData(null);
        resetMatch();
    };

    const resetMatch = () => {
        setGameResult(null);
        setPlayerRole(null);
        setTarget(null);
        setInningsScore(0);
        setBallHistory([]);
        setLastPlayerMove(null);
        setLastAiMove(null);
        setCommentary('Match Starting...');
        setLastMoveIndex(0);
        setTossChoice(null);
        setTossWinner(null);
        setIsThinking(false);
        setGameTimer(null);
        setPopup(null);
    };

    // AUTH & BET are now handled by Standard components separately
    const handleAuthVerify = async (id: string) => {
        setUid(id);
        setLoading(true);
        const { data } = await supabase.from('players').select('name, stonks').eq('uid', id).single();
        if (data) {
            setPlayerData(data);
            setGameState('BET');
        } else {
            showToast('Player not found', 'error');
        }
        setLoading(false);
    };

    const payAndStart = async () => {
        if (!playerData || playerData.stonks < GAME_CONSTANTS.ENTRY_FEE) { showToast(`Insufficient Stonks! Need ${GAME_CONSTANTS.ENTRY_FEE}`, 'error'); return; }
        setLoading(true);
        const { error } = await supabase.rpc('deduct_stonks', { p_uid: uid, amount: GAME_CONSTANTS.ENTRY_FEE });
        const { error: updateError } = await supabase.from('players').update({ stonks: playerData.stonks - GAME_CONSTANTS.ENTRY_FEE }).eq('uid', uid);
        if (updateError) { showToast('Transaction Failed', 'error'); setLoading(false); return; }
        setPlayerData({ ...playerData, stonks: playerData.stonks - GAME_CONSTANTS.ENTRY_FEE });
        setGameState('TOSS');
        setLoading(false);
    };

    // --- RENDER HELPERS ---
    if (gameState === 'AUTH') {
        return (
            <StandardAuth
                onVerify={handleAuthVerify}
                loading={loading}
                title={
                    <h1 className="text-4xl font-black uppercase text-center mb-8">
                        ODD-EVE <span className="text-neo-pink">AI</span>
                    </h1>
                }
                themeColor="neo-yellow"
                bgColor="bg-neo-yellow"
            />
        );
    }

    if (gameState === 'BET' && playerData) {
        return (
            <StandardBet
                playerData={playerData}
                uid={uid}
                entryFee={GAME_CONSTANTS.ENTRY_FEE}
                onPlay={payAndStart}
                onCancel={() => setGameState('AUTH')}
                loading={loading}
                themeColor="neo-yellow"
                bgColor="bg-neo-yellow"
                title={
                    <h1 className="text-4xl font-black uppercase text-center mb-8">
                        ODD-EVE <span className="text-neo-pink">AI</span>
                    </h1>
                }
                instructions={
                    <ul className="text-left text-sm space-y-2 bg-gray-100 p-4 border-2 border-dashed border-gray-400">
                        <li>👋 1-5 Fingers: Play Number</li>
                        <li>👍 Thumbs Up: Play 6</li>
                        <li>⏱️ Move every 2 seconds</li>
                    </ul>
                }
            />
        );
    }

    return (
        <div className="min-h-screen bg-neo-yellow text-black font-mono flex flex-col md:flex-row">

            {(gameState === 'TOSS' || gameState === 'INNINGS_1' || gameState === 'INNINGS_2' || gameState === 'RESULT') && (
                <>
                    {/* LEFT PANEL */}
                    <div className="flex-1 p-4 md:p-8 flex flex-col items-center justify-center relative">
                        <h1 className="text-3xl font-heading mb-4 md:absolute md:top-8 md:left-8 uppercase">Odd-Eve <span className="text-neo-pink">AI</span></h1>

                        {/* REMOVED INLINE AUTH/BET PANELS */}

                        {(gameState === 'TOSS' || gameState === 'INNINGS_1' || gameState === 'INNINGS_2') && (
                            <div className="relative w-full max-w-2xl aspect-video bg-black border-8 border-black shadow-[12px_12px_0px_#000] overflow-hidden group">
                                <Webcam ref={webcamRef} className="w-full h-full object-cover opacity-80" mirrored />

                                {/* TOP INDICATORS */}
                                <div className="absolute top-4 w-full flex justify-center items-center gap-4 z-20 pointer-events-none">
                                    {/* TOSS CHOICE */}
                                    {gameState === 'TOSS' && tossChoice && !playerRole && (
                                        <div className="bg-white px-6 py-2 border-4 border-black font-heading text-xl shadow-[4px_4px_0px_#000]">
                                            CALL: <span className={tossChoice === 'ODD' ? 'text-neo-pink' : 'text-neo-cyan'}>{tossChoice}</span>
                                        </div>
                                    )}

                                    {/* ROLE INDICATOR */}
                                    {playerRole && (
                                        <div className={`px-6 py-2 border-4 border-black font-heading text-xl shadow-[4px_4px_0px_#000] ${playerRole === 'BAT' ? 'bg-neo-green' : 'bg-neo-cyan'}`}>
                                            YOU ARE {playerRole === 'BAT' ? 'BATTING 🏏' : 'BOWLING ⚾'}
                                        </div>
                                    )}
                                </div>

                                {/* TIMER */}
                                {!isThinking && !popup && gameTimer !== null && (
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <div className={`text-[12rem] font-heading text-white drop-shadow-[0_4px_4px_rgba(0,0,0,1)] animate-pulse`}>{gameTimer}</div>
                                    </div>
                                )}

                                {/* POPUP OVERLAY */}
                                {popup && (
                                    <div className={`absolute inset-0 ${popup.color} bg-opacity-90 flex flex-col items-center justify-center text-white z-40 animate-in zoom-in duration-300`}>
                                        <h2 className="text-6xl font-heading mb-4 text-center drop-shadow-[4px_4px_0px_rgba(0,0,0,1)] uppercase">{popup.title}</h2>
                                        {popup.subtitle && <p className="text-2xl font-bold uppercase tracking-widest">{popup.subtitle}</p>}
                                    </div>
                                )}

                                {/* LOADING/THINKING */}
                                {isThinking && (
                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-30">
                                        <Loader2 className="w-16 h-16 text-white animate-spin" />
                                    </div>
                                )}

                                <div className="absolute bottom-4 left-4 bg-black/80 text-white p-4 border-2 border-white backdrop-blur">
                                    <div className="text-xs text-gray-400 uppercase mb-1">Detected Hand</div>
                                    <div className="text-4xl font-bold">{detectedGesture ? (detectedGesture === 6 ? '👍 6' : `✋ ${detectedGesture}`) : '...'}</div>
                                    <div className="text-[10px] text-green-400 mt-1">MediaPipe Vision Ready</div>
                                </div>
                            </div>
                        )}

                        {/* TOSS SELECTION UI */}
                        {gameState === 'TOSS' && !tossChoice && (
                            <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-30">
                                <div className="bg-white p-8 border-4 border-black text-center">
                                    <h2 className="text-3xl font-heading mb-6">ODD OR EVE?</h2>
                                    <div className="flex gap-4">
                                        <button onClick={() => setTossChoice('ODD')} className="bg-black text-white px-8 py-4 font-heading text-xl hover:scale-105 transition-transform">ODD</button>
                                        <button onClick={() => setTossChoice('EVE')} className="bg-white border-4 border-black px-8 py-4 font-heading text-xl hover:scale-105 transition-transform">EVE</button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* TOSS WINNER MANUAL CHOICE */}
                        {gameState === 'TOSS' && tossWinner === 'PLAYER' && !popup && !playerRole && (
                            <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-30">
                                <div className="bg-white p-8 border-4 border-black text-center">
                                    <h2 className="text-2xl font-heading mb-6">YOU WON! CHOOSE:</h2>
                                    <div className="flex gap-4">
                                        <button onClick={() => startInnings1('BAT')} className="bg-neo-green border-4 border-black px-8 py-4 font-heading text-xl hover:scale-105 transition-transform">BAT 🏏</button>
                                        <button onClick={() => startInnings1('BOWL')} className="bg-neo-cyan border-4 border-black px-8 py-4 font-heading text-xl hover:scale-105 transition-transform">BOWL ⚾</button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* FINAL RESULT */}
                        {gameState === 'RESULT' && (
                            <div className="absolute inset-0 bg-black/90 flex items-center justify-center z-50 animate-in fade-in">
                                <div className={`p-8 border-4 border-black text-center max-w-md w-full ${gameResult === 'WIN' ? 'bg-neo-green' : 'bg-red-500 text-white'}`}>
                                    {gameResult === 'WIN' ? <Trophy size={64} className="mx-auto mb-4" /> : <Skull size={64} className="mx-auto mb-4" />}
                                    <h2 className="text-6xl font-heading mb-2">{gameResult === 'WIN' ? 'VICTORY' : 'DEFEAT'}</h2>
                                    <p className="text-2xl font-bold mb-8">{gameResult === 'WIN' ? '+30 STONKS' : 'PLAY AGAIN?'}</p>
                                    <div className="mb-6 p-4 bg-white/10 border-2 border-white/50">
                                        <div className="text-xs font-bold uppercase mb-1 text-white/70">Total Stonks</div>
                                        <div className="text-3xl font-bold text-white">{playerData?.stonks} 💎</div>
                                    </div>
                                    <button onClick={resetGame} className="w-full bg-black text-white py-4 font-heading text-xl border-4 border-white hover:bg-white hover:text-black transition-colors">EXIT</button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* RIGHT PANEL: SCOREBOARD */}
                    {(gameState === 'INNINGS_1' || gameState === 'INNINGS_2' || gameState === 'TOSS') && (
                        <div className="w-full md:w-96 bg-white border-l-8 border-black p-6 flex flex-col gap-6">
                            <div className="bg-gray-100 border-4 border-black p-4 min-h-[100px] flex items-center justify-center text-center font-bold text-lg shadow-[4px_4px_0px_#000]">
                                {commentary}
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-black text-white p-4 text-center">
                                    <div className="text-xs text-gray-400 uppercase">Score</div>
                                    <div className="text-5xl font-heading text-neo-pink">{inningsScore}</div>
                                </div>
                                <div className="bg-white border-4 border-black p-4 text-center flex flex-col justify-center">
                                    <div className="text-xs text-gray-400 uppercase">{target ? 'Target' : 'Phase'}</div>
                                    <div className="text-2xl font-bold">{target || (gameState === 'TOSS' ? 'TOSS' : (playerRole === 'BAT' ? 'BATTING' : 'BOWLING'))}</div>
                                </div>
                            </div>
                            <div className="flex justify-between items-center border-t-2 border-dashed border-gray-300 pt-6">
                                <div className="text-center">
                                    <div className="text-xs font-bold mb-2">YOU</div>
                                    <div className="w-20 h-20 bg-neo-green border-4 border-black flex items-center justify-center text-4xl font-heading">
                                        {lastPlayerMove || '-'}
                                    </div>
                                </div>
                                <div className="text-xl font-bold text-gray-400">VS</div>
                                <div className="text-center">
                                    <div className="text-xs font-bold mb-2">AI</div>
                                    <div className="w-20 h-20 bg-neo-cyan border-4 border-black flex items-center justify-center text-4xl font-heading">
                                        {lastAiMove || '-'}
                                    </div>
                                </div>
                            </div>
                            <div>
                                <div className="text-xs font-bold mb-2 uppercase tracking-widest">Last 6 Balls</div>
                                <div className="flex gap-2">
                                    {ballHistory.slice(-6).map((b, i) => (
                                        <div key={i} className={`w-10 h-10 rounded-full flex items-center justify-center font-bold border-2 border-black text-sm ${b.p === b.ai ? 'bg-red-500 text-white' : 'bg-gray-100'}`}>
                                            {playerRole === 'BAT' ? b.p : b.ai}
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="mt-auto pt-8 text-center text-xs text-gray-400">
                                AI MELA 2026 • ODD-EVE CRICKET
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
