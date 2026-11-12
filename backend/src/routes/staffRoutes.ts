import { Router } from 'express';
import { StaffController } from '../controllers/staffController';
import { authenticateJwt } from '../middleware/authMiddleware';
import { requireRoles } from '../middleware/rbacMiddleware';
import { validateBody } from '../middleware/validationMiddleware';
import { createEmployeeSchema, updateEmployeeSchema } from '../validators/schemas';
import { Role } from '../config/constants';

const router = Router();

router.use(authenticateJwt);

// Listing accessible to Team Leads, Overall Lead (and Payment Employee for salary statement prep)
router.get(
  '/categories/counts',
  requireRoles([Role.OVERALL_LEAD, Role.KYC_LEAD, Role.PAYMENT_LEAD, Role.QUERIES_LEAD]),
  StaffController.getCategoryCounts
);
router.get(
  '/',
  requireRoles([Role.OVERALL_LEAD, Role.KYC_LEAD, Role.PAYMENT_LEAD, Role.QUERIES_LEAD, Role.PAYMENT_EMPLOYEE]),
  StaffController.listEmployees
);
router.get('/:id/overview', StaffController.getEmployeeOverview);
router.get(
  '/:id',
  requireRoles([Role.OVERALL_LEAD, Role.KYC_LEAD, Role.PAYMENT_LEAD, Role.QUERIES_LEAD]),
  StaffController.getEmployeeById
);

// Onboarding: Team Leads and Overall Lead
router.post(
  '/onboard',
  requireRoles([Role.OVERALL_LEAD, Role.KYC_LEAD, Role.PAYMENT_LEAD, Role.QUERIES_LEAD]),
  validateBody(createEmployeeSchema),
  StaffController.onboardEmployee
);

// Status update and profile edit
router.patch(
  '/:id/status',
  requireRoles([Role.OVERALL_LEAD, Role.KYC_LEAD, Role.PAYMENT_LEAD, Role.QUERIES_LEAD]),
  StaffController.updateEmployeeStatus
);

router.put(
  '/:id',
  requireRoles([Role.OVERALL_LEAD, Role.KYC_LEAD, Role.PAYMENT_LEAD, Role.QUERIES_LEAD]),
  validateBody(updateEmployeeSchema),
  StaffController.updateEmployee
);

export default router;

