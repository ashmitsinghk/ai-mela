'use client';

import { useState } from 'react';
import Navbar from '@/components/Navbar';
import { supabase } from '@/utils/supabase';
import { Shield, UserPlus, Lock, Trash2, RefreshCw, Search } from 'lucide-react';

export default function AdminPage() {
    const [password, setPassword] = useState('');
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [newUid, setNewUid] = useState('');
    const [newName, setNewName] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

    // New State for User Management
    const [users, setUsers] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('players')
                .select('*')
                .order('stonks', { ascending: false });

            if (error) throw error;
            setUsers(data || []);
        } catch (error: any) {
            console.error('Error fetching users:', error);
            setMessage({ text: 'Failed to fetch users', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (password === 'legoashmit') {
            setIsAuthenticated(true);
            setMessage(null);
            setTimeout(fetchUsers, 100);
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
        const name = newName.trim() || `Player ${uid}`;

        try {
            const { data: existingUser } = await supabase
                .from('players')
                .select('*')
                .eq('uid', uid)
                .single();

            if (existingUser) {
                throw new Error('Player already exists!');
            }

            const { error: insertError } = await supabase
                .from('players')
                .insert([{ uid, name, stonks: 200 }]);

            if (insertError) throw insertError;

            setMessage({ text: `Player ${uid} added successfully!`, type: 'success' });
            setNewUid('');
            setNewName('');
            fetchUsers();
        } catch (error: any) {
            setMessage({ text: error.message || 'Failed to add player', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteUser = async (uid: string) => {
        if (!confirm(`Are you sure you want to delete player ${uid}? This cannot be undone.`)) return;

        setLoading(true);
        try {
            const { error } = await supabase.from('players').delete().eq('uid', uid);
            if (error) throw error;

            setMessage({ text: `Player ${uid} deleted.`, type: 'success' });
            fetchUsers();
        } catch (error: any) {
            setMessage({ text: error.message || 'Failed to delete player', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateStonks = async (uid: string, currentStonks: number, change: number) => {
        const newAmount = currentStonks + change;
        try {
            const { error } = await supabase
                .from('players')
                .update({ stonks: newAmount })
                .eq('uid', uid);

            if (error) throw error;

            // Optimistic update
            setUsers(users.map(u => u.uid === uid ? { ...u, stonks: newAmount } : u));
        } catch (error: any) {
            setMessage({ text: 'Failed to update stonks', type: 'error' });
        }
    };

    const handleResetAllStonks = async () => {
        const confirmReset = prompt('Type "RESET" to confirm resetting ALL players to 200 Stonks.');
        if (confirmReset !== 'RESET') return;

        setLoading(true);
        try {
            // We can iterate if global update is blocked, but let's try a broad update first.
            // Supabase RLS policies might require a specific logic, but assuming admin has rights or RLS allows this for now.
            // Since we don't have a backend admin role, this relies on the client key having permission or RLS being open/permissive enough.

            const { error } = await supabase
                .from('players')
                .update({ stonks: 200 })
                .gt('stonks', -1); // Simple condition to match all rows

            if (error) throw error;

            setMessage({ text: 'All players reset to 200 Stonks.', type: 'success' });
            fetchUsers();
        } catch (error: any) {
            setMessage({ text: error.message || 'Failed to reset all', type: 'error' });
            // Fallback: Client-side iteration (slower but works if mass update is blocked)
            // Not implemented here to avoid complexity unless requested.
        } finally {
            setLoading(false);
        }
    };

    const filteredUsers = users.filter(u =>
        u.uid.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.name && u.name.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    if (!isAuthenticated) {
        return (
            <main className="min-h-screen bg-black text-white flex flex-col font-mono">
                <Navbar />
                <div className="flex-1 flex items-center justify-center p-4">
                    <div className="w-full max-w-md bg-gray-900 border-4 border-white p-8 animate-in zoom-in duration-300">
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
                                    className="w-full bg-black border-2 border-white p-4 text-xl focus:outline-none focus:border-red-500 transition-all text-white placeholder-gray-600"
                                    placeholder="Enter Access Code"
                                    autoFocus
                                />
                            </div>
                            {message && (
                                <div className={`p-4 text-center font-bold border-2 ${message.type === 'error' ? 'bg-red-900 border-red-500 text-red-200' : 'bg-green-900 border-green-500 text-green-200'}`}>
                                    {message.text}
                                </div>
                            )}
                            <button
                                type="submit"
                                className="w-full bg-white text-black font-heading text-2xl py-4 border-2 border-transparent hover:bg-red-500 hover:text-white hover:border-white transition-all uppercase"
                            >
                                Unlock System
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
            <div className="max-w-7xl mx-auto w-full pt-24 px-4 pb-20">

                {/* Header Section */}
                <div className="bg-white border-4 border-black p-6 md:p-8 shadow-[8px_8px_0px_#000] mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div className="flex items-center gap-4">
                        <div className="bg-black p-3 text-white">
                            <Shield size={40} />
                        </div>
                        <div>
                            <h1 className="font-heading text-3xl md:text-4xl uppercase">Admin Console</h1>
                            <div className="flex items-center gap-2 text-sm text-gray-600 font-bold">
                                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                SYSTEM ONLINE
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                        <button
                            onClick={fetchUsers}
                            className="px-6 py-3 font-bold border-2 border-black hover:bg-gray-100 flex items-center justify-center gap-2 transition-all"
                        >
                            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                            REFRESH
                        </button>
                        <button
                            onClick={handleResetAllStonks}
                            className="bg-red-600 text-white px-6 py-3 font-bold border-2 border-black shadow-[4px_4px_0px_#000] hover:translate-y-1 hover:shadow-none hover:bg-red-700 transition-all uppercase flex items-center justify-center gap-2"
                        >
                            <Trash2 size={18} />
                            Reset ALL Stonks
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* LEFT COLUMN: Add Player Form */}
                    <div className="lg:col-span-1">
                        <div className="bg-white border-4 border-black p-6 sticky top-24 shadow-[4px_4px_0px_#000]">
                            <h2 className="text-xl font-heading mb-6 flex items-center gap-2 uppercase border-b-4 border-black pb-2">
                                <UserPlus size={24} /> New Entry
                            </h2>

                            <form onSubmit={handleAddPlayer} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold mb-1 uppercase text-gray-500">Player UID</label>
                                    <input
                                        type="text"
                                        value={newUid}
                                        onChange={(e) => setNewUid(e.target.value)}
                                        placeholder="e.g. 23BAI1234"
                                        className="w-full bg-gray-100 border-2 border-black p-3 font-mono focus:outline-none focus:ring-4 focus:ring-neo-green focus:bg-white transition-all uppercase"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold mb-1 uppercase text-gray-500">Display Name</label>
                                    <input
                                        type="text"
                                        value={newName}
                                        onChange={(e) => setNewName(e.target.value)}
                                        placeholder="e.g. John Doe"
                                        className="w-full bg-gray-100 border-2 border-black p-3 font-mono focus:outline-none focus:ring-4 focus:ring-neo-green focus:bg-white transition-all"
                                    />
                                </div>

                                {message && (
                                    <div className={`p-3 border-2 border-black font-bold text-xs ${message.type === 'error' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                                        {message.text}
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full bg-black text-white py-4 font-heading text-xl border-2 border-black hover:bg-neo-green hover:text-black transition-all disabled:opacity-50 hover:shadow-[4px_4px_0px_#000] hover:-translate-y-1 active:translate-y-0 active:shadow-none"
                                >
                                    {loading ? 'PROCESSING...' : 'ADD PLAYER'}
                                </button>
                            </form>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Player List */}
                    <div className="lg:col-span-2">
                        <div className="bg-white border-4 border-black flex flex-col h-full shadow-[4px_4px_0px_#000]">

                            {/* Toolbar */}
                            <div className="p-4 border-b-4 border-black bg-gray-50 flex items-center gap-3">
                                <Search className="text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search database..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="bg-transparent w-full font-mono focus:outline-none text-lg"
                                />
                                <div className="text-xs font-bold bg-black text-white px-2 py-1 rounded">
                                    {filteredUsers.length}
                                </div>
                            </div>

                            {/* Table Container */}
                            <div className="flex-1 overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-black text-white text-sm uppercase font-heading">
                                        <tr>
                                            <th className="p-4 border-r border-gray-800 sticky top-0">UID</th>
                                            <th className="p-4 border-r border-gray-800 sticky top-0">Name</th>
                                            <th className="p-4 border-r border-gray-800 text-center sticky top-0">Stonks</th>
                                            <th className="p-4 text-right sticky top-0">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="font-mono">
                                        {filteredUsers.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} className="p-12 text-center text-gray-500 italic">
                                                    {loading ? 'Syncing with mainframe...' : 'No subjects found.'}
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredUsers.map((user, idx) => (
                                                <tr key={user.uid} className={`border-b border-black hover:bg-blue-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                                                    <td className="p-4 font-bold border-r border-black">{user.uid}</td>
                                                    <td className="p-4 border-r border-black">{user.name || '-'}</td>

                                                    {/* Stonks Controls */}
                                                    <td className="p-4 border-r border-black">
                                                        <div className="flex items-center justify-center gap-3">
                                                            <button
                                                                onClick={() => handleUpdateStonks(user.uid, user.stonks || 0, -50)}
                                                                className="w-8 h-8 flex items-center justify-center bg-red-100 text-red-600 font-bold border-2 border-red-200 hover:border-red-600 hover:bg-red-600 hover:text-white rounded transition-all"
                                                            >
                                                                -
                                                            </button>
                                                            <span className={`w-16 text-center font-bold text-lg ${user.stonks > 200 ? 'text-green-600' : 'text-black'}`}>
                                                                {user.stonks}
                                                            </span>
                                                            <button
                                                                onClick={() => handleUpdateStonks(user.uid, user.stonks || 0, 50)}
                                                                className="w-8 h-8 flex items-center justify-center bg-green-100 text-green-600 font-bold border-2 border-green-200 hover:border-green-600 hover:bg-green-600 hover:text-white rounded transition-all"
                                                            >
                                                                +
                                                            </button>
                                                        </div>
                                                    </td>

                                                    {/* Actions */}
                                                    <td className="p-4 text-right">
                                                        <button
                                                            onClick={() => handleDeleteUser(user.uid)}
                                                            className="text-gray-400 hover:text-red-600 transition-colors p-2"
                                                            title="Delete User"
                                                        >
                                                            <Trash2 size={20} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </main>
    );
}
