interface CircularTimerProps {
  timeLeft: number;
}

export default function CircularTimer({ timeLeft }: CircularTimerProps) {
  return (
    <div className="relative w-12 h-12 flex items-center justify-center">
      {/* Circle with border */}
      <div className="absolute inset-0 bg-white rounded-full border-[3px] border-black shadow-md" />
      
      {/* Clock markers at 12, 3, 6, 9 positions */}
      {/* 12 o'clock */}
      <div className="absolute top-[2px] left-1/2 -translate-x-1/2 w-[2px] h-[6px] bg-black" />
      
      {/* 3 o'clock */}
      <div className="absolute right-[2px] top-1/2 -translate-y-1/2 h-[2px] w-[6px] bg-black" />
      
      {/* 6 o'clock */}
      <div className="absolute bottom-[2px] left-1/2 -translate-x-1/2 w-[2px] h-[6px] bg-black" />
      
      {/* 9 o'clock */}
      <div className="absolute left-[2px] top-1/2 -translate-y-1/2 h-[2px] w-[6px] bg-black" />
      
      {/* Timer number */}
      <div 
        className={`relative z-10 font-bold text-base ${
          timeLeft <= 10 ? 'text-red-600' : 'text-gray-900'
        }`}
        style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}
      >
        {timeLeft}
      </div>
    </div>
  );
}
