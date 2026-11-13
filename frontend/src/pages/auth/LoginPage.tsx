import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Lock, Mail, ArrowRight, AlertCircle, ShieldCheck, UserCheck, ArrowUpRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redirectByRole = (userRole?: string) => {
    if (userRole === 'overall_lead') {
      navigate('/overall');
    } else if (userRole?.includes('kyc')) {
      navigate('/kyc');
    } else if (userRole?.includes('payment')) {
      navigate('/payment');
    } else if (userRole?.includes('queries')) {
      navigate('/queries');
    } else {
      navigate('/');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const loggedUser = await login(email, password);
      redirectByRole(loggedUser?.role);
    } catch (err: any) {
      setError(err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (quickEmail: string, quickPass: string, targetPath: string) => {
    setError(null);
    setLoading(true);
    setEmail(quickEmail);
    setPassword(quickPass);

    try {
      const loggedUser = await login(quickEmail, quickPass);
      navigate(targetPath || (loggedUser?.role?.includes('kyc') ? '/kyc' : '/overall'));
    } catch (err: any) {
      setError(err.message || 'Quick login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-xl space-y-6">
        {/* Brand */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 text-white shadow-xl shadow-indigo-500/25 mb-2">
            <Building2 className="w-8 h-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white uppercase">
            Connect App
          </h1>
          <p className="text-sm font-semibold tracking-wider text-indigo-400 uppercase">
            Centralized Backoffice Operations Platform
          </p>
        </div>

        {/* Login Card */}
        <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6 sm:p-8 shadow-2xl space-y-6">
          {error && (
            <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Staff Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="name@connectapp.in"
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold tracking-wide transition-all shadow-lg shadow-indigo-600/30 disabled:opacity-50"
            >
              {loading ? (
                <span>Authenticating...</span>
              ) : (
                <>
                  <span>Sign In to Backoffice</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick 1-Click Role Login Section */}
          <div className="pt-4 border-t border-slate-800 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
              <span>Quick 1-Click Role Login (Moves to Dashboard)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* KYC Team Lead - Primary Highlight */}
              <button
                type="button"
                disabled={loading}
                onClick={() => handleQuickLogin('kyc.lead@connectapp.in', 'Connect@2026', '/kyc')}
                className="p-3.5 rounded-2xl bg-indigo-950/40 hover:bg-indigo-900/50 border border-indigo-500/50 hover:border-indigo-400 text-left transition-all group disabled:opacity-50 shadow-md"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-white group-hover:text-indigo-300 flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-indigo-400" />
                    KYC Team Lead
                  </span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-indigo-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </div>
                <div className="text-xs text-indigo-200/70 font-mono mt-0.5">kyc.lead@connectapp.in</div>
                <div className="text-[11px] text-slate-400 mt-1">Directly opens KYC Operations & Approvals</div>
              </button>

              {/* KYC Specialist */}
              <button
                type="button"
                disabled={loading}
                onClick={() => handleQuickLogin('kyc.staff@connectapp.in', 'Connect@2026', '/kyc')}
                className="p-3.5 rounded-2xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700 hover:border-indigo-400/50 text-left transition-all group disabled:opacity-50"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-white group-hover:text-indigo-300">KYC Specialist</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-400 transition-colors" />
                </div>
                <div className="text-xs text-slate-400 font-mono mt-0.5">kyc.staff@connectapp.in</div>
                <div className="text-[11px] text-slate-400 mt-1">Directly opens KYC Verification Queue</div>
              </button>

              {/* Overall Team Lead */}
              <button
                type="button"
                disabled={loading}
                onClick={() => handleQuickLogin('lead@connectapp.in', 'Connect@2026', '/overall')}
                className="p-3.5 rounded-2xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700 hover:border-indigo-400/50 text-left transition-all group disabled:opacity-50"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-white group-hover:text-indigo-300">Overall Team Lead</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-400 transition-colors" />
                </div>
                <div className="text-xs text-slate-400 font-mono mt-0.5">lead@connectapp.in</div>
                <div className="text-[11px] text-slate-400 mt-1">Directly opens Overall Executive Dashboard</div>
              </button>

              {/* Payment Team Lead */}
              <button
                type="button"
                disabled={loading}
                onClick={() => handleQuickLogin('payment.lead@connectapp.in', 'Connect@2026', '/payment')}
                className="p-3.5 rounded-2xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700 hover:border-indigo-400/50 text-left transition-all group disabled:opacity-50"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-white group-hover:text-indigo-300">Payment Team Lead</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-400 transition-colors" />
                </div>
                <div className="text-xs text-slate-400 font-mono mt-0.5">payment.lead@connectapp.in</div>
                <div className="text-[11px] text-slate-400 mt-1">Directly opens Payment & Ledger Dashboard</div>
              </button>

              {/* Queries Team Lead */}
              <button
                type="button"
                disabled={loading}
                onClick={() => handleQuickLogin('queries.lead@connectapp.in', 'Connect@2026', '/queries')}
                className="sm:col-span-2 p-3.5 rounded-2xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700 hover:border-indigo-400/50 text-left transition-all group disabled:opacity-50"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-white group-hover:text-indigo-300">Queries Team Lead</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-400 transition-colors" />
                </div>
                <div className="text-xs text-slate-400 font-mono mt-0.5">queries.lead@connectapp.in</div>
                <div className="text-[11px] text-slate-400 mt-1">Directly opens Queries & Support Dashboard</div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


