
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface ApiKeyContextType {
    groqKey: string;
    geminiKey: string;
    saveKeys: (groq: string, gemini: string) => void;
    clearKeys: () => void;
    hasKeys: boolean;
    isLoaded: boolean;
    isModalOpen: boolean;
    setModalOpen: (open: boolean) => void;
}

const ApiKeyContext = createContext<ApiKeyContextType | undefined>(undefined);

export function ApiKeyProvider({ children }: { children: ReactNode }) {
    const [groqKey, setGroqKey] = useState("");
    const [geminiKey, setGeminiKey] = useState("");
    const [isLoaded, setIsLoaded] = useState(false);
    const [isModalOpen, setModalOpen] = useState(false);

    useEffect(() => {
        const storedGroq = localStorage.getItem("user_groq_key");
        const storedGemini = localStorage.getItem("user_gemini_key");
        if (storedGroq) setGroqKey(storedGroq);
        if (storedGemini) setGeminiKey(storedGemini);
        setIsLoaded(true);
    }, []);

    const saveKeys = (groq: string, gemini: string) => {
        localStorage.setItem("user_groq_key", groq);
        localStorage.setItem("user_gemini_key", gemini);
        setGroqKey(groq);
        setGeminiKey(gemini);
    };

    const clearKeys = () => {
        localStorage.removeItem("user_groq_key");
        localStorage.removeItem("user_gemini_key");
        setGroqKey("");
        setGeminiKey("");
    };

    const hasKeys = !!(groqKey || geminiKey);

    return (
        <ApiKeyContext.Provider value={{ groqKey, geminiKey, saveKeys, clearKeys, hasKeys, isLoaded, isModalOpen, setModalOpen }}>
            {children}
        </ApiKeyContext.Provider>
    );
}

export function useApiKeys() {
    const context = useContext(ApiKeyContext);
    if (context === undefined) {
        throw new Error("useApiKeys must be used within an ApiKeyProvider");
    }
    return context;
}
