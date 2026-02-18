
"use client";

import { Settings, Key } from "lucide-react";
import ApiKeyModal from "./ApiKeyModal";
import { useApiKeys } from "@/contexts/ApiKeyContext";

export default function ApiKeySettings() {
    const { hasKeys, isLoaded, isModalOpen, setModalOpen } = useApiKeys();

    // Auto-open if keys are missing on first load? 
    // The plan says "If user skips, the AI games will prompt". 
    // So maybe don't auto-open here, let games handle enforcement or specific prompts.
    // BUT, for visibility, maybe open once if not set? 
    // Let's stick to user request: "temporarily stored".

    // Let's just have the button for now.

    if (!isLoaded) return null;

    return (
        <>
            <button
                onClick={() => setModalOpen(true)}
                className={`fixed bottom-4 right-4 z-40 p-3 rounded-full shadow-lg border-2 border-black transition-all hover:scale-110 active:scale-95 flex items-center gap-2 ${hasKeys ? "bg-white text-black" : "bg-yellow-400 text-black animate-bounce"
                    }`}
                title="API Key Settings"
            >
                {hasKeys ? <Settings size={24} /> : <Key size={24} />}
                {!hasKeys && <span className="font-bold text-xs uppercase pr-1">Set Keys</span>}
            </button>

            <ApiKeyModal
                isOpen={isModalOpen}
                onClose={() => setModalOpen(false)}
            />
        </>
    );
}
