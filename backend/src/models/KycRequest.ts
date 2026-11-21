import mongoose, { Document, Schema } from 'mongoose';
import { ApplicantType, KycStatus } from '../config/constants';

export interface IKycDocumentItem {
  docType: string;
  docName: string;
  docUrl: string;
  version: number;
  status: 'Pending' | 'Verified' | 'Re-upload Required' | 'Rejected';
  remarks?: string;
  verifiedBy?: string;
  verifiedAt?: Date;
  uploadedAt: Date;
}

export interface IAssignmentLog {
  previousEmployeeId?: string | null;
  previousEmployeeName?: string | null;
  newEmployeeId: string;
  newEmployeeName: string;
  assignedByUserId: string;
  assignedByRole: string;
  reason: string;
  assignmentType: 'AUTOMATIC' | 'MANUAL' | 'REASSIGNMENT';
  timestamp: Date;
}

export interface IReuploadRequest {
  documentType: string;
  reason: string;
  requestedByUserId: string;
  requestedByName: string;
  requestedAt: Date;
  resolvedAt?: Date;
  isResolved: boolean;
}

export interface IKycApproverInfo {
  employeeId: string;
  name: string;
  role: string;
  department: string;
  at: Date;
  remarks?: string;
}

export interface IKycRejectorInfo {
  employeeId: string;
  name: string;
  role: string;
  department: string;
  at: Date;
  reason?: string;
}

export interface IKycApprovalEvent {
  action: string;
  status: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  actorDepartment?: string;
  timestamp: Date;
  remarks?: string;
}

export interface IKycRequest extends Document {
  requestId: string;
  applicantId: string;
  applicantName: string;
  applicantType: ApplicantType;
  phone: string;
  email: string;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  status: KycStatus;
  assignedEmployeeId?: string | null;
  assignedEmployeeName?: string | null;
  registrationDate: Date;
  submissionDate: Date;
  lastUpdated: Date;
  applicantDetails?: Record<string, any>;
  documents: IKycDocumentItem[];
  previousDocumentVersions: IKycDocumentItem[];
  reuploadRequests: IReuploadRequest[];
  assignmentHistory: IAssignmentLog[];
  verificationRemarks?: string;
  reviewedBy?: string;
  reviewedAt?: Date;
  approvedBy?: IKycApproverInfo | null;
  rejectedBy?: IKycRejectorInfo | null;
  approvalHistory: IKycApprovalEvent[];
  routedToPayment: boolean;
  paymentTaskId?: string;
  isEscalated?: boolean;
  escalatedAt?: Date | null;
  escalatedBy?: string | null;
  escalationReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const KycDocumentItemSchema = new Schema<IKycDocumentItem>({
  docType: { type: String, required: true },
  docName: { type: String, required: true },
  docUrl: { type: String, required: true },
  version: { type: Number, default: 1 },
  status: {
    type: String,
    enum: ['Pending', 'Verified', 'Re-upload Required', 'Rejected'],
    default: 'Pending'
  },
  remarks: { type: String, default: '' },
  verifiedBy: { type: String },
  verifiedAt: { type: Date },
  uploadedAt: { type: Date, default: Date.now }
}, { _id: false });

const AssignmentLogSchema = new Schema<IAssignmentLog>({
  previousEmployeeId: { type: String, default: null },
  previousEmployeeName: { type: String, default: null },
  newEmployeeId: { type: String, required: true },
  newEmployeeName: { type: String, required: true },
  assignedByUserId: { type: String, required: true },
  assignedByRole: { type: String, required: true },
  reason: { type: String, default: '' },
  assignmentType: { type: String, enum: ['AUTOMATIC', 'MANUAL', 'REASSIGNMENT'], required: true },
  timestamp: { type: Date, default: Date.now }
}, { _id: false });

const ReuploadRequestSchema = new Schema<IReuploadRequest>({
  documentType: { type: String, required: true },
  reason: { type: String, required: true },
  requestedByUserId: { type: String, required: true },
  requestedByName: { type: String, required: true },
  requestedAt: { type: Date, default: Date.now },
  resolvedAt: { type: Date },
  isResolved: { type: Boolean, default: false }
}, { _id: false });

const KycRequestSchema = new Schema<IKycRequest>({
  requestId: { type: String, required: true, unique: true, index: true },
  applicantId: { type: String, required: true, index: true },
  applicantName: { type: String, required: true, trim: true },
  applicantType: {
    type: String,
    enum: Object.values(ApplicantType),
    required: true,
    index: true
  },
  phone: { type: String, default: '', trim: true },
  email: { type: String, default: '', lowercase: true, trim: true },
  priority: { type: String, enum: ['Low', 'Medium', 'High', 'Urgent'], default: 'Medium', index: true },
  status: {
    type: String,
    enum: Object.values(KycStatus),
    default: KycStatus.UNASSIGNED,
    index: true
  },
  assignedEmployeeId: { type: String, default: null, index: true },
  assignedEmployeeName: { type: String, default: null },
  registrationDate: { type: Date, default: Date.now },
  submissionDate: { type: Date, default: Date.now },
  lastUpdated: { type: Date, default: Date.now },
  applicantDetails: { type: Schema.Types.Mixed, default: {} },
  documents: [KycDocumentItemSchema],
  previousDocumentVersions: [KycDocumentItemSchema],
  reuploadRequests: [ReuploadRequestSchema],
  assignmentHistory: [AssignmentLogSchema],
  verificationRemarks: { type: String, default: '' },
  reviewedBy: { type: String, default: '' },
  reviewedAt: { type: Date },
  approvedBy: {
    type: {
      employeeId: { type: String },
      name: { type: String },
      role: { type: String },
      department: { type: String },
      at: { type: Date },
      remarks: { type: String }
    },
    default: null
  },
  rejectedBy: {
    type: {
      employeeId: { type: String },
      name: { type: String },
      role: { type: String },
      department: { type: String },
      at: { type: Date },
      reason: { type: String }
    },
    default: null
  },
  approvalHistory: [
    new Schema({
      action: { type: String, required: true },
      status: { type: String, required: true },
      actorId: { type: String, required: true },
      actorName: { type: String, required: true },
      actorRole: { type: String, required: true },
      actorDepartment: { type: String, default: '' },
      timestamp: { type: Date, default: Date.now },
      remarks: { type: String, default: '' }
    }, { _id: false })
  ],
  routedToPayment: { type: Boolean, default: false, index: true },
  paymentTaskId: { type: String, default: null },
  isEscalated: { type: Boolean, default: false, index: true },
  escalatedAt: { type: Date, default: null },
  escalatedBy: { type: String, default: null },
  escalationReason: { type: String, default: null }
}, {
  timestamps: true,
  collection: 'backoffice_kyc_requests'
});

KycRequestSchema.index({ applicantType: 1, status: 1, priority: 1 });
KycRequestSchema.index({ assignedEmployeeId: 1, status: 1 });

export const KycRequest = mongoose.model<IKycRequest>('backoffice_kyc_requests', KycRequestSchema);

