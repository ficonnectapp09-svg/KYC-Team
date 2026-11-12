import mongoose, { Document, Schema } from 'mongoose';
import { Role } from '../config/constants';

export interface ISystemConfig extends Document {
  configKey: string;
  kycSettings: {
    autoAssignEnabled: boolean;
    assignmentStrategy: 'least_workload' | 'round_robin';
    maxActivePerEmployee: number;
    slaHours: number;
    reuploadReminderHours: number;
    requireMandatoryRejectReason: boolean;
  };
  paymentSettings: {
    makerCheckerEnforced: boolean;
    highValueThresholdInr: number;
    agentDepositTrackedAsLiability: boolean;
    requireOverallLeadSalaryApproval: boolean;
    salaryCutoffDayMonthly: number;
    salaryCutoffDayWeekly: string;
  };
  queriesSettings: {
    autoAssignEnabled: boolean;
    slaHours: number;
    overdueEscalationHours: number;
    sharedTransferVisibility: boolean;
    maskPrivateNotesAcrossDepts: boolean;
  };
  rolePermissions: Record<string, string[]>;
  updatedBy?: {
    userId: string;
    name: string;
    at: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  [Role.OVERALL_LEAD]: [
    'dashboard:overall',
    'staff:manage_leads',
    'staff:manage_all',
    'kyc:view',
    'kyc:verify',
    'kyc:assign',
    'payment:view',
    'payment:initiate',
    'payment:checker_approve',
    'salary:prepare',
    'salary:final_approve',
    'salary:disburse',
    'queries:view',
    'queries:resolve',
    'queries:transfer',
    'tasks:manage_all',
    'reports:view_all',
    'audit:view',
    'settings:manage'
  ],
  [Role.KYC_LEAD]: [
    'dashboard:kyc',
    'staff:manage_dept',
    'kyc:view',
    'kyc:verify',
    'kyc:assign',
    'queries:view_transferred',
    'salary:dept_review',
    'salary:view_own',
    'tasks:manage_dept',
    'reports:view_dept'
  ],
  [Role.PAYMENT_LEAD]: [
    'dashboard:payment',
    'staff:manage_dept',
    'payment:view',
    'payment:initiate',
    'payment:checker_approve',
    'salary:prepare',
    'salary:dept_review',
    'salary:disburse',
    'queries:view_transferred',
    'tasks:manage_dept',
    'reports:view_dept'
  ],
  [Role.QUERIES_LEAD]: [
    'dashboard:queries',
    'staff:manage_dept',
    'queries:view',
    'queries:assign',
    'queries:resolve',
    'queries:transfer',
    'salary:dept_review',
    'salary:view_own',
    'tasks:manage_dept',
    'reports:view_dept'
  ],
  [Role.KYC_EMPLOYEE]: [
    'kyc:view_assigned',
    'kyc:verify',
    'queries:view_assigned',
    'tasks:view_own',
    'salary:view_own',
    'attendance:self'
  ],
  [Role.PAYMENT_EMPLOYEE]: [
    'payment:view',
    'payment:initiate',
    'payment:checker_approve',
    'salary:prepare',
    'salary:disburse',
    'queries:view_assigned',
    'tasks:view_own',
    'salary:view_own',
    'attendance:self'
  ],
  [Role.QUERIES_EMPLOYEE]: [
    'queries:view_assigned',
    'queries:resolve',
    'queries:transfer',
    'tasks:view_own',
    'salary:view_own',
    'attendance:self'
  ]
};

const SystemConfigSchema = new Schema<ISystemConfig>({
  configKey: { type: String, required: true, unique: true, default: 'GLOBAL_BACKOFFICE_CONFIG' },
  kycSettings: {
    autoAssignEnabled: { type: Boolean, default: true },
    assignmentStrategy: { type: String, enum: ['least_workload', 'round_robin'], default: 'least_workload' },
    maxActivePerEmployee: { type: Number, default: 25 },
    slaHours: { type: Number, default: 24 },
    reuploadReminderHours: { type: Number, default: 48 },
    requireMandatoryRejectReason: { type: Boolean, default: true }
  },
  paymentSettings: {
    makerCheckerEnforced: { type: Boolean, default: true },
    highValueThresholdInr: { type: Number, default: 50000 },
    agentDepositTrackedAsLiability: { type: Boolean, default: true },
    requireOverallLeadSalaryApproval: { type: Boolean, default: true },
    salaryCutoffDayMonthly: { type: Number, default: 28 },
    salaryCutoffDayWeekly: { type: String, default: 'Friday' }
  },
  queriesSettings: {
    autoAssignEnabled: { type: Boolean, default: true },
    slaHours: { type: Number, default: 12 },
    overdueEscalationHours: { type: Number, default: 24 },
    sharedTransferVisibility: { type: Boolean, default: true },
    maskPrivateNotesAcrossDepts: { type: Boolean, default: true }
  },
  rolePermissions: {
    type: Schema.Types.Mixed,
    default: () => DEFAULT_ROLE_PERMISSIONS
  },
  updatedBy: {
    userId: { type: String },
    name: { type: String },
    at: { type: Date }
  }
}, {
  timestamps: true,
  collection: 'backoffice_system_configs'
});

export const SystemConfig = mongoose.model<ISystemConfig>('backoffice_system_configs', SystemConfigSchema);

