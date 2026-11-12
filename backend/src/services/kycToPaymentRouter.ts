import { KycRequest } from '../models/KycRequest';
import { TaskItem } from '../models/TaskItem';
import { ApplicantType, Department, TaskStatus } from '../config/constants';
import { generateId } from '../utils/security';
import { NotificationItem } from '../models/NotificationItem';

export class KycToPaymentRouter {
  /**
   * Evaluates approved KYC requests:
   * If Vendor or Agent: Automatically creates a Payment Team task and routes case for registration/deposit processing.
   * If others: Directly activates account without unnecessary payment stage routing.
   */
  static async handleKycApprovalRouting(
    kycRequest: any,
    verifyingUser: { id: string; name: string; role: string }
  ) {
    const isVendorOrAgent =
      kycRequest.applicantType === ApplicantType.VENDOR ||
      kycRequest.applicantType === ApplicantType.AGENT;

    if (isVendorOrAgent) {
      const paymentTaskId = generateId('PAY-TSK');
      const isAgent = kycRequest.applicantType === ApplicantType.AGENT;

      const taskTitle = isAgent
        ? `Agent Deposit Verification & Onboarding: ${kycRequest.applicantName} (${kycRequest.applicantId})`
        : `Vendor Subscription & Registration Settlement: ${kycRequest.applicantName} (${kycRequest.applicantId})`;

      const taskDescription = `KYC verified and approved by ${verifyingUser.name} on ${new Date().toISOString()}.
Applicant ID: ${kycRequest.applicantId}
KYC Request ID: ${kycRequest.requestId}
Action Required: Verify ${isAgent ? 'Agent Initial Deposit (Liability balance entry)' : 'Vendor Subscription Payment'} prior to full platform activation.`;

      const paymentTask = await TaskItem.create({
        taskId: paymentTaskId,
        title: taskTitle,
        description: taskDescription,
        department: Department.PAYMENT,
        assignedTo: {
          employeeId: 'UNASSIGNED_PAYMENT_QUEUE',
          name: 'Payment Team Queue',
          role: 'payment_lead'
        },
        assignedBy: {
          employeeId: verifyingUser.id,
          name: verifyingUser.name,
          role: verifyingUser.role
        },
        priority: 'High',
        status: TaskStatus.ASSIGNED,
        dueDate: new Date(Date.now() + 48 * 60 * 60 * 1000) // 48 hours SLA
      });

      kycRequest.routedToPayment = true;
      kycRequest.paymentTaskId = paymentTaskId;
      await kycRequest.save();

      // Trigger notification to Payment Team
      await NotificationItem.create({
        notificationId: generateId('NOTIF'),
        targetDepartment: Department.PAYMENT,
        title: `New Payment Task: ${kycRequest.applicantType} KYC Approved`,
        message: `${kycRequest.applicantName} (${kycRequest.applicantId}) has passed KYC verification and requires payment verification.`,
        type: 'PAYMENT',
        actionUrl: `/payment/tasks`
      });

      return {
        routed: true,
        paymentTaskId,
        message: `${kycRequest.applicantType} KYC Approved. Task successfully created and routed to Payment Team queue.`
      };
    }

    // Direct Approval for other 8 applicant types
    kycRequest.routedToPayment = false;
    await kycRequest.save();

    return {
      routed: false,
      message: `${kycRequest.applicantType} KYC directly approved. Onboarding completed without vendor/agent payment gating.`
    };
  }
}

