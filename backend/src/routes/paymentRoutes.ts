import { Router } from 'express';
import { PaymentController } from '../controllers/paymentController';
import { authenticateJwt } from '../middleware/authMiddleware';
import { requireRoles } from '../middleware/rbacMiddleware';
import { Role } from '../config/constants';

const router = Router();

router.use(authenticateJwt);
router.use(requireRoles([Role.OVERALL_LEAD, Role.PAYMENT_LEAD, Role.PAYMENT_EMPLOYEE]));

router.get('/categories/counts', PaymentController.getCategoryCounts);
router.get('/kpis', PaymentController.getPaymentKpis);
router.get('/transactions', PaymentController.listTransactions);
router.get(
  '/transactions/export',
  requireRoles([Role.OVERALL_LEAD, Role.PAYMENT_LEAD]),
  PaymentController.exportTransactionsCsv
);
router.get('/transactions/:id', PaymentController.getTransactionById);

// Agent Deposit Liability Endpoints (Strict Liability Separation)
router.get('/agent-deposits', PaymentController.listAgentDeposits);
router.post(
  '/agent-deposits',
  requireRoles([Role.OVERALL_LEAD, Role.PAYMENT_LEAD, Role.PAYMENT_EMPLOYEE]),
  PaymentController.recordAgentDeposit
);
router.post(
  '/agent-deposits/:id/adjust',
  requireRoles([Role.OVERALL_LEAD, Role.PAYMENT_LEAD, Role.PAYMENT_EMPLOYEE]),
  PaymentController.adjustAgentDeposit
);

// Payment Links & Gateway Verification (Vendor Onboarding / Agent Security Deposit)
router.post(
  '/payment-links/generate',
  requireRoles([Role.OVERALL_LEAD, Role.PAYMENT_LEAD, Role.PAYMENT_EMPLOYEE]),
  PaymentController.generatePaymentLink
);
router.post(
  '/payment-links/send-email',
  requireRoles([Role.OVERALL_LEAD, Role.PAYMENT_LEAD, Role.PAYMENT_EMPLOYEE]),
  PaymentController.sendPaymentEmail
);
router.post(
  '/payment-links/verify',
  requireRoles([Role.OVERALL_LEAD, Role.PAYMENT_LEAD, Role.PAYMENT_EMPLOYEE]),
  PaymentController.verifyPaymentAndActivate
);

export default router;

