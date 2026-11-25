import mongoose from 'mongoose';
import { Employee } from '../models/Employee';
import { KycRequest } from '../models/KycRequest';
import { NotificationItem } from '../models/NotificationItem';
import { ApplicantType, Role, KycStatus, Department } from '../config/constants';
import { generateId } from '../utils/security';

export class KycAssignmentService {
  private static async notifyAndSyncAssignment(
    request: any,
    employee: { employeeId: string; name: string },
    isReassignment: boolean
  ): Promise<void> {
    try {
      const actionUrl =
        request.applicantType === ApplicantType.DELIVERY_PARTNER
          ? '/kyc/delivery-partner'
          : request.applicantType === ApplicantType.TECHNICIAN
            ? '/kyc/technician'
            : '/kyc';

      const title = isReassignment
        ? `KYC Application Reassigned: ${request.requestId}`
        : `KYC Application Assigned: ${request.requestId}`;

      const existingNotif = await NotificationItem.findOne({
        targetEmployeeId: employee.employeeId,
        title,
        isRead: false
      });

      if (!existingNotif) {
        await NotificationItem.create({
          notificationId: generateId('NOTIF'),
          targetRole: Role.KYC_EMPLOYEE,
          targetEmployeeId: employee.employeeId,
          targetDepartment: Department.KYC,
          title,
          message: `${request.applicantType} KYC for ${request.applicantName} (${request.applicantId}) has been assigned to you.`,
          type: 'KYC',
          actionUrl
        });
      }

      if (
        request.applicantType === ApplicantType.DELIVERY_PARTNER ||
        request.applicantType === ApplicantType.TECHNICIAN
      ) {
        const db = mongoose.connection.db;
        if (db) {
          const applicantId = String(request.applicantId || '');
          const partnerQuery: any = {
            $or: [
              { id: applicantId },
              ...(mongoose.Types.ObjectId.isValid(applicantId) ? [{ _id: new mongoose.Types.ObjectId(applicantId) }] : []),
              ...(request.phone ? [{ mobile: request.phone }] : [])
            ]
          };
          const nowIso = new Date().toISOString();
          await db.collection('delivery_partners').updateOne(
            { ...partnerQuery, kyc_status: { $in: [null, '', 'pending', 'assigned'] } },
            {
              $set: {
                kyc_status: 'assigned',
                kyc_assigned_to: employee.name,
                kyc_request_id: request.requestId,
                updated_at: nowIso
              }
            }
          );
          await db.collection('delivery_partners').updateOne(
            partnerQuery,
            { $set: { kyc_assigned_to: employee.name } }
          );

          await db.collection('notifications').insertOne({
            id: `notif_kyc_assign_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            partner_id: applicantId,
            partnerId: applicantId,
            title: 'KYC Review Assigned',
            body: `Your ${request.applicantType} KYC request (${request.requestId}) is now assigned to ${employee.name} for verification.`,
            category: 'kyc',
            reference_id: request.requestId,
            read: false,
            created_at: nowIso
          });
        }
      }
    } catch (e: any) {
      console.warn('[KYC Assignment Notification Warning]:', e.message);
    }
  }
  /**
   * Distribute unassigned KYC requests automatically based on least active load.
   */
  static async autoAssignRequest(requestId: string): Promise<any> {
    const request = await KycRequest.findOne({ requestId });
    if (!request) throw new Error('KYC request not found');

    // Fetch active KYC employees
    const activeKycStaff = await Employee.find({
      department: Department.KYC,
      role: Role.KYC_EMPLOYEE,
      status: 'active'
    });

    if (activeKycStaff.length === 0) {
      console.warn('[KYC Assignment]: No active KYC staff available for auto-assignment.');
      return request;
    }

    // Calculate current active workload for each employee
    const staffLoads = await Promise.all(
      activeKycStaff.map(async (emp) => {
        const count = await KycRequest.countDocuments({
          assignedEmployeeId: emp.employeeId,
          status: { $in: [KycStatus.ASSIGNED, KycStatus.IN_PROGRESS] }
        });
        return { employee: emp, count };
      })
    );

    // Pick employee with minimum active cases
    staffLoads.sort((a, b) => a.count - b.count);
    const selected = staffLoads[0].employee;

    // Update KYC Request
    request.assignedEmployeeId = selected.employeeId;
    request.assignedEmployeeName = selected.name;
    request.status = KycStatus.ASSIGNED;
    request.lastUpdated = new Date();

    request.assignmentHistory.push({
      previousEmployeeId: null,
      previousEmployeeName: null,
      newEmployeeId: selected.employeeId,
      newEmployeeName: selected.name,
      assignedByUserId: 'SYSTEM',
      assignedByRole: 'SYSTEM_LOAD_BALANCER',
      reason: 'Automatic least-workload distribution',
      assignmentType: 'AUTOMATIC',
      timestamp: new Date()
    });

    request.approvalHistory = request.approvalHistory || [];
    request.approvalHistory.push({
      action: 'ASSIGNED',
      status: KycStatus.ASSIGNED,
      actorId: 'SYSTEM',
      actorName: 'SYSTEM_LOAD_BALANCER',
      actorRole: 'system',
      actorDepartment: 'System',
      timestamp: new Date(),
      remarks: `Automatically assigned to ${selected.name} (${selected.employeeId})`
    });

    await request.save();
    await KycAssignmentService.notifyAndSyncAssignment(request, selected, false);
    return request;
  }

  /**
   * Manual Team Lead Assignment or Reassignment
   */
  static async assignOrReassign(
    requestId: string,
    newEmployeeId: string,
    assignedByUser: { id: string; name: string; role: string },
    reason: string
  ): Promise<any> {
    const request = await KycRequest.findOne({ requestId });
    if (!request) throw new Error('KYC request not found');

    const targetEmployee = await Employee.findOne({ employeeId: newEmployeeId, status: 'active' });
    if (!targetEmployee) throw new Error('Target employee not found or not active');

    const prevId = request.assignedEmployeeId;
    const prevName = request.assignedEmployeeName;
    const isReassignment = Boolean(prevId && prevId !== newEmployeeId);

    request.assignedEmployeeId = targetEmployee.employeeId;
    request.assignedEmployeeName = targetEmployee.name;
    request.status = KycStatus.ASSIGNED;
    request.lastUpdated = new Date();

    request.assignmentHistory.push({
      previousEmployeeId: prevId || null,
      previousEmployeeName: prevName || null,
      newEmployeeId: targetEmployee.employeeId,
      newEmployeeName: targetEmployee.name,
      assignedByUserId: assignedByUser.id,
      assignedByRole: assignedByUser.role,
      reason: reason || (isReassignment ? 'Team Lead operational reassignment' : 'Team Lead initial manual assignment'),
      assignmentType: isReassignment ? 'REASSIGNMENT' : 'MANUAL',
      timestamp: new Date()
    });

    request.approvalHistory = request.approvalHistory || [];
    request.approvalHistory.push({
      action: isReassignment ? 'REASSIGNED' : 'ASSIGNED',
      status: KycStatus.ASSIGNED,
      actorId: assignedByUser.id,
      actorName: assignedByUser.name,
      actorRole: assignedByUser.role,
      actorDepartment: 'KYC Team',
      timestamp: new Date(),
      remarks: `Assigned to ${targetEmployee.name} (${targetEmployee.employeeId}). ${reason || ''}`
    });

    await request.save();
    await KycAssignmentService.notifyAndSyncAssignment(request, targetEmployee, isReassignment);
    return request;
  }
}

