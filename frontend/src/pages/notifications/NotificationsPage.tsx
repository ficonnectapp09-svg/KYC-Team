import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, ShieldAlert, ArrowRight, RefreshCw } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { NotificationItem } from '../../types';
import { Badge } from '../../components/common/Badge';
import { EmptyState } from '../../components/common/EmptyState';

export const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'UNREAD'>('ALL');
  const [error, setError] = useState('');

  const loadNotifications = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch<NotificationItem[]>('/notifications');
      if (res.success && res.data) {
        setNotifications(res.data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load notifications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const handleMarkRead = async (id: string) => {
    try {
      await apiFetch(`/notifications/${id}/read`, { method: 'PATCH' });
      setNotifications((prev) =>
        prev.map((n) => (n.notificationId === id || n._id === id ? { ...n, isRead: true } : n))
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await apiFetch('/notifications/read-all', { method: 'PATCH' });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (err) {
      console.error(err);
    }
  };

  const displayed =
    filter === 'UNREAD' ? notifications.filter((n) => !n.isRead) : notifications;

  const getTypeVariant = (t: string) => {
    if (t === 'SALARY') return 'indigo';
    if (t === 'PAYMENT') return 'emerald';
    if (t === 'KYC') return 'amber';
    if (t === 'QUERIES') return 'purple';
    return 'slate';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <Bell className="w-6 h-6 text-indigo-600" />
            Notifications Center
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Role-scoped operational alerts, workflow handoffs, and approval requests.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
            {(['ALL', 'UNREAD'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  filter === tab
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {tab === 'ALL'
                  ? `All (${notifications.length})`
                  : `Unread (${notifications.filter((n) => !n.isRead).length})`}
              </button>
            ))}
          </div>

          <button
            onClick={handleMarkAllRead}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-colors"
          >
            <CheckCheck className="w-4 h-4" />
            Mark All Read
          </button>

          <button
            onClick={loadNotifications}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
          ))}
        </div>
      ) : displayed.length === 0 ? (
        <EmptyState
          title="No Notifications Found"
          description={filter === 'UNREAD' ? 'All caught up! No unread operational alerts.' : 'No notifications recorded yet.'}
        />
      ) : (
        <div className="space-y-3">
          {displayed.map((n) => (
            <div
              key={n.notificationId}
              className={`rounded-2xl border p-4 sm:p-5 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                !n.isRead
                  ? 'bg-indigo-50/40 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-900 shadow-sm'
                  : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800'
              }`}
            >
              <div className="flex items-start gap-3.5">
                <div className="p-2.5 rounded-xl bg-indigo-100/80 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 shrink-0">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center flex-wrap gap-2">
                    <span className="font-bold text-sm text-slate-900 dark:text-white">
                      {n.title}
                    </span>
                    <Badge variant={getTypeVariant(n.type) as any}>{n.type}</Badge>
                    {!n.isRead && <Badge variant="rose">Unread</Badge>}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                    {n.message}
                  </p>
                  <div className="text-[11px] text-slate-400 mt-1.5">
                    {new Date(n.createdAt).toLocaleString()} • {n.notificationId}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {!n.isRead && (
                  <button
                    onClick={() => handleMarkRead(n.notificationId)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Mark Read
                  </button>
                )}
                {n.actionUrl && (
                  <button
                    onClick={() => {
                      if (!n.isRead) handleMarkRead(n.notificationId);
                      navigate(n.actionUrl!.startsWith('/payments') ? '/payment' : n.actionUrl!);
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-indigo-600 text-white text-xs font-semibold hover:opacity-90"
                  >
                    Open
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

