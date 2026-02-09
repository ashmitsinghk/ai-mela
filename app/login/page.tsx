'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { supabase } from '@/utils/supabase';
import { useToast } from '@/contexts/ToastContext';

export default function LoginPage() {
    const [uid, setUid] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const { showToast } = useToast();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!uid.trim()) return;

        setLoading(true);
        const userId = uid.trim().toUpperCase();

        try {
            // Check if user exists
            const { data: existingUser, error: fetchError } = await supabase
                .from('players')
                .select('*')
                .eq('uid', userId)
                .single();

            if (fetchError && fetchError.code !== 'PGRST116') {
                throw fetchError;
            }

            if (!existingUser) {
                // User not found - Show error instead of creating
                throw new Error('ID NOT RECOGNIZED. ACCESS DENIED.');
            }

            // Save session
            localStorage.setItem('user_uid', userId);
            router.push('/');
        } catch (error: any) {
            console.error('Login error:', error);
            showToast(`${error.message || 'Login Failed'}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="min-h-screen bg-neo-yellow text-black flex flex-col">
            <Navbar />
            <div className="flex-1 flex items-center justify-center p-4">
                <div className="w-full max-w-md bg-white border-4 border-black p-8 shadow-[8px_8px_0px_#000]">
                    <h1 className="text-4xl font-heading mb-6 text-center uppercase">Identity Check</h1>
                    <form onSubmit={handleLogin} className="space-y-6">
                        <div>
                            <label className="block font-mono font-bold mb-2">ENTER UID</label>
                            <input
                                type="text"
                                value={uid}
                                onChange={(e) => setUid(e.target.value)}
                                placeholder="23BAI..."
                                className="w-full bg-[#F0F0F0] border-2 border-black p-4 font-mono text-xl focus:outline-none focus:ring-4 focus:ring-neo-pink transition-all placeholder:text-gray-400"
                                disabled={loading}
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-black text-white font-heading text-2xl py-4 border-2 border-transparent hover:bg-neo-pink hover:text-white hover:border-black transition-all shadow-[4px_4px_0px_#000] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none disabled:opacity-50"
                        >
                            {loading ? 'CONNECTING...' : 'JACK IN'}
                        </button>
                    </form>
                    <div className="mt-6 text-center font-mono text-xs text-gray-500">
                        SYSTEM VERSION 2.0.5 <br /> SECURE LOGIN ONLY
                    </div>
                </div>
            </div>
        </main>
    );
}
