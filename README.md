# Connect App – Centralized Backoffice Management System

A production-oriented Enterprise MERN Stack platform for managing Connect App operations across three specialized departments: **KYC Verification**, **Payment & Financial Operations**, and **Customer/Vendor Queries**, overseen by an **Overall Team Lead**.

---

## Architecture Separation

The Frontend and Backend are strictly decoupled into independent applications:

- **`backend/`**: Node.js + Express + TypeScript + Mongoose REST API (Port `8007`)
- **`frontend/`**: React + TypeScript + Vite + Tailwind CSS + Recharts Dashboard (Port `5175`)

---

## Confirmed Business Decisions Enforced End-to-End

1. **Agent Initial Deposit Classification (Liability)**  
   Agent initial security deposits are tracked strictly in `backoffice_agent_deposit_liabilities` and excluded from `Total Recognized Income`. Refunds and adjustments write linked liability ledger movements.
2. **Payment Maker-Checker Approval**  
   Every payout, settlement, and disbursement initiated by a Maker requires independent review and approval by an authorized Checker. Self-approval is strictly blocked at the backend middleware level (`HTTP 403`).
3. **Overall Team Lead Final Salary Approval**  
   Salary cycles (Weekly and Monthly) are prepared and calculated, then gated by mandatory Overall Team Lead approval prior to disbursement.
4. **Shared Case Visibility on Query Transfers**  
   When queries are transferred across departments (e.g., Queries Team $\rightarrow$ KYC Team or Payment Team), the original `queryId` and case history are preserved with bidirectional department visibility, while department-private internal notes remain isolated.
5. **Dual KYC Assignment Strategy**  
   Supports both automatic least-workload round-robin distribution and manual KYC Team Lead assignment/reassignment with an immutable audit history.

---

## Quick Start

### 1. Start Backend API (`backend/`)
```bash
cd backend
npm install
npm run seed   # Seeds hierarchy, test roles, and baseline ledger records
npm run dev    # Starts Express TypeScript API on http://localhost:8007
```

### 2. Start Frontend Client (`frontend/`)
```bash
cd frontend
npm install
npm run dev    # Starts Vite application on http://localhost:5175
```

---

## Pre-Seeded Test Personas (Password: `Connect@2026`)

| Role | Email | Capabilities |
|---|---|---|
| **Overall Team Lead** | `lead@connectapp.in` | Executive Dashboard, Dept Lead Onboarding, Final Salary Approval, Cross-Dept Tasks, Audit Logs |
| **KYC Team Lead** | `kyc.lead@connectapp.in` | KYC Dashboard, Dual Assignment/Reassignment, KYC Staff Onboarding |
| **Payment Team Lead** | `payment.lead@connectapp.in` | Financial Checker, Agent Deposit Liability Oversight, Payment Staff Onboarding |
| **Queries Team Lead** | `queries.lead@connectapp.in` | Queries Workbench, Shared Transfers, Queries Staff Onboarding |
| **KYC Officer** | `kyc.staff@connectapp.in` | Verify documents, Request Re-upload, Approve (Auto-routes Vendor/Agent to Payment) |
| **Payment Officer (Maker)** | `payment.staff@connectapp.in` | Initiate Payouts/Settlements (Maker), Prepare Payroll, Record Deposits |
| **Queries Specialist** | `queries.staff@connectapp.in` | Resolve tickets, Add Private Notes, Transfer Cases across departments |

