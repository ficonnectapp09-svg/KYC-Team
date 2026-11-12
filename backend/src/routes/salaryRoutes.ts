import { Router } from 'express';
import { SalaryController } from '../controllers/salaryController';
import { authenticateJwt } from '../middleware/authMiddleware';
import { requireRoles, requireOverallLead } from '../middleware/rbacMiddleware';
import { validateBody } from '../middleware/validationMiddleware';
import { salaryPrepareSchema } from '../validators/schemas';
import { Role } from '../config/constants';

const router = Router();

router.use(authenticateJwt);

router.get('/categories/counts', SalaryController.getCategoryCounts);
router.get('/kpis', SalaryController.getSalaryDashboardKpis);
router.get('/structures', SalaryController.listSalaryStructures);
router.put(
  '/structures/:employeeId',
  requireRoles([Role.OVERALL_LEAD, Role.PAYMENT_LEAD]),
  SalaryController.upsertSalaryStructure
);
router.get('/records', SalaryController.listSalaryRecords);
router.get('/records/:id', SalaryController.getSalaryRecordById);

// Prepare payroll record: Payment team or Overall Lead
router.post(
  '/prepare',
  requireRoles([Role.OVERALL_LEAD, Role.PAYMENT_LEAD, Role.PAYMENT_EMPLOYEE]),
  validateBody(salaryPrepareSchema),
  SalaryController.prepareSalary
);

// Department Lead preliminary review (attendance & bonus endorsement)
router.post(
  '/records/:id/dept-review',
  requireRoles([Role.OVERALL_LEAD, Role.KYC_LEAD, Role.PAYMENT_LEAD, Role.QUERIES_LEAD]),
  SalaryController.departmentReviewSalary
);

// CONFIRMED DECISION 3: ONLY OVERALL TEAM LEAD CAN APPROVE
router.post(
  '/records/:id/review',
  requireOverallLead,
  SalaryController.reviewSalaryApproval
);

// Disburse salary: Payment staff after approval
router.post(
  '/records/:id/disburse',
  requireRoles([Role.OVERALL_LEAD, Role.PAYMENT_LEAD, Role.PAYMENT_EMPLOYEE]),
  SalaryController.disburseSalary
);

export default router;

