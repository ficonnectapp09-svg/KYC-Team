import mongoose, { Document, Schema } from 'mongoose';
import { Department, Role, SalaryCycle } from '../config/constants';

export interface IBankDetails {
  accountHolder: string;
  accountNumber: string;
  ifscCode: string;
  bankName: string;
}

export interface IEmployee extends Document {
  employeeId: string;
  name: string;
  email: string;
  phone: string;
  password?: string;
  photo?: string;
  department: Department;
  designation: string;
  role: Role;
  reportingLead?: mongoose.Types.ObjectId | null;
  joiningDate: Date;
  employmentType: 'Full-time' | 'Part-time' | 'Contract';
  workLocation: string;
  address?: string;
  emergencyContact?: {
    name: string;
    relationship: string;
    phone: string;
  };
  bankDetails?: IBankDetails;
  salaryCycle: SalaryCycle;
  status: 'active' | 'inactive' | 'suspended';
  permissions: string[];
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const BankDetailsSchema = new Schema<IBankDetails>({
  accountHolder: { type: String, default: '' },
  accountNumber: { type: String, default: '' },
  ifscCode: { type: String, default: '' },
  bankName: { type: String, default: '' }
}, { _id: false });

const EmployeeSchema = new Schema<IEmployee>({
  employeeId: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, required: true, trim: true },
  password: { type: String, required: true },
  photo: { type: String, default: '' },
  department: {
    type: String,
    enum: Object.values(Department),
    required: true,
    index: true
  },
  designation: { type: String, required: true, trim: true },
  role: {
    type: String,
    enum: Object.values(Role),
    required: true,
    index: true
  },
  reportingLead: { type: Schema.Types.ObjectId, ref: 'backoffice_employees', default: null },
  joiningDate: { type: Date, default: Date.now },
  employmentType: { type: String, enum: ['Full-time', 'Part-time', 'Contract'], default: 'Full-time' },
  workLocation: { type: String, default: 'Headquarters' },
  address: { type: String, default: '' },
  emergencyContact: {
    name: { type: String, default: '' },
    relationship: { type: String, default: '' },
    phone: { type: String, default: '' }
  },
  bankDetails: { type: BankDetailsSchema, default: () => ({}) },
  salaryCycle: { type: String, enum: Object.values(SalaryCycle), default: SalaryCycle.MONTHLY },
  status: { type: String, enum: ['active', 'inactive', 'suspended'], default: 'active', index: true },
  permissions: [{ type: String }],
  lastLogin: { type: Date, default: null }
}, {
  timestamps: true,
  collection: 'backoffice_employees'
});

EmployeeSchema.index({ department: 1, role: 1, status: 1 });

export const Employee = mongoose.model<IEmployee>('backoffice_employees', EmployeeSchema);

