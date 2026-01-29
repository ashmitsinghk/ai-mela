'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import { Trophy, Skull, Loader2, RefreshCw } from 'lucide-react';

type GamePhase = 'AUTH' | 'BET' | 'TOSS' | 'INNINGS_1' | 'INNINGS_2' | 'RESULT';
type Role = 'BAT' | 'BOWL';

export default function OddEveGame() {
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

    // Toss State
    const [tossChoice, setTossChoice] = useState<'ODD' | 'EVE' | null>(null); // Player's call

    // Move State
    const [lastPlayerMove, setLastPlayerMove] = useState<number | null>(null);
    const [lastAiMove, setLastAiMove] = useState<number | null>(null);
    const [commentary, setCommentary] = useState('Match Starting...');

    // --- AI BRAIN (Session Based) ---
    // Transition Matrix: [PreviousMove][NextMove] -> Frequency
    // e.g. playerPattern[6][4] = 5 means after playing 6, player played 4 five times.
    const [playerPattern, setPlayerPattern] = useState<number[][]>(
        Array(7).fill(0).map(() => Array(7).fill(0))
    );
    const [lastMoveIndex, setLastMoveIndex] = useState<number>(0); // 0 = start of innings

    const resetGame = () => {
        setGameState('AUTH');
        setUid('');
        setPlayerData(null);
        resetMatch();
        setPlayerPattern(Array(7).fill(0).map(() => Array(7).fill(0)));
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
        setTossChoice(null); // Reset toss choice for rematch
    };

    const [gameResult, setGameResult] = useState<'WIN' | 'LOSS' | 'DRAW' | null>(null);

    // --- 1. AUTH & DEDUCTION ---
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

    const payAndStart = async () => {
        if (!playerData || playerData.stonks < 20) {
            alert('Insufficient Stonks!');
            return;
        }
        setLoading(true);

        const { error } = await supabase.rpc('deduct_stonks', { p_uid: uid, amount: 20 });
        const { error: updateError } = await supabase
            .from('players')
            .update({ stonks: playerData.stonks - 20 })
            .eq('uid', uid);

        if (updateError) {
            alert('Transaction Failed');
            setLoading(false);
            return;
        }

        // Log Entry
        await supabase.from('game_logs').insert({
            player_uid: uid,
            game_title: 'Odd-Eve Cricket',
            result: 'PLAYING',
            stonks_change: -20
        });

        setPlayerData({ ...playerData, stonks: playerData.stonks - 20 });
        setGameState('TOSS');
        setLoading(false);
    };

    // --- 2. TOSS LOGIC ---
    // Step A: Player picks Number. AI picks Number.
    // If (Sum is Odd && Player chose Odd) -> Player Wins Toss
    const playToss = (playerNum: number) => {
        if (!tossChoice) {
            alert('Choose Odd or Eve first!');
            return;
        }

        const aiNum = Math.floor(Math.random() * 6) + 1;
        const sum = playerNum + aiNum;
        const isSumOdd = sum % 2 !== 0;
        const playerWonToss = (isSumOdd && tossChoice === 'ODD') || (!isSumOdd && tossChoice === 'EVE');

        setLastPlayerMove(playerNum);
        setLastAiMove(aiNum);

        if (playerWonToss) {
            setCommentary(`Sum is ${sum}. YOU WON THE TOSS! Choose to Bat or Bowl.`);
            // Wait for user to select Role
        } else {
            // AI Decisions
            const airole = Math.random() > 0.5 ? 'BAT' : 'BOWL';
            setCommentary(`Sum is ${sum}. AI Won Toss and chose to ${airole}.`);
            setTimeout(() => {
                startInnings1(airole === 'BAT' ? 'BOWL' : 'BAT');
            }, 2000);
        }
    };

    const startInnings1 = (role: Role) => {
        setPlayerRole(role); // If Role is BAT, Player Bats first
        setInningsScore(0);
        setBallHistory([]);
        setGameState('INNINGS_1');
        setLastMoveIndex(0); // Reset pattern tracking current context
        setCommentary(role === 'BAT' ? "You are Batting. Set a high score!" : "You are Bowling. Get the AI out!");
    };

    // --- 3. AI PREDICTION LOGIC ---
    const getAiMove = (isAiBatting: boolean) => {
        if (isAiBatting) {
            // AI Batting: Randomize to be unpredictable
            // Heuristics: Avoid numbers played recently? No, pure random is best for batting usually.
            // Maybe bias towards 4 and 6 for aggressive play?
            const r = Math.random();
            if (r < 0.2) return 6;
            if (r < 0.4) return 4;
            return Math.floor(Math.random() * 6) + 1;
        } else {
            // AI Bowling: Predict Player's Move
            // Look at `lastMoveIndex` (previous player move)
            // find `playerPattern[lastMoveIndex]` which is an array of frequencies [0..6]
            if (lastMoveIndex === 0) return Math.floor(Math.random() * 6) + 1; // First ball random

            const history = playerPattern[lastMoveIndex];
            // Find max frequency
            let maxFreq = -1;
            let likelyMove = -1;

            // Add some randomness so it's not 100% rigid
            if (Math.random() > 0.7) return Math.floor(Math.random() * 6) + 1;

            history.forEach((freq, move) => {
                if (freq > maxFreq) {
                    maxFreq = freq;
                    likelyMove = move;
                }
            });

            if (likelyMove > 0) return likelyMove;
            return Math.floor(Math.random() * 6) + 1;
        }
    };

    const updatePatterns = (pMove: number) => {
        if (lastMoveIndex !== 0) {
            const newPatterns = [...playerPattern];
            newPatterns[lastMoveIndex][pMove] = (newPatterns[lastMoveIndex][pMove] || 0) + 1;
            setPlayerPattern(newPatterns);
        }
        setLastMoveIndex(pMove);
    };

    // --- 4. GAMEPLAY LOGIC ---
    const handleBall = (pMove: number) => {
        const aiMove = getAiMove(playerRole === 'BOWL'); // If player bowling, AI is batting (getAiMove(true))

        setLastPlayerMove(pMove);
        setLastAiMove(aiMove);
        updatePatterns(pMove);

        const isOut = pMove === aiMove;
        const currentBattingMove = playerRole === 'BAT' ? pMove : aiMove;

        // Visual History
        setBallHistory(prev => [...prev, { p: pMove, ai: aiMove }].slice(-6)); // Keep last 6 balls

        if (gameState === 'INNINGS_1') {
            if (isOut) {
                setCommentary(`WICKET! Innings over. Score: ${inningsScore}. Target: ${inningsScore + 1}`);
                setTimeout(() => {
                    setTarget(inningsScore + 1);
                    setPlayerRole(playerRole === 'BAT' ? 'BOWL' : 'BAT'); // Swap roles
                    setInningsScore(0);
                    setBallHistory([]);
                    setGameState('INNINGS_2');
                    setLastMoveIndex(0);
                }, 2000);
            } else {
                setInningsScore(prev => prev + currentBattingMove);
                setCommentary(`${currentBattingMove} runs scored.`);
            }
        } else {
            // INNINGS 2
            if (isOut) {
                // Chasing team is out. 
                // If Player was Batting (Chasing) -> Player Lost
                // If AI was Batting (Chasing) -> Player Won
                if (playerRole === 'BAT') {
                    // Player Out while chasing
                    if (inningsScore >= target!) {
                        finishMatch('WIN'); // Scored enough before out? (Technically game ends on run scored, but typical logic)
                    } else {
                        finishMatch('LOSS');
                    }
                } else {
                    // AI Out while chasing
                    if (inningsScore >= target!) {
                        finishMatch('LOSS');
                    } else {
                        finishMatch('WIN');
                    }
                }
            } else {
                const newScore = inningsScore + currentBattingMove;
                setInningsScore(newScore);
                setCommentary(`${currentBattingMove} runs scored.`);
                if (newScore >= target!) {
                    // Target Chased
                    finishMatch(playerRole === 'BAT' ? 'WIN' : 'LOSS');
                }
            }
        }
    };

    const finishMatch = async (result: 'WIN' | 'LOSS' | 'DRAW') => {
        setGameResult(result);
        const reward = result === 'WIN' ? 35 : 0;

        if (result === 'WIN') {
            setCommentary("YOU WON THE MATCH! +35 STONKS");
            await supabase
                .from('players')
                .update({ stonks: playerData!.stonks + reward })
                .eq('uid', uid);
        } else {
            setCommentary("YOU LOST THE MATCH.");
        }

        await supabase.from('game_logs').insert({
            player_uid: uid,
            game_title: 'Odd-Eve Cricket',
            result: result,
            stonks_change: result === 'WIN' ? reward : 0
        });

        setGameState('RESULT');
    };


    return (
        <div className="h-screen overflow-auto bg-neo-yellow text-black font-mono p-4 md:p-8 flex flex-col items-center justify-center">
            <div className="max-w-2xl w-full bg-white border-8 border-black shadow-[16px_16px_0px_#000] p-4 md:p-8">
                <h1 className="text-3xl md:text-5xl font-heading mb-4 text-center uppercase leading-none">ODD-EVE <span className="text-neo-pink">CRICKET</span></h1>

                {gameState === 'AUTH' && (
                    <form onSubmit={checkPlayer} className="flex flex-col gap-4">
                        <label className="font-bold text-xl">SCAN USER ID:</label>
                        <input
                            type="text"
                            value={uid}
                            onChange={(e) => setUid(e.target.value.toUpperCase())}
                            className="text-4xl font-heading p-4 border-4 border-black text-center"
                            placeholder="23BAI..."
                            autoFocus
                        />
                        <button disabled={loading} className="bg-black text-white text-2xl font-heading py-4 hover:bg-neo-green hover:text-black transition-colors">
                            {loading ? <Loader2 className="animate-spin mx-auto" /> : 'VERIFY PLAYER'}
                        </button>
                    </form>
                )}

                {gameState === 'BET' && playerData && (
                    <div className="text-center">
                        <h2 className="text-2xl font-bold mb-2">PLAYER: {playerData.name || uid}</h2>
                        <div className="text-4xl font-heading mb-6">BALANCE: {playerData.stonks} 💎</div>
                        {playerData.stonks >= 20 ? (
                            <button onClick={payAndStart} disabled={loading} className="w-full bg-neo-green text-black text-3xl font-heading py-6 border-4 border-black shadow-neo hover:translate-y-1 hover:shadow-none transition-all">
                                {loading ? 'PROCESSING...' : 'PAY 20 & START'}
                            </button>
                        ) : (
                            <div className="bg-red-500 text-white p-4 font-bold text-xl">INSUFFICIENT FUNDS</div>
                        )}
                        <button onClick={resetGame} className="mt-4 underline">Cancel</button>
                    </div>
                )}

                {gameState === 'TOSS' && (
                    <div className="text-center">
                        <h2 className="text-3xl font-bold mb-6">TOSS PHASE</h2>
                        {!tossChoice ? (
                            <div className="flex gap-4 mb-8">
                                <button onClick={() => setTossChoice('ODD')} className="flex-1 bg-black text-white py-4 font-heading text-xl hover:bg-neo-pink">ODD</button>
                                <button onClick={() => setTossChoice('EVE')} className="flex-1 bg-white border-4 border-black text-black py-4 font-heading text-xl hover:bg-neo-cyan">EVE</button>
                            </div>
                        ) : (
                            // Phase 2 of Toss: Pick Number
                            !lastPlayerMove ? (
                                <div>
                                    <p className="mb-4 text-xl">You called <strong>{tossChoice}</strong>. Pick a number:</p>
                                    <div className="grid grid-cols-3 gap-4 mb-4">
                                        {[1, 2, 3, 4, 5, 6].map(n => (
                                            <button key={n} onClick={() => playToss(n)} className="border-2 border-black p-4 text-2xl font-bold hover:bg-black hover:text-white">{n}</button>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                // Toss Result Shown via Commentary, providing Bat/Bowl choice if won
                                <div className="animate-in fade-in">
                                    <p className="text-2xl font-bold mb-4">{commentary}</p>
                                    {commentary.includes("YOU WON") && (
                                        <div className="flex gap-4">
                                            <button onClick={() => startInnings1('BAT')} className="flex-1 bg-neo-green py-4 border-4 border-black font-heading text-xl">BAT 🏏</button>
                                            <button onClick={() => startInnings1('BOWL')} className="flex-1 bg-neo-cyan py-4 border-4 border-black font-heading text-xl">BOWL ⚾</button>
                                        </div>
                                    )}
                                </div>
                            )
                        )}
                    </div>
                )}

                {(gameState === 'INNINGS_1' || gameState === 'INNINGS_2') && (
                    <div className="text-center">
                        {/* Scoreboard */}
                        <div className="grid grid-cols-2 bg-black text-white p-4 mb-4">
                            <div className="text-left border-r md:pr-4">
                                <div className="text-xs text-gray-400">INNINGS</div>
                                <div className="font-bold text-xl">{gameState === 'INNINGS_1' ? '1st' : '2nd (Chase)'}</div>
                            </div>
                            <div className="text-right border-l md:pl-4">
                                <div className="text-xs text-gray-400">{target ? `TARGET: ${target}` : 'CURRENT SCORE'}</div>
                                <div className="font-heading text-4xl text-neo-pink">{inningsScore}</div>
                            </div>
                        </div>

                        {/* Status Bar */}
                        <div className="bg-gray-100 p-2 border-b-4 border-black mb-6 font-bold text-lg">
                            {commentary}
                        </div>

                        <div className="flex justify-between md:px-12 mb-8">
                            <div className="text-center">
                                <p className="text-xs font-bold mb-1">YOU ({playerRole})</p>
                                <div className={`w-24 h-24 border-4 border-black flex items-center justify-center text-6xl ${playerRole === 'BAT' ? 'bg-neo-green' : 'bg-neo-cyan'}`}>
                                    {lastPlayerMove}
                                </div>
                            </div>
                            <div className="text-center">
                                <p className="text-xs font-bold mb-1">AI ({playerRole === 'BAT' ? 'BOWL' : 'BAT'})</p>
                                <div className={`w-24 h-24 border-4 border-black flex items-center justify-center text-6xl ${playerRole === 'BAT' ? 'bg-neo-cyan' : 'bg-neo-green'}`}>
                                    {lastAiMove}
                                </div>
                            </div>
                        </div>

                        {/* Controls */}
                        <div className="grid grid-cols-3 gap-2 md:gap-4">
                            {[1, 2, 3, 4, 5, 6].map((num) => (
                                <button
                                    key={num}
                                    onClick={() => handleBall(num)}
                                    className="bg-white border-4 border-black text-3xl font-heading py-4 hover:bg-black hover:text-white transition-all shadow-[4px_4px_0px_#000] active:translate-y-1 active:shadow-none"
                                >
                                    {num}
                                </button>
                            ))}
                        </div>

                        {/* Ball History */}
                        <div className="flex gap-2 justify-center mt-6 h-8">
                            {ballHistory.map((b, i) => (
                                <div key={i} className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border border-black ${b.p === b.ai ? 'bg-red-500 text-white' : 'bg-gray-200'}`}>
                                    {playerRole === 'BAT' ? b.p : b.ai}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {gameState === 'RESULT' && (
                    <div className="text-center animate-in zoom-in duration-300">
                        {gameResult === 'WIN' ? (
                            <div className="bg-neo-green p-8 border-4 border-black mb-6">
                                <Trophy size={64} className="mx-auto mb-4" />
                                <h2 className="text-6xl font-heading mb-2">YOU WON!</h2>
                                <p className="font-bold text-xl">+35 STONKS ADDED</p>
                            </div>
                        ) : (
                            <div className="bg-red-500 text-white p-8 border-4 border-black mb-6">
                                <Skull size={64} className="mx-auto mb-4" />
                                <h2 className="text-6xl font-heading mb-2">YOU LOST</h2>
                                <p className="font-bold text-xl">BETTER LUCK NEXT TIME</p>
                            </div>
                        )}
                        <button onClick={resetMatch} className="w-full bg-white text-black text-2xl font-heading py-4 border-4 border-black mb-4 shadow-neo hover:translate-y-1 hover:shadow-none flex items-center justify-center gap-2">
                            <RefreshCw /> REMATCH (SAME PLAYER)
                        </button>
                        <button onClick={resetGame} className="w-full bg-black text-white text-xl font-heading py-4 border-4 border-black hover:bg-gray-800">
                            NEW PLAYER
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
