import mongoose from 'mongoose';
import { KycRequest } from '../models/KycRequest';
import { QueryTicket } from '../models/QueryTicket';
import { ApplicantType, KycStatus, Department, QueryStatus } from '../config/constants';
import { generateId, maskAadhaar, maskPan, maskBankAccount } from '../utils/security';

export interface EcosystemSummary {
  ordersCount: number;
  productOrdersCount: number;
  serviceBookingsCount: number;
  jobApplicationsCount: number;
  paidOrdersTotalInr: number;
  membershipPaymentsCount: number;
  membershipRevenueInr: number;
  vendorsCount: number;
  pendingVendorKycCount: number;
  agentsCount: number;
  pendingAgentKycCount: number;
  customersCount: number;
  usersCount: number;
  recentOrders: Array<{
    orderNumber: string;
    customerName: string;
    category: string;
    amount: number;
    paymentStatus: string;
    orderStatus: string;
    createdAt: Date | string;
  }>;
  recentMembershipPayments: Array<{
    paymentId: string;
    customerName: string;
    plan: string;
    amount: number;
    status: string;
    createdAt: Date | string;
  }>;
}

const BOOKING_TYPES = new Set(['Services', 'Home Services', 'Stay', 'Travel', 'booking']);
const JOB_TYPES = new Set(['Job', 'Jobs']);

interface SyncedKycDoc {
  docType: string;
  docName: string;
  docUrl: string;
  version: number;
  status: 'Pending' | 'Verified' | 'Re-upload Required' | 'Rejected';
  uploadedAt: Date;
}

function isRealMediaUrl(raw: unknown): raw is string {
  if (typeof raw !== 'string') return false;
  const val = raw.trim();
  if (!val || val.includes('placehold.co')) return false;
  return /^(https?:\/\/|data:image\/|data:application\/pdf|\/uploads\/)/i.test(val);
}

/**
 * Extract genuine persisted document URLs from Connect App vendor/agent/kyc documents
 * without ever synthesizing placeholder image URLs.
 */
function extractRealDocuments(rawDocs: unknown, fallbackDate: Date): SyncedKycDoc[] {
  const docs: SyncedKycDoc[] = [];

  if (Array.isArray(rawDocs)) {
    rawDocs.forEach((item: any, idx: number) => {
      if (typeof item === 'string' && isRealMediaUrl(item)) {
        docs.push({
          docType: `Document ${idx + 1}`,
          docName: `document_${idx + 1}`,
          docUrl: item.trim(),
          version: 1,
          status: 'Pending',
          uploadedAt: fallbackDate
        });
      } else if (item && typeof item === 'object') {
        const candidateUrl = item.docUrl || item.url || item.secureUrl || item.secure_url || item.fileUrl;
        if (isRealMediaUrl(candidateUrl)) {
          docs.push({
            docType: String(item.docType || item.type || item.label || `Document ${idx + 1}`),
            docName: String(item.docName || item.name || item.originalName || `document_${idx + 1}`),
            docUrl: String(candidateUrl).trim(),
            version: 1,
            status: 'Pending',
            uploadedAt: item.uploadedAt ? new Date(item.uploadedAt) : fallbackDate
          });
        }
      }
    });
  } else if (rawDocs && typeof rawDocs === 'object') {
    for (const [key, val] of Object.entries(rawDocs as Record<string, any>)) {
      if (isRealMediaUrl(val)) {
        docs.push({
          docType: key,
          docName: key,
          docUrl: val.trim(),
          version: 1,
          status: 'Pending',
          uploadedAt: fallbackDate
        });
      } else if (val && typeof val === 'object') {
        const candidateUrl = val.docUrl || val.url || val.secureUrl || val.secure_url || val.fileUrl;
        if (isRealMediaUrl(candidateUrl)) {
          docs.push({
            docType: String(val.docType || val.type || key),
            docName: String(val.docName || val.name || key),
            docUrl: String(candidateUrl).trim(),
            version: 1,
            status: 'Pending',
            uploadedAt: val.uploadedAt ? new Date(val.uploadedAt) : fallbackDate
          });
        }
      }
    }
  }

  return docs;
}

/**
 * Strictly READ-ONLY bridge into existing `connect_db` production collections.
 * Never mutates, migrates, or deletes any Connect App source-of-truth records.
 */
export class ConnectEcosystemReader {
  private static getDb() {
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection is not initialized');
    }
    return db;
  }

  static async getEcosystemSummary(): Promise<EcosystemSummary> {
    const db = this.getDb();

    const [
      orders,
      membershipPayments,
      vendorsCount,
      pendingVendorKycCount,
      agentsCount,
      pendingAgentKycCount,
      customersCount,
      usersCount
    ] = await Promise.all([
      db
        .collection('orders')
        .find({}, {
          projection: {
            order_number: 1,
            id: 1,
            customer_name: 1,
            memberName: 1,
            type: 1,
            amount: 1,
            totalAmount: 1,
            finalAmount: 1,
            paymentStatus: 1,
            payment_status: 1,
            status: 1,
            created_at: 1,
            updatedAt: 1
          }
        })
        .sort({ created_at: -1, _id: -1 })
        .toArray(),
      db
        .collection('membership_payments')
        .find({}, {
          projection: {
            paymentId: 1,
            customerName: 1,
            plan: 1,
            amount: 1,
            status: 1,
            createdAt: 1
          }
        })
        .sort({ createdAt: -1 })
        .toArray(),
      db.collection('vendors').countDocuments(),
      db.collection('vendors').countDocuments({ kycStatus: { $in: [null, 'KYC Pending', 'pending'] } }),
      db.collection('agents').countDocuments(),
      db.collection('agents').countDocuments({ kycStatus: { $in: ['pending', 'pending_verification', 'KYC Pending'] } }),
      db.collection('customers').countDocuments(),
      db.collection('users').countDocuments()
    ]);

    let productOrdersCount = 0;
    let serviceBookingsCount = 0;
    let jobApplicationsCount = 0;
    let paidOrdersTotalInr = 0;

    for (const o of orders) {
      const orderType = String(o.type || 'Order');
      if (JOB_TYPES.has(orderType)) {
        jobApplicationsCount += 1;
      } else if (BOOKING_TYPES.has(orderType)) {
        serviceBookingsCount += 1;
      } else {
        productOrdersCount += 1;
      }

      const payStat = String(o.paymentStatus || o.payment_status || '').toLowerCase();
      if (payStat === 'paid' || payStat === 'success' || payStat === 'completed') {
        const amt = Number(o.finalAmount ?? o.totalAmount ?? o.amount ?? 0);
        if (Number.isFinite(amt)) paidOrdersTotalInr += amt;
      }
    }

    let membershipRevenueInr = 0;
    for (const m of membershipPayments) {
      if (String(m.status || '').toUpperCase() === 'SUCCESS') {
        const amt = Number(m.amount || 0);
        if (Number.isFinite(amt)) membershipRevenueInr += amt;
      }
    }

    const recentOrders = orders.slice(0, 12).map((o) => ({
      orderNumber: String(o.order_number || o.id || o._id),
      customerName: String(o.customer_name || o.memberName || 'Connect Customer'),
      category: String(o.type || 'Order'),
      amount: Number(o.finalAmount ?? o.totalAmount ?? o.amount ?? 0),
      paymentStatus: String(o.paymentStatus || o.payment_status || 'Pending'),
      orderStatus: String(o.status || 'Pending'),
      createdAt: o.created_at || o.updatedAt || new Date()
    }));

    const recentMembershipPayments = membershipPayments.slice(0, 10).map((m) => ({
      paymentId: String(m.paymentId || m._id),
      customerName: String(m.customerName || 'Connect Member'),
      plan: String(m.plan || 'Membership'),
      amount: Number(m.amount || 0),
      status: String(m.status || 'PENDING'),
      createdAt: m.createdAt || new Date()
    }));

    return {
      ordersCount: orders.length,
      productOrdersCount,
      serviceBookingsCount,
      jobApplicationsCount,
      paidOrdersTotalInr: Math.round(paidOrdersTotalInr * 100) / 100,
      membershipPaymentsCount: membershipPayments.length,
      membershipRevenueInr: Math.round(membershipRevenueInr * 100) / 100,
      vendorsCount,
      pendingVendorKycCount,
      agentsCount,
      pendingAgentKycCount,
      customersCount,
      usersCount,
      recentOrders,
      recentMembershipPayments
    };
  }

  /**
   * Read-only scan of Connect App `vendors` and `agents` collections to import any
   * pending KYC profiles into `backoffice_kyc_requests` without mutating source collections.
   */
  static async syncPendingKycFromEcosystem(): Promise<{ importedCount: number; scannedVendors: number; scannedAgents: number }> {
    const db = this.getDb();

    const [vendors, agents] = await Promise.all([
      db.collection('vendors').find({
        $or: [
          { kycStatus: { $in: [null, '', 'KYC Pending', 'pending', 'pending_approval', 'under_review', 'submitted', 'Approved', 'approved', 'Verified'] } },
          { kycStatus: { $exists: false } }
        ]
      }).toArray(),
      db.collection('agents').find({
        $or: [
          { kycStatus: { $in: [null, '', 'pending', 'pending_verification', 'KYC Pending', 'under_review', 'approved'] } },
          { kycStatus: { $exists: false } }
        ]
      }).toArray()
    ]);

    let importedCount = 0;

    for (const v of vendors) {
      const applicantId = String(v.registrationId || v._id);
      const exists = await KycRequest.exists({ applicantId });
      if (!exists) {
        const uploadedDate = v.submittedAt ? new Date(v.submittedAt) : new Date();
        const docs = extractRealDocuments(v.documents, uploadedDate);

        // Also inspect top-level URL fields commonly persisted on vendor onboarding records
        const topLevelDocPairs: Array<[string, unknown]> = [
          ['PAN Card', v.panUrl],
          ['Aadhaar Card', v.aadhaarUrl || v.aadharUrl],
          ['GST Certificate', v.gstUrl],
          ['Business Registration', v.registrationDocUrl]
        ];
        for (const [label, maybeUrl] of topLevelDocPairs) {
          if (isRealMediaUrl(maybeUrl) && !docs.some((d) => d.docUrl === maybeUrl.trim())) {
            docs.push({
              docType: label,
              docName: label.replace(/\s+/g, '_'),
              docUrl: maybeUrl.trim(),
              version: 1,
              status: 'Pending',
              uploadedAt: uploadedDate
            });
          }
        }

        const approvalHistory: any[] = [];
        let approvedBy: any = null;
        let rejectedBy: any = null;

        if (Array.isArray(v.reviewHistory)) {
          v.reviewHistory.forEach((r: any) => {
            approvalHistory.push({
              action: r.action || 'REVIEW',
              status: r.status || (r.action === 'APPROVED' ? 'Approved' : 'Pending'),
              actorId: r.reviewedById || 'ECOSYSTEM',
              actorName: r.reviewedBy || 'Ecosystem Official',
              actorRole: r.reviewerRole || 'Reviewer',
              actorDepartment: 'Operations',
              timestamp: r.timestamp ? new Date(r.timestamp) : uploadedDate,
              remarks: r.reason || r.remarks || ''
            });
          });
        }

        if (v.approvedByName) {
          approvedBy = {
            employeeId: v.approvedById || 'ECOSYSTEM',
            name: v.approvedByName,
            role: v.approvedByRole || 'Admin',
            department: 'Operations',
            at: v.approvedAt ? new Date(v.approvedAt) : uploadedDate,
            remarks: v.reviewerReason || 'Approved via Ecosystem Workflow'
          };
        }

        await KycRequest.create({
          requestId: generateId('KYC-ECO'),
          applicantId,
          applicantName: String(v.ownerName || v.businessName || v.name || applicantId),
          applicantType: ApplicantType.VENDOR,
          phone: typeof v.phone === 'string' ? v.phone.trim() : '',
          email: typeof v.email === 'string' ? v.email.trim().toLowerCase() : '',
          applicantDetails: {
            businessName: String(v.businessName || v.storeType || ''),
            gst: v.gst || '',
            panNumberMasked: v.panNumber ? maskPan(String(v.panNumber)) : '',
            aadhaarNumberMasked: v.aadhaarNumber ? maskAadhaar(String(v.aadhaarNumber)) : '',
            pincode: v.pincode || '',
            sourceCollection: 'vendors'
          },
          registrationDate: v.createdAt ? new Date(v.createdAt) : new Date(),
          submissionDate: uploadedDate,
          priority: 'High',
          status: KycStatus.UNASSIGNED,
          documents: docs,
          approvedBy,
          rejectedBy,
          approvalHistory
        });
        importedCount += 1;
      } else {
        await KycRequest.updateOne(
          { applicantId },
          {
            $set: {
              'applicantDetails.businessName': String(v.businessName || v.storeType || ''),
              'applicantDetails.category': String(v.category || v.storeType || 'Services'),
              'applicantDetails.subCategory': String(v.subCategory || v.subcategory || v.category || ''),
              'applicantDetails.state': v.state || v.assignedState || '',
              'applicantDetails.district': v.district || v.assignedDistrict || '',
              'applicantDetails.division': v.division || v.assignedDivision || '',
              'applicantDetails.taluk': v.taluk || '',
              'applicantDetails.pincode': v.pincode || '',
              'applicantDetails.territoryFormatted': [v.division, v.district, v.state, v.pincode ? `(${v.pincode})` : ''].filter(Boolean).join(', ') || v.state || '',
              'applicantDetails.address': {
                doorNo: v.buildingNo || v.doorNo || '',
                street: v.streetName || v.street || '',
                village: v.postOffice || v.village || v.locality || '',
                taluk: v.taluk || '',
                district: v.district || v.assignedDistrict || '',
                state: v.state || v.assignedState || '',
                pincode: v.pincode || '',
                fullAddress: v.location?.address || v.address || ''
              },
              'applicantDetails.registrationSource': v.registrationSource || v.createdVia || v.joiningType || (v.onboardingAgent || v.agentName ? 'Agent Onboarding' : 'Direct Registration'),
              'applicantDetails.onboardingAgent': v.onboardingAgent || (v.agentName ? {
                id: v.agentRegistrationId || v.agentId || '',
                name: v.agentName,
                phone: v.onboardingAgentPhone || '',
                role: v.onboardingAgentRole || 'Agent'
              } : null),
              'applicantDetails.responsibleAdmin': v.responsibleAdmin || (v.approvedByName ? {
                id: v.approvedById || v.responsibleAdminId || '',
                name: v.approvedByName || v.responsibleAdminName || '',
                phone: v.responsibleAdminPhone || '',
                role: v.approvedByRole || v.responsibleAdminRole || 'Admin',
                pincode: v.pincode || ''
              } : null),
              'applicantDetails.pincodeAdminApproval': v.pincodeAdminApproval || null
            }
          }
        );
      }
    }

    for (const a of agents) {
      const applicantId = String(a.registrationId || a._id);
      const exists = await KycRequest.exists({ applicantId });
      if (!exists) {
        const uploadedDate = a.createdAt ? new Date(a.createdAt) : new Date();
        const docs = extractRealDocuments(a.documents, uploadedDate);

        const topLevelDocPairs: Array<[string, unknown]> = [
          ['Agent PAN', a.panUrl],
          ['Agent Aadhaar', a.aadhaarUrl || a.aadharUrl],
          ['Agent Photo', a.photoUrl]
        ];
        for (const [label, maybeUrl] of topLevelDocPairs) {
          if (isRealMediaUrl(maybeUrl) && !docs.some((d) => d.docUrl === maybeUrl.trim())) {
            docs.push({
              docType: label,
              docName: label.replace(/\s+/g, '_'),
              docUrl: maybeUrl.trim(),
              version: 1,
              status: 'Pending',
              uploadedAt: uploadedDate
            });
          }
        }

        const approvalHistory: any[] = [];
        let approvedBy: any = null;
        let rejectedBy: any = null;

        if (Array.isArray(a.reviewHistory)) {
          a.reviewHistory.forEach((r: any) => {
            approvalHistory.push({
              action: r.action || 'REVIEW',
              status: r.status || (r.action === 'APPROVED' ? 'Approved' : 'Pending'),
              actorId: r.reviewerId || 'ECOSYSTEM',
              actorName: r.reviewerName || 'Ecosystem Official',
              actorRole: r.reviewerRole || 'Reviewer',
              actorDepartment: 'Operations',
              timestamp: r.timestamp || r.reviewedAt ? new Date(r.timestamp || r.reviewedAt) : uploadedDate,
              remarks: r.remarks || r.reason || ''
            });
          });
        }

        if (a.adminApprovedBy) {
          approvedBy = {
            employeeId: a.adminApprovedById || 'ECOSYSTEM',
            name: a.adminApprovedBy,
            role: a.adminApprovedByRole || 'Admin',
            department: 'Operations',
            at: a.adminApprovedAt ? new Date(a.adminApprovedAt) : uploadedDate,
            remarks: a.adminNotes || 'Approved via Ecosystem Workflow'
          };
        }

        await KycRequest.create({
          requestId: generateId('KYC-ECO'),
          applicantId,
          applicantName: String(a.name || applicantId),
          applicantType: ApplicantType.AGENT,
          phone: typeof (a.phone || a.mobile) === 'string' ? String(a.phone || a.mobile).trim() : '',
          email: typeof a.email === 'string' ? a.email.trim().toLowerCase() : '',
          applicantDetails: {
            territory: String(a.territory || a.assignedTerritory || ''),
            panNumberMasked: a.panNumber ? maskPan(String(a.panNumber)) : '',
            aadhaarNumberMasked: a.aadhaarNumber ? maskAadhaar(String(a.aadhaarNumber)) : '',
            sourceCollection: 'agents'
          },
          registrationDate: a.createdAt ? new Date(a.createdAt) : new Date(),
          submissionDate: uploadedDate,
          priority: 'High',
          status: KycStatus.UNASSIGNED,
          documents: docs,
          approvedBy,
          rejectedBy,
          approvalHistory
        });
        importedCount += 1;
      } else {
        const territoryFormatted =
          typeof a.territory === 'object' && a.territory !== null
            ? [a.territory.division, a.territory.district, a.territory.state, a.territory.pincode].filter(Boolean).join(', ')
            : String(a.territory || a.assignedTerritory || a.state || '');

        await KycRequest.updateOne(
          { applicantId },
          {
            $set: {
              'applicantDetails.roleTier': a.roleTier || a.tier || 'District Agent',
              'applicantDetails.territory': typeof a.territory === 'object' ? JSON.stringify(a.territory) : String(a.territory || ''),
              'applicantDetails.territoryFormatted': territoryFormatted,
              'applicantDetails.state': (typeof a.territory === 'object' ? a.territory?.state : a.state) || '',
              'applicantDetails.district': (typeof a.territory === 'object' ? a.territory?.district : a.district) || '',
              'applicantDetails.division': (typeof a.territory === 'object' ? a.territory?.division : a.division) || '',
              'applicantDetails.pincode': (typeof a.territory === 'object' ? a.territory?.pincode : a.pincode) || '',
              'applicantDetails.registrationSource': a.registrationSource || 'Direct Registration'
            }
          }
        );
      }
    }

    return {
      importedCount,
      scannedVendors: vendors.length,
      scannedAgents: agents.length
    };
  }

  /**
   * Bidirectional sync of support tickets created across Connect App external platforms
   * (e.g. Agent Mobile App, Agent Website, Customer App) in the `tickets` or `supporttickets` collections.
   */
  static async syncEcosystemTickets(): Promise<{ syncedCount: number }> {
    const db = this.getDb();
    const rawTickets = await db.collection('tickets').find({}).toArray();
    let syncedCount = 0;

    for (const t of rawTickets) {
      const queryId = String(t.ticketId || t._id);
      const exists = await QueryTicket.findOne({ queryId });

      const userType = t.ticketType === 'vendor_issue' || t.vendorName
        ? 'Vendor'
        : (t.creatorRole || t.assignedAgentRole ? 'Agent' : 'Customer');

      const priorityMap: Record<string, 'Low' | 'Medium' | 'High' | 'Urgent'> = {
        low: 'Low',
        medium: 'Medium',
        high: 'High',
        urgent: 'Urgent'
      };
      const priority = priorityMap[String(t.priority || '').toLowerCase()] || 'Medium';

      const statusMap: Record<string, QueryStatus> = {
        open: QueryStatus.NEW,
        assigned: QueryStatus.ASSIGNED,
        in_progress: QueryStatus.IN_PROGRESS,
        resolved: QueryStatus.RESOLVED,
        closed: QueryStatus.RESOLVED
      };
      const rawStatus = String(t.status || '').toLowerCase();
      const status = statusMap[rawStatus] || QueryStatus.NEW;

      if (!exists) {
        await QueryTicket.create({
          queryId,
          userType,
          userId: String(t.creator || t.assignedTo || 'ECOSYSTEM-USER'),
          userName: String(t.creatorName || t.assignedAgent || 'Ecosystem User'),
          userEmail: String(t.creatorEmail || t.assignedAgentEmail || 'support@connectapp.in'),
          userPhone: String(t.assignedAgentPhone || t.creatorPhone || ''),
          category: String(t.category || 'General Support'),
          subject: String(t.subject || 'Support Ticket'),
          description: String(t.description || ''),
          priority,
          status,
          currentDepartment: Department.QUERIES,
          sourceDepartment: Department.QUERIES,
          sharedDepartments: [Department.QUERIES],
          conversation: Array.isArray(t.conversation) && t.conversation.length > 0
            ? t.conversation
            : (t.description ? [{
                messageId: generateId('MSG'),
                senderId: String(t.creator || 'USER'),
                senderName: String(t.creatorName || 'User'),
                senderRole: userType,
                message: String(t.description),
                timestamp: t.createdAt ? new Date(t.createdAt) : new Date()
              }] : []),
          internalNotes: [],
          transferHistory: [],
          createdAt: t.createdAt ? new Date(t.createdAt) : new Date(),
          updatedAt: t.updatedAt ? new Date(t.updatedAt) : new Date()
        });
        syncedCount++;
      } else {
        if (Array.isArray(t.conversation) && t.conversation.length > (exists.conversation?.length || 0)) {
          exists.conversation = t.conversation;
          await exists.save();
        }
      }
    }

    return { syncedCount };
  }

  /**
   * Push a message appended in Support Team query workbench back to the ecosystem `tickets` collection.
   */
  static async pushTicketMessageToEcosystem(
    ticketId: string,
    messagePayload: { messageId?: string; senderId?: string; senderName?: string; senderRole?: string; message: string; timestamp?: Date }
  ): Promise<void> {
    try {
      const db = this.getDb();
      await db.collection('tickets').updateOne(
        { ticketId },
        {
          $push: {
            conversation: {
              sender: messagePayload.senderId || 'SUPPORT',
              senderName: messagePayload.senderName || 'Support Executive',
              role: messagePayload.senderRole || 'support',
              message: messagePayload.message,
              time: messagePayload.timestamp || new Date(),
              _id: new mongoose.Types.ObjectId()
            } as any
          },
          $set: { updatedAt: new Date() }
        }
      );
    } catch (err) {
      console.error('Failed to push ticket message to ecosystem:', err);
    }
  }

  /**
   * Push a status update (open, in_progress, resolved) back to the ecosystem `tickets` collection.
   */
  static async pushTicketStatusToEcosystem(ticketId: string, status: string): Promise<void> {
    try {
      const db = this.getDb();
      await db.collection('tickets').updateOne(
        { ticketId },
        {
          $set: {
            status: status.toLowerCase(),
            updatedAt: new Date()
          }
        }
      );
    } catch (err) {
      console.error('Failed to push ticket status to ecosystem:', err);
    }
  }
}
