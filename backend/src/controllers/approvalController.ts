import { Request, Response } from 'express';
import { FinancialApproval } from '../models/FinancialApproval';
import { PaymentTransaction } from '../models/PaymentTransaction';
import { ApprovalStatus, FinancialClassification } from '../config/constants';
import { generateId, maskBankAccount, buildIdFilter } from '../utils/security';
import { logAudit } from '../middleware/auditLogger';

export class ApprovalController {
  /**
   * Maker: Initiate a new financial transaction for Checker Review
   */
  static async initiateTransaction(req: Request, res: Response): Promise<any> {
    try {
      const currentUser = req.user!;
      const {
        transactionType,
        financialClassification,
        amount,
        recipientType,
        recipientId,
        recipientName,
        bankDetails,
        makerNotes,
        idempotencyKey,
        relatedReferenceId
      } = req.body;

      if (!transactionType || !amount || !recipientId || !recipientName) {
        return res.status(400).json({
          success: false,
          message: 'transactionType, amount, recipientId, and recipientName are required.'
        });
      }

      // Enforce Section 31 H: Financial classification determined by transaction purpose
      const lowerType = String(transactionType).toLowerCase();
      let expectedClassification: FinancialClassification = FinancialClassification.OUTGOING;
      if (lowerType.includes('initial deposit') || lowerType.includes('security deposit')) {
        expectedClassification = FinancialClassification.LIABILITY;
      } else if (
        lowerType.includes('order payment') ||
        lowerType.includes('booking payment') ||
        lowerType.includes('subscription') ||
        lowerType.includes('membership') ||
        lowerType.includes('fee') ||
        lowerType.includes('income')
      ) {
        expectedClassification = FinancialClassification.INCOME;
      }

      if (financialClassification && financialClassification !== expectedClassification) {
        return res.status(400).json({
          success: false,
          message: `FINANCIAL CLASSIFICATION ERROR: "${transactionType}" must be classified as "${expectedClassification}", not "${financialClassification}".`
        });
      }

      // Prevent duplicate submission with same idempotency key
      const key = idempotencyKey || generateId('IDEM');
      const existing = await FinancialApproval.findOne({ idempotencyKey: key });
      if (existing) {
        return res.status(409).json({
          success: false,
          message: 'A transaction with this idempotency key has already been initiated.'
        });
      }

      // Prevent duplicate active or completed payout for the same reference & recipient
      if (relatedReferenceId && String(relatedReferenceId).trim().length > 0) {
        const dupApproval = await FinancialApproval.findOne({
          relatedReferenceId: String(relatedReferenceId).trim(),
          recipientId,
          transactionType,
          status: { $in: [ApprovalStatus.PENDING_CHECKER, ApprovalStatus.APPROVED, ApprovalStatus.PROCESSING, ApprovalStatus.COMPLETED] }
        });
        const dupTxn = await PaymentTransaction.findOne({
          referenceId: String(relatedReferenceId).trim(),
          'toParty.id': recipientId,
          transactionType,
          status: 'COMPLETED'
        });
        if (dupApproval || dupTxn) {
          return res.status(409).json({
            success: false,
            message: `Duplicate payout prevented: Reference "${relatedReferenceId}" already has an active or completed payout for ${recipientName}.`
          });
        }
      }

      const approvalId = generateId('APR');

      const approval = new FinancialApproval({
        approvalId,
        transactionType,
        financialClassification: expectedClassification,
        amount: Number(amount),
        recipientType,
        recipientId,
        recipientName,
        bankDetails: {
          accountHolder: bankDetails?.accountHolder || recipientName,
          accountNumberMasked: maskBankAccount(bankDetails?.accountNumber),
          ifscCode: bankDetails?.ifscCode || 'HDFC0001234',
          bankName: bankDetails?.bankName || 'HDFC Bank'
        },
        makerId: currentUser.employeeId,
        makerName: currentUser.name,
        makerRole: currentUser.role,
        makerNotes: makerNotes || '',
        initiatedAt: new Date(),
        status: ApprovalStatus.PENDING_CHECKER,
        idempotencyKey: key,
        relatedReferenceId: relatedReferenceId || '',
        history: [
          {
            action: 'SUBMITTED_FOR_CHECKER_REVIEW',
            actorId: currentUser.employeeId,
            actorName: currentUser.name,
            actorRole: currentUser.role,
            details: `Transaction of ₹${amount} initiated for ${recipientName} (${recipientType}).`,
            timestamp: new Date()
          }
        ]
      });

      await approval.save();

      await logAudit(
        req,
        'FINANCIAL_TRANSACTION_INITIATED',
        'PAYMENT',
        approvalId,
        `Maker ${currentUser.name} initiated ₹${amount} (${transactionType}) for checker review.`
      );

      return res.status(201).json({
        success: true,
        message: 'Transaction successfully submitted for Checker Review.',
        data: approval
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * List pending and completed approvals
   */
  static async listApprovals(req: Request, res: Response): Promise<any> {
    try {
      const { status, transactionType, makerId, startDate, endDate, search, page = '1', limit = '50' } = req.query;
      const filter: any = {};

      if (status && status !== 'All') filter.status = status;
      if (transactionType && transactionType !== 'All') filter.transactionType = transactionType;
      if (makerId && makerId !== 'All') filter.makerId = makerId;

      if (startDate || endDate) {
        filter.initiatedAt = {};
        if (startDate) filter.initiatedAt.$gte = new Date(startDate as string);
        if (endDate) {
          const endDt = new Date(endDate as string);
          endDt.setHours(23, 59, 59, 999);
          filter.initiatedAt.$lte = endDt;
        }
      }

      if (search) {
        filter.$or = [
          { approvalId: { $regex: search, $options: 'i' } },
          { recipientName: { $regex: search, $options: 'i' } },
          { recipientId: { $regex: search, $options: 'i' } },
          { makerName: { $regex: search, $options: 'i' } }
        ];
      }

      const pageNum = Math.max(1, Number(page) || 1);
      const limitNum = Math.min(100, Math.max(1, Number(limit) || 50));
      const skip = (pageNum - 1) * limitNum;

      const [approvals, total, allItems] = await Promise.all([
        FinancialApproval.find(filter).sort({ initiatedAt: -1 }).skip(skip).limit(limitNum),
        FinancialApproval.countDocuments(filter),
        FinancialApproval.find().select('status amount').lean()
      ]);

      const summary = {
        totalCount: allItems.length,
        pendingCount: allItems.filter((a) => a.status === ApprovalStatus.PENDING_CHECKER).length,
        inProgressCount: allItems.filter((a) => a.status === ApprovalStatus.APPROVED || a.status === ApprovalStatus.PROCESSING).length,
        completedCount: allItems.filter((a) => a.status === ApprovalStatus.COMPLETED).length,
        totalAmount: allItems.reduce((s, a) => s + (a.amount || 0), 0)
      };

      return res.json({
        success: true,
        count: approvals.length,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.max(1, Math.ceil(total / limitNum)),
        summary,
        data: approvals
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getApprovalById(req: Request, res: Response): Promise<any> {
    try {
      const { id } = req.params;
    const approval = await FinancialApproval.findOne(buildIdFilter('approvalId', id));

      if (!approval) {
        return res.status(404).json({ success: false, message: 'Approval record not found.' });
      }

      return res.json({
        success: true,
        data: approval
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Checker: Review & Approve or Reject (Strict Maker != Checker enforced!)
   */
  static async reviewApproval(req: Request, res: Response): Promise<any> {
    try {
      const currentUser = req.user!;
      const { id } = req.params;
      const { decision, reason, remarks } = req.body;

    const approval = await FinancialApproval.findOne(buildIdFilter('approvalId', id));

      if (!approval) {
        return res.status(404).json({ success: false, message: 'Approval record not found.' });
      }

      // Check current status
      if (approval.status !== ApprovalStatus.PENDING_CHECKER) {
        return res.status(400).json({
          success: false,
          message: `Cannot review transaction with status "${approval.status}".`
        });
      }

      // STRICT MAKER-CHECKER ENFORCEMENT: MAKER CANNOT APPROVE OWN TRANSACTION
      if (approval.makerId === currentUser.employeeId || approval.makerId === currentUser.id) {
        return res.status(403).json({
          success: false,
          message: 'CRITICAL SECURITY BREACH PREVENTED: Maker cannot approve their own financial transaction. A separate authorized Checker must review this item.'
        });
      }

      if (decision === 'APPROVE') {
        approval.status = ApprovalStatus.APPROVED;
        approval.checkerId = currentUser.employeeId;
        approval.checkerName = currentUser.name;
        approval.checkerRole = currentUser.role;
        approval.reviewedAt = new Date();
        approval.history.push({
          action: 'CHECKER_APPROVED',
          actorId: currentUser.employeeId,
          actorName: currentUser.name,
          actorRole: currentUser.role,
          details: `Approved by Checker ${currentUser.name}. Remarks: ${remarks || 'None'}`,
          timestamp: new Date()
        });

        await approval.save();

        await logAudit(
          req,
          'FINANCIAL_APPROVAL_APPROVED',
          'PAYMENT',
          approval.approvalId,
          `Checker ${currentUser.name} approved transaction ${approval.approvalId} for ₹${approval.amount}.`
        );

        return res.json({
          success: true,
          message: 'Financial transaction approved by Checker. Eligible for payment execution.',
          data: approval
        });
      }

      if (decision === 'REJECT') {
        if (!reason || reason.trim().length === 0) {
          return res.status(400).json({
            success: false,
            message: 'Mandatory reason is required to reject a financial transaction.'
          });
        }

        approval.status = ApprovalStatus.REJECTED;
        approval.checkerId = currentUser.employeeId;
        approval.checkerName = currentUser.name;
        approval.checkerRole = currentUser.role;
        approval.reviewedAt = new Date();
        approval.rejectionReason = reason;
        approval.history.push({
          action: 'CHECKER_REJECTED',
          actorId: currentUser.employeeId,
          actorName: currentUser.name,
          actorRole: currentUser.role,
          details: `Rejected by Checker ${currentUser.name}. Reason: ${reason}`,
          timestamp: new Date()
        });

        await approval.save();

        await logAudit(
          req,
          'FINANCIAL_APPROVAL_REJECTED',
          'PAYMENT',
          approval.approvalId,
          `Checker ${currentUser.name} rejected transaction ${approval.approvalId}. Reason: ${reason}`
        );

        return res.json({
          success: true,
          message: 'Financial transaction rejected by Checker.',
          data: approval
        });
      }

      return res.status(400).json({ success: false, message: 'Invalid review decision. Must be APPROVE or REJECT.' });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Process and execute approved transaction
   */
  static async executePayment(req: Request, res: Response): Promise<any> {
    try {
      const currentUser = req.user!;
      const { id } = req.params;
      const { paymentMethod, gatewayReference } = req.body;

    const approval = await FinancialApproval.findOne(buildIdFilter('approvalId', id));

      if (!approval) {
        return res.status(404).json({ success: false, message: 'Approval record not found.' });
      }

      // Must be in APPROVED status
      if (approval.status !== ApprovalStatus.APPROVED) {
        return res.status(403).json({
          success: false,
          message: `Cannot process payment. Current transaction status is "${approval.status}". Checker approval is required first.`
        });
      }

      // Guard against duplicate execution creating duplicate ledger transactions
      const alreadyExecuted = await PaymentTransaction.exists({ makerApprovalId: approval.approvalId });
      if (alreadyExecuted) {
        return res.status(409).json({
          success: false,
          message: `Duplicate disbursement prevented for approval ${approval.approvalId}.`
        });
      }

      approval.status = ApprovalStatus.COMPLETED;
      approval.processedAt = new Date();
      approval.history.push({
        action: 'PAYMENT_EXECUTED',
        actorId: currentUser.employeeId,
        actorName: currentUser.name,
        actorRole: currentUser.role,
        details: `Disbursement executed via ${paymentMethod || 'Bank Transfer'}. Reference: ${gatewayReference || 'N/A'}`,
        timestamp: new Date()
      });

      await approval.save();

      // Create completed PaymentTransaction in ledger
      const transactionId = generateId('TXN-PAY');
      await PaymentTransaction.create({
        transactionId,
        referenceId: approval.approvalId,
        transactionType: approval.transactionType,
        financialClassification: approval.financialClassification,
        fromParty: { id: 'CONNECT_DISBURSEMENT', name: 'Connect App Operations', type: 'Platform' },
        toParty: { id: approval.recipientId, name: approval.recipientName, type: approval.recipientType },
        amount: approval.amount,
        grossAmount: approval.amount,
        finalAmount: approval.amount,
        paymentMethod: paymentMethod || 'Bank Transfer',
        gatewayReference: gatewayReference || '',
        status: 'COMPLETED',
        handledByEmployeeId: currentUser.employeeId,
        handledByEmployeeName: currentUser.name,
        department: 'Payment Team',
        makerApprovalId: approval.approvalId,
        transactionDate: new Date(),
        notes: `Disbursed following Checker approval (${approval.checkerName}).`
      });

      await logAudit(
        req,
        'PAYMENT_DISBURSED',
        'PAYMENT',
        approval.approvalId,
        `Disbursement of ₹${approval.amount} to ${approval.recipientName} successfully executed.`
      );

      return res.json({
        success: true,
        message: 'Payment executed and finalized in transaction ledger.',
        data: approval
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}

