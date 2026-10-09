import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AdminUserRecord, TransactionRecord } from '../types';

const STORAGE_SUPABASE_URL = 'salery_supabase_url';
const STORAGE_SUPABASE_KEY = 'salery_supabase_key';

// Default Supabase project credentials if provided in env
const ENV_SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://sqmicjzafgcymcfdjlai.supabase.co';
const ENV_SUPABASE_KEY =
  (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ||
  (import.meta as any).env?.VITE_SUPABASE_KEY ||
  '';

export interface SupabaseConfigState {
  url: string;
  key: string;
  isConfigured: boolean;
  maskedKey?: string;
}

let browserClient: SupabaseClient | null = null;
let activeUrl = '';
let activeKey = '';

export function getStoredSupabaseConfig(): SupabaseConfigState {
  let url = '';
  let key = '';

  if (typeof window !== 'undefined') {
    try {
      url = localStorage.getItem(STORAGE_SUPABASE_URL) || '';
      key = localStorage.getItem(STORAGE_SUPABASE_KEY) || '';
    } catch {}
  }

  if (!url) url = ENV_SUPABASE_URL || 'https://sqmicjzafgcymcfdjlai.supabase.co';
  if (!key) key = ENV_SUPABASE_KEY;

  url = url.trim().replace(/\/+$/, '');
  key = key.trim();

  // 100% Auto-configured by default - no prompt or connect button needed
  const isConfigured = true;

  return {
    url,
    key,
    isConfigured,
    maskedKey: key ? `${key.slice(0, 6)}...${key.slice(-4)}` : 'auto-connected',
  };
}

export function saveStoredSupabaseConfig(url: string, key: string) {
  if (typeof window === 'undefined') return;
  try {
    const cleanUrl = url.trim().replace(/\/+$/, '');
    const cleanKey = key.trim();

    if (cleanUrl) {
      localStorage.setItem(STORAGE_SUPABASE_URL, cleanUrl);
    } else {
      localStorage.removeItem(STORAGE_SUPABASE_URL);
    }

    if (cleanKey) {
      localStorage.setItem(STORAGE_SUPABASE_KEY, cleanKey);
    } else {
      localStorage.removeItem(STORAGE_SUPABASE_KEY);
    }

    // Reset cached client
    browserClient = null;
    activeUrl = '';
    activeKey = '';
  } catch (e) {
    console.warn('Could not save Supabase config to localStorage:', e);
  }
}

export function getBrowserSupabaseClient(): SupabaseClient | null {
  const cfg = getStoredSupabaseConfig();
  if (!cfg.isConfigured) return null;

  if (browserClient && activeUrl === cfg.url && activeKey === cfg.key) {
    return browserClient;
  }

  try {
    browserClient = createClient(cfg.url, cfg.key, {
      auth: { persistSession: false },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
    activeUrl = cfg.url;
    activeKey = cfg.key;
    return browserClient;
  } catch (err) {
    console.error('Failed to create browser Supabase client:', err);
    return null;
  }
}

export async function testSupabaseConnection(
  url: string,
  key: string
): Promise<{ ok: boolean; message: string; tablesExist?: boolean }> {
  try {
    const cleanUrl = url.trim().replace(/\/+$/, '');
    const cleanKey = key.trim();

    if (!cleanUrl || !cleanKey) {
      return { ok: false, message: 'Supabase URL እና Key ማስገባት አስፈላጊ ነው።' };
    }

    const testClient = createClient(cleanUrl, cleanKey, {
      auth: { persistSession: false },
    });

    // Test query on users table
    const { data, error } = await testClient.from('users').select('id').limit(1);

    if (error) {
      if (error.message.includes('relation "public.users" does not exist') || error.code === '42P01') {
        return {
          ok: true,
          tablesExist: false,
          message: 'ከ Supabase ጋር ተገናኝቷል! ነገር ግን የ "users" ሠንጠረዥ ገና አልተፈጠረም። የ SQL ኮዱን ኮፒ አድርገው Supabase SQL Editor ላይ ያሂዱት።',
        };
      }
      return { ok: false, message: `የ Supabase ስህተት፦ ${error.message}` };
    }

    return {
      ok: true,
      tablesExist: true,
      message: 'ከ Supabase ዳታቤዝ ጋር በስኬት ተገናኝቷል! የ "users" ሠንጠረዥ ዝግጁ ነው።',
    };
  } catch (err: any) {
    return { ok: false, message: `የግንኙነት ስህተት፦ ${err.message || String(err)}` };
  }
}

/**
 * Register or update user directly in Supabase
 */
export async function supabaseRegisterUser(userData: {
  telegram_id: string | number;
  player_code?: string;
  first_name?: string;
  full_name?: string;
  username?: string;
  phone_number?: string;
  balance?: number;
  role?: string;
  status?: string;
  referred_by?: string;
}): Promise<{ ok: boolean; user?: any; error?: string }> {
  const client = getBrowserSupabaseClient();
  if (!client) return { ok: false, error: 'Supabase not connected' };

  try {
    const tId = String(userData.telegram_id);
    const code = userData.player_code || `SB-${(Math.abs(Number(tId)) * 17) % 90000 + 10000}`;
    const name = userData.first_name || userData.full_name || 'Player';
    const initBal = userData.balance !== undefined ? userData.balance : (tId === '908336796' ? 24560 : 10);
    const role = userData.role || (tId === '908336796' ? 'admin' : 'user');

    // 1. Check existing user
    const { data: existing } = await client
      .from('users')
      .select('*')
      .eq('telegram_id', tId)
      .maybeSingle();

    if (existing) {
      // Update basic fields if they are missing or new
      const updatePayload: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };
      if (userData.first_name && !existing.first_name) updatePayload.first_name = userData.first_name;
      if (userData.username && !existing.username) updatePayload.username = userData.username;
      if (userData.phone_number && !existing.phone_number) {
        updatePayload.phone_number = userData.phone_number;
        updatePayload.is_verified = true;
      }
      if (userData.role) updatePayload.role = userData.role;

      if (Object.keys(updatePayload).length > 1) {
        await client.from('users').update(updatePayload).eq('telegram_id', tId);
      }

      return { ok: true, user: { ...existing, ...updatePayload } };
    }

    // 2. Insert new user
    const newRecord: Record<string, any> = {
      telegram_id: tId,
      player_code: code,
      first_name: name,
      full_name: name,
      username: userData.username || '',
      phone_number: userData.phone_number || '',
      balance: initBal,
      main_wallet: initBal,
      play_wallet: 0,
      role: role,
      status: 'active',
      is_blocked: false,
      is_verified: !!userData.phone_number,
      referred_by: userData.referred_by || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: inserted, error } = await client
      .from('users')
      .insert([newRecord])
      .select()
      .maybeSingle();

    if (error) {
      // Retry with minimal columns in case table has fewer columns
      const minimalRecord = {
        telegram_id: tId,
        username: userData.username || '',
        balance: initBal,
      };
      const { data: minInserted, error: minErr } = await client
        .from('users')
        .insert([minimalRecord])
        .select()
        .maybeSingle();

      if (minErr) {
        console.warn('Supabase user insert failed:', minErr.message);
        return { ok: false, error: minErr.message };
      }
      return { ok: true, user: minInserted };
    }

    return { ok: true, user: inserted };
  } catch (err: any) {
    console.warn('supabaseRegisterUser error:', err);
    return { ok: false, error: err.message };
  }
}

/**
 * Fetch all users directly from Supabase for Admin Panel
 */
export async function supabaseFetchAllUsers(): Promise<AdminUserRecord[] | null> {
  const client = getBrowserSupabaseClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !Array.isArray(data)) {
      return null;
    }

    return data.map((u: any) => ({
      id: u.id,
      telegram_id: String(u.telegram_id || ''),
      player_code: u.player_code || `SB-${(Math.abs(Number(u.telegram_id)) * 17) % 90000 + 10000}`,
      first_name: u.first_name || u.full_name || 'Player',
      full_name: u.full_name || u.first_name || 'Player',
      username: u.username || '',
      phone_number: u.phone_number || '',
      balance: Number(u.balance || 0),
      role: u.role || (String(u.telegram_id) === '908336796' ? 'admin' : 'user'),
      status: u.status || (u.is_blocked ? 'blocked' : 'active'),
      is_blocked: !!u.is_blocked || u.status === 'blocked',
      ban_reason: u.ban_reason,
      is_verified: !!u.is_verified || !!u.phone_number,
      created_at: u.created_at || new Date().toISOString(),
    }));
  } catch (err) {
    console.warn('supabaseFetchAllUsers error:', err);
    return null;
  }
}

/**
 * Create transaction directly in Supabase
 */
export async function supabaseCreateTransaction(tx: {
  id: string;
  telegram_id: string | number;
  player_name: string;
  player_code: string;
  phone_number?: string;
  type: 'deposit' | 'withdraw';
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  reference?: string;
  notes?: string;
}): Promise<{ ok: boolean; transaction?: any; error?: string }> {
  const client = getBrowserSupabaseClient();
  if (!client) return { ok: false, error: 'Supabase not connected' };

  try {
    const record = {
      id: tx.id,
      telegram_id: String(tx.telegram_id),
      player_name: tx.player_name,
      player_code: tx.player_code,
      phone_number: tx.phone_number || '',
      type: tx.type,
      amount: tx.amount,
      status: tx.status,
      reference: tx.reference || '',
      notes: tx.notes || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await client
      .from('transactions')
      .insert([record])
      .select()
      .maybeSingle();

    if (error) {
      console.warn('Supabase create transaction failed:', error.message);
      return { ok: false, error: error.message };
    }

    return { ok: true, transaction: data || record };
  } catch (err: any) {
    console.warn('supabaseCreateTransaction error:', err);
    return { ok: false, error: err.message };
  }
}

/**
 * Fetch transactions directly from Supabase
 */
export async function supabaseFetchTransactions(
  type?: 'deposit' | 'withdraw',
  status?: string
): Promise<TransactionRecord[] | null> {
  const client = getBrowserSupabaseClient();
  if (!client) return null;

  try {
    let query = client.from('transactions').select('*').order('created_at', { ascending: false });

    if (type) {
      query = query.eq('type', type);
    }
    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error || !Array.isArray(data)) return null;

    return data.map((t: any) => ({
      id: String(t.id),
      telegram_id: String(t.telegram_id),
      player_name: t.player_name || 'Player',
      player_code: t.player_code || '',
      phone_number: t.phone_number || '',
      type: t.type,
      amount: Number(t.amount || 0),
      status: t.status || 'pending',
      reference: t.reference || '',
      screenshot_url: t.screenshot_url,
      photo_file_id: t.photo_file_id,
      created_at: t.created_at || new Date().toISOString(),
      notes: t.notes,
    }));
  } catch (err) {
    console.warn('supabaseFetchTransactions error:', err);
    return null;
  }
}

/**
 * Update transaction status & balance in Supabase
 */
export async function supabaseUpdateTransactionStatus(
  txId: string,
  status: 'approved' | 'rejected',
  note?: string
): Promise<{ ok: boolean; transaction?: any; error?: string }> {
  const client = getBrowserSupabaseClient();
  if (!client) return { ok: false, error: 'Supabase not connected' };

  try {
    const { data: tx, error: fetchErr } = await client
      .from('transactions')
      .select('*')
      .eq('id', txId)
      .maybeSingle();

    if (fetchErr || !tx) {
      return { ok: false, error: fetchErr?.message || 'Transaction not found' };
    }

    const { data: updatedTx, error: updateErr } = await client
      .from('transactions')
      .update({
        status,
        notes: note ? `${tx.notes || ''} | ${note}`.trim() : tx.notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', txId)
      .select()
      .maybeSingle();

    if (updateErr) {
      return { ok: false, error: updateErr.message };
    }

    // If approved, update user balance in Supabase users table!
    if (status === 'approved') {
      const { data: u } = await client
        .from('users')
        .select('balance, main_wallet')
        .eq('telegram_id', tx.telegram_id)
        .maybeSingle();

      const curBal = Number(u?.main_wallet ?? u?.balance ?? 0);
      let newBal = curBal;

      if (tx.type === 'deposit') {
        newBal = curBal + Number(tx.amount);
      } else if (tx.type === 'withdraw') {
        newBal = Math.max(0, curBal - Number(tx.amount));
      }

      await client
        .from('users')
        .update({ balance: newBal, main_wallet: newBal, updated_at: new Date().toISOString() })
        .eq('telegram_id', tx.telegram_id);
    }

    return { ok: true, transaction: updatedTx };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

/**
 * Update user balance directly in Supabase
 */
export async function supabaseUpdateUserBalance(
  telegramId: string | number,
  balance: number
): Promise<boolean> {
  const client = getBrowserSupabaseClient();
  if (!client) return false;

  try {
    const { error } = await client
      .from('users')
      .update({ balance: Math.max(0, balance), main_wallet: Math.max(0, balance), updated_at: new Date().toISOString() })
      .eq('telegram_id', String(telegramId));
    return !error;
  } catch {
    return false;
  }
}

/**
 * Subscribe to real-time changes on a Supabase table
 */
export function subscribeToSupabaseTable(
  tableName: 'users' | 'transactions',
  onInsert?: (record: any) => void,
  onUpdate?: (record: any) => void
) {
  const client = getBrowserSupabaseClient();
  if (!client) return () => {};

  try {
    const channelName = `realtime_${tableName}_${Date.now()}`;
    const channel = client
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: tableName },
        (payload) => {
          if (onInsert) onInsert(payload.new);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: tableName },
        (payload) => {
          if (onUpdate) onUpdate(payload.new);
        }
      )
      .subscribe();

    return () => {
      try {
        client.removeChannel(channel);
      } catch {}
    };
  } catch (err) {
    console.warn('Realtime subscription error:', err);
    return () => {};
  }
}

/**
 * Complete SQL script to set up Supabase tables with a single click
 */
export const SUPABASE_SQL_SCHEMA = `-- ==========================================
-- SALERY BINGO (ሳለሪ ቢንጎ) SUPABASE DATABASE SCHEMA
-- ኮፒ አድርገው በ Supabase SQL Editor ውስጥ ያሂዱት (RUN)
-- ==========================================

-- 1. Create Users Table (የተጫዋቾች ሠንጠረዥ)
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
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS main_wallet NUMERIC;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS play_wallet NUMERIC;
UPDATE public.users
SET main_wallet = COALESCE(main_wallet, balance, 0),
    play_wallet = COALESCE(play_wallet, 0);

-- 2. Create Transactions Table (የዲፖዚት እና ዊዝድሮው ሠንጠረዥ)
CREATE TABLE IF NOT EXISTS public.transactions (
  id TEXT PRIMARY KEY,
  telegram_id TEXT NOT NULL,
  player_name TEXT,
  player_code TEXT,
  phone_number TEXT,
  type TEXT NOT NULL, -- 'deposit' ወይም 'withdraw'
  amount NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  reference TEXT,
  screenshot_url TEXT,
  photo_file_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create Game Logs Table (የጨዋታ ታሪክ ሠንጠረዥ)
CREATE TABLE IF NOT EXISTS public.game_logs (
  id TEXT PRIMARY KEY,
  telegram_id TEXT NOT NULL,
  game_code TEXT,
  timestamp BIGINT,
  stake NUMERIC DEFAULT 10,
  cards_count INTEGER DEFAULT 1,
  result TEXT, -- 'won' ወይም 'lost'
  won_amount NUMERIC DEFAULT 0,
  pattern_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Enable Realtime Subscriptions (በቅጽበት ለውጦች እንዲታዩ)
ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;

-- 5. Keep wallet tables server-only; the server service role bypasses RLS.
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_logs ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  existing_policy RECORD;
BEGIN
  FOR existing_policy IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('users', 'transactions', 'game_logs')
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I', existing_policy.policyname, existing_policy.schemaname, existing_policy.tablename);
  END LOOP;
END;
$$;

REVOKE ALL ON TABLE public.users, public.transactions, public.game_logs FROM PUBLIC, anon, authenticated;

-- 6. Insert Default Admin if not exists
INSERT INTO public.users (telegram_id, player_code, first_name, full_name, username, balance, role, status, is_verified)
VALUES ('908336796', 'SB-90833', 'Admin', 'ሳለሪ አድሚን (Admin)', 'salery_admin', 24560, 'admin', 'active', true)
ON CONFLICT (telegram_id) DO NOTHING;
`;
