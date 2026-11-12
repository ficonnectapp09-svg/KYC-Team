export interface NavCategoryDef {
  key: string;
  slug: string;
  label: string;
  description: string;
  shortLabel?: string;
}

export const KYC_NAV_CATEGORIES: NavCategoryDef[] = [
  { key: 'ALL', slug: 'all', label: 'All KYC Requests', description: 'Combined authorized KYC verification queue across all applicant categories' },
  { key: 'CUSTOMER', slug: 'customer', label: 'Customer KYC', description: 'Connect App customer identity verification queue' },
  { key: 'VENDOR', slug: 'vendor', label: 'Vendor KYC', description: 'Merchant & business KYC verification (auto-routes to Payment upon approval)' },
  { key: 'AGENT', slug: 'agent', label: 'Agent KYC', description: 'Field, District & State agent KYC verification (auto-routes to Payment upon approval)' },
  { key: 'MANAGER', slug: 'manager', label: 'Manager KYC', description: 'Regional, State & Division manager identity verification' },
  { key: 'SUB_ADMIN', slug: 'sub-admin', label: 'Sub Admin KYC', description: 'Territory Sub Admin & administrative onboarding verification' },
  { key: 'DELIVERY_PARTNER', slug: 'delivery-partner', label: 'Delivery Partner KYC', description: 'Rider driving license, vehicle RC & fleet verification' },
  { key: 'TECHNICIAN', slug: 'technician', label: 'Technician KYC', description: 'Service technician skill certificate & identity verification' },
  { key: 'KYC_EMPLOYEE', slug: 'kyc-employee', label: 'KYC Team Employee KYC', description: 'Internal KYC officer background & identity verification' },
  { key: 'PAYMENT_EMPLOYEE', slug: 'payment-employee', label: 'Payment Team Employee KYC', description: 'Internal Payment team employee verification' },
  { key: 'QUERIES_EMPLOYEE', slug: 'queries-employee', label: 'Queries Team Employee KYC', description: 'Internal Queries team employee verification' }
];

export const PAYMENT_NAV_CATEGORIES: NavCategoryDef[] = [
  { key: 'OVERVIEW', slug: 'overview', label: 'Payment Overview', description: 'Consolidated Income, Expenses, Agent Deposit Liabilities & separate Salary metrics' },
  { key: 'INCOME', slug: 'income', label: 'Income', description: 'Recognized revenue from Customer Payments, Vendor Subscriptions, Qualifying Agent Fees & Memberships' },
  { key: 'EXPENSES', slug: 'expenses', label: 'Expenses', description: 'Qualifying outgoing settlements & payouts to Vendors, Agents, Delivery Partners & Technicians (excludes Salaries)' },
  { key: 'AGENT_DEPOSIT_LIABILITIES', slug: 'agent-deposit-liabilities', label: 'Agent Deposit Liabilities', description: 'Refundable balance-sheet deposits (excluded from Income & Expenses)' },
  { key: 'MAKER_CHECKER_APPROVALS', slug: 'maker-checker-approvals', label: 'Maker-Checker Approvals', description: 'Dual-control authorization workflow (Maker != Checker)' },
  { key: 'ALL', slug: 'all', label: 'All Transactions', description: 'Complete persisted payment ledger across all classifications & parties' }
];

export const INCOME_SUB_CATEGORIES: NavCategoryDef[] = [
  { key: 'CUSTOMER_PAYMENTS', slug: 'customer-payments', label: 'Customer Payments', description: 'Product, Food, Daily Needs Orders and Service, Stay, Travel Bookings' },
  { key: 'VENDOR_SUBSCRIPTION_PAYMENTS', slug: 'vendor-subscription-payments', label: 'Vendor Subscription Payments', description: 'Qualifying Vendor subscription plans & renewals' },
  { key: 'AGENT_PAYMENTS_RECEIVED', slug: 'agent-payments-received', label: 'Agent Payments Received', description: 'Qualifying non-refundable agent fees (excludes deposit liabilities)' },
  { key: 'MEMBERSHIP_PAYMENTS', slug: 'membership-payments', label: 'Membership Payments', description: 'Customer membership card purchases & renewals' }
];

export const EXPENSE_SUB_CATEGORIES: NavCategoryDef[] = [
  { key: 'VENDOR_PAYMENTS', slug: 'vendor-payments', label: 'Vendor Payments', description: 'Order, Service, Stay & Travel booking settlements to Vendors' },
  { key: 'AGENT_PAYMENTS', slug: 'agent-payments', label: 'Agent Payments', description: 'Outgoing tie-up payouts, eligible incentives & approved agent commissions' },
  { key: 'DELIVERY_PARTNER_PAYMENTS', slug: 'delivery-partner-payments', label: 'Delivery Partner Payments', description: 'Outgoing delivery fees & adjustments paid to Delivery Partners' },
  { key: 'TECHNICIAN_PAYMENTS', slug: 'technician-payments', label: 'Technician Payments', description: 'Outgoing service booking payouts to Technicians' }
];

export const SALARY_NAV_CATEGORIES: NavCategoryDef[] = [
  { key: 'OVERVIEW', slug: 'overview', label: 'Salary Overview', description: 'Payroll commitments, pending approvals & disbursed salary metrics' },
  { key: 'RECORDS', slug: 'records', label: 'Employee Salary Records', description: 'All authorized payroll records and compensation structures' },
  { key: 'WEEKLY', slug: 'weekly', label: 'Weekly Salary', description: 'Weekly cycle staff payroll preparation & payouts' },
  { key: 'MONTHLY', slug: 'monthly', label: 'Monthly Salary', description: 'Monthly cycle payroll records & disbursements' },
  { key: 'PENDING_APPROVALS', slug: 'pending-approvals', label: 'Pending Salary Approvals', description: 'Statements awaiting Overall Team Lead final approval' },
  { key: 'APPROVED', slug: 'approved', label: 'Approved Salaries', description: 'Approved payroll ready for Payment Team disbursement' },
  { key: 'HISTORY', slug: 'history', label: 'Salary Payment History', description: 'Paid & failed salary disbursement ledger' },
  { key: 'PAYSLIPS', slug: 'payslips', label: 'Payslips', description: 'Printable employee payslips and approval audit trail' }
];

export const QUERY_NAV_CATEGORIES: NavCategoryDef[] = [
  { key: 'ALL', slug: 'all', label: 'All Queries', description: 'Combined authorized support cases across your department & shared transfers' },
  { key: 'CUSTOMER', slug: 'customer', label: 'Customer Queries', description: 'Queries originated by Connect App Customers' },
  { key: 'VENDOR', slug: 'vendor', label: 'Vendor Queries', description: 'Settlement, KYC & storefront queries originated by Vendors' },
  { key: 'AGENT', slug: 'agent', label: 'Agent Queries', description: 'Tie-up, deposit & onboarding queries originated by Agents' },
  { key: 'MANAGER', slug: 'manager', label: 'Manager Queries', description: 'Territory & escalation queries originated by Managers' },
  { key: 'SUB_ADMIN', slug: 'sub-admin', label: 'Sub Admin Queries', description: 'Regional administrative support tickets from Sub Admins' },
  { key: 'DELIVERY_PARTNER', slug: 'delivery-partner', label: 'Delivery Partner Queries', description: 'Payout & trip support queries from Delivery Partners' },
  { key: 'TECHNICIAN', slug: 'technician', label: 'Technician Queries', description: 'Service job & settlement queries from Technicians' },
  { key: 'KYC_TEAM', slug: 'kyc-team', label: 'KYC Team Queries', description: 'Outreach & follow-up requests originated by KYC Team' },
  { key: 'PAYMENT_TEAM', slug: 'payment-team', label: 'Payment Team Queries', description: 'Bank/UTR clarification queries originated by Payment Team' },
  { key: 'QUERIES_INTERNAL', slug: 'queries-internal', label: 'Queries Team Internal Requests', description: 'Internal operational handoffs within Queries Team' }
];

export const STAFF_DIRECTORY_CATEGORIES: NavCategoryDef[] = [
  { key: 'ALL', slug: 'all', label: 'All Staff', description: 'All authorized backoffice personnel records' },
  { key: 'OVERALL_LEAD', slug: 'overall-lead', label: 'Overall Team Lead', description: 'Organization-wide operational leadership' },
  { key: 'KYC_LEAD', slug: 'kyc-lead', label: 'KYC Team Lead', description: 'KYC Department leadership' },
  { key: 'KYC_EMPLOYEES', slug: 'kyc-employees', label: 'KYC Employees', description: 'KYC verification officers & analysts' },
  { key: 'PAYMENT_LEAD', slug: 'payment-lead', label: 'Payment Team Lead', description: 'Payment Operations Lead & Checker' },
  { key: 'PAYMENT_EMPLOYEES', slug: 'payment-employees', label: 'Payment Employees', description: 'Payment Makers & settlement specialists' },
  { key: 'QUERIES_LEAD', slug: 'queries-lead', label: 'Queries Team Lead', description: 'Queries & escalation lead' },
  { key: 'QUERIES_EMPLOYEES', slug: 'queries-employees', label: 'Queries Employees', description: 'Support executives handling multi-party tickets' },
  { key: 'OTHER_STAFF', slug: 'other-staff', label: 'Other Authorized Staff', description: 'Cross-functional or specialist staff roles' }
];

