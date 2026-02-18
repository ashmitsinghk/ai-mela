
"use client";

import { useState, useEffect } from "react";
import { useApiKeys } from "@/contexts/ApiKeyContext";
import { Key, X, Check, AlertTriangle } from "lucide-react";

interface ApiKeyModalProps {
    isOpen: boolean;
    onClose: () => void;
    forceOpen?: boolean; // If true, cannot be closed without keys (unless "Continue without keys" is used)
}

export default function ApiKeyModal({ isOpen, onClose, forceOpen = false }: ApiKeyModalProps) {
    const { groqKey, geminiKey, saveKeys, clearKeys } = useApiKeys();
    const [localGroq, setLocalGroq] = useState("");
    const [localGemini, setLocalGemini] = useState("");
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setLocalGroq(groqKey);
            setLocalGemini(geminiKey);
            setIsVisible(true);
        } else {
            setIsVisible(false);
        }
    }, [isOpen, groqKey, geminiKey]);

    const handleSave = () => {
        saveKeys(localGroq, localGemini);
        onClose();
    };

    const handleClear = () => {
        clearKeys();
        setLocalGroq("");
        setLocalGemini("");
    };

    const handleSkip = () => {
        onClose();
    };

    if (!isOpen && !isVisible) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-w-md w-full p-6 relative">
                {!forceOpen && (
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 hover:bg-gray-100 border-2 border-transparent hover:border-black transition-all"
                    >
                        <X size={24} />
                    </button>
                )}

                <div className="flex items-center gap-3 mb-6">
                    <div className="bg-yellow-400 p-3 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                        <Key size={32} className="text-black" />
                    </div>
                    <h2 className="text-2xl font-black uppercase transform -skew-x-6">API Keys</h2>
                </div>

                <p className="mb-6 text-sm font-bold text-gray-600">
                    Enter your API keys to play AI-powered games. Keys are stored locally in your browser.
                </p>

                <div className="space-y-4 mb-8">
                    <div>
                        <label className="block text-xs font-black uppercase mb-1 flex justify-between">
                            <span>Groq API Key</span>
                            {localGroq && <span className="text-green-600 flex items-center gap-1"><Check size={12} /> SET</span>}
                        </label>
                        <input
                            type="password"
                            value={localGroq}
                            onChange={(e) => setLocalGroq(e.target.value)}
                            placeholder="gsk_..."
                            className="w-full p-3 border-4 border-black font-mono text-sm focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all"
                        />
                        <p className="text-[10px] mt-1 text-gray-500">Required for Dumb Charades & Interrogator</p>
                    </div>

                    <div>
                        <label className="block text-xs font-black uppercase mb-1 flex justify-between">
                            <span>Gemini API Key</span>
                            {localGemini && <span className="text-green-600 flex items-center gap-1"><Check size={12} /> SET</span>}
                        </label>
                        <input
                            type="password"
                            value={localGemini}
                            onChange={(e) => setLocalGemini(e.target.value)}
                            placeholder="AIza..."
                            className="w-full p-3 border-4 border-black font-mono text-sm focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all"
                        />
                        <p className="text-[10px] mt-1 text-gray-500">Required for Humanish</p>
                    </div>
                </div>

                <div className="flex flex-col gap-3">
                    <button
                        onClick={handleSave}
                        disabled={!localGroq && !localGemini}
                        className="w-full bg-green-400 text-black font-black uppercase py-4 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-1 hover:translate-x-1 hover:shadow-none transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Check size={20} />
                        Save Keys
                    </button>

                    <button
                        onClick={handleSkip}
                        className="w-full bg-gray-200 text-gray-600 font-bold uppercase py-3 border-4 border-transparent hover:border-black hover:bg-gray-300 transition-all text-sm"
                    >
                        Continue Without Keys
                    </button>

                    {(groqKey || geminiKey) && (
                        <button
                            onClick={handleClear}
                            className="w-full text-red-500 font-bold uppercase py-2 text-xs hover:underline flex items-center justify-center gap-1"
                        >
                            <AlertTriangle size={12} />
                            Clear Saved Keys
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
