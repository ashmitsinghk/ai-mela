'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { supabase } from '@/utils/supabase';
import { Shield, UserPlus, Lock } from 'lucide-react';

export default function AdminPage() {
    const [password, setPassword] = useState('');
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [newUid, setNewUid] = useState('');
    const [newName, setNewName] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (password === 'legoashmit') {
            setIsAuthenticated(true);
            setMessage(null);
        } else {
            setMessage({ text: 'Access Denied: Invalid Password', type: 'error' });
        }
    };

    const handleAddPlayer = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newUid.trim()) return;

        setLoading(true);
        setMessage(null);

        const uid = newUid.trim().toUpperCase();
        const name = newName.trim() || `Player ${uid}`; // Default name if empty

        try {
            // Check if user already exists
            const { data: existingUser } = await supabase
                .from('players')
                .select('*')
                .eq('uid', uid)
                .single();

            if (existingUser) {
                throw new Error('Player already exists!');
            }

            // Create new user
            const { error: insertError } = await supabase
                .from('players')
                .insert([{ uid, name, stonks: 200 }]);

            if (insertError) throw insertError;

            setMessage({ text: `Player ${uid} added successfully!`, type: 'success' });
            setNewUid('');
            setNewName('');
        } catch (error: any) {
            console.error('Error adding player:', error);
            setMessage({ text: error.message || 'Failed to add player', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    if (!isAuthenticated) {
        return (
            <main className="min-h-screen bg-black text-white flex flex-col font-mono">
                <Navbar />
                <div className="flex-1 flex items-center justify-center p-4">
                    <div className="w-full max-w-md bg-gray-900 border-4 border-white p-8">
                        <div className="flex justify-center mb-6">
                            <Lock size={64} className="text-red-500" />
                        </div>
                        <h1 className="text-3xl font-heading mb-6 text-center uppercase text-red-500">Restricted Access</h1>
                        <form onSubmit={handleLogin} className="space-y-6">
                            <div>
                                <label className="block font-bold mb-2 uppercase">Password</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-black border-2 border-white p-4 text-xl focus:outline-none focus:border-red-500 transition-all text-white"
                                    autoFocus
                                />
                            </div>
                            {message && (
                                <div className={`p-4 text-center font-bold ${message.type === 'error' ? 'bg-red-900 text-red-200' : 'bg-green-900 text-green-200'}`}>
                                    {message.text}
                                </div>
                            )}
                            <button
                                type="submit"
                                className="w-full bg-white text-black font-heading text-2xl py-4 border-2 border-transparent hover:bg-red-500 hover:text-white hover:border-white transition-all"
                            >
                                AUTHENTICATE
                            </button>
                        </form>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-[#F0F0F0] text-black flex flex-col font-mono">
            <Navbar />
            <div className="max-w-4xl mx-auto w-full pt-20 px-4">

                <div className="bg-white border-4 border-black p-8 shadow-[8px_8px_0px_#000] mb-8">
                    <div className="flex items-center gap-4 mb-6 pb-6 border-b-4 border-black">
                        <Shield size={48} className="text-black" />
                        <div>
                            <h1 className="font-heading text-4xl uppercase">Admin Console</h1>
                            <p className="text-gray-600">User Management System</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Add Player Form */}
                        <div>
                            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                                <UserPlus className="text-neo-green" /> Add New Player
                            </h2>
                            <form onSubmit={handleAddPlayer} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold mb-1 uppercase text-gray-500">UID</label>
                                    <input
                                        type="text"
                                        value={newUid}
                                        onChange={(e) => setNewUid(e.target.value)}
                                        placeholder="23BAI..."
                                        className="w-full bg-gray-100 border-2 border-black p-3 font-mono focus:outline-none focus:ring-2 focus:ring-neo-green"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold mb-1 uppercase text-gray-500">Name (Optional)</label>
                                    <input
                                        type="text"
                                        value={newName}
                                        onChange={(e) => setNewName(e.target.value)}
                                        placeholder="John Doe"
                                        className="w-full bg-gray-100 border-2 border-black p-3 font-mono focus:outline-none focus:ring-2 focus:ring-neo-green"
                                    />
                                </div>

                                {message && (
                                    <div className={`p-4 border-2 border-black font-bold text-sm ${message.type === 'error' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                                        {message.text}
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full bg-black text-white py-3 font-bold text-lg hover:bg-neo-green hover:text-black border-2 border-black transition-all disabled:opacity-50"
                                >
                                    {loading ? 'ADDING...' : 'ADD PLAYER'}
                                </button>
                            </form>
                        </div>

                        {/* Stats or Info */}
                        <div className="bg-gray-100 p-6 border-2 border-black">
                            <h3 className="font-bold mb-4 uppercase text-gray-500">System Status</h3>
                            <ul className="space-y-2 text-sm">
                                <li className="flex justify-between">
                                    <span>Connection:</span>
                                    <span className="text-green-600 font-bold">ONLINE</span>
                                </li>
                                <li className="flex justify-between">
                                    <span>Database:</span>
                                    <span className="text-green-600 font-bold">CONNECTED</span>
                                </li>
                                <li className="flex justify-between">
                                    <span>Admin Mode:</span>
                                    <span className="text-red-600 font-bold">ACTIVE</span>
                                </li>
                            </ul>
                            <div className="mt-8 pt-6 border-t-2 border-gray-300 text-xs text-gray-500">
                                <p>Use this panel to manually register players who haven't been automatically added or need restoration.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
