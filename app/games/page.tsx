'use client';

import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { Gamepad2, ArrowLeft } from 'lucide-react';

export default function GamesPage() {
  const router = useRouter();

  const games = [
    {
      name: 'Headlines',
      path: '/games/headlines',
      description: 'Guess if the headline is real or AI-generated',
      color: 'bg-neo-pink'
    },
    {
      name: 'Humanish',
      path: '/games/humanish',
      description: 'Chat with others - but who is human?',
      color: 'bg-neo-green'
    },
    {
      name: 'Interrogator',
      path: '/games/interrogator',
      description: 'Break the AI vault with clever prompts',
      color: 'bg-neo-cyan'
    },
    {
      name: 'Odd-Eve',
      path: '/games/odd-eve',
      description: 'Cricket batting game against AI bowler',
      color: 'bg-yellow-400'
    },
    {
      name: 'Scribble',
      path: '/games/scribble',
      description: 'Draw and let AI guess your masterpiece',
      color: 'bg-purple-400'
    },
    {
      name: 'Semantics',
      path: '/games/semantics',
      description: 'Find words with similar meanings',
      color: 'bg-orange-400'
    },
    {
      name: 'Scavenger Hunt',
      path: '/games/scavenger-hunt',
      description: 'Find real objects matching emojis!',
      color: 'bg-indigo-400'
    },
    {
      name: 'Meme Recreator',
      path: '/games/meme-recreator',
      description: 'Recreate viral memes with your body!',
      color: 'bg-red-400'
    },
    {
      name: 'Dumb Charades',
      path: '/games/dumb-charades',
      description: 'Guess the prompt',
      color: 'bg-emerald-400'
    }
  ];

  return (
    <main className="min-h-screen bg-[#F0F0F0] text-black pb-20">
      <Navbar />
      <div className="max-w-4xl mx-auto pt-24 px-4">

        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-gray-600 hover:text-black font-mono text-sm mb-4 transition-colors"
          >
            <ArrowLeft size={16} />
            Back to Portal
          </button>

          <div className="bg-white border-4 border-black p-6 shadow-neo-lg">
            <div className="flex items-center gap-4 mb-2">
              <Gamepad2 size={48} />
              <h1 className="font-heading text-5xl uppercase">AI Games</h1>
            </div>
            <p className="font-mono text-gray-600">
              Choose your challenge and test your skills against AI
            </p>
          </div>
        </div>

        {/* Games Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {games.map((game) => (
            <button
              key={game.path}
              onClick={() => router.push(game.path)}
              className={`${game.color} text-black p-8 border-4 border-black shadow-neo hover:translate-y-1 hover:shadow-none transition-all text-left group`}
            >
              <h2 className="font-heading text-3xl uppercase mb-3 group-hover:scale-105 transition-transform">
                {game.name}
              </h2>
              <p className="font-mono text-sm">
                {game.description}
              </p>
            </button>
          ))}
        </div>

      </div>
    </main>
  );
}
