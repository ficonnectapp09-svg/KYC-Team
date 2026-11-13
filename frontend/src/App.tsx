import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './pages/auth/LoginPage';
import { OverallDashboard } from './pages/overall/OverallDashboard';
import { StaffManagement } from './pages/staff/StaffManagement';
import { KycManagement } from './pages/kyc/KycManagement';
import { PaymentManagement } from './pages/payment/PaymentManagement';
import { QueriesManagement } from './pages/queries/QueriesManagement';
import { SalaryManagement } from './pages/salary/SalaryManagement';
import { TaskManagement } from './pages/tasks/TaskManagement';
import { ReportsManagement } from './pages/reports/ReportsManagement';
import { AuditLogs } from './pages/audit/AuditLogs';
import { NotificationsPage } from './pages/notifications/NotificationsPage';
import { SettingsPage } from './pages/settings/SettingsPage';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const RoleRedirect: React.FC = () => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;

  if (user.role === 'overall_lead') return <Navigate to="/overall" replace />;
  if (user.role.includes('kyc')) return <Navigate to="/kyc" replace />;
  if (user.role.includes('payment')) return <Navigate to="/payment" replace />;
  if (user.role.includes('queries')) return <Navigate to="/queries" replace />;

  return <Navigate to="/tasks" replace />;
};

const RoleGuard: React.FC<{ allowedRoles: string[]; children: React.ReactNode }> = ({
  allowedRoles,
  children
}) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'overall_lead' || allowedRoles.includes(user.role)) {
    return <>{children}</>;
  }
  return <RoleRedirect />;
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<RoleRedirect />} />

              <Route
                path="overall"
                element={
                  <RoleGuard allowedRoles={['overall_lead']}>
                    <OverallDashboard />
                  </RoleGuard>
                }
              />

              <Route
                path="kyc"
                element={
                  <RoleGuard allowedRoles={['kyc_lead', 'kyc_employee']}>
                    <KycManagement />
                  </RoleGuard>
                }
              />
              <Route
                path="kyc/:categorySlug"
                element={
                  <RoleGuard allowedRoles={['kyc_lead', 'kyc_employee']}>
                    <KycManagement />
                  </RoleGuard>
                }
              />

              <Route
                path="payment"
                element={
                  <RoleGuard allowedRoles={['payment_lead', 'payment_employee']}>
                    <PaymentManagement />
                  </RoleGuard>
                }
              />
              <Route
                path="payment/:categorySlug"
                element={
                  <RoleGuard allowedRoles={['payment_lead', 'payment_employee']}>
                    <PaymentManagement />
                  </RoleGuard>
                }
              />
              <Route
                path="payment/income/:subSlug"
                element={
                  <RoleGuard allowedRoles={['payment_lead', 'payment_employee']}>
                    <PaymentManagement />
                  </RoleGuard>
                }
              />
              <Route
                path="payment/expenses/:subSlug"
                element={
                  <RoleGuard allowedRoles={['payment_lead', 'payment_employee']}>
                    <PaymentManagement />
                  </RoleGuard>
                }
              />
              <Route
                path="payment/customer-payments"
                element={<Navigate to="/payment/income/customer-payments" replace />}
              />
              <Route
                path="payment/membership-payments"
                element={<Navigate to="/payment/income/membership-payments" replace />}
              />
              <Route
                path="payment/vendor-payments"
                element={<Navigate to="/payment/expenses/vendor-payments" replace />}
              />
              <Route
                path="payment/vendor-settlements"
                element={<Navigate to="/payment/expenses/vendor-payments" replace />}
              />
              <Route
                path="payment/agent-tieup-payouts"
                element={<Navigate to="/payment/expenses/agent-payments" replace />}
              />
              <Route
                path="payment/delivery-partner-payments"
                element={<Navigate to="/payment/expenses/delivery-partner-payments" replace />}
              />
              <Route
                path="payment/delivery-partner-payouts"
                element={<Navigate to="/payment/expenses/delivery-partner-payments" replace />}
              />
              <Route
                path="payment/technician-payments"
                element={<Navigate to="/payment/expenses/technician-payments" replace />}
              />
              <Route
                path="payment/technician-payouts"
                element={<Navigate to="/payment/expenses/technician-payments" replace />}
              />
              <Route
                path="payment/salary-payments"
                element={<Navigate to="/salary/overview" replace />}
              />
              <Route
                path="payments/approvals"
                element={<Navigate to="/payment/maker-checker-approvals" replace />}
              />

              <Route
                path="queries"
                element={
                  <RoleGuard allowedRoles={['queries_lead', 'queries_employee']}>
                    <QueriesManagement />
                  </RoleGuard>
                }
              />
              <Route
                path="queries/:categorySlug"
                element={
                  <RoleGuard allowedRoles={['queries_lead', 'queries_employee']}>
                    <QueriesManagement />
                  </RoleGuard>
                }
              />

              <Route
                path="staff"
                element={
                  <RoleGuard allowedRoles={['overall_lead', 'kyc_lead', 'payment_lead', 'queries_lead']}>
                    <StaffManagement />
                  </RoleGuard>
                }
              />
              <Route
                path="staff/:categorySlug"
                element={
                  <RoleGuard allowedRoles={['overall_lead', 'kyc_lead', 'payment_lead', 'queries_lead']}>
                    <StaffManagement />
                  </RoleGuard>
                }
              />

              <Route path="tasks" element={<TaskManagement />} />
              <Route path="salary" element={<SalaryManagement />} />
              <Route path="salary/:categorySlug" element={<SalaryManagement />} />
              <Route path="notifications" element={<NotificationsPage />} />

              <Route
                path="reports"
                element={
                  <RoleGuard allowedRoles={['overall_lead', 'kyc_lead', 'payment_lead', 'queries_lead']}>
                    <ReportsManagement />
                  </RoleGuard>
                }
              />

              <Route
                path="audit"
                element={
                  <RoleGuard allowedRoles={['overall_lead']}>
                    <AuditLogs />
                  </RoleGuard>
                }
              />

              <Route
                path="settings"
                element={
                  <RoleGuard allowedRoles={['overall_lead']}>
                    <SettingsPage />
                  </RoleGuard>
                }
              />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;

