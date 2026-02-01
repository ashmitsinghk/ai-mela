'use client';

import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';

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

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (uid.trim()) onVerify(uid.trim());
    };

    // Helper to map abstract theme names to tailwind classes if needed
    // specific tailwind classes might need 'text-' prefix or 'bg-' prefix depending on context
    // ensuring themeColor is a safe class string

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

                <p className="mb-6 text-center font-bold text-lg text-black">Enter your Player ID to start</p>

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
