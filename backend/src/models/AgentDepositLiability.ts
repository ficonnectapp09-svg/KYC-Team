import mongoose, { Document, Schema } from 'mongoose';

export interface ILiabilityMovement {
  movementId: string;
  type: 'DEPOSIT_RECEIVED' | 'REFUND_PROCESSED' | 'ADJUSTMENT' | 'FORFEITURE';
  amount: number;
  balanceAfter: number;
  reason: string;
  referenceId: string;
  processedByUserId: string;
  processedByName: string;
  processedAt: Date;
}

export interface IAgentDepositLiability extends Document {
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
  depositDate: Date;
  termsAgreementDate?: Date;
  notes?: string;
  movements: ILiabilityMovement[];
  createdAt: Date;
  updatedAt: Date;
}

const LiabilityMovementSchema = new Schema<ILiabilityMovement>({
  movementId: { type: String, required: true },
  type: {
    type: String,
    enum: ['DEPOSIT_RECEIVED', 'REFUND_PROCESSED', 'ADJUSTMENT', 'FORFEITURE'],
    required: true
  },
  amount: { type: Number, required: true },
  balanceAfter: { type: Number, required: true },
  reason: { type: String, required: true },
  referenceId: { type: String, required: true },
  processedByUserId: { type: String, required: true },
  processedByName: { type: String, required: true },
  processedAt: { type: Date, default: Date.now }
}, { _id: false });

const AgentDepositLiabilitySchema = new Schema<IAgentDepositLiability>({
  liabilityId: { type: String, required: true, unique: true, index: true },
  agentId: { type: String, required: true, index: true },
  agentName: { type: String, required: true, trim: true },
  agentPhone: { type: String, default: '', trim: true },
  agentEmail: { type: String, default: '', lowercase: true, trim: true },
  originalTransactionId: { type: String, required: true, index: true },
  depositAmount: { type: Number, required: true, min: 0 },
  currentOutstandingBalance: { type: Number, required: true, min: 0 },
  status: {
    type: String,
    enum: ['HELD', 'PARTIALLY_REFUNDED', 'REFUNDED', 'ADJUSTED', 'FORFEITED'],
    default: 'HELD'
  },
  paymentMethod: { type: String, default: 'Bank Transfer' },
  gatewayReference: { type: String, default: '' },
  depositDate: { type: Date, default: Date.now },
  termsAgreementDate: { type: Date },
  notes: { type: String, default: 'Agent initial refundable deposit held under liability balance sheet.' },
  movements: [LiabilityMovementSchema]
}, {
  timestamps: true,
  collection: 'backoffice_agent_deposit_liabilities'
});

AgentDepositLiabilitySchema.index({ agentId: 1, status: 1 });
AgentDepositLiabilitySchema.index({ currentOutstandingBalance: 1 });

export const AgentDepositLiability = mongoose.model<IAgentDepositLiability>(
  'backoffice_agent_deposit_liabilities',
  AgentDepositLiabilitySchema
);
