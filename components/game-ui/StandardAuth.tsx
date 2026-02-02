'use client';

import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/utils/supabase';

interface StandardAuthProps {
    onVerify: (uid: string) => void;
    loading: boolean;
    themeColor?: string; // e.g. 'green-400', 'neo-pink'
    title: React.ReactNode;
    bgImage?: string;
    bgColor?: string; // fallback bg color
    backgroundElement?: React.ReactNode; // For custom gradients/components
}

export default function StandardAuth({
    onVerify,
    loading,
    themeColor = 'neo-green', // Default theme
    title,
    bgImage,
    bgColor = 'bg-gray-900',
    backgroundElement,
}: StandardAuthProps) {
    const [uid, setUid] = useState('');
    const [sessionId, setSessionId] = useState<string>('');

    // Generate unique session for QR login
    React.useEffect(() => {
        const newSessionId = `GAME-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
        setSessionId(newSessionId);

        const channel = supabase.channel(newSessionId)
            .on('broadcast', { event: 'LOGIN_REQUEST' }, (payload) => {
                console.log('Received magic login:', payload);
                if (payload.payload?.uid) {
                    const receivedUid = payload.payload.uid;
                    setUid(receivedUid);
                    onVerify(receivedUid);
                }
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log(`Listening for magic login on ${newSessionId}`);
                }
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, []); // Only run on mount

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (uid.trim()) onVerify(uid.trim());
    };

    return (
        <div
            className={`h-screen overflow-auto ${bgColor} font-mono p-4 md:p-8 flex items-center justify-center`}
            style={bgImage ? {
                backgroundImage: `url('${bgImage}')`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat'
            } : {}}
        >
            {backgroundElement && (
                <div className="absolute inset-0 -z-0">
                    {backgroundElement}
                </div>
            )}
            <div className={`max-w-md w-full bg-white border-4 border-black shadow-[8px_8px_0px_#000] p-8 relative z-10`}>
                <div className="text-center mb-6">
                    {title}
                </div>

                <p className="mb-6 text-center font-bold text-lg text-black">
                    Enter Player ID or Scan Code with Leaderboard App
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <input
                        type="text"
                        value={uid}
                        onChange={(e) => setUid(e.target.value)}
                        required
                        className={`w-full text-4xl font-heading p-4 border-4 border-black text-center text-black focus:outline-none focus:ring-4 focus:ring-${themeColor}`}
                        placeholder="23BAI..."
                        autoFocus
                    />

                    {/* Show Session QR if no UID entered yet, or Entered UID QR if present */}
                    {(uid || sessionId) && (
                        <div className="flex flex-col items-center justify-center my-4 p-4 bg-white border-4 border-black w-fit mx-auto">
                            <QRCodeSVG
                                value={uid ? uid : sessionId}
                                size={128}
                                level="H"
                                includeMargin={false}
                            />
                            <p className="mt-2 text-xs font-bold text-gray-500 uppercase">
                                {uid ? 'YOUR ID' : 'SCAN TO LOGIN'}
                            </p>
                        </div>
                    )}

                    <button
                        disabled={loading}
                        className={`w-full bg-black text-white text-2xl font-heading py-4 hover:opacity-80 transition-opacity disabled:opacity-50`}
                    >
                        {loading ? <Loader2 className="animate-spin mx-auto" /> : 'VERIFY PLAYER'}
                    </button>
                </form>
            </div>
        </div>
    );
}
