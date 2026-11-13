const BASE_URL = 'http://localhost:8007/api';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5176';

async function login(email) {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Connect@2026' })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Login failed for ${email}: ${data.message}`);
  return data.data.accessToken;
}

async function runTests() {
  console.log('===================================================================');
  console.log('CONNECT APP BACKOFFICE - MASTER SECTION 25 VERIFICATION TEST SUITE');
  console.log('===================================================================\n');

  let passed = 0;
  let failed = 0;

  const assert = (cond, msg) => {
    if (cond) {
      console.log(`✅ [PASS] ${msg}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${msg}`);
      failed++;
    }
  };

  try {
    // 0. Tokens for all hierarchy levels
    const overallToken = await login('lead@connectapp.in');
    const kycLeadToken = await login('kyc.lead@connectapp.in');
    const payLeadToken = await login('payment.lead@connectapp.in');
    const qryLeadToken = await login('queries.lead@connectapp.in');
    const kycStaffToken = await login('kyc.staff@connectapp.in');
    const payMakerToken = await login('payment.staff@connectapp.in');
    const qryStaffToken = await login('queries.staff@connectapp.in');

    // ---------------------------------------------------------
    // SECTION 1: Confirmed Decision 1 - Agent Deposit Liability Separation & Refund Movement
    // ---------------------------------------------------------
    const kpiBeforeRes = await fetch(`${BASE_URL}/payments/kpis`, {
      headers: { Authorization: `Bearer ${overallToken}` }
    });
    const kpiBefore = (await kpiBeforeRes.json()).data;
    const incomeBefore = kpiBefore.totalRecognizedIncome;
    const liabilityBefore = kpiBefore.liabilities.outstandingAgentDepositLiability;
    assert(incomeBefore >= 30699, `Initial Recognized Income measured cleanly (₹${incomeBefore})`);

    // Record new Agent Deposit Liability (₹15,000) -> Must NEVER enter Income
    const ts = Date.now();
    const depRes = await fetch(`${BASE_URL}/payments/agent-deposits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${payMakerToken}` },
      body: JSON.stringify({
        agentId: `AGT-TEST-${ts}`,
        agentName: 'Suresh Field Agent',
        depositAmount: 15000,
        paymentMethod: 'Bank Transfer (NEFT)',
        gatewayReference: `UTR-${ts}`
      })
    });
    const depJson = await depRes.json();
    assert(depRes.status === 201 && depJson.data.currentOutstandingBalance === 15000, `Agent deposit recorded as liability ${depJson.data.liabilityId}`);
    const testLiabilityId = depJson.data.liabilityId;

    const kpiAfterDep = (await (await fetch(`${BASE_URL}/payments/kpis`, {
      headers: { Authorization: `Bearer ${overallToken}` }
    })).json()).data;
    assert(
      kpiAfterDep.totalRecognizedIncome === incomeBefore &&
        kpiAfterDep.liabilities.outstandingAgentDepositLiability === liabilityBefore + 15000,
      `Agent Deposit increased Liability by ₹15,000 with ZERO distortion of Recognized Income`
    );

    // Partial Refund ₹5,000 -> reduces liability to ₹10,000 & creates movement trail
    const refundRes = await fetch(`${BASE_URL}/payments/agent-deposits/${testLiabilityId}/adjust`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${payLeadToken}` },
      body: JSON.stringify({
        adjustmentType: 'REFUND',
        amount: 5000,
        reason: 'Partial deposit settlement refund test'
      })
    });
    const refundJson = await refundRes.json();
    assert(
      refundRes.status === 200 &&
        refundJson.data.currentOutstandingBalance === 10000 &&
        refundJson.data.movements.length === 2,
      `Agent Deposit Refund processed (Remaining balance ₹10,000, 2 linked ledger movements)`
    );

    // ---------------------------------------------------------
    // SECTION 2: Confirmed Decision 2 - Maker-Checker Payment Authorization
    // ---------------------------------------------------------
    const initRes = await fetch(`${BASE_URL}/approvals/initiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${payMakerToken}` },
      body: JSON.stringify({
        transactionType: 'Technician Payout',
        amount: 3500,
        recipientType: 'Technician',
        recipientId: `TECH-${ts}`,
        recipientName: 'Raju Mechanic',
        idempotencyKey: `IDEM-${ts}`,
        makerNotes: 'Section 25 E2E payout test'
      })
    });
    const initJson = await initRes.json();
    assert(
      initRes.status === 201 && initJson.data.status === 'Pending Checker Review',
      `Maker initiated ${initJson.data.approvalId} entering Pending Checker Review`
    );
    const testApprovalId = initJson.data.approvalId;

    // Maker self-approval -> strictly 403
    const selfAppRes = await fetch(`${BASE_URL}/approvals/${testApprovalId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${payMakerToken}` },
      body: JSON.stringify({ decision: 'APPROVE' })
    });
    assert(selfAppRes.status === 403, `Backend blocked Maker self-approval (HTTP ${selfAppRes.status})`);

    // Execution before Checker sign-off -> strictly 403
    const earlyExecRes = await fetch(`${BASE_URL}/approvals/${testApprovalId}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${payLeadToken}` },
      body: JSON.stringify({ paymentMethod: 'IMPS' })
    });
    assert(earlyExecRes.status === 403, `Backend blocked pre-approval execution (HTTP ${earlyExecRes.status})`);

    // Independent Checker approves & Maker executes
    const chkRes = await fetch(`${BASE_URL}/approvals/${testApprovalId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${payLeadToken}` },
      body: JSON.stringify({ decision: 'APPROVE', remarks: 'Independent Checker sign-off' })
    });
    assert(chkRes.status === 200, `Independent Checker approved ${testApprovalId}`);

    const execRes = await fetch(`${BASE_URL}/approvals/${testApprovalId}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${payMakerToken}` },
      body: JSON.stringify({ paymentMethod: 'IMPS' })
    });
    assert(execRes.status === 200, `Payment executed successfully post-Checker approval`);

    // ---------------------------------------------------------
    // SECTION 3: Confirmed Decision 3 - Overall Team Lead Sole Salary Gate & Duplicate Period Check
    // ---------------------------------------------------------
    const structsRes = await fetch(`${BASE_URL}/salary/structures`, {
      headers: { Authorization: `Bearer ${payLeadToken}` }
    });
    assert(structsRes.status === 200 && (await structsRes.json()).data.length >= 1, `Salary Structures endpoint returned persisted compensation configs`);

    const testPeriod = `E2E-Cycle-${ts}`;
    const prepSalRes = await fetch(`${BASE_URL}/salary/prepare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${payMakerToken}` },
      body: JSON.stringify({
        employeeId: 'EMP-QRY-002',
        periodStart: '2026-11-01',
        periodEnd: '2026-11-30',
        periodLabel: testPeriod,
        incentives: 1500,
        bonus: 500
      })
    });
    const prepSalJson = await prepSalRes.json();
    assert(
      prepSalRes.status === 201 && prepSalJson.data.status === 'Submitted for Overall Approval',
      `Prepared salary statement ${prepSalJson.data.salaryId} routed to Overall Lead`
    );
    const testSalaryId = prepSalJson.data.salaryId;

    // Duplicate period prevention
    const dupSalRes = await fetch(`${BASE_URL}/salary/prepare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${payMakerToken}` },
      body: JSON.stringify({
        employeeId: 'EMP-QRY-002',
        periodStart: '2026-11-01',
        periodEnd: '2026-11-30',
        periodLabel: testPeriod
      })
    });
    assert(!dupSalRes.ok, `Duplicate salary generation blocked for same employee & period (${dupSalRes.status})`);

    // Dept review sign-off by Queries Lead
    const deptRevRes = await fetch(`${BASE_URL}/salary/records/${testSalaryId}/dept-review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${qryLeadToken}` },
      body: JSON.stringify({ notes: 'Verified attendance & ticket resolution SLA' })
    });
    assert(deptRevRes.status === 200, `Department Team Lead added preliminary salary review sign-off`);

    // Non-Overall Lead cannot approve salary (HTTP 403)
    const payLeadSalAppRes = await fetch(`${BASE_URL}/salary/records/${testSalaryId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${payLeadToken}` },
      body: JSON.stringify({ decision: 'APPROVE' })
    });
    assert(payLeadSalAppRes.status === 403, `Non-Overall Lead blocked from final salary approval (HTTP ${payLeadSalAppRes.status})`);

    // Cannot disburse before Overall Lead approval (HTTP 403)
    const earlyDisbRes = await fetch(`${BASE_URL}/salary/records/${testSalaryId}/disburse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${payMakerToken}` },
      body: JSON.stringify({ paymentMethod: 'Bank' })
    });
    assert(earlyDisbRes.status === 403, `Pre-approval salary disbursement blocked (HTTP ${earlyDisbRes.status})`);

    // Overall Lead approves -> Payment Team disburses -> status becomes Paid
    const overallSalAppRes = await fetch(`${BASE_URL}/salary/records/${testSalaryId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${overallToken}` },
      body: JSON.stringify({ decision: 'APPROVE', notes: 'Approved by Overall Team Lead' })
    });
    assert(overallSalAppRes.status === 200, `Overall Team Lead approved ${testSalaryId}`);

    const disbRes = await fetch(`${BASE_URL}/salary/records/${testSalaryId}/disburse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${payMakerToken}` },
      body: JSON.stringify({ paymentMethod: 'Direct Bank Deposit' })
    });
    const disbJson = await disbRes.json();
    assert(
      disbRes.status === 200 && disbJson.data.status === 'Paid' && Boolean(disbJson.data.paidDetails?.transactionId),
      `Approved salary ${testSalaryId} disbursed with ledger Txn ${disbJson.data.paidDetails?.transactionId}`
    );

    // ---------------------------------------------------------
    // SECTION 4: Confirmed Decision 4 - Shared Query Transfer & Notes Isolation + Lifecycle
    // ---------------------------------------------------------
    const qrySrcJson = await (await fetch(`${BASE_URL}/queries/QRY-2026-101`, {
      headers: { Authorization: `Bearer ${qryStaffToken}` }
    })).json();
    const qryDestJson = await (await fetch(`${BASE_URL}/queries/QRY-2026-101`, {
      headers: { Authorization: `Bearer ${payMakerToken}` }
    })).json();
    assert(qrySrcJson.data.internalNotes.length === 2, `Source Dept (Queries) sees all notes including private (${qrySrcJson.data.internalNotes.length})`);
    assert(qryDestJson.data.internalNotes.length === 1, `Destination Dept (Payment) retains shared ticket visibility with private note masked (${qryDestJson.data.internalNotes.length})`);

    // Create -> Assign -> Transfer -> Escalate -> Resolve -> Reopen -> KPIs
    const newQryRes = await fetch(`${BASE_URL}/queries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${qryStaffToken}` },
      body: JSON.stringify({
        userType: 'Vendor',
        userId: `VND-${ts}`,
        userName: 'Apex Mart',
        category: 'Settlement Delay',
        subject: `Payout verification test ${ts}`,
        description: 'Automated Section 25 lifecycle test ticket',
        priority: 'Medium'
      })
    });
    const testQueryId = (await newQryRes.json()).data.queryId;
    const assignQryRes = await fetch(`${BASE_URL}/queries/${testQueryId}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${qryLeadToken}` },
      body: JSON.stringify({ employeeId: 'EMP-QRY-002' })
    });
    const escQryRes = await fetch(`${BASE_URL}/queries/${testQueryId}/escalate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${qryStaffToken}` },
      body: JSON.stringify({ reason: 'Escalation SLA test' })
    });
    const resQryRes = await fetch(`${BASE_URL}/queries/${testQueryId}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${qryLeadToken}` },
      body: JSON.stringify({ resolutionNotes: 'Resolved test case' })
    });
    const reopQryRes = await fetch(`${BASE_URL}/queries/${testQueryId}/reopen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${qryLeadToken}` },
      body: JSON.stringify({ reason: 'Follow-up reopen check' })
    });
    const qryKpisRes = await fetch(`${BASE_URL}/queries/kpis`, {
      headers: { Authorization: `Bearer ${qryLeadToken}` }
    });
    assert(
      assignQryRes.status === 200 &&
        escQryRes.status === 200 &&
        resQryRes.status === 200 &&
        reopQryRes.status === 200 &&
        qryKpisRes.status === 200,
      `Query full lifecycle (Assign, Escalate, Resolve, Reopen, 10-KPI endpoint) passed for ${testQueryId}`
    );

    // ---------------------------------------------------------
    // SECTION 5: Confirmed Decision 5 - Dual KYC Assignment, Re-upload Versioning, Vendor Auto-Route & Direct Approval
    // ---------------------------------------------------------
    // 5a. Auto-assign & Manual Lead Override
    const manualAssignRes = await fetch(`${BASE_URL}/kyc/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${kycLeadToken}` },
      body: JSON.stringify({
        requestId: 'KYC-2026-002',
        newEmployeeId: 'EMP-KYC-002',
        reason: 'Lead manual workload balancing check'
      })
    });
    assert(manualAssignRes.status === 200, `KYC Team Lead manual assign/override recorded in assignmentHistory`);

    // 5b. Ecosystem read-only sync check
    const ecoSyncRes = await fetch(`${BASE_URL}/kyc/sync-ecosystem`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${kycLeadToken}` }
    });
    assert(ecoSyncRes.status === 200, `Read-only Connect App ecosystem KYC sync executed safely`);

    // 5c. Document Re-upload Request -> Resubmit -> Verify previousDocumentVersions preserved -> Direct Approve Manager KYC-2026-003
    const reupReqRes = await fetch(`${BASE_URL}/kyc/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${kycStaffToken}` },
      body: JSON.stringify({
        requestId: 'KYC-2026-003',
        action: 'REQUEST_REUPLOAD',
        documentType: 'Degree Certificate',
        reason: 'Needs higher DPI scan before approval'
      })
    });
    assert(reupReqRes.status === 200, `KYC-2026-003 Re-upload Requested with prior version archived`);

    const resubRes = await fetch(`${BASE_URL}/kyc/requests/KYC-2026-003/resubmit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${kycLeadToken}` },
      body: JSON.stringify({
        docType: 'Degree Certificate',
        docUrl: `https://placehold.co/700x450/png?text=Degree_v2_${ts}`,
        remarks: 'Uploaded clear scan'
      })
    });
    const resubJson = await resubRes.json();
    assert(
      resubRes.status === 200 && resubJson.data.previousDocumentVersions.length >= 1,
      `Document resubmission incremented version and preserved ${resubJson.data.previousDocumentVersions.length} historical version(s)`
    );

    const directApproveRes = await fetch(`${BASE_URL}/kyc/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${kycLeadToken}` },
      body: JSON.stringify({
        requestId: 'KYC-2026-003',
        action: 'APPROVE',
        remarks: 'Direct approval test for Manager applicant'
      })
    });
    const directApproveJson = await directApproveRes.json();
    assert(
      directApproveRes.status === 200 &&
        directApproveJson.data.status === 'Approved' &&
        directApproveJson.data.routedToPayment === false,
      `Manager KYC-2026-003 followed Direct Approval (routedToPayment=false)`
    );

    // 5d. Vendor/Agent KYC Approval -> Automatic Payment Team Task Routing!
    const agentApproveRes = await fetch(`${BASE_URL}/kyc/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${kycLeadToken}` },
      body: JSON.stringify({
        requestId: 'KYC-2026-002',
        action: 'APPROVE',
        remarks: 'Verified Agent KYC documents - trigger automatic Payment routing'
      })
    });
    const agentApproveJson = await agentApproveRes.json();
    assert(
      agentApproveRes.status === 200 &&
        agentApproveJson.data.status === 'Approved' &&
        agentApproveJson.data.routedToPayment === true &&
        Boolean(agentApproveJson.data.paymentTaskId),
      `Agent KYC-2026-002 Approved & auto-routed Payment task ${agentApproveJson.data.paymentTaskId}`
    );

    // ---------------------------------------------------------
    // SECTION 6: Attendance, Settings, Ecosystem Reader, Global Search & Cross-Role RBAC Isolation
    // ---------------------------------------------------------
    const attMarkRes = await fetch(`${BASE_URL}/attendance/mark`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${kycStaffToken}` },
      body: JSON.stringify({ status: 'Present', workHours: 8, remarks: 'E2E check-in' })
    });
    const attSumRes = await fetch(`${BASE_URL}/attendance/summary`, {
      headers: { Authorization: `Bearer ${overallToken}` }
    });
    assert(attMarkRes.status <= 201 && attSumRes.status === 200, `Attendance check-in & summary endpoints operational`);

    const settingsGetRes = await fetch(`${BASE_URL}/settings`, {
      headers: { Authorization: `Bearer ${overallToken}` }
    });
    const settingsForbiddenRes = await fetch(`${BASE_URL}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${kycLeadToken}` },
      body: JSON.stringify({ kycSettings: { slaHours: 10 } })
    });
    assert(settingsGetRes.status === 200 && settingsForbiddenRes.status === 403, `Settings GET works and non-Overall Lead PUT blocked with HTTP 403`);

    // Cross-department IDOR/RBAC rejections
    const staffAssignForbid = await fetch(`${BASE_URL}/kyc/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${kycStaffToken}` },
      body: JSON.stringify({ requestId: 'KYC-2026-001', newEmployeeId: 'EMP-KYC-002' })
    });
    const leadAuditForbid = await fetch(`${BASE_URL}/audit-logs`, {
      headers: { Authorization: `Bearer ${kycLeadToken}` }
    });
    const crossDeptProfileForbid = await fetch(`${BASE_URL}/staff/EMP-KYC-002/overview`, {
      headers: { Authorization: `Bearer ${qryStaffToken}` }
    });
    assert(
      staffAssignForbid.status === 403 && leadAuditForbid.status === 403 && crossDeptProfileForbid.status === 403,
      `Strict RBAC & department isolation blocked unauthorized assign (${staffAssignForbid.status}), audit (${leadAuditForbid.status}), cross-dept profile (${crossDeptProfileForbid.status})`
    );

    // Dashboard, Connect App Ecosystem Summary, Global Search & Frontend Health
    const [overallRes, ecoRes, searchRes, feRes] = await Promise.all([
      fetch(`${BASE_URL}/reports/overall`, { headers: { Authorization: `Bearer ${overallToken}` } }),
      fetch(`${BASE_URL}/reports/ecosystem`, { headers: { Authorization: `Bearer ${overallToken}` } }),
      fetch(`${BASE_URL}/reports/search?q=Apex`, { headers: { Authorization: `Bearer ${overallToken}` } }),
      fetch(`${FRONTEND_URL}/`)
    ]);
    const ecoJson = await ecoRes.json();
    assert(
      overallRes.status === 200 &&
        ecoRes.status === 200 &&
        ecoJson.data.ordersCount >= 400 &&
        searchRes.status === 200 &&
        feRes.status === 200,
      `Overall Dashboard, Connect Ecosystem Read-Only (${ecoJson.data.ordersCount} orders), Global Search & Frontend HTTP 200 verified`
    );

    // ---------------------------------------------------------
    // SECTION 7: Section 30 I Mandatory Role-Wise Categorization & Access Control Tests
    // ---------------------------------------------------------
    const fetchJson = async (url, token) => {
      const r = await fetch(`${BASE_URL}${url}`, { headers: { Authorization: `Bearer ${token}` } });
      return { status: r.status, body: await r.json().catch(() => ({})) };
    };

    // 30.I.1-5: KYC Role Tabs Isolation & No Duplicates in ALL
    const [
      kycAllRes,
      kycVendorRes,
      kycAgentRes,
      kycManagerRes,
      kycDeliveryRes,
      kycTechRes,
      kycCountsRes,
      kycInvalidRes
    ] = await Promise.all([
      fetchJson('/kyc/requests?category=ALL&limit=100', overallToken),
      fetchJson('/kyc/requests?category=VENDOR&limit=50', overallToken),
      fetchJson('/kyc/requests?category=AGENT&limit=50', overallToken),
      fetchJson('/kyc/requests?category=MANAGER&limit=50', overallToken),
      fetchJson('/kyc/requests?category=DELIVERY_PARTNER&limit=50', overallToken),
      fetchJson('/kyc/requests?category=TECHNICIAN&limit=50', overallToken),
      fetchJson('/kyc/categories/counts', overallToken),
      fetchJson('/kyc/requests?category=INVALID_ROLE', overallToken)
    ]);

    const allKycIds = (kycAllRes.body.data || []).map((r) => r.requestId);
    const uniqueKycIds = new Set(allKycIds);
    assert(
      kycVendorRes.status === 200 &&
        kycVendorRes.body.data.length >= 1 &&
        kycVendorRes.body.data.every((r) => r.applicantType === 'Vendor'),
      `Section 30.I.1 Vendor KYC tab shows only Vendor records (${kycVendorRes.body.data.length})`
    );
    assert(
      kycAgentRes.status === 200 &&
        kycAgentRes.body.data.length >= 1 &&
        kycAgentRes.body.data.every((r) => r.applicantType === 'Agent'),
      `Section 30.I.2 Agent KYC tab shows only Agent records (${kycAgentRes.body.data.length})`
    );
    assert(
      kycManagerRes.status === 200 &&
        kycManagerRes.body.data.length >= 1 &&
        kycManagerRes.body.data.every((r) => r.applicantType === 'Manager') &&
        kycDeliveryRes.status === 200 &&
        kycDeliveryRes.body.data.length >= 1 &&
        kycDeliveryRes.body.data.every((r) => r.applicantType === 'Delivery Partner') &&
        kycTechRes.status === 200 &&
        kycTechRes.body.data.length >= 1 &&
        kycTechRes.body.data.every((r) => r.applicantType === 'Technician'),
      `Section 30.I.3-4 Manager, Delivery Partner & Technician KYC tabs isolated cleanly`
    );
    assert(
      kycAllRes.status === 200 &&
        allKycIds.length === uniqueKycIds.size &&
        kycCountsRes.status === 200 &&
        kycCountsRes.body.data.VENDOR === kycVendorRes.body.total &&
        kycInvalidRes.status === 400,
      `Section 30.I.5 ALL KYC unique (${allKycIds.length}), backend counts match (${kycCountsRes.body.data?.VENDOR}), unsupported category rejected (HTTP ${kycInvalidRes.status})`
    );

    // 30.I.6-8: Payment Category Isolation & Agent Deposit Liability Separation
    const [payVendorRes, payDeliveryRes, payInvalidRes, payDepositsRes] = await Promise.all([
      fetchJson('/payments/transactions?category=VENDOR_PAYMENTS&limit=50', payLeadToken),
      fetchJson('/payments/transactions?category=DELIVERY_PARTNER_PAYOUTS&limit=50', payLeadToken),
      fetchJson('/payments/transactions?category=NON_EXISTENT_TAB', payLeadToken),
      fetchJson('/payments/agent-deposits?limit=50', payLeadToken)
    ]);
    assert(
      payVendorRes.status === 200 &&
        payVendorRes.body.data.length >= 1 &&
        payVendorRes.body.data.every(
          (t) =>
            (t.fromParty?.type === 'Vendor' || t.toParty?.type === 'Vendor') &&
            ![
              'Customer Order Payment',
              'Product Order Payment',
              'Food Order Payment',
              'Daily Needs Order Payment',
              'Service Booking Payment',
              'Stay Booking Payment',
              'Travel Booking Payment',
              'Membership Payment'
            ].includes(t.transactionType)
        ),
      `Section 30.I.6 Vendor Payments tab excludes Customer order payments (${payVendorRes.body.data.length})`
    );
    assert(
      payDeliveryRes.status === 200 &&
        payDeliveryRes.body.data.length >= 1 &&
        payDeliveryRes.body.data.every((t) => t.transactionType === 'Delivery Partner Payout') &&
        payDepositsRes.status === 200 &&
        payDepositsRes.body.data.length >= 1 &&
        payInvalidRes.status === 400,
      `Section 30.I.7-8 Delivery Partner Payouts (${payDeliveryRes.body.data.length}) isolated from Technician payouts; Agent Deposit Liabilities separate (${payDepositsRes.body.data.length}); invalid rejected (${payInvalidRes.status})`
    );

    // 30.I.9-11: Query Source Category Tabs & Transferred Ticket Origin Preservation
    const [qryVendorRes, qryCustRes, qryDeliveryRes, qryInvalidRes] = await Promise.all([
      fetchJson('/queries?sourceCategory=VENDOR&limit=50', qryLeadToken),
      fetchJson('/queries?sourceCategory=CUSTOMER&limit=50', qryLeadToken),
      fetchJson('/queries?sourceCategory=DELIVERY_PARTNER&limit=50', qryLeadToken),
      fetchJson('/queries?sourceCategory=BAD_SOURCE', qryLeadToken)
    ]);
    const transferredVendorTicket = (qryVendorRes.body.data || []).find((q) => q.queryId === 'QRY-2026-101');
    assert(
      qryVendorRes.status === 200 &&
        qryVendorRes.body.data.every((q) => q.userType === 'Vendor') &&
        Boolean(transferredVendorTicket) &&
        qryCustRes.status === 200 &&
        qryCustRes.body.data.every((q) => q.userType === 'Customer') &&
        qryDeliveryRes.status === 200 &&
        qryDeliveryRes.body.data.every((q) => q.userType === 'Delivery Partner') &&
        qryInvalidRes.status === 400,
      `Section 30.I.9-11 Query tabs isolated (Vendor incl. transferred QRY-2026-101: ${Boolean(transferredVendorTicket)}) & invalid source rejected (${qryInvalidRes.status})`
    );

    // 30.I.12-13: Staff Directory Role-Wise Filtering & Tab Pagination/Search
    const vendorSearchTerm = encodeURIComponent((kycVendorRes.body.data[0]?.applicantName || 'Vendor').split(' ')[0]);
    const [staffKycEmpRes, staffPayLeadRes, staffOverallRes, kycSearchPagedRes] = await Promise.all([
      fetchJson('/staff?staffCategory=KYC_EMPLOYEES&limit=50', overallToken),
      fetchJson('/staff?staffCategory=PAYMENT_LEAD&limit=50', overallToken),
      fetchJson('/staff?staffCategory=OVERALL_LEAD&limit=50', overallToken),
      fetchJson(`/kyc/requests?category=VENDOR&page=1&limit=1&search=${vendorSearchTerm}`, kycLeadToken)
    ]);
    assert(
      staffKycEmpRes.status === 200 &&
        staffKycEmpRes.body.data.every((e) => e.role === 'kyc_employee') &&
        staffPayLeadRes.status === 200 &&
        staffPayLeadRes.body.data.every((e) => e.role === 'payment_lead') &&
        staffOverallRes.status === 200 &&
        staffOverallRes.body.data.every((e) => e.role === 'overall_lead') &&
        kycSearchPagedRes.status === 200 &&
        kycSearchPagedRes.body.page === 1 &&
        kycSearchPagedRes.body.limit === 1 &&
        kycSearchPagedRes.body.data.length >= 1,
      `Section 30.I.12-13 Staff role tabs & per-tab server pagination/search verified`
    );

    // 30.I.14-15: Unauthorized Direct API Role Calls Rejected (HTTP 403)
    const [payOnKycForbid, kycOnPayForbid, qryLeadOnPayStaffForbid] = await Promise.all([
      fetchJson('/kyc/requests?category=VENDOR', payMakerToken),
      fetchJson('/payments/transactions?category=CUSTOMER_PAYMENTS', kycStaffToken),
      fetchJson('/staff?staffCategory=PAYMENT_EMPLOYEES', qryLeadToken)
    ]);
    assert(
      payOnKycForbid.status === 403 && kycOnPayForbid.status === 403 && qryLeadOnPayStaffForbid.status === 403,
      `Section 30.I.14-15 Cross-department API isolation returned HTTP 403 (${payOnKycForbid.status}/${kycOnPayForbid.status}/${qryLeadOnPayStaffForbid.status})`
    );

    // ---------------------------------------------------------
    // SECTION 8: Section 31 I Mandatory Income, Expenses & Separate Salary Tests
    // ---------------------------------------------------------
    const [
      incCustRes,
      incVendorSubRes,
      incAgentRes,
      incMemRes,
      incAllRes,
      expVendorRes,
      expAgentRes,
      expDeliveryRes,
      expTechRes,
      expAllRes,
      salWeeklyRes,
      salApprovedRes,
      payKpisRes,
      payCountsRes
    ] = await Promise.all([
      fetchJson('/payments/transactions?section=income&category=CUSTOMER_PAYMENTS&limit=100', payLeadToken),
      fetchJson('/payments/transactions?section=income&category=VENDOR_SUBSCRIPTION_PAYMENTS&limit=100', payLeadToken),
      fetchJson('/payments/transactions?section=income&category=AGENT_PAYMENTS_RECEIVED&limit=100', payLeadToken),
      fetchJson('/payments/transactions?section=income&category=MEMBERSHIP_PAYMENTS&limit=100', payLeadToken),
      fetchJson('/payments/transactions?section=income&status=COMPLETED&limit=200', payLeadToken),
      fetchJson('/payments/transactions?section=expenses&category=VENDOR_PAYMENTS&limit=100', payLeadToken),
      fetchJson('/payments/transactions?section=expenses&category=AGENT_PAYMENTS&limit=100', payLeadToken),
      fetchJson('/payments/transactions?section=expenses&category=DELIVERY_PARTNER_PAYMENTS&limit=100', payLeadToken),
      fetchJson('/payments/transactions?section=expenses&category=TECHNICIAN_PAYMENTS&limit=100', payLeadToken),
      fetchJson('/payments/transactions?section=expenses&limit=200', payLeadToken),
      fetchJson('/salary/records?salaryCategory=WEEKLY&limit=50', payLeadToken),
      fetchJson('/salary/records?salaryCategory=APPROVED&limit=50', payLeadToken),
      fetchJson('/payments/kpis', payLeadToken),
      fetchJson('/payments/categories/counts', payLeadToken)
    ]);

    // 31.I.1-2: Customer Order & Booking Payments in Income
    const custIds = (incCustRes.body.data || []).map((t) => t.transactionId);
    assert(
      custIds.includes('TXN-ORD-2026-101') && custIds.includes('TXN-ORD-FOOD-101') &&
      custIds.includes('TXN-BKG-2026-102') && custIds.includes('TXN-BKG-STAY-103'),
      `Section 31.I.1-2 Customer order & booking payments appear in Income (${custIds.length} records)`
    );

    // 31.I.3-6: Vendor Subs, Qualifying Agent Fee, Deposit Liability Exclusion, Membership in Income
    const incVendorIds = (incVendorSubRes.body.data || []).map((t) => t.transactionId);
    const incAgentIds = (incAgentRes.body.data || []).map((t) => t.transactionId);
    const incMemIds = (incMemRes.body.data || []).map((t) => t.transactionId);
    const allIncTypes = (incAllRes.body.data || []).map((t) => t.transactionType);
    assert(
      incVendorIds.includes('TXN-SUB-2026-104') &&
        incVendorIds.includes('TXN-VSUB-202') &&
        incAgentIds.includes('TXN-AGT-FEE-201') &&
        !allIncTypes.includes('Agent Initial Deposit') &&
        incMemIds.includes('TXN-MEM-2026-103') &&
        incMemIds.includes('TXN-MEM-203'),
      `Section 31.I.3-6 Vendor subscriptions, qualifying Agent fee & Memberships appear in Income; Agent Initial Deposits excluded`
    );

    // 31.I.7-10: Vendor, Agent Tie-up, Delivery Partner & Technician Payouts in Expenses
    const expVIds = (expVendorRes.body.data || []).map((t) => t.transactionId);
    const expAIds = (expAgentRes.body.data || []).map((t) => t.transactionId);
    const expDIds = (expDeliveryRes.body.data || []).map((t) => t.transactionId);
    const expTIds = (expTechRes.body.data || []).map((t) => t.transactionId);
    assert(
      expVIds.includes('TXN-SET-2026-105') &&
        expAIds.includes('TXN-AGT-TIEUP-106') &&
        !expAIds.includes('TXN-AGT-FEE-201') &&
        expDIds.includes('TXN-DEL-PAY-107') &&
        expTIds.includes('TXN-TEC-PAY-204'),
      `Section 31.I.7-10 Vendor settlements, Agent tie-up, Delivery Partner & Technician payouts isolated in Expenses`
    );

    // 31.I.11-12: Separate Salary Module & Salary Exclusion from Expenses
    const allExpenseTypes = (expAllRes.body.data || []).map((t) => t.transactionType);
    assert(
      payCountsRes.body.data &&
        payCountsRes.body.data.SALARY_PAYMENTS === undefined &&
        !allExpenseTypes.includes('Salary Payment') &&
        salWeeklyRes.status === 200 &&
        salWeeklyRes.body.data.length >= 1 &&
        salApprovedRes.status === 200 &&
        salApprovedRes.body.data.length >= 1,
      `Section 31.I.11-12 Salary records reside only in separate Salary module and are strictly excluded from Expenses`
    );

    // 31.I.13 & 31.I.15: Pending/Failed Exclusion & Dashboard Totals Match Persisted Backend Records
    const kpiData = payKpisRes.body.data;
    const sumIncSubtotals =
      kpiData.incomeDashboard.customerPayments +
      kpiData.incomeDashboard.vendorSubscriptionIncome +
      kpiData.incomeDashboard.agentRecognizedIncome +
      kpiData.incomeDashboard.membershipIncome;
    const sumExpSubtotals =
      kpiData.expensesDashboard.vendorPayments +
      kpiData.expensesDashboard.agentPayouts +
      kpiData.expensesDashboard.deliveryPartnerPayments +
      kpiData.expensesDashboard.technicianPayments;
    const persistedCompletedIncSum = (incAllRes.body.data || []).reduce((s, t) => s + (t.finalAmount ?? t.amount ?? 0), 0);
    const persistedCompletedExpSum = (expAllRes.body.data || [])
      .filter((t) => t.status === 'COMPLETED')
      .reduce((s, t) => s + (t.finalAmount ?? t.amount ?? 0), 0);

    assert(
      kpiData.incomeDashboard.totalIncome === sumIncSubtotals &&
        kpiData.incomeDashboard.totalIncome === persistedCompletedIncSum &&
        kpiData.expensesDashboard.totalExpenses === sumExpSubtotals &&
        kpiData.expensesDashboard.totalExpenses === persistedCompletedExpSum &&
        kpiData.expensesDashboard.pendingExpensesAmount >= 4200 &&
        kpiData.expensesDashboard.failedExpensesAmount >= 1650 &&
        kpiData.netOperatingMovement === kpiData.totalRecognizedIncome - kpiData.totalExpenses,
      `Section 31.I.13 & 31.I.15 Income (₹${persistedCompletedIncSum}) & Expenses (₹${persistedCompletedExpSum}) KPIs match persisted completed records and exclude Pending/Failed/Salary`
    );

    // 31.I.14 + 31.G/H: Classification Purpose Validation, Duplicate Prevention & Export Permission RBAC
    const badClassRes = await fetch(`${BASE_URL}/approvals/initiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${payMakerToken}` },
      body: JSON.stringify({
        transactionType: 'Agent Initial Deposit',
        financialClassification: 'Income',
        amount: 5000,
        recipientType: 'Agent',
        recipientId: 'AGT-TEST-BAD',
        recipientName: 'Bad Classification Agent'
      })
    });
    const dupRefKey = `STL-DUP-${ts}`;
    const firstInit = await fetch(`${BASE_URL}/approvals/initiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${payMakerToken}` },
      body: JSON.stringify({
        transactionType: 'Vendor Order Settlement',
        amount: 3100,
        recipientType: 'Vendor',
        recipientId: 'VND-DUP-1',
        recipientName: 'Dup Guard Vendor',
        relatedReferenceId: dupRefKey
      })
    });
    const secondDupInit = await fetch(`${BASE_URL}/approvals/initiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${payMakerToken}` },
      body: JSON.stringify({
        transactionType: 'Vendor Order Settlement',
        amount: 3100,
        recipientType: 'Vendor',
        recipientId: 'VND-DUP-1',
        recipientName: 'Dup Guard Vendor',
        relatedReferenceId: dupRefKey
      })
    });
    const [exportDeniedRes, exportAllowedRes] = await Promise.all([
      fetch(`${BASE_URL}/payments/transactions/export?section=income`, { headers: { Authorization: `Bearer ${payMakerToken}` } }),
      fetch(`${BASE_URL}/payments/transactions/export?section=income`, { headers: { Authorization: `Bearer ${payLeadToken}` } })
    ]);
    assert(
      badClassRes.status === 400 &&
        firstInit.status === 201 &&
        secondDupInit.status === 409 &&
        exportDeniedRes.status === 403 &&
        exportAllowedRes.status === 200,
      `Section 31.G-H Purpose classification guard (400), duplicate payout block (409) & export RBAC (Maker 403 / Lead 200) verified`
    );
  } catch (err) {
    console.error(err.stack, err.cause);
    failed++;
  }

  console.log('\n===================================================================');
  console.log(`FINAL SECTION 25 SUMMARY: ${passed} Passed | ${failed} Failed`);
  console.log('===================================================================');
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
