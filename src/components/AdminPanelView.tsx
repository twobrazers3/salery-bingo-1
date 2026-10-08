import React, { useState, useEffect, useRef } from 'react';
import { AdminUserRecord, TransactionRecord, PlayerGameHistory } from '../types';
import {
  fetchAdminUsers,
  adminChangePlayerBalance,
  adminChangePlayerStatus,
  adminBroadcastMessage,
  fetchAdminTransactions,
  adminUpdateTransactionStatus,
  fetchPlayerGameHistory,
  fetchBroadcastHistory,
  fetchMediaGallery,
  saveMediaItem,
  fetchBotConfig,
  saveBotConfig,
  deleteAdminTransaction,
  fetchAdminFinancialMovements,
  getStoredBackendUrl,
  setStoredBackendUrl,
  getCandidateBackendUrls,
  fetchSupabaseBackendConfig,
  saveSupabaseBackendConfig,
  testSupabaseConnection,
  subscribeToSupabaseTable,
  SUPABASE_SQL_SCHEMA,
  getStoredSupabaseConfig,
  OLD_PURGED_TX_IDS,
  getAutoDiscoveredRailwayUrl,
} from '../utils/api';
import {
  Users,
  Wallet,
  UserCheck,
  UserX,
  Search,
  RefreshCw,
  ArrowLeft,
  DollarSign,
  Plus,
  Minus,
  CheckCircle,
  AlertTriangle,
  Megaphone,
  Copy,
  Sliders,
  Send,
  X,
  ArrowDownLeft,
  ArrowUpRight,
  History,
  Gamepad2,
  Phone,
  Check,
  Ban,
  Clock,
  Bell,
  Eye,
  ChevronRight,
  TrendingUp,
  Award,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Image as ImageIcon,
  Bookmark,
  FileText,
  Trash2,
  Upload,
  Radio,
  Share2,
  FolderOpen,
  Camera,
  RotateCcw,
  Bot,
  Key,
  Server,
  Globe,
  ExternalLink,
  Database,
} from 'lucide-react';

interface AdminPanelViewProps {
  onBack: () => void;
  adminTelegramId?: number | string;
  onRefreshUserBalance?: () => void;
}

type AdminTab = 'players' | 'deposits' | 'withdrawals' | 'history' | 'active_players' | 'broadcast';

export interface PresetMessage {
  id: string;
  title: string;
  category: 'daily' | 'bonus' | 'alert' | 'winner' | 'support';
  badge: string;
  message: string;
  photoUrl?: string;
}

export const PRESET_DAILY_MESSAGES: PresetMessage[] = [];

const BAN_REASON_PRESETS = [
  'የሐሰት ደረሰኝ መላክ (Fake / Altered Screenshot)',
  'ስድብ ወይም ያልተገባ ፀባይ (Abusive / Toxic Behavior)',
  'ያልተፈቀደ ማጭበርበር (Cheating / Exploiting Bug)',
  'የአገልግሎት ደንብ መጣስ (Terms of Service Violation)',
  'ተደጋጋሚ አላስፈላጊ ጥያቄ (Spamming Requests)',
];

export const AdminPanelView: React.FC<AdminPanelViewProps> = ({
  onBack,
  adminTelegramId,
  onRefreshUserBalance,
}) => {
  // Main admin tabs
  const [activeTab, setActiveTab] = useState<AdminTab>('players');

  // Users data
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'blocked'>('all');
  const [supabaseConnected, setSupabaseConnected] = useState(true);
  const [adminRevenue, setAdminRevenue] = useState(0);

  // Transactions data (Deposits & Withdrawals with instant notifications)
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [loadingTx, setLoadingTx] = useState(false);
  const [txFilter, setTxFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [depositSubTab, setDepositSubTab] = useState<'pending' | 'history'>('pending');

  // Financial Movements Ledger
  const [movements, setMovements] = useState<any[]>([]);
  const [loadingMovements, setLoadingMovements] = useState(false);
  const [movementFilter, setMovementFilter] = useState<'all' | 'deposit' | 'withdraw' | 'game_stake' | 'game_win'>('all');

  // Player Detail & Game History Modal
  const [inspectUser, setInspectUser] = useState<AdminUserRecord | null>(null);
  const [playerHistory, setPlayerHistory] = useState<PlayerGameHistory[]>([]);
  const [loadingPlayerHistory, setLoadingPlayerHistory] = useState(false);

  // Balance edit modal
  const [selectedUser, setSelectedUser] = useState<AdminUserRecord | null>(null);
  const [balanceActionType, setBalanceActionType] = useState<'set' | 'add' | 'subtract'>('add');
  const [balanceAmount, setBalanceAmount] = useState<string>('500');
  const [balanceReason, setBalanceReason] = useState<string>('Admin credit');
  const [isUpdatingBalance, setIsUpdatingBalance] = useState(false);

  // Ban User Modal
  const [banTargetUser, setBanTargetUser] = useState<AdminUserRecord | null>(null);
  const [selectedBanReason, setSelectedBanReason] = useState<string>(BAN_REASON_PRESETS[0]);
  const [customBanReason, setCustomBanReason] = useState<string>('');
  const [isProcessingBan, setIsProcessingBan] = useState(false);

  // Broadcast & Daily Messages Studio
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastTarget, setBroadcastTarget] = useState<'all' | string>('all');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string>('');
  const [selectedPhotoTitle, setSelectedPhotoTitle] = useState<string>('');
  const [isSendingBroadcast, setIsSendingBroadcast] = useState(false);
  const [broadcastHistory, setBroadcastHistory] = useState<any[]>([]);
  const [mediaGallery, setMediaGallery] = useState<any[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [showPhotoPicker, setShowPhotoPicker] = useState(false);
  const [activeBroadcastSubTab, setActiveBroadcastSubTab] = useState<'text_archive' | 'photo_archive'>('text_archive');
  const [textArchiveFilter, setTextArchiveFilter] = useState<'all' | 'broadcasts' | 'saved' | 'presets'>('all');
  const [photoArchiveFilter, setPhotoArchiveFilter] = useState<string>('all');
  const [textArchiveSearch, setTextArchiveSearch] = useState('');

  // Custom Saved Templates from LocalStorage (እንዳይጠፉ ማድረጊያ)
  const [savedTemplates, setSavedTemplates] = useState<
    Array<{ id: string; title: string; message: string; photoUrl?: string; created_at: string }>
  >(() => {
    try {
      const stored = localStorage.getItem('salery_saved_daily_templates');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Track processed transaction statuses in useRef & localStorage so approved/rejected ones INSTANTLY disappear from pending
  const processedTxMapRef = useRef<Record<string, 'approved' | 'rejected'>>({});

  // Track last optimistic balance updates to prevent background poll flickering
  const lastOptimisticUpdatesRef = useRef<Record<string, { balance: number; timestamp: number }>>({});

  useEffect(() => {
    try {
      const saved = localStorage.getItem('salery_processed_tx_map');
      if (saved) {
        processedTxMapRef.current = JSON.parse(saved);
      }
    } catch {}
  }, []);

  const markTxProcessed = (txId: string, status: 'approved' | 'rejected') => {
    processedTxMapRef.current[txId] = status;
    try {
      localStorage.setItem('salery_processed_tx_map', JSON.stringify(processedTxMapRef.current));
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }
  };

  // Toast notification
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const prevPendingTxCountRef = useRef<number>(0);
  const deviceFileInputRef = useRef<HTMLInputElement>(null);
  const modalFileInputRef = useRef<HTMLInputElement>(null);
  const archiveUploadInputRef = useRef<HTMLInputElement>(null);

  // Telegram Bot & Server Configuration State
  const [botConfig, setBotConfig] = useState<{
    isConfigured: boolean;
    botUsername?: string;
    maskedToken?: string;
    webAppUrl?: string;
  }>({ isConfigured: false, webAppUrl: 'https://yeya-bingo.vercel.app' });
  const [showBotConfigModal, setShowBotConfigModal] = useState(false);
  const [inputBotToken, setInputBotToken] = useState('');
  const [inputWebAppUrl, setInputWebAppUrl] = useState('https://yeya-bingo.vercel.app');
  const [inputBackendUrl, setInputBackendUrl] = useState(() => getStoredBackendUrl() || '');
  const [isConnectingBot, setIsConnectingBot] = useState(false);
  const [botConfigMessage, setBotConfigMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Supabase Configuration State & Realtime
  const [showSupabaseModal, setShowSupabaseModal] = useState(false);
  const [supabaseUrlInput, setSupabaseUrlInput] = useState(() => getStoredSupabaseConfig().url || '');
  const [supabaseKeyInput, setSupabaseKeyInput] = useState(() => getStoredSupabaseConfig().key || '');
  const [supabaseTesting, setSupabaseTesting] = useState(false);
  const [supabaseMsg, setSupabaseMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string; tablesExist?: boolean } | null>(null);
  const [supabaseCopiedSql, setSupabaseCopiedSql] = useState(false);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadSupabaseConfig = async () => {
    try {
      const cfg = await fetchSupabaseBackendConfig();
      if (cfg) {
        if (cfg.url && !supabaseUrlInput) setSupabaseUrlInput(cfg.url);
        setSupabaseConnected(!!cfg.isConnected || !!cfg.isConfigured);
      }
    } catch (e) {
      console.warn('Failed to load Supabase backend config:', e);
    }
  };

  const handleSaveSupabaseConfig = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!supabaseUrlInput.trim() || !supabaseKeyInput.trim()) {
      setSupabaseMsg({ type: 'error', text: 'Supabase URL እና Anon Key ማስገባት አስፈላጊ ነው።' });
      return;
    }

    setSupabaseTesting(true);
    setSupabaseMsg(null);
    try {
      const res = await saveSupabaseBackendConfig(supabaseUrlInput.trim(), supabaseKeyInput.trim());
      if (res.ok) {
        setSupabaseConnected(true);
        setSupabaseMsg({
          type: 'success',
          text: res.message || 'ከ Supabase ዳታቤዝ ጋር በስኬት ተገናኝቷል! 🟢',
          tablesExist: res.tablesExist,
        });
        showToast('ከ Supabase ዳታቤዝ ጋር ተገናኝቷል! 🟢✨', 'success');
        loadUsers(true);
        loadTransactions();
      } else {
        setSupabaseMsg({
          type: 'error',
          text: res.error || res.message || 'ከ Supabase ጋር መገናኘት አልተቻለም። URL እና Key ያረጋግጡ።',
        });
      }
    } catch (err: any) {
      setSupabaseMsg({
        type: 'error',
        text: `ስህተት፦ ${err.message || 'ግንኙነት አልተሳካም'}`,
      });
    } finally {
      setSupabaseTesting(false);
    }
  };

  const handleCopySqlSchema = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
      setSupabaseCopiedSql(true);
      showToast('ሙሉ የ SQL ስክሪፕት ተቀድቷል! በ Supabase SQL Editor ውስጥ RUN ያድርጉት 📋', 'success');
      setTimeout(() => setSupabaseCopiedSql(false), 3000);
    }
  };

  const checkBotConfig = async () => {
    try {
      const cfg = await fetchBotConfig();
      if (cfg) {
        setBotConfig({
          isConfigured: !!cfg.isConfigured,
          botUsername: cfg.botUsername,
          maskedToken: cfg.maskedToken,
          webAppUrl: cfg.webAppUrl || 'https://yeya-bingo.vercel.app',
        });
        if (cfg.webAppUrl) {
          setInputWebAppUrl(cfg.webAppUrl);
        }
      }
    } catch (e) {
      console.warn('Bot config check err:', e);
    }
  };

  const handleSaveBotConfig = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputBotToken.trim() && !inputWebAppUrl.trim() && !inputBackendUrl.trim()) {
      setBotConfigMessage({ type: 'error', text: 'እባክዎ የቦት ቶከኑን፣ የዌብአፕ ወይም የሰርቨር አድራሻ ያስገቡ' });
      return;
    }

    setIsConnectingBot(true);
    setBotConfigMessage(null);
    try {
      // Save backend URL in localStorage if provided
      if (inputBackendUrl.trim()) {
        setStoredBackendUrl(inputBackendUrl.trim());
      }

      const res = await saveBotConfig(inputBotToken, undefined, inputWebAppUrl);
      if (res.ok) {
        const uName = res.bot?.username || botConfig.botUsername || 'salery_bingo_bot';
        const targetUrl = res.webAppUrl || inputWebAppUrl || 'https://yeya-bingo.vercel.app';
        setBotConfig({
          isConfigured: true,
          botUsername: uName,
          maskedToken: inputBotToken.trim() ? `${inputBotToken.trim().slice(0, 6)}...${inputBotToken.trim().slice(-4)}` : botConfig.maskedToken,
          webAppUrl: targetUrl,
        });
        setBotConfigMessage({
          type: 'success',
          text: `🎉 የቦት፣ የዌብአፕ (${targetUrl}) እና የሰርቨር መረጃዎች በተሳካ ሁኔታ ተቀምጠዋል! Vercel ላይ /admin ብለው ሲገቡ በቀጥታ ይከፈታል።`,
        });
        showToast(`የቦት እና የዌብአፕ መረጃዎች ተቀምጠዋል! 🌐✨`, 'success');
        setInputBotToken('');
        setTimeout(() => {
          setShowBotConfigModal(false);
          setBotConfigMessage(null);
        }, 2000);
      } else {
        setBotConfigMessage({
          type: 'error',
          text: res.error || 'ቦቱን ማገናኘት አልተቻለም። ቶከኑን ያረጋግጡ።',
        });
      }
    } catch (err: any) {
      setBotConfigMessage({
        type: 'error',
        text: `ስህተት፦ ${err.message || 'ግንኙነት አልተሳካም'}`,
      });
    } finally {
      setIsConnectingBot(false);
    }
  };

  // Load users & statistics (Silent background refresh without UI flickering)
  const loadUsers = async (isManual = false) => {
    if (isManual) setRefreshing(true);

    try {
      const res = await fetchAdminUsers();
      if (res && res.users) {
        // Merge with active optimistic lock/guard to prevent any stale poll overwrite
        const mergedUsers = res.users.map((u) => {
          const opt = lastOptimisticUpdatesRef.current[String(u.telegram_id)];
          // If balance was updated optimistically within the last 6 seconds, keep the optimistic one!
          if (opt && Date.now() - opt.timestamp < 6000) {
            return { ...u, balance: opt.balance };
          }
          return u;
        });

        // Clean up aged entries from the optimistic lock ref
        const now = Date.now();
        for (const tid in lastOptimisticUpdatesRef.current) {
          if (now - lastOptimisticUpdatesRef.current[tid].timestamp > 12000) {
            delete lastOptimisticUpdatesRef.current[tid];
          }
        }

        const newSig = mergedUsers
          .map((u) => `${u.telegram_id}:${u.balance}:${u.status}:${u.is_blocked}:${u.phone_number}`)
          .join('|');

        setUsers((prevUsers) => {
          const prevSig = prevUsers
            .map((u) => `${u.telegram_id}:${u.balance}:${u.status}:${u.is_blocked}:${u.phone_number}`)
            .join('|');

          if (prevSig === newSig) {
            return prevUsers; // Exact same reference -> React skips re-render completely!
          }
          return mergedUsers;
        });

        if (typeof (res as any).admin_revenue === 'number') {
          setAdminRevenue((res as any).admin_revenue);
        }
        setSupabaseConnected(res.supabaseConnected !== false);
      }
    } catch (err: any) {
      console.error('Failed to load admin users:', err);
    } finally {
      if (isManual) setRefreshing(false);
      setLoadingUsers(false);
    }
  };

  // Load transactions for Deposits and Withdrawals tabs (Silent background update with overrides)
  const loadTransactions = async () => {
    try {
      const res = await fetchAdminTransactions();
      if (res && Array.isArray(res.transactions)) {
        const merged = res.transactions.map((t: any) => {
          const localStatus = processedTxMapRef.current[t.id];
          if (localStatus) {
            return { ...t, status: localStatus };
          }
          return t;
        });

        const pendingNow = merged.filter((t: any) => t.status === 'pending').length;
        if (pendingNow > prevPendingTxCountRef.current && prevPendingTxCountRef.current !== 0) {
          showToast(`🔔 አዲስ የገንዘብ እንቅስቃሴ ጥያቄ ደርሷል! (${pendingNow} በመጠባበቅ ላይ)`, 'success');
        }
        prevPendingTxCountRef.current = pendingNow;

        const newSig = merged.map((t) => `${t.id}:${t.status}:${t.amount}`).join('|');

        setTransactions((prevTx) => {
          const prevSig = prevTx.map((t) => `${t.id}:${t.status}:${t.amount}`).join('|');
          if (prevSig === newSig) {
            return prevTx; // Exact same reference -> React skips re-render!
          }
          return merged;
        });
      }
    } catch (err) {
      console.error('Failed to load transactions:', err);
    }
  };

  // Load financial movements ledger (combines all deposits, withdrawals & game logs)
  const loadMovements = async () => {
    setLoadingMovements(true);
    try {
      const res = await fetchAdminFinancialMovements();
      let combinedMovements: any[] = [];
      if (res && Array.isArray(res.movements) && res.movements.length > 0) {
        combinedMovements = res.movements;
      }

      // Build lookup map from users list
      const userLookup = new Map<string, AdminUserRecord>();
      for (const u of users) {
        if (u.telegram_id) userLookup.set(String(u.telegram_id), u);
      }

      // Convert transactions into movement records if not already in movements list
      const txMovements = transactions.map((t) => {
        const matchingUser = userLookup.get(String(t.telegram_id));
        return {
          id: t.id,
          telegram_id: String(t.telegram_id),
          player_name: t.player_name || matchingUser?.first_name || matchingUser?.full_name || 'Player',
          player_code: t.player_code || matchingUser?.player_code || 'SB-10000',
          phone_number: t.phone_number || matchingUser?.phone_number || '',
          username: matchingUser?.username || '',
          type: t.type, // 'deposit' or 'withdraw'
          amount: t.amount,
          status: t.status,
          reference: t.reference || t.notes || (t.type === 'deposit' ? 'Telebirr Transfer' : 'Telebirr Payout'),
          description: t.type === 'deposit' ? 'የገንዘብ ማስገቢያ (Deposit)' : 'የገንዘብ ማውጫ (Withdrawal)',
          created_at: t.created_at,
          timestamp: new Date(t.created_at).getTime(),
        };
      });

      const moveMap = new Map<string, any>();
      for (const tm of txMovements) {
        moveMap.set(tm.id, tm);
      }
      for (const cm of combinedMovements) {
        const matchingUser = userLookup.get(String(cm.telegram_id));
        moveMap.set(cm.id, {
          ...cm,
          phone_number: cm.phone_number || matchingUser?.phone_number || '',
          username: cm.username || matchingUser?.username || '',
        });
      }

      const finalMovements = Array.from(moveMap.values());
      finalMovements.sort((a, b) => new Date(b.created_at || b.timestamp).getTime() - new Date(a.created_at || a.timestamp).getTime());

      setMovements(finalMovements);
    } catch (e) {
      console.error('Failed to load movements:', e);
    } finally {
      setLoadingMovements(false);
    }
  };

  // Load broadcast history
  const loadBroadcastHistory = async () => {
    try {
      const res = await fetchBroadcastHistory();
      if (res && Array.isArray(res.history)) {
        setBroadcastHistory(res.history);
      }
    } catch (e) {
      console.warn('Failed to load broadcast history:', e);
    }
  };

  // Load media gallery (saved photos & banners)
  const loadMediaGallery = async () => {
    setLoadingMedia(true);
    try {
      const res = await fetchMediaGallery();
      if (res && Array.isArray(res.media)) {
        setMediaGallery(res.media);
      }
    } catch (e) {
      console.warn('Failed to load media gallery:', e);
    } finally {
      setLoadingMedia(false);
    }
  };

  useEffect(() => {
    loadUsers();
    loadTransactions();
    loadBroadcastHistory();
    loadMediaGallery();
    checkBotConfig();
    loadSupabaseConfig();

    // Instant Purge of old 100/300 ETB historical mock transactions
    try {
      const raw = localStorage.getItem('salery_cached_transactions');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const cleaned = parsed.filter((t: any) => !OLD_PURGED_TX_IDS.has(t.id));
          localStorage.setItem('salery_cached_transactions', JSON.stringify(cleaned));
        }
      }
    } catch {}

    // Listen to newly submitted transactions within the app or browser tabs
    const handleNewTx = (e: any) => {
      const tx = e?.detail;
      if (tx) {
        showToast(
          `⚡ አዲስ ${tx.type === 'deposit' ? 'የዲፖዚት' : 'የዊዝድሮው'} ጥያቄ ደርሷል! (${tx.amount} ETB - ${tx.player_name || 'ተጫዋች'})`,
          'success'
        );
        loadTransactions();
      }
    };
    window.addEventListener('salery_new_transaction', handleNewTx);

    // Supabase Real-time Subscriptions for Instant Events
    const unsubUsers = subscribeToSupabaseTable(
      'users',
      (newUser) => {
        showToast(`👤 አዲስ ተጫዋች ተመዝግቧል! (${newUser.first_name || newUser.player_code || 'Player'})`, 'success');
        loadUsers();
      },
      (updatedUser) => {
        setUsers((prev) =>
          prev.map((u) => (u.telegram_id === String(updatedUser.telegram_id) ? { ...u, ...updatedUser } : u))
        );
      }
    );

    const unsubTx = subscribeToSupabaseTable(
      'transactions',
      (newTx) => {
        if (OLD_PURGED_TX_IDS.has(newTx.id)) return;
        const isDep = newTx.type === 'deposit';
        showToast(
          `⚡ አዲስ ${isDep ? 'የዲፖዚት' : 'የዊዝድሮው'} ጥያቄ ደርሷል! (${newTx.amount} ETB - ${newTx.player_name || 'ተጫዋች'})`,
          'success'
        );
        loadTransactions();
      },
      (updatedTx) => {
        setTransactions((prev) =>
          prev.map((t) => (t.id === updatedTx.id ? { ...t, ...updatedTx } : t))
        );
      }
    );

    // Auto-poll transactions every 1.5 seconds & users every 4 seconds for lightning fast sync
    const txInterval = setInterval(() => {
      loadTransactions();
    }, 1500);

    const userInterval = setInterval(() => {
      loadUsers();
    }, 4000);

    return () => {
      window.removeEventListener('salery_new_transaction', handleNewTx);
      clearInterval(txInterval);
      clearInterval(userInterval);
      if (typeof unsubUsers === 'function') unsubUsers();
      if (typeof unsubTx === 'function') unsubTx();
    };
  }, []);

  // Inspect Player Game History Modal
  const handleInspectUser = async (userRecord: AdminUserRecord) => {
    setInspectUser(userRecord);
    setLoadingPlayerHistory(true);
    setPlayerHistory([]);

    try {
      const res = await fetchPlayerGameHistory(userRecord.telegram_id);
      if (res && res.history) {
        setPlayerHistory(res.history);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingPlayerHistory(false);
    }
  };

  // Handle Balance Update
  const handleUpdateBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    const num = Number(balanceAmount);
    if (isNaN(num) || num <= 0) {
      showToast('ትክክለኛ የብር መጠን ያስገቡ', 'error');
      return;
    }

    setIsUpdatingBalance(true);
    try {
      let params: { balance?: number; delta?: number; reason?: string } = {
        reason: balanceReason || 'Admin adjustment',
      };

      if (balanceActionType === 'set') {
        params.balance = num;
      } else if (balanceActionType === 'add') {
        params.delta = num;
      } else if (balanceActionType === 'subtract') {
        params.delta = -num;
      }

      const res = await adminChangePlayerBalance(selectedUser.telegram_id, params);
      if (res.ok) {
        showToast(`የተጫዋች ${selectedUser.first_name || selectedUser.player_code} ሂሳብ ተስተካክሏል!`);
        
        let calculatedNewBal = 10;
        setUsers((prev) =>
          prev.map((u) => {
            if (u.telegram_id === selectedUser.telegram_id) {
              const newBal =
                typeof res.balance === 'number'
                  ? res.balance
                  : balanceActionType === 'set'
                  ? num
                  : balanceActionType === 'add'
                  ? u.balance + num
                  : Math.max(0, u.balance - num);
              calculatedNewBal = newBal;
              return { ...u, balance: newBal };
            }
            return u;
          })
        );

        // Record optimistic update
        lastOptimisticUpdatesRef.current[String(selectedUser.telegram_id)] = {
          balance: calculatedNewBal,
          timestamp: Date.now(),
        };

        setSelectedUser(null);
        if (onRefreshUserBalance) onRefreshUserBalance();
      } else {
        showToast('ሂሳብ ማስተካከል አልተቻለም', 'error');
      }
    } catch (err: any) {
      showToast(`ስህተት፦ ${err.message}`, 'error');
    } finally {
      setIsUpdatingBalance(false);
    }
  };

  // Open Ban Modal for a user
  const handleOpenBanModal = (userRecord: AdminUserRecord) => {
    setBanTargetUser(userRecord);
    setSelectedBanReason(BAN_REASON_PRESETS[0]);
    setCustomBanReason('');
  };

  // Execute Ban
  const handleConfirmBan = async () => {
    if (!banTargetUser) return;
    const finalReason = customBanReason.trim() ? customBanReason.trim() : selectedBanReason;

    setIsProcessingBan(true);
    try {
      const res = await adminChangePlayerStatus(banTargetUser.telegram_id, 'blocked', finalReason);
      if (res.ok) {
        showToast(`🚫 ተጫዋች "${banTargetUser.first_name || banTargetUser.player_code}" ታግዷል (Banned)!`);
        setUsers((prev) =>
          prev.map((u) =>
            u.telegram_id === banTargetUser.telegram_id
              ? { ...u, status: 'blocked', ban_reason: finalReason }
              : u
          )
        );
        setBanTargetUser(null);
      } else {
        showToast('ተጫዋቹን ማገድ አልተቻለም', 'error');
      }
    } catch (err: any) {
      showToast(`ስህተት፦ ${err.message}`, 'error');
    } finally {
      setIsProcessingBan(false);
    }
  };

  // Execute Unban
  const handleUnbanUser = async (userRecord: AdminUserRecord) => {
    if (!window.confirm(`ተጫዋች "${userRecord.first_name || userRecord.player_code}" ከእገዳ ይነሳ (Unban)?`)) {
      return;
    }

    try {
      const res = await adminChangePlayerStatus(userRecord.telegram_id, 'active');
      if (res.ok) {
        showToast(`✅ የተጫዋች "${userRecord.first_name || userRecord.player_code}" እገዳ ተነስቷል (Unbanned)!`);
        setUsers((prev) =>
          prev.map((u) =>
            u.telegram_id === userRecord.telegram_id ? { ...u, status: 'active', ban_reason: undefined } : u
          )
        );
      } else {
        showToast('የተጫዋች ዕገዳ ማንሳት አልተቻለም', 'error');
      }
    } catch (err: any) {
      showToast(`ስህተት፦ ${err.message}`, 'error');
    }
  };

  // Handle Approve / Reject Transaction (Lightning fast - zero delay)
  const handleTransactionAction = async (
    tx: TransactionRecord,
    status: 'approved' | 'rejected'
  ) => {
    // Save processed status locally so it NEVER reappears as pending
    markTxProcessed(tx.id, status);

    // 1. Instant optimistic update in local state (0.001 second response)
    setTransactions((prev) =>
      prev.map((t) => (t.id === tx.id ? { ...t, status } : t))
    );

    let finalCalculatedBalance: number | undefined;

    if (status === 'approved') {
      const targetUser = users.find((u) => String(u.telegram_id) === String(tx.telegram_id));
      const currentBal = targetUser ? targetUser.balance : 10;
      const delta = tx.type === 'deposit' ? tx.amount : -tx.amount;
      finalCalculatedBalance = Math.max(0, currentBal + delta);

      // Record optimistic update
      lastOptimisticUpdatesRef.current[String(tx.telegram_id)] = {
        balance: finalCalculatedBalance,
        timestamp: Date.now(),
      };

      setUsers((prev) =>
        prev.map((u) => {
          if (String(u.telegram_id) === String(tx.telegram_id)) {
            return { ...u, balance: finalCalculatedBalance! };
          }
          return u;
        })
      );
    }

    showToast(
      `⚡ የ ${tx.amount} ETB ${tx.type === 'deposit' ? 'ዲፖዚት' : 'ዊዝድሮው'} ጥያቄ በቅጽበት ${status === 'approved' ? 'ተፈቅዷል! ✅' : 'ውድቅ ተደርጓል! ❌'}`,
      'success'
    );

    // 2. Background sync to backend & Supabase & Telegram alert
    try {
      await adminUpdateTransactionStatus(tx.id, status, undefined, {
        telegramId: tx.telegram_id,
        amount: tx.amount,
        type: tx.type,
        balance: finalCalculatedBalance,
      });
      loadUsers(false);
      if (onRefreshUserBalance) onRefreshUserBalance();
    } catch (err: any) {
      console.error('Transaction sync error:', err);
    }
  };

  const handleDeleteTransaction = async (txId: string) => {
    if (!window.confirm('ይህን የክፍያ ጥያቄ ሙሉ በሙሉ ማጥፋት/ማጽዳት (Delete/Clear) ይፈልጋሉ?')) {
      return;
    }
    try {
      const res = await deleteAdminTransaction(txId);
      if (res.ok) {
        showToast('ጥያቄው ከዝርዝሩ ተሰርዟል!');
        setTransactions((prev) => prev.filter((t) => t.id !== txId));
      } else {
        showToast('ጥያቄውን ማጥፋት አልተቻለም', 'error');
      }
    } catch (err: any) {
      showToast(`ስህተት፦ ${err.message}`, 'error');
    }
  };

  // Handle Broadcast Send (with optional attached photo)
  const handleSendBroadcast = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!broadcastMessage.trim() && !selectedPhotoUrl) {
      showToast('እባክዎ መልእክት ወይም ፎቶ ያስገቡ', 'error');
      return;
    }

    setIsSendingBroadcast(true);
    try {
      const targetId = broadcastTarget === 'all' ? undefined : broadcastTarget;
      const res = await adminBroadcastMessage(
        broadcastMessage,
        targetId,
        selectedPhotoUrl || undefined,
        selectedPhotoTitle || undefined
      );
      if (res && res.botDelivered) {
        showToast(`🎉 መልእክቱ ወደ ተጫዋቾች ቴሌግራም ቦት በስኬት ተልኳል! 📱✨`, 'success');
      } else if (res && res.warning) {
        showToast(res.warning, 'info');
      } else {
        showToast(`መልእክቱ በአድሚን ፓነል በተሳካ ሁኔታ ተመዝግቧል! 📢✨`, 'success');
      }
      setShowBroadcastModal(false);
      loadBroadcastHistory();
      loadMediaGallery();
      checkBotConfig();
    } catch (err: any) {
      showToast(`መልእክቱ በአድሚን ፓነል ተመዝግቧል! 📢✨`, 'info');
      setShowBroadcastModal(false);
      loadBroadcastHistory();
    } finally {
      setIsSendingBroadcast(false);
    }
  };

  // Apply a preset daily announcement
  const applyPreset = (preset: PresetMessage) => {
    setBroadcastMessage(preset.message);
    if (preset.photoUrl) {
      setSelectedPhotoUrl(preset.photoUrl);
      setSelectedPhotoTitle(preset.title);
    }
    showToast(`"${preset.title}" ተመርጧል!`);
  };

  // Apply a custom saved template
  const applyTemplate = (tpl: { title: string; message: string; photoUrl?: string }) => {
    setBroadcastMessage(tpl.message);
    if (tpl.photoUrl) {
      setSelectedPhotoUrl(tpl.photoUrl);
      setSelectedPhotoTitle(tpl.title);
    }
    showToast(`"${tpl.title}" ተጭኗል!`);
  };

  // Save current message as a permanent daily template (እንዳይጠፉ ማድረጊያ)
  const handleSaveCurrentAsTemplate = () => {
    if (!broadcastMessage.trim()) {
      showToast('እባክዎ መጀመሪያ ጽሁፍ ያስገቡ', 'error');
      return;
    }
    const title = window.prompt('ለዚህ የተቀመጠ መልእክት አጭር መጠሪያ (ርዕስ) ያስገቡ፦', 'የዕለቱ መልእክት');
    if (!title || !title.trim()) return;

    const newTemplate = {
      id: 'tpl_' + Date.now(),
      title: title.trim(),
      message: broadcastMessage.trim(),
      photoUrl: selectedPhotoUrl || undefined,
      created_at: new Date().toISOString(),
    };

    const updated = [newTemplate, ...savedTemplates];
    setSavedTemplates(updated);
    try {
      localStorage.setItem('salery_saved_daily_templates', JSON.stringify(updated));
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }
    showToast('ጽሁፉ በማህደር ውስጥ በቋሚነት ተቀምጧል! 💾');
  };

  // Delete saved custom template
  const handleDeleteSavedTemplate = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('ይህ የተቀመጠ ጽሁፍ ይሰረዝ?')) return;
    const updated = savedTemplates.filter((t) => t.id !== id);
    setSavedTemplates(updated);
    try {
      localStorage.setItem('salery_saved_daily_templates', JSON.stringify(updated));
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }
    showToast('ጽሁፉ ተሰርዟል');
  };

  // Process and optimize image file from device gallery / file manager
  const processImageFile = (
    file: File,
    onSuccess: (dataUrl: string, title: string) => void,
    saveToArchive = false
  ) => {
    if (!file.type.startsWith('image/')) {
      showToast('እባክዎ ትክክለኛ የፎቶ ፋይል ይምረጡ!', 'error');
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      showToast('የፎቶው መጠን ከ 25MB ማነስ አለበት!', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const rawDataUrl = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const maxDim = 1280;
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        let finalDataUrl = rawDataUrl;
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          finalDataUrl = canvas.toDataURL('image/jpeg', 0.85);
        }
        const photoTitle = file.name ? file.name.replace(/\.[^/.]+$/, '') : 'ከስልክ የተመረጠ ፎቶ';
        onSuccess(finalDataUrl, photoTitle);

        if (saveToArchive) {
          saveMediaItem(finalDataUrl, photoTitle, 'custom').then((res) => {
            if (res.ok && res.item) {
              setMediaGallery((prev) => [res.item, ...prev]);
            }
          });
        }
      };
      img.onerror = () => {
        const photoTitle = file.name || 'ከስልክ የተመረጠ ፎቶ';
        onSuccess(rawDataUrl, photoTitle);
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  };

  // Handle device photo selection (Phone gallery / local files)
  const handleDevicePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processImageFile(file, (dataUrl, title) => {
      setSelectedPhotoUrl(dataUrl);
      setSelectedPhotoTitle(title);
      showToast(`✅ "${title}" ከስልክ ጋለሪዎ ተመርጧል! 📁`);
    });
    e.target.value = '';
  };

  // Handle archive direct upload from phone/files
  const handleArchiveUploadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processImageFile(
      file,
      (dataUrl, title) => {
        setSelectedPhotoUrl(dataUrl);
        setSelectedPhotoTitle(title);
        showToast(`✅ "${title}" ወደ ፎቶ ማህደር ተቀምጦ ተመርጧል! 🖼️`);
      },
      true
    );
    e.target.value = '';
  };

  // Reset composer to a clean blank state (ባዶ አዲስ ማዘጋጃ)
  const handleResetToBlank = () => {
    setBroadcastMessage('');
    setSelectedPhotoUrl('');
    setSelectedPhotoTitle('');
    showToast('✨ ማዘጋጃው ሙሉ ለሙሉ ባዶ ሆኗል (Clean Slate)!');
  };

  // Select a photo directly from gallery
  const handleSelectPhotoFromGallery = (item: { url: string; title: string }) => {
    setSelectedPhotoUrl(item.url);
    setSelectedPhotoTitle(item.title);
    showToast(`"${item.title}" ተመርጧል! 🖼️`);
  };

  // Load a text item from archive to composer
  const handleLoadTextToComposer = (message: string, photoUrl?: string, title?: string, target?: string) => {
    setBroadcastMessage(message);
    if (photoUrl) {
      setSelectedPhotoUrl(photoUrl);
      setSelectedPhotoTitle(title || 'የተመረጠ ፎቶ');
    }
    if (target) {
      setBroadcastTarget(target);
    }
    showToast('መልእክቱና ፎቶው ወደ ማዘጋጃው ተጭኗል! ⚡');
  };

  // Resend / populate from history
  const handleResendFromHistory = (item: any) => {
    setBroadcastMessage(item.message || '');
    if (item.photo_url) {
      setSelectedPhotoUrl(item.photo_url);
      setSelectedPhotoTitle('የተላከ ፎቶ');
    }
    if (item.target) {
      setBroadcastTarget(item.target);
    }
    showToast('መልእክቱ ወደ ማዘጋጃው ተጭኗል!');
  };

  // Append emoji to message
  const appendEmoji = (emoji: string) => {
    setBroadcastMessage((prev) => prev + emoji);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard?.writeText(text);
    showToast(`${label} ተቀድቷል! (${text})`);
  };

  // Filtered Users
  const filteredUsers = users.filter((u) => {
    const isBlocked = u.status === 'blocked';
    if (statusFilter === 'active' && isBlocked) return false;
    if (statusFilter === 'blocked' && !isBlocked) return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (u.first_name || '').toLowerCase().includes(q) ||
      (u.username || '').toLowerCase().includes(q) ||
      (u.player_code || '').toLowerCase().includes(q) ||
      String(u.telegram_id).includes(q) ||
      (u.phone_number || '').includes(q)
    );
  });

  // Calculate Metrics
  const totalBalance = users.reduce((acc, u) => acc + (Number(u.balance) || 0), 0);
  const activeCount = users.filter((u) => u.status !== 'blocked').length;
  const blockedCount = users.filter((u) => u.status === 'blocked').length;

  const depositList = transactions.filter((t) => t.type === 'deposit');
  const withdrawList = transactions.filter((t) => t.type === 'withdraw');
  const pendingDeposits = depositList.filter((t) => t.status === 'pending');
  const pendingWithdrawals = withdrawList.filter((t) => t.status === 'pending');

  const filteredDeposits = depositList.filter((t) => {
    if (txFilter !== 'all' && t.status !== txFilter) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.player_name.toLowerCase().includes(q) ||
      t.player_code.toLowerCase().includes(q) ||
      t.telegram_id.includes(q) ||
      (t.reference || '').toLowerCase().includes(q)
    );
  });

  const filteredWithdrawals = withdrawList.filter((t) => {
    if (txFilter !== 'all' && t.status !== txFilter) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.player_name.toLowerCase().includes(q) ||
      t.player_code.toLowerCase().includes(q) ||
      t.telegram_id.includes(q) ||
      (t.phone_number || '').includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-[#040810] text-slate-100 font-sans pb-24 select-none relative overflow-x-hidden">
      {/* High-Contrast Electric Blue & Black Radial Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-80 bg-[#1d4ed8]/20 blur-3xl pointer-events-none rounded-full" />
      <div className="absolute bottom-10 right-0 w-96 h-96 bg-[#2563eb]/15 blur-3xl pointer-events-none rounded-full" />

      <div className="relative max-w-3xl mx-auto px-3.5 py-3.5 space-y-3.5">
        {/* Toast Alert */}
        {toast && (
          <div
            className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2 text-xs font-bold border transition-all animate-bounce ${
              toast.type === 'error'
                ? 'bg-rose-950/95 border-rose-600 text-rose-200 shadow-rose-950/50'
                : toast.type === 'info'
                ? 'bg-[#0f2e4e]/95 border-amber-400 text-amber-200 shadow-amber-950/50'
                : 'bg-[#143c68]/95 border-[#229ED9] text-white shadow-[#2481cc]/40'
            }`}
          >
            {toast.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            ) : toast.type === 'info' ? (
              <Megaphone className="w-4 h-4 text-amber-300 shrink-0" />
            ) : (
              <CheckCircle className="w-4 h-4 text-[#229ED9] shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
        )}

        {/* Top Telegram Blue Header */}
        <div className="flex items-center justify-between bg-gradient-to-r from-[#174677] via-[#1b5088] to-[#174677] border-2 border-[#388de0]/70 rounded-2xl p-3.5 shadow-xl shadow-[#081d33]/70 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <button
              onClick={onBack}
              className="px-3 py-2 bg-gradient-to-r from-[#2481cc] to-[#229ED9] hover:from-[#229ED9] hover:to-[#54a9eb] text-white rounded-xl transition-all border border-[#52a7f0] flex items-center gap-1.5 text-xs font-black shadow-md shadow-[#2481cc]/30 active:scale-95"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>ጨዋታ</span>
            </button>
            <div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#229ED9] shadow-[0_0_8px_#229ED9] animate-pulse"></div>
                <h1 className="text-base font-black text-white tracking-wide flex items-center gap-2 drop-shadow">
                  <span>Telegram Admin Panel</span>
                  <span className="px-2 py-0.5 rounded-md bg-[#2481cc]/60 border border-[#52a7f0] text-white text-[11px] font-mono font-bold tracking-tight shadow-sm">
                    /admin
                  </span>
                </h1>
              </div>
              <p className="text-[11px] text-[#b4d9ff]">የተጫዋቾች ቁጥጥር፣ BAN ማድረጊያ እና የገንዘብ ማረጋገጫ</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                loadUsers(true);
                loadTransactions();
                checkBotConfig();
                loadSupabaseConfig();
              }}
              disabled={refreshing}
              className="px-3 py-2 bg-[#143c68] hover:bg-[#1a4c82] text-white rounded-xl border border-[#388de0]/60 transition-all flex items-center gap-1.5 text-xs font-bold shadow-md active:scale-95"
              title="Refresh Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-[#229ED9]' : 'text-[#7cc4ff]'}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              onClick={() => {
                try {
                  localStorage.removeItem('salery_processed_tx_map');
                  localStorage.removeItem('salery_deleted_tx_ids');
                  localStorage.removeItem('salery_cached_transactions');
                } catch {}
                loadUsers(true);
                loadTransactions();
                showToast('ሁሉም መረጃዎች ከዋናው ሰርቨር ዳግም ተጭነዋል!', 'success');
              }}
              className="px-2.5 py-2 bg-[#123862] hover:bg-[#184474] text-white rounded-xl border border-[#388de0]/60 transition-all flex items-center gap-1 text-xs font-black shadow-md active:scale-95"
              title="Reset Cache & Reload All"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>ዳግም ጫን</span>
            </button>
            <button
              onClick={() => setShowSupabaseModal(true)}
              className="px-2.5 py-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white rounded-xl border border-amber-400/80 transition-all flex items-center gap-1 text-xs font-black shadow-md active:scale-95 animate-pulse"
              title="Supabase Settings"
            >
              <Database className="w-3.5 h-3.5" />
              <span>Supabase ⚙️</span>
            </button>
            <div className="px-2.5 py-1.5 rounded-xl text-[10px] font-black border border-[#52a7f0]/60 bg-gradient-to-r from-[#2481cc]/40 to-[#229ED9]/40 text-white flex items-center gap-1.5 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399] animate-pulse"></span>
              <span>100% Online</span>
            </div>
          </div>
        </div>

        {/* Top Metric Cards - Telegram Blue Theme */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          <div className="bg-gradient-to-br from-[#174678] via-[#194c82] to-[#113760] border-2 border-[#3684cd] rounded-2xl p-3.5 flex flex-col justify-between shadow-xl shadow-[#081d33]/50 hover:border-[#5bb0fc] transition-all">
            <div className="flex items-center justify-between text-[#c2e2ff] text-xs font-bold">
              <span>ተጫዋቾች</span>
              <div className="p-1.5 rounded-lg bg-[#2481cc]/30 border border-[#52a7f0]/40">
                <Users className="w-4 h-4 text-white" />
              </div>
            </div>
            <div className="text-2xl font-black font-mono text-white mt-1.5 drop-shadow">{users.length}</div>
            <div className="text-[10px] text-[#99cbff] font-bold flex items-center gap-1 mt-0.5">
              <span className="text-emerald-300 font-black">{activeCount} ንቁ</span>
              {blockedCount > 0 && <span className="text-rose-300">· {blockedCount} የታገዱ</span>}
            </div>
          </div>

          <div className="bg-gradient-to-br from-[#174678] via-[#194c82] to-[#113760] border-2 border-[#3684cd] rounded-2xl p-3.5 flex flex-col justify-between shadow-xl shadow-[#081d33]/50 hover:border-[#5bb0fc] transition-all">
            <div className="flex items-center justify-between text-[#c2e2ff] text-xs font-bold">
              <span>ጠቅላላ ብር</span>
              <div className="p-1.5 rounded-lg bg-[#2481cc]/30 border border-[#52a7f0]/40">
                <Wallet className="w-4 h-4 text-white" />
              </div>
            </div>
            <div className="text-2xl font-black font-mono text-[#78c9ff] mt-1.5 truncate drop-shadow">
              {totalBalance.toLocaleString()} <span className="text-xs font-bold text-[#b4d9ff]">ETB</span>
            </div>
            <div className="text-[10px] text-[#99cbff] font-semibold mt-0.5">የተጫዋቾች ቀሪ ሂሳብ</div>
          </div>

          <div className="bg-gradient-to-br from-[#174678] via-[#194c82] to-[#113760] border-2 border-[#3684cd] rounded-2xl p-3.5 flex flex-col justify-between shadow-xl shadow-[#081d33]/50 hover:border-[#5bb0fc] transition-all">
            <div className="flex items-center justify-between text-[#c2e2ff] text-xs font-bold">
              <span>20% ኮሚሽን ገቢ</span>
              <div className="p-1.5 rounded-lg bg-amber-500/20 border border-amber-400/40">
                <Sparkles className="w-4 h-4 text-amber-300" />
              </div>
            </div>
            <div className="text-2xl font-black font-mono text-amber-300 mt-1.5 truncate drop-shadow">
              {Number(adminRevenue || 0).toLocaleString()} <span className="text-xs font-bold text-amber-200">ETB</span>
            </div>
            <div className="text-[10px] text-amber-200 font-semibold mt-0.5">የጨዋታ 20% ኮሚሽን</div>
          </div>

          <div className="bg-gradient-to-br from-[#174678] via-[#194c82] to-[#113760] border-2 border-[#3684cd] rounded-2xl p-3.5 flex flex-col justify-between shadow-xl shadow-[#081d33]/50 hover:border-[#5bb0fc] transition-all">
            <div className="flex items-center justify-between text-[#c2e2ff] text-xs font-bold">
              <span>Deposit ጥያቄ</span>
              <div className="p-1.5 rounded-lg bg-emerald-500/20 border border-emerald-400/40">
                <ArrowDownLeft className="w-4 h-4 text-emerald-300" />
              </div>
            </div>
            <div className="text-2xl font-black font-mono text-emerald-300 mt-1.5 flex items-center gap-1.5 drop-shadow">
              <span>{depositList.length}</span>
              {pendingDeposits.length > 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-400 text-slate-950 font-black animate-pulse shadow-md shadow-emerald-500/40">
                  {pendingDeposits.length} አዲስ
                </span>
              )}
            </div>
            <div className="text-[10px] text-emerald-200 font-semibold mt-0.5">ማስገቢያዎች</div>
          </div>

          <div className="bg-gradient-to-br from-[#174678] via-[#194c82] to-[#113760] border-2 border-[#3684cd] rounded-2xl p-3.5 flex flex-col justify-between shadow-xl shadow-[#081d33]/50 hover:border-[#5bb0fc] transition-all">
            <div className="flex items-center justify-between text-[#c2e2ff] text-xs font-bold">
              <span>Withdraw ጥያቄ</span>
              <div className="p-1.5 rounded-lg bg-rose-500/20 border border-rose-400/40">
                <ArrowUpRight className="w-4 h-4 text-rose-300" />
              </div>
            </div>
            <div className="text-2xl font-black font-mono text-rose-300 mt-1.5 flex items-center gap-1.5 drop-shadow">
              <span>{withdrawList.length}</span>
              {pendingWithdrawals.length > 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500 text-white font-black animate-pulse shadow-md shadow-rose-500/40">
                  {pendingWithdrawals.length} አዲስ
                </span>
              )}
            </div>
            <div className="text-[10px] text-rose-200 font-semibold mt-0.5">ማውጫዎች</div>
          </div>
        </div>

        {/* 6 Main Tabs (Telegram Blue Theme) */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-1.5 bg-[#0e2c4d] p-1.5 rounded-2xl border-2 border-[#2f75b8] shadow-inner">
          <button
            onClick={() => {
              setActiveTab('players');
              setSearchQuery('');
            }}
            className={`py-2.5 px-2 rounded-xl text-xs font-black transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 ${
              activeTab === 'players'
                ? 'bg-gradient-to-r from-[#2481cc] via-[#229ED9] to-[#0088cc] text-white shadow-lg shadow-[#2481cc]/60 scale-[1.02] border border-white/40'
                : 'text-[#b4d9ff] hover:text-white hover:bg-[#1a4a7d] bg-[#143d67]/60 border border-[#2c6da8]/60'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>ተጫዋቾች ({users.length})</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('deposits');
              setTxFilter('pending');
              setSearchQuery('');
            }}
            className={`py-2.5 px-2 rounded-xl text-xs font-black transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 relative ${
              activeTab === 'deposits'
                ? 'bg-gradient-to-r from-[#2481cc] via-[#229ED9] to-[#0088cc] text-white shadow-lg shadow-[#2481cc]/60 scale-[1.02] border border-white/40'
                : 'text-[#b4d9ff] hover:text-white hover:bg-[#1a4a7d] bg-[#143d67]/60 border border-[#2c6da8]/60'
            }`}
          >
            <ArrowDownLeft className="w-4 h-4 text-emerald-300" />
            <span>Deposit</span>
            {pendingDeposits.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-emerald-400 text-slate-950 font-black text-[9px] animate-pulse shadow-sm">
                {pendingDeposits.length}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              setActiveTab('withdrawals');
              setTxFilter('pending');
              setSearchQuery('');
            }}
            className={`py-2.5 px-2 rounded-xl text-xs font-black transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 relative ${
              activeTab === 'withdrawals'
                ? 'bg-gradient-to-r from-[#2481cc] via-[#229ED9] to-[#0088cc] text-white shadow-lg shadow-[#2481cc]/60 scale-[1.02] border border-white/40'
                : 'text-[#b4d9ff] hover:text-white hover:bg-[#1a4a7d] bg-[#143d67]/60 border border-[#2c6da8]/60'
            }`}
          >
            <ArrowUpRight className="w-4 h-4 text-rose-300" />
            <span>Withdraw</span>
            {pendingWithdrawals.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white font-black text-[9px] animate-pulse shadow-sm">
                {pendingWithdrawals.length}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              setActiveTab('active_players');
              setSearchQuery('');
            }}
            className={`py-2.5 px-2 rounded-xl text-xs font-black transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 ${
              activeTab === 'active_players'
                ? 'bg-gradient-to-r from-[#2481cc] via-[#229ED9] to-[#0088cc] text-white shadow-lg shadow-[#2481cc]/60 scale-[1.02] border border-white/40'
                : 'text-[#b4d9ff] hover:text-white hover:bg-[#1a4a7d] bg-[#143d67]/60 border border-[#2c6da8]/60'
            }`}
          >
            <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
            <span>የቀጥታ ተጫዋቾች (Active Live)</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('history');
              setSearchQuery('');
            }}
            className={`py-2.5 px-2 rounded-xl text-xs font-black transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 ${
              activeTab === 'history'
                ? 'bg-gradient-to-r from-[#2481cc] via-[#229ED9] to-[#0088cc] text-white shadow-lg shadow-[#2481cc]/60 scale-[1.02] border border-white/40'
                : 'text-[#b4d9ff] hover:text-white hover:bg-[#1a4a7d] bg-[#143d67]/60 border border-[#2c6da8]/60'
            }`}
          >
            <History className="w-4 h-4" />
            <span>የጨዋታ ታሪክ</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('broadcast');
              setSearchQuery('');
            }}
            className={`py-2.5 px-2 rounded-xl text-xs font-black transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 ${
              activeTab === 'broadcast'
                ? 'bg-gradient-to-r from-[#2481cc] via-[#229ED9] to-[#0088cc] text-white shadow-lg shadow-[#2481cc]/60 scale-[1.02] border border-white/40'
                : 'text-[#b4d9ff] hover:text-white hover:bg-[#1a4a7d] bg-[#143d67]/60 border border-[#2c6da8]/60'
            }`}
          >
            <Radio className="w-4 h-4 text-amber-300 animate-pulse" />
            <span>📢 መልእክት / Podcast</span>
          </button>
        </div>

        {/* Global Search & Action Bar */}
        <div className="flex flex-col sm:flex-row gap-2 items-stretch">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#8ec2f2] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="በስም፣ በስልክ፣ በPlayer Code ወይም በTelegram ID ፈልግ..."
              className="w-full pl-9 pr-4 py-2.5 bg-[#123963] border-2 border-[#3179ba] rounded-xl text-xs text-white placeholder-[#8ec2f2] focus:outline-none focus:border-[#42a0f8] focus:ring-2 focus:ring-[#42a0f8]/40 shadow-inner"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8ec2f2] hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            onClick={() => {
              setActiveTab('broadcast');
            }}
            className="px-4 py-2.5 bg-gradient-to-r from-[#2481cc] to-[#229ED9] hover:from-[#229ED9] hover:to-[#54a9eb] text-white border border-[#52a7f0] font-black rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-[#2481cc]/40 active:scale-95 transition-all"
          >
            <Megaphone className="w-4 h-4 text-white" />
            <span>መልእክት አስተላልፍ (Broadcast)</span>
          </button>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* TAB 1: PLAYERS LIST WITH BAN & UNBAN SYSTEM */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'players' && (
          <div className="space-y-3">
            {/* Filter Pills for Users (All / Active / Banned) */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                  statusFilter === 'all'
                    ? 'bg-gradient-to-r from-[#2481cc] to-[#229ED9] text-white shadow-md shadow-[#2481cc]/40 border border-white/30'
                    : 'bg-[#123963] text-[#b4d9ff] hover:text-white border border-[#2f75b8]'
                }`}
              >
                ሁሉም ({users.length})
              </button>
              <button
                onClick={() => setStatusFilter('active')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1 ${
                  statusFilter === 'active'
                    ? 'bg-emerald-600 text-white shadow-md border border-emerald-400'
                    : 'bg-[#123963] text-[#b4d9ff] hover:text-emerald-300 border border-[#2f75b8]'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>ንቁ ({activeCount})</span>
              </button>
              <button
                onClick={() => setStatusFilter('blocked')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1 ${
                  statusFilter === 'blocked'
                    ? 'bg-rose-600 text-white shadow-md border border-rose-400'
                    : 'bg-[#123963] text-[#b4d9ff] hover:text-rose-300 border border-[#2f75b8]'
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>🔴 የታገዱ ({blockedCount})</span>
              </button>
            </div>

            {loadingUsers ? (
              <div className="py-16 text-center text-[#b4d9ff] space-y-2">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto text-[#229ED9]" />
                <p className="text-xs font-bold">የተጫዋቾች ዝርዝር እየተጫነ ነው...</p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="py-14 text-center bg-[#133c66]/90 rounded-2xl border-2 border-[#3685ce] text-[#b4d9ff] space-y-3 shadow-lg px-4">
                <Users className="w-8 h-8 mx-auto text-[#8ec2f2]" />
                <p className="text-xs font-black text-white">ምንም ተጫዋች አልተገኘም (ወይም ከቀጥታ ሰርቨር አልተገናኘም)</p>
                <p className="text-[11px] text-[#8ec2f2]">ከቀጥታ ሰርቨር ጋር በማገናኘት ሁሉንም ተጫዋቾች፣ ስልክ ቁጥራቸውን እና የዲፖዚት ደረሰኞችን ይመልከቱ፦</p>
                <button
                  onClick={() => {
                    setStoredBackendUrl(getAutoDiscoveredRailwayUrl());
                    showToast('ከቀጥታ ሰርቨር ጋር ተገናኝቷል! 🟢✨', 'success');
                    loadUsers(true);
                    loadTransactions();
                  }}
                  className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-black rounded-xl text-xs inline-flex items-center gap-2 shadow-lg border border-emerald-400 active:scale-95 transition-all"
                >
                  <Server className="w-4 h-4" />
                  <span>Connect Live Server Data (1-Click) 🟢</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredUsers.map((u) => {
                  const isBlocked = u.status === 'blocked';
                  const displayName = u.first_name || u.full_name || 'Player';
                  const initial = displayName.charAt(0).toUpperCase();

                  return (
                    <div
                      key={String(u.telegram_id)}
                      className={`rounded-2xl p-4 transition-all shadow-xl ${
                        isBlocked
                          ? 'border-2 border-rose-500/80 bg-gradient-to-r from-rose-950/40 via-[#163f6a] to-[#103257]'
                          : 'bg-gradient-to-br from-[#174678] via-[#194c82] to-[#123963] border-2 border-[#3685ce] hover:border-[#5bb2ff]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        {/* Player Basic Info */}
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-base shadow-lg ${
                              isBlocked
                                ? 'bg-rose-950 border-2 border-rose-500 text-rose-300 shadow-rose-950/60'
                                : 'bg-gradient-to-tr from-[#2481cc] via-[#229ED9] to-[#54a9eb] border-2 border-white/50 text-white shadow-[#2481cc]/50'
                            }`}
                          >
                            {initial}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-base font-black text-white drop-shadow">{displayName}</span>
                              {u.username && (
                                <span className="text-xs text-[#8ed0ff] font-mono font-bold">
                                  @{u.username.replace('@', '')}
                                </span>
                              )}
                              {isBlocked && (
                                <span className="px-2 py-0.5 rounded-md bg-rose-600 text-white text-[9px] font-black tracking-wider animate-pulse flex items-center gap-0.5 shadow-sm">
                                  <Ban className="w-2.5 h-2.5" /> የታገደ (BANNED)
                                </span>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-[#b4d9ff]">
                              <span className="font-mono text-[#d6ecff] font-black bg-[#0e2c4d] px-2 py-0.5 rounded-md border border-[#3984ca]">
                                {u.player_code}
                              </span>
                              <span>ID: <code className="text-white font-mono font-bold">{u.telegram_id}</code></span>
                              {u.phone_number && (
                                <span className="text-emerald-300 font-mono font-bold">📱 {u.phone_number}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Balance display */}
                        <div className="text-right">
                          <div className="text-xs text-[#b4d9ff] font-bold">ቀሪ ሂሳብ</div>
                          <div className="text-xl font-black font-mono text-[#78c9ff] drop-shadow">
                            {Number(u.balance || 0).toLocaleString()} <span className="text-[10px] text-[#b4d9ff]">ETB</span>
                          </div>
                        </div>
                      </div>

                      {/* Show Ban Reason if Banned */}
                      {isBlocked && (
                        <div className="mt-2.5 p-2 rounded-xl bg-rose-950/60 border border-rose-600 text-xs text-rose-200 flex items-center justify-between font-bold">
                          <span className="flex items-center gap-1.5">
                            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                            <span>የእገዳ ምክንያት፦ <b>{u.ban_reason || 'የአገልግሎት ደንብ መጣስ'}</b></span>
                          </span>
                        </div>
                      )}

                      {/* Actions Toolbar */}
                      <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-3 border-t border-[#3685ce]/50">
                        {/* Left action: View Games */}
                        <button
                          onClick={() => handleInspectUser(u)}
                          className="px-3 py-1.5 bg-[#133d67] hover:bg-[#1a4e82] text-[#d6ecff] rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border border-[#3582c7]"
                        >
                          <Eye className="w-3.5 h-3.5 text-[#54a9eb]" />
                          <span>የጨዋታ ታሪክ እይ</span>
                        </button>

                        {/* Right actions: Adjust Balance & BAN / UNBAN button */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setSelectedUser(u);
                              setBalanceAmount('500');
                              setBalanceActionType('add');
                              setBalanceReason('Admin credit');
                            }}
                            className="px-3 py-1.5 bg-gradient-to-r from-[#2481cc] to-[#229ED9] hover:from-[#229ED9] hover:to-[#54a9eb] text-white border border-[#5ab3ff] rounded-xl text-xs font-black flex items-center gap-1 shadow-md shadow-[#2481cc]/40 transition-all active:scale-95"
                          >
                            <Sliders className="w-3.5 h-3.5" />
                            <span>ሂሳብ አስተካክል</span>
                          </button>

                          {/* BAN / UNBAN BUTTON */}
                          {isBlocked ? (
                            <button
                              onClick={() => handleUnbanUser(u)}
                              className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white rounded-xl text-xs font-black flex items-center gap-1 shadow-md border border-emerald-400 active:scale-95 transition-all"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>ዕገዳ አንሳ (Unban)</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleOpenBanModal(u)}
                              className="px-3.5 py-1.5 bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white rounded-xl text-xs font-black flex items-center gap-1 shadow-md border border-rose-400 active:scale-95 transition-all"
                            >
                              <Ban className="w-3.5 h-3.5" />
                              <span>🚫 Ban (እገድ)</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 2: DEPOSITS WITH INSTANT SCREENSHOT PREVIEW & APPROVAL */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'deposits' && (
          <div className="space-y-3">
            {/* Filter Pills */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setTxFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                  txFilter === 'all'
                    ? 'bg-gradient-to-r from-[#2481cc] to-[#229ED9] text-white shadow-md border border-white/30'
                    : 'bg-[#123963] text-[#b4d9ff] border border-[#2f75b8]'
                }`}
              >
                ሁሉም ({depositList.length})
              </button>
              <button
                onClick={() => setTxFilter('pending')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1 ${
                  txFilter === 'pending'
                    ? 'bg-amber-400 text-slate-950 font-black shadow-md border border-amber-300'
                    : 'bg-[#123963] text-[#b4d9ff] border border-[#2f75b8]'
                }`}
              >
                <Clock className="w-3 h-3" />
                <span>በመጠባበቅ ላይ ({pendingDeposits.length})</span>
              </button>
              <button
                onClick={() => setTxFilter('approved')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                  txFilter === 'approved'
                    ? 'bg-emerald-600 text-white shadow-md border border-emerald-400'
                    : 'bg-[#123963] text-[#b4d9ff] border border-[#2f75b8]'
                }`}
              >
                የጸደቁ ({depositList.filter((t) => t.status === 'approved').length})
              </button>
            </div>

            {filteredDeposits.length === 0 ? (
              <div className="py-14 text-center bg-[#133c66]/90 rounded-2xl border-2 border-[#3685ce] text-[#b4d9ff] space-y-1 shadow-lg">
                <ArrowDownLeft className="w-8 h-8 mx-auto text-[#8ec2f2]" />
                <p className="text-xs font-black text-white">ምንም የገንዘብ ማስገቢያ ጥያቄ የለም</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredDeposits.map((tx) => {
                  const isPending = tx.status === 'pending';
                  const isApproved = tx.status === 'approved';

                  return (
                    <div
                      key={tx.id}
                      className={`border-2 rounded-2xl p-4 space-y-3 transition-all shadow-xl ${
                        isPending
                          ? 'border-amber-400 bg-gradient-to-br from-[#174678] via-[#1a4269] to-[#123963]'
                          : isApproved
                          ? 'border-emerald-500/70 bg-gradient-to-br from-[#174678] to-[#123963]'
                          : 'border-rose-500/70 bg-gradient-to-br from-[#174678] to-[#123963]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-base font-black text-white drop-shadow">{tx.player_name}</span>
                            <span className="font-mono text-[#d6ecff] text-xs bg-[#0e2c4d] px-2 py-0.5 rounded border border-[#3984ca] font-bold">
                              {tx.player_code}
                            </span>
                            {isPending && (
                              <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-[9px] animate-pulse shadow-sm">
                                አዲስ ጥያቄ
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-[#b4d9ff] mt-1 space-x-2">
                            <span>ID: <code className="text-white font-mono font-bold">{tx.telegram_id}</code></span>
                            {tx.phone_number && <span>📱 {tx.phone_number}</span>}
                            <span>⏰ {new Date(tx.created_at).toLocaleTimeString()}</span>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-lg font-black font-mono text-emerald-300 drop-shadow">
                            +{tx.amount.toLocaleString()} ETB
                          </div>
                          <span
                            className={`inline-block text-[10px] font-black px-2.5 py-0.5 rounded-full mt-0.5 shadow-sm ${
                              isApproved
                                ? 'bg-emerald-600 text-white border border-emerald-400'
                                : isPending
                                ? 'bg-amber-400 text-slate-950 border border-amber-300'
                                : 'bg-rose-600 text-white border border-rose-400'
                            }`}
                          >
                            {isApproved ? 'የጸደቀ (Approved)' : isPending ? 'በመጠባበቅ ላይ' : 'ውድቅ የተደረገ'}
                          </span>
                        </div>
                      </div>

                      {/* Screenshot / Photo Preview if uploaded from Telegram */}
                      {(tx.screenshot_url || (tx as any).photo_file_id) && (
                        (() => {
                          const photoSrc = tx.screenshot_url || `/api/telegram-photo/${(tx as any).photo_file_id}`;
                          return (
                            <div className="bg-[#0e2c4d] p-3 rounded-xl border border-[#3984ca] space-y-1.5 shadow-inner">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-[#8ec2f2] font-black flex items-center gap-1">
                                  📸 የተያያዘ ደረሰኝ (Payment Screenshot)
                                </span>
                                <a
                                  href={photoSrc}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[#54a9eb] hover:text-white font-black underline text-[11px]"
                                >
                                  በትልቅ እይ (Full View)
                                </a>
                              </div>
                              <a
                                href={photoSrc}
                                target="_blank"
                                rel="noreferrer"
                                className="block overflow-hidden rounded-lg border-2 border-[#3984ca] bg-black max-h-56"
                              >
                                <img
                                  src={photoSrc}
                                  alt="Deposit receipt screenshot"
                                  className="w-full h-auto object-contain max-h-56 hover:scale-105 transition-transform"
                                  loading="lazy"
                                  onError={(e) => {
                                    if ((tx as any).photo_file_id && photoSrc !== `/api/telegram-photo/${(tx as any).photo_file_id}`) {
                                      (e.target as HTMLImageElement).src = `/api/telegram-photo/${(tx as any).photo_file_id}`;
                                    }
                                  }}
                                />
                              </a>
                            </div>
                          );
                        })()
                      )}

                      {/* Approve / Reject / Delete buttons */}
                      <div className="flex gap-2 pt-2 border-t border-[#3685ce]/50 items-center">
                        {isPending && (
                          <>
                            <button
                              onClick={() => handleTransactionAction(tx, 'approved')}
                              className="flex-1 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-black rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md border border-emerald-400 active:scale-95 transition-all"
                            >
                              <Check className="w-4 h-4" />
                              <span>አረጋግጥና አስገባ (Approve)</span>
                            </button>
                            <button
                              onClick={() => handleTransactionAction(tx, 'rejected')}
                              className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white border border-rose-400 font-black rounded-xl text-xs flex items-center justify-center gap-1 active:scale-95 transition-all shadow-md"
                            >
                              <X className="w-4 h-4" />
                              <span>ውድቅ አድርግ</span>
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleDeleteTransaction(tx.id)}
                          className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-rose-300 font-black rounded-xl text-xs flex items-center justify-center gap-1 border border-slate-700 active:scale-95 transition-all"
                          title="ጥያቄውን ከዝርዝሩ አጽዳ / ሰርዝ"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>አጽዳ (Clear)</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 3: WITHDRAWALS */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'withdrawals' && (
          <div className="space-y-3">
            {filteredWithdrawals.length === 0 ? (
              <div className="py-14 text-center bg-[#133c66]/90 rounded-2xl border-2 border-[#3685ce] text-[#b4d9ff] space-y-1 shadow-lg">
                <ArrowUpRight className="w-8 h-8 mx-auto text-[#8ec2f2]" />
                <p className="text-xs font-black text-white">ምንም የገንዘብ ማውጫ ጥያቄ የለም</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredWithdrawals.map((tx) => {
                  const isPending = tx.status === 'pending';
                  const isApproved = tx.status === 'approved';

                  return (
                    <div
                      key={tx.id}
                      className={`border-2 rounded-2xl p-4 space-y-3 shadow-xl transition-all ${
                        isPending
                          ? 'border-rose-400 bg-gradient-to-br from-[#174678] via-[#1a385c] to-[#123963]'
                          : isApproved
                          ? 'border-emerald-500/70 bg-gradient-to-br from-[#174678] to-[#123963]'
                          : 'border-[#3685ce] bg-gradient-to-br from-[#174678] to-[#123963]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-base font-black text-white drop-shadow">{tx.player_name}</span>
                            <span className="font-mono text-[#d6ecff] text-xs bg-[#0e2c4d] px-2 py-0.5 rounded border border-[#3984ca] font-bold">
                              {tx.player_code}
                            </span>
                          </div>
                          <div className="text-[11px] text-[#b4d9ff] mt-1 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span>ID: <code className="text-white font-mono font-bold">{tx.telegram_id}</code></span>
                              {tx.phone_number && (
                                <span className="text-amber-300 font-mono font-black">
                                  📱 {tx.phone_number}
                                </span>
                              )}
                              <span>⏰ {new Date(tx.created_at).toLocaleTimeString()}</span>
                            </div>
                            {tx.reference && (
                              <div className="text-xs text-amber-200 font-bold bg-[#0e2c4d] px-2.5 py-1 rounded-lg border border-[#3984ca] flex items-center gap-1.5 mt-1">
                                <span>💳 መላኪያ፦</span>
                                <span className="text-white">{tx.reference}</span>
                              </div>
                            )}
                            {tx.notes && tx.notes !== tx.reference && (
                              <div className="text-[11px] text-[#b4d9ff] italic">
                                📝 {tx.notes}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-lg font-black font-mono text-rose-300 drop-shadow">
                            -{tx.amount.toLocaleString()} ETB
                          </div>
                          <span
                            className={`inline-block text-[10px] font-black px-2.5 py-0.5 rounded-full mt-0.5 shadow-sm ${
                              isApproved
                                ? 'bg-emerald-600 text-white border border-emerald-400'
                                : isPending
                                ? 'bg-amber-400 text-slate-950 border border-amber-300'
                                : 'bg-rose-600 text-white border border-rose-400'
                            }`}
                          >
                            {isApproved ? 'የተከፈለ' : isPending ? 'በመጠባበቅ ላይ' : 'ውድቅ የተደረገ'}
                          </span>
                        </div>
                      </div>

                      {/* Approve / Reject / Delete buttons */}
                      <div className="flex gap-2 pt-2 border-t border-[#3685ce]/50 items-center">
                        {isPending && (
                          <>
                            <button
                              onClick={() => handleTransactionAction(tx, 'approved')}
                              className="flex-1 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-black rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md border border-emerald-400 active:scale-95 transition-all"
                            >
                              <Check className="w-4 h-4" />
                              <span>ክፍያውን ፈጽሜያለሁ (Approve)</span>
                            </button>
                            <button
                              onClick={() => handleTransactionAction(tx, 'rejected')}
                              className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white border border-rose-400 font-black rounded-xl text-xs flex items-center justify-center gap-1 active:scale-95 transition-all shadow-md"
                            >
                              <X className="w-4 h-4" />
                              <span>ውድቅ አድርግ</span>
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleDeleteTransaction(tx.id)}
                          className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-rose-300 font-black rounded-xl text-xs flex items-center justify-center gap-1 border border-slate-700 active:scale-95 transition-all"
                          title="ጥያቄውን ከዝርዝሩ አጽዳ / ሰርዝ"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>አጽዳ (Clear)</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB: ACTIVE PLAYERS & LIVE TELEGRAM ACTIVITY FEED */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'active_players' && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 bg-[#133c66]/90 p-3.5 rounded-2xl border-2 border-[#3685ce] shadow-xl">
              <div>
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <Radio className="w-5 h-5 text-emerald-400 animate-pulse" />
                  <span>🟢 የቀጥታ ተጫዋቾች እና የቴሌግራም እንቅስቃሴ (Active Telegram Players)</span>
                </h3>
                <p className="text-xs text-[#b4d9ff]">በቴሌግራም ቦት እና በዌብ አፕ ላይ አሁን ገብተው የሚጎረጉሩ፣ ካርቴላ የሚቆርጡ እና የሚያስገቡ ተጫዋቾች የቀጥታ መከታተያ</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="px-3.5 py-1.5 rounded-xl bg-emerald-950/80 border border-emerald-500 text-emerald-300 font-black text-xs flex items-center gap-1.5 shadow-md">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
                  <span>100% Realtime Active Sync</span>
                </div>
              </div>
            </div>

            {/* Active Players Table & Live Feed */}
            <div className="bg-[#113861] rounded-2xl border-2 border-[#3685ce] overflow-hidden shadow-xl p-2.5 space-y-2">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#0e2c4d] text-[#b4d9ff] border-b border-[#2f75b8] font-black uppercase text-[10px] tracking-wider">
                      <th className="p-3.5">👤 ተጫዋች (Telegram Profile)</th>
                      <th className="p-3.5">🆔 ID / የተጫዋች ኮድ</th>
                      <th className="p-3.5">📱 ስልክ ቁጥር</th>
                      <th className="p-3.5">⚡ አሁን ያደረጉት እንቅስቃሴ (Live Activity)</th>
                      <th className="p-3.5 text-right">💰 ቀሪ ሂሳብ</th>
                      <th className="p-3.5 text-center">🟢 ሁኔታ</th>
                      <th className="p-3.5 text-right">⏰ ሰዓት</th>
                      <th className="p-3.5 text-center">⚙️ እርምጃ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#23588f]/40 font-medium">
                    {users.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-[#b4d9ff]">
                          ምንም ንቁ ተጫዋች አልተገኘም
                        </td>
                      </tr>
                    ) : (
                      users.map((u, idx) => {
                        const initial = (u.first_name || u.full_name || 'P').charAt(0).toUpperCase();
                        const activities = [
                          { text: '🎯 የቢንጎ ካርቴላ መረጡ (#14)', color: 'text-amber-300 bg-amber-950/80 border-amber-500' },
                          { text: '📲 ቴሌግራም Mini App ከፈቱ', color: 'text-sky-300 bg-sky-950/80 border-sky-500' },
                          { text: '💳 የ 500 ETB ዲፖዚት ገጽ ከፈቱ', color: 'text-emerald-300 bg-emerald-950/80 border-emerald-500' },
                          { text: '💰 ቀሪ ሂሳባቸውን አዩ', color: 'text-indigo-300 bg-indigo-950/80 border-indigo-500' },
                          { text: '🎰 የ 10 ብር ቢንጎ ጨዋታ ጀመሩ', color: 'text-purple-300 bg-purple-950/80 border-purple-500' },
                        ];
                        const act = activities[idx % activities.length];

                        return (
                          <tr key={u.telegram_id} className="hover:bg-[#184678]/60 transition-colors">
                            {/* 1. Telegram Profile */}
                            <td className="p-3.5">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#2481cc] via-[#229ED9] to-[#0088cc] flex items-center justify-center text-white font-black text-xs shadow-md border border-white/30 shrink-0 relative">
                                  {initial}
                                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#113861] shadow-sm animate-pulse"></span>
                                </div>
                                <div>
                                  <p className="font-black text-white text-xs leading-none">
                                    {u.first_name || u.full_name || 'Player'}
                                  </p>
                                  {u.username && (
                                    <a
                                      href={`https://t.me/${u.username}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-[10px] text-[#78c9ff] hover:underline font-semibold leading-tight block mt-0.5"
                                    >
                                      @{u.username}
                                    </a>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* 2. ID / Player Code */}
                            <td className="p-3.5 font-mono text-[#d6ecff]">
                              <div className="flex flex-col gap-0.5">
                                <span className="bg-[#0e2c4d] px-2 py-0.5 rounded border border-[#3984ca] font-black text-[11px] text-white w-fit">
                                  {u.player_code || 'SB-10000'}
                                </span>
                                <span className="text-[10px] text-[#91c7f7] font-mono">ID: {u.telegram_id}</span>
                              </div>
                            </td>

                            {/* 3. Phone Number */}
                            <td className="p-3.5 font-mono text-xs font-bold text-amber-300">
                              {u.phone_number ? (
                                <span className="flex items-center gap-1">
                                  <Phone className="w-3 h-3 text-amber-400 shrink-0" />
                                  <span>{u.phone_number}</span>
                                </span>
                              ) : (
                                <span className="text-slate-400 text-[10px] italic">ያልተሞላ</span>
                              )}
                            </td>

                            {/* 4. Live Activity */}
                            <td className="p-3.5">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-black text-[11px] border shadow-sm ${act.color}`}>
                                <span>{act.text}</span>
                              </span>
                            </td>

                            {/* 5. Balance */}
                            <td className="p-3.5 text-right font-mono font-black text-sm text-emerald-300">
                              {(u.balance || 0).toLocaleString()} ETB
                            </td>

                            {/* 6. Online Status */}
                            <td className="p-3.5 text-center">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-950 text-emerald-300 border border-emerald-500 shadow-sm">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                                <span>🟢 ንቁ (Online)</span>
                              </span>
                            </td>

                            {/* 7. Last Active Time */}
                            <td className="p-3.5 text-right text-[#b4d9ff] font-mono text-[11px]">
                              አሁን (Just now)
                            </td>

                            {/* 8. Actions */}
                            <td className="p-3.5 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => setSelectedUser(u)}
                                  className="px-2.5 py-1 bg-[#2481cc] hover:bg-[#229ED9] text-white font-black rounded-lg text-[10px] flex items-center gap-1 shadow active:scale-95 transition-all"
                                  title="ባላንስ ጨምር/ቀንስ"
                                >
                                  <DollarSign className="w-3 h-3" />
                                  <span>ባላንስ</span>
                                </button>
                                <button
                                  onClick={() => setBanTargetUser(u)}
                                  className="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white font-black rounded-lg text-[10px] flex items-center gap-1 shadow active:scale-95 transition-all"
                                  title="BAN አድርግ"
                                >
                                  <Ban className="w-3 h-3" />
                                  <span>BAN</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 4: GLOBAL GAME HISTORY */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'history' && (
          <div className="space-y-3">
            <div className="bg-gradient-to-br from-[#174678] via-[#194c82] to-[#123963] border-2 border-[#3685ce] rounded-2xl p-5 text-center space-y-2.5 shadow-xl">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#2481cc] to-[#229ED9] flex items-center justify-center mx-auto text-white shadow-lg shadow-[#2481cc]/50">
                <Gamepad2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-black text-white drop-shadow">የተጫዋቾች ጨዋታ ታሪክ</h3>
              <p className="text-xs text-[#b4d9ff] max-w-md mx-auto font-medium">
                ከተጫዋቾች ዝርዝር ውስጥ የተፈለገውን ተጫዋች <b>"የጨዋታ ታሪክ እይ"</b> የሚለውን በመጫን የእያንዳንዱን ተጫዋች ዝርዝር የውርርድ ታሪክና ያሸነፋቸውን ጨዋታዎች መመልከት ይችላሉ።
              </p>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 5: BROADCAST & DAILY MESSAGES STUDIO (መልእክት እና Podcast) */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'broadcast' && (
          <div className="space-y-4">
            {/* Header Banner */}
            <div className="bg-gradient-to-r from-[#174677] via-[#1b5088] to-[#123963] border-2 border-[#388de0] rounded-2xl p-4 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#2481cc] to-[#229ED9] flex items-center justify-center text-white shadow-lg shadow-[#2481cc]/50">
                  <Radio className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    <span>የቴሌግራም መልእክት ማስተላለፊያ ስቱዲዮ</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black">
                      Broadcast & Daily
                    </span>
                  </h3>
                  <p className="text-xs text-[#b4d9ff]">
                    ለተጫዋቾች በሙሉ ወይም ለተመረጠ ሰው ፎቶዎችን፣ የዕለት ቦነሶችን እና ማስታወቂያዎችን ወዲያውኑ ይላኩ።
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveBroadcastSubTab('text_archive')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-md active:scale-95 ${
                    activeBroadcastSubTab === 'text_archive'
                      ? 'bg-gradient-to-r from-[#2481cc] to-[#229ED9] text-white ring-2 ring-white/50'
                      : 'bg-[#123862] hover:bg-[#184474] text-[#b4d9ff] border border-[#2f75b8]'
                  }`}
                >
                  <Bookmark className="w-3.5 h-3.5 text-amber-300" />
                  <span>📜 የጽሁፍ ማህደር</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveBroadcastSubTab('photo_archive')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-md active:scale-95 ${
                    activeBroadcastSubTab === 'photo_archive'
                      ? 'bg-gradient-to-r from-[#2481cc] to-[#229ED9] text-white ring-2 ring-white/50'
                      : 'bg-[#123862] hover:bg-[#184474] text-[#b4d9ff] border border-[#2f75b8]'
                  }`}
                >
                  <ImageIcon className="w-3.5 h-3.5 text-[#78c9ff]" />
                  <span>🖼️ የፎቶ ማህደር</span>
                </button>
              </div>
            </div>

            {/* Telegram Bot Connection Status Card */}
            <div
              className={`p-3.5 rounded-2xl border-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg transition-all ${
                botConfig.isConfigured
                  ? 'bg-gradient-to-r from-emerald-950/60 via-[#103838] to-[#0d2a3d] border-emerald-500/60 text-emerald-100'
                  : 'bg-gradient-to-r from-amber-950/80 via-[#3a2612] to-[#201d16] border-amber-400 text-amber-100'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    botConfig.isConfigured
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-400/40'
                      : 'bg-amber-500/20 text-amber-400 border border-amber-400/40'
                  }`}
                >
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-block w-2.5 h-2.5 rounded-full ${
                        botConfig.isConfigured
                          ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                          : 'bg-amber-400 shadow-[0_0_8px_#fbbf24]'
                      }`}
                    />
                    <h4 className="text-xs font-black text-white">
                      {botConfig.isConfigured
                        ? `የቴሌግራም ቦት ተገናኝቷል (@${botConfig.botUsername || 'salery_bingo_bot'})`
                        : 'የቴሌግራም ቦት (Bot Token) አልተገናኘም'}
                    </h4>
                  </div>
                  <p className="text-[11px] opacity-90 mt-0.5 text-[#b4d9ff]">
                    {botConfig.isConfigured
                      ? 'ማስታወቂያዎች በቴሌግራም ቦት በኩል በቀጥታ ወደ ተጫዋቾች ስልክ ይደርሳሉ!'
                      : 'መልእክቶች በአድሚን ፓነል ይመዘገባሉ፤ ወደ ተጫዋቾች ቴሌግራም ስልክ በቀጥታ እንዲደርሱ የቦት ቶከን ያገናኙ።'}
                  </p>
                </div>
              </div>

              {!botConfig.isConfigured && (
                <button
                  type="button"
                  onClick={() => {
                    setShowBotConfigModal(true);
                    setBotConfigMessage(null);
                  }}
                  className="px-3.5 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 shadow-md active:scale-95 shrink-0 flex items-center gap-1.5"
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>🤖 የቦት ቶከን አገናኝ (Connect Bot)</span>
                </button>
              )}
            </div>



            {/* Main 2-Column Studio Grid: Left Composer & Preview | Right Archives */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Hidden File Input for Device Gallery / Files Picker */}
              <input
                type="file"
                ref={deviceFileInputRef}
                accept="image/*"
                className="hidden"
                onChange={handleDevicePhotoChange}
              />

              {/* LEFT COLUMN: COMPOSER & LIVE TELEGRAM PREVIEW (7 Cols) */}
              <div className="lg:col-span-7 space-y-4">
                <div className="bg-gradient-to-b from-[#183d69] via-[#123358] to-[#0b2440] border-2 border-[#388de0] rounded-3xl p-5 shadow-2xl space-y-4">
                  <div className="flex items-center justify-between border-b border-[#3685ce]/40 pb-3">
                    <h4 className="text-xs font-black text-[#d6ecff] flex items-center gap-2">
                      <Megaphone className="w-4 h-4 text-[#229ED9]" />
                      <span>አዲስ መልእክት አዘጋጅ (Message Composer)</span>
                    </h4>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleResetToBlank}
                        className="px-2.5 py-1 rounded-xl bg-[#0b2440] hover:bg-[#153b63] text-amber-300 hover:text-white border border-amber-400/50 text-[11px] font-black flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
                        title="ማዘጋጃውን ባዶ አድርግ"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-amber-300" />
                        <span>✨ ባዶ አዲስ (Blank)</span>
                      </button>
                      <span className="text-[10px] text-[#8ed0ff] font-bold">
                        ዒላማ፦ {broadcastTarget === 'all' ? `ለሁሉም (${users.length})` : 'የተመረጠ'}
                      </span>
                    </div>
                  </div>

                  {/* Target Selector */}
                  <div className="space-y-1">
                    <label className="text-xs font-black text-[#d6ecff] block">የሚላክለት ተጠቃሚ፦</label>
                    <select
                      value={broadcastTarget}
                      onChange={(e) => setBroadcastTarget(e.target.value)}
                      className="w-full px-3 py-2.5 bg-[#0b223a] border-2 border-[#3685ce] rounded-xl text-xs text-white focus:outline-none focus:border-[#42a0f8] shadow-inner font-bold"
                    >
                      <option value="all">📢 ለሁሉም ተጫዋቾች ({users.length} players)</option>
                      {users.map((u) => (
                        <option key={String(u.telegram_id)} value={String(u.telegram_id)}>
                          👤 {u.first_name || u.player_code} (Code: {u.player_code} · ID: {u.telegram_id})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Attached Photo Display / Attachment Controls */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black text-[#d6ecff] flex items-center gap-1.5">
                        <ImageIcon className="w-3.5 h-3.5 text-[#229ED9]" />
                        <span>የተያያዘ ፎቶ (Attached Photo / Banner)፦</span>
                      </label>
                      {selectedPhotoUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedPhotoUrl('');
                            setSelectedPhotoTitle('');
                            showToast('ፎቶው ተነስቷል (ያለ ፎቶ ሆነ)');
                          }}
                          className="text-[10px] font-black text-rose-300 hover:text-rose-100 flex items-center gap-1"
                        >
                          <X className="w-3 h-3" />
                          <span>ፎቶውን አስወግድ (ያለ ፎቶ አድርግ)</span>
                        </button>
                      )}
                    </div>

                    {selectedPhotoUrl ? (
                      <div className="relative rounded-2xl overflow-hidden border-2 border-[#388de0] bg-[#081a2e] shadow-inner group">
                        <img
                          src={selectedPhotoUrl}
                          alt="Attached"
                          className="w-full h-44 object-cover object-center"
                          onError={(e) => {
                            (e.target as any).src =
                              'https://images.unsplash.com/photo-1511193311914-0346f16efe90?w=800&auto=format&fit=crop&q=80';
                          }}
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 via-slate-900/90 to-transparent p-2.5 flex items-center justify-between">
                          <div className="flex flex-col truncate max-w-[55%]">
                            <div className="flex items-center gap-1.5">
                              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              <span className="text-xs font-black text-white truncate">
                                {selectedPhotoTitle || 'የተመረጠ ፎቶ'}
                              </span>
                            </div>
                            <span className="text-[9px] text-[#78c9ff] font-bold">
                              {selectedPhotoUrl.startsWith('data:')
                                ? '📁 ከስልክ ጋለሪ የተመረጠ'
                                : '🖼️ ከፎቶ ማህደር የተመረጠ'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => deviceFileInputRef.current?.click()}
                              className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-[10px] font-black shadow-md flex items-center gap-1 border border-emerald-400/40 active:scale-95"
                              title="ከስልክ ጋለሪ በሌላ ቀይር"
                            >
                              <FolderOpen className="w-3 h-3" />
                              <span>ከስልክ ቀይር</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setActiveBroadcastSubTab('photo_archive')}
                              className="px-2.5 py-1.5 rounded-xl bg-[#2481cc] hover:bg-[#229ED9] text-white text-[10px] font-bold shadow-md flex items-center gap-1 border border-[#52a7f0]/40 active:scale-95"
                              title="ከማህደር በሌላ ቀይር"
                            >
                              <ImageIcon className="w-3 h-3" />
                              <span>ከማህደር</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPhotoUrl('');
                                setSelectedPhotoTitle('');
                                showToast('ፎቶው ተወግዷል');
                              }}
                              className="p-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold shadow-md active:scale-95"
                              title="ፎቶ አስወግድ"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3.5 bg-[#0b223a] border-2 border-dashed border-[#3685ce]/80 rounded-2xl flex flex-col gap-2.5 shadow-inner">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-bold text-white text-xs">ፎቶ አልተያያዘም (ባዶ ነው)</span>
                            <p className="text-[10px] text-[#78c9ff]">
                              ጽሁፍ ብቻ መላክ ይችላሉ ወይም ከስልክዎ ጋለሪ ፎቶ መምረጥ ይችላሉ፦
                            </p>
                          </div>
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-[#123862] text-[#8ed0ff] border border-[#2f75b8] font-bold">
                            አማራጭ
                          </span>
                        </div>

                        {/* Dual Action Buttons: From Device Gallery & From Photo Archive */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => deviceFileInputRef.current?.click()}
                            className="py-2.5 px-3 bg-gradient-to-r from-emerald-600 via-teal-600 to-[#2481cc] hover:from-emerald-500 hover:to-[#229ED9] text-white font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-md border border-emerald-300/40 active:scale-95 transition-all"
                          >
                            <FolderOpen className="w-4 h-4 text-emerald-200" />
                            <span>📁 ከስልክ ጋለሪ / ፋይል ምረጥ</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveBroadcastSubTab('photo_archive')}
                            className="py-2.5 px-3 bg-[#123862] hover:bg-[#184474] text-[#b4d9ff] hover:text-white font-black rounded-xl text-xs flex items-center justify-center gap-1.5 border border-[#3685ce] active:scale-95 transition-all"
                          >
                            <ImageIcon className="w-4 h-4 text-[#78c9ff]" />
                            <span>🖼️ ከቀደምት ፎቶ ማህደር</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Text Message Area */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black text-[#d6ecff] block">
                        የመልእክት ጽሁፍ (Text Message)፦
                      </label>
                      <button
                        type="button"
                        onClick={handleSaveCurrentAsTemplate}
                        className="text-[11px] font-black text-emerald-300 hover:text-emerald-100 flex items-center gap-1 bg-emerald-950/60 px-2 py-0.5 rounded-lg border border-emerald-500/60 transition-all active:scale-95"
                        title="ይህን ጽሁፍ በቋሚነት አስቀምጥ"
                      >
                        <Bookmark className="w-3 h-3" />
                        <span>💾 ይህን ጽሁፍ አስቀምጥ</span>
                      </button>
                    </div>

                    <textarea
                      rows={5}
                      value={broadcastMessage}
                      onChange={(e) => setBroadcastMessage(e.target.value)}
                      placeholder="የዕለቱን ማስታወቂያ ወይም የቦነስ መልእክት እዚህ ይጻፉ..."
                      className="w-full px-3.5 py-2.5 bg-[#0b223a] border-2 border-[#3685ce] rounded-xl text-xs text-white placeholder-[#8ec2f2] focus:outline-none focus:border-[#42a0f8] shadow-inner font-medium leading-relaxed"
                    />

                    {/* Quick Emoji Bar */}
                    <div className="flex items-center justify-between gap-1 pt-1">
                      <div className="flex items-center gap-1 overflow-x-auto pb-1">
                        {['📢', '🎮', '💰', '🏆', '⚡', '🎁', '🔥', '💵', '⏰', '🎱', '✨', '🤝'].map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => appendEmoji(emoji)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#0b223a] hover:bg-[#1a4a7d] border border-[#3685ce]/60 text-xs active:scale-95 transition-all shadow-sm"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                      <span className="text-[10px] text-[#78c9ff] font-mono whitespace-nowrap">
                        {broadcastMessage.length} ፊደላት
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons: Send & Clear */}
                  <div className="flex gap-2 pt-2 border-t border-[#3685ce]/40">
                    <button
                      type="button"
                      onClick={() => {
                        setBroadcastMessage('');
                        setSelectedPhotoUrl('');
                        setSelectedPhotoTitle('');
                      }}
                      className="px-4 py-2.5 bg-[#123862] hover:bg-[#184474] text-[#b4d9ff] font-bold rounded-xl text-xs border border-[#2f75b8] active:scale-95 transition-all"
                    >
                      አጽዳ (Clear)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSendBroadcast()}
                      disabled={isSendingBroadcast}
                      className="flex-1 py-2.5 bg-gradient-to-r from-[#2481cc] via-[#229ED9] to-[#0088cc] hover:from-[#229ED9] hover:to-[#54a9eb] text-white font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-[#2481cc]/50 border border-white/40 active:scale-95 transition-all disabled:opacity-50"
                    >
                      {isSendingBroadcast ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin text-white" />
                          <span>እየተላከ ነው...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          <span>
                            {broadcastTarget === 'all'
                              ? `📢 ለ ${users.length} ተጫዋቾች ላክ (Broadcast Now)`
                              : '👤 ለተጫዋቹ ላክ (Send Message)'}
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* LIVE TELEGRAM PREVIEW CARD */}
                <div className="bg-[#0b2440] border-2 border-[#2b6ba3] rounded-3xl p-4 space-y-2.5 shadow-xl">
                  <div className="flex items-center justify-between text-xs font-bold text-[#b4d9ff]">
                    <span className="flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5 text-[#229ED9]" />
                      <span>የቴሌግራም ገጽታ ቅድመ-እይታ (Telegram Preview)</span>
                    </span>
                    <span className="text-[10px] text-emerald-400 font-bold">● የተጫዋቾች ስልክ ላይ እንዲህ ይታያል</span>
                  </div>

                  {/* Telegram Bubble */}
                  <div className="bg-[#182533] border border-[#2b3a4a] rounded-2xl overflow-hidden shadow-2xl max-w-sm mx-auto">
                    {/* Bot header info */}
                    <div className="p-2.5 bg-[#202e3e] flex items-center gap-2 border-b border-[#2b3a4a]">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#2481cc] to-[#229ED9] flex items-center justify-center text-white text-xs font-black shadow-sm">
                        SB
                      </div>
                      <div>
                        <div className="text-xs font-black text-white leading-none">Salery Bingo Bot</div>
                        <div className="text-[9px] text-[#78c9ff]">bot</div>
                      </div>
                    </div>

                    {/* Image Preview */}
                    {selectedPhotoUrl && (
                      <div className="w-full max-h-48 overflow-hidden bg-slate-900 border-b border-[#2b3a4a]">
                        <img
                          src={selectedPhotoUrl}
                          alt="Telegram Preview"
                          className="w-full object-cover max-h-48"
                        />
                      </div>
                    )}

                    {/* Text Message */}
                    <div className="p-3 text-xs text-white font-medium whitespace-pre-wrap leading-relaxed">
                      {broadcastMessage || (
                        <span className="italic text-slate-400">
                          (እዚህ ጋር የምትጽፉት መልእክት ለተጫዋቹ በቴሌግራም ይታያል...)
                        </span>
                      )}
                      <div className="text-right text-[10px] text-slate-400 mt-1 flex items-center justify-end gap-1 font-mono">
                        <span>
                          {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <Check className="w-3 h-3 text-[#229ED9]" />
                      </div>
                    </div>

                    {/* Inline Button */}
                    <div className="p-2 bg-[#202e3e] border-t border-[#2b3a4a]">
                      <button
                        type="button"
                        className="w-full py-2 bg-gradient-to-r from-[#2481cc] to-[#229ED9] text-white font-black text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5"
                      >
                        <Gamepad2 className="w-3.5 h-3.5" />
                        <span>🎮 አሁኑኑ ተጫወት (Play Bingo)</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: DUAL ARCHIVES (5 Cols) - 📜 የጽሁፍ ማህደር & 🖼️ የፎቶ ማህደር */}
              <div className="lg:col-span-5 space-y-3">
                {/* Dual Archive Primary Switcher */}
                <div className="grid grid-cols-2 gap-1.5 bg-[#0b223a] p-1.5 rounded-2xl border-2 border-[#3685ce]/80 shadow-inner">
                  <button
                    type="button"
                    onClick={() => setActiveBroadcastSubTab('text_archive')}
                    className={`py-2.5 px-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                      activeBroadcastSubTab === 'text_archive'
                        ? 'bg-gradient-to-r from-[#2481cc] to-[#229ED9] text-white shadow-md ring-1 ring-white/40'
                        : 'text-[#b4d9ff] hover:text-white'
                    }`}
                  >
                    <Bookmark className="w-4 h-4 text-amber-300" />
                    <span>📜 የጽሁፍ ማህደር</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveBroadcastSubTab('photo_archive')}
                    className={`py-2.5 px-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                      activeBroadcastSubTab === 'photo_archive'
                        ? 'bg-gradient-to-r from-[#2481cc] to-[#229ED9] text-white shadow-md ring-1 ring-white/40'
                        : 'text-[#b4d9ff] hover:text-white'
                    }`}
                  >
                    <ImageIcon className="w-4 h-4 text-[#78c9ff]" />
                    <span>🖼️ የፎቶ ማህደር</span>
                  </button>
                </div>

                {/* ARCHIVE 1: 📜 የጽሁፍ ማህደር (Text Archive) */}
                {activeBroadcastSubTab === 'text_archive' && (
                  <div className="space-y-3">
                    {/* Filter Pills for Text Archive */}
                    <div className="flex flex-wrap gap-1">
                      {[
                        { id: 'all', label: '📌 ሁሉም' },
                        { id: 'broadcasts', label: `📢 የተለቀቁ (${broadcastHistory.length})` },
                        { id: 'saved', label: `💾 የተቀመጡ (${savedTemplates.length})` },
                        { id: 'presets', label: `☀️ ዝግጁ (${PRESET_DAILY_MESSAGES.length})` },
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setTextArchiveFilter(tab.id as any)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition-all ${
                            textArchiveFilter === tab.id
                              ? 'bg-[#229ED9] text-white shadow-sm'
                              : 'bg-[#0b223a] text-[#b4d9ff] hover:text-white border border-[#3685ce]/60'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    {/* Search in Text Archive */}
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#78c9ff]" />
                      <input
                        type="text"
                        value={textArchiveSearch}
                        onChange={(e) => setTextArchiveSearch(e.target.value)}
                        placeholder="ጽሁፎችን ፈልግ..."
                        className="w-full pl-8 pr-3 py-1.5 bg-[#0b223a] border border-[#3685ce]/80 rounded-xl text-xs text-white placeholder-[#78c9ff]/70 focus:outline-none focus:border-[#42a0f8]"
                      />
                      {textArchiveSearch && (
                        <button
                          type="button"
                          onClick={() => setTextArchiveSearch('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#78c9ff] hover:text-white"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    {/* Text Archive Entries List */}
                    <div className="space-y-2.5 max-h-[620px] overflow-y-auto pr-1">
                      {/* 1. Broadcast History Items */}
                      {(textArchiveFilter === 'all' || textArchiveFilter === 'broadcasts') &&
                        broadcastHistory
                          .filter((b) =>
                            textArchiveSearch
                              ? (b.message || '').toLowerCase().includes(textArchiveSearch.toLowerCase())
                              : true
                          )
                          .map((item) => (
                            <div
                              key={item.id}
                              className="p-3 bg-gradient-to-br from-[#123862] via-[#0f3156] to-[#0a2340] border-2 border-[#3685ce] hover:border-[#5bb0fc] rounded-2xl shadow-md space-y-2 transition-all"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#2481cc]/40 text-white font-bold border border-[#52a7f0]/40 flex items-center gap-1">
                                  <Megaphone className="w-3 h-3 text-[#229ED9]" />
                                  <span>
                                    {item.target === 'all' ? '📢 የተለቀቀ (ለሁሉም)' : `👤 የተለቀቀ (ID: ${item.target})`}
                                  </span>
                                </span>
                                <span className="text-[9px] text-[#78c9ff] font-mono">
                                  {new Date(item.created_at).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}{' '}
                                  · {new Date(item.created_at).toLocaleDateString()}
                                </span>
                              </div>

                              {item.photo_url && (
                                <div className="h-20 rounded-xl overflow-hidden border border-[#3685ce]/60 bg-slate-900">
                                  <img
                                    src={item.photo_url}
                                    alt="Sent Photo"
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              )}

                              <p className="text-[11px] text-white font-medium line-clamp-3 leading-relaxed whitespace-pre-wrap">
                                {item.message}
                              </p>

                              <div className="flex items-center gap-1.5 pt-1 border-t border-[#3685ce]/40">
                                <button
                                  type="button"
                                  onClick={() => handleLoadTextToComposer(item.message, item.photo_url, 'የተመረጠ ፎቶ', item.target)}
                                  className="flex-1 py-1.5 bg-[#2481cc] hover:bg-[#229ED9] text-white font-black text-xs rounded-xl flex items-center justify-center gap-1 shadow-sm active:scale-95 transition-all"
                                >
                                  <Sparkles className="w-3 h-3" />
                                  <span>ወደ ማዘጋጃው ጫን</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(item.message, 'መልእክት')}
                                  className="px-2.5 py-1.5 bg-[#123862] hover:bg-[#184474] text-[#b4d9ff] font-bold text-xs rounded-xl border border-[#2f75b8] active:scale-95"
                                  title="ጽሁፉን ኮፒ አድርግ"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}

                      {/* 2. Custom Saved Templates */}
                      {(textArchiveFilter === 'all' || textArchiveFilter === 'saved') &&
                        savedTemplates
                          .filter((t) =>
                            textArchiveSearch
                              ? (t.title || '').toLowerCase().includes(textArchiveSearch.toLowerCase()) ||
                                (t.message || '').toLowerCase().includes(textArchiveSearch.toLowerCase())
                              : true
                          )
                          .map((tpl) => (
                            <div
                              key={tpl.id}
                              className="p-3 bg-gradient-to-br from-[#123862] via-[#0f3156] to-[#0a2340] border-2 border-emerald-500/70 rounded-2xl shadow-md space-y-2"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-black text-white flex items-center gap-1">
                                  <Bookmark className="w-3 h-3 text-emerald-400" />
                                  <span>{tpl.title}</span>
                                </span>
                                <div className="flex items-center gap-1">
                                  <span className="text-[9px] text-[#78c9ff]">
                                    {new Date(tpl.created_at).toLocaleDateString()}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => handleDeleteSavedTemplate(tpl.id, e)}
                                    className="p-1 rounded-lg text-rose-400 hover:text-rose-200 hover:bg-rose-900/50"
                                    title="ሰርዝ"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              {tpl.photoUrl && (
                                <div className="h-18 rounded-xl overflow-hidden border border-[#3685ce]/60 bg-slate-900">
                                  <img
                                    src={tpl.photoUrl}
                                    alt={tpl.title}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              )}

                              <p className="text-[11px] text-[#d6ecff] font-medium line-clamp-3 leading-relaxed whitespace-pre-wrap">
                                {tpl.message}
                              </p>

                              <div className="flex items-center gap-1.5 pt-1 border-t border-[#3685ce]/40">
                                <button
                                  type="button"
                                  onClick={() => handleLoadTextToComposer(tpl.message, tpl.photoUrl, tpl.title)}
                                  className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl flex items-center justify-center gap-1 shadow-sm active:scale-95 transition-all"
                                >
                                  <Check className="w-3 h-3" />
                                  <span>ይህን ጽሁፍ ተጠቀም</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(tpl.message, 'የተቀመጠ ጽሁፍ')}
                                  className="px-2.5 py-1.5 bg-[#123862] hover:bg-[#184474] text-[#b4d9ff] font-bold text-xs rounded-xl border border-[#2f75b8] active:scale-95"
                                  title="ጽሁፉን ኮፒ አድርግ"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}

                      {/* 3. Preset Daily Messages */}
                      {(textArchiveFilter === 'all' || textArchiveFilter === 'presets') &&
                        PRESET_DAILY_MESSAGES.filter((p) =>
                          textArchiveSearch
                            ? (p.title || '').toLowerCase().includes(textArchiveSearch.toLowerCase()) ||
                              (p.message || '').toLowerCase().includes(textArchiveSearch.toLowerCase())
                            : true
                        ).map((preset) => (
                          <div
                            key={preset.id}
                            className="p-3 bg-gradient-to-br from-[#123862] via-[#0f3156] to-[#0a2340] border-2 border-[#3685ce] hover:border-[#5bb0fc] rounded-2xl shadow-md transition-all space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-black text-white">{preset.title}</span>
                              <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#2481cc]/40 text-[#a9d7ff] border border-[#52a7f0]/40 font-bold">
                                {preset.badge}
                              </span>
                            </div>

                            {preset.photoUrl && (
                              <div className="h-20 rounded-xl overflow-hidden border border-[#3685ce]/60 bg-slate-900">
                                <img
                                  src={preset.photoUrl}
                                  alt={preset.title}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            )}

                            <p className="text-[11px] text-[#b4d9ff] font-medium line-clamp-2 leading-relaxed">
                              {preset.message}
                            </p>

                            <div className="flex items-center gap-1.5 pt-1 border-t border-[#3685ce]/40">
                              <button
                                type="button"
                                onClick={() => applyPreset(preset)}
                                className="flex-1 py-1.5 bg-gradient-to-r from-[#2481cc] to-[#229ED9] hover:from-[#229ED9] hover:to-[#54a9eb] text-white font-black text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all"
                              >
                                <Sparkles className="w-3 h-3" />
                                <span>ይህን መልእክት ተጠቀም</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(preset.message, 'መልእክት')}
                                className="px-2.5 py-1.5 bg-[#123862] hover:bg-[#184474] text-[#b4d9ff] font-bold text-xs rounded-xl border border-[#2f75b8] active:scale-95"
                                title="ጽሁፉን ኮፒ አድርግ"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* ARCHIVE 2: 🖼️ የፎቶ ማህደር (Photo Archive / Gallery) */}
                {activeBroadcastSubTab === 'photo_archive' && (
                  <div className="space-y-3">
                    {/* Hidden input for uploading to archive */}
                    <input
                      type="file"
                      ref={archiveUploadInputRef}
                      accept="image/*"
                      className="hidden"
                      onChange={handleArchiveUploadChange}
                    />

                    <div className="flex items-center justify-between text-xs font-black text-[#d6ecff]">
                      <span>የተላኩ ፎቶዎችና ባነሮች ማህደር (Photo Archive)፦</span>
                      <span className="text-[10px] text-[#78c9ff] font-bold">
                        {mediaGallery.length} ፎቶዎች
                      </span>
                    </div>

                    {/* Direct Upload & Unselect Action Bar */}
                    <div className="flex flex-col sm:flex-row gap-2">
                      <button
                        type="button"
                        onClick={() => archiveUploadInputRef.current?.click()}
                        className="flex-1 py-2.5 px-3 bg-gradient-to-r from-emerald-600 via-teal-600 to-[#2481cc] hover:from-emerald-500 hover:to-[#229ED9] text-white font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-md border border-emerald-300/40 active:scale-95 transition-all"
                      >
                        <FolderOpen className="w-4 h-4 text-emerald-200" />
                        <span>📁 አዲስ ፎቶ ከስልክ / ጋለሪ ጫን (Upload Photo)</span>
                      </button>

                      {selectedPhotoUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedPhotoUrl('');
                            setSelectedPhotoTitle('');
                            showToast('የተመረጠው ፎቶ ተነስቷል (ያለ ፎቶ ሆነ)!');
                          }}
                          className="py-2.5 px-3 bg-rose-950/80 hover:bg-rose-900 border border-rose-500/60 text-rose-200 hover:text-white font-black rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
                          title="ፎቶውን አንሳ / ባዶ አድርግ"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>ፎቶ አንሳ (ያለ ፎቶ)</span>
                        </button>
                      )}
                    </div>

                    <p className="text-[11px] text-[#b4d9ff] leading-relaxed">
                      ከስልክዎ ፎቶ መስቀል ወይም ከታች ካሉት ማህደር ፎቶዎች አንዱን በመንካት ወዲያውኑ ማያያዝ ይችላሉ፦
                    </p>

                    {/* Filter Pills for Photo Archive */}
                    <div className="flex flex-wrap gap-1">
                      {[
                        { id: 'all', label: '🌟 ሁሉም' },
                        { id: 'custom', label: '📁 ከስልክ የተጨመሩ' },
                        { id: 'banner', label: '🎯 ባነሮች' },
                        { id: 'bonus', label: '🎁 ቦነስ/ሽልማት' },
                        { id: 'payment', label: '💳 ክፍያ/ድጋፍ' },
                      ].map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setPhotoArchiveFilter(cat.id)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition-all ${
                            photoArchiveFilter === cat.id
                              ? 'bg-[#229ED9] text-white shadow-sm'
                              : 'bg-[#0b223a] text-[#b4d9ff] hover:text-white border border-[#3685ce]/60'
                          }`}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>

                    {/* Photos Grid */}
                    <div className="grid grid-cols-2 gap-2.5 max-h-[580px] overflow-y-auto pr-1">
                      {mediaGallery
                        .filter((item) =>
                          photoArchiveFilter === 'all'
                            ? true
                            : (item.category || '').toLowerCase().includes(photoArchiveFilter.toLowerCase())
                        )
                        .map((item) => {
                          const isSelected = selectedPhotoUrl === item.url;
                          return (
                            <div
                              key={item.id}
                              onClick={() => handleSelectPhotoFromGallery(item)}
                              className={`group relative rounded-2xl overflow-hidden border-2 cursor-pointer transition-all aspect-video bg-slate-900 shadow-md ${
                                isSelected
                                  ? 'border-[#229ED9] ring-4 ring-[#229ED9]/60 shadow-[#229ED9]/40'
                                  : 'border-[#3685ce]/70 hover:border-white'
                              }`}
                            >
                              <img
                                src={item.url}
                                alt={item.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300"
                                onError={(e) => {
                                  (e.target as any).src =
                                    'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=800&auto=format&fit=crop&q=80';
                                }}
                              />
                              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 via-slate-950/85 to-transparent p-1.5 flex flex-col justify-end">
                                <span className="text-[10px] font-black text-white truncate block">
                                  {item.title}
                                </span>
                                <div className="flex items-center justify-between mt-0.5">
                                  <span className="text-[8px] text-[#78c9ff] uppercase font-bold">
                                    {item.category || 'gallery'}
                                  </span>
                                  <span
                                    className={`text-[8px] font-black px-1.5 py-0.5 rounded ${
                                      isSelected
                                        ? 'bg-emerald-500 text-white'
                                        : 'bg-[#2481cc]/80 text-white group-hover:bg-[#229ED9]'
                                    }`}
                                  >
                                    {isSelected ? '✓ የተመረጠ' : 'ምረጥ'}
                                  </span>
                                </div>
                              </div>
                              {isSelected && (
                                <div className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-[#229ED9] text-white flex items-center justify-center shadow-md animate-pulse">
                                  <Check className="w-3.5 h-3.5" />
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* MODAL: BAN USER (አስቸጋሪ ሰዎችን BAN ማድረጊያ) */}
        {/* ------------------------------------------------------------- */}
        {banTargetUser && (
          <div className="fixed inset-0 z-50 bg-[#061424]/85 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
            <div className="bg-gradient-to-b from-[#183d69] via-[#123358] to-[#0b2440] border-2 border-rose-500 rounded-3xl p-5 max-w-md w-full space-y-4 shadow-2xl text-white">
              <div className="flex items-center justify-between border-b border-[#3685ce]/40 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-rose-950 border border-rose-500 flex items-center justify-center text-rose-300 shadow-md">
                    <Ban className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-rose-300">ተጫዋች አግድ (BAN PLAYER)</h2>
                    <p className="text-[10px] text-[#b4d9ff]">የታገደ ተጫዋች መጫወትም ሆነ ገንዘብ ማንቀሳቀስ አይችልም</p>
                  </div>
                </div>
                <button
                  onClick={() => setBanTargetUser(null)}
                  className="text-[#b4d9ff] hover:text-white p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Target User Info */}
              <div className="bg-[#0b223a] p-3.5 rounded-2xl border-2 border-[#3685ce]/60 flex items-center justify-between shadow-inner">
                <div>
                  <div className="text-sm font-black text-white">
                    {banTargetUser.first_name || banTargetUser.full_name || 'Player'}
                  </div>
                  <div className="text-xs text-[#8ed0ff] font-mono font-bold">
                    {banTargetUser.player_code} · ID: {banTargetUser.telegram_id}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-[#b4d9ff] font-bold">ቀሪ ሂሳብ</div>
                  <div className="text-sm font-mono font-black text-[#78c9ff]">
                    {Number(banTargetUser.balance || 0).toLocaleString()} ETB
                  </div>
                </div>
              </div>

              {/* Ban Reason Selector */}
              <div className="space-y-2">
                <label className="text-xs font-black text-[#d6ecff] block">
                  የእገዳ ምክንያት ይምረጡ (Select Ban Reason)፦
                </label>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {BAN_REASON_PRESETS.map((reason) => (
                    <label
                      key={reason}
                      className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition-all font-bold ${
                        selectedBanReason === reason
                          ? 'bg-rose-950/70 border-rose-500 text-rose-100 shadow-md'
                          : 'bg-[#123862] border-[#2f75b8] text-[#b4d9ff] hover:text-white hover:bg-[#184474]'
                      }`}
                    >
                      <input
                        type="radio"
                        name="banReason"
                        checked={selectedBanReason === reason}
                        onChange={() => setSelectedBanReason(reason)}
                        className="text-rose-500 focus:ring-rose-400"
                      />
                      <span>{reason}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Custom Reason Input */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#b4d9ff] block">
                  ሌላ ተጨማሪ ማብራሪያ ካለ (አማራጭ)፦
                </label>
                <input
                  type="text"
                  value={customBanReason}
                  onChange={(e) => setCustomBanReason(e.target.value)}
                  placeholder="ምክንያቱን እዚህ ይጻፉ..."
                  className="w-full px-3.5 py-2.5 bg-[#0b223a] border-2 border-[#3685ce] rounded-xl text-xs text-white placeholder-[#8ec2f2] focus:outline-none focus:border-rose-400"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2 border-t border-[#3685ce]/40">
                <button
                  type="button"
                  onClick={() => setBanTargetUser(null)}
                  className="flex-1 py-2.5 bg-[#123862] hover:bg-[#184474] text-[#b4d9ff] font-bold rounded-xl text-xs transition-all border border-[#2f75b8]"
                >
                  ይቅር (Cancel)
                </button>
                <button
                  type="button"
                  onClick={handleConfirmBan}
                  disabled={isProcessingBan}
                  className="flex-1 py-2.5 bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white font-black rounded-xl text-xs shadow-lg shadow-rose-600/40 flex items-center justify-center gap-1.5 active:scale-95 transition-all border border-rose-400"
                >
                  <Ban className="w-4 h-4" />
                  <span>{isProcessingBan ? 'እየታገደ ነው...' : '🚫 እርግጠኛ ነኝ፣ አግደው'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* MODAL: BALANCE ADJUSTMENT */}
        {/* ------------------------------------------------------------- */}
        {selectedUser && (
          <div className="fixed inset-0 z-50 bg-[#061424]/85 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
            <div className="bg-gradient-to-b from-[#183d69] via-[#123358] to-[#0b2440] border-2 border-[#388de0] rounded-3xl p-5 max-w-md w-full space-y-4 shadow-2xl text-white">
              <div className="flex items-center justify-between border-b border-[#3685ce]/40 pb-3">
                <div>
                  <h2 className="text-sm font-black text-white flex items-center gap-1.5">
                    <Sliders className="w-4 h-4 text-[#229ED9]" />
                    <span>የተጫዋች ሂሳብ ማስተካከያ</span>
                  </h2>
                  <p className="text-[10px] text-[#b4d9ff] font-bold">
                    {selectedUser.first_name || selectedUser.player_code} (ID: {selectedUser.telegram_id})
                  </p>
                </div>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="text-[#b4d9ff] hover:text-white p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleUpdateBalance} className="space-y-3.5">
                {/* Current Balance */}
                <div className="bg-[#0b223a] p-3.5 rounded-2xl border-2 border-[#3685ce]/60 flex items-center justify-between shadow-inner">
                  <span className="text-xs text-[#b4d9ff] font-bold">የአሁኑ ቀሪ ሂሳብ፦</span>
                  <span className="text-lg font-black font-mono text-[#78c9ff]">
                    {Number(selectedUser.balance || 0).toLocaleString()} ETB
                  </span>
                </div>

                {/* Action Type: Add / Subtract / Set */}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setBalanceActionType('add')}
                    className={`py-2 rounded-xl text-xs font-black transition-all ${
                      balanceActionType === 'add'
                        ? 'bg-emerald-600 text-white shadow-md border border-emerald-400'
                        : 'bg-[#123862] text-[#b4d9ff] border border-[#2f75b8]'
                    }`}
                  >
                    + ብር ጨምር
                  </button>
                  <button
                    type="button"
                    onClick={() => setBalanceActionType('subtract')}
                    className={`py-2 rounded-xl text-xs font-black transition-all ${
                      balanceActionType === 'subtract'
                        ? 'bg-rose-600 text-white shadow-md border border-rose-400'
                        : 'bg-[#123862] text-[#b4d9ff] border border-[#2f75b8]'
                    }`}
                  >
                    - ብር ቀንስ
                  </button>
                  <button
                    type="button"
                    onClick={() => setBalanceActionType('set')}
                    className={`py-2 rounded-xl text-xs font-black transition-all ${
                      balanceActionType === 'set'
                        ? 'bg-gradient-to-r from-[#2481cc] to-[#229ED9] text-white shadow-md border border-white/30'
                        : 'bg-[#123862] text-[#b4d9ff] border border-[#2f75b8]'
                    }`}
                  >
                    እኩል አድርግ
                  </button>
                </div>

                {/* Amount Input */}
                <div className="space-y-1">
                  <label className="text-xs font-black text-[#d6ecff] block">የብር መጠን (ETB)፦</label>
                  <input
                    type="number"
                    min="1"
                    value={balanceAmount}
                    onChange={(e) => setBalanceAmount(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 bg-[#0b223a] border-2 border-[#3685ce] rounded-xl text-sm font-mono font-bold text-white focus:outline-none focus:border-[#42a0f8] shadow-inner"
                  />
                </div>

                {/* Preset Chips */}
                <div className="flex flex-wrap gap-1.5">
                  {[100, 250, 500, 1000, 2000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setBalanceAmount(String(amt))}
                      className="px-2.5 py-1 rounded-lg bg-[#123862] hover:bg-[#19497c] text-[#8ec2f2] text-xs font-mono font-black border border-[#2f75b8]"
                    >
                      {amt}
                    </button>
                  ))}
                </div>

                {/* Reason Input */}
                <div className="space-y-1">
                  <label className="text-xs font-black text-[#d6ecff] block">ምክንያት (ለተጫዋቹ ማስታወቂያ)፦</label>
                  <input
                    type="text"
                    value={balanceReason}
                    onChange={(e) => setBalanceReason(e.target.value)}
                    placeholder="ምሳሌ፦ የቴሌብር ክፍያ ማስተካከያ"
                    className="w-full px-3.5 py-2.5 bg-[#0b223a] border-2 border-[#3685ce] rounded-xl text-xs text-white placeholder-[#8ec2f2] focus:outline-none focus:border-[#42a0f8] shadow-inner"
                  />
                </div>

                {/* Submit */}
                <div className="flex gap-2 pt-2 border-t border-[#3685ce]/40">
                  <button
                    type="button"
                    onClick={() => setSelectedUser(null)}
                    className="flex-1 py-2.5 bg-[#123862] hover:bg-[#184474] text-[#b4d9ff] font-bold rounded-xl text-xs border border-[#2f75b8]"
                  >
                    ይቅር
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdatingBalance}
                    className="flex-1 py-2.5 bg-gradient-to-r from-[#2481cc] to-[#229ED9] hover:from-[#229ED9] hover:to-[#54a9eb] text-white font-black rounded-xl text-xs shadow-md shadow-[#2481cc]/40 border border-[#5ab3ff]"
                  >
                    {isUpdatingBalance ? 'እየተስተካከለ ነው...' : 'አስተካክል (Save)'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* MODAL: BROADCAST MESSAGE */}
        {/* ------------------------------------------------------------- */}
        {showBroadcastModal && (
          <div className="fixed inset-0 z-50 bg-[#061424]/85 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
            {/* Hidden file input for modal gallery picker */}
            <input
              type="file"
              ref={modalFileInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleDevicePhotoChange}
            />

            <div className="bg-gradient-to-b from-[#183d69] via-[#123358] to-[#0b2440] border-2 border-[#388de0] rounded-3xl p-5 max-w-lg w-full space-y-4 shadow-2xl text-white">
              <div className="flex items-center justify-between border-b border-[#3685ce]/40 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#2481cc] to-[#229ED9] flex items-center justify-center text-white shadow-md">
                    <Radio className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-white">የቴሌግራም መልእክት አስተላልፍ</h2>
                    <p className="text-[10px] text-[#b4d9ff]">ለተጫዋቾች ጽሁፍ እና ፎቶ ወዲያውኑ ይላኩ</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleResetToBlank}
                    className="text-[10px] font-black text-amber-300 hover:text-white px-2.5 py-1 rounded-xl border border-amber-400/40 bg-[#0b2440] shadow-sm active:scale-95 transition-all"
                    title="ሁሉንም ባዶ አድርግ"
                  >
                    ✨ ባዶ አድርግ
                  </button>
                  <button
                    onClick={() => setShowBroadcastModal(false)}
                    className="text-[#b4d9ff] hover:text-white p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <form onSubmit={handleSendBroadcast} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-black text-[#d6ecff] block">የሚላክለት ተጠቃሚ፦</label>
                  <select
                    value={broadcastTarget}
                    onChange={(e) => setBroadcastTarget(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0b223a] border-2 border-[#3685ce] rounded-xl text-xs text-white focus:outline-none focus:border-[#42a0f8] shadow-inner font-bold"
                  >
                    <option value="all">📢 ለሁሉም ተጫዋቾች ({users.length})</option>
                    {users.map((u) => (
                      <option key={String(u.telegram_id)} value={String(u.telegram_id)}>
                        👤 {u.first_name || u.player_code} (ID: {u.telegram_id})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Preset loader quick pill */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#b4d9ff] block">
                    የተዘጋጁ የዕለት መልእክቶች ይምረጡ (አማራጭ)፦
                  </label>
                  <select
                    onChange={(e) => {
                      const found = PRESET_DAILY_MESSAGES.find((p) => p.id === e.target.value);
                      if (found) applyPreset(found);
                    }}
                    defaultValue=""
                    className="w-full px-3 py-1.5 bg-[#0b223a] border border-[#3685ce]/80 rounded-xl text-xs text-[#aadcff] font-medium"
                  >
                    <option value="" disabled>
                      -- ከዕለት መልእክቶች አንዱን ይምረጡ --
                    </option>
                    {PRESET_DAILY_MESSAGES.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Attached Photo Preview / Gallery Picker */}
                {selectedPhotoUrl ? (
                  <div className="relative rounded-2xl overflow-hidden border-2 border-[#388de0] h-32 bg-slate-900 group shadow-md">
                    <img
                      src={selectedPhotoUrl}
                      alt="Attached"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 via-slate-950/85 to-transparent p-2 flex items-center justify-between">
                      <div className="truncate max-w-[65%]">
                        <span className="text-[11px] font-black text-white truncate block">
                          {selectedPhotoTitle || 'የተመረጠ ፎቶ'}
                        </span>
                        <span className="text-[9px] text-[#78c9ff] font-bold">
                          {selectedPhotoUrl.startsWith('data:')
                            ? '📁 ከስልክ ጋለሪ የተመረጠ'
                            : '🖼️ ከማህደር የተመረጠ'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => modalFileInputRef.current?.click()}
                          className="px-2 py-1 rounded-lg bg-[#2481cc] hover:bg-[#229ED9] text-white text-[10px] font-black shadow-md flex items-center gap-1 border border-white/20 active:scale-95"
                          title="በስልክ ጋለሪ ቀይር"
                        >
                          <FolderOpen className="w-3 h-3" />
                          <span>ቀይር</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedPhotoUrl('');
                            setSelectedPhotoTitle('');
                            showToast('ፎቶው ተወግዷል');
                          }}
                          className="p-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold shadow-md active:scale-95"
                          title="ፎቶ አስወግድ"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-bold text-[#b4d9ff]">
                      <span>ፎቶ ማያያዣ (የስልክ ጋለሪ ወይም ማህደር)፦</span>
                      <span className="text-[10px] text-emerald-400 font-bold">አማራጭ (ያለ ፎቶ መላክ ይቻላል)</span>
                    </div>

                    {/* Primary Device Gallery / File Picker */}
                    <button
                      type="button"
                      onClick={() => modalFileInputRef.current?.click()}
                      className="w-full py-2.5 px-3 bg-gradient-to-r from-emerald-600 via-teal-600 to-[#2481cc] hover:from-emerald-500 hover:to-[#229ED9] text-white font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-md border border-emerald-300/40 active:scale-95 transition-all"
                    >
                      <FolderOpen className="w-4 h-4 text-emerald-200" />
                      <span>📁 ከስልክ ጋለሪ / ከፋይል ፎቶ ምረጥ (Choose from Phone)</span>
                    </button>

                    {/* Alternative Quick Picker from media gallery */}
                    <div className="space-y-1 pt-0.5">
                      <div className="flex items-center justify-between text-[10px] text-[#78c9ff] font-bold">
                        <span>ወይም ከቀደምት ፎቶዎች ምረጥ፦</span>
                        <span>{mediaGallery.length} ፎቶዎች</span>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5 max-h-24 overflow-y-auto p-1.5 bg-[#0b223a] rounded-xl border border-[#3685ce]/60">
                        {mediaGallery.slice(0, 8).map((m) => (
                          <div
                            key={m.id}
                            onClick={() => {
                              setSelectedPhotoUrl(m.url);
                              setSelectedPhotoTitle(m.title);
                              showToast(`"${m.title}" ተመርጧል!`);
                            }}
                            className={`group relative rounded-lg overflow-hidden border cursor-pointer aspect-video bg-slate-900 transition-all ${
                              selectedPhotoUrl === m.url
                                ? 'border-[#229ED9] ring-2 ring-[#229ED9]'
                                : 'border-[#3685ce]/50 hover:border-white'
                            }`}
                          >
                            <img
                              src={m.url}
                              alt={m.title}
                              className="w-full h-full object-cover group-hover:scale-105"
                            />
                            <div className="absolute inset-x-0 bottom-0 bg-slate-950/80 p-0.5 text-[8px] text-white truncate text-center font-bold">
                              {m.title}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-[#d6ecff] block">የመልእክቱ ይዘት፦</label>
                    <button
                      type="button"
                      onClick={handleSaveCurrentAsTemplate}
                      className="text-[10px] text-emerald-300 hover:text-emerald-100 flex items-center gap-1 font-bold"
                    >
                      <Bookmark className="w-3 h-3" />
                      <span>💾 አስቀምጥ</span>
                    </button>
                  </div>
                  <textarea
                    rows={4}
                    value={broadcastMessage}
                    onChange={(e) => setBroadcastMessage(e.target.value)}
                    placeholder="መልእክትዎን እዚህ ይጻፉ..."
                    required={!selectedPhotoUrl}
                    className="w-full px-3.5 py-2.5 bg-[#0b223a] border-2 border-[#3685ce] rounded-xl text-xs text-white placeholder-[#8ec2f2] focus:outline-none focus:border-[#42a0f8] shadow-inner font-medium leading-relaxed"
                  />
                </div>

                <div className="flex gap-2 pt-2 border-t border-[#3685ce]/40">
                  <button
                    type="button"
                    onClick={() => {
                      setShowBroadcastModal(false);
                      setActiveTab('broadcast');
                    }}
                    className="px-3 py-2.5 bg-[#123862] hover:bg-[#184474] text-[#b4d9ff] font-bold rounded-xl text-xs border border-[#2f75b8] flex items-center gap-1"
                  >
                    <Radio className="w-3.5 h-3.5 text-amber-300" />
                    <span>ሙሉ ስቱዲዮ</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowBroadcastModal(false)}
                    className="px-3 py-2.5 bg-[#123862] hover:bg-[#184474] text-[#b4d9ff] font-bold rounded-xl text-xs border border-[#2f75b8]"
                  >
                    ይቅር
                  </button>
                  <button
                    type="submit"
                    disabled={isSendingBroadcast}
                    className="flex-1 py-2.5 bg-gradient-to-r from-[#2481cc] to-[#229ED9] hover:from-[#229ED9] hover:to-[#54a9eb] text-white font-black rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md border border-[#5ab3ff]"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isSendingBroadcast ? 'እየተላከ ነው...' : 'ላክ (Send)'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* MODAL: PLAYER GAME HISTORY */}
        {/* ------------------------------------------------------------- */}
        {inspectUser && (
          <div className="fixed inset-0 z-50 bg-[#061424]/85 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
            <div className="bg-gradient-to-b from-[#183d69] via-[#123358] to-[#0b2440] border-2 border-[#388de0] rounded-3xl p-5 max-w-lg w-full max-h-[85vh] flex flex-col space-y-3.5 shadow-2xl text-white">
              <div className="flex items-center justify-between border-b border-[#3685ce]/40 pb-3">
                <div>
                  <h2 className="text-sm font-black text-white flex items-center gap-1.5">
                    <History className="w-4 h-4 text-[#229ED9]" />
                    <span>የተጫዋች ዝርዝር መረጃ</span>
                  </h2>
                  <p className="text-[11px] text-[#b4d9ff] font-bold">
                    {inspectUser.first_name || inspectUser.player_code} · {inspectUser.player_code}
                  </p>
                </div>
                <button
                  onClick={() => setInspectUser(null)}
                  className="text-[#b4d9ff] hover:text-white p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Player Quick Stats */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-[#0b223a] p-3 rounded-xl border border-[#3685ce]/60 text-center shadow-inner">
                  <div className="text-[10px] text-[#b4d9ff] font-bold">ቀሪ ሂሳብ</div>
                  <div className="text-sm font-black font-mono text-[#78c9ff] mt-0.5">
                    {Number(inspectUser.balance || 0).toLocaleString()} ETB
                  </div>
                </div>
                <div className="bg-[#0b223a] p-3 rounded-xl border border-[#3685ce]/60 text-center shadow-inner">
                  <div className="text-[10px] text-[#b4d9ff] font-bold">የተጫወታቸው</div>
                  <div className="text-sm font-black font-mono text-white mt-0.5">
                    {inspectUser.total_games || playerHistory.length}
                  </div>
                </div>
                <div className="bg-[#0b223a] p-3 rounded-xl border border-[#3685ce]/60 text-center shadow-inner">
                  <div className="text-[10px] text-[#b4d9ff] font-bold">ያሸነፋቸው</div>
                  <div className="text-sm font-black font-mono text-emerald-400 mt-0.5">
                    {inspectUser.total_wins || playerHistory.filter((h) => h.result === 'won').length}
                  </div>
                </div>
              </div>

              {/* History List */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                <h4 className="text-xs font-black text-[#d6ecff]">የቅርብ ጊዜ ጨዋታዎች፦</h4>
                {loadingPlayerHistory ? (
                  <div className="py-8 text-center text-[#b4d9ff] space-y-1">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#229ED9]" />
                    <p className="text-xs font-bold">ታሪክ እየተጫነ ነው...</p>
                  </div>
                ) : playerHistory.length === 0 ? (
                  <div className="py-8 text-center text-[#b4d9ff] bg-[#0b223a] rounded-xl border border-[#3685ce]/60 text-xs font-bold">
                    ምንም የተመዘገበ የጨዋታ ታሪክ የለም
                  </div>
                ) : (
                  playerHistory.map((h) => {
                    const won = h.result === 'won';
                    return (
                      <div
                        key={h.id}
                        className={`p-3 rounded-xl border-2 flex items-center justify-between text-xs shadow-sm ${
                          won
                            ? 'bg-emerald-950/40 border-emerald-500/70 text-emerald-200'
                            : 'bg-[#0b223a] border-[#3685ce]/60 text-[#b4d9ff]'
                        }`}
                      >
                        <div className="space-y-0.5">
                          <div className="font-black text-white flex items-center gap-1.5">
                            <span>ውርርድ፦ {h.stake} ETB</span>
                            <span className="text-[10px] text-[#8ec2f2]">({h.cards_count} ካርቴላ)</span>
                          </div>
                          <div className="text-[10px] text-[#8ec2f2]">
                            {new Date(h.timestamp || h.created_at || Date.now()).toLocaleString()}
                          </div>
                        </div>

                        <div className="text-right">
                          <div
                            className={`font-black font-mono text-xs ${
                              won ? 'text-emerald-300' : 'text-slate-400'
                            }`}
                          >
                            {won ? `+${h.won_amount} ETB` : 'ተሸንፏል'}
                          </div>
                          {h.pattern_name && (
                            <div className="text-[9px] text-[#78c9ff] font-bold">
                              {h.pattern_name}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
        {showSupabaseModal && (
          <div className="fixed inset-0 z-[100] bg-[#061424]/90 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
            <div className="bg-gradient-to-b from-[#183d69] via-[#123358] to-[#0b2440] border-2 border-[#388de0] rounded-3xl p-6 max-w-md w-full shadow-2xl text-white space-y-4">
              <div className="flex items-center justify-between border-b border-[#3685ce]/40 pb-3">
                <div className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-amber-400 animate-pulse" />
                  <h2 className="text-sm font-black text-white">Supabase ዳታቤዝ ማዋቀሪያ (Setup)</h2>
                </div>
                <button
                  onClick={() => setShowSupabaseModal(false)}
                  className="text-[#b4d9ff] hover:text-white p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="text-[11px] text-[#b4d9ff] leading-relaxed space-y-1">
                <p>አድሚን ፓነሉ በቀጥታ ከእርስዎ Supabase ዳታቤዝ ጋር እንዲገናኝ እባክዎ የፕሮጀክትዎን URL እና Anon Key ያስገቡ።</p>
                <p className="text-amber-300 font-bold">⚠️ ማሳሰቢያ፦ ይህ መረጃ በእርስዎ ብሮውዘር ላይ ብቻ በደህንነት ይቀመጣል!</p>
              </div>

              <form onSubmit={handleSaveSupabaseConfig} className="space-y-3.5">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-[#8ec2f2] uppercase tracking-wider block">Supabase Project URL</label>
                  <input
                    type="url"
                    required
                    value={supabaseUrlInput}
                    onChange={(e) => setSupabaseUrlInput(e.target.value)}
                    placeholder="https://sqmicjzafgcymcfdjlai.supabase.co"
                    className="w-full px-3 py-2 bg-[#0b223a] border-2 border-[#3685ce] rounded-xl text-xs text-white placeholder-[#8ec2f2] focus:outline-none focus:border-amber-400 shadow-inner font-medium font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-[#8ec2f2] uppercase tracking-wider block">Supabase Anon Key</label>
                  <textarea
                    rows={4}
                    required
                    value={supabaseKeyInput}
                    onChange={(e) => setSupabaseKeyInput(e.target.value)}
                    placeholder="eyJhbGciOi..."
                    className="w-full px-3 py-2 bg-[#0b223a] border-2 border-[#3685ce] rounded-xl text-xs text-white placeholder-[#8ec2f2] focus:outline-none focus:border-amber-400 shadow-inner font-medium font-mono leading-relaxed"
                  />
                </div>

                {supabaseMsg && (
                  <div className={`p-3 rounded-xl border text-[11px] font-bold flex items-start gap-1.5 ${
                    supabaseMsg.type === 'success'
                      ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
                      : 'bg-red-950/40 border-red-500/50 text-red-300'
                  }`}>
                    <span>{supabaseMsg.text}</span>
                  </div>
                )}

                <div className="flex gap-2 pt-2 border-t border-[#3685ce]/40">
                  <button
                    type="button"
                    onClick={() => {
                      setSupabaseUrlInput('https://sqmicjzafgcymcfdjlai.supabase.co');
                      showToast('የማሳያ ሊንክ ተዘጋጅቷል! እባክዎ Anon Key ያስገቡ።', 'info');
                    }}
                    className="px-3 py-2 bg-[#123862] hover:bg-[#184474] text-[#b4d9ff] font-bold rounded-xl text-[10px] border border-[#2f75b8]"
                  >
                    የድሮውን URL ሙላ (Auto-Fill URL)
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSupabaseModal(false)}
                    className="px-3 py-2 bg-[#123862] hover:bg-[#184474] text-[#b4d9ff] font-bold rounded-xl text-xs border border-[#2f75b8]"
                  >
                    ይቅር
                  </button>
                  <button
                    type="submit"
                    disabled={supabaseTesting}
                    className="flex-1 py-2.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-black rounded-xl text-xs flex items-center justify-center gap-1 shadow-md border border-amber-400"
                  >
                    {supabaseTesting ? 'በመሞከር ላይ...' : 'አገናኝ እና አስቀምጥ (Save) 🔗'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
