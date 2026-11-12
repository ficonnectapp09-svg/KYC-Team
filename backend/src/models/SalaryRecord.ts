import mongoose, { Document, Schema } from 'mongoose';
import { Department, SalaryCycle, SalaryStatus } from '../config/constants';

export interface ISalaryEarnings {
  basic: number;
  hra: number;
  allowances: number;
  incentives: number;
  bonus: number;
  overtime: number;
  gross: number;
}

export interface ISalaryDeductions {
  pf: number;
  esi: number;
  tax: number;
  advanceRecovery: number;
  unpaidLeaveDeduction: number;
  other: number;
  total: number;
}

export interface ISalaryRecord extends Document {
  salaryId: string;
  employeeId: string;
  employeeName: string;
  department: Department;
  designation: string;
  salaryCycle: SalaryCycle;
  periodStart: Date;
  periodEnd: Date;
  periodLabel: string; // e.g. "October 2026" or "Week 42 - 2026"
  earnings: ISalaryEarnings;
  deductions: ISalaryDeductions;
  netSalary: number;
  bankDetails: {
    accountHolder: string;
    accountNumberMasked: string;
    ifscCode: string;
    bankName: string;
  };
  status: SalaryStatus;
  preparedBy: {
    userId: string;
    name: string;
    role: string;
    at: Date;
  };
  departmentReviewedBy?: {
    userId: string;
    name: string;
    role: string;
    at: Date;
    notes?: string;
  } | null;
  approvedByOverallLead?: {
    userId: string;
    name: string;
    role: string;
    at: Date;
    notes?: string;
  } | null;
  paidDetails?: {
    paidByUserId: string;
    paidByName: string;
    paymentDate: Date;
    transactionId: string;
    paymentMethod: string;
  } | null;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SalaryRecordSchema = new Schema<ISalaryRecord>({
  salaryId: { type: String, required: true, unique: true, index: true },
  employeeId: { type: String, required: true, index: true },
  employeeName: { type: String, required: true },
  department: { type: String, enum: Object.values(Department), required: true, index: true },
  designation: { type: String, required: true },
  salaryCycle: { type: String, enum: Object.values(SalaryCycle), default: SalaryCycle.MONTHLY },
  periodStart: { type: Date, required: true },
  periodEnd: { type: Date, required: true },
  periodLabel: { type: String, required: true },
  earnings: {
    basic: { type: Number, required: true, min: 0 },
    hra: { type: Number, default: 0 },
    allowances: { type: Number, default: 0 },
    incentives: { type: Number, default: 0 },
    bonus: { type: Number, default: 0 },
    overtime: { type: Number, default: 0 },
    gross: { type: Number, required: true }
  },
  deductions: {
    pf: { type: Number, default: 0 },
    esi: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    advanceRecovery: { type: Number, default: 0 },
    unpaidLeaveDeduction: { type: Number, default: 0 },
    other: { type: Number, default: 0 },
    total: { type: Number, required: true }
  },
  netSalary: { type: Number, required: true, min: 0 },
  bankDetails: {
    accountHolder: { type: String, default: '' },
    accountNumberMasked: { type: String, default: '' },
    ifscCode: { type: String, default: '' },
    bankName: { type: String, default: '' }
  },
  status: {
    type: String,
    enum: Object.values(SalaryStatus),
    default: SalaryStatus.SUBMITTED_FOR_OVERALL_APPROVAL,
    index: true
  },
  preparedBy: {
    userId: { type: String, required: true },
    name: { type: String, required: true },
    role: { type: String, required: true },
    at: { type: Date, default: Date.now }
  },
  departmentReviewedBy: {
    userId: { type: String },
    name: { type: String },
    role: { type: String },
    at: { type: Date },
    notes: { type: String }
  },
  approvedByOverallLead: {
    userId: { type: String },
    name: { type: String },
    role: { type: String },
    at: { type: Date },
    notes: { type: String }
  },
  paidDetails: {
    paidByUserId: { type: String },
    paidByName: { type: String },
    paymentDate: { type: Date },
    transactionId: { type: String },
    paymentMethod: { type: String }
  },
  rejectionReason: { type: String, default: '' }
}, {
  timestamps: true,
  collection: 'backoffice_salary_records'
});

SalaryRecordSchema.index({ employeeId: 1, periodLabel: 1 }, { unique: true });

export const SalaryRecord = mongoose.model<ISalaryRecord>(
  'backoffice_salary_records',
  SalaryRecordSchema
);

