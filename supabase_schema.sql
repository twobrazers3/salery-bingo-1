-- ==============================================================================
-- SALERY BINGO (ሳለሪ ቢንጎ) - COMPLETE SUPABASE SQL SCHEMA
-- Copy and run this script in Supabase Dashboard -> SQL Editor -> Run (F5)
-- ==============================================================================

-- 1. USERS TABLE (የተጫዋቾች ሰንጠረዥ)
CREATE TABLE IF NOT EXISTS public.users (
  id BIGSERIAL PRIMARY KEY,
  telegram_id TEXT UNIQUE NOT NULL,
  player_code TEXT,
  first_name TEXT,
  full_name TEXT,
  username TEXT,
  phone_number TEXT,
  balance NUMERIC DEFAULT 10,
  main_wallet NUMERIC DEFAULT 10,
  play_wallet NUMERIC DEFAULT 0,
  role TEXT DEFAULT 'user',
  status TEXT DEFAULT 'active',
  is_blocked BOOLEAN DEFAULT false,
  ban_reason TEXT,
  is_verified BOOLEAN DEFAULT false,
  referred_by TEXT,
  referral_count INTEGER DEFAULT 0,
  total_deposited NUMERIC DEFAULT 0,
  total_withdrawn NUMERIC DEFAULT 0,
  games_played INTEGER DEFAULT 0,
  games_won INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TRANSACTIONS TABLE (የገንዘብ ማስገቢያ እና ማውጫ እንቅስቃሴዎች)
CREATE TABLE IF NOT EXISTS public.transactions (
  id TEXT PRIMARY KEY,
  telegram_id TEXT NOT NULL,
  player_name TEXT,
  player_code TEXT,
  phone_number TEXT,
  type TEXT NOT NULL, -- 'deposit' | 'withdraw'
  amount NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected'
  reference TEXT,
  screenshot_url TEXT,
  photo_file_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. GAME LOGS TABLE (የጨዋታ ታሪክ)
CREATE TABLE IF NOT EXISTS public.game_logs (
  id TEXT PRIMARY KEY,
  telegram_id TEXT NOT NULL,
  player_name TEXT,
  game_id TEXT NOT NULL,
  room_name TEXT,
  stake NUMERIC NOT NULL,
  cards_count INTEGER DEFAULT 1,
  result TEXT, -- 'won' | 'lost'
  won_amount NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. BINGO ROOMS TABLE (የቀጥታ ባለብዙ ተጫዋች ክፍል)
CREATE TABLE IF NOT EXISTS public.bingo_rooms (
  room_id TEXT PRIMARY KEY,
  state JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. LEDGER TABLES (የአስተማማኝ ክፍያ መዝገብ)
CREATE TABLE IF NOT EXISTS public.bingo_wallet_ledger (
  idempotency_key TEXT PRIMARY KEY,
  telegram_id TEXT NOT NULL,
  game_id TEXT NOT NULL,
  kind TEXT NOT NULL, -- 'stake' | 'prize'
  wallet_type TEXT NOT NULL DEFAULT 'main_wallet',
  amount NUMERIC NOT NULL CHECK (amount >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.bingo_platform_commission_ledger (
  idempotency_key TEXT PRIMARY KEY,
  telegram_id TEXT NOT NULL,
  game_id TEXT NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. INDEXES (ለፈጣን ፍለጋ)
CREATE INDEX IF NOT EXISTS users_telegram_idx ON public.users (telegram_id);
CREATE INDEX IF NOT EXISTS transactions_telegram_idx ON public.transactions (telegram_id, created_at DESC);
CREATE INDEX IF NOT EXISTS game_logs_telegram_idx ON public.game_logs (telegram_id, created_at DESC);

-- 7. ENABLE ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bingo_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bingo_wallet_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bingo_platform_commission_ledger ENABLE ROW LEVEL SECURITY;

-- Allow full access for Service Role (Backend API)
CREATE POLICY "Service Role Full Access Users" ON public.users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service Role Full Access Transactions" ON public.transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service Role Full Access Game Logs" ON public.game_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service Role Full Access Bingo Rooms" ON public.bingo_rooms FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service Role Full Access Wallet Ledger" ON public.bingo_wallet_ledger FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service Role Full Access Commission Ledger" ON public.bingo_platform_commission_ledger FOR ALL USING (true) WITH CHECK (true);

-- Allow public read access where necessary
CREATE POLICY "Public Read Users" ON public.users FOR SELECT USING (true);
CREATE POLICY "Public Read Transactions" ON public.transactions FOR SELECT USING (true);
CREATE POLICY "Public Read Game Logs" ON public.game_logs FOR SELECT USING (true);
CREATE POLICY "Public Read Bingo Rooms" ON public.bingo_rooms FOR SELECT USING (true);
