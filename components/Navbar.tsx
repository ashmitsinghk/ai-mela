'use client';

import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const Navbar = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const router = useRouter();

    useEffect(() => {
        // Check login status on mount
        const uid = localStorage.getItem('user_uid');
        setIsLoggedIn(!!uid);

        // Optional: Listen for storage events to update real-time across tabs
        const handleStorageChange = () => {
            const uid = localStorage.getItem('user_uid');
            setIsLoggedIn(!!uid);
        };
        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('user_uid');
        setIsLoggedIn(false);
        router.push('/login');
    };

    const navLinks = [
        { name: 'MY STONKS', href: '/' },
        { name: 'LEADERBOARD', href: '/leaderboard' },
    ];

    return (
        <nav className="fixed top-0 left-0 w-full z-50 bg-white border-b-4 border-black">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-20">
                    <div className="flex-shrink-0">
                        <Link href="/" className="font-heading text-4xl uppercase tracking-tighter text-black">
                            AI <span className="text-neo-pink">MELA</span>
                        </Link>
                    </div>
                    <div className="hidden md:block">
                        <div className="ml-10 flex items-baseline space-x-4">
                            {navLinks.map((link) => (
                                <Link
                                    key={link.name}
                                    href={link.href}
                                    className="font-mono text-lg text-black hover:bg-black hover:text-white px-3 py-2 border-2 border-transparent hover:border-black transition-all font-bold"
                                >
                                    {link.name}
                                </Link>
                            ))}
                            {isLoggedIn ? (
                                <button
                                    onClick={handleLogout}
                                    className="bg-red-500 text-white font-mono font-bold px-4 py-2 border-2 border-black shadow-[4px_4px_0px_#000] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_#000] transition-all"
                                >
                                    LOGOUT
                                </button>
                            ) : (
                                <Link
                                    href="/login"
                                    className="bg-neo-yellow text-black font-mono font-bold px-4 py-2 border-2 border-black shadow-[4px_4px_0px_#000] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_#000] transition-all"
                                >
                                    LOGIN
                                </Link>
                            )}
                        </div>
                    </div>
                    <div className="-mr-2 flex md:hidden">
                        <button
                            onClick={() => setIsOpen(!isOpen)}
                            type="button"
                            className="bg-black text-white inline-flex items-center justify-center p-2 rounded-none border-2 border-transparent focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-white"
                        >
                            <span className="sr-only">Open main menu</span>
                            {isOpen ? <X className="block h-6 w-6" /> : <Menu className="block h-6 w-6" />}
                        </button>
                    </div>
                </div>
            </div>

            {isOpen && (
                <div className="md:hidden border-t-4 border-black bg-white">
                    <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
                        {navLinks.map((link) => (
                            <Link
                                key={link.name}
                                href={link.href}
                                className="text-black hover:bg-black hover:text-white block px-3 py-2 font-mono text-base font-bold"
                                onClick={() => setIsOpen(false)}
                            >
                                {link.name}
                            </Link>
                        ))}
                        {isLoggedIn ? (
                            <button
                                onClick={() => {
                                    handleLogout();
                                    setIsOpen(false);
                                }}
                                className="w-full text-center block bg-red-500 text-white font-mono font-bold px-4 py-2 border-2 border-black shadow-[4px_4px_0px_#000] mt-4"
                            >
                                LOGOUT
                            </button>
                        ) : (
                            <Link
                                href="/login"
                                className="w-full text-center block bg-neo-yellow text-black font-mono font-bold px-4 py-2 border-2 border-black shadow-[4px_4px_0px_#000] mt-4"
                                onClick={() => setIsOpen(false)}
                            >
                                LOGIN
                            </Link>
                        )}
                    </div>
                </div>
            )}
        </nav>
    );
};

export default Navbar;
