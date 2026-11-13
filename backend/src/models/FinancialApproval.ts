import mongoose, { Document, Schema } from 'mongoose';
import { ApprovalStatus, FinancialClassification } from '../config/constants';

export interface IFinancialApprovalHistory {
  action: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  actorDepartment?: string;
  details: string;
  timestamp: Date;
}

export interface IFinancialApproval extends Document {
  approvalId: string;
  transactionType: string;
  financialClassification: FinancialClassification;
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
  makerDepartment?: string;
  makerNotes?: string;
  initiatedAt: Date;
  status: ApprovalStatus;
  checkerId?: string | null;
  checkerName?: string | null;
  checkerRole?: string | null;
  checkerDepartment?: string | null;
  reviewedAt?: Date | null;
  rejectionReason?: string;
  processedAt?: Date | null;
  idempotencyKey: string;
  relatedReferenceId?: string;
  history: IFinancialApprovalHistory[];
  createdAt: Date;
  updatedAt: Date;
}

const HistorySchema = new Schema<IFinancialApprovalHistory>({
  action: { type: String, required: true },
  actorId: { type: String, required: true },
  actorName: { type: String, required: true },
  actorRole: { type: String, required: true },
  actorDepartment: { type: String, default: '' },
  details: { type: String, default: '' },
  timestamp: { type: Date, default: Date.now }
}, { _id: false });

const FinancialApprovalSchema = new Schema<IFinancialApproval>({
  approvalId: { type: String, required: true, unique: true, index: true },
  transactionType: { type: String, required: true, index: true },
  financialClassification: {
    type: String,
    enum: Object.values(FinancialClassification),
    default: FinancialClassification.OUTGOING,
    index: true
  },
  amount: { type: Number, required: true, min: 0 },
  recipientType: { type: String, required: true },
  recipientId: { type: String, required: true },
  recipientName: { type: String, required: true, trim: true },
  bankDetails: {
    accountHolder: { type: String, default: '' },
    accountNumberMasked: { type: String, default: '' },
    ifscCode: { type: String, default: '' },
    bankName: { type: String, default: '' }
  },
  makerId: { type: String, required: true, index: true },
  makerName: { type: String, required: true },
  makerRole: { type: String, required: true },
  makerDepartment: { type: String, default: '' },
  makerNotes: { type: String, default: '' },
  initiatedAt: { type: Date, default: Date.now },
  status: {
    type: String,
    enum: Object.values(ApprovalStatus),
    default: ApprovalStatus.PENDING_CHECKER,
    index: true
  },
  checkerId: { type: String, default: null, index: true },
  checkerName: { type: String, default: null },
  checkerRole: { type: String, default: null },
  checkerDepartment: { type: String, default: null },
  reviewedAt: { type: Date, default: null },
  rejectionReason: { type: String, default: '' },
  processedAt: { type: Date, default: null },
  idempotencyKey: { type: String, required: true, unique: true, index: true },
  relatedReferenceId: { type: String, default: '' },
  history: [HistorySchema]
}, {
  timestamps: true,
  collection: 'backoffice_financial_approvals'
});

FinancialApprovalSchema.index({ status: 1, makerId: 1 });
FinancialApprovalSchema.index({ status: 1, checkerId: 1 });

export const FinancialApproval = mongoose.model<IFinancialApproval>(
  'backoffice_financial_approvals',
  FinancialApprovalSchema
);

