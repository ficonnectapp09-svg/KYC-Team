import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { PaymentTransaction } from '../models/PaymentTransaction';
import { AgentDepositLiability } from '../models/AgentDepositLiability';
import { FinancialApproval } from '../models/FinancialApproval';
import { FinancialLedgerService } from '../services/financialLedgerService';
import { ApprovalStatus, FinancialClassification } from '../config/constants';
import {
  EXPENSE_BASE_FILTER,
  INCOME_BASE_FILTER,
  PAYMENT_CATEGORIES,
  resolvePaymentCategory
} from '../config/categoryCatalog';
import { generateId, buildIdFilter } from '../utils/security';
import { logAudit } from '../middleware/auditLogger';

function buildDateRange(presetDateRange?: unknown, startDate?: unknown, endDate?: unknown) {
  if (presetDateRange && presetDateRange !== 'All' && presetDateRange !== 'Custom') {
    const now = new Date();
    const start = new Date();
    const end = new Date();
    if (presetDateRange === 'Today') {
      start.setHours(0, 0, 0, 0);
    } else if (presetDateRange === 'Yesterday') {
      start.setDate(now.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end.setDate(now.getDate() - 1);
      end.setHours(23, 59, 59, 999);
    } else if (presetDateRange === 'This Week') {
      start.setDate(now.getDate() - 7);
      start.setHours(0, 0, 0, 0);
    } else if (presetDateRange === 'This Month') {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
    }
    return { $gte: start, $lte: end };
  }
  if (startDate || endDate) {
    const range: any = {};
    if (startDate) range.$gte = new Date(startDate as string);
    if (endDate) {
      const endDt = new Date(endDate as string);
      endDt.setHours(23, 59, 59, 999);
      range.$lte = endDt;
    }
    return range;
  }
  return null;
}

export class PaymentController {
  private static async computeCategoryCounts(): Promise<Record<string, number>> {
    const counts: Record<string, number> = {};
    await Promise.all(
      PAYMENT_CATEGORIES.map(async (cat) => {
        if (cat.sourceModel === 'TRANSACTION') {
          counts[cat.key] = await PaymentTransaction.countDocuments(cat.txnFilter || {});
        } else if (cat.sourceModel === 'LIABILITY') {
          counts[cat.key] = await AgentDepositLiability.countDocuments();
        } else if (cat.sourceModel === 'APPROVAL') {
          counts[cat.key] = await FinancialApproval.countDocuments();
        }
      })
    );
    counts.OVERVIEW = counts.ALL || 0;
    return counts;
  }

  static async getCategoryCounts(req: Request, res: Response): Promise<any> {
    try {
      const counts = await PaymentController.computeCategoryCounts();
      return res.json({ success: true, data: counts });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getPaymentKpis(req: Request, res: Response): Promise<any> {
    try {
      const metrics = await FinancialLedgerService.getFinancialMetrics();
      return res.json({
        success: true,
        data: metrics
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  private static buildTransactionQuery(queryParams: Record<string, any>) {
    const {
      category,
      section,
      financialClassification,
      transactionType,
      subCategory,
      status,
      paymentMethod,
      handledByEmployeeId,
      search,
      startDate,
      endDate,
      presetDateRange
    } = queryParams;

    const andClauses: any[] = [];
    let resolvedCategory = resolvePaymentCategory('ALL')!;

    if (section === 'income') {
      andClauses.push(INCOME_BASE_FILTER);
    } else if (section === 'expenses') {
      andClauses.push(EXPENSE_BASE_FILTER);
    }

    if (category && category !== 'All') {
      const found = resolvePaymentCategory(String(category));
      if (!found) {
        return { error: `Unsupported Payment category filter: "${category}".` };
      }
      resolvedCategory = found;
      if (found.txnFilter && Object.keys(found.txnFilter).length > 0) {
        andClauses.push(found.txnFilter);
      }
    }

    if (financialClassification && financialClassification !== 'All') {
      andClauses.push({ financialClassification });
    }
    if (transactionType && transactionType !== 'All') {
      andClauses.push({ transactionType });
    }
    if (subCategory && subCategory !== 'All') {
      andClauses.push({ transactionType: { $regex: String(subCategory), $options: 'i' } });
    }
    if (status && status !== 'All') {
      if (status === 'PROCESSING' || status === 'Processing' || status === 'In Progress') {
        andClauses.push({ status: { $in: ['PROCESSING', 'PENDING'] } });
      } else {
        andClauses.push({ status });
      }
    }
    if (paymentMethod && paymentMethod !== 'All') {
      andClauses.push({ paymentMethod });
    }
    if (handledByEmployeeId && handledByEmployeeId !== 'All') {
      andClauses.push({ handledByEmployeeId });
    }

    const dateRange = buildDateRange(presetDateRange, startDate, endDate);
    if (dateRange) {
      andClauses.push({ transactionDate: dateRange });
    }

    if (search) {
      andClauses.push({
        $or: [
          { transactionId: { $regex: search, $options: 'i' } },
          { referenceId: { $regex: search, $options: 'i' } },
          { transactionType: { $regex: search, $options: 'i' } },
          { gatewayReference: { $regex: search, $options: 'i' } },
          { 'fromParty.name': { $regex: search, $options: 'i' } },
          { 'toParty.name': { $regex: search, $options: 'i' } },
          { 'fromParty.id': { $regex: search, $options: 'i' } },
          { 'toParty.id': { $regex: search, $options: 'i' } }
        ]
      });
    }

    const filter = andClauses.length > 0 ? { $and: andClauses } : {};
    return { filter, resolvedCategory };
  }

  static async listTransactions(req: Request, res: Response): Promise<any> {
    try {
      const { page = '1', limit = '50', section } = req.query;
      const built = PaymentController.buildTransactionQuery(req.query);
      if ('error' in built) {
        return res.status(400).json({ success: false, message: built.error });
      }
      const { filter, resolvedCategory } = built;

      const pageNum = Math.max(1, Number(page) || 1);
      const limitNum = Math.min(100, Math.max(1, Number(limit) || 50));
      const skip = (pageNum - 1) * limitNum;

      const baseClauses: any[] = [];
      if (section === 'income') baseClauses.push(INCOME_BASE_FILTER);
      else if (section === 'expenses') baseClauses.push(EXPENSE_BASE_FILTER);
      if (resolvedCategory.txnFilter && Object.keys(resolvedCategory.txnFilter).length > 0) {
        baseClauses.push(resolvedCategory.txnFilter);
      }
      const categoryBaseFilter = baseClauses.length > 0 ? { $and: baseClauses } : {};

      const [transactions, total, categoryItems, categoryCounts] = await Promise.all([
        PaymentTransaction.find(filter).sort({ transactionDate: -1 }).skip(skip).limit(limitNum),
        PaymentTransaction.countDocuments(filter),
        PaymentTransaction.find(categoryBaseFilter).select('status finalAmount amount').lean(),
        PaymentController.computeCategoryCounts()
      ]);

      const completedItems = categoryItems.filter((t) => t.status === 'COMPLETED');
      const pendingItems = categoryItems.filter((t) => ['PENDING', 'PROCESSING', 'ON_HOLD'].includes(t.status));
      const failedItems = categoryItems.filter((t) => t.status === 'FAILED');

      const summary = {
        totalCount: categoryItems.length,
        pendingCount: pendingItems.length,
        inProgressCount: categoryItems.filter((t) => t.status === 'PROCESSING').length,
        completedCount: completedItems.length,
        failedCount: failedItems.length,
        // Strictly count ONLY completed qualifying amounts toward totalAmount / completedAmount
        totalAmount: completedItems.reduce((sum, t) => sum + (t.finalAmount || t.amount || 0), 0),
        pendingAmount: pendingItems.reduce((sum, t) => sum + (t.finalAmount || t.amount || 0), 0),
        failedAmount: failedItems.reduce((sum, t) => sum + (t.finalAmount || t.amount || 0), 0)
      };

      return res.json({
        success: true,
        category: resolvedCategory,
        count: transactions.length,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.max(1, Math.ceil(total / limitNum)),
        summary,
        categoryCounts,
        data: transactions
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async exportTransactionsCsv(req: Request, res: Response): Promise<any> {
    try {
      const built = PaymentController.buildTransactionQuery(req.query);
      if ('error' in built) {
        return res.status(400).json({ success: false, message: built.error });
      }
      const rows = await PaymentTransaction.find(built.filter)
        .sort({ transactionDate: -1 })
        .limit(2000)
        .lean();

      const escapeCsv = (val: unknown): string => {
        const s = String(val ?? '');
        const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
        return `"${safe.replace(/"/g, '""')}"`;
      };

      const header = [
        'Transaction ID',
        'Reference ID',
        'Classification',
        'Category / Type',
        'From Party',
        'To Party',
        'Gross Amount',
        'Tax',
        'Discount',
        'Commission',
        'Deductions',
        'Final Amount',
        'Payment Method',
        'Status',
        'Handler',
        'Date'
      ];
      const lines = [
        header.join(','),
        ...rows.map((r) =>
          [
            r.transactionId,
            r.referenceId,
            r.financialClassification,
            r.transactionType,
            `${r.fromParty?.name || ''} (${r.fromParty?.id || ''})`,
            `${r.toParty?.name || ''} (${r.toParty?.id || ''})`,
            r.grossAmount ?? r.amount ?? 0,
            r.tax ?? 0,
            r.discount ?? 0,
            r.commission ?? 0,
            r.deductions ?? 0,
            r.finalAmount ?? r.amount ?? 0,
            r.paymentMethod,
            r.status,
            r.handledByEmployeeName || r.handledByEmployeeId || '',
            r.transactionDate ? new Date(r.transactionDate).toISOString() : ''
          ]
            .map(escapeCsv)
            .join(',')
        )
      ];

      await logAudit(
        req,
        'TRANSACTIONS_EXPORTED',
        'PAYMENT',
        built.resolvedCategory.key,
        `Exported ${rows.length} transactions (${built.resolvedCategory.label}).`
      );

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${built.resolvedCategory.slug}-transactions.csv"`);
      return res.send(lines.join('\n'));
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getTransactionById(req: Request, res: Response): Promise<any> {
    try {
      const { id } = req.params;
      const transaction = await PaymentTransaction.findOne(buildIdFilter('transactionId', id)).lean();

      if (!transaction) {
        return res.status(404).json({ success: false, message: 'Transaction record not found.' });
      }

      const [approvalRecord, liabilityRecord] = await Promise.all([
        transaction.makerApprovalId
          ? FinancialApproval.findOne({ approvalId: transaction.makerApprovalId }).lean()
          : FinancialApproval.findOne({ approvalId: transaction.referenceId }).lean(),
        AgentDepositLiability.findOne({
          $or: [
            { originalTransactionId: transaction.transactionId },
            { liabilityId: transaction.referenceId }
          ]
        }).lean()
      ]);

      return res.json({
        success: true,
        data: {
          ...transaction,
          approvalRecord: approvalRecord || null,
          liabilityRecord: liabilityRecord || null
        }
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Agent Deposit Liability Management
   * Strict Rule: Agent initial deposits are liabilities, NEVER recognized income!
   */
  static async listAgentDeposits(req: Request, res: Response): Promise<any> {
    try {
      const { status, search, startDate, endDate, presetDateRange, page = '1', limit = '50' } = req.query;
      const filter: any = {};

      if (status && status !== 'All') filter.status = status;
      const dateRange = buildDateRange(presetDateRange, startDate, endDate);
      if (dateRange) filter.depositDate = dateRange;

      if (search) {
        filter.$or = [
          { agentId: { $regex: search, $options: 'i' } },
          { agentName: { $regex: search, $options: 'i' } },
          { liabilityId: { $regex: search, $options: 'i' } },
          { agentPhone: { $regex: search, $options: 'i' } }
        ];
      }

      const pageNum = Math.max(1, Number(page) || 1);
      const limitNum = Math.min(100, Math.max(1, Number(limit) || 50));
      const skip = (pageNum - 1) * limitNum;

      const [liabilities, total, allItems] = await Promise.all([
        AgentDepositLiability.find(filter).sort({ depositDate: -1 }).skip(skip).limit(limitNum),
        AgentDepositLiability.countDocuments(filter),
        AgentDepositLiability.find().select('depositAmount currentOutstandingBalance status').lean()
      ]);

      const totalDeposits = allItems.reduce((sum, l) => sum + l.depositAmount, 0);
      const totalOutstanding = allItems.reduce((sum, l) => sum + l.currentOutstandingBalance, 0);

      return res.json({
        success: true,
        count: liabilities.length,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.max(1, Math.ceil(total / limitNum)),
        summary: {
          totalDepositsHeld: totalDeposits,
          outstandingLiability: totalOutstanding,
          classification: 'Liability (Balance Sheet - Non Revenue)',
          totalCount: allItems.length,
          pendingCount: allItems.filter((l) => l.status === 'HELD').length,
          inProgressCount: allItems.filter((l) => l.status === 'PARTIALLY_REFUNDED').length,
          completedCount: allItems.filter((l) => ['REFUNDED', 'ADJUSTED'].includes(l.status)).length
        },
        data: liabilities
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Record a new Agent Initial Deposit Liability
   */
  static async recordAgentDeposit(req: Request, res: Response): Promise<any> {
    try {
      const currentUser = req.user!;
      const {
        agentId,
        agentName,
        agentPhone,
        agentEmail,
        depositAmount,
        paymentMethod,
        gatewayReference,
        notes
      } = req.body;

      if (!agentId || !agentName || !depositAmount) {
        return res.status(400).json({
          success: false,
          message: 'Agent ID, Agent Name, and Deposit Amount are required.'
        });
      }

      const liabilityId = generateId('LIAB-DEP');
      const transactionId = generateId('TXN-DEP');

      const liability = new AgentDepositLiability({
        liabilityId,
        agentId,
        agentName,
        agentPhone: agentPhone || '',
        agentEmail: agentEmail || '',
        originalTransactionId: transactionId,
        depositAmount: Number(depositAmount),
        currentOutstandingBalance: Number(depositAmount),
        status: 'HELD',
        paymentMethod: paymentMethod || 'Bank Transfer',
        gatewayReference: gatewayReference || '',
        depositDate: new Date(),
        notes: notes || 'Agent Initial Deposit held as liability.',
        movements: [
          {
            movementId: generateId('MOV'),
            type: 'DEPOSIT_RECEIVED',
            amount: Number(depositAmount),
            balanceAfter: Number(depositAmount),
            reason: 'Initial security deposit received upon agent onboarding.',
            referenceId: transactionId,
            processedByUserId: currentUser.employeeId,
            processedByName: currentUser.name,
            processedAt: new Date()
          }
        ]
      });

      await liability.save();

      // Create linked payment transaction record classified as LIABILITY (NOT INCOME!)
      await PaymentTransaction.create({
        transactionId,
        referenceId: liabilityId,
        transactionType: 'Agent Initial Deposit',
        financialClassification: FinancialClassification.LIABILITY,
        fromParty: { id: agentId, name: agentName, type: 'Agent' },
        toParty: { id: 'CONNECT_ESCROW', name: 'Connect App Deposit Liability Account', type: 'Escrow' },
        amount: Number(depositAmount),
        grossAmount: Number(depositAmount),
        tax: 0,
        discount: 0,
        commission: 0,
        deductions: 0,
        finalAmount: Number(depositAmount),
        paymentMethod: paymentMethod || 'Bank Transfer',
        gatewayReference: gatewayReference || '',
        status: 'COMPLETED',
        handledByEmployeeId: currentUser.employeeId,
        handledByEmployeeName: currentUser.name,
        department: 'Payment Team',
        transactionDate: new Date(),
        notes: 'Security deposit held on balance sheet as refundable liability.'
      });

      await logAudit(
        req,
        'AGENT_DEPOSIT_RECORDED',
        'PAYMENT',
        liabilityId,
        `Recorded ₹${depositAmount} initial deposit for Agent ${agentName} (${agentId}) as LIABILITY.`
      );

      return res.status(201).json({
        success: true,
        message: 'Agent initial deposit recorded as a Liability.',
        data: liability
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Process refund or adjustment against Agent Deposit Liability
   */
  static async adjustAgentDeposit(req: Request, res: Response): Promise<any> {
    try {
      const currentUser = req.user!;
      const { id } = req.params;
      const { adjustmentType, amount, reason } = req.body;

      const liability = await AgentDepositLiability.findOne(buildIdFilter('liabilityId', id));

      if (!liability) {
        return res.status(404).json({ success: false, message: 'Agent Deposit Liability not found.' });
      }

      const adjAmount = Number(amount);
      if (adjAmount <= 0 || adjAmount > liability.currentOutstandingBalance) {
        return res.status(400).json({
          success: false,
          message: `Invalid adjustment amount. Maximum available balance is ₹${liability.currentOutstandingBalance}.`
        });
      }

      const balanceAfter = liability.currentOutstandingBalance - adjAmount;
      liability.currentOutstandingBalance = balanceAfter;
      if (balanceAfter === 0) {
        liability.status = adjustmentType === 'REFUND' ? 'REFUNDED' : 'ADJUSTED';
      } else {
        liability.status = 'PARTIALLY_REFUNDED';
      }

      const movementId = generateId('MOV');
      const refundRefId = generateId('TXN-REF');

      liability.movements.push({
        movementId,
        type: adjustmentType === 'REFUND' ? 'REFUND_PROCESSED' : 'ADJUSTMENT',
        amount: adjAmount,
        balanceAfter,
        reason: reason || 'Deposit refund/adjustment processed.',
        referenceId: refundRefId,
        processedByUserId: currentUser.employeeId,
        processedByName: currentUser.name,
        processedAt: new Date()
      });

      await liability.save();

      // Create linked transaction record for the liability reduction
      await PaymentTransaction.create({
        transactionId: refundRefId,
        referenceId: liability.liabilityId,
        transactionType: 'Agent Deposit Refund',
        financialClassification: FinancialClassification.LIABILITY,
        fromParty: { id: 'CONNECT_ESCROW', name: 'Connect App Deposit Liability Account', type: 'Escrow' },
        toParty: { id: liability.agentId, name: liability.agentName, type: 'Agent' },
        amount: adjAmount,
        grossAmount: adjAmount,
        finalAmount: adjAmount,
        paymentMethod: 'Bank Transfer',
        status: 'COMPLETED',
        handledByEmployeeId: currentUser.employeeId,
        handledByEmployeeName: currentUser.name,
        department: 'Payment Team',
        transactionDate: new Date(),
        notes: `Liability settlement: ${reason || 'Deposit refund'}`
      });

      await logAudit(
        req,
        'AGENT_DEPOSIT_ADJUSTED',
        'PAYMENT',
        liability.liabilityId,
        `Processed ₹${adjAmount} ${adjustmentType} for Agent ${liability.agentName}. Remaining liability: ₹${balanceAfter}.`
      );

      return res.json({
        success: true,
        message: 'Deposit liability adjusted successfully.',
        data: liability
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Enter payment amount and generate a secure payment link for an approved Vendor or Agent application
   */
  static async generatePaymentLink(req: Request, res: Response): Promise<any> {
    try {
      const {
        applicantId,
        applicantName,
        applicantType,
        email,
        phone,
        amount,
        purpose,
        businessName,
        expiryDays = 7
      } = req.body;
      const currentUser = req.user!;

      const isVendor = String(applicantType).toUpperCase().includes('VENDOR');
      const isAgent = String(applicantType).toUpperCase().includes('AGENT');

      if (!isVendor && !isAgent) {
        return res.status(400).json({
          success: false,
          message: 'Payment links can only be issued for Vendor (Subscription) or Agent (Refundable Deposit) applications.'
        });
      }

      const linkId = generateId('PAY-LNK');
      const clientUrl = process.env.CLIENT_URL || 'http://localhost:5175';
      const paymentUrl = `${clientUrl}/pay/${linkId}?applicantId=${encodeURIComponent(applicantId)}&token=${Buffer.from(linkId).toString('base64')}`;

      // Create linked pending transaction record in PaymentTransaction
      const transactionId = generateId('TXN-LNK');
      const numAmount = Number(amount);
      const classification = isAgent ? FinancialClassification.LIABILITY : FinancialClassification.INCOME;

      const transaction = await PaymentTransaction.create({
        transactionId,
        referenceId: linkId,
        transactionType: isAgent ? 'Agent Initial Deposit Payment Link' : 'Vendor Subscription Payment Link',
        financialClassification: classification,
        fromParty: {
          id: applicantId,
          name: applicantName,
          type: isAgent ? 'Agent' : 'Vendor'
        },
        toParty: {
          id: 'CONNECT_SYSTEM',
          name: 'Connect App Centralized Platform',
          type: 'Platform'
        },
        amount: numAmount,
        grossAmount: numAmount,
        finalAmount: numAmount,
        paymentMethod: 'Online Payment Link',
        status: 'PENDING',
        handledByEmployeeId: currentUser.employeeId,
        handledByEmployeeName: currentUser.name,
        department: 'Payment Team',
        transactionDate: new Date(),
        notes: `Payment link ${linkId} generated for ${purpose}. Expiry: ${expiryDays} days.`
      });

      await logAudit(
        req,
        'PAYMENT_LINK_GENERATED',
        'PAYMENT',
        linkId,
        `Payment Team member ${currentUser.name} issued payment link ${linkId} of ₹${numAmount} for ${applicantName} (${applicantId}).`
      );

      return res.status(201).json({
        success: true,
        message: 'Payment link generated successfully.',
        data: {
          linkId,
          transactionId,
          applicantId,
          applicantName,
          applicantType,
          email,
          phone,
          amount: numAmount,
          purpose,
          paymentUrl,
          expiryDays,
          status: 'PENDING',
          createdAt: new Date().toISOString()
        }
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Dispatch payment link email to the applicant's registered email
   */
  static async sendPaymentEmail(req: Request, res: Response): Promise<any> {
    try {
      const {
        linkId,
        recipientEmail,
        applicantName,
        applicantType,
        businessName,
        amount,
        purpose,
        paymentUrl,
        customNote
      } = req.body;
      const currentUser = req.user!;

      const { EmailService } = await import('../services/emailService');
      const emailResult = await EmailService.sendPaymentLinkEmail({
        recipientEmail,
        applicantName: applicantName || 'Applicant',
        applicantType: applicantType || 'Onboarding',
        businessName,
        amount: Number(amount),
        paymentUrl: paymentUrl || `${process.env.CLIENT_URL || 'http://localhost:5175'}/pay/${linkId}`,
        linkId,
        purpose: purpose || 'Onboarding Completion',
        customNote
      });

      await logAudit(
        req,
        'PAYMENT_EMAIL_SENT',
        'PAYMENT',
        linkId,
        `Payment email for link ${linkId} dispatched to ${recipientEmail} by ${currentUser.name}. Result: ${emailResult.message}`
      );

      return res.json({
        success: true,
        message: emailResult.message,
        data: emailResult
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Verify completed payment and activate Vendor / Agent account
   */
  static async verifyPaymentAndActivate(req: Request, res: Response): Promise<any> {
    try {
      const { linkId, gatewayPaymentId, paymentMethod = 'Online Gateway' } = req.body;
      const currentUser = req.user!;

      const transaction = await PaymentTransaction.findOne({ referenceId: linkId });
      if (!transaction) {
        return res.status(404).json({ success: false, message: 'Payment link reference not found.' });
      }

      // Update transaction to COMPLETED
      transaction.status = 'COMPLETED';
      transaction.gatewayReference = gatewayPaymentId || `GATEWAY-${Date.now()}`;
      transaction.paymentMethod = paymentMethod;
      transaction.notes = `Payment verified via gateway on ${new Date().toISOString()} by ${currentUser.name}.`;
      await transaction.save();

      const applicantId = transaction.fromParty.id;
      const applicantType = transaction.fromParty.type;
      const db = mongoose.connection.db;

      let activationDetails = { activated: false, collection: '', recordId: applicantId };

      if (db) {
        if (applicantType === 'Vendor') {
          const vQueries: any[] = [{ registrationId: applicantId }, { id: applicantId }];
          if (mongoose.Types.ObjectId.isValid(applicantId)) {
            vQueries.unshift({ _id: new mongoose.Types.ObjectId(applicantId) });
          }

          const vRes = await db.collection('vendors').updateOne(
            { $or: vQueries },
            {
              $set: {
                status: 'Active',
                isApproved: true,
                kycStatus: 'Verified',
                paymentStatus: 'Completed',
                subscriptionPaid: true,
                activatedAt: new Date(),
                updatedAt: new Date()
              },
              $push: {
                reviewHistory: {
                  action: 'PAYMENT_VERIFIED_ACTIVATED',
                  status: 'Active',
                  reviewedBy: currentUser.name,
                  reviewedById: currentUser.employeeId,
                  reviewerRole: currentUser.role,
                  timestamp: new Date(),
                  remarks: `Payment link ${linkId} verified (₹${transaction.finalAmount}). Dashboard access activated.`
                }
              } as any
            }
          );
          activationDetails = { activated: vRes.matchedCount > 0, collection: 'vendors', recordId: applicantId };
        } else if (applicantType === 'Agent') {
          const aQueries: any[] = [{ registrationId: applicantId }, { id: applicantId }];
          if (mongoose.Types.ObjectId.isValid(applicantId)) {
            aQueries.unshift({ _id: new mongoose.Types.ObjectId(applicantId) });
          }

          const aRes = await db.collection('agents').updateOne(
            { $or: aQueries },
            {
              $set: {
                status: 'Active',
                isApproved: true,
                kycStatus: 'Verified',
                registrationFeePaid: true,
                adminApprovalStatus: 'approved',
                activatedAt: new Date(),
                updatedAt: new Date()
              },
              $push: {
                reviewHistory: {
                  action: 'DEPOSIT_VERIFIED_ACTIVATED',
                  status: 'Active',
                  reviewerName: currentUser.name,
                  reviewerId: currentUser.employeeId,
                  reviewerRole: currentUser.role,
                  reviewedAt: new Date(),
                  timestamp: new Date(),
                  remarks: `Refundable deposit link ${linkId} verified (₹${transaction.finalAmount}). Agent dashboard activated.`
                }
              } as any
            }
          );

          // Also record Agent Deposit Liability
          const liabilityId = generateId('LIA-AGT');
          await AgentDepositLiability.create({
            liabilityId,
            agentId: applicantId,
            agentName: transaction.fromParty.name,
            agentEmail: '',
            depositAmount: transaction.finalAmount,
            currentOutstandingBalance: transaction.finalAmount,
            status: 'HELD',
            paymentMethod,
            gatewayReference: gatewayPaymentId || `GATEWAY-${Date.now()}`,
            receivedDate: new Date(),
            notes: `Auto-recorded liability from verified payment link ${linkId}.`
          });

          activationDetails = { activated: aRes.matchedCount > 0, collection: 'agents', recordId: applicantId };
        }
      }

      await logAudit(
        req,
        'PAYMENT_VERIFIED_ACTIVATED',
        'PAYMENT',
        linkId,
        `Payment verified for ${transaction.fromParty.name} (${applicantId}). Role: ${applicantType}. Account activated in database.`
      );

      return res.json({
        success: true,
        message: `Payment confirmed. ${applicantType} account successfully activated with full dashboard access.`,
        data: {
          transaction,
          activationDetails
        }
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}

