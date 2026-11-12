import { Router } from 'express';
import { AuditController } from '../controllers/auditController';
import { authenticateJwt } from '../middleware/authMiddleware';
import { requireRoles } from '../middleware/rbacMiddleware';
import { Role } from '../config/constants';

const router = Router();

router.use(authenticateJwt);

// Audit logs restricted to Overall Team Lead
router.get(
  '/',
  requireRoles([Role.OVERALL_LEAD]),
  AuditController.listAuditLogs
);

export default router;

