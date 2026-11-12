import mongoose, { Document, Schema } from 'mongoose';

export interface IAuditTrail extends Document {
  actorId: string;
  actorName: string;
  actorRole: string;
  department: string;
  action: string;
  module: 'AUTH' | 'STAFF' | 'KYC' | 'PAYMENT' | 'QUERIES' | 'SALARY' | 'TASK' | 'SECURITY' | 'SETTINGS';
  targetId?: string;
  details: string;
  ipAddress: string;
  userAgent: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

const AuditTrailSchema = new Schema<IAuditTrail>({
  actorId: { type: String, required: true, index: true },
  actorName: { type: String, required: true },
  actorRole: { type: String, required: true },
  department: { type: String, default: '' },
  action: { type: String, required: true, index: true },
  module: {
    type: String,
    enum: ['AUTH', 'STAFF', 'KYC', 'PAYMENT', 'QUERIES', 'SALARY', 'TASK', 'SECURITY', 'SETTINGS'],
    required: true,
    index: true
  },
  targetId: { type: String, default: '' },
  details: { type: String, required: true },
  ipAddress: { type: String, default: '127.0.0.1' },
  userAgent: { type: String, default: '' },
  metadata: { type: Schema.Types.Mixed, default: {} },
  timestamp: { type: Date, default: Date.now, index: true }
}, {
  timestamps: false,
  collection: 'backoffice_audit_trails'
});

AuditTrailSchema.index({ module: 1, timestamp: -1 });

export const AuditTrail = mongoose.model<IAuditTrail>('backoffice_audit_trails', AuditTrailSchema);

