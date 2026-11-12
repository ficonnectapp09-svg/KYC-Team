import mongoose, { Document, Schema } from 'mongoose';
import { Department, SalaryCycle } from '../config/constants';

export interface ISalaryStructure extends Document {
  employeeId: string;
  employeeName: string;
  department: Department;
  designation: string;
  salaryCycle: SalaryCycle;
  basicSalary: number;
  hra: number;
  otherAllowances: number;
  incentives: number;
  bonus: number;
  pfDeduction: number;
  esiDeduction: number;
  taxDeduction: number;
  otherDeductions: number;
  grossSalary: number;
  totalDeductions: number;
  netPayable: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SalaryStructureSchema = new Schema<ISalaryStructure>({
  employeeId: { type: String, required: true, unique: true, index: true },
  employeeName: { type: String, required: true },
  department: { type: String, enum: Object.values(Department), required: true },
  designation: { type: String, required: true },
  salaryCycle: { type: String, enum: Object.values(SalaryCycle), default: SalaryCycle.MONTHLY },
  basicSalary: { type: Number, required: true, min: 0 },
  hra: { type: Number, default: 0, min: 0 },
  otherAllowances: { type: Number, default: 0, min: 0 },
  incentives: { type: Number, default: 0, min: 0 },
  bonus: { type: Number, default: 0, min: 0 },
  pfDeduction: { type: Number, default: 0, min: 0 },
  esiDeduction: { type: Number, default: 0, min: 0 },
  taxDeduction: { type: Number, default: 0, min: 0 },
  otherDeductions: { type: Number, default: 0, min: 0 },
  grossSalary: { type: Number, required: true, min: 0 },
  totalDeductions: { type: Number, default: 0, min: 0 },
  netPayable: { type: Number, required: true, min: 0 },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true,
  collection: 'backoffice_salary_structures'
});

export const SalaryStructure = mongoose.model<ISalaryStructure>(
  'backoffice_salary_structures',
  SalaryStructureSchema
);

