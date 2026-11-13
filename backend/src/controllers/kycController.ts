import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { KycRequest } from '../models/KycRequest';
import { Employee } from '../models/Employee';
import { NotificationItem } from '../models/NotificationItem';
import { ApplicantType, Department, KycStatus, Role } from '../config/constants';
import { KYC_CATEGORIES, resolveKycCategory } from '../config/categoryCatalog';
import { KycAssignmentService } from '../services/kycAssignmentService';
import { KycToPaymentRouter } from '../services/kycToPaymentRouter';
import { ConnectEcosystemReader } from '../services/connectEcosystemReader';
import { logAudit } from '../middleware/auditLogger';
import { buildIdFilter, generateId, maskAadhaar, maskBankAccount, maskPan } from '../utils/security';

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

  static async enrichWithEcosystemDetails(request: any): Promise<any> {
    const db = mongoose.connection.db;
    if (!db) return request;

    const appType = request.applicantType;
    const applicantId = request.applicantId;

    const enriched = request.toObject ? request.toObject() : { ...request };
    enriched.applicantDetails = enriched.applicantDetails || {};

    try {
      if (appType === ApplicantType.VENDOR) {
        const v = await db.collection('vendors').findOne({
          $or: [
            { _id: applicantId },
            { registrationId: applicantId },
            { id: applicantId },
            { phone: request.phone }
          ]
        });
        if (v) {
          enriched.applicantDetails = {
            ...enriched.applicantDetails,
            businessName: v.businessName || v.storeType || enriched.applicantDetails.businessName || '',
            ownerName: v.ownerName || v.name || enriched.applicantName,
            phone: v.phone || enriched.phone,
            alternatePhone: v.alternatePhone || '',
            email: v.email || enriched.email,
            category: v.category || '',
            subCategory: v.subCategory || v.subcategory || '',
            storeType: v.storeType || '',
            operatingHours: v.operatingHours || v.workingDays || '9:00 AM - 9:00 PM',
            website: v.website || '',
            companyRegNo: v.companyRegNo || v.cin || '',
            gst: v.gst || v.gstNumber || enriched.applicantDetails.gst || '',
            gstStatus: v.gstStatus || (v.gst ? 'Registered' : 'Unregistered'),
            msmeStatus: v.msmeStatus || (v.msmeNumber ? 'Registered' : 'Not Registered'),
            msmeNumber: v.msmeNumber || '',
            address: {
              doorNo: v.buildingNo || v.doorNo || '',
              street: v.streetName || v.street || '',
              village: v.village || v.locality || '',
              taluk: v.taluk || '',
              district: v.district || '',
              state: v.state || '',
              pincode: v.pincode || '',
              fullAddress: v.location?.address || v.address || ''
            },
            bankDetails: v.bankDetails || {
              accountHolder: v.accountHolder || v.ownerName || enriched.applicantName,
              bankName: v.bankName || 'State Bank of India',
              accountNumber: v.accountNumber ? maskBankAccount(String(v.accountNumber)) : '••••••••7812',
              ifscCode: v.ifscCode || v.ifsc || 'SBIN0001234',
              branchName: v.branchName || 'Central Branch',
              swiftCode: v.swiftCode || ''
            },
            onboardingAgent: v.onboardingAgent || (v.agentName ? {
              name: v.agentName,
              phone: v.onboardingAgentPhone || '',
              role: v.onboardingAgentRole || 'Agent'
            } : null),
            panNumberMasked: v.panNumber ? maskPan(String(v.panNumber)) : (enriched.applicantDetails.panNumberMasked || '•••••9012•'),
            aadhaarNumberMasked: v.aadhaarNumber ? maskAadhaar(String(v.aadhaarNumber)) : (enriched.applicantDetails.aadhaarNumberMasked || '•••• •••• 8812')
          };
        }
      } else if (appType === ApplicantType.AGENT) {
        const a = await db.collection('agents').findOne({
          $or: [
            { _id: applicantId },
            { registrationId: applicantId },
            { id: applicantId },
            { phone: request.phone }
          ]
        });
        if (a) {
          enriched.applicantDetails = {
            ...enriched.applicantDetails,
            name: a.name || enriched.applicantName,
            phone: a.phone || a.mobile || enriched.phone,
            altPhone: a.altPhone || a.alternateMobile || '',
            email: a.email || enriched.email,
            dob: a.dob ? new Date(a.dob).toLocaleDateString() : '',
            gender: a.gender || '',
            roleTier: a.role || a.level || 'Agent',
            qualification: a.qualification || '',
            experience: a.experience || '',
            previousCompany: a.previousCompany || '',
            territory: a.territory || a.assignedTerritory || {},
            vehicleDetails: a.vehicleDetails || {
              vehicleType: a.vehicleType || 'Two Wheeler',
              vehicleNumber: a.vehicleNumber || 'KA-01-AB-1234'
            },
            address: a.address || {
              doorNo: a.buildingNo || '',
              street: a.street || a.streetName || '',
              locality: a.locality || '',
              postOffice: a.postOffice || '',
              taluk: a.taluk || '',
              district: a.district || '',
              state: a.state || '',
              pincode: a.pincode || '',
              fullAddress: a.fullAddress || ''
            },
            bankDetails: a.bankDetails || {
              accountHolderName: a.accountHolderName || a.name || enriched.applicantName,
              bankName: a.bankName || 'HDFC Bank',
              accountNumber: a.accountNumber ? maskBankAccount(String(a.accountNumber)) : '••••••••3421',
              ifscCode: a.ifscCode || 'HDFC0001423',
              branchName: a.branchName || 'Main Branch'
            },
            panNumberMasked: a.panNumber ? maskPan(String(a.panNumber)) : (enriched.applicantDetails.panNumberMasked || '•••••4412•'),
            aadhaarNumberMasked: a.aadhaarNumber ? maskAadhaar(String(a.aadhaarNumber)) : (enriched.applicantDetails.aadhaarNumberMasked || '•••• •••• 6543')
          };
        }
      } else if (appType === ApplicantType.SUB_ADMIN) {
        const sa = await db.collection('admins').findOne({
          $or: [{ _id: applicantId }, { adminId: applicantId }, { email: enriched.email }]
        });
        if (sa) {
          enriched.applicantDetails = {
            ...enriched.applicantDetails,
            name: sa.name || enriched.applicantName,
            phone: sa.phone || enriched.phone,
            email: sa.email || enriched.email,
            adminScope: sa.adminScope || sa.role || enriched.applicantDetails.adminScope || 'District Admin',
            jurisdiction: sa.assignedJurisdiction || sa.jurisdiction || enriched.applicantDetails.jurisdiction,
            authorizationCode: sa.authorizationCode || enriched.applicantDetails.authorizationCode,
            assignedState: sa.assignedState || '',
            assignedDistrict: sa.assignedDistrict || '',
            assignedDivision: sa.assignedDivision || '',
            assignedPincode: sa.assignedPincode || '',
            bankDetails: sa.bankDetails || {}
          };
        }
      } else if (appType === ApplicantType.DELIVERY_PARTNER) {
        const dp = await db.collection('delivery_partners').findOne({
          $or: [{ _id: applicantId }, { id: applicantId }, { mobile: enriched.phone }]
        });
        if (dp) {
          enriched.applicantDetails = {
            ...enriched.applicantDetails,
            name: dp.name || enriched.applicantName,
            phone: dp.mobile || enriched.phone,
            emergencyContact: dp.emergency_contact || '',
            vehicleType: dp.vehicle_type || enriched.applicantDetails.vehicleType,
            vehicleNumber: dp.vehicle_number || enriched.applicantDetails.vehicleNumber,
            drivingLicense: dp.driving_license || enriched.applicantDetails.drivingLicense,
            serviceZone: dp.serviceZone || enriched.applicantDetails.serviceZone || 'Bengaluru South Hub',
            joiningDate: dp.joining_date || '',
            rating: dp.rating || 5.0
          };
        }
      } else if ([ApplicantType.KYC_EMPLOYEE, ApplicantType.PAYMENT_EMPLOYEE, ApplicantType.QUERIES_EMPLOYEE].includes(appType)) {
        const emp = await Employee.findOne({
          $or: [{ employeeId: applicantId }, { email: enriched.email }]
        });
        if (emp) {
          enriched.applicantDetails = {
            ...enriched.applicantDetails,
            employeeId: emp.employeeId,
            department: emp.department,
            designation: emp.designation,
            role: emp.role,
            employmentType: emp.employmentType,
            workLocation: emp.workLocation,
            joiningDate: emp.joiningDate ? new Date(emp.joiningDate).toLocaleDateString() : '',
            emergencyContact: emp.emergencyContact,
            bankDetails: emp.bankDetails,
            salaryCycle: emp.salaryCycle,
            permissions: emp.permissions
          };
        }
      }
    } catch (err) {
      console.error('Failed to enrich applicant details:', err);
    }

    return enriched;
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

      const enriched = await KycController.enrichWithEcosystemDetails(request);

      return res.json({
        success: true,
        data: enriched
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async downloadDocumentsZip(req: Request, res: Response): Promise<any> {
    try {
      const { id } = req.params;
      const request = await KycRequest.findOne(buildIdFilter('requestId', id));
      if (!request) {
        return res.status(404).json({ success: false, message: 'KYC Request not found.' });
      }

      if (!request.documents || request.documents.length === 0) {
        return res.status(400).json({ success: false, message: 'No uploaded documents available to download.' });
      }

      const JSZip = require('jszip');
      const zip = new JSZip();

      for (let i = 0; i < request.documents.length; i++) {
        const doc = request.documents[i];
        if (!doc.docUrl) continue;
        try {
          const fetchRes = await fetch(doc.docUrl);
          if (fetchRes.ok) {
            const buffer = Buffer.from(await fetchRes.arrayBuffer());
            let ext = 'png';
            const lowerUrl = doc.docUrl.toLowerCase();
            const lowerName = (doc.docName || '').toLowerCase();
            if (lowerUrl.includes('.pdf') || lowerName.includes('.pdf')) ext = 'pdf';
            else if (lowerUrl.includes('.jpg') || lowerName.includes('.jpg')) ext = 'jpg';
            else if (lowerUrl.includes('.jpeg') || lowerName.includes('.jpeg')) ext = 'jpeg';
            else if (lowerUrl.includes('.webp') || lowerName.includes('.webp')) ext = 'webp';

            const cleanDocName = (doc.docName || doc.docType || `doc_${i + 1}`)
              .replace(/[^a-zA-Z0-9_\-\.]/g, '_')
              .replace(/\.[a-zA-Z0-9]+$/, '');
            const cleanAppName = request.applicantName.replace(/[^a-zA-Z0-9_]/g, '_');
            const filename = `${cleanAppName}_${cleanDocName}_v${doc.version || 1}.${ext}`;
            zip.file(filename, buffer);
          }
        } catch (fetchErr) {
          console.warn(`Could not fetch doc ${doc.docUrl} for ZIP:`, fetchErr);
        }
      }

      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
      const cleanAppName = request.applicantName.replace(/[^a-zA-Z0-9_]/g, '_');
      const zipFilename = `${request.requestId}_${cleanAppName}_KYC_Documents.zip`;

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);
      res.setHeader('Content-Length', zipBuffer.length);

      await logAudit(
        req,
        'KYC_DOCS_ZIP_DOWNLOADED',
        'KYC',
        request.requestId,
        `Downloaded all ${request.documents.length} KYC documents as ZIP.`
      );

      return res.end(zipBuffer);
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
   * Helper to synchronize verified approval or rejection back to live ecosystem vendors/agents
   */
  private static async syncToEcosystem(kycRequest: any, action: 'APPROVED' | 'REJECTED', currentUser: any, remarks?: string) {
    try {
      const db = mongoose.connection.db;
      if (!db) return;

      const applicantId = String(kycRequest.applicantId || '');
      const isVendor = kycRequest.applicantType === ApplicantType.VENDOR;
      const isAgent = kycRequest.applicantType === ApplicantType.AGENT;

      if (!isVendor && !isAgent) return;

      const idQueries: any[] = [{ registrationId: applicantId }, { id: applicantId }];
      if (mongoose.Types.ObjectId.isValid(applicantId)) {
        idQueries.unshift({ _id: new mongoose.Types.ObjectId(applicantId) });
      }

      if (isVendor) {
        if (action === 'APPROVED') {
          await db.collection('vendors').updateOne(
            { $or: idQueries },
            {
              $set: {
                kycStatus: 'Approved',
                isApproved: true,
                approvedAt: new Date(),
                approvedById: currentUser.employeeId,
                approvedByName: currentUser.name,
                approvedByRole: currentUser.role,
                updatedAt: new Date()
              },
              $push: {
                reviewHistory: {
                  action: 'APPROVED',
                  reason: remarks || 'KYC verified and approved in Backoffice',
                  reviewedBy: currentUser.name,
                  reviewedById: currentUser.employeeId,
                  reviewerRole: currentUser.role,
                  timestamp: new Date()
                }
              } as any
            }
          );
        } else if (action === 'REJECTED') {
          await db.collection('vendors').updateOne(
            { $or: idQueries },
            {
              $set: {
                kycStatus: 'Rejected',
                rejectionReason: remarks || 'Rejected in Backoffice',
                updatedAt: new Date()
              },
              $push: {
                reviewHistory: {
                  action: 'REJECTED',
                  reason: remarks || 'Rejected in Backoffice',
                  reviewedBy: currentUser.name,
                  reviewedById: currentUser.employeeId,
                  reviewerRole: currentUser.role,
                  timestamp: new Date()
                }
              } as any
            }
          );
        }
      } else if (isAgent) {
        if (action === 'APPROVED') {
          await db.collection('agents').updateOne(
            { $or: idQueries },
            {
              $set: {
                kycStatus: 'Approved',
                isApproved: true,
                adminApprovalStatus: 'approved',
                adminApprovedAt: new Date(),
                adminApprovedById: currentUser.employeeId,
                adminApprovedBy: currentUser.name,
                adminApprovedByRole: currentUser.role,
                updatedAt: new Date()
              },
              $push: {
                reviewHistory: {
                  action: 'APPROVED',
                  status: 'Active',
                  reviewerId: currentUser.employeeId,
                  reviewerName: currentUser.name,
                  reviewerRole: currentUser.role,
                  reviewedAt: new Date(),
                  timestamp: new Date(),
                  remarks: remarks || 'KYC verified and approved in Backoffice'
                }
              } as any
            }
          );
        } else if (action === 'REJECTED') {
          await db.collection('agents').updateOne(
            { $or: idQueries },
            {
              $set: {
                kycStatus: 'Rejected',
                rejectionReason: remarks || 'Rejected in Backoffice',
                updatedAt: new Date()
              },
              $push: {
                reviewHistory: {
                  action: 'REJECTED',
                  status: 'Rejected',
                  reviewerId: currentUser.employeeId,
                  reviewerName: currentUser.name,
                  reviewerRole: currentUser.role,
                  reviewedAt: new Date(),
                  timestamp: new Date(),
                  remarks: remarks || 'Rejected in Backoffice'
                }
              } as any
            }
          );
        }
      }
    } catch (e: any) {
      console.warn('[KYC Ecosystem Sync]: Non-fatal sync notice:', e.message);
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
        const approvalRemarks = remarks || 'All documents verified and approved.';
        kycRequest.status = KycStatus.APPROVED;
        kycRequest.verificationRemarks = approvalRemarks;
        kycRequest.reviewedBy = currentUser.name;
        kycRequest.reviewedAt = new Date();
        kycRequest.approvedBy = {
          employeeId: currentUser.employeeId,
          name: currentUser.name,
          role: currentUser.role,
          department: currentUser.department,
          at: new Date(),
          remarks: approvalRemarks
        };
        kycRequest.approvalHistory = kycRequest.approvalHistory || [];
        kycRequest.approvalHistory.push({
          action: 'APPROVED',
          status: 'Approved',
          actorId: currentUser.employeeId,
          actorName: currentUser.name,
          actorRole: currentUser.role,
          actorDepartment: currentUser.department,
          timestamp: new Date(),
          remarks: approvalRemarks
        });
        kycRequest.lastUpdated = new Date();

        // Mark all documents verified
        kycRequest.documents.forEach(doc => {
          doc.status = 'Verified';
          doc.verifiedBy = currentUser.name;
          doc.verifiedAt = new Date();
        });

        // Sync to live vendors / agents collections
        await KycController.syncToEcosystem(kycRequest, 'APPROVED', currentUser, approvalRemarks);

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
          `KYC Approved by ${currentUser.name} (${currentUser.employeeId}, ${currentUser.role}, ${currentUser.department}). ${routingResult.message}`
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
        kycRequest.rejectedBy = {
          employeeId: currentUser.employeeId,
          name: currentUser.name,
          role: currentUser.role,
          department: currentUser.department,
          at: new Date(),
          reason: reason
        };
        kycRequest.approvalHistory = kycRequest.approvalHistory || [];
        kycRequest.approvalHistory.push({
          action: 'REJECTED',
          status: 'Rejected',
          actorId: currentUser.employeeId,
          actorName: currentUser.name,
          actorRole: currentUser.role,
          actorDepartment: currentUser.department,
          timestamp: new Date(),
          remarks: reason
        });
        kycRequest.lastUpdated = new Date();

        await kycRequest.save();

        // Sync to live vendors / agents collections
        await KycController.syncToEcosystem(kycRequest, 'REJECTED', currentUser, reason);

        await logAudit(
          req,
          'KYC_REJECTED',
          'KYC',
          kycRequest.requestId,
          `KYC Rejected by ${currentUser.name} (${currentUser.employeeId}, ${currentUser.role}, ${currentUser.department}). Reason: ${reason}`
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
        kycRequest.approvalHistory = kycRequest.approvalHistory || [];
        kycRequest.approvalHistory.push({
          action: 'RE_UPLOAD_REQUESTED',
          status: 'Re-upload Requested',
          actorId: currentUser.employeeId,
          actorName: currentUser.name,
          actorRole: currentUser.role,
          actorDepartment: currentUser.department,
          timestamp: new Date(),
          remarks: `Re-upload requested for ${documentType}: ${reason}`
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
        const escRemarks = `ESCALATED by ${currentUser.name}: ${reason || remarks || 'Requires Team Lead review'}`;
        kycRequest.verificationRemarks = escRemarks;
        kycRequest.approvalHistory = kycRequest.approvalHistory || [];
        kycRequest.approvalHistory.push({
          action: 'ESCALATED',
          status: kycRequest.status,
          actorId: currentUser.employeeId,
          actorName: currentUser.name,
          actorRole: currentUser.role,
          actorDepartment: currentUser.department,
          timestamp: new Date(),
          remarks: escRemarks
        });
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
      kycRequest.approvalHistory = kycRequest.approvalHistory || [];
      kycRequest.approvalHistory.push({
        action: 'DOCUMENT_RESUBMITTED',
        status: kycRequest.status,
        actorId: currentUser.employeeId,
        actorName: currentUser.name,
        actorRole: currentUser.role,
        actorDepartment: currentUser.department,
        timestamp: new Date(),
        remarks: `Resubmitted ${docType} (v${targetDoc.version}). Prior version preserved.`
      });
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

