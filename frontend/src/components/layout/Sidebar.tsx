import React, { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  ShieldCheck,
  CreditCard,
  MessageSquare,
  Users,
  CheckSquare,
  Banknote,
  BarChart3,
  ScrollText,
  Building2,
  ChevronRight,
  ChevronDown,
  Bell,
  Settings
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { apiFetch } from '../../services/api';
import {
  KYC_NAV_CATEGORIES,
  PAYMENT_NAV_CATEGORIES,
  QUERY_NAV_CATEGORIES,
  SALARY_NAV_CATEGORIES,
  NavCategoryDef
} from '../../config/categoryCatalog';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

type ExpandableSectionKey = 'kyc' | 'payment' | 'queries' | 'salary';

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const role = user?.role || 'overall_lead';

  const isOverall = role === 'overall_lead';
  const isKyc = isOverall || role.includes('kyc');
  const isPayment = isOverall || role.includes('payment');
  const isQueries = isOverall || role.includes('queries');
  const isLead = isOverall || role.includes('lead');

  const [expanded, setExpanded] = useState<Record<ExpandableSectionKey, boolean>>({
    kyc: location.pathname.startsWith('/kyc'),
    payment: location.pathname.startsWith('/payment'),
    queries: location.pathname.startsWith('/queries'),
    salary: location.pathname.startsWith('/salary')
  });

  const [kycCounts, setKycCounts] = useState<Record<string, number>>({});
  const [paymentCounts, setPaymentCounts] = useState<Record<string, number>>({});
  const [queryCounts, setQueryCounts] = useState<Record<string, number>>({});
  const [salaryCounts, setSalaryCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (location.pathname.startsWith('/kyc')) {
      setExpanded(prev => ({ ...prev, kyc: true }));
    } else if (location.pathname.startsWith('/payment')) {
      setExpanded(prev => ({ ...prev, payment: true }));
    } else if (location.pathname.startsWith('/queries')) {
      setExpanded(prev => ({ ...prev, queries: true }));
    } else if (location.pathname.startsWith('/salary')) {
      setExpanded(prev => ({ ...prev, salary: true }));
    }
  }, [location.pathname]);

  useEffect(() => {
    let active = true;
    const loadCounts = async () => {
      try {
        if (isKyc) {
          const r = await apiFetch<Record<string, number>>('/kyc/categories/counts');
          if (active && r.success && r.data) setKycCounts(r.data);
        }
        if (isPayment) {
          const r = await apiFetch<Record<string, number>>('/payments/categories/counts');
          if (active && r.success && r.data) setPaymentCounts(r.data);
        }
        if (isQueries) {
          const r = await apiFetch<Record<string, number>>('/queries/categories/counts');
          if (active && r.success && r.data) setQueryCounts(r.data);
        }
        const sr = await apiFetch<Record<string, number>>('/salary/categories/counts');
        if (active && sr.success && sr.data) setSalaryCounts(sr.data);
      } catch {
        // Non-blocking background count badge refresh
      }
    };
    loadCounts();
    return () => {
      active = false;
    };
  }, [isKyc, isPayment, isQueries, location.pathname]);

  const toggleExpand = (key: ExpandableSectionKey, defaultPath: string) => {
    setExpanded(prev => {
      const next = !prev[key];
      if (next && !location.pathname.startsWith(`/${key}`)) {
        navigate(defaultPath);
      }
      return { ...prev, [key]: next };
    });
  };

  const expandableGroups: {
    key: ExpandableSectionKey;
    label: string;
    icon: any;
    show: boolean;
    basePath: string;
    defaultPath: string;
    categories: NavCategoryDef[];
    counts: Record<string, number>;
    roleHint?: string;
  }[] = [
    {
      key: 'kyc',
      label: 'KYC Operations',
      icon: ShieldCheck,
      show: isKyc,
      basePath: '/kyc',
      defaultPath: '/kyc/all',
      categories: KYC_NAV_CATEGORIES,
      counts: kycCounts,
      roleHint: role === 'kyc_lead' || isOverall ? 'Lead + Queue' : 'Assigned'
    },
    {
      key: 'payment',
      label: 'Payment Operations',
      icon: CreditCard,
      show: isPayment,
      basePath: '/payment',
      defaultPath: '/payment/overview',
      categories: PAYMENT_NAV_CATEGORIES,
      counts: paymentCounts,
      roleHint: role === 'payment_lead' || isOverall ? 'Checker' : 'Maker'
    },
    {
      key: 'queries',
      label: 'Queries Operations',
      icon: MessageSquare,
      show: isQueries,
      basePath: '/queries',
      defaultPath: '/queries/all',
      categories: QUERY_NAV_CATEGORIES,
      counts: queryCounts
    }
  ];

  const salaryGroup = {
    key: 'salary' as ExpandableSectionKey,
    label: 'Salary Management',
    icon: Banknote,
    show: true,
    basePath: '/salary',
    defaultPath: '/salary/overview',
    categories: SALARY_NAV_CATEGORIES,
    counts: salaryCounts,
    roleHint: isOverall ? 'Approver' : undefined
  };

  const midItems = [
    { label: 'Staff Directory', path: '/staff', icon: Users, show: isLead },
    { label: 'Task Allocation', path: '/tasks', icon: CheckSquare, show: true }
  ];

  const tailItems = [
    { label: 'Reports & Analytics', path: '/reports', icon: BarChart3, show: isLead },
    { label: 'Notifications', path: '/notifications', icon: Bell, show: true },
    { label: 'Audit Logs', path: '/audit', icon: ScrollText, show: isOverall },
    { label: 'Settings', path: '/settings', icon: Settings, show: isOverall }
  ];

  const renderAccordionGroup = (group: (typeof expandableGroups)[number]) => {
    const Icon = group.icon;
    const isParentActive = location.pathname.startsWith(group.basePath);
    const isGroupOpen = expanded[group.key];

    return (
      <div key={group.key} className="space-y-0.5">
        <button
          type="button"
          onClick={() => toggleExpand(group.key, group.defaultPath)}
          aria-expanded={isGroupOpen}
          className={`w-full flex items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all duration-150 ${
            isParentActive
              ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <Icon className="w-4 h-4 shrink-0 stroke-[2]" />
            <span className="truncate">{group.label}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {group.roleHint && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {group.roleHint}
              </span>
            )}
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform duration-200 ${
                isGroupOpen ? 'rotate-180 text-indigo-600 dark:text-indigo-400' : 'opacity-50'
              }`}
            />
          </div>
        </button>

        {/* Animated Nested Submenu */}
        <div
          className={`grid transition-all duration-200 ease-in-out ${
            isGroupOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          }`}
        >
          <div className="overflow-hidden">
            <div className="ml-4 pl-3 my-1 border-l-2 border-slate-200/80 dark:border-slate-800 space-y-0.5">
              {group.categories.map(sub => {
                const targetPath = `${group.basePath}/${sub.slug}`;
                const isDefaultFallback =
                  location.pathname === group.basePath && sub.slug === group.categories[0].slug;
                const isSubActive =
                  location.pathname === targetPath ||
                  location.pathname.startsWith(`${targetPath}/`) ||
                  isDefaultFallback;
                const count = group.counts[sub.key];

                return (
                  <NavLink
                    key={sub.key}
                    to={targetPath}
                    onClick={onClose}
                    className={() =>
                      `flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                        isSubActive
                          ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-slate-200'
                      }`
                    }
                  >
                    <span className="truncate">{sub.label}</span>
                    {typeof count === 'number' && (
                      <span
                        className={`shrink-0 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                          isSubActive
                            ? 'bg-white/20 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {count}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col bg-white dark:bg-slate-900 border-r border-slate-200/80 dark:border-slate-800 transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="flex h-16 shrink-0 items-center gap-3 px-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-600 text-white font-bold shadow-md shadow-indigo-500/20">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-extrabold tracking-tight text-slate-900 dark:text-white uppercase">
              Connect App
            </h1>
            <span className="text-[10px] font-semibold tracking-wider text-indigo-600 dark:text-indigo-400 uppercase">
              Centralized Backoffice
            </span>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 px-3.5 py-4 space-y-1 overflow-y-auto">
          <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Operations Platform
          </div>

          {/* 1. Overall Dashboard */}
          {isOverall && (
            <NavLink
              to="/overall"
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all duration-150 ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200'
                }`
              }
            >
              <div className="flex items-center gap-3">
                <LayoutDashboard className="w-4 h-4 stroke-[2]" />
                <span>Overall Dashboard</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 opacity-40" />
            </NavLink>
          )}

          {/* 2-4. Expandable Department Operations */}
          {expandableGroups.filter(g => g.show).map(renderAccordionGroup)}

          {/* 5-6. Staff & Task Menus */}
          {midItems
            .filter(item => item.show)
            .map(item => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all duration-150 ${
                      isActive
                        ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200'
                    }`
                  }
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4 stroke-[2]" />
                    <span>{item.label}</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 opacity-40" />
                </NavLink>
              );
            })}

          {/* 7. Independent Expandable Salary Management Module (Section 31 E) */}
          {salaryGroup.show && renderAccordionGroup(salaryGroup)}

          {/* 8-11. Reports, Notifications, Audit & Settings */}
          {tailItems
            .filter(item => item.show)
            .map(item => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all duration-150 ${
                      isActive
                        ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200'
                    }`
                  }
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4 stroke-[2]" />
                    <span>{item.label}</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 opacity-40" />
                </NavLink>
              );
            })}
        </nav>

        {/* Department Info Badge */}
        <div className="p-4 m-3.5 rounded-xl border border-slate-200/60 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 shrink-0">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Logged In As
          </div>
          <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5 truncate">
            {user?.name || 'Administrator'}
          </div>
          <div className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 truncate">
            {user?.designation || 'Operational Staff'}
          </div>
          <div className="mt-2 inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300">
            {user?.department}
          </div>
        </div>
      </aside>
    </>
  );
};
