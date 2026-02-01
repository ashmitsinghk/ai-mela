'use client';

import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastProps {
    id: string;
    message: string;
    type: ToastType;
    duration?: number;
    onClose: (id: string) => void;
}

const Toast: React.FC<ToastProps> = ({ id, message, type, duration = 3000, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose(id);
        }, duration);

        return () => clearTimeout(timer);
    }, [id, duration, onClose]);

    const bgColors = {
        success: 'bg-neo-green text-black border-black',
        error: 'bg-red-500 text-white border-black',
        info: 'bg-neo-cyan text-black border-black',
        warning: 'bg-neo-yellow text-black border-black',
    };

    return (
        <div className={`flex items-center justify-between p-4 mb-2 min-w-[300px] border-4 shadow-[4px_4px_0px_#000] animate-in slide-in-from-right duration-300 ${bgColors[type]} font-mono font-bold`}>
            <span className="mr-4">{message}</span>
            <button onClick={() => onClose(id)} className="hover:opacity-70 transition-opacity">
                <X size={20} />
            </button>
        </div>
    );
};

export default Toast;
