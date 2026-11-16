import { z } from 'zod';
import { Department, Role, SalaryCycle } from '../config/constants';

// Strict Indian Mobile Number Validation: Exactly 10 digits, starts with 6-9
export const indianMobileRegex = /^[6-9]\d{9}$/;
export const indianMobileSchema = z
  .string()
  .trim()
  .regex(indianMobileRegex, 'Mobile number must be exactly 10 digits starting with 6, 7, 8, or 9');

export const optionalIndianMobileSchema = z
  .string()
  .trim()
  .regex(indianMobileRegex, 'Mobile number must be exactly 10 digits starting with 6, 7, 8, or 9')
  .optional()
  .or(z.literal(''))
  .or(z.null());

export const loginSchema = z.object({
  email: z.string().email('Valid email is required'),
  password: z.string().min(4, 'Password is required')
});

export const createEmployeeSchema = z.object({
  name: z.string().trim().min(2, 'Full name is required'),
  email: z.string().email('Valid email is required'),
  phone: indianMobileSchema,
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
  department: z.nativeEnum(Department),
  designation: z.string().trim().min(2, 'Designation is required'),
  role: z.nativeEnum(Role),
  employmentType: z.enum(['Full-time', 'Part-time', 'Contract']).optional(),
  workLocation: z.string().optional(),
  address: z.string().optional(),
  salaryCycle: z.nativeEnum(SalaryCycle).optional(),
  baseSalary: z.coerce.number().nonnegative().optional(),
  hraAllowance: z.coerce.number().nonnegative().optional(),
  specialAllowance: z.coerce.number().nonnegative().optional(),
  pfDeduction: z.coerce.number().nonnegative().optional(),
  taxDeduction: z.coerce.number().nonnegative().optional(),
  bankDetails: z
    .object({
      accountHolder: z.string().optional(),
      accountNumber: z.string().optional(),
      ifscCode: z.string().optional(),
      bankName: z.string().optional()
    })
    .optional(),
  emergencyContact: z
    .object({
      name: z.string().optional(),
      relationship: z.string().optional(),
      phone: optionalIndianMobileSchema
    })
    .optional()
}).passthrough();

export const updateEmployeeSchema = z.object({
  name: z.string().trim().min(2).optional(),
  phone: indianMobileSchema.optional(),
  department: z.nativeEnum(Department).optional(),
  designation: z.string().trim().min(2).optional(),
  employmentType: z.enum(['Full-time', 'Part-time', 'Contract']).optional(),
  workLocation: z.string().optional(),
  address: z.string().optional(),
  salaryCycle: z.nativeEnum(SalaryCycle).optional(),
  reportingLead: z.string().nullable().optional(),
  photo: z.string().optional(),
  permissions: z.array(z.string()).optional(),
  emergencyContact: z
    .object({
      name: z.string().optional(),
      relationship: z.string().optional(),
      phone: optionalIndianMobileSchema
    })
    .optional(),
  bankDetails: z
    .object({
      accountHolder: z.string().optional(),
      accountNumber: z.string().optional(),
      ifscCode: z.string().optional(),
      bankName: z.string().optional()
    })
    .optional()
});

export const kycVerifySchema = z.object({
  requestId: z.string().min(1, 'requestId is required'),
  action: z.enum(['APPROVE', 'REJECT', 'REQUEST_REUPLOAD', 'ESCALATE']),
  remarks: z.string().optional(),
  reason: z.string().optional(),
  documentType: z.string().optional()
});

export const kycResubmitSchema = z.object({
  docType: z.string().min(1, 'docType is required'),
  docUrl: z.string().min(1, 'docUrl is required'),
  docName: z.string().optional(),
  remarks: z.string().optional()
});

export const initiateApprovalSchema = z.object({
  transactionType: z.string().min(2, 'transactionType is required'),
  financialClassification: z.string().optional(),
  amount: z.number().positive('Amount must be greater than zero'),
  recipientId: z.string().min(1, 'recipientId is required'),
  recipientName: z.string().min(1, 'recipientName is required'),
  recipientType: z.string().min(1, 'recipientType is required'),
  bankDetails: z.record(z.any()).optional(),
  makerNotes: z.string().optional(),
  relatedReferenceId: z.string().optional(),
  idempotencyKey: z.string().optional()
}).passthrough();

export const salaryPrepareSchema = z.object({
  employeeId: z.string().min(1, 'employeeId is required'),
  periodStart: z.string().min(1, 'periodStart is required'),
  periodEnd: z.string().min(1, 'periodEnd is required'),
  periodLabel: z.string().min(2, 'periodLabel is required'),
  incentives: z.coerce.number().nonnegative().optional(),
  bonus: z.coerce.number().nonnegative().optional(),
  overtime: z.coerce.number().nonnegative().optional(),
  advanceRecovery: z.coerce.number().nonnegative().optional(),
  unpaidLeaveDeduction: z.coerce.number().nonnegative().optional()
}).passthrough();

export const createQuerySchema = z.object({
  userType: z.enum([
    'Customer',
    'Vendor',
    'Agent',
    'Manager',
    'Sub Admin',
    'Delivery Partner',
    'Technician',
    'KYC Team',
    'Payment Team',
    'Queries Team Internal',
    'KYC Team Employee',
    'Payment Team Employee',
    'Queries Team Employee',
    'Employee'
  ]),
  userId: z.string().min(1),
  userName: z.string().min(1),
  userEmail: z.string().optional(),
  userPhone: optionalIndianMobileSchema,
  subject: z.string().min(3, 'Subject is required'),
  description: z.string().min(5, 'Description is required'),
  category: z.string().min(2, 'Category is required'),
  priority: z.enum(['Low', 'Medium', 'High', 'Urgent']).optional()
});

export const generatePaymentLinkSchema = z.object({
  applicantId: z.string().min(1, 'applicantId is required'),
  applicantName: z.string().min(1, 'applicantName is required'),
  applicantType: z.enum(['Vendor', 'Agent', 'VENDOR', 'AGENT']),
  email: z.string().email('Valid recipient email is required'),
  phone: optionalIndianMobileSchema,
  amount: z.coerce.number().positive('Payment amount must be greater than zero'),
  purpose: z.string().min(3, 'Payment purpose is required'),
  businessName: z.string().optional(),
  expiryDays: z.coerce.number().min(1).max(30).default(7)
});

export const sendPaymentEmailSchema = z.object({
  linkId: z.string().min(1, 'linkId is required'),
  recipientEmail: z.string().email('Valid recipient email is required'),
  customNote: z.string().optional()
});

export const verifyPaymentSchema = z.object({
  linkId: z.string().min(1, 'linkId is required'),
  gatewayPaymentId: z.string().optional(),
  paymentMethod: z.string().default('Online Gateway')
});

export const transferredQueryActionSchema = z.object({
  action: z.enum(['UPDATE_STATUS', 'REQUEST_REKYC', 'TRANSFER_BACK', 'RESOLVE']),
  status: z.string().optional(),
  notes: z.string().min(3, 'Action notes or reason are required'),
  targetDepartment: z.nativeEnum(Department).optional()
});
