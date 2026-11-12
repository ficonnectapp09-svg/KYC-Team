import { Router } from 'express';
import { ApprovalController } from '../controllers/approvalController';
import { authenticateJwt } from '../middleware/authMiddleware';
import { requireRoles } from '../middleware/rbacMiddleware';
import { validateMakerCheckerGate } from '../middleware/makerCheckerMiddleware';
import { validateBody } from '../middleware/validationMiddleware';
import { initiateApprovalSchema } from '../validators/schemas';
import { Role } from '../config/constants';

const router = Router();

router.use(authenticateJwt);
router.use(requireRoles([Role.OVERALL_LEAD, Role.PAYMENT_LEAD, Role.PAYMENT_EMPLOYEE]));

router.get('/', ApprovalController.listApprovals);
router.get('/:id', ApprovalController.getApprovalById);

// Maker: Initiate transaction
router.post(
  '/initiate',
  requireRoles([Role.OVERALL_LEAD, Role.PAYMENT_LEAD, Role.PAYMENT_EMPLOYEE]),
  validateBody(initiateApprovalSchema),
  ApprovalController.initiateTransaction
);

// Checker: Review with strict maker != checker enforcement!
router.post(
  '/:id/review',
  requireRoles([Role.OVERALL_LEAD, Role.PAYMENT_LEAD]),
  validateMakerCheckerGate,
  ApprovalController.reviewApproval
);

// Payment Execution: Authorized payment staff once approved
router.post(
  '/:id/execute',
  requireRoles([Role.OVERALL_LEAD, Role.PAYMENT_LEAD, Role.PAYMENT_EMPLOYEE]),
  ApprovalController.executePayment
);

export default router;

