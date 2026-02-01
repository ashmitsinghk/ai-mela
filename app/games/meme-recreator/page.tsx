'use client';

import { useState, useRef, useEffect } from 'react';
import Webcam from 'react-webcam';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import { useToast } from '@/contexts/ToastContext';
import { GAME_CONSTANTS } from '@/utils/game-constants';
import StandardAuth from '@/components/game-ui/StandardAuth';
import StandardBet from '@/components/game-ui/StandardBet';
import Script from 'next/script';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

// Declare global types for CDN loaded libraries
declare global {
    interface Window {
        tf: any;
        poseDetection: any;
    }
}

// --- DATASET ---
const MEMES = [
    {
        id: 'think',
        hint: 'Think about it...',
        image: 'https://i.imgflip.com/1h7in3.jpg', // Roll Safe
        targetPose: 'THINKING'
    },
    {
        id: 'drake_no',
        hint: 'Nah, I don\'t like that.',
        image: 'https://i.imgflip.com/30b1gx.jpg',
        targetPose: 'HAND_STOP'
    },
    {
        id: 'wakanda',
        hint: 'Forever!',
        image: 'https://media.tenor.com/M_a00000000AAAAj/wakanda-forever.gif',
        targetPose: 'WAKANDA'
    },
    {
        id: 'tpose',
        hint: 'Dominance asserted.',
        image: 'https://upload.wikimedia.org/wikipedia/commons/4/45/T-pose.jpg',
        targetPose: 'T_POSE'
    },
    {
        id: 'ymca',
        hint: 'It\'s fun to stay there.',
        image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/YMCA_dance.jpg/320px-YMCA_dance.jpg',
        targetPose: 'ARMS_UP'
    }
];

// --- HEURISTICS ---
// Keypoints: 0:nose, 5:left_shoulder, 6:right_shoulder, 7:left_elbow, 8:right_elbow, 9:left_wrist, 10:right_wrist
const checkPose = (keypoints: any[], target: string): boolean => {
    if (!keypoints || keypoints.length < 11) return false;

    // Helper to get {x, y, score}
    const get = (name: string) => keypoints.find((k: any) => k.name === name);
    const nose = get('nose');
    const ls = get('left_shoulder');
    const rs = get('right_shoulder');
    const lw = get('left_wrist');
    const rw = get('right_wrist');

    if (!nose || !ls || !rs || !lw || !rw) return false;
    // Check confidence
    const minConf = 0.3;
    if ((nose.score || 0) < minConf || (lw.score || 0) < minConf || (rw.score || 0) < minConf) return false;

    switch (target) {
        case 'THINKING':
            // One hand near head (wrist near nose/eye)
            return (
                (lw.y < ls.y && Math.abs(lw.x - nose.x) < Math.abs(rs.x - ls.x) * 0.5 && Math.abs(lw.y - nose.y) < Math.abs(rs.x - ls.x) * 0.5) ||
                (rw.y < rs.y && Math.abs(rw.x - nose.x) < Math.abs(rs.x - ls.x) * 0.5 && Math.abs(rw.y - nose.y) < Math.abs(rs.x - ls.x) * 0.5)
            );

        case 'HAND_STOP':
            // Drake No: One hand up and out
            return (
                (lw.y < ls.y && lw.x > ls.x + 20) || // Left hand up and left
                (rw.y < rs.y && rw.x < rs.x - 20)    // Right hand up and right (mirror)
            );

        case 'WAKANDA':
            // Wrists crossed over chest
            return (
                Math.abs(lw.x - rw.x) < 40 &&
                lw.y > ls.y && lw.y < (ls.y + 200)
            );

        case 'T_POSE':
            // Arms out
            const armSpan = Math.abs(lw.x - rw.x);
            const shoulderSpan = Math.abs(ls.x - rs.x);
            return (
                Math.abs(lw.y - ls.y) < 30 &&
                Math.abs(rw.y - rs.y) < 30 &&
                armSpan > shoulderSpan * 2.5
            );

        case 'ARMS_UP':
            // Y shape
            return (
                lw.y < nose.y && rw.y < nose.y &&
                Math.abs(lw.x - rw.x) > 50
            );

        default:
            return false;
    }
};

export default function MemeRecreator() {
    const { showToast } = useToast();
    const router = useRouter();
    const webcamRef = useRef<Webcam>(null);
    const [gameState, setGameState] = useState<'AUTH' | 'BET' | 'PLAYING' | 'SUCCESS' | 'FINISHED'>('AUTH');
    const [modelLoaded, setModelLoaded] = useState(false);
    const [playerData, setPlayerData] = useState<{ name: string | null; stonks: number } | null>(null);
    const [loading, setLoading] = useState(false);

    // Timer
    const [totalTimeLeft, setTotalTimeLeft] = useState(90);
    const [itemTimeLeft, setItemTimeLeft] = useState(9);

    // Game Data
    const [score, setScore] = useState(0);
    const [currentMemeIndex, setCurrentMemeIndex] = useState(0);
    const [currentMeme, setCurrentMeme] = useState(MEMES[0]);
    const [uid, setUid] = useState<string | null>(null);

    // AI
    const detectorRef = useRef<any>(null);

    const requestRef = useRef<number>(null);
    const successTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (successTimerRef.current) clearTimeout(successTimerRef.current);
        };
    }, []);

    // Init User
    // removed local storage check in favor of StandardAuth
    useEffect(() => {
        // init
    }, []);

    // Robust loading for CDN scripts
    useEffect(() => {
        const interval = setInterval(async () => {
            if (window.tf && window.poseDetection) {
                try {
                    // Check if backend is registered
                    if (!window.tf.findBackend('webgl')) {
                        console.log('Waiting for WebGL backend...');
                        return;
                    }

                    clearInterval(interval);
                    console.log('TFJS Backends:', window.tf.engine().registryFactory);

                    await window.tf.setBackend('webgl');
                    await window.tf.ready();
                    console.log('TFJS Ready with backend:', window.tf.getBackend());

                    const detectorConfig = { modelType: window.poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING };
                    const detector = await window.poseDetection.createDetector(window.poseDetection.SupportedModels.MoveNet, detectorConfig);
                    detectorRef.current = detector;
                    setModelLoaded(true);
                    console.log('MoveNet Loaded via CDN');
                } catch (e) {
                    console.error('TFJS Init Error:', e);
                    clearInterval(interval);
                }
            }
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    // Game Loop (Timers)
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (gameState === 'PLAYING') {
            interval = setInterval(() => {
                // Main Timer
                setTotalTimeLeft(prev => {
                    if (prev <= 1) {
                        endGame();
                        return 0;
                    }
                    return prev - 1;
                });

                // Item Timer
                setItemTimeLeft(prev => {
                    if (prev <= 1) {
                        // Timeout -> Next Item
                        nextItem();
                        return 9;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [gameState]);

    // Pose Detection Loop
    const detect = async () => {
        if (gameState !== 'PLAYING' || !detectorRef.current || !webcamRef.current?.video || webcamRef.current.video.readyState !== 4) {
            requestRef.current = requestAnimationFrame(detect);
            return;
        }

        const video = webcamRef.current.video;
        const poses = await detectorRef.current.estimatePoses(video);

        if (poses && poses.length > 0) {
            const match = checkPose(poses[0].keypoints, currentMeme.targetPose);
            if (match) {
                handleSuccess();
            }
        }

        requestRef.current = requestAnimationFrame(detect);
    };

    useEffect(() => {
        if (gameState === 'PLAYING') {
            requestRef.current = requestAnimationFrame(detect);
        } else {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        }
        return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
    }, [gameState, currentMeme]);


    const startGame = async () => {
        if (!uid || !playerData) return;
        setLoading(true);

        try {
            // Deduct
            const { error } = await supabase.from('players').update({ stonks: playerData.stonks - GAME_CONSTANTS.ENTRY_FEE }).eq('uid', uid);

            if (error) throw error;

            await supabase.from('game_logs').insert({
                player_uid: uid,
                game_title: 'Meme Recreator (Entry)',
                result: 'LOSS',
                stonks_change: -GAME_CONSTANTS.ENTRY_FEE
            });

            // Start
            setScore(0);
            setTotalTimeLeft(90);
            setCurrentMemeIndex(0);
            pickRandomMeme();
            setGameState('PLAYING');
        } catch (e) {
            showToast('Failed to start game', 'error');
        } finally {
            setLoading(false);
        }
    };

    const pickRandomMeme = () => {
        const rand = MEMES[Math.floor(Math.random() * MEMES.length)];
        setCurrentMeme(rand);
        setItemTimeLeft(9);
    };

    const nextItem = () => {
        pickRandomMeme();
    };

    const handleSuccess = () => {
        setGameState('SUCCESS');
        setScore(s => s + 1);

        // Pause for 2 seconds to show meme
        // Pause for 2 seconds to show meme
        successTimerRef.current = setTimeout(() => {
            if (totalTimeLeft > 0) {
                nextItem();
                setGameState('PLAYING');
            }
        }, 2000);
    };

    const endGame = async () => {
        setGameState('FINISHED');
        // Calc Reward
        let reward = 0;
        if (score >= 5) {
            reward = GAME_CONSTANTS.ENTRY_FEE + (score - 5) * 4;
            if (reward > 40) reward = 40;
        }

        if (reward > 0 && uid) {
            const { data: userData } = await supabase.from('players').select('stonks').eq('uid', uid).single();
            if (userData) {
                await supabase.from('players').update({ stonks: userData.stonks + reward }).eq('uid', uid);
                await supabase.from('game_logs').insert({
                    player_uid: uid,
                    game_title: 'Meme Recreator (Win)',
                    result: 'WIN',
                    stonks_change: reward
                });
            }
        }
    };

    return (
        <div className="min-h-screen bg-black text-neo-green font-mono flex flex-col">
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
                            MEME RECREATOR
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
                    loading={loading || !modelLoaded}
                    themeColor="neo-green"
                    bgColor="bg-black"
                    title={
                        <h1 className="text-4xl md:text-6xl font-heading text-white mb-4">
                            READY?
                        </h1>
                    }
                    instructions={
                        <ul className="text-left space-y-2 text-sm text-gray-800 mb-6">
                            <li>• Hint Only - Recreate the Pose!</li>
                            <li>• 9s per Meme</li>
                            <li>• 5 Solved = Money Back</li>
                            <li>• Max Reward: 40 Stonks</li>
                            {!modelLoaded && <li className="text-red-500 font-bold animate-pulse">Loading AI Models...</li>}
                        </ul>
                    }
                />
            )}

            {(gameState === 'PLAYING' || gameState === 'SUCCESS') && (
                <div className="flex-1 relative flex flex-col">
                    {/* HUD */}
                    <div className="absolute top-14 left-0 right-0 z-10 p-4 flex justify-between items-start pointer-events-none">
                        <div className="bg-black/80 text-white p-2 border-2 border-white">
                            <div className="text-xs text-gray-400">TOTAL</div>
                            <div className="text-2xl font-bold text-white">{totalTimeLeft}s</div>
                        </div>
                        <div className="bg-black/80 text-neo-green p-2 border-2 border-neo-green">
                            <div className="text-xs text-gray-400">SOLVED</div>
                            <div className="text-2xl font-bold">{score}</div>
                        </div>
                    </div>

                    {/* Camera */}
                    <div className="flex-1 relative bg-gray-900 overflow-hidden">
                        <Webcam ref={webcamRef} className="absolute inset-0 w-full h-full object-cover" mirrored />

                        {/* Hint Overlay */}
                        <div className="absolute inset-x-0 bottom-32 flex flex-col items-center justify-center pointer-events-none">
                            <div className="bg-black/80 p-6 rounded-xl backdrop-blur-sm border border-white/20 text-center">
                                <span className="text-gray-400 text-xs uppercase tracking-widest block mb-2">Meme Hint</span>
                                <div className="text-2xl font-bold text-white uppercase">{currentMeme.hint}</div>
                            </div>
                        </div>

                        {/* Item Timer */}
                        <div className="absolute bottom-4 right-4 h-24 w-24 rounded-full border-4 border-white flex items-center justify-center bg-black/50 backdrop-blur">
                            <span className="text-4xl font-bold text-white">{itemTimeLeft}</span>
                        </div>

                        {/* Success Overlay */}
                        {gameState === 'SUCCESS' && (
                            <div className="absolute inset-0 z-30 bg-green-500/90 flex flex-col items-center justify-center p-8 animate-in fade-in duration-300">
                                <h2 className="text-4xl font-heading text-white mb-8">NAILED IT!</h2>
                                {/* Show Original Meme */}
                                {currentMeme.image && (
                                    <img src={currentMeme.image} alt="Meme" className="max-w-full max-h-[50vh] border-8 border-white shadow-2xl rotate-2" />
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {gameState === 'FINISHED' && (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-6">
                    <h1 className="text-5xl font-heading text-white">GAME OVER</h1>
                    <div className="bg-white text-black p-8 border-4 border-neo-green w-full max-w-sm">
                        <div className="text-6xl font-bold mb-4">{score}</div>
                        <div className="text-gray-500 uppercase tracking-widest mb-8">Memes Recreated</div>

                        <div className="flex justify-between border-t border-gray-300 pt-4">
                            <span>Reward:</span>
                            <span className="font-bold text-green-600">
                                {score >= 5 ? (GAME_CONSTANTS.ENTRY_FEE + (score - 5) * 4 > 40 ? 40 : GAME_CONSTANTS.ENTRY_FEE + (score - 5) * 4) : 0} Stonks
                            </span>
                        </div>
                        <div className="flex justify-between border-t border-gray-300 pt-4 mt-4">
                            <span>Total Stonks:</span>
                            <span className="font-bold text-blue-600">
                                {playerData?.stonks} 💎
                            </span>
                        </div>

                        <button onClick={() => setGameState('AUTH')} className="w-full bg-black text-white py-3 mt-8 font-bold">EXIT</button>
                    </div>
                </div>
            )}

            {/* Load TFJS via CDN to bypass Next.js Bundling Issues */}
            <Script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-core" strategy="lazyOnload" />
            <Script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-converter" strategy="lazyOnload" />
            <Script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-webgl" strategy="lazyOnload" />
            <Script src="https://cdn.jsdelivr.net/npm/@tensorflow-models/pose-detection" strategy="lazyOnload" />
        </div>
    );
}
