import React, { useState, useEffect, useRef } from 'react';
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
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
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

function resolveHeaderMeta(pathname: string, user: any): { title: string; subtitle: string } {
  const role = user?.role || '';
  if (pathname === '/overall') {
    return {
      title: 'Total Operations Dashboard',
      subtitle: 'Complete overview of KYC, Payments, Queries and Support'
    };
  }
  if (pathname.startsWith('/kyc')) {
    if (role === 'kyc_employee') {
      return {
        title: 'My KYC Dashboard',
        subtitle: 'Process assigned KYC verifications'
      };
    }
    return {
      title: 'KYC Operations Dashboard',
      subtitle: 'Monitor KYC verification, re-uploads and team performance'
    };
  }
  if (pathname.startsWith('/payment')) {
    if (role === 'payment_employee') {
      return {
        title: 'My Payment Dashboard',
        subtitle: 'Process payment requests and approvals'
      };
    }
    return {
      title: 'Payment Operations Dashboard',
      subtitle: 'Track payment verifications, approvals and settlements'
    };
  }
  if (pathname.startsWith('/queries')) {
    if (role === 'queries_employee') {
      return {
        title: 'Queries Operations Dashboard',
        subtitle: role === 'queries_employee' ? 'Resolve assigned customer & vendor support tickets' : 'Manage customer, vendor and partner queries'
      };
    }
    return {
      title: 'Queries Operations Dashboard',
      subtitle: 'Manage customer, vendor and partner queries'
    };
  }
  if (pathname.startsWith('/staff')) {
    return {
      title: 'Staff Directory',
      subtitle: 'Manage backoffice personnel, roles & permissions'
    };
  }
  if (pathname.startsWith('/salary')) {
    return {
      title: 'Salary Management',
      subtitle: 'Monthly payroll cycles, structures & disbursements'
    };
  }
  if (pathname.startsWith('/tasks')) {
    return {
      title: 'Task Management',
      subtitle: 'Cross-functional operational task allocations'
    };
  }
  if (pathname.startsWith('/reports')) {
    return {
      title: 'Reports & Analytics',
      subtitle: 'Enterprise audit exports & performance metrics'
    };
  }
  return {
    title: ROUTE_TITLES[pathname] || 'Support Operations',
    subtitle: `${user?.department || 'Operations'} — Live Telemetry`
  };
}

export const Header: React.FC<HeaderProps> = ({ onToggleSidebar, isCollapsed, onToggleCollapse }) => {
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

  const notifRef = useRef<HTMLDivElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Close notification popover & search dropdown on outside click or Escape key
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifMenu(false);
      }
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchResults(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowNotifMenu(false);
        setSearchResults(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const headerMeta = resolveHeaderMeta(location.pathname, user);

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
        // Suppress background polling noise in console
      }
    };

    let lastNotifFetchAt = Date.now();
    fetchNotifications();
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      lastNotifFetchAt = Date.now();
      fetchNotifications();
    }, 30000);

    const handleVisibility = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        if (Date.now() - lastNotifFetchAt >= 20000) {
          lastNotifFetchAt = Date.now();
          fetchNotifications();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
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
      {/* Left: Mobile Toggle, Desktop Collapse, Breadcrumb Title & Global Search */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <button
          onClick={onToggleSidebar}
          className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden"
        >
          <Menu className="w-5 h-5" />
        </button>
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="hidden lg:flex p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <div className="hidden md:block shrink-0">
          <div className="text-base font-black text-slate-900 dark:text-white leading-tight tracking-tight">
            {headerMeta.title}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            {headerMeta.subtitle}
          </div>
        </div>

        {/* Global Search Bar */}
        <div ref={searchContainerRef} className="relative ml-2 sm:ml-4 max-w-sm w-full hidden sm:block">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by ID, user, request, amount..."
            className="w-full pl-9 pr-4 py-2 rounded-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
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
                      onClick={() => {
                        const targetId = k.requestId || k.applicantId;
                        setSearchQuery('');
                        setSearchResults(null);
                        navigate(`/kyc/all?search=${encodeURIComponent(targetId)}&openId=${encodeURIComponent(targetId)}`);
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex justify-between"
                    >
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{k.applicantName}</span>
                      <span className="text-[10px] font-bold text-amber-600">KYC • {k.requestId}</span>
                    </button>
                  ))}
                  {searchResults.payments.map((p) => (
                    <button
                      key={p.transactionId}
                      onClick={() => {
                        const targetId = p.transactionId;
                        setSearchQuery('');
                        setSearchResults(null);
                        navigate(`/payment/all?search=${encodeURIComponent(targetId)}&openId=${encodeURIComponent(targetId)}`);
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex justify-between"
                    >
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{p.transactionType}</span>
                      <span className="text-[10px] font-bold text-emerald-600">₹{p.finalAmount}</span>
                    </button>
                  ))}
                  {searchResults.queries.map((q) => (
                    <button
                      key={q.queryId}
                      onClick={() => {
                        const targetId = q.queryId;
                        setSearchQuery('');
                        setSearchResults(null);
                        navigate(`/queries/all?search=${encodeURIComponent(targetId)}&openId=${encodeURIComponent(targetId)}`);
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex justify-between"
                    >
                      <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{q.subject}</span>
                      <span className="text-[10px] font-bold text-purple-600 ml-2">{q.queryId}</span>
                    </button>
                  ))}
                  {searchResults.employees.map((e) => (
                    <button
                      key={e.employeeId}
                      onClick={() => {
                        const targetId = e.employeeId;
                        setSearchQuery('');
                        setSearchResults(null);
                        navigate(`/staff/all?search=${encodeURIComponent(targetId)}&openId=${encodeURIComponent(targetId)}`);
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex justify-between"
                    >
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{e.name}</span>
                      <span className="text-[10px] font-bold text-indigo-600">{e.employeeId}</span>
                    </button>
                  ))}
                  {searchResults.tasks.map((t) => (
                    <button
                      key={t.taskId}
                      onClick={() => {
                        const targetId = t.taskId;
                        setSearchQuery('');
                        setSearchResults(null);
                        navigate(`/tasks?search=${encodeURIComponent(targetId)}&openId=${encodeURIComponent(targetId)}`);
                      }}
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
        <div ref={notifRef} className="relative">
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

        {/* User Profile Pill with Role */}
        <div className="flex items-center gap-2 pl-3 border-l border-slate-200 dark:border-slate-800">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 to-amber-600 text-slate-950 font-black text-xs flex items-center justify-center shadow-sm shrink-0">
            {user?.name?.charAt(0) || 'U'}
          </div>
          <div className="hidden md:block text-left leading-tight">
            <div className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[130px]">
              {user?.name || 'Staff Member'}
            </div>
            <div className="text-[10px] font-bold text-[#1D4ED8] dark:text-amber-400">
              {user?.role === 'overall_lead' ? 'Total Lead ▼' : user?.role === 'kyc_lead' ? 'KYC Lead ▼' : user?.role === 'payment_lead' ? 'Payment Lead ▼' : user?.role === 'queries_lead' ? 'Queries Lead ▼' : user?.role === 'kyc_employee' ? 'KYC Executive ▼' : user?.role === 'payment_employee' ? 'Payment Executive ▼' : user?.role === 'queries_employee' ? 'Queries Executive ▼' : 'Staff ▼'}
            </div>
          </div>
          <button
            onClick={logout}
            className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
            title="Log out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};

