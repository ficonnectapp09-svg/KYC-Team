import mongoose, { Document, Schema } from 'mongoose';
import { FinancialClassification } from '../config/constants';

export interface IPaymentTransaction extends Document {
  transactionId: string;
  referenceId: string;
  transactionType: string;
  financialClassification: FinancialClassification;
  fromParty: {
    id: string;
    name: string;
    type: string;
  };
  toParty: {
    id: string;
    name: string;
    type: string;
  };
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
  transactionDate: Date;
  notes?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const PartySchema = new Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  type: { type: String, required: true }
}, { _id: false });

const PaymentTransactionSchema = new Schema<IPaymentTransaction>({
  transactionId: { type: String, required: true, unique: true, index: true },
  referenceId: { type: String, required: true, index: true },
  transactionType: { type: String, required: true, index: true },
  financialClassification: {
    type: String,
    enum: Object.values(FinancialClassification),
    required: true,
    index: true
  },
  fromParty: { type: PartySchema, required: true },
  toParty: { type: PartySchema, required: true },
  amount: { type: Number, required: true },
  grossAmount: { type: Number, default: 0 },
  tax: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  commission: { type: Number, default: 0 },
  deductions: { type: Number, default: 0 },
  finalAmount: { type: Number, required: true },
  paymentMethod: { type: String, default: 'Bank Transfer' },
  gatewayReference: { type: String, default: '' },
  status: {
    type: String,
    enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED', 'ON_HOLD'],
    default: 'PENDING',
    index: true
  },
  handledByEmployeeId: { type: String, default: '' },
  handledByEmployeeName: { type: String, default: '' },
  department: { type: String, default: 'Payment Team' },
  makerApprovalId: { type: String, default: null },
  transactionDate: { type: Date, default: Date.now, index: true },
  notes: { type: String, default: '' },
  metadata: { type: Schema.Types.Mixed, default: {} }
}, {
  timestamps: true,
  collection: 'backoffice_payment_transactions'
});

PaymentTransactionSchema.index({ financialClassification: 1, status: 1, transactionDate: -1 });

export const PaymentTransaction = mongoose.model<IPaymentTransaction>(
  'backoffice_payment_transactions',
  PaymentTransactionSchema
);

