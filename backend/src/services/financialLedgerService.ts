import { PaymentTransaction } from '../models/PaymentTransaction';
import { AgentDepositLiability } from '../models/AgentDepositLiability';
import { FinancialApproval } from '../models/FinancialApproval';
import { SalaryRecord } from '../models/SalaryRecord';
import { ApprovalStatus, FinancialClassification, SalaryStatus } from '../config/constants';

export class FinancialLedgerService {
  /**
   * Aggregate actual database financial figures with strict separation of income, outgoing, and liabilities.
   */
  static async getFinancialMetrics() {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfToday.getDate() - 7);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const amt = (t: any) => Number(t.finalAmount ?? t.amount ?? 0);
    const inRange = (d: any, since: Date) => d && new Date(d) >= since;

    // 1. Recognized Income Breakdown (COMPLETED + INCOME only; Agent Initial Deposits have classification=Liability)
    const incomeTransactions = await PaymentTransaction.find({
      financialClassification: FinancialClassification.INCOME,
      status: 'COMPLETED',
      transactionType: { $ne: 'Agent Initial Deposit' }
    }).lean();

    const customerOrderPayments = incomeTransactions
      .filter((t) => t.transactionType.toLowerCase().includes('order'))
      .reduce((sum, t) => sum + amt(t), 0);

    const customerBookingPayments = incomeTransactions
      .filter((t) => t.transactionType.toLowerCase().includes('booking'))
      .reduce((sum, t) => sum + amt(t), 0);

    const membershipRevenue = incomeTransactions
      .filter((t) => t.transactionType.toLowerCase().includes('membership'))
      .reduce((sum, t) => sum + amt(t), 0);

    const vendorSubscriptionIncome = incomeTransactions
      .filter(
        (t) =>
          t.transactionType.toLowerCase().includes('subscription') ||
          t.fromParty?.type === 'Vendor'
      )
      .reduce((sum, t) => sum + amt(t), 0);

    const agentRecognizedIncome = incomeTransactions
      .filter(
        (t) =>
          (t.fromParty?.type === 'Agent' || /agent/i.test(t.transactionType)) &&
          t.transactionType !== 'Agent Initial Deposit'
      )
      .reduce((sum, t) => sum + amt(t), 0);

    const customerPayments = customerOrderPayments + customerBookingPayments;
    const totalRecognizedIncome =
      customerPayments + vendorSubscriptionIncome + agentRecognizedIncome + membershipRevenue;

    const todayIncome = incomeTransactions
      .filter((t) => inRange(t.transactionDate, startOfToday))
      .reduce((sum, t) => sum + amt(t), 0);
    const weekIncome = incomeTransactions
      .filter((t) => inRange(t.transactionDate, startOfWeek))
      .reduce((sum, t) => sum + amt(t), 0);
    const monthIncome = incomeTransactions
      .filter((t) => inRange(t.transactionDate, startOfMonth))
      .reduce((sum, t) => sum + amt(t), 0);

    // 2. Qualifying External Expenses Breakdown (STRICTLY EXCLUDES Salary Payment & Agent Deposit Refund)
    const outgoingAll = await PaymentTransaction.find({
      financialClassification: FinancialClassification.OUTGOING,
      transactionType: { $nin: ['Salary Payment', 'Agent Deposit Refund'] }
    }).lean();

    const outgoingTransactions = outgoingAll.filter((t) => t.status === 'COMPLETED');
    const pendingExpenseTxns = outgoingAll.filter((t) => ['PENDING', 'PROCESSING', 'ON_HOLD'].includes(t.status));
    const failedExpenseTxns = outgoingAll.filter((t) => t.status === 'FAILED');

    const orderSettlements = outgoingTransactions
      .filter((t) => t.transactionType.toLowerCase().includes('order') && t.transactionType.toLowerCase().includes('settlement'))
      .reduce((sum, t) => sum + amt(t), 0);

    const bookingSettlements = outgoingTransactions
      .filter((t) => t.transactionType.toLowerCase().includes('booking') && t.transactionType.toLowerCase().includes('settlement'))
      .reduce((sum, t) => sum + amt(t), 0);

    const vendorSettlements = outgoingTransactions
      .filter((t) => t.toParty?.type === 'Vendor' || t.transactionType.toLowerCase().includes('settlement'))
      .reduce((sum, t) => sum + amt(t), 0);

    const agentTieupPayouts = outgoingTransactions
      .filter((t) => t.toParty?.type === 'Agent' || /agent/i.test(t.transactionType))
      .reduce((sum, t) => sum + amt(t), 0);

    const deliveryPartnerPayouts = outgoingTransactions
      .filter((t) => t.toParty?.type === 'Delivery Partner' || t.transactionType.toLowerCase().includes('delivery'))
      .reduce((sum, t) => sum + amt(t), 0);

    const technicianPayouts = outgoingTransactions
      .filter((t) => t.toParty?.type === 'Technician' || t.transactionType.toLowerCase().includes('technician'))
      .reduce((sum, t) => sum + amt(t), 0);

    // Expenses total strictly excludes Salaries (Section 31 C & E)
    const totalExpenses = vendorSettlements + agentTieupPayouts + deliveryPartnerPayouts + technicianPayouts;
    const todayExpenses = outgoingTransactions
      .filter((t) => inRange(t.transactionDate, startOfToday))
      .reduce((sum, t) => sum + amt(t), 0);
    const weekExpenses = outgoingTransactions
      .filter((t) => inRange(t.transactionDate, startOfWeek))
      .reduce((sum, t) => sum + amt(t), 0);
    const monthExpenses = outgoingTransactions
      .filter((t) => inRange(t.transactionDate, startOfMonth))
      .reduce((sum, t) => sum + amt(t), 0);

    const pendingExpensesAmount = pendingExpenseTxns.reduce((sum, t) => sum + amt(t), 0);
    const failedExpensesAmount = failedExpenseTxns.reduce((sum, t) => sum + amt(t), 0);

    // 2B. Separate Salary Metrics (from SalaryRecord - NOT included in Expenses)
    const allSalaryRecords = await SalaryRecord.find().select('status netSalary').lean();
    const paidSalariesRecords = allSalaryRecords.filter((s) => s.status === SalaryStatus.PAID);
    const pendingSalariesRecords = allSalaryRecords.filter((s) =>
      [SalaryStatus.DRAFT, SalaryStatus.PREPARED, SalaryStatus.SUBMITTED_FOR_OVERALL_APPROVAL].includes(
        s.status as SalaryStatus
      )
    );
    const approvedSalariesRecords = allSalaryRecords.filter((s) =>
      [SalaryStatus.APPROVED, SalaryStatus.PROCESSING].includes(s.status as SalaryStatus)
    );
    const failedSalariesRecords = allSalaryRecords.filter((s) => s.status === SalaryStatus.FAILED);

    const totalSalariesPaid = paidSalariesRecords.reduce((sum, s) => sum + (s.netSalary || 0), 0);
    const totalSalariesPending = pendingSalariesRecords.reduce((sum, s) => sum + (s.netSalary || 0), 0);
    const totalSalariesApproved = approvedSalariesRecords.reduce((sum, s) => sum + (s.netSalary || 0), 0);
    const totalSalariesFailed = failedSalariesRecords.reduce((sum, s) => sum + (s.netSalary || 0), 0);

    // Legacy organization-wide Outgoing (used by Overall Dashboard)
    const totalOutgoing = totalExpenses + totalSalariesPaid;

    // 3. Agent Deposit Liability (STRICT LIABILITY CLASSIFICATION - NEVER INCLUDED IN RECOGNIZED INCOME)
    const depositLiabilities = await AgentDepositLiability.find().lean();
    const totalAgentDepositsHeld = depositLiabilities.reduce((sum, d) => sum + (d.depositAmount || 0), 0);
    const outstandingAgentDepositLiability = depositLiabilities.reduce((sum, d) => sum + (d.currentOutstandingBalance || 0), 0);
    const refundedAgentDeposits = depositLiabilities.reduce(
      (sum, d) =>
        sum +
        (d.movements || [])
          .filter((m) => m.type === 'REFUND_PROCESSED' || m.type === 'ADJUSTMENT')
          .reduce((mSum, m) => mSum + (m.amount || 0), 0),
      0
    );

    // 4. Pending Maker-Checker Approvals & Transaction status summary
    const [
      pendingApprovals,
      pendingTransactionsCount,
      failedTransactionsCount,
      refundedTxns,
      completedTransactionsCount,
      totalTransactionsCount
    ] = await Promise.all([
      FinancialApproval.find({
        status: { $in: [ApprovalStatus.SUBMITTED, ApprovalStatus.PENDING_CHECKER] }
      }).lean(),
      PaymentTransaction.countDocuments({ status: 'PENDING' }),
      PaymentTransaction.countDocuments({ status: 'FAILED' }),
      PaymentTransaction.find({ status: 'REFUNDED' }).select('finalAmount amount').lean(),
      PaymentTransaction.countDocuments({ status: 'COMPLETED' }),
      PaymentTransaction.countDocuments()
    ]);

    const pendingApprovalsCount = pendingApprovals.length;
    const pendingApprovalsValue = pendingApprovals.reduce((sum, a) => sum + (a.amount || 0), 0);
    const refundedTransactionsCount = refundedTxns.length;
    const refundedTransactionsAmount = refundedTxns.reduce((sum, t) => sum + amt(t), 0);

    // Net Operating Movement = Recognized Income - Qualifying Expenses (NOT accounting profit)
    const netOperatingMovement = totalRecognizedIncome - totalExpenses;
    const netFinancialMovement = totalRecognizedIncome - totalOutgoing;

    return {
      totalRecognizedIncome,
      totalExpenses,
      totalOutgoing,
      netOperatingMovement,
      netFinancialMovement,
      incomeBreakdown: {
        customerPayments,
        customerOrderPayments,
        customerBookingPayments,
        vendorSubscriptionIncome,
        agentRecognizedIncome,
        membershipRevenue
      },
      incomeDashboard: {
        totalIncome: totalRecognizedIncome,
        customerPayments,
        vendorSubscriptionIncome,
        agentRecognizedIncome,
        membershipIncome: membershipRevenue,
        todayIncome,
        weekIncome,
        monthIncome
      },
      outgoingBreakdown: {
        vendorSettlements,
        orderSettlements,
        bookingSettlements,
        agentTieupPayouts,
        deliveryPartnerPayouts,
        technicianPayouts,
        totalSalariesPaid
      },
      expensesDashboard: {
        totalExpenses,
        vendorPayments: vendorSettlements,
        agentPayouts: agentTieupPayouts,
        deliveryPartnerPayments: deliveryPartnerPayouts,
        technicianPayments: technicianPayouts,
        todayExpenses,
        weekExpenses,
        monthExpenses,
        pendingExpensesAmount,
        pendingExpensesCount: pendingExpenseTxns.length,
        failedExpensesAmount,
        failedExpensesCount: failedExpenseTxns.length
      },
      salaryMetrics: {
        totalSalariesPaid,
        paidCount: paidSalariesRecords.length,
        totalSalariesPending,
        pendingCount: pendingSalariesRecords.length,
        totalSalariesApproved,
        approvedCount: approvedSalariesRecords.length,
        totalSalariesFailed,
        failedCount: failedSalariesRecords.length
      },
      liabilities: {
        totalAgentDepositsHeld,
        outstandingAgentDepositLiability,
        refundedAgentDeposits,
        classificationNote: 'Agent initial deposits are legally held liabilities and strictly excluded from revenue.'
      },
      statusSummary: {
        pendingCount: pendingTransactionsCount,
        failedCount: failedTransactionsCount,
        refundedCount: refundedTransactionsCount,
        refundedAmount: refundedTransactionsAmount,
        completedCount: completedTransactionsCount,
        totalCount: totalTransactionsCount,
        pendingApprovalsCount,
        pendingApprovalsValue
      }
    };
  }
}

