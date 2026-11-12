import mongoose from 'mongoose';
import { KycRequest } from '../models/KycRequest';
import { ApplicantType, KycStatus } from '../config/constants';
import { generateId, maskAadhaar, maskPan } from '../utils/security';

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
      db.collection('vendors').find({ kycStatus: { $in: [null, 'KYC Pending', 'pending'] } }).limit(20).toArray(),
      db.collection('agents').find({ kycStatus: { $in: ['pending', 'pending_verification', 'KYC Pending'] } }).limit(20).toArray()
    ]);

    let importedCount = 0;

    for (const v of vendors) {
      const applicantId = String(v.registrationId || v._id);
      const exists = await KycRequest.exists({ applicantId });
      if (!exists) {
        const docs = [] as Array<{
          docType: string;
          docName: string;
          docUrl: string;
          version: number;
          status: 'Pending' | 'Verified' | 'Re-upload Required' | 'Rejected';
          uploadedAt: Date;
        }>;
        if (v.panNumber) {
          docs.push({
            docType: 'PAN Card',
            docName: `PAN_${maskPan(String(v.panNumber))}.png`,
            docUrl: String(v.documents?.panCard || 'https://placehold.co/600x400/png?text=Vendor+PAN+Document'),
            status: 'Pending',
            version: 1,
            uploadedAt: v.submittedAt ? new Date(v.submittedAt) : new Date()
          });
        }
        if (v.aadhaarNumber) {
          docs.push({
            docType: 'Aadhaar Card',
            docName: `Aadhaar_${maskAadhaar(String(v.aadhaarNumber))}.png`,
            docUrl: String(v.documents?.aadhaar || 'https://placehold.co/600x400/png?text=Vendor+Aadhaar+Document'),
            status: 'Pending',
            version: 1,
            uploadedAt: v.submittedAt ? new Date(v.submittedAt) : new Date()
          });
        }
        if (docs.length === 0) {
          docs.push({
            docType: 'Business Registration Proof',
            docName: 'Vendor_Registration.png',
            docUrl: 'https://placehold.co/600x400/png?text=Vendor+Registration+Doc',
            status: 'Pending',
            version: 1,
            uploadedAt: v.submittedAt ? new Date(v.submittedAt) : new Date()
          });
        }

        await KycRequest.create({
          requestId: generateId('KYC-ECO'),
          applicantId,
          applicantName: String(v.ownerName || v.businessName || v.name || 'Connect Vendor'),
          applicantType: ApplicantType.VENDOR,
          phone: String(v.phone || '0000000000'),
          email: String(v.email || 'vendor@connectapp.in'),
          applicantDetails: {
            businessName: String(v.businessName || v.storeType || ''),
            gst: v.gst || '',
            pincode: v.pincode || '',
            sourceCollection: 'vendors'
          },
          registrationDate: v.createdAt ? new Date(v.createdAt) : new Date(),
          submissionDate: v.submittedAt ? new Date(v.submittedAt) : new Date(),
          priority: 'High',
          status: KycStatus.UNASSIGNED,
          documents: docs
        });
        importedCount += 1;
      }
    }

    for (const a of agents) {
      const applicantId = String(a.registrationId || a._id);
      const exists = await KycRequest.exists({ applicantId });
      if (!exists) {
        const docs = [] as Array<{
          docType: string;
          docName: string;
          docUrl: string;
          version: number;
          status: 'Pending' | 'Verified' | 'Re-upload Required' | 'Rejected';
          uploadedAt: Date;
        }>;
        if (a.aadhaarNumber || a.panNumber) {
          docs.push({
            docType: a.panNumber ? 'Agent PAN' : 'Agent Aadhaar',
            docName: a.panNumber ? `PAN_${maskPan(String(a.panNumber))}.png` : `Aadhaar_${maskAadhaar(String(a.aadhaarNumber))}.png`,
            docUrl: 'https://placehold.co/600x400/png?text=Agent+Identity+Doc',
            status: 'Pending',
            version: 1,
            uploadedAt: a.createdAt ? new Date(a.createdAt) : new Date()
          });
        } else {
          docs.push({
            docType: 'Agent Identity Proof',
            docName: 'Agent_Identity.png',
            docUrl: 'https://placehold.co/600x400/png?text=Agent+KYC+Doc',
            status: 'Pending',
            version: 1,
            uploadedAt: a.createdAt ? new Date(a.createdAt) : new Date()
          });
        }

        await KycRequest.create({
          requestId: generateId('KYC-ECO'),
          applicantId,
          applicantName: String(a.name || 'Connect Agent'),
          applicantType: ApplicantType.AGENT,
          phone: String(a.phone || a.mobile || '0000000000'),
          email: String(a.email || 'agent@connectapp.in'),
          applicantDetails: {
            territory: String(a.territory || a.assignedTerritory || 'Field Agent'),
            sourceCollection: 'agents'
          },
          registrationDate: a.createdAt ? new Date(a.createdAt) : new Date(),
          submissionDate: a.createdAt ? new Date(a.createdAt) : new Date(),
          priority: 'High',
          status: KycStatus.UNASSIGNED,
          documents: docs
        });
        importedCount += 1;
      }
    }

    return {
      importedCount,
      scannedVendors: vendors.length,
      scannedAgents: agents.length
    };
  }
}
