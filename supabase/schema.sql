-- Create the Players table
CREATE TABLE public.players (
    uid TEXT PRIMARY KEY,
    name TEXT,
    stonks INTEGER DEFAULT 200,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create the Logs table to track game history
CREATE TABLE public.game_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    player_uid TEXT REFERENCES public.players(uid) ON DELETE CASCADE NOT NULL,
    game_title TEXT NOT NULL,
    result TEXT NOT NULL, -- 'WIN' or 'LOSS'
    stonks_change INTEGER NOT NULL,
    played_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_logs ENABLE ROW LEVEL SECURITY;

-- Create policies (For this event, we might want public read/write for simplicity if there's no auth, 
-- otherwise we need a way to secure it. Since we are using simple UID login without password, 
-- we will allow public access for now but restrict modification logic to the client or server actions if we had them.
-- WARNING: This is insecure for a real production app but fine for a controlled event arcade)

CREATE POLICY "Enable read access for all users" ON public.players FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON public.players FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON public.players FOR UPDATE USING (true);

CREATE POLICY "Enable read access for all users" ON public.game_logs FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON public.game_logs FOR INSERT WITH CHECK (true);

-- Create a realtime publication so the leaderboard updates live!
DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime FOR TABLE public.players, public.game_logs;
