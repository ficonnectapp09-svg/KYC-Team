import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { connectDatabase } from '../config/database';
import { Employee } from '../models/Employee';
import { KycRequest } from '../models/KycRequest';
import { PaymentTransaction } from '../models/PaymentTransaction';
import { AgentDepositLiability } from '../models/AgentDepositLiability';
import { FinancialApproval } from '../models/FinancialApproval';
import { QueryTicket } from '../models/QueryTicket';
import { SalaryStructure } from '../models/SalaryStructure';
import { SalaryRecord } from '../models/SalaryRecord';
import { TaskItem } from '../models/TaskItem';
import { NotificationItem } from '../models/NotificationItem';
import { AttendanceRecord } from '../models/AttendanceRecord';
import { SystemConfig, DEFAULT_ROLE_PERMISSIONS } from '../models/SystemConfig';
import { Department, Role, ApplicantType, KycStatus, FinancialClassification, ApprovalStatus, QueryStatus, SalaryStatus, TaskStatus } from '../config/constants';
import { hashPassword, generateId } from './security';

dotenv.config();

export const seedDatabase = async () => {
  try {
    await connectDatabase();
    console.log('[Seed]: Connected to MongoDB. Seeding initial operational backoffice data...');

    const defaultPassword = await hashPassword('Connect@2026');

    // 1. Seed Staff Hierarchy
    const staffList = [
      {
        employeeId: 'EMP-LEAD-001',
        name: 'Rajesh Sharma',
        email: 'lead@connectapp.in',
        phone: '9876543210',
        password: defaultPassword,
        department: Department.OVERALL,
        designation: 'Overall Team Lead',
        role: Role.OVERALL_LEAD,
        employmentType: 'Full-time' as const,
        workLocation: 'Bangalore Central HQ',
        salaryCycle: 'Monthly' as const,
        status: 'active' as const,
        bankDetails: {
          accountHolder: 'Rajesh Sharma',
          accountNumber: '91987654321098',
          ifscCode: 'HDFC0001001',
          bankName: 'HDFC Bank'
        },
        permissions: ['all']
      },
      {
        employeeId: 'EMP-KYC-001',
        name: 'Priya Sundaram',
        email: 'kyc.lead@connectapp.in',
        phone: '9876543211',
        password: defaultPassword,
        department: Department.KYC,
        designation: 'KYC Team Lead',
        role: Role.KYC_LEAD,
        employmentType: 'Full-time' as const,
        workLocation: 'Bangalore Central HQ',
        salaryCycle: 'Monthly' as const,
        status: 'active' as const,
        bankDetails: {
          accountHolder: 'Priya Sundaram',
          accountNumber: '91987654321099',
          ifscCode: 'ICIC0002002',
          bankName: 'ICICI Bank'
        },
        permissions: ['kyc:manage', 'kyc:assign', 'staff:kyc']
      },
      {
        employeeId: 'EMP-PAY-001',
        name: 'Vikramaditya Verma',
        email: 'payment.lead@connectapp.in',
        phone: '9876543212',
        password: defaultPassword,
        department: Department.PAYMENT,
        designation: 'Payment Operations Lead',
        role: Role.PAYMENT_LEAD,
        employmentType: 'Full-time' as const,
        workLocation: 'Bangalore Central HQ',
        salaryCycle: 'Monthly' as const,
        status: 'active' as const,
        bankDetails: {
          accountHolder: 'Vikramaditya Verma',
          accountNumber: '91987654321100',
          ifscCode: 'SBIN0003003',
          bankName: 'State Bank of India'
        },
        permissions: ['payment:manage', 'approval:checker', 'staff:payment']
      },
      {
        employeeId: 'EMP-QRY-001',
        name: 'Ananya Deshmukh',
        email: 'queries.lead@connectapp.in',
        phone: '9876543213',
        password: defaultPassword,
        department: Department.QUERIES,
        designation: 'Queries & Support Lead',
        role: Role.QUERIES_LEAD,
        employmentType: 'Full-time' as const,
        workLocation: 'Bangalore Central HQ',
        salaryCycle: 'Monthly' as const,
        status: 'active' as const,
        bankDetails: {
          accountHolder: 'Ananya Deshmukh',
          accountNumber: '91987654321101',
          ifscCode: 'AXIS0004004',
          bankName: 'Axis Bank'
        },
        permissions: ['queries:manage', 'queries:assign', 'staff:queries']
      },
      {
        employeeId: 'EMP-KYC-002',
        name: 'Arjun Nair',
        email: 'kyc.staff@connectapp.in',
        phone: '9876543214',
        password: defaultPassword,
        department: Department.KYC,
        designation: 'Senior KYC Verification Officer',
        role: Role.KYC_EMPLOYEE,
        employmentType: 'Full-time' as const,
        workLocation: 'Bangalore Central HQ',
        salaryCycle: 'Monthly' as const,
        status: 'active' as const,
        bankDetails: {
          accountHolder: 'Arjun Nair',
          accountNumber: '91987654321102',
          ifscCode: 'KKBK0005005',
          bankName: 'Kotak Mahindra Bank'
        },
        permissions: ['kyc:verify', 'kyc:reupload']
      },
      {
        employeeId: 'EMP-PAY-002',
        name: 'Neha Chawla',
        email: 'payment.staff@connectapp.in',
        phone: '9876543215',
        password: defaultPassword,
        department: Department.PAYMENT,
        designation: 'Payment Operations Specialist (Maker)',
        role: Role.PAYMENT_EMPLOYEE,
        employmentType: 'Full-time' as const,
        workLocation: 'Bangalore Central HQ',
        salaryCycle: 'Monthly' as const,
        status: 'active' as const,
        bankDetails: {
          accountHolder: 'Neha Chawla',
          accountNumber: '91987654321103',
          ifscCode: 'HDFC0001002',
          bankName: 'HDFC Bank'
        },
        permissions: ['payment:maker', 'settlement:initiate']
      },
      {
        employeeId: 'EMP-QRY-002',
        name: 'Karthik Raman',
        email: 'queries.staff@connectapp.in',
        phone: '9876543216',
        password: defaultPassword,
        department: Department.QUERIES,
        designation: 'Customer & Vendor Query Specialist',
        role: Role.QUERIES_EMPLOYEE,
        employmentType: 'Full-time' as const,
        workLocation: 'Bangalore Central HQ',
        salaryCycle: 'Monthly' as const,
        status: 'active' as const,
        bankDetails: {
          accountHolder: 'Karthik Raman',
          accountNumber: '91987654321104',
          ifscCode: 'ICIC0002003',
          bankName: 'ICICI Bank'
        },
        permissions: ['queries:respond', 'queries:transfer']
      }
    ];

    for (const s of staffList) {
      await Employee.findOneAndUpdate(
        { email: s.email },
        { $set: s },
        { upsert: true, new: true }
      );
    }
    console.log('[Seed]: Staff hierarchy verified.');

    // 2. Seed Salary Structures
    for (const s of staffList) {
      const basic = s.designation.includes('Lead') ? 60000 : 35000;
      const hra = basic * 0.4;
      const allowances = 10000;
      const gross = basic + hra + allowances;
      const pf = basic * 0.12;
      const esi = 350;
      const tax = 2000;
      const deductions = pf + esi + tax;
      const net = gross - deductions;

      await SalaryStructure.findOneAndUpdate(
        { employeeId: s.employeeId },
        {
          $set: {
            employeeName: s.name,
            department: s.department,
            designation: s.designation,
            salaryCycle: s.salaryCycle,
            basicSalary: basic,
            hra,
            otherAllowances: allowances,
            incentives: 0,
            bonus: 0,
            pfDeduction: pf,
            esiDeduction: esi,
            taxDeduction: tax,
            otherDeductions: 0,
            grossSalary: gross,
            totalDeductions: deductions,
            netPayable: net,
            isActive: true
          }
        },
        { upsert: true }
      );
    }
    console.log('[Seed]: Salary structures configured.');

    // 3. Seed Agent Deposit Liabilities (Confirmed Decision 1)
    const agentDepositCount = await AgentDepositLiability.countDocuments();
    if (agentDepositCount === 0) {
      const agentDeposits = [
        {
          liabilityId: 'LIAB-DEP-2026-001',
          agentId: 'AGT-BLR-0019',
          agentName: 'Manoj Kumar',
          agentPhone: '9845012345',
          agentEmail: 'manoj.agent@connectapp.in',
          originalTransactionId: 'TXN-DEP-883101',
          depositAmount: 50000,
          currentOutstandingBalance: 50000,
          status: 'HELD' as const,
          paymentMethod: 'Bank Transfer (NEFT)',
          gatewayReference: 'NEFT-RB-88291039',
          depositDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
          notes: 'Territory franchise security deposit held under legal liability agreement.',
          movements: [
            {
              movementId: 'MOV-1001',
              type: 'DEPOSIT_RECEIVED' as const,
              amount: 50000,
              balanceAfter: 50000,
              reason: 'Onboarding territory deposit received.',
              referenceId: 'TXN-DEP-883101',
              processedByUserId: 'EMP-PAY-001',
              processedByName: 'Vikramaditya Verma',
              processedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000)
            }
          ]
        },
        {
          liabilityId: 'LIAB-DEP-2026-002',
          agentId: 'AGT-MYS-0042',
          agentName: 'Suresh Patel',
          agentPhone: '9845077889',
          agentEmail: 'suresh.mysore@connectapp.in',
          originalTransactionId: 'TXN-DEP-883102',
          depositAmount: 50000,
          currentOutstandingBalance: 25000,
          status: 'PARTIALLY_REFUNDED' as const,
          paymentMethod: 'RTGS',
          gatewayReference: 'RTGS-SB-99384721',
          depositDate: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
          notes: 'Agent adjusted territory scope; 50% refund processed.',
          movements: [
            {
              movementId: 'MOV-1002',
              type: 'DEPOSIT_RECEIVED' as const,
              amount: 50000,
              balanceAfter: 50000,
              reason: 'Initial territory deposit received.',
              referenceId: 'TXN-DEP-883102',
              processedByUserId: 'EMP-PAY-001',
              processedByName: 'Vikramaditya Verma',
              processedAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000)
            },
            {
              movementId: 'MOV-1003',
              type: 'REFUND_PROCESSED' as const,
              amount: 25000,
              balanceAfter: 25000,
              reason: 'Territory downscaling partial refund.',
              referenceId: 'TXN-REF-449102',
              processedByUserId: 'EMP-PAY-001',
              processedByName: 'Vikramaditya Verma',
              processedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
            }
          ]
        }
      ];

      for (const ad of agentDeposits) {
        await AgentDepositLiability.create(ad);
      }
      console.log('[Seed]: Agent deposit liabilities seeded.');
    }

    // 4. Seed Payment Transactions (Income, Outgoing, Liabilities)
    const txnCount = await PaymentTransaction.countDocuments();
    if (txnCount === 0) {
      const sampleTxns = [
        {
          transactionId: 'TXN-ORD-2026-101',
          referenceId: 'ORD-PROD-9901',
          transactionType: 'Customer Order Payment',
          financialClassification: FinancialClassification.INCOME,
          fromParty: { id: 'CUST-OCT-019', name: 'Aakash Mehta', type: 'Customer' },
          toParty: { id: 'VND-BLR-004', name: 'Shree Balaji Electronics', type: 'Vendor' },
          amount: 14500,
          grossAmount: 14500,
          tax: 2610,
          discount: 500,
          commission: 725,
          deductions: 0,
          finalAmount: 14500,
          paymentMethod: 'UPI',
          gatewayReference: 'razorpay_pay_L8x9a99K',
          status: 'COMPLETED' as const,
          handledByEmployeeId: 'EMP-PAY-002',
          handledByEmployeeName: 'Neha Chawla',
          department: 'Payment Team',
          transactionDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
        },
        {
          transactionId: 'TXN-BKG-2026-102',
          referenceId: 'BKG-SRV-3301',
          transactionType: 'Customer Booking Payment',
          financialClassification: FinancialClassification.INCOME,
          fromParty: { id: 'CUST-OCT-022', name: 'Smita Kulkarni', type: 'Customer' },
          toParty: { id: 'VND-SRV-011', name: 'Urban Electrical Works', type: 'Vendor' },
          amount: 2200,
          grossAmount: 2200,
          tax: 396,
          discount: 0,
          commission: 220,
          deductions: 0,
          finalAmount: 2200,
          paymentMethod: 'Credit Card',
          gatewayReference: 'razorpay_pay_M1x2b88J',
          status: 'COMPLETED' as const,
          handledByEmployeeId: 'EMP-PAY-002',
          handledByEmployeeName: 'Neha Chawla',
          department: 'Payment Team',
          transactionDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
        },
        {
          transactionId: 'TXN-MEM-2026-103',
          referenceId: 'MEM-GOLD-4411',
          transactionType: 'Membership Card Payment',
          financialClassification: FinancialClassification.INCOME,
          fromParty: { id: 'CUST-OCT-088', name: 'Deepak Roy', type: 'Customer' },
          toParty: { id: 'CONNECT_APP', name: 'Connect App Memberships', type: 'Platform' },
          amount: 1999,
          grossAmount: 1999,
          tax: 360,
          discount: 0,
          commission: 0,
          deductions: 0,
          finalAmount: 1999,
          paymentMethod: 'UPI',
          gatewayReference: 'razorpay_pay_Q4z3a11V',
          status: 'COMPLETED' as const,
          handledByEmployeeId: 'EMP-PAY-002',
          handledByEmployeeName: 'Neha Chawla',
          department: 'Payment Team',
          transactionDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
        },
        {
          transactionId: 'TXN-SUB-2026-104',
          referenceId: 'SUB-ANNUAL-120',
          transactionType: 'Vendor Subscription Income',
          financialClassification: FinancialClassification.INCOME,
          fromParty: { id: 'VND-BLR-004', name: 'Shree Balaji Electronics', type: 'Vendor' },
          toParty: { id: 'CONNECT_APP', name: 'Connect App Subscriptions', type: 'Platform' },
          amount: 12000,
          grossAmount: 12000,
          tax: 2160,
          discount: 0,
          commission: 0,
          deductions: 0,
          finalAmount: 12000,
          paymentMethod: 'NetBanking',
          gatewayReference: 'razorpay_pay_P9p8o77U',
          status: 'COMPLETED' as const,
          handledByEmployeeId: 'EMP-PAY-002',
          handledByEmployeeName: 'Neha Chawla',
          department: 'Payment Team',
          transactionDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000)
        },
        {
          transactionId: 'TXN-SET-2026-105',
          referenceId: 'SET-VND-8819',
          transactionType: 'Vendor Settlement',
          financialClassification: FinancialClassification.OUTGOING,
          fromParty: { id: 'CONNECT_ESCROW', name: 'Connect App Settlement Escrow', type: 'Platform' },
          toParty: { id: 'VND-BLR-004', name: 'Shree Balaji Electronics', type: 'Vendor' },
          amount: 13775,
          grossAmount: 14500,
          tax: 0,
          discount: 0,
          commission: 725,
          deductions: 0,
          finalAmount: 13775,
          paymentMethod: 'Bank Transfer (IMPS)',
          status: 'COMPLETED' as const,
          handledByEmployeeId: 'EMP-PAY-002',
          handledByEmployeeName: 'Neha Chawla',
          department: 'Payment Team',
          transactionDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
        }
      ];

      for (const t of sampleTxns) {
        await PaymentTransaction.create(t);
      }
      console.log('[Seed]: Payment transactions seeded.');
    }

    // 5. Seed Maker-Checker Approvals (Confirmed Decision 2)
    const approvalCount = await FinancialApproval.countDocuments();
    if (approvalCount === 0) {
      const sampleApprovals = [
        {
          approvalId: 'APR-2026-001',
          transactionType: 'Vendor Settlement',
          financialClassification: FinancialClassification.OUTGOING,
          amount: 28450,
          recipientType: 'Vendor',
          recipientId: 'VND-BLR-009',
          recipientName: 'Apex Food Supplies Pvt Ltd',
          bankDetails: {
            accountHolder: 'Apex Food Supplies Pvt Ltd',
            accountNumberMasked: '••••••••8912',
            ifscCode: 'HDFC0001889',
            bankName: 'HDFC Bank'
          },
          makerId: 'EMP-PAY-002',
          makerName: 'Neha Chawla',
          makerRole: 'payment_employee',
          makerNotes: 'Order settlements for Week 44 verified against customer delivery receipts.',
          initiatedAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
          status: ApprovalStatus.PENDING_CHECKER,
          idempotencyKey: 'IDEM-APR-001',
          relatedReferenceId: 'SET-WK44-FOOD',
          history: [
            {
              action: 'SUBMITTED_FOR_CHECKER_REVIEW',
              actorId: 'EMP-PAY-002',
              actorName: 'Neha Chawla',
              actorRole: 'payment_employee',
              details: 'Initiated settlement of ₹28,450 for Apex Food Supplies Pvt Ltd.',
              timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000)
            }
          ]
        },
        {
          approvalId: 'APR-2026-002',
          transactionType: 'Delivery Partner Payout',
          financialClassification: FinancialClassification.OUTGOING,
          amount: 8750,
          recipientType: 'Delivery Partner',
          recipientId: 'DP-BLR-014',
          recipientName: 'Girish Reddy',
          bankDetails: {
            accountHolder: 'Girish Reddy',
            accountNumberMasked: '••••••••4521',
            ifscCode: 'SBIN0008921',
            bankName: 'State Bank of India'
          },
          makerId: 'EMP-PAY-002',
          makerName: 'Neha Chawla',
          makerRole: 'payment_employee',
          makerNotes: 'Bi-weekly delivery fee payout for 145 successful deliveries.',
          initiatedAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
          status: ApprovalStatus.PENDING_CHECKER,
          idempotencyKey: 'IDEM-APR-002',
          relatedReferenceId: 'DP-PAY-WK44',
          history: [
            {
              action: 'SUBMITTED_FOR_CHECKER_REVIEW',
              actorId: 'EMP-PAY-002',
              actorName: 'Neha Chawla',
              actorRole: 'payment_employee',
              details: 'Initiated payout of ₹8,750 for Girish Reddy.',
              timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000)
            }
          ]
        }
      ];

      for (const a of sampleApprovals) {
        await FinancialApproval.create(a);
      }
      console.log('[Seed]: Maker-Checker approval items seeded.');
    }

    // 6. Seed KYC Requests (10 applicant types, dual assignment, re-upload workflow)
    const kycCount = await KycRequest.countDocuments();
    if (kycCount === 0) {
      const sampleKyc = [
        {
          requestId: 'KYC-2026-001',
          applicantId: 'VND-REG-9912',
          applicantName: 'Golden Harvest Organic Store',
          applicantType: ApplicantType.VENDOR,
          phone: '9845011223',
          email: 'contact@goldenharvest.in',
          priority: 'High' as const,
          status: KycStatus.ASSIGNED,
          assignedEmployeeId: 'EMP-KYC-002',
          assignedEmployeeName: 'Arjun Nair',
          registrationDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
          submissionDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          documents: [
            {
              docType: 'GST Certificate',
              docName: 'GST_29AABCU9603R1ZM.pdf',
              docUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800',
              version: 1,
              status: 'Pending' as const,
              uploadedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
            },
            {
              docType: 'PAN Card',
              docName: 'PAN_AABCU9603R.jpg',
              docUrl: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=800',
              version: 1,
              status: 'Verified' as const,
              remarks: 'Clean match with business entity.',
              verifiedBy: 'Arjun Nair',
              verifiedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
              uploadedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
            }
          ],
          previousDocumentVersions: [],
          reuploadRequests: [],
          assignmentHistory: [
            {
              newEmployeeId: 'EMP-KYC-002',
              newEmployeeName: 'Arjun Nair',
              assignedByUserId: 'EMP-KYC-001',
              assignedByRole: 'kyc_lead',
              reason: 'Assigned to senior verification specialist for priority vendor onboarding.',
              assignmentType: 'MANUAL' as const,
              timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
            }
          ],
          routedToPayment: false
        },
        {
          requestId: 'KYC-2026-002',
          applicantId: 'AGT-REG-4402',
          applicantName: 'Rameshwar Yadav',
          applicantType: ApplicantType.AGENT,
          phone: '9845033445',
          email: 'rameshwar.agent@connectapp.in',
          priority: 'Urgent' as const,
          status: KycStatus.UNASSIGNED,
          registrationDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
          submissionDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
          documents: [
            {
              docType: 'Aadhaar Card',
              docName: 'Aadhaar_Front_Back.pdf',
              docUrl: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800',
              version: 1,
              status: 'Pending' as const,
              uploadedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
            },
            {
              docType: 'Police Verification',
              docName: 'PVR_Karnataka_Police.pdf',
              docUrl: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?w=800',
              version: 1,
              status: 'Pending' as const,
              uploadedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
            }
          ],
          previousDocumentVersions: [],
          reuploadRequests: [],
          assignmentHistory: [],
          routedToPayment: false
        },
        {
          requestId: 'KYC-2026-003',
          applicantId: 'MGR-REG-1019',
          applicantName: 'Sunita Mehra',
          applicantType: ApplicantType.MANAGER,
          phone: '9845055667',
          email: 'sunita.mgr@connectapp.in',
          priority: 'Medium' as const,
          status: KycStatus.RE_UPLOAD_REQUESTED,
          assignedEmployeeId: 'EMP-KYC-002',
          assignedEmployeeName: 'Arjun Nair',
          registrationDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
          submissionDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
          documents: [
            {
              docType: 'Degree Certificate',
              docName: 'MBA_Degree_Scan.jpg',
              docUrl: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=800',
              version: 1,
              status: 'Re-upload Required' as const,
              remarks: 'Image scan is blurry and graduation year not legible. Please upload high resolution PDF.',
              uploadedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000)
            }
          ],
          previousDocumentVersions: [],
          reuploadRequests: [
            {
              documentType: 'Degree Certificate',
              reason: 'Image scan blurry and graduation year not legible.',
              requestedByUserId: 'EMP-KYC-002',
              requestedByName: 'Arjun Nair',
              requestedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
              isResolved: false
            }
          ],
          assignmentHistory: [
            {
              newEmployeeId: 'EMP-KYC-002',
              newEmployeeName: 'Arjun Nair',
              assignedByUserId: 'EMP-KYC-001',
              assignedByRole: 'kyc_lead',
              reason: 'Auto assigned via round-robin queue',
              assignmentType: 'AUTOMATIC' as const,
              timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000)
            }
          ],
          routedToPayment: false
        }
      ];

      for (const k of sampleKyc) {
        await KycRequest.create(k);
      }
      console.log('[Seed]: KYC requests seeded.');
    }

    // 7. Seed Queries (Confirmed Decision 4: Shared Case Visibility)
    const queryCount = await QueryTicket.countDocuments();
    if (queryCount === 0) {
      const sampleQueries = [
        {
          queryId: 'QRY-2026-101',
          userType: 'Vendor',
          userId: 'VND-BLR-004',
          userName: 'Shree Balaji Electronics',
          userEmail: 'balaji.electronics@gmail.com',
          userPhone: '9845012399',
          category: 'Payment & Settlements',
          subject: 'Weekly settlement amount mismatch for Order ORD-PROD-9901',
          description: 'Our customer order ORD-PROD-9901 was delivered 2 days ago, but settlement ledger reflects 5% platform commission instead of the promotional 4% tier.',
          priority: 'High' as const,
          status: QueryStatus.TRANSFERRED_TO_PAYMENT,
          currentDepartment: Department.PAYMENT,
          sourceDepartment: Department.QUERIES,
          sharedDepartments: [Department.QUERIES, Department.PAYMENT],
          assignedEmployeeId: 'EMP-PAY-002',
          assignedEmployeeName: 'Neha Chawla',
          conversation: [
            {
              messageId: 'MSG-001',
              senderId: 'VND-BLR-004',
              senderName: 'Shree Balaji Electronics',
              senderRole: 'Vendor',
              message: 'Our customer order ORD-PROD-9901 was delivered 2 days ago, but settlement ledger reflects 5% platform commission instead of the promotional 4% tier.',
              timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000)
            },
            {
              messageId: 'MSG-002',
              senderId: 'EMP-QRY-002',
              senderName: 'Karthik Raman',
              senderRole: 'queries_employee',
              message: 'Hello, we have verified that your promotional commission agreement is valid. We are transferring this ticket directly to the Payment Operations Team to adjust the ledger payout.',
              timestamp: new Date(Date.now() - 18 * 60 * 60 * 1000)
            }
          ],
          internalNotes: [
            {
              noteId: 'NOTE-001',
              authorId: 'EMP-QRY-002',
              authorName: 'Karthik Raman',
              department: Department.QUERIES,
              note: 'Vendor agreement verified on CMS. Promotion code "DIWALI4" active.',
              isDepartmentPrivate: false,
              timestamp: new Date(Date.now() - 18 * 60 * 60 * 1000)
            },
            {
              noteId: 'NOTE-002',
              authorId: 'EMP-QRY-002',
              authorName: 'Karthik Raman',
              department: Department.QUERIES,
              note: 'CONFIDENTIAL: Vendor is top-10 tier partner in Bangalore South. Handle promptly.',
              isDepartmentPrivate: true,
              timestamp: new Date(Date.now() - 18 * 60 * 60 * 1000)
            }
          ],
          transferHistory: [
            {
              fromDepartment: Department.QUERIES,
              toDepartment: Department.PAYMENT,
              transferredByUserId: 'EMP-QRY-002',
              transferredByName: 'Karthik Raman',
              reason: 'Settlement percentage recalculation requires Payment Team ledger adjustment.',
              transferredAt: new Date(Date.now() - 18 * 60 * 60 * 1000)
            }
          ]
        },
        {
          queryId: 'QRY-2026-102',
          userType: 'Customer',
          userId: 'CUST-OCT-019',
          userName: 'Aakash Mehta',
          userEmail: 'aakash.m@gmail.com',
          userPhone: '9845019283',
          category: 'Delivery',
          subject: 'Delivery partner delayed for daily groceries',
          description: 'Delivery is 30 minutes past the estimated slot. Need immediate status update.',
          priority: 'Medium' as const,
          status: QueryStatus.IN_PROGRESS,
          currentDepartment: Department.QUERIES,
          sourceDepartment: Department.QUERIES,
          sharedDepartments: [Department.QUERIES],
          assignedEmployeeId: 'EMP-QRY-002',
          assignedEmployeeName: 'Karthik Raman',
          conversation: [
            {
              messageId: 'MSG-003',
              senderId: 'CUST-OCT-019',
              senderName: 'Aakash Mehta',
              senderRole: 'Customer',
              message: 'Delivery is 30 minutes past the estimated slot. Need immediate status update.',
              timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000)
            }
          ],
          internalNotes: [],
          transferHistory: []
        }
      ];

      for (const q of sampleQueries) {
        await QueryTicket.create(q);
      }
      console.log('[Seed]: Shared queries seeded.');
    }

    // 8. Seed Salary Records (Confirmed Decision 3: Overall Team Lead Approval)
    const salaryRecCount = await SalaryRecord.countDocuments();
    if (salaryRecCount === 0) {
      const sampleSalaryRecords = [
        {
          salaryId: 'SAL-2026-001',
          employeeId: 'EMP-KYC-002',
          employeeName: 'Arjun Nair',
          department: Department.KYC,
          designation: 'Senior KYC Verification Officer',
          salaryCycle: 'Monthly' as const,
          periodStart: new Date(2026, 9, 1),
          periodEnd: new Date(2026, 9, 31),
          periodLabel: 'October 2026',
          earnings: {
            basic: 35000,
            hra: 14000,
            allowances: 10000,
            incentives: 3000,
            bonus: 0,
            overtime: 1500,
            gross: 63500
          },
          deductions: {
            pf: 4200,
            esi: 350,
            tax: 2000,
            advanceRecovery: 0,
            unpaidLeaveDeduction: 0,
            other: 0,
            total: 6550
          },
          netSalary: 56950,
          bankDetails: {
            accountHolder: 'Arjun Nair',
            accountNumberMasked: '••••••••1102',
            ifscCode: 'KKBK0005005',
            bankName: 'Kotak Mahindra Bank'
          },
          status: SalaryStatus.SUBMITTED_FOR_OVERALL_APPROVAL,
          preparedBy: {
            userId: 'EMP-PAY-002',
            name: 'Neha Chawla',
            role: 'payment_employee',
            at: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        },
        {
          salaryId: 'SAL-2026-002',
          employeeId: 'EMP-PAY-002',
          employeeName: 'Neha Chawla',
          department: Department.PAYMENT,
          designation: 'Payment Operations Specialist (Maker)',
          salaryCycle: 'Monthly' as const,
          periodStart: new Date(2026, 9, 1),
          periodEnd: new Date(2026, 9, 31),
          periodLabel: 'October 2026',
          earnings: {
            basic: 35000,
            hra: 14000,
            allowances: 10000,
            incentives: 2500,
            bonus: 0,
            overtime: 0,
            gross: 61500
          },
          deductions: {
            pf: 4200,
            esi: 350,
            tax: 2000,
            advanceRecovery: 0,
            unpaidLeaveDeduction: 0,
            other: 0,
            total: 6550
          },
          netSalary: 54950,
          bankDetails: {
            accountHolder: 'Neha Chawla',
            accountNumberMasked: '••••••••1103',
            ifscCode: 'HDFC0001002',
            bankName: 'HDFC Bank'
          },
          status: SalaryStatus.APPROVED,
          preparedBy: {
            userId: 'EMP-PAY-001',
            name: 'Vikramaditya Verma',
            role: 'payment_lead',
            at: new Date(Date.now() - 48 * 60 * 60 * 1000)
          },
          approvedByOverallLead: {
            userId: 'EMP-LEAD-001',
            name: 'Rajesh Sharma',
            role: 'overall_lead',
            at: new Date(Date.now() - 24 * 60 * 60 * 1000),
            notes: 'Approved for payout disbursement.'
          }
        }
      ];

      for (const sr of sampleSalaryRecords) {
        await SalaryRecord.create(sr);
      }
      console.log('[Seed]: Salary records seeded.');
    }

    // 9. Seed Tasks
    const taskCount = await TaskItem.countDocuments();
    if (taskCount === 0) {
      const sampleTasks = [
        {
          taskId: 'TSK-2026-001',
          title: 'Audit Agent Deposits & Reconciliation',
          description: 'Perform cross-verification of all outstanding agent deposit liabilities against the escrow ledger before Q4 audit.',
          department: Department.PAYMENT,
          assignedTo: {
            employeeId: 'EMP-PAY-001',
            name: 'Vikramaditya Verma',
            role: 'payment_lead'
          },
          assignedBy: {
            employeeId: 'EMP-LEAD-001',
            name: 'Rajesh Sharma',
            role: 'overall_lead'
          },
          priority: 'High' as const,
          status: TaskStatus.IN_PROGRESS,
          dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          comments: []
        },
        {
          taskId: 'TSK-2026-002',
          title: 'KYC Document Backlog Clearance',
          description: 'Clear unassigned KYC queue for newly onboarded festival season vendors.',
          department: Department.KYC,
          assignedTo: {
            employeeId: 'EMP-KYC-002',
            name: 'Arjun Nair',
            role: 'kyc_employee'
          },
          assignedBy: {
            employeeId: 'EMP-KYC-001',
            name: 'Priya Sundaram',
            role: 'kyc_lead'
          },
          priority: 'Urgent' as const,
          status: TaskStatus.ASSIGNED,
          dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
          comments: []
        }
      ];

      for (const tk of sampleTasks) {
        await TaskItem.create(tk);
      }
      console.log('[Seed]: Operational tasks seeded.');
    }

    // 10. Seed Notifications
    const notifCount = await NotificationItem.countDocuments();
    if (notifCount === 0) {
      const sampleNotifs = [
        {
          notificationId: 'NOTIF-2026-001',
          targetRole: Role.OVERALL_LEAD,
          targetEmployeeId: 'EMP-LEAD-001',
          targetDepartment: Department.OVERALL,
          title: 'Salary Approval Request',
          message: 'October 2026 payroll statement for Arjun Nair (₹56,950) is awaiting your final approval.',
          type: 'SALARY' as const,
          isRead: false,
          actionUrl: '/salary'
        },
        {
          notificationId: 'NOTIF-2026-002',
          targetRole: Role.PAYMENT_LEAD,
          targetEmployeeId: 'EMP-PAY-001',
          targetDepartment: Department.PAYMENT,
          title: 'Checker Approval Required',
          message: 'Settlement for Apex Food Supplies Pvt Ltd (₹28,450) submitted for Checker review.',
          type: 'PAYMENT' as const,
          isRead: false,
          actionUrl: '/payments/approvals'
        }
      ];

      for (const n of sampleNotifs) {
        await NotificationItem.create(n);
      }
      console.log('[Seed]: Notifications seeded.');
    }

    // 11. Seed Attendance Records for Today
    const todayKey = new Date().toISOString().slice(0, 10);
    const attCount = await AttendanceRecord.countDocuments({ dateKey: todayKey });
    if (attCount === 0) {
      const seededStaff = await Employee.find().select('employeeId name department status').lean();
      for (const emp of seededStaff) {
        const isInactive = emp.status === 'inactive';
        await AttendanceRecord.create({
          attendanceId: generateId('ATT'),
          employeeId: emp.employeeId,
          employeeName: emp.name,
          department: emp.department,
          dateKey: todayKey,
          date: new Date(`${todayKey}T09:00:00.000Z`),
          status: isInactive ? 'On Leave' : 'Present',
          checkInTime: isInactive ? null : new Date(`${todayKey}T09:05:00.000Z`),
          workHours: isInactive ? 0 : 8,
          leaveType: isInactive ? 'Casual' : null,
          leaveApprovalStatus: isInactive ? 'Approved' : 'N/A',
          remarks: isInactive ? 'Scheduled leave' : 'Checked in at Central Operations'
        });
      }
      console.log('[Seed]: Today attendance records seeded.');
    }

    // 12. Seed Singleton System Configuration
    const cfgExists = await SystemConfig.exists({ configKey: 'GLOBAL_BACKOFFICE_CONFIG' });
    if (!cfgExists) {
      await SystemConfig.create({
        configKey: 'GLOBAL_BACKOFFICE_CONFIG',
        rolePermissions: DEFAULT_ROLE_PERMISSIONS
      });
      console.log('[Seed]: System settings & permission matrix seeded.');
    }

    // 13. Seed Section 30 Role-Wise Sample Records (Idempotent by unique ID)
    const section30Kycs = [
      {
        requestId: 'KYC-2026-004',
        applicantId: 'CUST-4012',
        applicantName: 'Neha Kulkarni',
        applicantType: ApplicantType.CUSTOMER,
        phone: '9820112233',
        email: 'neha.kulkarni@connectcustomer.in',
        priority: 'Low' as const,
        status: KycStatus.UNASSIGNED,
        registrationDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        submissionDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        applicantDetails: { city: 'Pune', pincode: '411001', customerTier: 'Gold Member' },
        documents: [
          { docType: 'Aadhaar Front', docName: 'aadhaar_neha.png', docUrl: 'https://placehold.co/700x450/png?text=Customer+Aadhaar', version: 1, status: 'Pending' as const }
        ]
      },
      {
        requestId: 'KYC-2026-005',
        applicantId: 'SUB-301',
        applicantName: 'Harishankar Menon',
        applicantType: ApplicantType.SUB_ADMIN,
        phone: '9845099881',
        email: 'harishankar.subadmin@connectapp.in',
        priority: 'High' as const,
        status: KycStatus.ASSIGNED,
        assignedEmployeeId: 'EMP-KYC-002',
        assignedEmployeeName: 'Arjun Nair',
        registrationDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        submissionDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        applicantDetails: { adminScope: 'District Admin', jurisdiction: 'Ernakulam District, Kerala', authorizationCode: 'SUB-KL-09' },
        documents: [
          { docType: 'Authority Letter', docName: 'subadmin_auth.pdf', docUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', version: 1, status: 'Pending' as const }
        ]
      },
      {
        requestId: 'KYC-2026-006',
        applicantId: 'DEL-8821',
        applicantName: 'Karthik Gowda',
        applicantType: ApplicantType.DELIVERY_PARTNER,
        phone: '9741223344',
        email: 'karthik.rider@connectfleet.in',
        priority: 'Urgent' as const,
        status: KycStatus.IN_PROGRESS,
        assignedEmployeeId: 'EMP-KYC-002',
        assignedEmployeeName: 'Arjun Nair',
        registrationDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
        submissionDate: new Date(Date.now() - 36 * 60 * 60 * 1000),
        applicantDetails: { vehicleType: 'Electric Two-Wheeler', vehicleNumber: 'KA-01-EV-9042', serviceZone: 'Bengaluru South', drivingLicense: 'KA01-2021-88912' },
        documents: [
          { docType: 'Driving License', docName: 'dl_karthik.png', docUrl: 'https://placehold.co/700x450/png?text=Driving+License', version: 1, status: 'Verified' as const },
          { docType: 'Vehicle RC', docName: 'rc_ev.png', docUrl: 'https://placehold.co/700x450/png?text=Vehicle+RC', version: 1, status: 'Pending' as const }
        ]
      },
      {
        requestId: 'KYC-2026-007',
        applicantId: 'TECH-5504',
        applicantName: 'Mahesh Electrician',
        applicantType: ApplicantType.TECHNICIAN,
        phone: '9611554433',
        email: 'mahesh.tech@connectservices.in',
        priority: 'Medium' as const,
        status: KycStatus.UNASSIGNED,
        registrationDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        submissionDate: new Date(Date.now() - 18 * 60 * 60 * 1000),
        applicantDetails: { skillCategory: 'Appliance & Electrical Repair', certificationId: 'ITI-BLR-2022', serviceZone: 'Indiranagar & Koramangala' },
        documents: [
          { docType: 'Trade Certificate', docName: 'iti_cert.png', docUrl: 'https://placehold.co/700x450/png?text=ITI+Certificate', version: 1, status: 'Pending' as const }
        ]
      },
      {
        requestId: 'KYC-2026-008',
        applicantId: 'EMP-KYC-009',
        applicantName: 'Divya Krishnan',
        applicantType: ApplicantType.KYC_EMPLOYEE,
        phone: '9880112201',
        email: 'divya.kyc@connectapp.in',
        priority: 'Medium' as const,
        status: KycStatus.APPROVED,
        assignedEmployeeId: 'EMP-KYC-001',
        assignedEmployeeName: 'Priya Sundaram',
        reviewedBy: 'Priya Sundaram',
        reviewedAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
        registrationDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        submissionDate: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
        applicantDetails: { department: 'KYC Team', designation: 'Junior KYC Analyst', workLocation: 'Bangalore Central HQ' },
        documents: [
          { docType: 'Employee Background Check', docName: 'bgv_divya.png', docUrl: 'https://placehold.co/700x450/png?text=BGV+Verified', version: 1, status: 'Verified' as const }
        ]
      },
      {
        requestId: 'KYC-2026-009',
        applicantId: 'EMP-PAY-009',
        applicantName: 'Siddharth Joshi',
        applicantType: ApplicantType.PAYMENT_EMPLOYEE,
        phone: '9880112202',
        email: 'siddharth.pay@connectapp.in',
        priority: 'High' as const,
        status: KycStatus.ASSIGNED,
        assignedEmployeeId: 'EMP-KYC-002',
        assignedEmployeeName: 'Arjun Nair',
        registrationDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        submissionDate: new Date(Date.now() - 28 * 60 * 60 * 1000),
        applicantDetails: { department: 'Payment Team', designation: 'Settlement Associate (Maker)', workLocation: 'Bangalore Central HQ' },
        documents: [
          { docType: 'PAN & Bank Verification', docName: 'pan_siddharth.png', docUrl: 'https://placehold.co/700x450/png?text=Payment+Staff+KYC', version: 1, status: 'Pending' as const }
        ]
      },
      {
        requestId: 'KYC-2026-010',
        applicantId: 'EMP-QRY-009',
        applicantName: 'Ananya Sen',
        applicantType: ApplicantType.QUERIES_EMPLOYEE,
        phone: '9880112203',
        email: 'ananya.queries@connectapp.in',
        priority: 'Low' as const,
        status: KycStatus.UNASSIGNED,
        registrationDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        submissionDate: new Date(Date.now() - 10 * 60 * 60 * 1000),
        applicantDetails: { department: 'Queries Team', designation: 'Vendor Support Specialist', workLocation: 'Remote Operations' },
        documents: [
          { docType: 'Aadhaar & Offer Letter', docName: 'offer_ananya.png', docUrl: 'https://placehold.co/700x450/png?text=Queries+Staff+KYC', version: 1, status: 'Pending' as const }
        ]
      }
    ];

    for (const kyc of section30Kycs) {
      const exists = await KycRequest.exists({ requestId: kyc.requestId });
      if (!exists) await KycRequest.create(kyc);
    }

    const section30Txns = [
      {
        transactionId: 'TXN-ORD-FOOD-101',
        referenceId: 'ORD-FOOD-9910',
        transactionType: 'Food Order Payment',
        financialClassification: FinancialClassification.INCOME,
        fromParty: { id: 'CUST-4012', name: 'Neha Kulkarni', type: 'Customer' },
        toParty: { id: 'VND-7701', name: 'Spice Route Kitchen', type: 'Vendor' },
        amount: 1240,
        grossAmount: 1240,
        tax: 62,
        commission: 124,
        finalAmount: 1240,
        paymentMethod: 'UPI',
        status: 'COMPLETED' as const,
        handledByEmployeeId: 'EMP-PAY-002',
        handledByEmployeeName: 'Meera Iyer',
        department: 'Payment Team',
        transactionDate: new Date(Date.now() - 16 * 60 * 60 * 1000),
        notes: 'Customer food delivery order payment'
      },
      {
        transactionId: 'TXN-ORD-DAILY-102',
        referenceId: 'ORD-DN-9911',
        transactionType: 'Daily Needs Order Payment',
        financialClassification: FinancialClassification.INCOME,
        fromParty: { id: 'CUST-4015', name: 'Rohan Malhotra', type: 'Customer' },
        toParty: { id: 'VND-7702', name: 'FreshBasket Groceries', type: 'Vendor' },
        amount: 2150,
        grossAmount: 2150,
        finalAmount: 2150,
        paymentMethod: 'Debit Card',
        status: 'COMPLETED' as const,
        handledByEmployeeId: 'EMP-PAY-002',
        handledByEmployeeName: 'Meera Iyer',
        department: 'Payment Team',
        transactionDate: new Date(Date.now() - 14 * 60 * 60 * 1000),
        notes: 'Daily needs essentials order'
      },
      {
        transactionId: 'TXN-BKG-STAY-103',
        referenceId: 'BKG-STAY-4401',
        transactionType: 'Stay Booking Payment',
        financialClassification: FinancialClassification.INCOME,
        fromParty: { id: 'CUST-4018', name: 'Kavita Rao', type: 'Customer' },
        toParty: { id: 'VND-7705', name: 'Coorg Mist Resort', type: 'Vendor' },
        amount: 6400,
        grossAmount: 6400,
        finalAmount: 6400,
        paymentMethod: 'Credit Card',
        status: 'COMPLETED' as const,
        handledByEmployeeId: 'EMP-PAY-002',
        handledByEmployeeName: 'Meera Iyer',
        department: 'Payment Team',
        transactionDate: new Date(Date.now() - 22 * 60 * 60 * 1000),
        notes: 'Hospitality stay booking inflow'
      },
      {
        transactionId: 'TXN-BKG-TRV-104',
        referenceId: 'BKG-TRV-4402',
        transactionType: 'Travel Booking Payment',
        financialClassification: FinancialClassification.INCOME,
        fromParty: { id: 'CUST-4020', name: 'Amit Deshmukh', type: 'Customer' },
        toParty: { id: 'VND-7708', name: 'Deccan Express Travels', type: 'Vendor' },
        amount: 3800,
        grossAmount: 3800,
        finalAmount: 3800,
        paymentMethod: 'NetBanking',
        status: 'COMPLETED' as const,
        handledByEmployeeId: 'EMP-PAY-002',
        handledByEmployeeName: 'Meera Iyer',
        department: 'Payment Team',
        transactionDate: new Date(Date.now() - 28 * 60 * 60 * 1000),
        notes: 'Customer travel booking payment'
      },
      {
        transactionId: 'TXN-SET-BKG-105',
        referenceId: 'APR-SET-501',
        transactionType: 'Vendor Booking Settlement',
        financialClassification: FinancialClassification.OUTGOING,
        fromParty: { id: 'CONNECT_OPERATIONS', name: 'Connect App Platform', type: 'Platform' },
        toParty: { id: 'VND-7705', name: 'Coorg Mist Resort', type: 'Vendor' },
        amount: 5440,
        grossAmount: 6400,
        commission: 960,
        finalAmount: 5440,
        paymentMethod: 'NEFT',
        status: 'COMPLETED' as const,
        handledByEmployeeId: 'EMP-PAY-002',
        handledByEmployeeName: 'Meera Iyer',
        department: 'Payment Team',
        transactionDate: new Date(Date.now() - 10 * 60 * 60 * 1000),
        notes: 'Vendor booking settlement payout net of platform commission'
      },
      {
        transactionId: 'TXN-AGT-TIEUP-106',
        referenceId: 'TIE-2026-301',
        transactionType: 'Agent Tie-up Payout',
        financialClassification: FinancialClassification.OUTGOING,
        fromParty: { id: 'CONNECT_OPERATIONS', name: 'Connect App Platform', type: 'Platform' },
        toParty: { id: 'AGT-104', name: 'Suresh Field Agent', type: 'Agent' },
        amount: 4500,
        grossAmount: 4500,
        finalAmount: 4500,
        paymentMethod: 'IMPS',
        status: 'COMPLETED' as const,
        handledByEmployeeId: 'EMP-PAY-002',
        handledByEmployeeName: 'Meera Iyer',
        department: 'Payment Team',
        transactionDate: new Date(Date.now() - 8 * 60 * 60 * 1000),
        notes: 'Agent vendor-tieup commission payout'
      },
      {
        transactionId: 'TXN-DEL-PAY-107',
        referenceId: 'DEL-BATCH-88',
        transactionType: 'Delivery Partner Payout',
        financialClassification: FinancialClassification.OUTGOING,
        fromParty: { id: 'CONNECT_OPERATIONS', name: 'Connect App Platform', type: 'Platform' },
        toParty: { id: 'DEL-8821', name: 'Karthik Gowda', type: 'Delivery Partner' },
        amount: 3250,
        grossAmount: 3250,
        finalAmount: 3250,
        paymentMethod: 'UPI AutoPay',
        status: 'COMPLETED' as const,
        handledByEmployeeId: 'EMP-PAY-002',
        handledByEmployeeName: 'Meera Iyer',
        department: 'Payment Team',
        transactionDate: new Date(Date.now() - 5 * 60 * 60 * 1000),
        notes: 'Weekly delivery partner logistics earnings payout'
      }
    ];

    for (const txn of section30Txns) {
      const exists = await PaymentTransaction.exists({ transactionId: txn.transactionId });
      if (!exists) await PaymentTransaction.create(txn);
    }

    const section30Queries = [
      {
        queryId: 'QRY-2026-104',
        userType: 'Agent',
        userId: 'AGT-104',
        userName: 'Suresh Field Agent',
        userEmail: 'suresh.agent@connectapp.in',
        userPhone: '9844123456',
        category: 'Commission & Tie-up',
        subject: 'District agent onboarding tie-up bonus confirmation',
        description: 'Need confirmation on tie-up commission credit for 3 newly onboarded merchants.',
        priority: 'High' as const,
        status: QueryStatus.ASSIGNED,
        currentDepartment: Department.QUERIES,
        sourceDepartment: Department.QUERIES,
        sharedDepartments: [Department.QUERIES],
        assignedEmployeeId: 'EMP-QRY-002',
        assignedEmployeeName: 'Deepak Nair',
        conversation: [],
        internalNotes: [],
        transferHistory: []
      },
      {
        queryId: 'QRY-2026-105',
        userType: 'Manager',
        userId: 'MGR-201',
        userName: 'Prakash Hegde',
        userEmail: 'prakash.mgr@connectapp.in',
        userPhone: '9845001122',
        category: 'Territory Operations',
        subject: 'Karnataka South pincode activation escalation',
        description: 'Requesting priority check for 4 pending zone approvals in Mysuru division.',
        priority: 'Urgent' as const,
        status: QueryStatus.IN_PROGRESS,
        currentDepartment: Department.QUERIES,
        sourceDepartment: Department.QUERIES,
        sharedDepartments: [Department.QUERIES],
        assignedEmployeeId: 'EMP-QRY-001',
        assignedEmployeeName: 'Kavitha Krishnan',
        conversation: [],
        internalNotes: [],
        transferHistory: []
      },
      {
        queryId: 'QRY-2026-106',
        userType: 'Sub Admin',
        userId: 'SUB-301',
        userName: 'Harishankar Menon',
        userEmail: 'harishankar.subadmin@connectapp.in',
        userPhone: '9845099881',
        category: 'Access & Permissions',
        subject: 'District Sub Admin reporting export threshold inquiry',
        description: 'Asking for clarification on daily district settlement summary export access.',
        priority: 'Medium' as const,
        status: QueryStatus.NEW,
        currentDepartment: Department.QUERIES,
        sourceDepartment: Department.QUERIES,
        sharedDepartments: [Department.QUERIES],
        conversation: [],
        internalNotes: [],
        transferHistory: []
      },
      {
        queryId: 'QRY-2026-107',
        userType: 'Delivery Partner',
        userId: 'DEL-8821',
        userName: 'Karthik Gowda',
        userEmail: 'karthik.rider@connectfleet.in',
        userPhone: '9741223344',
        category: 'Payout Delay',
        subject: 'Weekend surge incentive missing in delivery payout',
        description: 'Completed 18 rain-surge deliveries on Sunday; incentive portion missing in batch payout.',
        priority: 'High' as const,
        status: QueryStatus.ASSIGNED,
        currentDepartment: Department.QUERIES,
        sourceDepartment: Department.QUERIES,
        sharedDepartments: [Department.QUERIES],
        assignedEmployeeId: 'EMP-QRY-002',
        assignedEmployeeName: 'Deepak Nair',
        conversation: [],
        internalNotes: [],
        transferHistory: []
      },
      {
        queryId: 'QRY-2026-108',
        userType: 'Technician',
        userId: 'TECH-5504',
        userName: 'Mahesh Electrician',
        userEmail: 'mahesh.tech@connectservices.in',
        userPhone: '9611554433',
        category: 'Service Job Dispute',
        subject: 'Customer rescheduling fee settlement for AC service job',
        description: 'On-site visit completed within SLA; requesting cancellation visit allowance credit.',
        priority: 'Medium' as const,
        status: QueryStatus.NEW,
        currentDepartment: Department.QUERIES,
        sourceDepartment: Department.QUERIES,
        sharedDepartments: [Department.QUERIES],
        conversation: [],
        internalNotes: [],
        transferHistory: []
      },
      {
        queryId: 'QRY-2026-109',
        userType: 'KYC Team',
        userId: 'EMP-KYC-001',
        userName: 'Priya Sundaram',
        userEmail: 'kyc.lead@connectapp.in',
        userPhone: '9876543211',
        category: 'Document Follow-up',
        subject: 'Customer outreach needed for blurry FSSAI upload on VND-8812',
        description: 'Internal request from KYC Team asking Queries support to call vendor for clear scan.',
        priority: 'High' as const,
        status: QueryStatus.TRANSFERRED_TO_KYC,
        currentDepartment: Department.KYC,
        sourceDepartment: Department.KYC,
        sharedDepartments: [Department.KYC, Department.QUERIES],
        assignedEmployeeId: 'EMP-QRY-002',
        assignedEmployeeName: 'Deepak Nair',
        conversation: [],
        internalNotes: [],
        transferHistory: []
      },
      {
        queryId: 'QRY-2026-110',
        userType: 'Payment Team',
        userId: 'EMP-PAY-001',
        userName: 'Vikramaditya Verma',
        userEmail: 'payment.lead@connectapp.in',
        userPhone: '9876543212',
        category: 'Bank IFSC Clarification',
        subject: 'Vendor settlement UTR bounced due to dormant branch IFSC',
        description: 'Payment Team requests Queries outreach for updated cancelled cheque from Apex Food Supplies.',
        priority: 'Urgent' as const,
        status: QueryStatus.TRANSFERRED_TO_PAYMENT,
        currentDepartment: Department.PAYMENT,
        sourceDepartment: Department.PAYMENT,
        sharedDepartments: [Department.PAYMENT, Department.QUERIES],
        conversation: [],
        internalNotes: [],
        transferHistory: []
      },
      {
        queryId: 'QRY-2026-111',
        userType: 'Queries Team Internal',
        userId: 'EMP-QRY-001',
        userName: 'Kavitha Krishnan',
        userEmail: 'queries.lead@connectapp.in',
        userPhone: '9876543213',
        category: 'Internal SLA Handoff',
        subject: 'Shift handover audit for high-priority festival season refund queue',
        description: 'Internal Queries Team checklist and weekend roster coordination ticket.',
        priority: 'Low' as const,
        status: QueryStatus.IN_PROGRESS,
        currentDepartment: Department.QUERIES,
        sourceDepartment: Department.QUERIES,
        sharedDepartments: [Department.QUERIES],
        assignedEmployeeId: 'EMP-QRY-002',
        assignedEmployeeName: 'Deepak Nair',
        conversation: [],
        internalNotes: [],
        transferHistory: []
      }
    ];

    for (const q of section30Queries) {
      const exists = await QueryTicket.exists({ queryId: q.queryId });
      if (!exists) await QueryTicket.create(q);
    }

    // 14. Section 31 Sample Income, Expenses (Completed/Pending/Failed) & Salary Records
    const section31Txns = [
      {
        transactionId: 'TXN-AGT-FEE-201',
        referenceId: 'FEE-AGT-8801',
        transactionType: 'Agent Onboarding Fee',
        financialClassification: FinancialClassification.INCOME,
        fromParty: { id: 'AGT-104', name: 'Suresh Field Agent', type: 'Agent' },
        toParty: { id: 'CONNECT_REVENUE', name: 'Connect App Platform Fees', type: 'Platform' },
        amount: 2500,
        grossAmount: 2500,
        tax: 381,
        discount: 0,
        finalAmount: 2500,
        paymentMethod: 'UPI',
        gatewayReference: 'UTR-AGT-FEE-9910',
        status: 'COMPLETED' as const,
        handledByEmployeeId: 'EMP-PAY-002',
        handledByEmployeeName: 'Neha Chawla',
        department: 'Payment Team',
        transactionDate: new Date(Date.now() - 4 * 60 * 60 * 1000),
        notes: 'Non-refundable agent onboarding & portal activation fee (qualifies as Income)',
        metadata: {
          paymentCategory: 'Non-Refundable Onboarding Fee',
          isRefundable: false,
          paymentReference: 'UTR-AGT-FEE-9910'
        }
      },
      {
        transactionId: 'TXN-VSUB-202',
        referenceId: 'SUB-ENT-3302',
        transactionType: 'Vendor Subscription Renewal',
        financialClassification: FinancialClassification.INCOME,
        fromParty: { id: 'VND-7701', name: 'Spice Route Kitchen', type: 'Vendor' },
        toParty: { id: 'CONNECT_REVENUE', name: 'Connect App Subscriptions', type: 'Platform' },
        amount: 8500,
        grossAmount: 8500,
        tax: 1530,
        discount: 0,
        finalAmount: 8500,
        paymentMethod: 'Credit Card',
        gatewayReference: 'pay_vsub_88201',
        status: 'COMPLETED' as const,
        handledByEmployeeId: 'EMP-PAY-002',
        handledByEmployeeName: 'Neha Chawla',
        department: 'Payment Team',
        transactionDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        notes: 'Vendor annual enterprise plan renewal',
        metadata: {
          businessName: 'Spice Route Hospitality Pvt Ltd',
          subscriptionPlan: 'Enterprise Gold',
          subscriptionDuration: '12 Months',
          subscriptionExpiry: new Date(Date.now() + 360 * 24 * 60 * 60 * 1000).toISOString()
        }
      },
      {
        transactionId: 'TXN-MEM-203',
        referenceId: 'MEM-PLAT-5521',
        transactionType: 'Membership Renewal',
        financialClassification: FinancialClassification.INCOME,
        fromParty: { id: 'CUST-4012', name: 'Neha Kulkarni', type: 'Customer' },
        toParty: { id: 'CONNECT_REVENUE', name: 'Connect App Memberships', type: 'Platform' },
        amount: 2999,
        grossAmount: 2999,
        tax: 540,
        discount: 0,
        finalAmount: 2999,
        paymentMethod: 'UPI',
        gatewayReference: 'pay_mem_55219',
        status: 'COMPLETED' as const,
        handledByEmployeeId: 'EMP-PAY-002',
        handledByEmployeeName: 'Neha Chawla',
        department: 'Payment Team',
        transactionDate: new Date(Date.now() - 2 * 60 * 60 * 1000),
        notes: 'Platinum membership renewal payment',
        metadata: {
          membershipId: 'MEM-PLAT-5521',
          membershipPlan: 'Connect Platinum Pass',
          validityPeriod: '12 Months'
        }
      },
      {
        transactionId: 'TXN-TEC-PAY-204',
        referenceId: 'STL-TEC-4409',
        transactionType: 'Technician Payout',
        financialClassification: FinancialClassification.OUTGOING,
        fromParty: { id: 'CONNECT_OPERATIONS', name: 'Connect App Platform', type: 'Platform' },
        toParty: { id: 'TEC-5510', name: 'Praveen Kumar', type: 'Technician' },
        amount: 1950,
        grossAmount: 2200,
        commission: 220,
        deductions: 30,
        finalAmount: 1950,
        paymentMethod: 'IMPS',
        gatewayReference: 'IMPS-TEC-7741',
        status: 'COMPLETED' as const,
        handledByEmployeeId: 'EMP-PAY-002',
        handledByEmployeeName: 'Neha Chawla',
        department: 'Payment Team',
        transactionDate: new Date(Date.now() - 6 * 60 * 60 * 1000),
        notes: 'Service booking completion settlement to technician',
        metadata: {
          serviceBookingId: 'BKG-SRV-4488',
          completedService: 'Split AC PCB Repair & Gas Refill'
        }
      },
      {
        transactionId: 'TXN-SET-PEND-205',
        referenceId: 'STL-VND-9012',
        transactionType: 'Vendor Order Settlement',
        financialClassification: FinancialClassification.OUTGOING,
        fromParty: { id: 'CONNECT_ESCROW', name: 'Connect App Settlement Escrow', type: 'Platform' },
        toParty: { id: 'VND-7701', name: 'Spice Route Kitchen', type: 'Vendor' },
        amount: 4200,
        grossAmount: 4800,
        commission: 480,
        deductions: 120,
        finalAmount: 4200,
        paymentMethod: 'NEFT',
        status: 'PENDING' as const,
        handledByEmployeeId: 'EMP-PAY-002',
        handledByEmployeeName: 'Neha Chawla',
        department: 'Payment Team',
        transactionDate: new Date(Date.now() - 1 * 60 * 60 * 1000),
        notes: 'Pending vendor order settlement awaiting bank batch clearing',
        metadata: {
          settlementId: 'STL-VND-9012',
          businessName: 'Spice Route Hospitality Pvt Ltd',
          relatedOrderId: 'ORD-FOOD-9910'
        }
      },
      {
        transactionId: 'TXN-DEL-FAIL-206',
        referenceId: 'DEL-BATCH-99',
        transactionType: 'Delivery Partner Payout',
        financialClassification: FinancialClassification.OUTGOING,
        fromParty: { id: 'CONNECT_OPERATIONS', name: 'Connect App Platform', type: 'Platform' },
        toParty: { id: 'DEL-8821', name: 'Karthik Gowda', type: 'Delivery Partner' },
        amount: 1650,
        grossAmount: 1800,
        deductions: 150,
        finalAmount: 1650,
        paymentMethod: 'UPI AutoPay',
        gatewayReference: 'ERR-NPCI-IFSC-MISMATCH',
        status: 'FAILED' as const,
        handledByEmployeeId: 'EMP-PAY-002',
        handledByEmployeeName: 'Neha Chawla',
        department: 'Payment Team',
        transactionDate: new Date(Date.now() - 3 * 60 * 60 * 1000),
        notes: 'Failed payout due to beneficiary VPA timeout (excluded from Completed Expenses)',
        metadata: {
          completedDeliveries: 36,
          adjustments: -150,
          relatedOrderId: 'DEL-BATCH-99'
        }
      }
    ];

    for (const txn of section31Txns) {
      const exists = await PaymentTransaction.exists({ transactionId: txn.transactionId });
      if (!exists) await PaymentTransaction.create(txn);
    }

    const section31Salaries = [
      {
        salaryId: 'SAL-2026-WK44',
        employeeId: 'EMP-QRY-002',
        employeeName: 'Deepak Nair',
        department: Department.QUERIES,
        designation: 'Support Specialist',
        salaryCycle: 'Weekly' as const,
        periodStart: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        periodEnd: new Date(),
        periodLabel: 'Week 45 - Nov 2026',
        earnings: { basic: 7500, hra: 2000, allowances: 1000, incentives: 500, bonus: 0, overtime: 400, gross: 11400 },
        deductions: { pf: 900, esi: 100, tax: 200, advanceRecovery: 0, unpaidLeaveDeduction: 0, other: 0, total: 1200 },
        netSalary: 10200,
        bankDetails: { accountHolder: 'Deepak Nair', accountNumberMasked: '••••••••8821', ifscCode: 'SBIN0004412', bankName: 'State Bank of India' },
        status: SalaryStatus.PAID,
        preparedBy: { userId: 'EMP-PAY-002', name: 'Neha Chawla', role: 'payment_employee', at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
        approvedByOverallLead: { userId: 'EMP-LEAD-001', name: 'Aravind Narayanan', role: 'overall_lead', at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), notes: 'Weekly payroll approved' },
        paidDetails: { paidByUserId: 'EMP-PAY-002', paidByName: 'Neha Chawla', paymentDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), transactionId: 'TXN-SAL-WK45-001', paymentMethod: 'Direct Bank Deposit' }
      },
      {
        salaryId: 'SAL-2026-002',
        employeeId: 'EMP-PAY-002',
        employeeName: 'Neha Chawla',
        department: Department.PAYMENT,
        designation: 'Senior Payment Analyst',
        salaryCycle: 'Monthly' as const,
        periodStart: new Date(2026, 9, 1),
        periodEnd: new Date(2026, 9, 31),
        periodLabel: 'October 2026',
        earnings: { basic: 40000, hra: 16000, allowances: 11000, incentives: 2000, bonus: 0, overtime: 0, gross: 69000 },
        deductions: { pf: 4800, esi: 0, tax: 3200, advanceRecovery: 0, unpaidLeaveDeduction: 0, other: 0, total: 8000 },
        netSalary: 61000,
        bankDetails: { accountHolder: 'Neha Chawla', accountNumberMasked: '••••••••3391', ifscCode: 'HDFC0001092', bankName: 'HDFC Bank' },
        status: SalaryStatus.APPROVED,
        preparedBy: { userId: 'EMP-PAY-001', name: 'Vikramaditya Verma', role: 'payment_lead', at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
        approvedByOverallLead: { userId: 'EMP-LEAD-001', name: 'Aravind Narayanan', role: 'overall_lead', at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), notes: 'Approved for release' }
      }
    ];

    for (const sal of section31Salaries) {
      const exists = await SalaryRecord.exists({ salaryId: sal.salaryId });
      if (!exists) await SalaryRecord.create(sal);
    }

    console.log('[Seed]: All operational data successfully verified and seeded!');
    process.exit(0);
  } catch (error: any) {
    console.error('[Seed]: Error seeding data:', error);
    process.exit(1);
  }
};

if (require.main === module) {
  seedDatabase();
}

