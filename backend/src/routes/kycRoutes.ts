import { Router } from 'express';
import { KycController } from '../controllers/kycController';
import { authenticateJwt } from '../middleware/authMiddleware';
import { requireRoles } from '../middleware/rbacMiddleware';
import { validateBody } from '../middleware/validationMiddleware';
import { kycVerifySchema, kycResubmitSchema } from '../validators/schemas';
import { Role } from '../config/constants';

const router = Router();

router.use(authenticateJwt);
router.use(requireRoles([Role.OVERALL_LEAD, Role.KYC_LEAD, Role.KYC_EMPLOYEE]));

router.get('/categories/counts', KycController.getCategoryCounts);
router.get('/requests', KycController.listRequests);
router.get('/requests/:id', KycController.getRequestById);
router.get('/requests/:id/download-zip', KycController.downloadDocumentsZip);
router.get('/stats', KycController.getKycStats);

// Read-only import from live Connect App vendors/agents collections
router.post(
  '/sync-ecosystem',
  requireRoles([Role.OVERALL_LEAD, Role.KYC_LEAD]),
  KycController.syncFromEcosystem
);

// Dual KYC Assignment
// 1. Auto distribute
router.post('/auto-assign', KycController.triggerAutoAssign);

// 2. Manual assign or reassign: KYC Team Lead & Overall Lead only
router.post(
  '/assign',
  requireRoles([Role.OVERALL_LEAD, Role.KYC_LEAD]),
  KycController.assignOrReassign
);

// Verification: KYC Employees, KYC Team Lead, Overall Lead
router.post(
  '/verify',
  requireRoles([Role.OVERALL_LEAD, Role.KYC_LEAD, Role.KYC_EMPLOYEE]),
  validateBody(kycVerifySchema),
  KycController.verifyKycAction
);

// Escalate to KYC Team Lead
router.post(
  '/requests/:id/escalate',
  requireRoles([Role.OVERALL_LEAD, Role.KYC_LEAD, Role.KYC_EMPLOYEE]),
  KycController.escalateRequest
);

// Document re-upload resubmission preserving historical versions
router.post(
  '/requests/:id/resubmit',
  validateBody(kycResubmitSchema),
  KycController.resubmitDocument
);

export default router;

