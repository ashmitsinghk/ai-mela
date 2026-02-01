'use client';

import React from 'react';

interface StandardBetProps {
    playerData: { name: string | null; stonks: number };
    entryFee: number;
    onPlay: () => void;
    onCancel: () => void;
    loading: boolean;
    themeColor?: string;
    title: React.ReactNode;
    instructions?: React.ReactNode; // Optional game-specific instructions/briefing
    bgImage?: string;
    bgColor?: string;
    backgroundElement?: React.ReactNode;
}

export default function StandardBet({
    playerData,
    entryFee,
    onPlay,
    onCancel,
    loading,
    themeColor = 'neo-green',
    title,
    instructions,
    bgImage,
    bgColor = 'bg-gray-900',
    backgroundElement,
}: StandardBetProps) {

    const hasFunds = playerData.stonks >= entryFee;

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
            <div className="max-w-md w-full bg-white border-4 border-black shadow-[8px_8px_0px_#000] p-8 relative z-10">
                <div className="text-center mb-6">
                    {title}
                </div>

                <div className="text-center">
                    <h2 className="text-2xl font-bold mb-2 text-black">PLAYER: {playerData.name || 'Unknown'}</h2>
                    <div className="text-4xl font-heading mb-6 text-black">BALANCE: {playerData.stonks} 💎</div>

                    {instructions && (
                        <div className="border-4 border-black p-4 mb-6 bg-gray-50 text-left">
                            {instructions}
                        </div>
                    )}

                    {hasFunds ? (
                        <button
                            onClick={onPlay}
                            disabled={loading}
                            className={`w-full bg-black text-white text-2xl font-heading py-6 border-4 border-black shadow-[8px_8px_0px_#000] hover:translate-y-1 hover:shadow-none transition-all disabled:opacity-50`}
                        >
                            {loading ? 'PROCESSING...' : `PAY ${entryFee} & START`}
                        </button>
                    ) : (
                        <div className="bg-red-500 text-white p-4 font-bold text-xl border-4 border-black">
                            INSUFFICIENT FUNDS
                        </div>
                    )}

                    <button onClick={onCancel} className="mt-4 underline hover:text-black/70 text-black">
                        Cancel / Change Player
                    </button>
                </div>
            </div>
        </div>
    );
}
