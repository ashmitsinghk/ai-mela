'use client';

import Navbar from '@/components/Navbar';
import { Trophy, Medal } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabase';

interface Player {
    uid: string;
    stonks: number;
    name?: string; // Optional if we haven't implemented names yet
    rank?: number;
}

const LeaderboardPage = () => {
    const [players, setPlayers] = useState<Player[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchLeaderboard = async () => {
        try {
            const { data, error } = await supabase
                .from('players')
                .select('uid, stonks, name')
                .order('stonks', { ascending: false })
                .limit(50);

            if (error) {
                console.error('Error fetching leaderboard:', error);
                return;
            }

            if (data) {
                const rankedData = data.map((p, index) => ({
                    ...p,
                    rank: index + 1,
                    // Fallback name if missing
                    name: p.name || `Player ${p.uid}`
                }));
                setPlayers(rankedData);
            }
        } catch (err) {
            console.error('Unexpected error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLeaderboard();

        // Subscribe to changes in players table to auto-update leaderboard
        const channel = supabase
            .channel('realtime_leaderboard')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'players',
                },
                () => {
                    // Re-fetch leaderboard on any stonk change
                    fetchLeaderboard();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const topThree = players.slice(0, 3);
    const rest = players.slice(3);

    return (
        <main className="min-h-screen bg-[#F0F0F0] text-black pb-20">
            <Navbar />
            <div className="pt-24 max-w-4xl mx-auto px-4">

                <div className="text-center mb-12">
                    <h1 className="text-6xl md:text-8xl font-heading uppercase tracking-tighter text-shadow-neo mb-4">
                        LEADER<span className="text-neo-pink">BOARD</span>
                    </h1>
                    <p className="font-mono text-xl bg-black text-white inline-block px-4 py-1 border-2 border-neo-pink shadow-neo">
                        LIVE RANKINGS • REALTIME UPDATES
                    </p>
                </div>

                {/* Top 3 Podium */}
                {topThree.length > 0 && (
                    <div className="flex flex-col md:flex-row justify-center items-end gap-4 mb-16 px-4">
                        {/* 2nd Place */}
                        {topThree[1] && (
                            <div className="order-2 md:order-1 flex-1 bg-white border-4 border-black p-4 flex flex-col items-center shadow-neo relative h-64 justify-end">
                                <div className="absolute top-0 -mt-6 bg-gray-300 border-4 border-black p-2 rounded-full w-12 h-12 flex items-center justify-center font-bold text-xl">2</div>
                                <Medal size={48} className="text-gray-400 mb-2" />
                                <h3 className="font-heading text-xl text-center leading-tight mb-1 break-words w-full">{topThree[1].name}</h3>
                                <p className="font-mono text-xs text-gray-500 mb-2 break-all">{topThree[1].uid}</p>
                                <div className="bg-neo-black text-neo-green font-mono font-bold px-3 py-1 text-lg w-full text-center">
                                    {topThree[1].stonks}
                                </div>
                            </div>
                        )}

                        {/* 1st Place */}
                        {topThree[0] && (
                            <div className="order-1 md:order-2 flex-1 bg-neo-yellow border-4 border-black p-4 flex flex-col items-center shadow-neo-lg relative h-80 justify-end z-10 transform md:-translate-y-4">
                                <div className="absolute -top-10">
                                    <Trophy size={80} className="text-black drop-shadow-md pb-2" />
                                </div>
                                <div className="absolute top-0 -mt-6 bg-neo-pink border-4 border-black p-2 rounded-full w-16 h-16 flex items-center justify-center font-bold text-3xl text-white">1</div>
                                <h3 className="font-heading text-2xl text-center leading-tight mb-1 mt-8 break-words w-full">{topThree[0].name}</h3>
                                <p className="font-mono text-xs text-black/70 mb-4 font-bold break-all">{topThree[0].uid}</p>
                                <div className="bg-black text-neo-yellow font-mono font-bold px-3 py-2 text-2xl w-full text-center border-2 border-white">
                                    {topThree[0].stonks} 💎
                                </div>
                            </div>
                        )}

                        {/* 3rd Place */}
                        {topThree[2] && (
                            <div className="order-3 flex-1 bg-white border-4 border-black p-4 flex flex-col items-center shadow-neo relative h-56 justify-end">
                                <div className="absolute top-0 -mt-6 bg-orange-400 border-4 border-black p-2 rounded-full w-12 h-12 flex items-center justify-center font-bold text-xl">3</div>
                                <Medal size={48} className="text-orange-500 mb-2" />
                                <h3 className="font-heading text-xl text-center leading-tight mb-1 break-words w-full">{topThree[2].name}</h3>
                                <p className="font-mono text-xs text-gray-500 mb-2 break-all">{topThree[2].uid}</p>
                                <div className="bg-neo-black text-neo-green font-mono font-bold px-3 py-1 text-lg w-full text-center">
                                    {topThree[2].stonks}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* List */}
                <div className="space-y-4">
                    {rest.map((player) => (
                        <div key={player.uid} className="bg-white border-4 border-black p-4 flex items-center justify-between shadow-[4px_4px_0px_#000] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all">
                            <div className="flex items-center gap-4 flex-1 min-w-0">
                                <span className="font-heading text-3xl w-12 text-center text-gray-400 flex-shrink-0">#{player.rank}</span>
                                <div className="min-w-0 flex-1">
                                    <h4 className="font-bold font-heading text-lg uppercase break-words">{player.name}</h4>
                                    <span className="font-mono text-xs text-gray-500 break-all">{player.uid}</span>
                                </div>
                            </div>
                            <div className="font-mono font-bold text-neo-pink text-xl">
                                {player.stonks}
                            </div>
                        </div>
                    ))}
                    {loading && (
                        <div className="text-center font-mono py-10">LOADING CHAMPIONS...</div>
                    )}
                    {!loading && players.length === 0 && (
                        <div className="text-center font-mono py-10 opacity-50">NO ACTIVE PLAYERS YET. BE THE FIRST!</div>
                    )}
                </div>

            </div>
        </main>
    );
};

export default LeaderboardPage;
