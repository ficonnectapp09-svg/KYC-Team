import { Request, Response } from 'express';
import { KycRequest } from '../models/KycRequest';
import { Employee } from '../models/Employee';
import { NotificationItem } from '../models/NotificationItem';
import { Department, KycStatus, Role } from '../config/constants';
import { KYC_CATEGORIES, resolveKycCategory } from '../config/categoryCatalog';
import { KycAssignmentService } from '../services/kycAssignmentService';
import { KycToPaymentRouter } from '../services/kycToPaymentRouter';
import { ConnectEcosystemReader } from '../services/connectEcosystemReader';
import { logAudit } from '../middleware/auditLogger';
import { buildIdFilter, generateId } from '../utils/security';

export class KycController {
  private static buildScopeFilter(currentUser: NonNullable<Request['user']>) {
    if (currentUser.role === Role.KYC_EMPLOYEE) {
      return {
        $or: [
          { assignedEmployeeId: currentUser.employeeId },
          { status: KycStatus.UNASSIGNED }
        ]
      };
    }
    return {};
  }

  static async getCategoryCounts(req: Request, res: Response): Promise<any> {
    try {
      const scopeFilter = KycController.buildScopeFilter(req.user!);
      const grouped = await KycRequest.aggregate([
        { $match: scopeFilter },
        { $group: { _id: '$applicantType', count: { $sum: 1 } } }
      ]);
      const byType = new Map<string, number>();
      let allTotal = 0;
      for (const row of grouped) {
        if (row._id) {
          byType.set(row._id, row.count);
        }
        allTotal += row.count;
      }

      const counts: Record<string, number> = { ALL: allTotal };
      for (const cat of KYC_CATEGORIES) {
        if (cat.key !== 'ALL' && cat.applicantType) {
          counts[cat.key] = byType.get(cat.applicantType) || 0;
        }
      }

      return res.json({ success: true, data: counts });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async listRequests(req: Request, res: Response): Promise<any> {
    try {
      const {
        category,
        applicantType,
        status,
        priority,
        assignedEmployeeId,
        search,
        startDate,
        endDate,
        minPendingHours,
        page = '1',
        limit = '50'
      } = req.query;
      const currentUser = req.user!;

      const rawCategory = (category as string) || (applicantType as string) || 'ALL';
      const resolvedCategory = resolveKycCategory(rawCategory);
      if (!resolvedCategory) {
        return res.status(400).json({
          success: false,
          message: `Unsupported KYC category filter: "${rawCategory}".`
        });
      }

      const scopeFilter = KycController.buildScopeFilter(currentUser);
      const filter: any = { ...scopeFilter };

      if (resolvedCategory.applicantType) {
        filter.applicantType = resolvedCategory.applicantType;
      }
      if (status && status !== 'All') filter.status = status;
      if (priority && priority !== 'All') filter.priority = priority;
      if (assignedEmployeeId && assignedEmployeeId !== 'All') {
        filter.assignedEmployeeId = assignedEmployeeId === 'UNASSIGNED' ? null : assignedEmployeeId;
      }

      if (startDate || endDate || minPendingHours) {
        filter.submissionDate = {};
        if (startDate) filter.submissionDate.$gte = new Date(startDate as string);
        if (endDate) {
          const endDt = new Date(endDate as string);
          endDt.setHours(23, 59, 59, 999);
          filter.submissionDate.$lte = endDt;
        }
        if (minPendingHours && Number(minPendingHours) > 0) {
          const cutoff = new Date(Date.now() - Number(minPendingHours) * 60 * 60 * 1000);
          filter.submissionDate.$lte = cutoff;
          if (!status || status === 'All') {
            filter.status = { $nin: [KycStatus.APPROVED, KycStatus.REJECTED] };
          }
        }
      }

      if (search) {
        filter.$and = filter.$and || [];
        filter.$and.push({
          $or: [
            { requestId: { $regex: search, $options: 'i' } },
            { applicantId: { $regex: search, $options: 'i' } },
            { applicantName: { $regex: search, $options: 'i' } },
            { phone: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } },
            { 'applicantDetails.businessName': { $regex: search, $options: 'i' } },
            { 'applicantDetails.state': { $regex: search, $options: 'i' } }
          ]
        });
      }

      const pageNum = Math.max(1, Number(page) || 1);
      const limitNum = Math.min(100, Math.max(1, Number(limit) || 50));
      const skip = (pageNum - 1) * limitNum;

      // Category-scoped summary counts before pagination & authorized category counts
      const categoryBaseFilter: any = { ...scopeFilter };
      if (resolvedCategory.applicantType) {
        categoryBaseFilter.applicantType = resolvedCategory.applicantType;
      }

      const [requests, total, categoryItems, allCountsAgg] = await Promise.all([
        KycRequest.find(filter).sort({ submissionDate: -1 }).skip(skip).limit(limitNum),
        KycRequest.countDocuments(filter),
        KycRequest.find(categoryBaseFilter).select('status').lean(),
        KycRequest.aggregate([
          { $match: scopeFilter },
          { $group: { _id: '$applicantType', count: { $sum: 1 } } }
        ])
      ]);

      const categoryCounts: Record<string, number> = { ALL: 0 };
      const countByType = new Map<string, number>();
      for (const row of allCountsAgg) {
        if (row._id) countByType.set(row._id, row.count);
        categoryCounts.ALL += row.count;
      }
      for (const cat of KYC_CATEGORIES) {
        if (cat.key !== 'ALL' && cat.applicantType) {
          categoryCounts[cat.key] = countByType.get(cat.applicantType) || 0;
        }
      }

      const summary = {
        totalCount: categoryItems.length,
        pendingCount: categoryItems.filter((r) =>
          [KycStatus.UNASSIGNED, KycStatus.RE_UPLOAD_REQUESTED].includes(r.status as KycStatus)
        ).length,
        inProgressCount: categoryItems.filter((r) =>
          [KycStatus.ASSIGNED, KycStatus.IN_PROGRESS].includes(r.status as KycStatus)
        ).length,
        completedCount: categoryItems.filter((r) => r.status === KycStatus.APPROVED).length,
        rejectedCount: categoryItems.filter((r) => r.status === KycStatus.REJECTED).length
      };

      return res.json({
        success: true,
        category: resolvedCategory,
        count: requests.length,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.max(1, Math.ceil(total / limitNum)),
        summary,
        categoryCounts,
        data: requests
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getRequestById(req: Request, res: Response): Promise<any> {
    try {
      const { id } = req.params;
      const currentUser = req.user!;
      const request = await KycRequest.findOne(buildIdFilter('requestId', id));

      if (!request) {
        return res.status(404).json({ success: false, message: 'KYC Request not found.' });
      }

      if (
        currentUser.role === Role.KYC_EMPLOYEE &&
        request.assignedEmployeeId &&
        request.assignedEmployeeId !== currentUser.employeeId &&
        request.status !== KycStatus.UNASSIGNED
      ) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: You can only view KYC requests assigned to you or in the unassigned queue.'
        });
      }

      return res.json({
        success: true,
        data: request
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Automatic Workload Distribution
   */
  static async triggerAutoAssign(req: Request, res: Response): Promise<any> {
    try {
      const { requestId } = req.body;
      const updated = await KycAssignmentService.autoAssignRequest(requestId);

      await logAudit(
        req,
        'KYC_AUTO_ASSIGNED',
        'KYC',
        requestId,
        `Auto-assigned to ${updated.assignedEmployeeName} (${updated.assignedEmployeeId}).`
      );

      return res.json({
        success: true,
        message: 'Request automatically distributed successfully.',
        data: updated
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Manual Assignment or Reassignment by KYC Team Lead
   */
  static async assignOrReassign(req: Request, res: Response): Promise<any> {
    try {
      const { requestId, newEmployeeId, reason } = req.body;
      const currentUser = req.user!;

      if (!requestId || !newEmployeeId) {
        return res.status(400).json({
          success: false,
          message: 'Both requestId and newEmployeeId are required.'
        });
      }

      const updated = await KycAssignmentService.assignOrReassign(
        requestId,
        newEmployeeId,
        { id: currentUser.employeeId, name: currentUser.name, role: currentUser.role },
        reason
      );

      await logAudit(
        req,
        'KYC_MANUAL_ASSIGNMENT',
        'KYC',
        requestId,
        `${currentUser.name} assigned request to ${updated.assignedEmployeeName}. Reason: ${reason || 'N/A'}`
      );

      return res.json({
        success: true,
        message: 'KYC assignment updated successfully.',
        data: updated
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * KYC Verification Action: Approve, Reject, Request Re-upload, or Escalate
   */
  static async verifyKycAction(req: Request, res: Response): Promise<any> {
    try {
      const { requestId, action, reason, remarks, documentType } = req.body;
      const currentUser = req.user!;

      const kycRequest = await KycRequest.findOne(buildIdFilter('requestId', requestId));
      if (!kycRequest) {
        return res.status(404).json({ success: false, message: 'KYC Request not found.' });
      }

      if (action === 'APPROVE') {
        kycRequest.status = KycStatus.APPROVED;
        kycRequest.verificationRemarks = remarks || 'All documents verified and approved.';
        kycRequest.reviewedBy = currentUser.name;
        kycRequest.reviewedAt = new Date();
        kycRequest.lastUpdated = new Date();

        // Mark all documents verified
        kycRequest.documents.forEach(doc => {
          doc.status = 'Verified';
          doc.verifiedBy = currentUser.name;
          doc.verifiedAt = new Date();
        });

        // Trigger Critical KYC-to-Payment Routing
        const routingResult = await KycToPaymentRouter.handleKycApprovalRouting(
          kycRequest,
          { id: currentUser.employeeId, name: currentUser.name, role: currentUser.role }
        );

        await logAudit(
          req,
          'KYC_APPROVED',
          'KYC',
          kycRequest.requestId,
          `KYC Approved by ${currentUser.name}. ${routingResult.message}`
        );

        return res.json({
          success: true,
          message: routingResult.message,
          data: kycRequest
        });
      }

      if (action === 'REJECT') {
        if (!reason || reason.trim().length === 0) {
          return res.status(400).json({
            success: false,
            message: 'Mandatory reason is required to reject a KYC request.'
          });
        }

        kycRequest.status = KycStatus.REJECTED;
        kycRequest.verificationRemarks = reason;
        kycRequest.reviewedBy = currentUser.name;
        kycRequest.reviewedAt = new Date();
        kycRequest.lastUpdated = new Date();

        await kycRequest.save();

        await logAudit(
          req,
          'KYC_REJECTED',
          'KYC',
          kycRequest.requestId,
          `KYC Rejected by ${currentUser.name}. Reason: ${reason}`
        );

        return res.json({
          success: true,
          message: 'KYC request marked as Rejected.',
          data: kycRequest
        });
      }

      if (action === 'REQUEST_REUPLOAD') {
        if (!documentType || !reason) {
          return res.status(400).json({
            success: false,
            message: 'Document type and rejection/re-upload reason are required.'
          });
        }

        // Find relevant document and preserve clean historical snapshot
        const targetDoc = kycRequest.documents.find(d => d.docType === documentType);
        if (targetDoc) {
          targetDoc.status = 'Re-upload Required';
          targetDoc.remarks = reason;
          kycRequest.previousDocumentVersions.push({
            docType: targetDoc.docType,
            docName: targetDoc.docName,
            docUrl: targetDoc.docUrl,
            version: targetDoc.version,
            status: 'Re-upload Required',
            remarks: reason,
            uploadedAt: targetDoc.uploadedAt
          });
        }

        kycRequest.status = KycStatus.RE_UPLOAD_REQUESTED;
        kycRequest.reuploadRequests.push({
          documentType,
          reason,
          requestedByUserId: currentUser.employeeId,
          requestedByName: currentUser.name,
          requestedAt: new Date(),
          isResolved: false
        });
        kycRequest.lastUpdated = new Date();

        await kycRequest.save();

        await logAudit(
          req,
          'KYC_REUPLOAD_REQUESTED',
          'KYC',
          kycRequest.requestId,
          `Re-upload requested for ${documentType} by ${currentUser.name}. Reason: ${reason}`
        );

        return res.json({
          success: true,
          message: `Re-upload request recorded for ${documentType}.`,
          data: kycRequest
        });
      }

      if (action === 'ESCALATE') {
        kycRequest.priority = 'Urgent';
        kycRequest.status = KycStatus.IN_PROGRESS;
        kycRequest.verificationRemarks = `ESCALATED by ${currentUser.name}: ${reason || remarks || 'Requires Team Lead review'}`;
        kycRequest.lastUpdated = new Date();
        await kycRequest.save();

        await NotificationItem.create({
          notificationId: generateId('NOTIF'),
          targetRole: Role.KYC_LEAD,
          targetDepartment: Department.KYC,
          title: `KYC Escalated: ${kycRequest.requestId}`,
          message: `${currentUser.name} escalated ${kycRequest.applicantName} (${kycRequest.applicantType}). Reason: ${reason || remarks || 'Needs review'}`,
          type: 'KYC',
          actionUrl: '/kyc'
        });

        await logAudit(
          req,
          'KYC_ESCALATED',
          'KYC',
          kycRequest.requestId,
          `KYC escalated to KYC Team Lead by ${currentUser.name}.`
        );

        return res.json({
          success: true,
          message: 'KYC request escalated to Team Lead with Urgent priority.',
          data: kycRequest
        });
      }

      return res.status(400).json({ success: false, message: 'Invalid verification action.' });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Escalate KYC Request directly by URL id
   */
  static async escalateRequest(req: Request, res: Response): Promise<any> {
    req.body = { ...req.body, requestId: req.params.id, action: 'ESCALATE' };
    return KycController.verifyKycAction(req, res);
  }

  /**
   * Applicant / Intake Resubmission of a Re-upload Requested Document (preserves version history)
   */
  static async resubmitDocument(req: Request, res: Response): Promise<any> {
    try {
      const { id } = req.params;
      const { docType, docUrl, docName, remarks } = req.body;
      const currentUser = req.user!;

      const kycRequest = await KycRequest.findOne(buildIdFilter('requestId', id));
      if (!kycRequest) {
        return res.status(404).json({ success: false, message: 'KYC Request not found.' });
      }

      const targetDoc = kycRequest.documents.find((d) => d.docType === docType);
      if (!targetDoc) {
        return res.status(404).json({ success: false, message: `Document type "${docType}" not found on this KYC request.` });
      }

      // Preserve prior version if not already captured for current version number
      const alreadyArchived = kycRequest.previousDocumentVersions.some(
        (prev) => prev.docType === targetDoc.docType && prev.version === targetDoc.version
      );
      if (!alreadyArchived) {
        kycRequest.previousDocumentVersions.push({
          docType: targetDoc.docType,
          docName: targetDoc.docName,
          docUrl: targetDoc.docUrl,
          version: targetDoc.version,
          status: targetDoc.status,
          remarks: targetDoc.remarks || 'Superseded by resubmission',
          uploadedAt: targetDoc.uploadedAt
        });
      }

      targetDoc.docUrl = docUrl;
      if (docName) targetDoc.docName = docName;
      targetDoc.version = (targetDoc.version || 1) + 1;
      targetDoc.status = 'Pending';
      targetDoc.remarks = remarks || 'Corrected document uploaded by applicant.';
      targetDoc.uploadedAt = new Date();

      kycRequest.reuploadRequests.forEach((r) => {
        if (r.documentType === docType && !r.isResolved) {
          r.isResolved = true;
          r.resolvedAt = new Date();
        }
      });

      kycRequest.status = kycRequest.assignedEmployeeId ? KycStatus.ASSIGNED : KycStatus.UNASSIGNED;
      kycRequest.lastUpdated = new Date();
      await kycRequest.save();

      await logAudit(
        req,
        'KYC_DOCUMENT_RESUBMITTED',
        'KYC',
        kycRequest.requestId,
        `Resubmitted ${docType} v${targetDoc.version} recorded via ${currentUser.name}. Prior version preserved.`
      );

      return res.json({
        success: true,
        message: `${docType} updated to v${targetDoc.version}. Request returned to KYC queue with full version history intact.`,
        data: kycRequest
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Read-only scan of live Connect App vendors/agents to import unlinked pending KYC requests
   */
  static async syncFromEcosystem(req: Request, res: Response): Promise<any> {
    try {
      const result = await ConnectEcosystemReader.syncPendingKycFromEcosystem();

      await logAudit(
        req,
        'KYC_ECOSYSTEM_SYNC',
        'KYC',
        'ECOSYSTEM_READER',
        `Scanned ${result.scannedVendors} vendors & ${result.scannedAgents} agents (read-only); imported ${result.importedCount} new pending KYC requests.`
      );

      return res.json({
        success: true,
        message: `Synced ${result.importedCount} pending KYC requests from Connect App collections.`,
        data: result
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getKycStats(req: Request, res: Response): Promise<any> {
    try {
      const { category } = req.query;
      const scopeFilter = KycController.buildScopeFilter(req.user!);
      const statsFilter: any = { ...scopeFilter };

      if (category && category !== 'ALL' && category !== 'All') {
        const resolvedCategory = resolveKycCategory(String(category));
        if (!resolvedCategory) {
          return res.status(400).json({
            success: false,
            message: `Unsupported KYC category filter: "${category}".`
          });
        }
        if (resolvedCategory.applicantType) {
          statsFilter.applicantType = resolvedCategory.applicantType;
        }
      }

      const allRequests = await KycRequest.find(statsFilter).lean();
      const total = allRequests.length;
      const unassigned = allRequests.filter((r) => r.status === KycStatus.UNASSIGNED).length;
      const assigned = allRequests.filter((r) => r.status === KycStatus.ASSIGNED).length;
      const inProgress = allRequests.filter((r) => [KycStatus.ASSIGNED, KycStatus.IN_PROGRESS].includes(r.status as KycStatus)).length;
      const approved = allRequests.filter((r) => r.status === KycStatus.APPROVED).length;
      const rejected = allRequests.filter((r) => r.status === KycStatus.REJECTED).length;
      const reuploadRequired = allRequests.filter((r) => r.status === KycStatus.RE_UPLOAD_REQUESTED).length;

      const slaCutoff = Date.now() - 24 * 60 * 60 * 1000;
      const overdueCount = allRequests.filter(
        (r) =>
          ![KycStatus.APPROVED, KycStatus.REJECTED].includes(r.status as KycStatus) &&
          new Date(r.submissionDate).getTime() < slaCutoff
      ).length;

      const reviewedWithTimes = allRequests.filter((r) => r.reviewedAt && r.submissionDate);
      const avgVerificationHours =
        reviewedWithTimes.length > 0
          ? Math.round(
              (reviewedWithTimes.reduce(
                (sum, r) => sum + Math.max(0, new Date(r.reviewedAt!).getTime() - new Date(r.submissionDate).getTime()),
                0
              ) /
                reviewedWithTimes.length /
                (1000 * 60 * 60)) *
                10
            ) / 10
          : 0;

      const kycEmployees = await Employee.find({
        department: Department.KYC,
        role: Role.KYC_EMPLOYEE,
        status: 'active'
      })
        .select('employeeId name')
        .lean();

      const employeeWorkload = kycEmployees.map((emp) => {
        const empReqs = allRequests.filter((r) => r.assignedEmployeeId === emp.employeeId);
        return {
          employeeId: emp.employeeId,
          employeeName: emp.name,
          activeCount: empReqs.filter((r) => ![KycStatus.APPROVED, KycStatus.REJECTED].includes(r.status as KycStatus)).length,
          completedCount: empReqs.filter((r) => [KycStatus.APPROVED, KycStatus.REJECTED].includes(r.status as KycStatus)).length
        };
      });

      return res.json({
        success: true,
        data: {
          total,
          unassigned,
          assigned,
          inProgress,
          approved,
          rejected,
          reuploadRequired,
          overdueCount,
          avgVerificationHours,
          employeeWorkload
        }
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}

