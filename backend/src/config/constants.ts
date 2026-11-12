export enum Department {
  OVERALL = 'Overall',
  KYC = 'KYC Team',
  PAYMENT = 'Payment Team',
  QUERIES = 'Queries Team'
}

export enum Role {
  OVERALL_LEAD = 'overall_lead',
  KYC_LEAD = 'kyc_lead',
  PAYMENT_LEAD = 'payment_lead',
  QUERIES_LEAD = 'queries_lead',
  KYC_EMPLOYEE = 'kyc_employee',
  PAYMENT_EMPLOYEE = 'payment_employee',
  QUERIES_EMPLOYEE = 'queries_employee'
}

export enum ApplicantType {
  CUSTOMER = 'Customer',
  VENDOR = 'Vendor',
  AGENT = 'Agent',
  MANAGER = 'Manager',
  SUB_ADMIN = 'Sub Admin',
  DELIVERY_PARTNER = 'Delivery Partner',
  TECHNICIAN = 'Technician',
  KYC_EMPLOYEE = 'KYC Team Employee',
  PAYMENT_EMPLOYEE = 'Payment Team Employee',
  QUERIES_EMPLOYEE = 'Queries Team Employee'
}

export enum KycStatus {
  UNASSIGNED = 'Unassigned',
  ASSIGNED = 'Assigned',
  IN_PROGRESS = 'In Progress',
  APPROVED = 'Approved',
  REJECTED = 'Rejected',
  RE_UPLOAD_REQUESTED = 'Re-upload Requested'
}

export enum FinancialClassification {
  INCOME = 'Income',
  OUTGOING = 'Outgoing',
  LIABILITY = 'Liability'
}

export enum ApprovalStatus {
  DRAFT = 'Draft',
  SUBMITTED = 'Submitted for Approval',
  PENDING_CHECKER = 'Pending Checker Review',
  APPROVED = 'Approved',
  REJECTED = 'Rejected',
  PROCESSING = 'Processing',
  COMPLETED = 'Completed',
  FAILED = 'Failed',
  CANCELLED = 'Cancelled'
}

export enum SalaryCycle {
  WEEKLY = 'Weekly',
  MONTHLY = 'Monthly',
  CUSTOM = 'Custom'
}

export enum SalaryStatus {
  DRAFT = 'Draft',
  PREPARED = 'Prepared',
  SUBMITTED_FOR_OVERALL_APPROVAL = 'Submitted for Overall Approval',
  APPROVED = 'Approved',
  REJECTED = 'Rejected',
  PROCESSING = 'Processing',
  PAID = 'Paid',
  FAILED = 'Failed'
}

export enum QueryStatus {
  NEW = 'New',
  ASSIGNED = 'Assigned',
  IN_PROGRESS = 'In Progress',
  WAITING_FOR_RESPONSE = 'Waiting for Response',
  TRANSFERRED_TO_KYC = 'Transferred to KYC',
  TRANSFERRED_TO_PAYMENT = 'Transferred to Payment',
  RESOLVED = 'Resolved',
  REOPENED = 'Reopened',
  OVERDUE = 'Overdue'
}

export enum TaskStatus {
  NEW = 'New',
  ASSIGNED = 'Assigned',
  ACCEPTED = 'Accepted',
  IN_PROGRESS = 'In Progress',
  ON_HOLD = 'On Hold',
  SUBMITTED_FOR_REVIEW = 'Submitted for Review',
  COMPLETED = 'Completed',
  REJECTED = 'Rejected',
  REASSIGNED = 'Reassigned',
  CANCELLED = 'Cancelled'
}

