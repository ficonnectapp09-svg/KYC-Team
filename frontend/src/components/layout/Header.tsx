import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Menu,
  Sun,
  Moon,
  Bell,
  LogOut,
  ShieldAlert,
  Search
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { NotificationItem } from '../../types';
import { apiFetch } from '../../services/api';
import {
  KYC_NAV_CATEGORIES,
  PAYMENT_NAV_CATEGORIES,
  INCOME_SUB_CATEGORIES,
  EXPENSE_SUB_CATEGORIES,
  SALARY_NAV_CATEGORIES,
  QUERY_NAV_CATEGORIES
} from '../../config/categoryCatalog';

interface HeaderProps {
  onToggleSidebar: () => void;
}

const ROUTE_TITLES: Record<string, string> = {
  '/overall': 'Overall Dashboard',
  '/kyc': 'KYC Operations',
  '/payment': 'Payment Operations',
  '/queries': 'Queries Operations',
  '/staff': 'Staff Directory',
  '/tasks': 'Task Allocation',
  '/salary': 'Salary Management',
  '/reports': 'Reports & Analytics',
  '/audit': 'Audit Logs',
  '/notifications': 'Notifications',
  '/settings': 'Settings'
};

function resolveDynamicTitle(pathname: string): string {
  if (ROUTE_TITLES[pathname]) return ROUTE_TITLES[pathname];
  if (pathname.startsWith('/kyc/')) {
    const slug = pathname.replace('/kyc/', '');
    const cat = KYC_NAV_CATEGORIES.find(c => c.slug === slug);
    return cat ? `KYC Operations — ${cat.label}` : 'KYC Operations';
  }
  if (pathname.startsWith('/payment/')) {
    const slug = pathname.replace('/payment/', '');
    if (slug.startsWith('income/')) {
      const sub = INCOME_SUB_CATEGORIES.find(c => c.slug === slug.replace('income/', ''));
      return sub ? `Payment Income — ${sub.label}` : 'Payment Operations — Income';
    }
    if (slug.startsWith('expenses/')) {
      const sub = EXPENSE_SUB_CATEGORIES.find(c => c.slug === slug.replace('expenses/', ''));
      return sub ? `Payment Expenses — ${sub.label}` : 'Payment Operations — Expenses';
    }
    const cat = PAYMENT_NAV_CATEGORIES.find(c => c.slug === slug);
    return cat ? `Payment Operations — ${cat.label}` : 'Payment Operations';
  }
  if (pathname.startsWith('/salary/')) {
    const slug = pathname.replace('/salary/', '');
    const cat = SALARY_NAV_CATEGORIES.find(c => c.slug === slug);
    return cat ? `Salary Management — ${cat.label}` : 'Salary Management';
  }
  if (pathname.startsWith('/queries/')) {
    const slug = pathname.replace('/queries/', '');
    const cat = QUERY_NAV_CATEGORIES.find(c => c.slug === slug);
    return cat ? `Queries Operations — ${cat.label}` : 'Queries Operations';
  }
  if (pathname.startsWith('/staff/')) return 'Staff Directory';
  return 'Connect Backoffice';
}

export const Header: React.FC<HeaderProps> = ({ onToggleSidebar }) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [showNotifMenu, setShowNotifMenu] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<{
    employees: any[];
    kyc: any[];
    payments: any[];
    queries: any[];
    tasks: any[];
  } | null>(null);

  const pageTitle = resolveDynamicTitle(location.pathname);

  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setSearchResults(null);
      setSearchError(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        setSearchError(null);
        const res = await apiFetch<any>(`/reports/search?q=${encodeURIComponent(trimmed)}`);
        if (res.success && res.data) {
          setSearchResults(res.data);
        } else {
          setSearchResults(null);
          setSearchError(res.message || 'Search failed.');
        }
      } catch (err: any) {
        setSearchResults(null);
        setSearchError(err?.message || 'Unable to search records.');
      }
    }, 280);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const res = await apiFetch<NotificationItem[]>('/notifications');
        if (res.success && res.data) {
          setNotifications(res.data);
          setUnreadCount(res.unreadCount || 0);
        }
      } catch (err) {
        console.error('Failed to load notifications:', err);
      }
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, [user]);

  const handleMarkAllRead = async () => {
    try {
      await apiFetch('/notifications/read-all', { method: 'PATCH' });
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 px-4 sm:px-6 backdrop-blur-md">
      {/* Left: Mobile Toggle, Breadcrumb Title & Global Search */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <button
          onClick={onToggleSidebar}
          className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="hidden md:block shrink-0">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Connect Backoffice / {user?.department || 'Operations'}
          </div>
          <div className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
            {pageTitle}
          </div>
        </div>

        {/* Global Search Bar */}
        <div className="relative ml-2 sm:ml-4 max-w-xs w-full hidden sm:block">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Global search (KYC, TXN, QRY, Staff)..."
            className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-800/70 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {searchError && (
            <div className="absolute left-0 mt-2 w-80 rounded-2xl bg-rose-50 dark:bg-rose-950/90 border border-rose-200 dark:border-rose-800 shadow-2xl p-3 z-50 text-xs text-rose-700 dark:text-rose-200 font-semibold">
              {searchError}
            </div>
          )}
          {searchResults && (
            <div className="absolute left-0 mt-2 w-80 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-2 z-50 max-h-80 overflow-y-auto text-xs space-y-2">
              {Object.values(searchResults).every((arr) => arr.length === 0) ? (
                <div className="p-3 text-center text-slate-400">No matches for "{searchQuery}".</div>
              ) : (
                <>
                  {searchResults.kyc.map((k) => (
                    <button
                      key={k.requestId}
                      onClick={() => { setSearchQuery(''); setSearchResults(null); navigate('/kyc'); }}
                      className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex justify-between"
                    >
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{k.applicantName}</span>
                      <span className="text-[10px] font-bold text-amber-600">KYC • {k.requestId}</span>
                    </button>
                  ))}
                  {searchResults.payments.map((p) => (
                    <button
                      key={p.transactionId}
                      onClick={() => { setSearchQuery(''); setSearchResults(null); navigate('/payment'); }}
                      className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex justify-between"
                    >
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{p.transactionType}</span>
                      <span className="text-[10px] font-bold text-emerald-600">₹{p.finalAmount}</span>
                    </button>
                  ))}
                  {searchResults.queries.map((q) => (
                    <button
                      key={q.queryId}
                      onClick={() => { setSearchQuery(''); setSearchResults(null); navigate('/queries'); }}
                      className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex justify-between"
                    >
                      <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{q.subject}</span>
                      <span className="text-[10px] font-bold text-purple-600 ml-2">{q.queryId}</span>
                    </button>
                  ))}
                  {searchResults.employees.map((e) => (
                    <button
                      key={e.employeeId}
                      onClick={() => { setSearchQuery(''); setSearchResults(null); navigate('/staff'); }}
                      className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex justify-between"
                    >
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{e.name}</span>
                      <span className="text-[10px] font-bold text-indigo-600">{e.employeeId}</span>
                    </button>
                  ))}
                  {searchResults.tasks.map((t) => (
                    <button
                      key={t.taskId}
                      onClick={() => { setSearchQuery(''); setSearchResults(null); navigate('/tasks'); }}
                      className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex justify-between"
                    >
                      <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{t.title}</span>
                      <span className="text-[10px] font-bold text-slate-500 ml-2">{t.taskId}</span>
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifMenu(!showNotifMenu)}
            className="relative p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 flex items-center justify-center w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold ring-2 ring-white dark:ring-slate-900">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifMenu && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl py-3 z-50">
              <div className="flex items-center justify-between px-4 pb-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Notifications ({unreadCount})
                </span>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">
                    No active notifications.
                  </div>
                ) : (
                  notifications.map(n => (
                    <div
                      key={n.notificationId}
                      className={`p-3.5 text-xs transition-colors ${
                        !n.isRead
                          ? 'bg-indigo-50/40 dark:bg-indigo-950/20 font-medium'
                          : 'opacity-70'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <ShieldAlert className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {n.title}
                          </div>
                          <div className="text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                            {n.message}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="px-4 pt-2 border-t border-slate-100 dark:border-slate-800 text-center">
                <button
                  onClick={() => {
                    setShowNotifMenu(false);
                    navigate('/notifications');
                  }}
                  className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Open Notifications Center →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
          {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
        </button>

        {/* User Profile & Logout */}
        <div className="flex items-center pl-2 border-l border-slate-200 dark:border-slate-800">
          <button
            onClick={logout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold transition-colors"
            title="Log out from Backoffice"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
};

