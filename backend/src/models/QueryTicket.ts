import mongoose, { Document, Schema } from 'mongoose';
import { Department, QueryStatus } from '../config/constants';

export interface IQueryMessage {
  messageId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  message: string;
  attachments?: string[];
  timestamp: Date;
}

export interface IInternalNote {
  noteId: string;
  authorId: string;
  authorName: string;
  department: Department;
  note: string;
  isDepartmentPrivate: boolean;
  timestamp: Date;
}

export interface ITransferLog {
  fromDepartment: Department;
  toDepartment: Department;
  transferredByUserId: string;
  transferredByName: string;
  reason: string;
  transferredAt: Date;
}

export interface IQueryTicket extends Document {
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
  status: QueryStatus;
  currentDepartment: Department;
  sourceDepartment: Department;
  sharedDepartments: Department[];
  assignedEmployeeId?: string | null;
  assignedEmployeeName?: string | null;
  conversation: IQueryMessage[];
  internalNotes: IInternalNote[];
  transferHistory: ITransferLog[];
  resolution?: {
    resolvedByUserId: string;
    resolvedByName: string;
    resolvedByRole?: string;
    resolvedByDepartment?: string;
    resolvedAt: Date;
    resolutionNotes: string;
  };
  lastUpdated: Date;
  createdAt: Date;
  updatedAt: Date;
}

const QueryMessageSchema = new Schema<IQueryMessage>({
  messageId: { type: String, required: true },
  senderId: { type: String, required: true },
  senderName: { type: String, required: true },
  senderRole: { type: String, required: true },
  message: { type: String, required: true },
  attachments: [{ type: String }],
  timestamp: { type: Date, default: Date.now }
}, { _id: false });

const InternalNoteSchema = new Schema<IInternalNote>({
  noteId: { type: String, required: true },
  authorId: { type: String, required: true },
  authorName: { type: String, required: true },
  department: { type: String, enum: Object.values(Department), required: true },
  note: { type: String, required: true },
  isDepartmentPrivate: { type: Boolean, default: false },
  timestamp: { type: Date, default: Date.now }
}, { _id: false });

const TransferLogSchema = new Schema<ITransferLog>({
  fromDepartment: { type: String, enum: Object.values(Department), required: true },
  toDepartment: { type: String, enum: Object.values(Department), required: true },
  transferredByUserId: { type: String, required: true },
  transferredByName: { type: String, required: true },
  reason: { type: String, required: true },
  transferredAt: { type: Date, default: Date.now }
}, { _id: false });

const QueryTicketSchema = new Schema<IQueryTicket>({
  queryId: { type: String, required: true, unique: true, index: true },
  userType: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  userName: { type: String, required: true, trim: true },
  userEmail: { type: String, default: '' },
  userPhone: { type: String, default: '' },
  category: { type: String, required: true, index: true },
  subject: { type: String, required: true, trim: true },
  description: { type: String, required: true },
  priority: { type: String, enum: ['Low', 'Medium', 'High', 'Urgent'], default: 'Medium', index: true },
  status: {
    type: String,
    enum: Object.values(QueryStatus),
    default: QueryStatus.NEW,
    index: true
  },
  currentDepartment: {
    type: String,
    enum: Object.values(Department),
    default: Department.QUERIES,
    index: true
  },
  sourceDepartment: {
    type: String,
    enum: Object.values(Department),
    default: Department.QUERIES
  },
  sharedDepartments: [{
    type: String,
    enum: Object.values(Department)
  }],
  assignedEmployeeId: { type: String, default: null, index: true },
  assignedEmployeeName: { type: String, default: null },
  conversation: [QueryMessageSchema],
  internalNotes: [InternalNoteSchema],
  transferHistory: [TransferLogSchema],
  resolution: {
    resolvedByUserId: { type: String },
    resolvedByName: { type: String },
    resolvedByRole: { type: String, default: '' },
    resolvedByDepartment: { type: String, default: '' },
    resolvedAt: { type: Date },
    resolutionNotes: { type: String }
  },
  lastUpdated: { type: Date, default: Date.now }
}, {
  timestamps: true,
  collection: 'backoffice_query_tickets'
});

QueryTicketSchema.index({ sharedDepartments: 1, status: 1 });
QueryTicketSchema.index({ assignedEmployeeId: 1, status: 1 });

export const QueryTicket = mongoose.model<IQueryTicket>('backoffice_query_tickets', QueryTicketSchema);

