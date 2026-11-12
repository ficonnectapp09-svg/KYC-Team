import { Router } from 'express';
import { ReportController } from '../controllers/reportController';
import { authenticateJwt } from '../middleware/authMiddleware';
import { requireRoles } from '../middleware/rbacMiddleware';
import { Role } from '../config/constants';

const router = Router();

router.use(authenticateJwt);

// Overall Dashboard KPI & Global Search / Ecosystem endpoints
router.get('/overall', ReportController.getOverallDashboard);
router.get('/ecosystem', ReportController.getEcosystemOverview);
router.get('/search', ReportController.globalSearch);

// Department Reports
router.get(
  '/kyc',
  requireRoles([Role.OVERALL_LEAD, Role.KYC_LEAD]),
  ReportController.getKycReport
);

router.get(
  '/payment',
  requireRoles([Role.OVERALL_LEAD, Role.PAYMENT_LEAD]),
  ReportController.getPaymentReport
);

router.get(
  '/queries',
  requireRoles([Role.OVERALL_LEAD, Role.QUERIES_LEAD]),
  ReportController.getQueriesReport
);

export default router;

