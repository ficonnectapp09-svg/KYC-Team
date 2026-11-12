import mongoose, { Document, Schema } from 'mongoose';
import { Department } from '../config/constants';

export type AttendanceStatus = 'Present' | 'Absent' | 'Half Day' | 'On Leave' | 'Late' | 'Remote';

export interface IAttendanceRecord extends Document {
  attendanceId: string;
  employeeId: string;
  employeeName: string;
  department: Department;
  dateKey: string; // YYYY-MM-DD
  date: Date;
  status: AttendanceStatus;
  checkInTime?: Date | null;
  checkOutTime?: Date | null;
  workHours: number;
  leaveType?: 'Casual' | 'Sick' | 'Earned' | 'Unpaid' | null;
  leaveReason?: string;
  leaveApprovalStatus?: 'Pending' | 'Approved' | 'Rejected' | 'N/A';
  reviewedBy?: {
    userId: string;
    name: string;
    at: Date;
  } | null;
  remarks?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AttendanceRecordSchema = new Schema<IAttendanceRecord>({
  attendanceId: { type: String, required: true, unique: true },
  employeeId: { type: String, required: true, index: true },
  employeeName: { type: String, required: true },
  department: {
    type: String,
    enum: Object.values(Department),
    required: true,
    index: true
  },
  dateKey: { type: String, required: true, index: true },
  date: { type: Date, required: true },
  status: {
    type: String,
    enum: ['Present', 'Absent', 'Half Day', 'On Leave', 'Late', 'Remote'],
    default: 'Present',
    index: true
  },
  checkInTime: { type: Date, default: null },
  checkOutTime: { type: Date, default: null },
  workHours: { type: Number, default: 0, min: 0 },
  leaveType: { type: String, enum: ['Casual', 'Sick', 'Earned', 'Unpaid', null], default: null },
  leaveReason: { type: String, default: '' },
  leaveApprovalStatus: { type: String, enum: ['Pending', 'Approved', 'Rejected', 'N/A'], default: 'N/A' },
  reviewedBy: {
    type: {
      userId: { type: String },
      name: { type: String },
      at: { type: Date }
    },
    default: null
  },
  remarks: { type: String, default: '' }
}, {
  timestamps: true,
  collection: 'backoffice_attendance_records'
});

AttendanceRecordSchema.index({ employeeId: 1, dateKey: 1 }, { unique: true });

export const AttendanceRecord = mongoose.model<IAttendanceRecord>(
  'backoffice_attendance_records',
  AttendanceRecordSchema
);

