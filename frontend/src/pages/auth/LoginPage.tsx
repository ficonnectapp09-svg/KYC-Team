import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Lock, Mail, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('Connect@2026');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(email, password);
      navigate('/overall');
    } catch (err: any) {
      setError(err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  const quickLogins = [
    { label: 'Overall Team Lead', email: 'lead@connectapp.in', role: 'Full System Oversight' },
    { label: 'KYC Team Lead', email: 'kyc.lead@connectapp.in', role: 'KYC Operations' },
    { label: 'Payment Team Lead', email: 'payment.lead@connectapp.in', role: 'Financial Checker' },
    { label: 'Queries Team Lead', email: 'queries.lead@connectapp.in', role: 'Support Operations' },
    { label: 'KYC Staff Officer', email: 'kyc.staff@connectapp.in', role: 'Document Verifier' },
    { label: 'Payment Staff Officer', email: 'payment.staff@connectapp.in', role: 'Financial Maker' },
    { label: 'Queries Support Staff', email: 'queries.staff@connectapp.in', role: 'Case Handler' }
  ];

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

          {/* Quick Demo Role Picker */}
          <div className="pt-4 border-t border-slate-800">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Quick 1-Click Role Login
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {quickLogins.map(loginItem => (
                <button
                  key={loginItem.email}
                  type="button"
                  onClick={() => {
                    setEmail(loginItem.email);
                    setPassword('Connect@2026');
                  }}
                  className="p-2.5 rounded-xl border border-slate-800 bg-slate-800/60 hover:bg-indigo-950/40 hover:border-indigo-800 text-left transition-all"
                >
                  <div className="text-xs font-bold text-white">
                    {loginItem.label}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {loginItem.email}
                  </div>
                  <div className="text-[9px] font-semibold text-indigo-400 mt-0.5">
                    {loginItem.role}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

