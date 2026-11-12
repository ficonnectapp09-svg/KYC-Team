import mongoose, { Document, Schema } from 'mongoose';
import { Department } from '../config/constants';

export interface INotificationItem extends Document {
  notificationId: string;
  targetRole?: string | null;
  targetEmployeeId?: string | null;
  targetDepartment?: Department | null;
  title: string;
  message: string;
  type: 'KYC' | 'PAYMENT' | 'QUERIES' | 'SALARY' | 'TASK' | 'SYSTEM' | 'SECURITY';
  isRead: boolean;
  readAt?: Date | null;
  actionUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationItemSchema = new Schema<INotificationItem>({
  notificationId: { type: String, required: true, unique: true, index: true },
  targetRole: { type: String, default: null, index: true },
  targetEmployeeId: { type: String, default: null, index: true },
  targetDepartment: { type: String, enum: Object.values(Department), default: null, index: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: {
    type: String,
    enum: ['KYC', 'PAYMENT', 'QUERIES', 'SALARY', 'TASK', 'SYSTEM', 'SECURITY'],
    default: 'SYSTEM',
    index: true
  },
  isRead: { type: Boolean, default: false, index: true },
  readAt: { type: Date, default: null },
  actionUrl: { type: String, default: '' }
}, {
  timestamps: true,
  collection: 'backoffice_notifications'
});

NotificationItemSchema.index({ targetEmployeeId: 1, isRead: 1, createdAt: -1 });

export const NotificationItem = mongoose.model<INotificationItem>(
  'backoffice_notifications',
  NotificationItemSchema
);

