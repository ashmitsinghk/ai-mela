'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import { QrCode, TrendingUp, History, Gamepad2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';

interface GameLog {
    id: string;
    game_title: string;
    result: string;
    stonks_change: number;
    played_at: string;
}

export default function PortalPage() {
    const [uid, setUid] = useState<string | null>(null);
    const [stonks, setStonks] = useState(200);
    const [logs, setLogs] = useState<GameLog[]>([]);
    const router = useRouter();

    useEffect(() => {
        // Client-side only check
        if (typeof window !== 'undefined') {
            const user = localStorage.getItem('user_uid');
            if (!user) {
                router.push('/login');
                return;
            }
            setUid(user);
            fetchPlayerData(user);

            // Realtime subscription
            const channel = supabase
                .channel('realtime_player_updates')
                .on(
                    'postgres_changes',
                    {
                        event: 'UPDATE',
                        schema: 'public',
                        table: 'players',
                        filter: `uid=eq.${user}`,
                    },
                    (payload: any) => {
                        const newStonks = payload.new.stonks;
                        if (newStonks !== undefined) setStonks(newStonks);
                    }
                )
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'game_logs',
                        filter: `player_uid=eq.${user}`,
                    },
                    (payload: any) => {
                        setLogs((prev) => [payload.new, ...prev]);
                    }
                )
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };
        }
    }, [router]);

    const fetchPlayerData = async (userId: string) => {
        // Fetch Stonks
        const { data: userData } = await supabase
            .from('players')
            .select('stonks')
            .eq('uid', userId)
            .single();

        if (userData) setStonks(userData.stonks);

        // Fetch Logs
        const { data: logData } = await supabase
            .from('game_logs')
            .select('*')
            .eq('player_uid', userId)
            .order('played_at', { ascending: false })
            .limit(10);

        if (logData) setLogs(logData);
    };

    if (!uid) {
        return <div className="min-h-screen bg-white flex items-center justify-center font-mono text-2xl animate-pulse">LOADING PROFILE...</div>;
    }

    return (
        <main className="min-h-screen bg-[#F0F0F0] text-black pb-20">
            <Navbar />
            <div className="max-w-md mx-auto pt-8 px-4">

                {/* Profile Card */}
                <div className="bg-white border-4 border-black p-6 mb-8 shadow-neo-lg relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 bg-black text-white font-mono text-xs font-bold">
                        PLAYER PANEL
                    </div>
                    <h1 className="text-4xl font-heading mb-1">{uid}</h1>
                    <p className="font-mono text-gray-500 text-sm mb-6">Cyber-Citizen ID Verified</p>

                    <div className="bg-black text-neo-green p-4 border-2 border-neo-green flex items-center justify-between shadow-[4px_4px_0px_#00FF66]">
                        <div>
                            <span className="block text-xs text-white/70 font-mono">AVAILABLE STONKS</span>
                            <span className="font-heading text-6xl tracking-tighter">{stonks}</span>
                        </div>
                        <TrendingUp size={48} />
                    </div>
                </div>

                {/* Actions */}
                <div className="grid grid-cols-2 gap-4 mb-8">
                    <button onClick={() => alert('Feature coming soon! Use the web portal for now.')} className="bg-neo-pink text-white p-6 border-4 border-black shadow-neo flex flex-col items-center justify-center gap-2 hover:translate-y-1 hover:shadow-none transition-all group">
                        <QrCode size={32} className="group-hover:scale-110 transition-transform" />
                        <span className="font-heading text-xl uppercase">SCAN QR</span>
                    </button>
                    <button onClick={() => router.push('/games')} className="bg-neo-cyan text-black p-6 border-4 border-black shadow-neo flex flex-col items-center justify-center gap-2 hover:translate-y-1 hover:shadow-none transition-all group">
                        <Gamepad2 size={32} className="group-hover:scale-110 transition-transform" />
                        <span className="font-heading text-xl uppercase">GAMES</span>
                    </button>
                </div>

                {/* Recent Activity */}
                <div className="bg-white border-4 border-black p-6 shadow-neo">
                    <h2 className="font-heading text-2xl mb-4 flex items-center gap-2">
                        <History /> RECENT LOGS
                    </h2>
                    <div className="space-y-3 font-mono text-sm max-h-60 overflow-y-auto">
                        {logs.length === 0 ? (
                            <p className="text-gray-500 italic">No games played yet. Go play some AI games!</p>
                        ) : (
                            logs.map((log) => (
                                <div key={log.id} className="flex justify-between items-center border-b-2 border-gray-100 pb-2 last:border-0 last:pb-0">
                                    <div>
                                        <span className="font-bold block">{log.game_title}</span>
                                        <span className="text-gray-500 text-xs">{new Date(log.played_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    <div className={`font-bold text-lg ${log.result === 'WIN' ? 'text-green-600' : 'text-red-600'}`}>
                                        {log.stonks_change > 0 ? '+' : ''}{log.stonks_change}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="mt-8 text-center">
                    <button
                        onClick={() => {
                            localStorage.removeItem('user_uid');
                            router.push('/login');
                        }}
                        className="text-gray-500 font-mono text-sm underline hover:text-red-500"
                    >
                        Disconnect System (Logout)
                    </button>
                </div>

            </div>
        </main>
    );
}
