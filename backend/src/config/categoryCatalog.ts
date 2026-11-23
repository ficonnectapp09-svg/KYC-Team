import { ApplicantType, Role } from './constants';

export interface CategoryDefinition {
  key: string;
  slug: string;
  label: string;
  description: string;
}

/**
 * 1. KYC OPERATIONS - APPLICANT CATEGORIES
 */
export const KYC_CATEGORIES: (CategoryDefinition & { applicantType?: ApplicantType })[] = [
  { key: 'ALL', slug: 'all', label: 'All KYC Requests', description: 'Combined authorized KYC verification queue across all applicant categories' },
  { key: 'CUSTOMER', slug: 'customer', label: 'Customer KYC', applicantType: ApplicantType.CUSTOMER, description: 'Connect App customer identity verification requests' },
  { key: 'VENDOR', slug: 'vendor', label: 'Vendor KYC', applicantType: ApplicantType.VENDOR, description: 'Merchant & store onboarding verification (auto-routes to Payment upon approval)' },
  { key: 'AGENT', slug: 'agent', label: 'Agent KYC', applicantType: ApplicantType.AGENT, description: 'Field, District & State agent KYC verification (auto-routes to Payment deposit check)' },
  { key: 'MANAGER', slug: 'manager', label: 'Manager KYC', applicantType: ApplicantType.MANAGER, description: 'Regional, State, District & Division manager KYC verification' },
  { key: 'DELIVERY_PARTNER', slug: 'delivery-partner', label: 'Delivery Partner KYC', applicantType: ApplicantType.DELIVERY_PARTNER, description: 'Logistics rider & fleet delivery partner document verification' },
  { key: 'TECHNICIAN', slug: 'technician', label: 'Technician KYC', applicantType: ApplicantType.TECHNICIAN, description: 'Service technician skill & identity verification' },
  { key: 'KYC_EMPLOYEE', slug: 'kyc-employee', label: 'KYC Team Employee KYC', applicantType: ApplicantType.KYC_EMPLOYEE, description: 'Internal KYC department employee onboarding verification' },
  { key: 'PAYMENT_EMPLOYEE', slug: 'payment-employee', label: 'Payment Team Employee KYC', applicantType: ApplicantType.PAYMENT_EMPLOYEE, description: 'Internal Payment department employee onboarding verification' },
  { key: 'QUERIES_EMPLOYEE', slug: 'queries-employee', label: 'Queries Team Employee KYC', applicantType: ApplicantType.QUERIES_EMPLOYEE, description: 'Internal Queries department employee onboarding verification' }
];

const KYC_SLUG_TO_DEF = new Map<string, (typeof KYC_CATEGORIES)[number]>();
KYC_CATEGORIES.forEach((cat) => {
  KYC_SLUG_TO_DEF.set(cat.key.toUpperCase(), cat);
  KYC_SLUG_TO_DEF.set(cat.slug.toLowerCase(), cat);
  if (cat.applicantType) {
    KYC_SLUG_TO_DEF.set(cat.applicantType.toUpperCase(), cat);
  }
});

export function resolveKycCategory(raw?: string | null) {
  if (!raw || raw === 'All' || raw === 'ALL') return KYC_CATEGORIES[0];
  return (
    KYC_SLUG_TO_DEF.get(String(raw).trim().toUpperCase()) ||
    KYC_SLUG_TO_DEF.get(String(raw).trim().toLowerCase()) ||
    null
  );
}

/**
 * 2. PAYMENT OPERATIONS - INCOME, EXPENSES, LIABILITIES & APPROVALS (Section 31)
 * Note: Salary Management is intentionally a separate top-level module, excluded from Expenses.
 */
export type PaymentSourceModel = 'OVERVIEW' | 'TRANSACTION' | 'LIABILITY' | 'APPROVAL';

export interface PaymentCategoryDef extends CategoryDefinition {
  sourceModel: PaymentSourceModel;
  sectionGroup?: 'MAIN' | 'INCOME' | 'EXPENSES';
  txnFilter?: Record<string, any>;
}

const EXPENSE_EXCLUSIONS = ['Salary Payment', 'Agent Deposit Refund'];

export const INCOME_BASE_FILTER = {
  financialClassification: 'Income'
};

export const EXPENSE_BASE_FILTER = {
  financialClassification: 'Outgoing',
  transactionType: { $nin: EXPENSE_EXCLUSIONS }
};

export const PAYMENT_CATEGORIES: PaymentCategoryDef[] = [
  {
    key: 'OVERVIEW',
    slug: 'overview',
    label: 'Payment Overview',
    sourceModel: 'OVERVIEW',
    sectionGroup: 'MAIN',
    description: 'Consolidated dashboard separating Income, Expenses, Agent Deposit Liabilities, and Salary metrics'
  },
  {
    key: 'INCOME',
    slug: 'income',
    label: 'Income',
    sourceModel: 'TRANSACTION',
    sectionGroup: 'MAIN',
    txnFilter: INCOME_BASE_FILTER,
    description: 'Recognized revenue across Customer orders/bookings, Vendor subscriptions, qualifying Agent fees, and Memberships'
  },
  {
    key: 'EXPENSES',
    slug: 'expenses',
    label: 'Expenses',
    sourceModel: 'TRANSACTION',
    sectionGroup: 'MAIN',
    txnFilter: EXPENSE_BASE_FILTER,
    description: 'Qualifying external settlements & payouts to Vendors, Agents, Delivery Partners, and Technicians (excludes Salaries)'
  },
  {
    key: 'AGENT_DEPOSIT_LIABILITIES',
    slug: 'agent-deposit-liabilities',
    label: 'Agent Deposit Liabilities',
    sourceModel: 'LIABILITY',
    sectionGroup: 'MAIN',
    description: 'Balance-sheet refundable security deposits (strictly separated from Income & Expenses)'
  },
  {
    key: 'MAKER_CHECKER_APPROVALS',
    slug: 'maker-checker-approvals',
    label: 'Maker-Checker Approvals',
    sourceModel: 'APPROVAL',
    sectionGroup: 'MAIN',
    description: 'Dual-control authorization queue enforcing Maker != Checker'
  },
  {
    key: 'ALL',
    slug: 'all',
    label: 'All Transactions',
    sourceModel: 'TRANSACTION',
    sectionGroup: 'MAIN',
    txnFilter: {},
    description: 'Complete persisted payment ledger across all parties and classifications'
  },

  // --- Income Sub-Categories (Section 31 B) ---
  {
    key: 'CUSTOMER_PAYMENTS',
    slug: 'customer-payments',
    label: 'Customer Payments',
    sourceModel: 'TRANSACTION',
    sectionGroup: 'INCOME',
    txnFilter: {
      financialClassification: 'Income',
      $or: [
        {
          transactionType: {
            $in: [
              'Customer Order Payment',
              'Product Order Payment',
              'Food Order Payment',
              'Daily Needs Order Payment',
              'Service Booking Payment',
              'Stay Booking Payment',
              'Travel Booking Payment',
              'Customer Booking Payment'
            ]
          }
        },
        {
          'fromParty.type': 'Customer',
          transactionType: { $not: /Membership/i }
        }
      ]
    },
    description: 'Customer payments for Product, Food, Daily Needs Orders and Service, Stay, Travel Bookings'
  },
  {
    key: 'VENDOR_SUBSCRIPTION_PAYMENTS',
    slug: 'vendor-subscription-payments',
    label: 'Vendor Subscription Payments',
    sourceModel: 'TRANSACTION',
    sectionGroup: 'INCOME',
    txnFilter: {
      financialClassification: 'Income',
      $or: [
        { 'fromParty.type': 'Vendor' },
        { transactionType: { $regex: 'Vendor Subscription|Subscription Plan|Subscription Renewal', $options: 'i' } }
      ]
    },
    description: 'Qualifying Vendor subscription plans and renewals recognized as revenue'
  },
  {
    key: 'AGENT_PAYMENTS_RECEIVED',
    slug: 'agent-payments-received',
    label: 'Agent Payments Received',
    sourceModel: 'TRANSACTION',
    sectionGroup: 'INCOME',
    txnFilter: {
      financialClassification: 'Income',
      transactionType: { $ne: 'Agent Initial Deposit' },
      $or: [
        { 'fromParty.type': 'Agent' },
        { transactionType: { $regex: 'Agent.*(Fee|Charge|Onboarding|Platform|Income)', $options: 'i' } }
      ]
    },
    description: 'Qualifying non-refundable agent fees recognized as revenue (excludes initial deposit liabilities)'
  },
  {
    key: 'MEMBERSHIP_PAYMENTS',
    slug: 'membership-payments',
    label: 'Membership Payments',
    sourceModel: 'TRANSACTION',
    sectionGroup: 'INCOME',
    txnFilter: {
      financialClassification: 'Income',
      transactionType: { $regex: 'Membership', $options: 'i' }
    },
    description: 'Customer membership card purchases and renewals'
  },

  // --- Expense Sub-Categories (Section 31 C, strictly excludes Salary Payment & Deposit Refunds) ---
  {
    key: 'VENDOR_PAYMENTS',
    slug: 'vendor-payments',
    label: 'Vendor Payments',
    sourceModel: 'TRANSACTION',
    sectionGroup: 'EXPENSES',
    txnFilter: {
      financialClassification: 'Outgoing',
      transactionType: { $nin: EXPENSE_EXCLUSIONS },
      $or: [
        { 'toParty.type': 'Vendor' },
        {
          transactionType: {
            $in: [
              'Vendor Settlement',
              'Vendor Order Settlement',
              'Vendor Booking Settlement',
              'Vendor Payout'
            ]
          }
        }
      ]
    },
    description: 'Outgoing settlements paid to Vendors for customer orders and service/stay/travel bookings'
  },
  {
    key: 'AGENT_PAYMENTS',
    slug: 'agent-payments',
    label: 'Agent Payments',
    sourceModel: 'TRANSACTION',
    sectionGroup: 'EXPENSES',
    txnFilter: {
      financialClassification: 'Outgoing',
      transactionType: { $nin: EXPENSE_EXCLUSIONS },
      $or: [
        { 'toParty.type': 'Agent' },
        { transactionType: { $regex: 'Agent.*(Payout|Tie-up|Incentive|Commission)', $options: 'i' } }
      ]
    },
    description: 'Outgoing tie-up payouts, eligible incentives, and approved commissions paid to Agents'
  },
  {
    key: 'DELIVERY_PARTNER_PAYMENTS',
    slug: 'delivery-partner-payments',
    label: 'Delivery Partner Payments',
    sourceModel: 'TRANSACTION',
    sectionGroup: 'EXPENSES',
    txnFilter: {
      financialClassification: 'Outgoing',
      transactionType: { $nin: EXPENSE_EXCLUSIONS },
      $or: [
        { 'toParty.type': 'Delivery Partner' },
        { transactionType: { $regex: 'Delivery Partner', $options: 'i' } }
      ]
    },
    description: 'Outgoing delivery fees and adjustments paid to Delivery Partners'
  },
  {
    key: 'TECHNICIAN_PAYMENTS',
    slug: 'technician-payments',
    label: 'Technician Payments',
    sourceModel: 'TRANSACTION',
    sectionGroup: 'EXPENSES',
    txnFilter: {
      financialClassification: 'Outgoing',
      transactionType: { $nin: EXPENSE_EXCLUSIONS },
      $or: [
        { 'toParty.type': 'Technician' },
        { transactionType: { $regex: 'Technician', $options: 'i' } }
      ]
    },
    description: 'Outgoing service booking payouts paid to Technicians'
  }
];

const PAYMENT_CATEGORY_ALIASES: Record<string, string> = {
  VENDOR_SETTLEMENTS: 'VENDOR_PAYMENTS',
  'vendor-settlements': 'VENDOR_PAYMENTS',
  AGENT_TIEUP_PAYOUTS: 'AGENT_PAYMENTS',
  'agent-tieup-payouts': 'AGENT_PAYMENTS',
  DELIVERY_PARTNER_PAYOUTS: 'DELIVERY_PARTNER_PAYMENTS',
  'delivery-partner-payouts': 'DELIVERY_PARTNER_PAYMENTS',
  TECHNICIAN_PAYOUTS: 'TECHNICIAN_PAYMENTS',
  'technician-payouts': 'TECHNICIAN_PAYMENTS'
};

const PAY_KEY_MAP = new Map<string, PaymentCategoryDef>();
PAYMENT_CATEGORIES.forEach((cat) => {
  PAY_KEY_MAP.set(cat.key.toUpperCase(), cat);
  PAY_KEY_MAP.set(cat.slug.toLowerCase(), cat);
});
Object.entries(PAYMENT_CATEGORY_ALIASES).forEach(([alias, targetKey]) => {
  const target = PAY_KEY_MAP.get(targetKey);
  if (target) {
    PAY_KEY_MAP.set(alias.toUpperCase(), target);
    PAY_KEY_MAP.set(alias.toLowerCase(), target);
  }
});

export function resolvePaymentCategory(raw?: string | null): PaymentCategoryDef | null {
  if (!raw || raw === 'All' || raw === 'ALL') {
    return PAY_KEY_MAP.get('ALL') || PAYMENT_CATEGORIES[5];
  }
  return (
    PAY_KEY_MAP.get(String(raw).trim().toUpperCase()) ||
    PAY_KEY_MAP.get(String(raw).trim().toLowerCase()) ||
    null
  );
}

/**
 * 2B. SALARY MANAGEMENT - SEPARATE PAYROLL MODULE CATEGORIES (Section 31 E)
 */
export interface SalaryCategoryDef extends CategoryDefinition {
  cycleFilter?: 'Weekly' | 'Monthly';
  statusFilter?: string[];
}

export const SALARY_CATEGORIES: SalaryCategoryDef[] = [
  { key: 'OVERVIEW', slug: 'overview', label: 'Salary Overview', description: 'Payroll commitments, pending Overall Team Lead approvals, and disbursed totals' },
  { key: 'RECORDS', slug: 'records', label: 'Employee Salary Records', description: 'Complete staff payroll ledger across all cycles and departments' },
  { key: 'WEEKLY', slug: 'weekly', label: 'Weekly Salary', cycleFilter: 'Weekly', description: 'Weekly cycle payroll records and payout preparation' },
  { key: 'MONTHLY', slug: 'monthly', label: 'Monthly Salary', cycleFilter: 'Monthly', description: 'Monthly cycle payroll records and salary statements' },
  {
    key: 'PENDING_APPROVALS',
    slug: 'pending-approvals',
    label: 'Pending Salary Approvals',
    statusFilter: ['Prepared', 'Submitted for Overall Approval', 'Draft'],
    description: 'Payroll statements awaiting final Overall Team Lead approval'
  },
  {
    key: 'APPROVED',
    slug: 'approved',
    label: 'Approved Salaries',
    statusFilter: ['Approved', 'Processing'],
    description: 'Salaries approved by Overall Team Lead ready for disbursement'
  },
  {
    key: 'HISTORY',
    slug: 'history',
    label: 'Salary Payment History',
    statusFilter: ['Paid', 'Failed'],
    description: 'Disbursed and failed salary payment audit history'
  },
  { key: 'PAYSLIPS', slug: 'payslips', label: 'Payslips', description: 'Printable employee payslips and bank disbursement references' }
];

const SALARY_KEY_MAP = new Map<string, SalaryCategoryDef>();
SALARY_CATEGORIES.forEach((cat) => {
  SALARY_KEY_MAP.set(cat.key.toUpperCase(), cat);
  SALARY_KEY_MAP.set(cat.slug.toLowerCase(), cat);
});

export function resolveSalaryCategory(raw?: string | null): SalaryCategoryDef | null {
  if (!raw || raw === 'All' || raw === 'ALL') return SALARY_CATEGORIES[0];
  return (
    SALARY_KEY_MAP.get(String(raw).trim().toUpperCase()) ||
    SALARY_KEY_MAP.get(String(raw).trim().toLowerCase()) ||
    null
  );
}

/**
 * 3. QUERIES OPERATIONS - SOURCE USER TYPE CATEGORIES
 */
export interface QueryCategoryDef extends CategoryDefinition {
  userTypes?: string[];
}

export const QUERY_CATEGORIES: QueryCategoryDef[] = [
  { key: 'ALL', slug: 'all', label: 'All Queries', description: 'Combined query cases accessible to your authorized department scope' },
  { key: 'CUSTOMER', slug: 'customer', label: 'Customer Queries', userTypes: ['Customer'], description: 'Order, booking, refund & account queries submitted by Customers' },
  { key: 'VENDOR', slug: 'vendor', label: 'Vendor Queries', userTypes: ['Vendor'], description: 'Settlement, catalog & onboarding queries submitted by Vendors' },
  { key: 'AGENT', slug: 'agent', label: 'Agent Queries', userTypes: ['Agent'], description: 'Deposit, commission & onboarding queries from Connect App Agents' },
  { key: 'MANAGER', slug: 'manager', label: 'Manager Queries', userTypes: ['Manager'], description: 'Operational & territory support requests from Managers' },
  { key: 'DELIVERY_PARTNER', slug: 'delivery-partner', label: 'Delivery Partner Queries', userTypes: ['Delivery Partner'], description: 'Trip settlement, vehicle KYC & payout queries from Delivery Partners' },
  { key: 'TECHNICIAN', slug: 'technician', label: 'Technician Queries', userTypes: ['Technician'], description: 'Service job & payout queries submitted by Technicians' },
  { key: 'KYC_TEAM', slug: 'kyc-team', label: 'KYC Team Queries', userTypes: ['KYC Team', 'KYC Team Employee'], description: 'Escalations and support tickets raised by KYC Team staff' },
  { key: 'PAYMENT_TEAM', slug: 'payment-team', label: 'Payment Team Queries', userTypes: ['Payment Team', 'Payment Team Employee'], description: 'Reconciliation and payout clarification queries from Payment Team' },
  { key: 'QUERIES_INTERNAL', slug: 'queries-internal', label: 'Queries Team Internal Requests', userTypes: ['Queries Team Internal', 'Queries Team', 'Queries Team Employee'], description: 'Internal operational handoffs & requests within Queries Team' }
];

const QUERY_KEY_MAP = new Map<string, QueryCategoryDef>();
QUERY_CATEGORIES.forEach((cat) => {
  QUERY_KEY_MAP.set(cat.key.toUpperCase(), cat);
  QUERY_KEY_MAP.set(cat.slug.toLowerCase(), cat);
  cat.userTypes?.forEach((ut) => QUERY_KEY_MAP.set(ut.toUpperCase(), cat));
});

export function resolveQueryCategory(raw?: string | null): QueryCategoryDef | null {
  if (!raw || raw === 'All' || raw === 'ALL') return QUERY_CATEGORIES[0];
  return (
    QUERY_KEY_MAP.get(String(raw).trim().toUpperCase()) ||
    QUERY_KEY_MAP.get(String(raw).trim().toLowerCase()) ||
    null
  );
}

/**
 * 4. STAFF DIRECTORY - ROLE-WISE CATEGORIES
 */
export interface StaffCategoryDef extends CategoryDefinition {
  roleFilter?: Role | 'OTHER';
  expectedDepartment?: string;
}

export const STAFF_CATEGORIES: StaffCategoryDef[] = [
  { key: 'ALL', slug: 'all', label: 'All Staff', description: 'All authorized backoffice personnel records' },
  { key: 'OVERALL_LEAD', slug: 'overall-lead', label: 'Overall Team Lead', roleFilter: Role.OVERALL_LEAD, expectedDepartment: 'Overall', description: 'Organization-wide operational leadership' },
  { key: 'KYC_LEAD', slug: 'kyc-lead', label: 'KYC Team Lead', roleFilter: Role.KYC_LEAD, expectedDepartment: 'KYC Team', description: 'KYC Department leadership & workload supervisors' },
  { key: 'KYC_EMPLOYEES', slug: 'kyc-employees', label: 'KYC Employees', roleFilter: Role.KYC_EMPLOYEE, expectedDepartment: 'KYC Team', description: 'KYC verification officers & specialists' },
  { key: 'PAYMENT_LEAD', slug: 'payment-lead', label: 'Payment Team Lead', roleFilter: Role.PAYMENT_LEAD, expectedDepartment: 'Payment Team', description: 'Payment Department Checker & payroll supervisors' },
  { key: 'PAYMENT_EMPLOYEES', slug: 'payment-employees', label: 'Payment Employees', roleFilter: Role.PAYMENT_EMPLOYEE, expectedDepartment: 'Payment Team', description: 'Payment Makers & financial operations specialists' },
  { key: 'QUERIES_LEAD', slug: 'queries-lead', label: 'Queries Team Lead', roleFilter: Role.QUERIES_LEAD, expectedDepartment: 'Queries Team', description: 'Queries & escalation supervisors' },
  { key: 'QUERIES_EMPLOYEES', slug: 'queries-employees', label: 'Queries Employees', roleFilter: Role.QUERIES_EMPLOYEE, expectedDepartment: 'Queries Team', description: 'Customer, Vendor & Partner support executives' },
  { key: 'OTHER_STAFF', slug: 'other-staff', label: 'Other Authorized Staff', roleFilter: 'OTHER', description: 'Contractual, specialist & cross-functional authorized backoffice roles' }
];

const STAFF_KEY_MAP = new Map<string, StaffCategoryDef>();
STAFF_CATEGORIES.forEach((cat) => {
  STAFF_KEY_MAP.set(cat.key.toUpperCase(), cat);
  STAFF_KEY_MAP.set(cat.slug.toLowerCase(), cat);
});

export function resolveStaffCategory(raw?: string | null): StaffCategoryDef | null {
  if (!raw || raw === 'All' || raw === 'ALL') return STAFF_CATEGORIES[0];
  return (
    STAFF_KEY_MAP.get(String(raw).trim().toUpperCase()) ||
    STAFF_KEY_MAP.get(String(raw).trim().toLowerCase()) ||
    null
  );
}

