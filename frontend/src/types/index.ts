export type Department = 'Overall' | 'KYC Team' | 'Payment Team' | 'Queries Team';

export type Role =
  | 'overall_lead'
  | 'kyc_lead'
  | 'payment_lead'
  | 'queries_lead'
  | 'kyc_employee'
  | 'payment_employee'
  | 'queries_employee';

export interface User {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  phone: string;
  department: Department;
  designation: string;
  role: Role;
  photo?: string;
  permissions: string[];
}

export interface Employee {
  _id: string;
  employeeId: string;
  name: string;
  email: string;
  phone: string;
  photo?: string;
  department: Department;
  designation: string;
  role: Role;
  reportingLead?: string;
  joiningDate: string;
  employmentType: 'Full-time' | 'Part-time' | 'Contract';
  workLocation: string;
  address?: string;
  salaryCycle: 'Weekly' | 'Monthly';
  bankDetails?: {
    accountHolder: string;
    accountNumber: string;
    ifscCode: string;
    bankName: string;
  };
  status: 'active' | 'inactive' | 'suspended';
  permissions: string[];
  createdAt: string;
}

export interface KycRequest {
  _id: string;
  requestId: string;
  applicantId: string;
  applicantName: string;
  applicantType: string;
  phone: string;
  email: string;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  status: 'Unassigned' | 'Assigned' | 'In Progress' | 'Approved' | 'Rejected' | 'Re-upload Requested';
  assignedEmployeeId?: string | null;
  assignedEmployeeName?: string | null;
  registrationDate: string;
  submissionDate: string;
  lastUpdated: string;
  applicantDetails?: Record<string, any>;
  documents: {
    docType: string;
    docName: string;
    docUrl: string;
    version: number;
    status: 'Pending' | 'Verified' | 'Re-upload Required' | 'Rejected';
    remarks?: string;
    verifiedBy?: string;
  }[];
  previousDocumentVersions: any[];
  reuploadRequests: {
    documentType: string;
    reason: string;
    requestedByName: string;
    requestedAt: string;
    isResolved: boolean;
  }[];
  assignmentHistory: {
    previousEmployeeName?: string;
    newEmployeeName: string;
    assignedByRole: string;
    reason: string;
    assignmentType: string;
    timestamp: string;
  }[];
  verificationRemarks?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  routedToPayment: boolean;
  paymentTaskId?: string;
}

export interface PaymentTransaction {
  _id: string;
  transactionId: string;
  referenceId: string;
  transactionType: string;
  financialClassification: 'Income' | 'Outgoing' | 'Liability';
  fromParty: { id: string; name: string; type: string };
  toParty: { id: string; name: string; type: string };
  amount: number;
  grossAmount: number;
  tax: number;
  discount: number;
  commission: number;
  deductions: number;
  finalAmount: number;
  paymentMethod: string;
  gatewayReference?: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REFUNDED' | 'ON_HOLD';
  handledByEmployeeId?: string;
  handledByEmployeeName?: string;
  department: string;
  makerApprovalId?: string;
  transactionDate: string;
  notes?: string;
  metadata?: Record<string, any>;
}

export interface AgentDepositLiability {
  _id: string;
  liabilityId: string;
  agentId: string;
  agentName: string;
  agentPhone: string;
  agentEmail: string;
  originalTransactionId: string;
  depositAmount: number;
  currentOutstandingBalance: number;
  status: 'HELD' | 'PARTIALLY_REFUNDED' | 'REFUNDED' | 'ADJUSTED' | 'FORFEITED';
  paymentMethod: string;
  gatewayReference?: string;
  depositDate: string;
  notes?: string;
  movements: {
    movementId: string;
    type: string;
    amount: number;
    balanceAfter: number;
    reason: string;
    referenceId: string;
    processedByName: string;
    processedAt: string;
  }[];
}

export interface FinancialApproval {
  _id: string;
  approvalId: string;
  transactionType: string;
  financialClassification: 'Income' | 'Outgoing' | 'Liability';
  amount: number;
  recipientType: string;
  recipientId: string;
  recipientName: string;
  bankDetails?: {
    accountHolder: string;
    accountNumberMasked: string;
    ifscCode: string;
    bankName: string;
  };
  makerId: string;
  makerName: string;
  makerRole: string;
  makerNotes?: string;
  initiatedAt: string;
  status: 'Draft' | 'Submitted for Approval' | 'Pending Checker Review' | 'Approved' | 'Rejected' | 'Processing' | 'Completed' | 'Cancelled';
  checkerId?: string;
  checkerName?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  idempotencyKey: string;
}

export interface QueryTicket {
  _id: string;
  queryId: string;
  userType: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  category: string;
  subject: string;
  description: string;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  status: 'New' | 'Assigned' | 'In Progress' | 'Waiting for Response' | 'Transferred to KYC' | 'Transferred to Payment' | 'Resolved' | 'Reopened';
  currentDepartment: Department;
  sourceDepartment: Department;
  sharedDepartments: Department[];
  assignedEmployeeId?: string | null;
  assignedEmployeeName?: string;
  conversation: {
    messageId: string;
    senderId: string;
    senderName: string;
    senderRole: string;
    message: string;
    attachments?: string[];
    timestamp: string;
  }[];
  internalNotes: {
    noteId: string;
    authorName: string;
    department: Department;
    note: string;
    isDepartmentPrivate: boolean;
    timestamp: string;
  }[];
  transferHistory: {
    fromDepartment: Department;
    toDepartment: Department;
    transferredByName: string;
    reason: string;
    transferredAt: string;
  }[];
  resolution?: {
    resolvedByName: string;
    resolvedAt: string;
    resolutionNotes: string;
  };
  lastUpdated: string;
  createdAt: string;
}

export interface SalaryRecord {
  _id: string;
  salaryId: string;
  employeeId: string;
  employeeName: string;
  department: Department;
  designation: string;
  salaryCycle: 'Weekly' | 'Monthly';
  periodLabel: string;
  earnings: {
    basic: number;
    hra: number;
    allowances: number;
    incentives: number;
    bonus: number;
    overtime: number;
    gross: number;
  };
  deductions: {
    pf: number;
    esi: number;
    tax: number;
    advanceRecovery: number;
    unpaidLeaveDeduction: number;
    other: number;
    total: number;
  };
  netSalary: number;
  bankDetails: {
    accountHolder: string;
    accountNumberMasked: string;
    ifscCode: string;
    bankName: string;
  };
  status: 'Draft' | 'Prepared' | 'Submitted for Overall Approval' | 'Approved' | 'Rejected' | 'Processing' | 'Paid';
  preparedBy: {
    name: string;
    role: string;
    at: string;
  };
  departmentReviewedBy?: {
    userId?: string;
    name: string;
    role?: string;
    at: string;
    notes?: string;
  };
  approvedByOverallLead?: {
    name: string;
    at: string;
    notes?: string;
  };
  paidDetails?: {
    paidByName: string;
    paymentDate: string;
    transactionId: string;
    paymentMethod: string;
  };
  rejectionReason?: string;
  createdAt: string;
}

export interface TaskItem {
  _id: string;
  taskId: string;
  title: string;
  description: string;
  department: Department;
  assignedTo: {
    employeeId: string;
    name: string;
    role: string;
  };
  assignedBy: {
    name: string;
    role: string;
  };
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  status: 'New' | 'Assigned' | 'Accepted' | 'In Progress' | 'On Hold' | 'Submitted for Review' | 'Completed' | 'Rejected' | 'Reassigned' | 'Cancelled';
  dueDate: string;
  submittedEvidence?: string;
  comments: {
    authorName: string;
    comment: string;
    timestamp: string;
  }[];
  createdAt: string;
}

export interface NotificationItem {
  _id: string;
  notificationId: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  actionUrl?: string;
  createdAt: string;
}

export interface AuditTrail {
  _id: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  department: string;
  action: string;
  module: string;
  targetId?: string;
  details: string;
  ipAddress: string;
  timestamp: string;
}

